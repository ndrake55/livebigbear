import { describe, expect, it } from 'vitest';
import { summarize } from './caltrans';
import { describeFire, directionTo, milesBetween, parseFires } from './fires';
import { STORM_SAMPLE } from './sample';
import { sunTimes, utcOffsetHours } from './sun';
import { buildToday, daylightLine, windFromText } from './today';
import { STORM_WEATHER, type Weather } from './weather';

const pt = (d: Date) =>
  new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', minute: '2-digit' }).format(d);
const minutes = (d: Date) => {
  const [h, m] = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Los_Angeles', hour: '2-digit', minute: '2-digit' }).format(d).split(':').map(Number);
  return h * 60 + m;
};

describe('sun times for Big Bear', () => {
  const at = (iso: string) => new Date(iso);
  it('finds the time zone offset across daylight saving', () => {
    expect(utcOffsetHours(at('2026-01-15T20:00:00Z'), 'America/Los_Angeles')).toBe(-8);
    expect(utcOffsetHours(at('2026-07-15T20:00:00Z'), 'America/Los_Angeles')).toBe(-7);
  });
  // Expected values are the approximate known times for Big Bear on these dates. They were written
  // from memory, not copied from an almanac, so the test allows a few minutes either way.
  it.each([
    ['2026-12-21T20:00:00Z', -8, 6 * 60 + 50, 16 * 60 + 41], // winter solstice
    ['2026-06-21T20:00:00Z', -7, 5 * 60 + 36, 20 * 60 + 2], // summer solstice
    ['2026-03-20T20:00:00Z', -7, 6 * 60 + 52, 19 * 60 + 0], // equinox
  ])('%s', (iso, offset, rise, set) => {
    const s = sunTimes(at(iso), 34.2439, -116.9114, offset);
    expect(Math.abs(minutes(s.sunrise) - rise)).toBeLessThanOrEqual(4);
    expect(Math.abs(minutes(s.sunset) - set)).toBeLessThanOrEqual(4);
  });
  it('writes the daylight line before sunrise, during the day and after sunset', () => {
    expect(daylightLine(at('2026-12-21T13:00:00Z'))).toMatch(/Sun is up in 1 hr \d+ min$/); // 5:00 AM
    expect(daylightLine(at('2026-12-21T22:00:00Z'))).toMatch(/2 hr \d+ min of daylight left$/); // 2:00 PM
    expect(daylightLine(at('2026-12-22T03:00:00Z'))).toMatch(/The sun is down$/); // 7:00 PM
    expect(pt(sunTimes(at('2026-12-21T20:00:00Z'), 34.2439, -116.9114, -8).sunset)).toMatch(/^4:\d\d PM$/);
  });
});

describe('today summary', () => {
  const now = new Date('2026-01-15T20:00:00Z');
  const clear: Weather = {
    ok: true,
    periods: [{ name: 'Today', temperature: 58, unit: 'F', wind: '5 to 10 mph W', short: 'Sunny', isDaytime: true }],
    snow24hIn: 0,
    observation: null,
    alerts: [],
  };
  it('reads the top wind speed from forecast text', () => {
    expect(windFromText('5 to 15 mph')).toBe(15);
    expect(windFromText('10 mph')).toBe(10);
    expect(windFromText('')).toBeNull();
  });
  it('describes a storm day', () => {
    const t = buildToday(summarize([...STORM_SAMPLE]), { ...STORM_WEATHER, observation: { ...STORM_WEATHER.observation!, at: now.toISOString() } }, now);
    expect(t.lines.map((l) => [l.activity, l.rating, l.label])).toEqual([
      ['Driving up', 'fair', 'Chains'],
      ['Trails', 'poor', 'Alert'],
      ['On the lake', 'fair', 'Choppy'],
      ['New snow', 'info', '6 in'],
    ]);
  });
  it('describes a clear winter day', () => {
    const open = summarize([...STORM_SAMPLE]).map((r) => ({ ...r, level: 'open' as const }));
    const t = buildToday(open, clear, now);
    expect(t.lines.map((l) => [l.activity, l.rating, l.label])).toEqual([
      ['Driving up', 'good', 'Clear'],
      ['Trails', 'good', 'Nice'],
      ['On the lake', 'good', 'Calm'],
      ['New snow', 'info', 'None'],
    ]);
    expect(t.lines[1].detail).toBe('58°F, 10 mph wind, Sunny.');
  });
  it('leaves snow out in summer and copes with no weather', () => {
    const july = new Date('2026-07-15T20:00:00Z');
    const open = summarize([...STORM_SAMPLE]).map((r) => ({ ...r, level: 'open' as const }));
    expect(buildToday(open, clear, july).lines.map((l) => l.activity)).toEqual(['Driving up', 'Trails', 'On the lake']);
    expect(buildToday(open, { ok: false, periods: [], snow24hIn: null, observation: null, alerts: [] }, july).lines).toHaveLength(1);
  });
});

describe('fires', () => {
  it('measures distance and direction from the valley', () => {
    const home = { lat: 34.2439, lon: -116.9114 };
    expect(Math.round(milesBetween(home, { lat: 34.121119, lon: -117.154705 }))).toBe(16); // near Highland
    expect(directionTo(home, { lat: 34.121119, lon: -117.154705 })).toBe('southwest');
    expect(directionTo(home, { lat: 34.6, lon: -116.9114 })).toBe('north');
  });
  it('keeps active incidents near the valley, nearest first, from either feed shape', () => {
    const rows = [
      { Name: 'Far Fire', Latitude: 38.25, Longitude: -119.94, IsActive: true, AcresBurned: 316 },
      { Name: 'Line Fire', Latitude: 34.121119, Longitude: -117.154705, IsActive: true, AcresBurned: 43978, PercentContained: 97, County: 'San Bernardino', Url: '/incidents/2024/9/5/line-fire/', UniqueId: 'abc' },
      { Name: 'Out Fire', Latitude: 34.2, Longitude: -116.9, IsActive: false },
      { Name: 'Near Fire', Latitude: 34.25, Longitude: -116.95, IsActive: true, AcresBurned: null, PercentContained: null },
      { Name: 'Bad Row', Latitude: -12, Longitude: 2100 },
      null,
    ];
    const list = parseFires(rows);
    expect(list.map((f) => f.name)).toEqual(['Near Fire', 'Line Fire']);
    expect(list[1]).toMatchObject({ id: 'abc', miles: 16, direction: 'southwest', url: 'https://www.fire.ca.gov/incidents/2024/9/5/line-fire/' });
    expect(describeFire(list[1])).toBe('16 mi southwest of Big Bear Lake · 43,978 acres · 97% contained');
    expect(describeFire(list[0])).toBe('2 mi west of Big Bear Lake');
    const geo = { type: 'FeatureCollection', features: rows.filter(Boolean).map((p) => ({ type: 'Feature', properties: p })) };
    expect(parseFires(geo).map((f) => f.name)).toEqual(['Near Fire', 'Line Fire']);
    expect(parseFires('nope')).toEqual([]);
  });
});

import { readLakePage } from './probes';

describe('lake page reader', () => {
  it('pulls the figures out of the page text', () => {
    const html =
      '<div><h3>Current Conditions</h3><p>Current Lake Temperature: 52.2&nbsp;°F</p><p>Lake Down from Full: 9.48</p></div>' +
      '<div><p>East Launch Ramp: <b>Open</b> daily 7:00 AM to 3:00 PM</p><p>West Launch Ramp: Closed</p></div>';
    expect(readLakePage(html)).toEqual({ temp: '52.2', down: '9.48', ramps: 'East open, West closed' });
    expect(readLakePage('<p>nothing here</p>')).toEqual({ temp: '', down: '', ramps: '' });
  });
});

import { parseForecast, parseObservations } from './air';
import { parseCampgrounds, tidyName } from './camping';

describe('air quality', () => {
  it('reports the worst pollutant as the reading', () => {
    const obs = [
      { ReportingArea: 'Big Bear', ParameterName: 'O3', AQI: 38, Category: { Number: 1, Name: 'Good' } },
      { ReportingArea: 'Big Bear', ParameterName: 'PM2.5', AQI: 61, Category: { Number: 2, Name: 'Moderate' } },
    ];
    expect(parseObservations(obs)).toEqual({ aqi: 61, category: 'Moderate', level: 2, pollutant: 'PM2.5', area: 'Big Bear' });
    expect(parseObservations({ Data: obs })?.aqi).toBe(61); // wrapped form
    expect(parseObservations([{ parameter_name: 'PM2.5', aqi: 155, category_name: 'Unhealthy' }])).toMatchObject({ level: 4, category: 'Unhealthy' });
    expect(parseObservations([])).toBeNull();
    expect(parseObservations('nope')).toBeNull();
  });
  it('finds tomorrow in the forecast, including category-only forecasts', () => {
    const fc = [
      { DateForecast: '2026-11-11', ParameterName: 'PM2.5', AQI: 40, Category: { Number: 1, Name: 'Good' } },
      { DateForecast: '2026-11-12', ParameterName: 'O3', AQI: -1, Category: { Number: 2, Name: 'Moderate' } },
      { DateForecast: '2026-11-12', ParameterName: 'PM2.5', AQI: 45, Category: { Number: 1, Name: 'Good' } },
      { DateForecast: '2026-11-13', ParameterName: 'PM2.5', AQI: 160, Category: { Number: 4, Name: 'Unhealthy' } },
    ];
    expect(parseForecast(fc, '2026-11-11')).toEqual({ aqi: null, category: 'Moderate', level: 2, pollutant: 'O3', area: '' });
    expect(parseForecast(fc, '2026-11-13')).toBeNull();
  });
});

describe('campgrounds', () => {
  it('keeps nearby campgrounds, nearest first, with tidy names', () => {
    expect(tidyName('HANNA FLAT')).toBe('Hanna Flat');
    expect(tidyName('camp of the pines')).toBe('Camp of the Pines');
    const list = parseCampgrounds({
      RECDATA: [
        { FacilityID: '232295', FacilityName: 'HEART BAR CAMPGROUND', FacilityTypeDescription: 'Campground', FacilityLatitude: 34.158, FacilityLongitude: -116.786, Reservable: true, Enabled: true },
        { FacilityID: '232286', FacilityName: 'PINEKNOT', FacilityTypeDescription: 'Campground', FacilityLatitude: 34.234, FacilityLongitude: -116.883, Reservable: true, Enabled: true },
        { FacilityID: '1', FacilityName: 'FAR AWAY', FacilityTypeDescription: 'Campground', FacilityLatitude: 36, FacilityLongitude: -118, Reservable: true },
        { FacilityID: '2', FacilityName: 'VISITOR CENTER', FacilityTypeDescription: 'Facility', FacilityLatitude: 34.26, FacilityLongitude: -116.9 },
        { FacilityID: '3', FacilityName: 'NO PLACE', FacilityTypeDescription: 'Campground', FacilityLatitude: 0, FacilityLongitude: 0 },
        { FacilityID: '4', FacilityName: 'SWITCHED OFF', FacilityTypeDescription: 'Campground', FacilityLatitude: 34.25, FacilityLongitude: -116.9, Enabled: false },
        null,
      ],
    });
    expect(list.map((c) => c.name)).toEqual(['Pineknot', 'Heart Bar Campground']);
    expect(list[0]).toMatchObject({ id: '232286', reservable: true, url: 'https://www.recreation.gov/camping/campgrounds/232286' });
    expect(list[0].miles).toBeLessThan(3);
    expect(parseCampgrounds(null)).toEqual([]);
  });
});

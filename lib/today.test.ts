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

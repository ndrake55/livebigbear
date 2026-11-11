import { describe, expect, it } from 'vitest';
import { compass, durationHours, isFresh, parseAlerts, parseObservation, parsePeriods, snowNext24h } from './weather';

describe('weather parsing', () => {
  it('reads forecast periods', () => {
    const p = parsePeriods({
      properties: {
        periods: [
          { name: 'Today', temperature: 41, temperatureUnit: 'F', windSpeed: '5 to 10 mph', windDirection: 'SW', shortForecast: 'Sunny', isDaytime: true },
        ],
      },
    });
    expect(p[0]).toMatchObject({ name: 'Today', temperature: 41, wind: '5 to 10 mph SW', short: 'Sunny' });
    expect(parsePeriods(null)).toEqual([]);
  });

  it('adds up snowfall over the next 24 hours', () => {
    const now = new Date('2026-01-15T12:00:00Z');
    const grid = {
      properties: {
        snowfallAmount: {
          uom: 'wmoUnit:mm',
          values: [
            { validTime: '2026-01-15T06:00:00+00:00/PT6H', value: 50 }, // before the window
            { validTime: '2026-01-15T12:00:00+00:00/PT6H', value: 25.4 }, // all in
            { validTime: '2026-01-16T06:00:00+00:00/PT12H', value: 50.8 }, // half in
            { validTime: '2026-01-17T00:00:00+00:00/PT6H', value: 100 }, // after
          ],
        },
      },
    };
    expect(snowNext24h(grid, now)).toBe(2);
    expect(snowNext24h({}, now)).toBeNull();
    expect(durationHours('P1DT6H')).toBe(30);
  });

  it('converts a station observation', () => {
    const o = parseObservation({
      properties: {
        timestamp: '2026-01-15T11:50:00+00:00',
        textDescription: 'Light Snow',
        temperature: { value: -2, unitCode: 'wmoUnit:degC' },
        windSpeed: { value: 20, unitCode: 'wmoUnit:km_h-1' },
        windDirection: { value: 265 },
      },
    });
    expect(o).toMatchObject({ tempF: 28, windMph: 12, windFrom: 'west', text: 'Light Snow' });
    expect(isFresh(o, new Date('2026-01-15T12:30:00Z'))).toBe(true);
    expect(isFresh(o, new Date('2026-01-15T16:00:00Z'))).toBe(false);
    expect(parseObservation({ properties: { temperature: { value: null } } })).toBeNull();
    expect(compass(0)).toBe('north');
    expect(compass(350)).toBe('north');
  });

  it('reads alerts', () => {
    expect(
      parseAlerts({ features: [{ properties: { event: 'Winter Storm Warning', headline: 'Until 4 AM' } }, {}] }),
    ).toEqual([{ event: 'Winter Storm Warning', headline: 'Until 4 AM' }]);
  });
});

import { describe, expect, it } from 'vitest';
import { parseLevel, verdict, worst } from './status';
import { formatSince, parseFeed, summarize } from './caltrans';
import { STORM_SAMPLE } from './sample';

describe('parseLevel', () => {
  it('reads Caltrans codes', () => {
    expect(parseLevel('R-0')).toBe('open');
    expect(parseLevel('R-2')).toBe('r2');
    expect(parseLevel('r3')).toBe('r3');
    expect(parseLevel('Not Reported')).toBe('unknown');
    expect(parseLevel('', 'Road is closed due to snow')).toBe('closed');
    expect(parseLevel('R-0', 'No chain controls are in effect at this time.')).toBe('open');
  });
});

describe('worst', () => {
  it('picks the most severe known level', () => {
    expect(worst(['open', 'r2', 'r1'])).toBe('r2');
    expect(worst(['unknown', 'open'])).toBe('open');
    expect(worst([])).toBe('unknown');
  });
});

describe('summarize and verdict', () => {
  const routes = summarize(STORM_SAMPLE);
  it('assigns points to the four routes', () => {
    expect(routes.map((r) => [r.def.id, r.level])).toEqual([
      ['330', 'r2'],
      ['18-front', 'r1'],
      ['38', 'open'],
      ['18-back', 'open'],
    ]);
    expect(routes[0].since).toBe('4:12 PM on Jan 15');
  });
  it('writes the storm verdict', () => {
    const v = verdict(routes.map((r) => ({ name: r.def.name, via: r.def.via, level: r.level })));
    expect(v.headline).toBe('Chains required on 2 of 4 routes');
    expect(v.detail).toBe('Easiest way up right now: Hwy 38 from Redlands.');
  });
  it('handles a clear day and a dead feed', () => {
    const clear = verdict([{ name: 'a', via: 'a', level: 'open' }]);
    expect(clear.headline).toBe('All routes open');
    expect(verdict(summarize([]).map((r) => ({ name: r.def.name, via: r.def.via, level: r.level }))).headline).toBe(
      'Road status unavailable',
    );
  });
});

describe('parseFeed', () => {
  it('reads the documented shape and survives junk', () => {
    const feed = {
      data: [
        {
          cc: {
            location: { route: 'SR-330', locationName: 'Test', longitude: '-117.15', latitude: '34.18' },
            inService: 'true',
            statusData: {
              statusTimestamp: { statusDate: '2026-11-11', statusTime: '09:03:00' },
              status: 'R-1',
              statusDescription: 'Chains required',
            },
          },
        },
        { nope: true },
      ],
    };
    const pts = parseFeed(feed);
    expect(pts).toHaveLength(1);
    expect(pts[0]).toMatchObject({ route: '330', lon: -117.15, status: 'R-1', inService: true });
    expect(parseFeed(null)).toEqual([]);
    expect(formatSince('2026-11-11', '00:05:00')).toBe('12:05 AM on Nov 11');
  });
});

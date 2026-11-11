import { describe, expect, it } from 'vitest';
import { parseLevel, verdict, worst, type Level } from './status';
import { APPROACHES, ROUTES } from './routes';
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
  const v = (rs: typeof routes) =>
    verdict(
      rs.map((r) => ({ id: r.def.id, name: r.def.name, level: r.level })),
      APPROACHES,
    );
  const withLevels = (levels: Record<string, Level>) =>
    verdict(
      ROUTES.map((r) => ({ id: r.id, name: r.name, level: levels[r.id] ?? 'open' })),
      APPROACHES,
    );

  it('assigns points to the five routes', () => {
    expect(routes.map((r) => [r.def.id, r.level])).toEqual([
      ['330', 'r2'],
      ['18-crestline', 'r1'],
      ['18-front', 'r1'],
      ['38', 'open'],
      ['18-back', 'open'],
    ]);
    expect(routes[0].since).toBe('4:12 PM on Jan 15');
  });
  it('writes the storm verdict', () => {
    expect(v(routes)).toEqual({
      headline: 'Chains required on 3 of 5 routes',
      detail: 'Easiest way up right now: Hwy 38 from Redlands.',
    });
  });
  it('does not recommend Hwy 330 when the front side beyond it needs chains', () => {
    const r = withLevels({ '18-front': 'r2', '38': 'r1', '18-back': 'r1' });
    expect(r.headline).toBe('Chains required on 3 of 5 routes');
    expect(r.detail).toBe('Every way up needs chains. Lightest restriction: Hwy 38 from Redlands (Chains R1).');
  });
  it('recommends Crestline when Hwy 330 is closed and the rest of the front side is clear', () => {
    const r = withLevels({ '330': 'closed', '38': 'r2', '18-back': 'r2' });
    expect(r.detail).toBe('Easiest way up right now: Hwy 18 through Crestline.');
  });
  it('handles a clear day and a dead feed', () => {
    expect(withLevels({}).headline).toBe('All routes open');
    expect(v(summarize([])).headline).toBe('Road status unavailable');
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

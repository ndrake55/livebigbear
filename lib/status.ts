export type Level = 'open' | 'r1' | 'r2' | 'r3' | 'closed' | 'unknown';

export const SEVERITY: Record<Level, number> = {
  unknown: -1,
  open: 0,
  r1: 1,
  r2: 2,
  r3: 3,
  closed: 4,
};

export const LABEL: Record<Level, string> = {
  open: 'Open',
  r1: 'Chains R1',
  r2: 'Chains R2',
  r3: 'Chains R3',
  closed: 'Closed',
  unknown: 'No data',
};

export const HEADLINE: Record<Level, string> = {
  open: 'No chain controls',
  r1: 'Chains or snow tires required',
  r2: 'Chains required',
  r3: 'Chains required on every vehicle',
  closed: 'Road closed',
  unknown: 'Status not reported',
};

export const EXPLAIN: Record<Level, string> = {
  open: 'No chain controls are in effect. In winter, carry chains anyway: conditions change fast.',
  r1: 'Chains are required on all vehicles except passenger cars and light trucks with snow tires on at least two drive wheels. Carry chains anyway.',
  r2: 'Chains are required on all vehicles except four-wheel and all-wheel drive with snow tires on all four wheels. Carry chains anyway.',
  r3: 'Chains are required on every vehicle, with no exceptions.',
  closed: 'Caltrans reports this road closed. Pick another route.',
  unknown: 'Caltrans is not reporting a status for this road right now. Check with Caltrans before you drive.',
};

/** Turn a Caltrans status code (R-0, R-1, ...) into a level. */
export function parseLevel(status?: string | null, description?: string | null): Level {
  const s = (status ?? '').trim().toUpperCase();
  const m = s.match(/^R-?([0-3])$/);
  if (m) return (['open', 'r1', 'r2', 'r3'] as const)[Number(m[1])];
  const d = (description ?? '').toLowerCase();
  if (s.includes('CLOS') || /\bclosed\b/.test(d)) return 'closed';
  return 'unknown';
}

/** Worst level in a list. Unknown only wins when nothing else is known. */
export function worst(levels: Level[]): Level {
  const known = levels.filter((l) => l !== 'unknown');
  if (known.length === 0) return 'unknown';
  return known.reduce((a, b) => (SEVERITY[b] > SEVERITY[a] ? b : a));
}

export const isChains = (l: Level) => l === 'r1' || l === 'r2' || l === 'r3';

export interface VerdictRoute {
  id: string;
  name: string;
  level: Level;
}

export interface VerdictApproach {
  via: string;
  legs: string[];
}

export interface Verdict {
  headline: string;
  detail: string;
}

/**
 * The one-line answer at the top of the home screen.
 * The headline counts roads. The "easiest way" looks at whole approaches, because a clear
 * Hwy 330 is no help if the Hwy 18 front side beyond it needs chains.
 */
export function verdict(routes: VerdictRoute[], approaches: VerdictApproach[]): Verdict {
  const known = routes.filter((r) => r.level !== 'unknown');
  const n = routes.length;
  if (known.length === 0) {
    return {
      headline: 'Road status unavailable',
      detail: 'Caltrans data is not responding. Check with Caltrans before you drive.',
    };
  }
  const closed = known.filter((r) => r.level === 'closed').length;
  const chains = known.filter((r) => isChains(r.level)).length;
  if (closed === 0 && chains === 0) {
    return {
      headline: known.length === n ? 'All routes open' : 'No chain controls reported',
      detail: 'No chain controls on the roads into the valley.',
    };
  }
  let headline: string;
  if (closed > 0 && chains > 0) headline = `${closed} closed, chains on ${chains} of ${n} routes`;
  else if (closed > 0) headline = `${closed} of ${n} routes closed`;
  else headline = `Chains required on ${chains} of ${n} routes`;

  const levelOf = new Map(routes.map((r) => [r.id, r.level]));
  // An approach is as bad as its worst leg. Skip any approach with a leg we have no data for.
  const scored = approaches
    .map((a) => ({ via: a.via, levels: a.legs.map((id) => levelOf.get(id) ?? 'unknown') }))
    .filter((a) => !a.levels.includes('unknown'))
    .map((a) => ({ via: a.via, level: worst(a.levels) }));
  if (scored.length === 0) return { headline, detail: 'Check each road below before you drive.' };

  const best = scored.reduce((a, b) => (SEVERITY[b.level] < SEVERITY[a.level] ? b : a));
  let detail: string;
  if (best.level === 'open') detail = `Easiest way up right now: ${best.via}.`;
  else if (best.level === 'closed') detail = 'Every way into the valley is reported closed.';
  else detail = `Every way up needs chains. Lightest restriction: ${best.via} (${LABEL[best.level]}).`;
  return { headline, detail };
}

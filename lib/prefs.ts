import { ROUTES } from './routes';

/** What one subscriber has asked for. Anything missing falls back to "everything". */
export interface Prefs {
  /** Road ids to hear about. Empty means every road. */
  roads: string[];
  /** Days of the week to be emailed, 0 Sunday to 6 Saturday. Empty means every day. */
  days: number[];
  /** The morning summary on days with chains or closures. */
  morning: boolean;
  /** An alert when a road closes during the day. */
  closures: boolean;
  /** No emails until this date (yyyy-mm-dd, Pacific), or "" for not paused. */
  pauseUntil: string;
}

export const DEFAULT_PREFS: Prefs = { roads: [], days: [], morning: true, closures: true, pauseUntil: '' };

const ROAD_IDS = ROUTES.map((r) => r.id);
export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Reads stored or submitted settings, keeping only values we understand. */
export function normalizePrefs(raw: unknown): Prefs {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const roads = Array.isArray(r.roads) ? ROAD_IDS.filter((id) => (r.roads as unknown[]).includes(id)) : [];
  const days = Array.isArray(r.days) ? [0, 1, 2, 3, 4, 5, 6].filter((d) => (r.days as unknown[]).map(Number).includes(d)) : [];
  const pause = typeof r.pauseUntil === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.pauseUntil) ? r.pauseUntil : '';
  return {
    // Every road, or every day, is stored as "no restriction".
    roads: roads.length === ROAD_IDS.length ? [] : roads,
    days: days.length === 7 ? [] : days,
    morning: r.morning === undefined ? true : r.morning === true || r.morning === 'true' || r.morning === 'on',
    closures: r.closures === undefined ? true : r.closures === true || r.closures === 'true' || r.closures === 'on',
    pauseUntil: pause,
  };
}

/** One-tap starting points. People can adjust anything afterwards. */
export const PRESETS: { key: string; name: string; blurb: string; prefs: Prefs }[] = [
  { key: 'closures', name: 'Just closures', blurb: 'Only when a road shuts.', prefs: { ...DEFAULT_PREFS, morning: false } },
  { key: 'weekend', name: 'Driving up for the weekend', blurb: 'Everything, Thursday through Sunday.', prefs: { ...DEFAULT_PREFS, days: [0, 4, 5, 6] } },
  { key: 'local', name: 'I live here', blurb: 'Everything, every day.', prefs: { ...DEFAULT_PREFS } },
];

/**
 * Should this subscriber get this email today? `affected` is the ids of the roads the email
 * is about: roads with chains or closures for the morning summary, newly closed roads for an alert.
 * `today` is the Pacific date (yyyy-mm-dd) and `weekday` the Pacific day of the week.
 */
export function wants(prefs: Prefs, kind: 'morning' | 'closure', affected: string[], today: string, weekday: number): boolean {
  if (prefs.pauseUntil && today < prefs.pauseUntil) return false;
  if (prefs.days.length > 0 && !prefs.days.includes(weekday)) return false;
  if (kind === 'morning' ? !prefs.morning : !prefs.closures) return false;
  if (prefs.roads.length === 0) return true;
  return affected.some((id) => prefs.roads.includes(id));
}

/** A one-line summary of the settings, for the page and for tests. */
export function describePrefs(p: Prefs): string {
  const roads = p.roads.length === 0 ? 'all roads' : ROUTES.filter((r) => p.roads.includes(r.id)).map((r) => r.name).join(', ');
  const days = p.days.length === 0 ? 'every day' : p.days.map((d) => DAY_NAMES[d].slice(0, 3)).join(', ');
  const what = [p.morning && 'morning summary', p.closures && 'closure alerts'].filter(Boolean).join(' and ') || 'nothing';
  return `${what} for ${roads}, ${days}${p.pauseUntil ? `, paused until ${p.pauseUntil}` : ''}`;
}

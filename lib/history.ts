import { getSql, hasDb } from './db';
import { isChains, type Level } from './status';

const KNOWN = ['open', 'r1', 'r2', 'r3', 'closed'];

export interface Span {
  level: Level;
  /** Share of the week this span covers, 0 to 100. */
  percent: number;
}

export interface History {
  spans: Span[];
  /** Days in the window with chains or a closure at any point. */
  affectedDays: number;
  /** How many days of history exist so far, up to 7. */
  daysCovered: number;
}

const DAY = 86_400_000;
export const HISTORY_DAYS = 7;

/** Turns status changes into spans across the last seven days. Rows must be oldest first. */
export function buildHistory(rows: { level: string; at: Date }[], now: Date): History | null {
  if (rows.length === 0) return null;
  const start = now.getTime() - HISTORY_DAYS * DAY;
  const from = Math.max(start, rows[0].at.getTime());
  const total = now.getTime() - start;
  const spans: Span[] = [];
  const days = new Set<string>();
  const dayOf = (t: number) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date(t));
  if (from > start) spans.push({ level: 'unknown', percent: ((from - start) / total) * 100 });
  for (let i = 0; i < rows.length; i++) {
    const a = Math.max(rows[i].at.getTime(), start);
    const b = i + 1 < rows.length ? rows[i + 1].at.getTime() : now.getTime();
    if (b <= start || b <= a) continue;
    const level: Level = KNOWN.includes(rows[i].level) ? (rows[i].level as Level) : 'unknown';
    spans.push({ level, percent: ((b - a) / total) * 100 });
    if (level === 'closed' || isChains(level)) for (let t = a; t < b; t += DAY / 4) days.add(dayOf(t));
  }
  return { spans, affectedDays: days.size, daysCovered: Math.min(HISTORY_DAYS, Math.ceil((now.getTime() - from) / DAY)) };
}

export async function getHistory(routeId: string, now = new Date()): Promise<History | null> {
  if (!hasDb()) return null;
  try {
    const sql = getSql();
    const since = new Date(now.getTime() - HISTORY_DAYS * DAY).toISOString();
    // The last change before the window tells us the status at its start.
    const rows = await sql`
      (SELECT level, changed_at FROM route_status_log WHERE route_id = ${routeId} AND changed_at < ${since}::timestamptz ORDER BY changed_at DESC LIMIT 1)
      UNION ALL
      (SELECT level, changed_at FROM route_status_log WHERE route_id = ${routeId} AND changed_at >= ${since}::timestamptz)
      ORDER BY changed_at ASC`;
    return buildHistory(rows.map((r) => ({ level: String(r.level), at: new Date(r.changed_at) })), now);
  } catch {
    return null;
  }
}

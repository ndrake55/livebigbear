import { ROUTES, type ChainPoint, type RouteDef } from './routes';
import { parseLevel, worst, SEVERITY, type Level } from './status';

// Caltrans CWWP2 chain control feed, District 8 (San Bernardino and Riverside counties).
// Docs: https://cwwp2.dot.ca.gov/documentation/cc/cc.htm
export const CC_URL =
  process.env.CALTRANS_CC_URL ?? 'https://cwwp2.dot.ca.gov/data/d8/cc/ccStatusD08.json';
export const QUICKMAP_URL = 'https://quickmap.dot.ca.gov/';

export interface RouteSummary {
  def: RouteDef;
  level: Level;
  points: ChainPoint[];
  description: string;
  since: string; // human readable, Pacific time, or ""
}

export interface Snapshot {
  ok: boolean;
  error?: string;
  fetchedAt: string; // ISO
  points: ChainPoint[];
  routes: RouteSummary[];
}

const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : null;
};
const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v).trim());
const reported = (v: string) => (/^not reported$/i.test(v) ? '' : v);

/** Read the Caltrans JSON into flat points. Tolerates missing fields. */
export function parseFeed(json: unknown): ChainPoint[] {
  const rows = (json as { data?: unknown[] } | null)?.data;
  if (!Array.isArray(rows)) return [];
  const out: ChainPoint[] = [];
  for (const row of rows) {
    const cc = (row as { cc?: Record<string, unknown> } | null)?.cc;
    if (!cc) continue;
    const loc = (cc.location ?? {}) as Record<string, unknown>;
    const sd = (cc.statusData ?? {}) as Record<string, unknown>;
    const ts = (sd.statusTimestamp ?? {}) as Record<string, unknown>;
    out.push({
      route: str(loc.route).replace(/\D/g, ''),
      locationName: str(loc.locationName),
      nearbyPlace: str(loc.nearbyPlace),
      direction: str(loc.direction),
      lat: num(loc.latitude),
      lon: num(loc.longitude),
      inService: str(cc.inService).toLowerCase() === 'true',
      status: str(sd.status),
      description: reported(str(sd.statusDescription)),
      statusDate: reported(str(ts.statusDate)),
      statusTime: reported(str(ts.statusTime)),
    });
  }
  return out;
}

/** "2026-11-11" + "16:12:00" -> "4:12 PM on Nov 11". Feed times are already Pacific. */
export function formatSince(date: string, time: string): string {
  const t = time.match(/^(\d{1,2}):(\d{2})/);
  const d = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!t || !d) return '';
  const h = Number(t[1]);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[Number(d[2]) - 1];
  if (!month) return '';
  return `${h % 12 === 0 ? 12 : h % 12}:${t[2]} ${h < 12 ? 'AM' : 'PM'} on ${month} ${Number(d[3])}`;
}

export function summarize(points: ChainPoint[]): RouteSummary[] {
  return ROUTES.map((def) => {
    const mine = points.filter(def.match);
    const levels = mine.map((p) => parseLevel(p.status, p.description));
    const level = worst(levels);
    // The point that sets the route's status: the worst one, most recent first.
    let lead: ChainPoint | undefined;
    mine.forEach((p, i) => {
      if (levels[i] !== level) return;
      if (!lead || `${p.statusDate} ${p.statusTime}` > `${lead.statusDate} ${lead.statusTime}`) lead = p;
    });
    return {
      def,
      level,
      points: mine.sort(
        (a, b) =>
          SEVERITY[parseLevel(b.status, b.description)] - SEVERITY[parseLevel(a.status, a.description)],
      ),
      description: lead?.description ?? '',
      since: lead ? formatSince(lead.statusDate, lead.statusTime) : '',
    };
  });
}

export async function getSnapshot(): Promise<Snapshot> {
  const fetchedAt = new Date().toISOString();
  try {
    const contact = process.env.NWS_CONTACT_EMAIL ?? 'livebigbear.com';
    const res = await fetch(CC_URL, {
      headers: { 'User-Agent': `LiveBigBear/0.1 (${contact})`, Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 120 },
    });
    if (!res.ok) throw new Error(`Caltrans answered ${res.status}`);
    const points = parseFeed(await res.json());
    if (points.length === 0) throw new Error('Caltrans feed had no chain control points');
    return { ok: true, fetchedAt, points, routes: summarize(points) };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Unknown error',
      fetchedAt,
      points: [],
      routes: summarize([]),
    };
  }
}

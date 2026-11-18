import { neon } from '@neondatabase/serverless';
import type { RouteSummary } from './caltrans';

/** A query written as sql`SELECT ... ${value}`. Values are always sent separately from the SQL text. */
export type Sql = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<Record<string, any>[]>;

const url = () => process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? '';
let override: Sql | null = null;

/** Tests swap in a local database here. */
export const setSqlForTests = (sql: Sql | null) => {
  override = sql;
};
export const hasDb = () => override !== null || url() !== '';
export const getSql = (): Sql => override ?? (neon(url()) as unknown as Sql);
/** The database address, used only to derive a signing secret when none is set. */
export const dbSecretSeed = () => url();

export interface StatusChange {
  id: string;
  /** The status before, or null the first time a road is recorded. */
  from: string | null;
  to: string;
}

/** Like recordStatuses, but also says what each road changed from. */
export async function recordStatusChanges(routes: RouteSummary[]): Promise<StatusChange[]> {
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS route_status_log (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      route_id TEXT NOT NULL,
      level TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  await sql`
    CREATE INDEX IF NOT EXISTS route_status_log_route_time
    ON route_status_log (route_id, changed_at DESC)`;

  const changed: StatusChange[] = [];
  for (const r of routes) {
    const last = await sql`
      SELECT level FROM route_status_log
      WHERE route_id = ${r.def.id}
      ORDER BY changed_at DESC, id DESC LIMIT 1`;
    if (last.length > 0 && last[0].level === r.level) continue;
    await sql`
      INSERT INTO route_status_log (route_id, level, description)
      VALUES (${r.def.id}, ${r.level}, ${r.description})`;
    changed.push({ id: r.def.id, from: last.length > 0 ? String(last[0].level) : null, to: r.level });
  }
  return changed;
}

export const recordStatuses = async (routes: RouteSummary[]): Promise<string[]> => (await recordStatusChanges(routes)).map((c) => c.id);

/**
 * A one-line note about the most recent failure of something, shown on the status page so a
 * problem can be diagnosed without reading server logs. Email addresses are removed.
 */
export async function noteProblem(key: string, message: string): Promise<void> {
  try {
    const sql = getSql();
    await sql`CREATE TABLE IF NOT EXISTS app_notes (key TEXT PRIMARY KEY, value TEXT NOT NULL, at TIMESTAMPTZ NOT NULL DEFAULT now())`;
    const clean = message.replace(/[^\s@]+@[^\s@]+/g, '(address)').slice(0, 240);
    await sql`
      INSERT INTO app_notes (key, value) VALUES (${key}, ${clean})
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, at = now()`;
  } catch {
    // Diagnostics must never break the thing being diagnosed.
  }
}

export async function readProblem(key: string): Promise<{ value: string; at: Date } | null> {
  try {
    const rows = await getSql()`SELECT value, at FROM app_notes WHERE key = ${key}`;
    return rows[0] ? { value: String(rows[0].value), at: new Date(rows[0].at) } : null;
  } catch {
    return null;
  }
}

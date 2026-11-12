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

/**
 * Record each route's status, adding a history row only when the status changes.
 * Returns the ids of routes whose status changed.
 */
export async function recordStatuses(routes: RouteSummary[]): Promise<string[]> {
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

  const changed: string[] = [];
  for (const r of routes) {
    const last = await sql`
      SELECT level FROM route_status_log
      WHERE route_id = ${r.def.id}
      ORDER BY changed_at DESC, id DESC LIMIT 1`;
    if (last.length > 0 && last[0].level === r.level) continue;
    await sql`
      INSERT INTO route_status_log (route_id, level, description)
      VALUES (${r.def.id}, ${r.level}, ${r.description})`;
    changed.push(r.def.id);
  }
  return changed;
}

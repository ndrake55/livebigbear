import type { Metadata } from 'next';
import Link from 'next/link';
import { DAY_NAMES, describePrefs, normalizePrefs, PRESETS, type Prefs, SNOW_STEPS } from '@/lib/prefs';
import { ROUTES } from '@/lib/routes';
import { ensureEmailTables, subscriberById } from '@/lib/subscribers';
import { signLink, verifyLink } from '@/lib/tokens';
import { RememberDevice } from '../remember';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Manage my alerts', robots: { index: false } };

/** Hides most of an address: "ne•••@gmail.com". */
const mask = (email: string) => email.replace(/^(.{1,2})[^@]*(@.*)$/, '$1•••$2');

export default async function ManagePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; state?: string; preset?: string }>;
}) {
  const { token, state, preset } = await searchParams;
  let person: { id: string; email: string; prefs: unknown } | null = null;
  try {
    const id = token ? verifyLink('manage', token) : null;
    if (id) {
      await ensureEmailTables();
      person = await subscriberById(id);
    }
  } catch {
    person = null;
  }

  if (!person || !token) {
    return (
      <div className="shell">
        <header className="top">
          <Link href="/" className="brand">
            Live Big Bear
          </Link>
        </header>
        <div className="title">
          <h1>This link has expired</h1>
          <p>Enter your email address on the Alerts page and we will send you a fresh link to your settings.</p>
        </div>
        <Link className="button" href="/alerts">
          Go to Alerts
        </Link>
      </div>
    );
  }

  const saved = normalizePrefs(person.prefs);
  // A preset fills in the form; nothing is stored until Save is pressed.
  const chosen = PRESETS.find((x) => x.key === preset);
  const p: Prefs = chosen ? { ...chosen.prefs, roads: saved.roads, pauseUntil: saved.pauseUntil } : saved;
  const allRoads = p.roads.length === 0;
  const allDays = p.days.length === 0;
  const unsub = signLink('unsub', person.id, 3600);
  const here = (extra: string) => `/alerts/manage?token=${encodeURIComponent(token)}${extra}`;

  return (
    <div className="shell">
      <header className="top">
        <Link href="/" className="brand">
          Live Big Bear
        </Link>
      </header>
      <RememberDevice token={token} />
      <div className="title">
        <h1>Manage my alerts</h1>
        <p>Settings for {mask(person.email)}</p>
      </div>

      {state === 'saved' && <div className="notice notice-good">Saved. You will get {describePrefs(saved)}.</div>}
      {state === 'error' && <div className="notice">That did not save. Please try again.</div>}
      {chosen && <div className="notice">“{chosen.name}” is filled in below. Press Save to keep it.</div>}

      <section>
        <h2>Quick start</h2>
        <div className="list">
          {PRESETS.map((x) => (
            <Link key={x.key} href={here(`&preset=${x.key}`)} className="row">
              <span className="row-text">
                <span className="row-name">{x.name}</span>
                <span className="row-sub">{x.blurb}</span>
              </span>
              <span className="temp" aria-hidden="true">
                ›
              </span>
            </Link>
          ))}
        </div>
      </section>

      <form method="post" action="/api/subscribe/prefs" className="prefs">
        <input type="hidden" name="token" value={token} />

        <fieldset className="card">
          <legend>What to send</legend>
          <label className="check">
            <input type="checkbox" name="morning" defaultChecked={p.morning} />
            <span>
              <strong>Morning summary</strong>
              <small>On days when a road has chains or is closed.</small>
            </span>
          </label>
          <label className="check">
            <input type="checkbox" name="closures" defaultChecked={p.closures} />
            <span>
              <strong>Closure alerts</strong>
              <small>When a road closes during the day.</small>
            </span>
          </label>
        </fieldset>

        <fieldset className="card">
          <legend>Weather</legend>
          <label className="signup-label" htmlFor="snow">
            Snow forecast
          </label>
          <select id="snow" name="snow" className="signup-input" defaultValue={String(p.snow)}>
            <option value="0">Do not email me about snow forecasts</option>
            {SNOW_STEPS.map((n) => (
              <option key={n} value={n}>
                When {n} inches or more are forecast in 24 hours
              </option>
            ))}
          </select>
          <label className="check" style={{ marginTop: 8 }}>
            <input type="checkbox" name="warnings" defaultChecked={p.warnings} />
            <span>
              <strong>Weather warnings</strong>
              <small>Winter storm, high wind and flood warnings from the National Weather Service.</small>
            </span>
          </label>
          <p className="note">Weather emails arrive between 9 AM and 9 PM, once per storm.</p>
        </fieldset>

        <fieldset className="card">
          <legend>Which roads</legend>
          {ROUTES.map((r) => (
            <label key={r.id} className="check">
              <input type="checkbox" name="roads" value={r.id} defaultChecked={allRoads || p.roads.includes(r.id)} />
              <span>
                <strong>{r.name}</strong>
                <small>{r.sub}</small>
              </span>
            </label>
          ))}
          <p className="note">Untick the roads you never drive. With none ticked, you hear about all of them.</p>
        </fieldset>

        <fieldset className="card">
          <legend>Which days</legend>
          <div className="days">
            {DAY_NAMES.map((name, d) => (
              <label key={name} className="day">
                <input type="checkbox" name="days" value={d} defaultChecked={allDays || p.days.includes(d)} />
                <span>{name.slice(0, 3)}</span>
              </label>
            ))}
          </div>
          <p className="note">With none ticked, you are emailed any day.</p>
        </fieldset>

        <fieldset className="card">
          <legend>Pause</legend>
          <label className="signup-label" htmlFor="pauseUntil">
            No emails until
          </label>
          <input id="pauseUntil" className="signup-input" type="date" name="pauseUntil" defaultValue={p.pauseUntil} />
          <p className="note">Leave empty to keep getting emails. They start again on the date you pick.</p>
        </fieldset>

        <button className="button button-full" type="submit">
          Save
        </button>
      </form>

      <p className="note">
        Want to stop altogether? <Link href={`/alerts/unsubscribe?token=${encodeURIComponent(unsub)}`}>Unsubscribe</Link>.
      </p>
    </div>
  );
}

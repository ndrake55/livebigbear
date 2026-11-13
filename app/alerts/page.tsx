import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { alertsOn } from '@/lib/alerts-on';
import { describePrefs, normalizePrefs } from '@/lib/prefs';
import { REMEMBER_COOKIE, rememberedId } from '@/lib/remember';
import { ensureEmailTables, subscriberById } from '@/lib/subscribers';
import { signLink } from '@/lib/tokens';
import { ForgetDevice } from './remember';
import { SignupForm } from '../signup-form';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  alternates: { canonical: '/alerts' },
  title: 'Free Big Bear storm-day emails',
  description:
    'Free email on storm days with chain control, road closures and weather for the Big Bear Valley.',
};

const mask = (email: string) => email.replace(/^(.{1,2})[^@]*(@.*)$/, '$1•••$2');

export default async function AlertsPage() {
  // Someone who confirmed or opened their settings on this device is recognized for 30 days.
  let known: { id: string; email: string; prefs: unknown } | null = null;
  if (alertsOn()) {
    try {
      const id = rememberedId((await cookies()).get(REMEMBER_COOKIE)?.value);
      if (id) {
        await ensureEmailTables();
        known = await subscriberById(id);
      }
    } catch {
      known = null;
    }
  }
  const manageHref = known ? `/alerts/manage?token=${encodeURIComponent(signLink('manage', known.id, 3600))}` : '';

  return (
    <div className="shell">
      <header className="top">
        <Link href="/" className="brand">
          Live Big Bear
        </Link>
      </header>

      <div className="title">
        <h1>Storm-day emails</h1>
        <p>Free. A morning summary when chains or closures are in effect, and word of major closures.</p>
      </div>

      {!alertsOn() && <div className="notice">Email signup is coming soon.</div>}

      {alertsOn() && known && (
        <section className="card">
          <h2>You are signed up</h2>
          <p className="note" style={{ marginTop: 0 }}>
            {mask(known.email)} gets {describePrefs(normalizePrefs(known.prefs))}.
          </p>
          <Link className="button" href={manageHref} style={{ marginTop: 12 }}>
            Manage my alerts
          </Link>
          <p className="note">
            Choose your roads and days, pause your emails, or unsubscribe. <ForgetDevice />
          </p>
        </section>
      )}

      {alertsOn() && !known && (
        <>
          <section className="card">
            <h2>Get storm-day emails</h2>
            <SignupForm />
            <p className="note">
              We email a link to confirm it is really you. No spam, and every email has a one-tap unsubscribe.
            </p>
          </section>
          <section className="card">
            <h2>Already signed up?</h2>
            <p className="note" style={{ marginTop: 0, marginBottom: 12 }}>
              Enter your address and we will email a link to your settings. No password needed.
            </p>
            <SignupForm mode="manage" />
          </section>
        </>
      )}

      <section>
        <h2>What you get</h2>
        <div className="list">
          <div className="row row-static">
            <span className="row-text">
              <span className="row-name">Storm mornings</span>
              <span className="row-sub">Which roads need chains, which are closed, and the day’s weather.</span>
            </span>
          </div>
          <div className="row row-static">
            <span className="row-text">
              <span className="row-name">Major closures</span>
              <span className="row-sub">When a road into the valley closes.</span>
            </span>
          </div>
          <div className="row row-static">
            <span className="row-text">
              <span className="row-name">Your roads, your days</span>
              <span className="row-sub">Pick the roads you drive and the days you care about, or pause until your next trip.</span>
            </span>
          </div>
          <div className="row row-static">
            <span className="row-text">
              <span className="row-name">Quiet otherwise</span>
              <span className="row-sub">Nothing on clear days.</span>
            </span>
          </div>
        </div>
      </section>
      <p className="note">
        <Link href="/alerts/sample">See a sample storm-day email</Link>.
      </p>
    </div>
  );
}

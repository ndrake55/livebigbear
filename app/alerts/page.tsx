import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { alertsOn } from '@/lib/alerts-on';
import { describePrefs, normalizePrefs } from '@/lib/prefs';
import { REMEMBER_COOKIE, rememberedId } from '@/lib/remember';
import { ensureEmailTables, subscriberById } from '@/lib/subscribers';
import { signLink } from '@/lib/tokens';
import { maskPhone } from '@/lib/sms';
import { isTextOnly, textState, textsOn, type TextState } from '@/lib/text-plan';
import { ForgetDevice } from './remember';
import { TEXT_PRICE, TextBuyButton, TextConsent } from './text-section';
import { SignupForm } from '../signup-form';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  alternates: { canonical: '/alerts' },
  title: 'Big Bear road alerts by email and text',
  description:
    'Free email on storm days with chain control, road closures and weather for the Big Bear Valley, plus optional text alerts the moment a road changes.',
};

const mask = (email: string) => email.replace(/^(.{1,2})[^@]*(@.*)$/, '$1•••$2');

const TEXT_NOTES: Record<string, string> = {
  busy: 'Too many tries from this connection. Please wait an hour and try again.',
  unpaid: 'That checkout was not finished, so nothing was charged. You can start again below.',
  error: 'Something went wrong on our side. Nothing was changed. Please try again shortly.',
};

export default async function AlertsPage({ searchParams }: { searchParams: Promise<{ text?: string }> }) {
  const { text } = await searchParams;
  let plan: TextState | null = null;
  // Someone who confirmed or opened their settings on this device is recognized for 30 days.
  let known: { id: string; email: string; prefs: unknown } | null = null;
  if (alertsOn()) {
    try {
      const id = rememberedId((await cookies()).get(REMEMBER_COOKIE)?.value);
      if (id) {
        await ensureEmailTables();
        known = await subscriberById(id);
        if (known && textsOn()) plan = await textState(known.id);
      }
    } catch {
      known = null;
    }
  }
  const manageToken = known ? signLink('manage', known.id, 3600) : '';
  const manageHref = known ? `/alerts/manage?token=${encodeURIComponent(manageToken)}` : '';
  // A text plan bought without signing in has no email address, so the email forms still apply.
  const onEmail = known !== null && !isTextOnly(known.email);
  const paid = plan !== null && (plan.status === 'active' || plan.status === 'past_due');

  return (
    <div className="shell">
      <header className="top">
        <Link href="/" className="brand">
          Live Big Bear
        </Link>
      </header>

      <div className="title">
        <h1>Storm-day emails</h1>
        <p>Free. A morning summary when chains or closures are in effect, word of major closures, and a heads-up when snow is coming.</p>
      </div>

      {!alertsOn() && <div className="notice">Email signup is coming soon.</div>}

      {alertsOn() && known && onEmail && (
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

      {alertsOn() && !onEmail && (
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

      {text && TEXT_NOTES[text] && <div className="notice">{TEXT_NOTES[text]}</div>}

      <section className="card" id="text">
        <h2>Text alerts, {TEXT_PRICE}</h2>
        {paid && plan ? (
          <>
            <p className="note" style={{ marginTop: 0 }}>
              {plan.verified
                ? `You are on the text plan. Texts go to ${maskPhone(plan.phone)}.`
                : 'You are paid up. One step left: enter the code we texted you.'}
            </p>
            <Link className="button" href={`${manageHref}#text`} style={{ marginTop: 12 }}>
              {plan.verified ? 'Manage my texts' : 'Enter my code'}
            </Link>
          </>
        ) : (
          <>
            <p className="note" style={{ marginTop: 0, marginBottom: 12 }}>
              Email is free and always will be. For {TEXT_PRICE}, also get a text the moment a road closes or reopens, or chain controls go
              on or come off, so you know before you leave the driveway.
            </p>
            {textsOn() ? (
              <>
                <TextBuyButton token={manageToken} />
                <TextConsent />
                <p className="note">
                  Already on the text plan? <Link href="/alerts/text">Sign in with your phone</Link>.
                </p>
              </>
            ) : (
              <div className="notice">Text alerts are coming soon.</div>
            )}
          </>
        )}
      </section>

      <section>
        <h2>What you get by email</h2>
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
              <span className="row-name">Snow on the way</span>
              <span className="row-sub">A heads-up when 6 inches or more are forecast, or a winter storm warning is issued.</span>
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

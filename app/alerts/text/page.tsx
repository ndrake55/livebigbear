import type { Metadata } from 'next';
import Link from 'next/link';
import { maskPhone, normalizePhone } from '@/lib/sms';
import { textsOn } from '@/lib/text-plan';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Sign in with your phone', robots: { index: false } };

const MESSAGES: Record<string, string> = {
  badnumber: 'That does not look like a US mobile number. Try again with the area code.',
  slow: 'Too many tries. Please wait an hour and try again.',
  wrong: 'That code did not match, or it has expired. Check it and try again, or start over for a new code.',
  error: 'Something went wrong on our side. Please try again shortly.',
};

export default async function TextLoginPage({ searchParams }: { searchParams: Promise<{ phone?: string; state?: string }> }) {
  const { phone: rawPhone, state } = await searchParams;
  const phone = normalizePhone(rawPhone);
  const codeStep = Boolean(phone && (state === 'sent' || state === 'wrong'));

  return (
    <div className="shell">
      <header className="top">
        <Link href="/" className="brand">
          Live Big Bear
        </Link>
      </header>
      <div className="title">
        <h1>Sign in with your phone</h1>
        <p>For people on the text alert plan. No password needed.</p>
      </div>

      {!textsOn() && <div className="notice">Text alerts are not switched on yet.</div>}
      {state && MESSAGES[state] && <div className="notice">{MESSAGES[state]}</div>}

      {textsOn() && !codeStep && (
        <form method="post" action="/api/text/login" className="card prefs">
          <div>
            <label className="signup-label" htmlFor="phone">
              Mobile number
            </label>
            <input id="phone" className="signup-input" style={{ width: '100%' }} type="tel" name="phone" autoComplete="tel" inputMode="tel" placeholder="(909) 555-1234" required />
          </div>
          <button className="button button-full" type="submit">
            Text me a code
          </button>
          <p className="note">If that number has a text plan, a 6-digit code is on its way.</p>
        </form>
      )}

      {textsOn() && codeStep && phone && (
        <form method="post" action="/api/text/login" className="card prefs">
          <input type="hidden" name="phone" value={phone} />
          <div>
            <label className="signup-label" htmlFor="code">
              Code sent to {maskPhone(phone)}
            </label>
            <input id="code" className="signup-input" style={{ width: '100%' }} type="text" name="code" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} placeholder="123456" required />
          </div>
          <button className="button button-full" type="submit">
            Sign in
          </button>
          <p className="note">
            If that number has a text plan, the code arrives within a minute and works for 10 minutes.{' '}
            <Link href="/alerts/text">Start over</Link>.
          </p>
        </form>
      )}

      <p className="note">
        Signed up by email only? Use the <Link href="/alerts">Alerts page</Link> to get a link to your settings.
      </p>
    </div>
  );
}

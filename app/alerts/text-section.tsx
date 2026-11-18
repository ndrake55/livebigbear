import Link from 'next/link';
import { hourLabel, type Prefs, TEXT_CAPS } from '@/lib/prefs';
import { maskPhone } from '@/lib/sms';
import type { TextState } from '@/lib/text-plan';

/** The price and promise, in one place so every page says the same thing. */
export const TEXT_PRICE = '$12 a year';

/** The consent wording phone carriers require next to a text signup button. */
export function TextConsent() {
  return (
    <p className="note">
      <strong>Renews every year at $12 until you cancel, which you can do any time from your settings.</strong> Pay by card on Stripe, where
      you also give your mobile number. By continuing you agree to get automated road alert texts from Live Big
      Bear at that number. How many depends on the weather. Message and data rates may apply. Reply STOP to end or HELP for help. US numbers
      only. See our <Link href="/terms">Terms</Link> and <Link href="/privacy">Privacy policy</Link>.
    </p>
  );
}

export function TextBuyButton({ token = '', label = `Get text alerts, ${TEXT_PRICE}` }: { token?: string; label?: string }) {
  return (
    <form method="post" action="/api/text/checkout">
      <input type="hidden" name="token" value={token} />
      <button className="button button-full" type="submit">
        {label}
      </button>
    </form>
  );
}

const MESSAGES: Record<string, { good?: boolean; text: string }> = {
  paid: { good: true, text: 'Thank you, your payment went through. We texted you a 6-digit code. Enter it below to switch your texts on.' },
  verified: { good: true, text: 'Your number is confirmed and text alerts are on.' },
  wrong: { text: 'That code did not match, or it has expired. Try again, or ask for a new code.' },
  resent: { good: true, text: 'A new code is on its way.' },
  slow: { text: 'Too many codes have been sent to that number. Please wait an hour and try again.' },
  badnumber: { text: 'That does not look like a US mobile number. Try again with the area code.' },
  error: { text: 'Something went wrong on our side. Please try again shortly.' },
};

/**
 * The part of the settings page about the text plan: the offer for people without it, the
 * code box for people who just paid, and the number and billing for people who have it.
 * The tick boxes for what to text live in the main settings form (TextSettings below).
 */
export function TextPlan({ token, state, message }: { token: string; state: TextState; message?: string }) {
  const note = message ? MESSAGES[message] : undefined;
  const paid = state.status === 'active' || state.status === 'past_due';
  return (
    <section id="text">
      <h2>Text alerts</h2>
      {note && <div className={note.good ? 'notice notice-good' : 'notice'}>{note.text}</div>}

      {!paid && (
        <div className="card">
          <p className="note" style={{ marginTop: 0 }}>
            {state.status === 'canceled' ? 'Your text plan has ended. ' : ''}
            Get a text the moment a road closes or reopens, or chain controls go on or come off. {TEXT_PRICE}, cancel any time.
          </p>
          <div style={{ marginTop: 12 }}>
            <TextBuyButton token={token} />
          </div>
          <TextConsent />
        </div>
      )}

      {paid && !state.verified && (
        <div className="card prefs">
          {state.phone ? (
            <form method="post" action="/api/text/verify" className="prefs">
              <input type="hidden" name="token" value={token} />
              <div>
                <label className="signup-label" htmlFor="code">
                  Enter the code we texted to {maskPhone(state.phone)}
                </label>
                <input id="code" className="signup-input" style={{ width: '100%' }} type="text" name="code" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} placeholder="123456" required />
              </div>
              <button className="button button-full" type="submit">
                Turn on my texts
              </button>
            </form>
          ) : (
            <p className="note" style={{ marginTop: 0 }}>
              You are paid up, but we did not get a US mobile number from the checkout. Add one below.
            </p>
          )}
          {state.phone && (
            <form method="post" action="/api/text/verify">
              <input type="hidden" name="token" value={token} />
              <input type="hidden" name="again" value="1" />
              <button className="linklike" type="submit">
                Send me a new code
              </button>
            </form>
          )}
          <ChangeNumber token={token} label={state.phone ? 'Wrong number? Enter the right one' : 'Mobile number'} />
        </div>
      )}

      {paid && state.verified && (
        <div className="card prefs">
          <p className="note" style={{ marginTop: 0 }}>
            Texts go to <strong>{maskPhone(state.phone)}</strong>. Choose what to be texted about under “What to text” below.
          </p>
          {state.stopped && <div className="notice">You replied STOP, so texts are off. Text START to the same number to switch them back on.</div>}
          {state.status === 'past_due' && <div className="notice">Your last payment did not go through. Update your card under Billing to keep your texts.</div>}
          <details>
            <summary>Change my number</summary>
            <ChangeNumber token={token} label="New mobile number" />
          </details>
          <form method="post" action="/api/text/portal">
            <input type="hidden" name="token" value={token} />
            <button className="linklike" type="submit">
              Billing: update my card or cancel
            </button>
          </form>
        </div>
      )}
    </section>
  );
}

function ChangeNumber({ token, label }: { token: string; label: string }) {
  return (
    <form method="post" action="/api/text/phone" className="prefs" style={{ marginTop: 8 }}>
      <input type="hidden" name="token" value={token} />
      <div>
        <label className="signup-label" htmlFor="newphone">
          {label}
        </label>
        <input id="newphone" className="signup-input" style={{ width: '100%' }} type="tel" name="phone" autoComplete="tel" inputMode="tel" placeholder="(909) 555-1234" required />
      </div>
      <button className="button button-quiet" type="submit">
        Text a code to this number
      </button>
    </form>
  );
}

const HOURS = Array.from({ length: 24 }, (_, h) => h);

/** The text choices, placed inside the main settings form so one Save button covers everything. */
export function TextSettings({ p }: { p: Prefs }) {
  return (
    <fieldset className="card">
      <legend>What to text</legend>
      {(
        [
          ['textClosed', 'A road closes', 'The moment Caltrans reports it.'],
          ['textReopened', 'A road reopens', 'So you know when you can go.'],
          ['textChainsOn', 'Chain controls go on', 'Or change level, such as R1 to R2.'],
          ['textChainsOff', 'Chain controls come off', 'The road is clear again.'],
          ['textMorning', 'Morning summary by text', 'One short text on days with chains or closures, at the hour chosen above.'],
        ] as const
      ).map(([name, title, sub]) => (
        <label key={name} className="check">
          <input type="checkbox" name={name} defaultChecked={p[name]} />
          <span>
            <strong>{title}</strong>
            <small>{sub}</small>
          </span>
        </label>
      ))}
      <label className="signup-label" htmlFor="quietFrom">
        Quiet hours: no texts from
      </label>
      <select id="quietFrom" name="quietFrom" className="signup-input" defaultValue={String(p.quietFrom)}>
        {HOURS.map((h) => (
          <option key={h} value={h}>
            {hourLabel(h)}
          </option>
        ))}
      </select>
      <label className="signup-label" htmlFor="quietTo" style={{ marginTop: 8 }}>
        until
      </label>
      <select id="quietTo" name="quietTo" className="signup-input" defaultValue={String(p.quietTo)}>
        {HOURS.map((h) => (
          <option key={h} value={h}>
            {hourLabel(h)}
          </option>
        ))}
      </select>
      <label className="signup-label" htmlFor="textCap" style={{ marginTop: 8 }}>
        Most texts in one day
      </label>
      <select id="textCap" name="textCap" className="signup-input" defaultValue={String(p.textCap)}>
        {TEXT_CAPS.map((n) => (
          <option key={n} value={n}>
            {n} texts
          </option>
        ))}
      </select>
      <p className="note">
        Pacific time. Pick the same hour twice for no quiet hours. Texts follow the roads, days and pause you set below. The morning summary
        text always comes at the hour you chose.
      </p>
      {/* Kept last: the element right after the legend is the one the layout starts a new line for. */}
      <input type="hidden" name="hasText" value="1" />
    </fieldset>
  );
}

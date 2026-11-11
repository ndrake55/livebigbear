import { canReceiveMail, isDisposable, normalizeEmail } from './email-check';
import { confirmationMail, isMailConfigured, sendMail, siteUrl, type Mail } from './mailer';
import { allow, ensureEmailTables, forgetSendAttempt, requestSignup } from './subscribers';
import { fingerprint, formAge, signLink } from './tokens';

export interface SignupInput {
  email: unknown;
  /** Hidden field real people never fill in. */
  trap: unknown;
  /** Token issued when the form loaded. */
  formToken: unknown;
  ip: string;
}

export interface SignupOutcome {
  status: number;
  ok: boolean;
  message: string;
}

const SENT = 'Check your inbox for a link to confirm. It can take a minute, and may land in spam.';
const say = (status: number, ok: boolean, message: string): SignupOutcome => ({ status, ok, message });

export const MIN_FORM_MS = 2000;
export const MAX_FORM_MS = 2 * 60 * 60 * 1000;
const PER_VISITOR_PER_HOUR = 5;
const SITE_WIDE_PER_HOUR = 200;
const CONFIRM_TTL_SECONDS = 48 * 3600;

/**
 * Handle one signup attempt. The answer never reveals whether an address is already on the list:
 * anything that looks like a real request gets the same "check your inbox" reply.
 */
export async function handleSignup(
  input: SignupInput,
  deps: { send?: (m: Mail) => Promise<void>; mxOk?: (email: string) => Promise<boolean>; now?: number } = {},
): Promise<SignupOutcome> {
  const send = deps.send ?? sendMail;
  const mxOk = deps.mxOk ?? canReceiveMail;
  const now = deps.now ?? Date.now();

  if (!deps.send && !isMailConfigured()) return say(503, false, 'Email alerts are not switched on yet.');

  // Bots: a filled trap field, or a missing, forged or instantly-submitted form token.
  // They are told it worked so they learn nothing, and nothing is stored or sent.
  if (String(input.trap ?? '') !== '') return say(200, true, SENT);
  const age = formAge(String(input.formToken ?? ''), now);
  if (age === null) return say(400, false, 'Please reload the page and try again.');
  if (age > MAX_FORM_MS) return say(400, false, 'That took a while. Please try again.');
  if (age < MIN_FORM_MS) return say(200, true, SENT);

  const email = normalizeEmail(input.email);
  if (!email) return say(400, false, 'That does not look like an email address.');
  if (isDisposable(email)) return say(400, false, 'Please use a regular email address, not a temporary one.');

  await ensureEmailTables();
  if (!(await allow(`ip:${fingerprint(input.ip)}`, PER_VISITOR_PER_HOUR, 60))) {
    return say(429, false, 'Too many tries from this connection. Please try again in an hour.');
  }
  if (!(await mxOk(email))) return say(400, false, 'That email domain cannot receive mail. Check for a typo.');

  const { sendTo } = await requestSignup(email);
  if (sendTo === null) return say(200, true, SENT); // already confirmed, blocked, or emailed minutes ago

  // A ceiling on confirmation emails across the whole site, in case of an attack from many connections.
  if (!(await allow('all-confirmations', SITE_WIDE_PER_HOUR, 60))) {
    await forgetSendAttempt(sendTo);
    return say(503, false, 'Signups are busy right now. Please try again in a little while.');
  }

  const link = `${siteUrl()}/alerts/confirm?token=${encodeURIComponent(signLink('confirm', sendTo, CONFIRM_TTL_SECONDS, now))}`;
  try {
    await send(confirmationMail(email, link));
  } catch {
    await forgetSendAttempt(sendTo);
    return say(502, false, 'We could not send the confirmation email. Please try again shortly.');
  }
  return say(200, true, SENT);
}

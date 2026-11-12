import { resolveMx } from 'node:dns/promises';

/** Services that hand out throwaway inboxes. Not exhaustive: it stops the common ones. */
const DISPOSABLE = new Set([
  '10minutemail.com', '10minutemail.net', '20minutemail.com', 'burnermail.io', 'discard.email',
  'dispostable.com', 'emailondeck.com', 'fakeinbox.com', 'getairmail.com', 'getnada.com',
  'guerrillamail.com', 'guerrillamail.net', 'guerrillamail.org', 'grr.la', 'sharklasers.com',
  'mailcatch.com', 'maildrop.cc', 'mailinator.com', 'mailnesia.com', 'mailsac.com', 'mintemail.com',
  'moakt.com', 'mohmal.com', 'mytemp.email', 'spamgourmet.com', 'temp-mail.org', 'tempail.com',
  'tempmail.com', 'tempmailo.com', 'tempr.email', 'throwawaymail.com', 'trashmail.com', 'trashmail.de',
  'yopmail.com', 'yopmail.fr', 'yopmail.net',
]);

export type EmailProblem = 'format' | 'disposable' | 'no-mail';

/** Lower-case and trim. Returns null if it is not shaped like an email address. */
export function normalizeEmail(input: unknown): string | null {
  const email = String(input ?? '').trim().toLowerCase();
  if (email.length < 6 || email.length > 254) return null;
  // One @, no spaces or control characters, a dot in the domain, sensible lengths.
  if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(email)) {
    return null;
  }
  if (email.includes('..')) return null;
  return email;
}

export const domainOf = (email: string) => email.slice(email.lastIndexOf('@') + 1);
export const isDisposable = (email: string) => DISPOSABLE.has(domainOf(email));

/**
 * Can this domain receive mail? A clear "no such domain / no mail servers" answer rejects.
 * A slow or failing lookup gives the address the benefit of the doubt.
 */
export async function canReceiveMail(email: string, lookup: typeof resolveMx = resolveMx): Promise<boolean> {
  try {
    const records = await Promise.race([
      lookup(domainOf(email)),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500)),
    ]);
    if (records === null) return true;
    // A lone "." record is the standard way for a domain to say it accepts no mail.
    return records.some((r) => r.exchange && r.exchange !== '.');
  } catch (e) {
    const code = (e as { code?: string }).code;
    return !(code === 'ENOTFOUND' || code === 'ENODATA');
  }
}

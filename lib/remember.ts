import { signLink, verifyLink } from './tokens';

/**
 * Remembers a subscriber on their own device, so the Alerts page can offer "Manage my alerts"
 * without another email. The cookie holds a signed settings token and nothing else.
 */
export const REMEMBER_COOKIE = 'lbb_m';
export const REMEMBER_SECONDS = 60 * 60 * 24 * 30;

export const rememberValue = (id: string, now = Date.now()) => signLink('manage', id, REMEMBER_SECONDS, now);

export const rememberOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: REMEMBER_SECONDS,
};

/** The subscriber id held in the cookie, or null if it is missing, forged or expired. */
export function rememberedId(cookieValue: string | undefined, now = Date.now()): string | null {
  try {
    return cookieValue ? verifyLink('manage', cookieValue, now) : null;
  } catch {
    return null;
  }
}

import { REMEMBER_COOKIE, rememberOptions, rememberValue } from '@/lib/remember';
import { normalizePhone } from '@/lib/sms';
import { allow, ensureEmailTables } from '@/lib/subscribers';
import { clientIp, go } from '@/lib/text-http';
import { checkCode, sendCode, subscriberByPhone, textsOn } from '@/lib/text-plan';
import { fingerprint } from '@/lib/tokens';

export const dynamic = 'force-dynamic';

/**
 * Signing in with a phone number. A code is texted only if the number already has a text plan,
 * and the page says the same thing either way, so it cannot be used to look numbers up or to
 * make the app text strangers.
 */
export async function POST(request: Request) {
  if (!textsOn()) return go(request, '/alerts');
  const form = await request.formData().catch(() => null);
  const phone = normalizePhone(form?.get('phone'));
  if (!form || !phone) return go(request, '/alerts/text?state=badnumber');
  const next = `/alerts/text?phone=${encodeURIComponent(phone)}`;
  try {
    await ensureEmailTables();
    const code = String(form.get('code') ?? '');
    if (!code) {
      if (!(await allow(`textlogin:${fingerprint(clientIp(request))}`, 10, 60))) return go(request, '/alerts/text?state=slow');
      if (await subscriberByPhone(phone)) await sendCode(phone).catch(() => false);
      return go(request, `${next}&state=sent`);
    }
    const id = await subscriberByPhone(phone);
    if (!id || !(await checkCode(phone, code))) return go(request, `${next}&state=wrong`);
    const res = go(request, '/alerts');
    res.cookies.set(REMEMBER_COOKIE, rememberValue(id), rememberOptions);
    return res;
  } catch {
    return go(request, '/alerts/text?state=error');
  }
}

import { noteProblem } from '@/lib/db';
import { REMEMBER_COOKIE, rememberOptions, rememberValue } from '@/lib/remember';
import { fetchSession } from '@/lib/stripe';
import { go, manageUrl } from '@/lib/text-http';
import { linkCheckout, sendCode, textsOn } from '@/lib/text-plan';
import { signLink } from '@/lib/tokens';

export const dynamic = 'force-dynamic';

/**
 * Where Stripe sends the customer after paying. The checkout is looked up at Stripe itself, so
 * this address cannot be used to claim a plan that was not paid for.
 */
export async function GET(request: Request) {
  if (!textsOn()) return go(request, '/alerts');
  try {
    const paid = await fetchSession(new URL(request.url).searchParams.get('session_id') ?? '');
    if (!paid) return go(request, '/alerts?text=unpaid');
    // The return address signs the customer in, so it only works for a day after the checkout.
    if (Date.now() / 1000 - paid.created > 86_400) return go(request, '/alerts/text');
    const linked = await linkCheckout(paid);
    if (!linked) return go(request, '/alerts?text=error');
    if (linked.needsCode) await sendCode(linked.phone).catch(() => false);
    const res = go(request, manageUrl(signLink('manage', linked.id, 3600), 'paid'));
    res.cookies.set(REMEMBER_COOKIE, rememberValue(linked.id), rememberOptions);
    return res;
  } catch (e) {
    await noteProblem('return', e instanceof Error ? e.message : 'unknown error');
    return go(request, '/alerts?text=error');
  }
}

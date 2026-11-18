import { noteProblem } from '@/lib/db';
import { siteUrl } from '@/lib/mailer';
import { createCheckout } from '@/lib/stripe';
import { allow, ensureEmailTables, subscriberById } from '@/lib/subscribers';
import { clientIp, formAndOwner, go } from '@/lib/text-http';
import { textsOn } from '@/lib/text-plan';
import { fingerprint } from '@/lib/tokens';

export const dynamic = 'force-dynamic';

/** "Get text alerts": sends the visitor to Stripe's checkout page. Payment comes before any text is sent. */
export async function POST(request: Request) {
  if (!textsOn()) return go(request, '/alerts?text=off');
  const { id } = await formAndOwner(request);
  try {
    await ensureEmailTables();
    if (!(await allow(`checkout:${fingerprint(clientIp(request))}`, 10, 60))) return go(request, '/alerts?text=busy');
    const person = id ? await subscriberById(id) : null;
    const url = await createCheckout({ site: siteUrl(), subscriberId: person?.id, email: person?.email });
    return Response.redirect(url, 303);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown error';
    console.error('text checkout failed:', message);
    await noteProblem('checkout', message);
    return go(request, '/alerts?text=error');
  }
}

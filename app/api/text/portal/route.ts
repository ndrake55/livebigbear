import { noteProblem } from '@/lib/db';
import { siteUrl } from '@/lib/mailer';
import { createPortal } from '@/lib/stripe';
import { formAndOwner, go, manageUrl } from '@/lib/text-http';
import { textState, textsOn } from '@/lib/text-plan';

export const dynamic = 'force-dynamic';

/** "Billing": opens Stripe's own page for updating a card or canceling. */
export async function POST(request: Request) {
  const { token, id } = await formAndOwner(request);
  if (!textsOn() || !id) return go(request, '/alerts');
  try {
    const st = await textState(id);
    if (!st.customer) return go(request, manageUrl(token, 'error'));
    return Response.redirect(await createPortal(st.customer, `${siteUrl()}/alerts`), 303);
  } catch (e) {
    await noteProblem('portal', e instanceof Error ? e.message : 'unknown error');
    return go(request, manageUrl(token, 'error'));
  }
}

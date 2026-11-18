import { noteProblem } from '@/lib/db';
import { siteUrl } from '@/lib/mailer';
import { createPortal } from '@/lib/stripe';
import { formAndOwner, go, manageUrl } from '@/lib/text-http';
import { forgetUnknownPlan, textState, textsOn } from '@/lib/text-plan';

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
    const message = e instanceof Error ? e.message : 'unknown error';
    // Stripe has no such customer: the plan was bought with a test card before live payments.
    if (id && /no such customer/i.test(message)) {
      await forgetUnknownPlan(id).catch(() => {});
      await noteProblem('portal', 'A plan bought in test mode was cleared, because Stripe has no such customer in live mode.');
      return go(request, '/alerts?text=testplan');
    }
    await noteProblem('portal', e instanceof Error ? e.message : 'unknown error');
    return go(request, manageUrl(token, 'error'));
  }
}

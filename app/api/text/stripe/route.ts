import { NextResponse } from 'next/server';
import { noteProblem } from '@/lib/db';
import { cancelSubscription, chargeCustomer, readSession, validStripeSignature } from '@/lib/stripe';
import { applySubscriptionStatus, endPlanForCustomer, linkCheckout, sendCode, textsOn } from '@/lib/text-plan';

export const dynamic = 'force-dynamic';

const chargeId = (obj: any) => (typeof obj?.charge === 'string' ? obj.charge : String(obj?.charge?.id ?? ''));

/** Stops the texts for this customer and cancels the subscription at Stripe so it cannot renew. */
async function endPlan(customerId: string, why: string): Promise<void> {
  const subscriptionId = await endPlanForCustomer(customerId);
  if (!subscriptionId) return;
  await noteProblem('ended', `A text plan was ended after ${why}.`);
  try {
    await cancelSubscription(subscriptionId);
  } catch (e) {
    // The texts have stopped either way. Say so on the status page so the renewal can be canceled by hand.
    await noteProblem('ended', `A text plan was ended after ${why}, but Stripe would not cancel the subscription (${e instanceof Error ? e.message : 'error'}). Cancel it in Stripe.`);
  }
}

/** Stripe's notifications: a checkout finished, or a subscription was renewed, failed or canceled. */
export async function POST(request: Request) {
  if (!textsOn()) return NextResponse.json({ error: 'off' }, { status: 503 });
  const body = await request.text();
  if (!validStripeSignature(body, request.headers.get('stripe-signature'))) {
    return NextResponse.json({ error: 'bad signature' }, { status: 400 });
  }
  let event: any;
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: 'bad body' }, { status: 400 });
  }
  try {
    const obj = event?.data?.object;
    // Bank debits and similar methods finish paying later, and report it with the second event.
    // readSession only accepts a checkout that is actually paid, so neither can switch on a plan early.
    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      const paid = readSession(obj);
      const linked = paid ? await linkCheckout(paid) : null;
      if (linked?.needsCode) await sendCode(linked.phone).catch(() => false);
    } else if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      await applySubscriptionStatus(String(obj?.id ?? ''), event.type.endsWith('deleted') ? 'canceled' : String(obj?.status ?? ''));
    } else if (event.type === 'charge.refunded') {
      // A full refund ends the plan, as the Terms say. A partial refund changes nothing.
      if (obj?.refunded === true) await endPlan(typeof obj.customer === 'string' ? obj.customer : String(obj.customer?.id ?? ''), 'a full refund');
    } else if (event.type === 'charge.dispute.created') {
      // The cardholder has told their bank the charge was wrong. Stop texting and stop renewals.
      await endPlan(await chargeCustomer(chargeId(obj)), 'a payment dispute');
    } else if (event.type === 'radar.early_fraud_warning.created') {
      // The card issuer suspects fraud. Nothing is ended automatically; refunding now avoids a dispute fee.
      await noteProblem('fraud', 'A card issuer flagged a payment as possibly fraudulent. Look under Payments in Stripe and consider refunding it.');
    }
    return NextResponse.json({ received: true });
  } catch (e) {
    await noteProblem('webhook', `${String(event?.type)}: ${e instanceof Error ? e.message : 'error'}`);
    // A 500 asks Stripe to try again later.
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}

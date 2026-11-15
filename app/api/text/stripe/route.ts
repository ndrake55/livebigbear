import { NextResponse } from 'next/server';
import { readSession, validStripeSignature } from '@/lib/stripe';
import { applySubscriptionStatus, linkCheckout, sendCode, textsOn } from '@/lib/text-plan';

export const dynamic = 'force-dynamic';

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
    if (event.type === 'checkout.session.completed') {
      const paid = readSession(obj);
      const linked = paid ? await linkCheckout(paid) : null;
      if (linked?.needsCode) await sendCode(linked.phone).catch(() => false);
    } else if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      await applySubscriptionStatus(String(obj?.id ?? ''), event.type.endsWith('deleted') ? 'canceled' : String(obj?.status ?? ''));
    }
    return NextResponse.json({ received: true });
  } catch {
    // A 500 asks Stripe to try again later.
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}

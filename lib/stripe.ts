import { createHmac, timingSafeEqual } from 'node:crypto';

const key = () => process.env.STRIPE_SECRET_KEY ?? '';
export const isStripeConfigured = () => Boolean(key() && process.env.STRIPE_PRICE_ID && process.env.STRIPE_WEBHOOK_SECRET);

/**
 * The Stripe API version this code was written against. Sending it with every request means a
 * later change on Stripe's side cannot alter the answers until this line is updated on purpose.
 */
export const STRIPE_API_VERSION = '2026-10-28.endive';

async function stripe(method: 'GET' | 'POST', path: string, params?: Record<string, string>, pinned = true): Promise<any> {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key()}`,
      ...(pinned ? { 'Stripe-Version': STRIPE_API_VERSION } : {}),
      ...(params ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
    body: params ? new URLSearchParams(params) : undefined,
    signal: AbortSignal.timeout(12000),
    cache: 'no-store',
  });
  const json = await res.json().catch(() => null);
  if (res.ok) return json;
  const message = String(json?.error?.message ?? '');
  // If Stripe does not accept the pinned version, fall back to the account's own default
  // rather than failing every request.
  if (pinned && /api version/i.test(message)) return stripe(method, path, params, false);
  throw new Error(`Stripe answered ${res.status}: ${message.slice(0, 200)}`);
}

/** Starts Stripe's own checkout page for the yearly text plan and returns its address. */
export async function createCheckout(opts: { site: string; subscriberId?: string; email?: string }): Promise<string> {
  const params: Record<string, string> = {
    mode: 'subscription',
    'line_items[0][price]': process.env.STRIPE_PRICE_ID ?? '',
    'line_items[0][quantity]': '1',
    success_url: `${opts.site}/api/text/return?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${opts.site}/alerts`,
    // A label for this checkout flow, so it can be told apart in Stripe's dashboard later.
    integration_identifier: 'lbb_text_plan_qkzvwmtr',
    'phone_number_collection[enabled]': 'true',
    'custom_text[submit][message]':
      'By subscribing you agree to receive recurring road and weather alert texts from Live Big Bear at the mobile number above. Message frequency varies. Message and data rates may apply. Reply STOP to cancel, HELP for help.',
  };
  if (opts.subscriberId) params.client_reference_id = opts.subscriberId;
  if (opts.email) params.customer_email = opts.email;
  let session: any;
  try {
    session = await stripe('POST', '/checkout/sessions', params);
  } catch (e) {
    // The label is optional. If Stripe rejects it, the checkout must still work without it.
    if (!(e instanceof Error) || !e.message.includes('integration_identifier')) throw e;
    delete params.integration_identifier;
    session = await stripe('POST', '/checkout/sessions', params);
  }
  return String(session.url);
}

export interface PaidSession {
  customerId: string;
  subscriptionId: string;
  email: string;
  phone: string;
  subscriberId: string;
  /** When the checkout was started, in seconds since 1970. */
  created: number;
}

/** Reads a finished checkout. Returns null unless it was completed and paid. */
export function readSession(s: any): PaidSession | null {
  if (!s || s.status !== 'complete' || (s.payment_status !== 'paid' && s.payment_status !== 'no_payment_required')) return null;
  const customerId = typeof s.customer === 'string' ? s.customer : String(s.customer?.id ?? '');
  const subscriptionId = typeof s.subscription === 'string' ? s.subscription : String(s.subscription?.id ?? '');
  if (!customerId || !subscriptionId) return null;
  return {
    customerId,
    subscriptionId,
    email: String(s.customer_details?.email ?? s.customer_email ?? '').trim().toLowerCase(),
    phone: String(s.customer_details?.phone ?? ''),
    subscriberId: /^\d{1,18}$/.test(String(s.client_reference_id ?? '')) ? String(s.client_reference_id) : '',
    created: Number(s.created) || 0,
  };
}

export const fetchSession = async (id: string): Promise<PaidSession | null> =>
  /^cs_[A-Za-z0-9_]{10,200}$/.test(id) ? readSession(await stripe('GET', `/checkout/sessions/${id}`)) : null;

/** Stripe's page where a customer updates their card or cancels. */
export async function createPortal(customerId: string, returnUrl: string): Promise<string> {
  const session = await stripe('POST', '/billing_portal/sessions', { customer: customerId, return_url: returnUrl });
  return String(session.url);
}

/** Checks Stripe's signature on a notification: "t=timestamp,v1=signature" over "timestamp.body". */
export function validStripeSignature(body: string, header: string | null, secret = process.env.STRIPE_WEBHOOK_SECRET ?? '', now = Date.now()): boolean {
  if (!secret || !header) return false;
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=') as [string, string]));
  const t = Number(parts.t);
  if (!Number.isFinite(t) || Math.abs(now / 1000 - t) > 300) return false;
  const expected = createHmac('sha256', secret).update(`${parts.t}.${body}`).digest('hex');
  // A header can carry several v1 signatures while a secret is being rotated.
  return header
    .split(',')
    .filter((p) => p.startsWith('v1='))
    .some((p) => {
      const a = Buffer.from(p.slice(3));
      const b = Buffer.from(expected);
      return a.length === b.length && timingSafeEqual(a, b);
    });
}

/** For the status page: asks Stripe about the configured price and says, in plain words, whether it will work. */
export async function checkPrice(): Promise<{ ok: boolean; summary: string }> {
  const id = process.env.STRIPE_PRICE_ID ?? '';
  if (!key() || !id) return { ok: false, summary: 'Not set up yet.' };
  if (!id.startsWith('price_')) {
    return { ok: false, summary: `STRIPE_PRICE_ID should start with "price_" but starts with "${id.slice(0, 5)}". Open the product in Stripe and copy the ID shown beside its price, not the product ID.` };
  }
  try {
    const p = await stripe('GET', `/prices/${encodeURIComponent(id)}`);
    const amount = `$${(Number(p.unit_amount ?? 0) / 100).toFixed(2)}`;
    const mode = p.livemode ? 'live mode' : 'sandbox (test cards only)';
    if (!p.active) return { ok: false, summary: `The price is archived in Stripe (${mode}).` };
    if (p.type !== 'recurring') return { ok: false, summary: `The price is ${amount} one time, but the plan needs a recurring yearly price (${mode}).` };
    return { ok: true, summary: `Price found: ${amount} every ${p.recurring?.interval_count > 1 ? `${p.recurring.interval_count} ` : ''}${p.recurring?.interval ?? '?'}, ${mode}.` };
  } catch (e) {
    return { ok: false, summary: e instanceof Error ? e.message : 'Could not reach Stripe.' };
  }
}

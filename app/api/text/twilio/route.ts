import { siteUrl } from '@/lib/mailer';
import { validTwilioSignature } from '@/lib/sms';
import { applyReply, textsOn } from '@/lib/text-plan';

export const dynamic = 'force-dynamic';

const xml = (body = '') => new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`, { headers: { 'Content-Type': 'text/xml' } });

/**
 * Twilio calls this when someone replies to a text. STOP and START are recorded so the app
 * stops or resumes sending; Twilio itself sends the carrier-required confirmation.
 */
export async function POST(request: Request) {
  if (!textsOn()) return new Response('off', { status: 503 });
  const form = await request.formData().catch(() => null);
  if (!form) return new Response('bad request', { status: 400 });
  const params: Record<string, string> = {};
  for (const [k, v] of form.entries()) params[k] = String(v);
  // Twilio signs the public address it was given, which is the live site, not a preview.
  const path = new URL(request.url);
  const publicUrl = `${siteUrl().replace('https://livebigbear.com', 'https://www.livebigbear.com')}${path.pathname}${path.search}`;
  const sig = request.headers.get('x-twilio-signature');
  if (!validTwilioSignature(publicUrl, params, sig) && !validTwilioSignature(request.url, params, sig)) {
    return new Response('bad signature', { status: 403 });
  }
  const result = await applyReply(params.From ?? '', params.Body ?? '').catch(() => 'ignored' as const);
  if (result === 'ignored' && /^\s*(help|info)\s*$/i.test(params.Body ?? '')) {
    return xml('<Message>Live Big Bear road alerts. Manage or cancel at livebigbear.com/alerts. Msg and data rates may apply. Reply STOP to end.</Message>');
  }
  return xml();
}

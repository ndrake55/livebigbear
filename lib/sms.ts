import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Level } from './status';

/** Text alerts need a Twilio account and either a Messaging Service or a sending number. */
const cfg = () => ({
  sid: process.env.TWILIO_ACCOUNT_SID ?? '',
  token: process.env.TWILIO_AUTH_TOKEN ?? '',
  service: process.env.TWILIO_MESSAGING_SERVICE_SID ?? '',
  from: process.env.TWILIO_PHONE_NUMBER ?? process.env.TWILIO_FROM_NUMBER ?? '',
});

export const isSmsConfigured = (): boolean => {
  const c = cfg();
  return Boolean(c.sid && c.token && (c.service || c.from));
};

/** US numbers only, stored as +1 and ten digits. Anything else is refused. */
export function normalizePhone(raw: unknown): string | null {
  const digits = String(raw ?? '').replace(/\D/g, '');
  const ten = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  // Area codes and exchanges never start with 0 or 1.
  return /^[2-9]\d{2}[2-9]\d{6}$/.test(ten) ? `+1${ten}` : null;
}

/** "+19095551234" becomes "(909) •••-1234". */
export const maskPhone = (phone: string) => phone.replace(/^\+1(\d{3})\d{3}(\d{4})$/, '($1) •••-$2');

export async function sendText(to: string, body: string): Promise<void> {
  const c = cfg();
  if (!isSmsConfigured()) throw new Error('Text messaging is not configured');
  const form = new URLSearchParams({ To: to, Body: body });
  if (c.service) form.set('MessagingServiceSid', c.service);
  else form.set('From', c.from);
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(c.sid)}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${c.sid}:${c.token}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form,
    signal: AbortSignal.timeout(10000),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Twilio answered ${res.status}`);
}

/**
 * Checks that a request really came from Twilio. Twilio signs the full address followed by
 * every posted field in alphabetical order, using the account's Auth Token.
 */
export function validTwilioSignature(url: string, params: Record<string, string>, signature: string | null, token = cfg().token): boolean {
  if (!token || !signature) return false;
  const data = Object.keys(params)
    .sort()
    .reduce((acc, k) => acc + k + params[k], url);
  const expected = createHmac('sha1', token).update(data).digest('base64');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** What happened to a road, from one status to the next. */
export type RoadEvent = 'closed' | 'reopened' | 'chainsOn' | 'chainsOff';

const isChain = (l: string) => l === 'r1' || l === 'r2' || l === 'r3';

/** Null when the change is not worth a text, such as data going missing or coming back. */
export function eventFor(from: string | null, to: Level): RoadEvent | null {
  if (to === 'unknown' || from === null || from === 'unknown' || from === to) return null;
  if (to === 'closed') return 'closed';
  if (from === 'closed') return 'reopened';
  if (isChain(to)) return 'chainsOn'; // new chain control, or a change of chain level
  if (to === 'open' && isChain(from)) return 'chainsOff';
  return null;
}

export interface RoadChange {
  id: string;
  name: string;
  event: RoadEvent;
  to: Level;
}

const CHAIN_WORD: Record<string, string> = { r1: 'R1', r2: 'R2', r3: 'R3' };

export function changeLine(c: RoadChange): string {
  if (c.event === 'closed') return `${c.name} CLOSED`;
  if (c.event === 'reopened') return `${c.name} reopened${isChain(c.to) ? `, chains ${CHAIN_WORD[c.to]}` : ''}`;
  if (c.event === 'chainsOn') return `${c.name} chains required (${CHAIN_WORD[c.to]})`;
  return `${c.name} chain controls lifted`;
}

/** One text covering every change the person cares about. Kept short to stay within two segments. */
export function changeText(changes: RoadChange[]): string {
  return `Live Big Bear: ${changes.map(changeLine).join('. ')}. livebigbear.com Reply STOP to end.`;
}

export const codeText = (code: string) => `Live Big Bear: your code is ${code}. It works for 10 minutes. If you did not ask for it, ignore this text.`;
export const welcomeText = () =>
  'Live Big Bear: text alerts are on. You will get road closures, chain control changes and your morning summary. Msg and data rates may apply. Reply STOP to end, HELP for help.';

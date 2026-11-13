import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { dbSecretSeed } from './db';

/**
 * Secret used to sign links. Set EMAIL_TOKEN_SECRET to choose one; otherwise it is derived
 * from the database address, which is already a secret only the server knows.
 */
function secret(): string {
  const explicit = process.env.EMAIL_TOKEN_SECRET;
  if (explicit) return explicit;
  const seed = dbSecretSeed();
  if (!seed) throw new Error('No signing secret: set EMAIL_TOKEN_SECRET or DATABASE_URL');
  return createHash('sha256').update(`lbb-email-tokens:${seed}`).digest('hex');
}

const mac = (data: string) => createHmac('sha256', secret()).update(data).digest('base64url');

function same(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export type LinkKind = 'confirm' | 'unsub' | 'manage';

/** A signed link token for one subscriber. `ttlSeconds` of 0 means it never expires. */
export function signLink(kind: LinkKind, id: string, ttlSeconds: number, now = Date.now()): string {
  const exp = ttlSeconds > 0 ? Math.floor(now / 1000) + ttlSeconds : 0;
  return `${id}.${exp}.${mac(`${kind}:${id}:${exp}`)}`;
}

/** Returns the subscriber id if the token is genuine and not expired, otherwise null. */
export function verifyLink(kind: LinkKind, token: string | null | undefined, now = Date.now()): string | null {
  const parts = String(token ?? '').split('.');
  if (parts.length !== 3) return null;
  const [id, expText, sig] = parts;
  if (!/^\d{1,18}$/.test(id) || !/^\d{1,12}$/.test(expText)) return null;
  if (!same(sig, mac(`${kind}:${id}:${expText}`))) return null;
  const exp = Number(expText);
  if (exp !== 0 && exp * 1000 < now) return null;
  return id;
}

/** Proof that the signup form was loaded from this site, and when. */
export function signForm(now = Date.now()): string {
  return `${now}.${mac(`form:${now}`)}`;
}

/** Milliseconds since the form token was issued, or null if it is not genuine. */
export function formAge(token: string | null | undefined, now = Date.now()): number | null {
  const [ts, sig, extra] = String(token ?? '').split('.');
  if (extra !== undefined || !/^\d{10,16}$/.test(ts ?? '') || !sig) return null;
  if (!same(sig, mac(`form:${ts}`))) return null;
  return now - Number(ts);
}

/** A one-way fingerprint, so limits can be kept per visitor or address without storing either. */
export const fingerprint = (value: string) => mac(`fp:${value}`).slice(0, 32);

/** Amazon's notification service only ever calls back from addresses like this. */
export const isSnsUrl = (value: string): boolean => {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && /^sns\.[a-z0-9-]+\.amazonaws\.com$/.test(u.hostname);
  } catch {
    return false;
  }
};

export type SesEvent =
  | { kind: 'confirm-subscription'; url: string }
  | { kind: 'suppress'; reason: 'bounce' | 'complaint'; emails: string[] }
  | { kind: 'ignore' };

/** Read a message from Amazon about our sending: a setup handshake, a bounce or a complaint. */
export function parseSesEvent(body: string): SesEvent {
  let outer: any;
  try {
    outer = JSON.parse(body);
  } catch {
    return { kind: 'ignore' };
  }
  if (outer?.Type === 'SubscriptionConfirmation' && isSnsUrl(String(outer.SubscribeURL ?? ''))) {
    return { kind: 'confirm-subscription', url: String(outer.SubscribeURL) };
  }
  if (outer?.Type !== 'Notification') return { kind: 'ignore' };
  let msg: any;
  try {
    msg = typeof outer.Message === 'string' ? JSON.parse(outer.Message) : outer.Message;
  } catch {
    return { kind: 'ignore' };
  }
  const type = String(msg?.notificationType ?? msg?.eventType ?? '');
  const clean = (list: unknown) =>
    (Array.isArray(list) ? list : [])
      .map((r: any) => String(r?.emailAddress ?? '').trim().toLowerCase())
      .filter((e) => e.includes('@'));
  // Only permanent bounces count: a full mailbox today may work tomorrow.
  if (type === 'Bounce' && msg.bounce?.bounceType === 'Permanent') {
    return { kind: 'suppress', reason: 'bounce', emails: clean(msg.bounce.bouncedRecipients) };
  }
  if (type === 'Complaint') {
    return { kind: 'suppress', reason: 'complaint', emails: clean(msg.complaint?.complainedRecipients) };
  }
  return { kind: 'ignore' };
}

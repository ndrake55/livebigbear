import { formAndOwner, go, manageUrl } from '@/lib/text-http';
import { changePhone, textsOn } from '@/lib/text-plan';

export const dynamic = 'force-dynamic';

/** A paying subscriber changes the number their texts go to. The new number gets a code to prove it. */
export async function POST(request: Request) {
  const { form, token, id } = await formAndOwner(request);
  if (!textsOn() || !form || !id) return go(request, '/alerts');
  try {
    const out = await changePhone(id, String(form.get('phone') ?? ''));
    return go(request, manageUrl(token, { ok: 'resent', 'bad-number': 'badnumber', 'not-paid': 'error', 'slow-down': 'slow' }[out]));
  } catch {
    return go(request, manageUrl(token, 'error'));
  }
}

import { formAndOwner, go, manageUrl } from '@/lib/text-http';
import { sendCode, textState, textsOn, verifyPhone } from '@/lib/text-plan';

export const dynamic = 'force-dynamic';

/** The code box on the settings page: prove the number, or ask for a fresh code. */
export async function POST(request: Request) {
  const { form, token, id } = await formAndOwner(request);
  if (!textsOn() || !form || !id) return go(request, '/alerts');
  try {
    if (form.get('again') === '1') {
      const st = await textState(id);
      const ok = st.phone && st.status !== 'none' && !st.verified ? await sendCode(st.phone) : false;
      return go(request, manageUrl(token, ok ? 'resent' : 'slow'));
    }
    return go(request, manageUrl(token, (await verifyPhone(id, String(form.get('code') ?? ''))) ? 'verified' : 'wrong'));
  } catch {
    return go(request, manageUrl(token, 'error'));
  }
}

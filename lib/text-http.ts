import { NextResponse } from 'next/server';
import { verifyLink } from './tokens';

/** Sends the browser back to a page on this site after a form post. */
export const go = (request: Request, path: string) => NextResponse.redirect(new URL(path, request.url), 303);

/** Reads a posted form and the subscriber its settings token belongs to. */
export async function formAndOwner(request: Request): Promise<{ form: FormData | null; token: string; id: string | null }> {
  try {
    const form = await request.formData();
    const token = String(form.get('token') ?? '');
    return { form, token, id: verifyLink('manage', token) };
  } catch {
    return { form: null, token: '', id: null };
  }
}

export const manageUrl = (token: string, state: string) => `/alerts/manage?token=${encodeURIComponent(token)}&text=${state}#text`;
export const clientIp = (request: Request) =>
  request.headers.get('x-real-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';

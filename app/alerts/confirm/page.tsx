import type { Metadata } from 'next';
import Link from 'next/link';
import { verifyLink } from '@/lib/tokens';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Confirm your email', robots: { index: false } };

export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; state?: string }>;
}) {
  const { token, state } = await searchParams;
  let valid = false;
  try {
    valid = Boolean(token && verifyLink('confirm', token));
  } catch {
    valid = false;
  }

  let title = 'This link has expired';
  let text = 'Confirmation links work for 48 hours. Sign up again to get a new one.';
  if (state === 'done') {
    title = 'You are signed up';
    text = 'We will email you on storm days. Every email has an unsubscribe link.';
  } else if (state === 'error') {
    title = 'Something went wrong';
    text = 'Please open the link in your email again in a minute.';
  } else if (valid) {
    title = 'One more tap';
    text = 'Confirm that you want Live Big Bear storm-day emails.';
  }

  return (
    <div className="shell">
      <header className="top">
        <Link href="/" className="brand">
          Live Big Bear
        </Link>
      </header>
      <div className="title">
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
      {valid && !state ? (
        <form method="post" action="/api/subscribe/confirm">
          <input type="hidden" name="token" value={token} />
          <button className="button button-full" type="submit">
            Confirm my email
          </button>
        </form>
      ) : (
        <Link className="button" href={state === 'done' ? '/' : '/alerts'}>
          {state === 'done' ? 'See road conditions' : 'Back to signup'}
        </Link>
      )}
    </div>
  );
}

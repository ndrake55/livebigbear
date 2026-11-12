import type { Metadata } from 'next';
import Link from 'next/link';
import { verifyLink } from '@/lib/tokens';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Unsubscribe', robots: { index: false } };

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; state?: string }>;
}) {
  const { token, state } = await searchParams;
  let valid = false;
  try {
    valid = Boolean(token && verifyLink('unsub', token));
  } catch {
    valid = false;
  }

  let title = 'This link is not valid';
  let text = 'Use the unsubscribe link at the bottom of any Live Big Bear email.';
  if (state === 'done') {
    title = 'You are unsubscribed';
    text = 'You will not get any more emails from Live Big Bear.';
  } else if (state === 'error') {
    title = 'Something went wrong';
    text = 'Please try the link in your email again.';
  } else if (valid) {
    title = 'Stop the emails?';
    text = 'You will no longer get Live Big Bear storm-day emails.';
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
        <form method="post" action="/api/subscribe/unsubscribe">
          <input type="hidden" name="token" value={token} />
          <button className="button button-full" type="submit">
            Unsubscribe
          </button>
        </form>
      ) : (
        <Link className="button" href="/">
          See road conditions
        </Link>
      )}
    </div>
  );
}

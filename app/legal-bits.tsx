import Link from 'next/link';
import { legal } from '@/lib/legal';

/** Small "Terms · Privacy" links for the bottom of a page. */
export function LegalLinks() {
  return (
    <p className="note">
      <Link href="/terms">Terms of use</Link> · <Link href="/privacy">Privacy policy</Link>
    </p>
  );
}

/** How to reach us, in the words both legal pages use. */
export function ContactLine() {
  const l = legal();
  return (
    <p className="lede">
      {l.email ? (
        <>
          Email <a href={`mailto:${l.email}`}>{l.email}</a>
        </>
      ) : (
        <>Reply to any email we have sent you</>
      )}
      {l.postal ? `, or write to ${l.operator}, ${l.postal}.` : '.'}
    </p>
  );
}

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

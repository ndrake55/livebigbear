import type { Metadata } from 'next';
import Link from 'next/link';
import { legal, LEGAL_UPDATED } from '@/lib/legal';
import { ContactLine, LegalSection as S } from '../legal-bits';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Privacy policy',
  description: 'What Live Big Bear collects, why, who it is shared with, and how to see, change or delete it.',
  alternates: { canonical: '/privacy' },
};

const COLLECT: { what: string; why: string }[] = [
  { what: 'Your email address', why: 'Only if you sign up for alerts. Used to send them and a link to your settings.' },
  { what: 'Your mobile number', why: 'Only if you buy the text plan. Used to send your alerts and sign-in codes.' },
  { what: 'Your alert settings', why: 'The roads, days, hours and kinds of alert you chose, so we send only what you asked for.' },
  { what: 'Payment records', why: 'If you buy the text plan, Stripe gives us a customer and subscription reference and whether the plan is paid. We never receive your card number.' },
  { what: 'Replies to our texts', why: 'STOP and START, so we stop or resume your texts.' },
  { what: 'Star ratings', why: 'The rating itself, stored without your name.' },
  { what: 'A scrambled form of your internet address', why: 'Kept briefly to limit abuse of signup, sign-in and rating forms. We store a one-way fingerprint, not the address itself.' },
];

const SHARED: { who: string; what: string }[] = [
  { who: 'Amazon Web Services (email delivery)', what: 'Your email address and the emails we send you.' },
  { who: 'Twilio (text delivery)', what: 'Your mobile number and the texts we send you.' },
  { who: 'Stripe (payments)', what: 'Everything you enter at checkout. Stripe is the one who collects it.' },
  { who: 'Vercel (website hosting and visit counts) and Neon (database)', what: 'They store and serve the site and its data on our behalf.' },
];

export default function PrivacyPage() {
  const l = legal();
  return (
    <div className="shell">
      <Link href="/about" className="back">
        <span aria-hidden="true">‹</span> About
      </Link>
      <div className="title">
        <h1>Privacy policy</h1>
        <p>Last updated {LEGAL_UPDATED}</p>
      </div>

      <S title="The short version">
        <p className="lede">
          You can use Live Big Bear without an account and without telling us anything. We collect an email address or mobile number only
          if you ask for alerts, we use it only to send them, and we do not sell it or use it for anyone else’s marketing.
        </p>
        {l.operator !== 'Live Big Bear' && <p className="lede">Live Big Bear (livebigbear.com) is operated by {l.operator}.</p>}
      </S>

      <S title="What we collect and why">
        <div className="list">
          {COLLECT.map((c) => (
            <div key={c.what} className="row row-static">
              <span className="row-text">
                <span className="row-name">{c.what}</span>
                <span className="row-sub">{c.why}</span>
              </span>
            </div>
          ))}
        </div>
        <p className="note">We do not ask for your location. Maps and conditions are the same for every visitor.</p>
      </S>

      <S title="Text messages">
        <p className="lede">
          <strong>
            We do not sell, rent or share your mobile number or your consent to receive texts with any third party or affiliate for
            marketing or promotional purposes.
          </strong>{' '}
          Your number goes only to the companies that deliver your texts for us, listed below. Message frequency varies, message and data
          rates may apply, and you can reply STOP at any time. The full text terms are in our <Link href="/terms">Terms of use</Link>.
        </p>
      </S>

      <S title="Who we share it with">
        <p className="lede">Only the companies that run the service for us. Each receives only what it needs:</p>
        <div className="list">
          {SHARED.map((c) => (
            <div key={c.who} className="row row-static">
              <span className="row-text">
                <span className="row-name">{c.who}</span>
                <span className="row-sub">{c.what}</span>
              </span>
            </div>
          ))}
        </div>
        <p className="lede">
          We do not sell personal information, and we do not share it for advertising. We would disclose information only if the law
          required it, or to protect the service and its users from fraud or abuse.
        </p>
      </S>

      <S title="Cookies and tracking">
        <p className="lede">
          We use two small cookies, and only when needed. One remembers you on this device for 30 days after you open your alert settings,
          so you do not need a new link each time. The other is set when you rate something, so one device counts once. We use no
          advertising cookies and no cross-site tracking.
        </p>
        <p className="lede">
          We count visits with Vercel Web Analytics, to see which pages are used. It sets no cookies and does not follow you to other
          sites. It records the page, the site you came from, and your general device type and country. Private details in a page
          address, such as a settings link, are removed before anything is recorded. Because we do not track you across other websites, a “Do Not Track” signal from
          your browser changes nothing here.
        </p>
        <p className="lede">
          Maps, camera images, videos and directions are loaded from other services such as OpenFreeMap, Caltrans, YouTube and Google
          Maps. When your browser loads them, those services see your internet address, as with any website, and videos and directions are
          subject to their providers’ own privacy policies. Like all websites, our hosting provider keeps short-lived technical logs.
        </p>
      </S>

      <S title="Seeing, changing or deleting your information">
        <p className="lede">
          Open your settings from the <Link href="/alerts">Alerts page</Link> to see and change what we send you, change your number, or
          unsubscribe. Every email has an unsubscribe link, and replying STOP ends texts. To have your information deleted altogether, or
          to ask what we hold, contact us and we will act within 30 days.
        </p>
      </S>

      <S title="How long we keep it">
        <p className="lede">
          Signups that are never confirmed are deleted after a week. We keep your address, number and settings while you are subscribed.
          After you unsubscribe we keep the address or number on a do-not-contact list, so we do not message you again by mistake. Sign-in
          codes last 10 minutes, and abuse-limiting records about a day. Payment records are kept by Stripe as the law requires.
        </p>
      </S>

      <S title="Security">
        <p className="lede">
          Data travels over encrypted connections, card details stay with Stripe, and settings links and sign-in codes are signed and
          expire. No system is perfectly secure, so we collect as little as we can.
        </p>
      </S>

      <S title="Children">
        <p className="lede">
          Live Big Bear is a general-audience site and is not directed at children under 13. We do not knowingly collect personal
          information from them. The text plan is for adults.
        </p>
      </S>

      <S title="Changes">
        <p className="lede">
          If we change this policy we will update the date at the top, and for changes that affect how we use your email address or number
          we will tell subscribers first.
        </p>
      </S>

      <S title="Contact">
        <ContactLine />
        <p className="note">
          See also our <Link href="/terms">Terms of use</Link>.
        </p>
      </S>
    </div>
  );
}

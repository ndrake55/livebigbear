import type { Metadata } from 'next';
import Link from 'next/link';
import { legal, LEGAL_UPDATED } from '@/lib/legal';
import { ContactLine, LegalSection as S } from '../legal-bits';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Terms of use',
  description: 'The terms for using Live Big Bear, its free email alerts and its paid text alert plan.',
  alternates: { canonical: '/terms' },
};

export default function TermsPage() {
  const l = legal();
  return (
    <div className="shell">
      <Link href="/about" className="back">
        <span aria-hidden="true">‹</span> About
      </Link>
      <div className="title">
        <h1>Terms of use</h1>
        <p>Last updated {LEGAL_UPDATED}</p>
      </div>

      <S title="The short version">
        <p className="lede">
          Live Big Bear gathers road, weather and outdoor information that public agencies publish and shows it in one place. It is a
          convenience, not an official source. Conditions in the mountains change faster than any website. Always follow posted signs,
          road crews and official orders.
        </p>
      </S>

      <S title="Who we are">
        <p className="lede">
          Live Big Bear (livebigbear.com) is operated by {l.operator}. “We” and “us” mean {l.operator}. By using the site, signing up for
          emails or buying the text plan, you agree to these terms. If you do not agree, please do not use the site.
        </p>
      </S>

      <S title="Information only, with no guarantee">
        <p className="lede">
          Road status and chain control come from Caltrans. Weather comes from the National Weather Service. Fire information comes from
          CAL FIRE, and other data comes from the agencies named on our <Link href="/about">About page</Link>. We do not create or check
          this information, and it can be late, incomplete or wrong. A road shown as open may be closed, and the reverse.
        </p>
        <p className="lede">
          Do not rely on Live Big Bear for decisions about your safety. It is not an emergency service and it does not send evacuation
          notices. In an emergency call 911 and follow instructions from official agencies.
        </p>
      </S>

      <S title="Email alerts">
        <p className="lede">
          Storm-day emails are free. We send them only to addresses that have been confirmed by a link we email. Every email has an
          unsubscribe link, and you can change or pause what you get at any time from your settings.
        </p>
      </S>

      <S title="Text alerts">
        <p className="lede">
          <strong>What it is.</strong> Live Big Bear text alerts is a paid plan that sends automated text messages about road closures,
          reopenings and chain control changes on the roads into the Big Bear Valley, and an optional morning summary on days with chains
          or closures. We also text a one-time code to confirm your number or sign you in.
        </p>
        <p className="lede">
          <strong>How often.</strong> Message frequency varies with the weather. Most days there are none. On storm days there can be
          several, up to the daily limit you choose in your settings (10 at most).
        </p>
        <p className="lede">
          <strong>Cost of messages.</strong> Message and data rates may apply, depending on your mobile plan.
        </p>
        <p className="lede">
          <strong>Stopping and help.</strong> Reply STOP to any text to stop them at once. Reply START to resume. Reply HELP for help, or
          contact us using the details at the bottom of this page. Replying STOP stops the texts but does not cancel your paid plan; cancel
          that from your settings.
        </p>
        <p className="lede">
          <strong>Delivery is not guaranteed.</strong> Texts can be delayed or not delivered for reasons outside our control. Mobile
          carriers are not liable for delayed or undelivered messages. The plan is for US mobile numbers only. You confirm the number you
          give is yours, and you will change it in your settings if you give the number up.
        </p>
      </S>

      <S title="Price, renewal and canceling">
        <p className="lede">
          The text plan costs $12 a year, charged when you sign up. <strong>It renews automatically every year at the same price, on the
          anniversary of your signup, until you cancel.</strong> Payment is handled by Stripe; we never see or store your card number.
        </p>
        <p className="lede">
          You can cancel at any time: open your settings from the <Link href="/alerts">Alerts page</Link>, choose “Billing: update my card
          or cancel”, and cancel there. Canceling stops future renewals, and your texts continue until the end of the year you have paid
          for.
        </p>
        <p className="lede">
          <strong>Refunds.</strong> If you are not happy, contact us within 14 days of a charge and we will refund it in full. A full
          refund ends the plan. After 14 days we do not give partial refunds for unused time. If we change the price, we will tell you by
          email or text before your next renewal.
        </p>
      </S>

      <S title="Ratings">
        <p className="lede">
          Star ratings on trails, routes and campgrounds come from visitors and are their opinions, not ours. Please rate honestly, once
          per place. We may remove ratings that look automated or abusive.
        </p>
      </S>

      <S title="Fair use of the site">
        <p className="lede">
          Please do not try to break the site, overload it, collect its contents in bulk by automated means, sign other people up for
          alerts, or use it for anything unlawful. We may block access or end an account that does.
        </p>
      </S>

      <S title="Other sites and services">
        <p className="lede">
          The site links to and shows material from other organizations, including maps, cameras, videos and directions. Those services
          are run by others under their own terms, and we are not responsible for them.
        </p>
      </S>

      <S title="No warranty and limit of liability">
        <p className="lede">
          The site and its alerts are provided “as is” and “as available”, without warranties of any kind, whether express or implied,
          including accuracy, fitness for a particular purpose and uninterrupted availability.
        </p>
        <p className="lede">
          To the fullest extent the law allows, {l.operator} is not liable for any indirect, incidental or consequential loss, or for any
          loss, injury or damage arising from relying on information on the site or in an alert, or from an alert that was late or never
          arrived. Our total liability for any claim is limited to the amount you paid us in the 12 months before the claim, or $12 if you
          paid nothing. Some places do not allow some of these limits, so parts of this section may not apply to you.
        </p>
      </S>

      <S title="Changes, and the law that applies">
        <p className="lede">
          We may update these terms. The date at the top shows the latest version, and for changes that matter to paying subscribers we
          will give notice by email or text. These terms are governed by the laws of the State of California, and disputes belong in the
          state or federal courts located in California.
        </p>
      </S>

      <S title="Contact">
        <ContactLine />
        <p className="note">
          See also our <Link href="/privacy">Privacy policy</Link>.
        </p>
      </S>
    </div>
  );
}

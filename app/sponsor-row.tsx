import { type Sponsor } from '@/lib/sponsors';

/**
 * A quiet, clearly labelled ad that looks like one of the app's own rows. It opens in a new tab,
 * so the app stays open behind it, and is marked as paid for search engines.
 */
export function SponsorRow({ sponsor }: { sponsor: Sponsor | null }) {
  if (!sponsor) return null;
  return (
    <aside className="sponsor" aria-label="Sponsored">
      <span className="sponsor-label">Sponsored</span>
      <a className="sponsor-row" href={sponsor.url} target="_blank" rel="sponsored noopener">
        <span className="sponsor-mark" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#7c8cff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
          </svg>
        </span>
        <span className="row-text" style={{ flex: 1 }}>
          <span className="row-name">{sponsor.name}</span>
          <span className="row-sub">{sponsor.line}</span>
        </span>
        <span className="temp" aria-hidden="true">
          ›
        </span>
      </a>
    </aside>
  );
}

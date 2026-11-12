/**
 * The one address search engines should treat as the real site. It must match the domain
 * marked primary in Vercel (the one the other redirects to). Change it here only.
 */
export const SITE = 'https://www.livebigbear.com';

/** Builds a block of structured data that search engines and AI assistants read. */
export const jsonLd = (data: Record<string, unknown>) => ({ __html: JSON.stringify(data).replace(/</g, '\\u003c') });

export const crumbs = (trail: { name: string; path: string }[]) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: trail.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: `${SITE}${c.path}` })),
});

/** A trail, route or other place to visit. Star ratings are included only when visitors have rated it. */
export function placeLd(p: {
  name: string;
  description: string;
  path: string;
  at?: { lat: number; lon: number } | null;
  rating?: { avg: number; count: number } | null;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'TouristAttraction',
    name: p.name,
    description: p.description,
    url: `${SITE}${p.path}`,
    isAccessibleForFree: true,
    publicAccess: true,
    address: { '@type': 'PostalAddress', addressLocality: 'Big Bear Lake', addressRegion: 'CA', addressCountry: 'US' },
    ...(p.at ? { geo: { '@type': 'GeoCoordinates', latitude: p.at.lat, longitude: p.at.lon } } : {}),
    ...(p.rating && p.rating.count > 0
      ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: p.rating.avg, ratingCount: p.rating.count, bestRating: 5, worstRating: 1 } }
      : {}),
  };
}

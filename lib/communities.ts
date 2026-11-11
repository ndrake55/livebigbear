export interface Community {
  slug: string;
  name: string;
  lat: number; // at most 4 decimals: the weather service rejects more
  lon: number;
}

/** The first entry is the default, shown as "Whole valley". */
export const COMMUNITIES: Community[] = [
  { slug: 'big-bear-lake', name: 'Big Bear Lake', lat: 34.2439, lon: -116.9114 },
  { slug: 'big-bear-city', name: 'Big Bear City', lat: 34.2611, lon: -116.845 },
  { slug: 'sugarloaf', name: 'Sugarloaf', lat: 34.2439, lon: -116.8292 },
  { slug: 'fawnskin', name: 'Fawnskin', lat: 34.2681, lon: -116.9425 },
  { slug: 'baldwin-lake', name: 'Baldwin Lake', lat: 34.2767, lon: -116.8011 },
];

export const communityBySlug = (slug?: string) => COMMUNITIES.find((c) => c.slug === slug);

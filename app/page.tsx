import type { Metadata } from 'next';
import { permanentRedirect } from 'next/navigation';
import { communityBySlug } from '@/lib/communities';
import { HomeView } from './home-view';

export const revalidate = 120;

export const metadata: Metadata = { alternates: { canonical: '/' } };

const site = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Live Big Bear',
  url: 'https://www.livebigbear.com/',
  description: 'Live road conditions, chain control, weather and outdoor conditions for the Big Bear Valley.',
};

export default async function Home({ searchParams }: { searchParams: Promise<{ demo?: string; c?: string }> }) {
  const { demo, c } = await searchParams;
  // Community pages used to be /?c=fawnskin. They now have their own address.
  const old = communityBySlug(c);
  if (old) permanentRedirect(`/${old.slug}${demo === 'storm' ? '?demo=storm' : ''}`);
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(site) }} />
      <HomeView demo={demo} />
    </>
  );
}

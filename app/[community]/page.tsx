import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { COMMUNITIES, communityBySlug } from '@/lib/communities';
import { HomeView } from '../home-view';

export const revalidate = 120;
export const dynamicParams = false;

type Props = { params: Promise<{ community: string }>; searchParams: Promise<{ demo?: string }> };

export function generateStaticParams() {
  return COMMUNITIES.map((c) => ({ community: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = communityBySlug((await params).community);
  if (!c) return {};
  return {
    title: `${c.name} weather and road conditions right now`,
    description: `Live weather, snow forecast and chain control for ${c.name} in the Big Bear Valley, with every road up the mountain: Hwy 330, Hwy 18 and Hwy 38.`,
    alternates: { canonical: `/${c.slug}` },
  };
}

export default async function CommunityPage({ params, searchParams }: Props) {
  const picked = communityBySlug((await params).community);
  if (!picked) notFound();
  const { demo } = await searchParams;
  return <HomeView demo={demo} picked={picked} />;
}

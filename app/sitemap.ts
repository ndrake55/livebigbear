import type { MetadataRoute } from 'next';
import { COMMUNITIES } from '@/lib/communities';
import { getOffRoad } from '@/lib/offroad';
import { ROUTES } from '@/lib/routes';
import { getTrails } from '@/lib/trails';

export const revalidate = 86400;

const BASE = 'https://www.livebigbear.com';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // If the Forest Service is not answering, the sitemap simply lists fewer pages.
  const [trails, offroad] = await Promise.all([getTrails(), getOffRoad()]);
  const page = (path: string, priority: number, changeFrequency: 'hourly' | 'daily' | 'weekly' = 'hourly') => ({
    url: `${BASE}${path}`,
    changeFrequency,
    priority,
  });
  return [
    page('/', 1),
    page('/map', 0.9),
    ...ROUTES.map((r) => page(`/roads/${r.id}`, 0.9)),
    ...COMMUNITIES.map((c) => page(`/${c.slug}`, 0.8)),
    page('/explore', 0.7, 'daily'),
    page('/trails', 0.8, 'daily'),
    page('/off-road', 0.8, 'daily'),
    page('/lake', 0.8, 'daily'),
    ...trails.trails.map((t) => page(`/trails/${t.slug}`, 0.6, 'weekly')),
    ...offroad.routes.map((r) => page(`/off-road/${r.slug}`, 0.6, 'weekly')),
    page('/camping', 0.7, 'daily'),
    page('/alerts', 0.5, 'weekly'),
  ];
}

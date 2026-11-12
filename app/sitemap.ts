import type { MetadataRoute } from 'next';
import { COMMUNITIES } from '@/lib/communities';
import { ROUTES } from '@/lib/routes';

const BASE = 'https://www.livebigbear.com';

export default function sitemap(): MetadataRoute.Sitemap {
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
    page('/camping', 0.7, 'daily'),
    page('/alerts', 0.5, 'weekly'),
  ];
}

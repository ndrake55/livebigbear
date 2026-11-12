import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/', '/status', '/alerts/confirm', '/alerts/unsubscribe'] }],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}

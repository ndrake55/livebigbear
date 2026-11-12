import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/', '/status', '/alerts/confirm', '/alerts/unsubscribe'] }],
    sitemap: 'https://www.livebigbear.com/sitemap.xml',
    host: 'https://www.livebigbear.com',
  };
}

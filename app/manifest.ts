import type { MetadataRoute } from 'next';

/** Lets phones install the site to the home screen and open it full screen like an app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Live Big Bear',
    short_name: 'Live Big Bear',
    description: 'Live road, chain control and weather conditions for the Big Bear Valley.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#F2F5F8',
    theme_color: '#12202E',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}

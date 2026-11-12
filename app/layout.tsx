import type { Metadata, Viewport } from 'next';
import './globals.css';
import { InstallHint } from './install-hint';
import { alertsOn } from '@/lib/alerts-on';
import { SITE } from '@/lib/site';
import { Nav } from './nav';

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: 'Live Big Bear: road conditions and chain control right now',
    template: '%s | Live Big Bear',
  },
  description:
    'Live chain control and road status for every route into the Big Bear Valley (Hwy 330, Hwy 18 and Hwy 38), with weather, cameras and outdoor conditions.',
  openGraph: {
    type: 'website',
    siteName: 'Live Big Bear',
    locale: 'en_US',
  },
  twitter: { card: 'summary_large_image' },
  applicationName: 'Live Big Bear',
  appleWebApp: { capable: true, title: 'Live Big Bear', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#12202E',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Nav alerts={alertsOn()} />
        <InstallHint />
      </body>
    </html>
  );
}

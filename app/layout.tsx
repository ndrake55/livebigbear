import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://www.livebigbear.com'),
  title: {
    default: 'Live Big Bear: road conditions and chain control right now',
    template: '%s | Live Big Bear',
  },
  description:
    'Live chain control and road status for every route into the Big Bear Valley: Hwy 330, Hwy 18 and Hwy 38.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#12202E',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

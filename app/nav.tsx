'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  {
    href: '/',
    label: 'Roads',
    icon: (
      <>
        <path d="M4 21 9 3" />
        <path d="M20 21 15 3" />
        <path d="M12 6v2" />
        <path d="M12 12v2" />
        <path d="M12 18v2" />
      </>
    ),
  },
  {
    href: '/map',
    label: 'Map',
    icon: (
      <>
        <path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z" />
        <path d="M9 3v15" />
        <path d="M15 6v15" />
      </>
    ),
  },
  {
    href: '/explore',
    label: 'Explore',
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m15.5 8.5-2 5-5 2 2-5z" />
      </>
    ),
  },
];

const ALERTS_TAB = {
  href: '/alerts',
  label: 'Alerts',
  icon: (
    <>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </>
  ),
};

/** Bottom tab bar, like a phone app. The Alerts tab appears once email is switched on. */
export function Nav({ alerts = false }: { alerts?: boolean }) {
  const path = usePathname();
  const tabs = alerts ? [...TABS, ALERTS_TAB] : TABS;
  const active = (href: string): boolean => {
    if (href === '/') return path === '/' || path.startsWith('/roads');
    if (href === '/explore') return path.startsWith('/explore') || path.startsWith('/camping');
    return path.startsWith(href);
  };
  return (
    <nav className="tabs" aria-label="Sections">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={`tab${active(t.href) ? ' tab-on' : ''}`}
          aria-current={active(t.href) ? 'page' : undefined}
        >
          <svg
            aria-hidden="true"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {t.icon}
          </svg>
          <span>{t.label}</span>
        </Link>
      ))}
    </nav>
  );
}

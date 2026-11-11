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
];

/** Bottom tab bar, like a phone app. */
export function Nav() {
  const path = usePathname();
  const active = (href: string) => (href === '/' ? path === '/' || path.startsWith('/roads') : path.startsWith(href));
  return (
    <nav className="tabs" aria-label="Sections">
      {TABS.map((t) => (
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

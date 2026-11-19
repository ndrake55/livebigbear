'use client';

import { Analytics, type BeforeSendEvent } from '@vercel/analytics/next';

/** Pages whose address carries a private sign-in token or phone number. */
const PRIVATE = /^\/alerts\/(manage|confirm|unsubscribe|text)/;

/**
 * Visit counting. Before a page view is sent, anything after "?" is removed, so settings
 * links, sign-in codes and phone numbers never reach the analytics service.
 */
function scrub(event: BeforeSendEvent): BeforeSendEvent | null {
  try {
    const url = new URL(event.url);
    if (PRIVATE.test(url.pathname) || url.search) {
      url.search = '';
      url.hash = '';
      return { ...event, url: url.toString() };
    }
  } catch {
    return null;
  }
  return event;
}

export function VisitCounter() {
  return <Analytics beforeSend={scrub} />;
}

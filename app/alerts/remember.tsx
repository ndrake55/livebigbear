'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/** Remembers this subscriber on this device once they have opened their settings link. */
export function RememberDevice({ token }: { token: string }) {
  useEffect(() => {
    fetch('/api/subscribe/remember', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    }).catch(() => {});
  }, [token]);
  return null;
}

/** "Not you?" Forgets this device and shows the ordinary forms again. */
export function ForgetDevice() {
  const router = useRouter();
  const forget = async () => {
    await fetch('/api/subscribe/remember', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ forget: true }),
    }).catch(() => {});
    router.refresh();
  };
  return (
    <button type="button" className="linklike" onClick={forget}>
      Use a different email address
    </button>
  );
}

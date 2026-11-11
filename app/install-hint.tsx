'use client';

import { useEffect, useState } from 'react';

const KEY = 'lbb-install-dismissed';

type InstallEvent = Event & { prompt: () => Promise<void> };

const remember = () => {
  try {
    localStorage.setItem(KEY, '1');
  } catch {
    // Storage can be blocked (private mode). The hint just shows again next visit.
  }
};

/** A one-time bar offering to add the app to the phone's home screen. */
export function InstallHint() {
  const [mode, setMode] = useState<'none' | 'android' | 'ios'>('none');
  const [event, setEvent] = useState<InstallEvent | null>(null);

  useEffect(() => {
    try {
      if (localStorage.getItem(KEY)) return;
    } catch {
      // ignore
    }
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) return;

    const ua = navigator.userAgent;
    const ios = /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
    // Every browser on iPhone and iPad can add to the home screen from its Share menu.
    if (ios) setMode('ios');

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as InstallEvent);
      setMode('android');
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  if (mode === 'none') return null;

  const close = () => {
    remember();
    setMode('none');
  };

  return (
    <aside className="install" aria-label="Add to home screen">
      <div className="install-text">
        <strong>Keep Live Big Bear on your home screen</strong>
        {mode === 'ios' ? (
          <span>Tap the Share button in your browser, then “Add to Home Screen.”</span>
        ) : (
          <span>One tap to check the roads before you drive.</span>
        )}
      </div>
      <div className="install-actions">
        {mode === 'android' && event && (
          <button
            type="button"
            className="install-go"
            onClick={async () => {
              await event.prompt();
              close();
            }}
          >
            Install
          </button>
        )}
        <button type="button" className="install-close" onClick={close}>
          Not now
        </button>
      </div>
    </aside>
  );
}

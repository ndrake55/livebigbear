'use client';

import { useEffect, useState } from 'react';

const KEY = 'lbb-install-hidden-until';
const HIDE_DAYS = 14;
/** Fired by the "Add to home screen" link in the footer to bring the steps back. */
export const SHOW_EVENT = 'lbb-show-install';

type InstallEvent = Event & { prompt: () => Promise<void> };
type Mode = 'none' | 'android' | 'ios' | 'manual';

const hiddenForNow = () => {
  try {
    return Number(localStorage.getItem(KEY) ?? 0) > Date.now();
  } catch {
    return false; // Storage can be blocked (private mode). The hint just shows again.
  }
};

const hideForAWhile = () => {
  try {
    localStorage.setItem(KEY, String(Date.now() + HIDE_DAYS * 24 * 3600 * 1000));
  } catch {
    // ignore
  }
};

const isIos = () => {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
};

const isInstalled = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

function ShareIcon() {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ verticalAlign: '-3px', margin: '0 2px' }}
    >
      <path d="M12 15V3" />
      <path d="m7 8 5-5 5 5" />
      <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
    </svg>
  );
}

/** A bar offering to add the app to the home screen. Comes back after two weeks if closed. */
export function InstallHint() {
  const [mode, setMode] = useState<Mode>('none');
  const [event, setEvent] = useState<InstallEvent | null>(null);

  useEffect(() => {
    let installEvent: InstallEvent | null = null;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      installEvent = e as InstallEvent;
      setEvent(installEvent);
      if (!hiddenForNow() && !isInstalled()) setMode('android');
    };
    // The footer link always shows the steps, even after "Close".
    const onShow = () => setMode(installEvent ? 'android' : isIos() ? 'ios' : 'manual');

    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener(SHOW_EVENT, onShow);
    if (!hiddenForNow() && !isInstalled() && isIos()) setMode('ios');
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener(SHOW_EVENT, onShow);
    };
  }, []);

  if (mode === 'none') return null;

  const close = () => {
    hideForAWhile();
    setMode('none');
  };

  return (
    <aside className="install" aria-label="Add to home screen">
      <div className="install-text">
        <strong>Add Live Big Bear to your home screen</strong>
        {mode === 'ios' && (
          <ol className="install-steps">
            <li>
              Tap the Share button <ShareIcon /> in your browser’s toolbar.
            </li>
            <li>Scroll down and tap “Add to Home Screen.”</li>
            <li>Tap “Add.”</li>
          </ol>
        )}
        {mode === 'android' && <span>One tap to check the roads before you drive.</span>}
        {mode === 'manual' && (
          <span>Open your browser’s menu and choose “Install app” or “Add to Home Screen.”</span>
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
          Close
        </button>
      </div>
    </aside>
  );
}

/** Footer link that reopens the install steps. */
export function InstallLink() {
  return (
    <button type="button" className="linklike" onClick={() => window.dispatchEvent(new Event(SHOW_EVENT))}>
      Add to home screen
    </button>
  );
}

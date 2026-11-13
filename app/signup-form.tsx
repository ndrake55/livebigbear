'use client';

import { useEffect, useRef, useState } from 'react';

type State = { kind: 'idle' | 'sending' | 'done' | 'error'; message?: string };

/**
 * Email signup. The server does the real checking; this just collects the address.
 * In "manage" mode the same request is worded for people who are already signed up: the server
 * emails them a link to their settings.
 */
export function SignupForm({ mode = 'signup' }: { mode?: 'signup' | 'manage' }) {
  const id = mode === 'manage' ? 'manage' : 'signup';
  const [state, setState] = useState<State>({ kind: 'idle' });
  const token = useRef<{ t: string; at: number } | null>(null);

  const loadToken = async () => {
    try {
      const res = await fetch('/api/subscribe', { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as { t?: string };
      if (data.t) token.current = { t: data.t, at: Date.now() };
    } catch {
      // Tried again when the form is submitted.
    }
  };

  useEffect(() => {
    void loadToken();
  }, []);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setState({ kind: 'sending' });
    // An app left open for hours needs a fresh token.
    if (!token.current || Date.now() - token.current.at > 60 * 60 * 1000) {
      await loadToken();
      await new Promise((r) => setTimeout(r, 2100));
    }
    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.get('email'), company: data.get('company'), t: token.current?.t ?? '' }),
      });
      const out = (await res.json()) as { ok?: boolean; message?: string };
      if (out.ok) {
        form.reset();
        setState({ kind: 'done', message: mode === 'manage' ? 'If that address is signed up, a link to your settings is on its way. Check your inbox, and spam.' : out.message });
      } else {
        setState({ kind: 'error', message: out.message ?? 'Please try again.' });
      }
    } catch {
      setState({ kind: 'error', message: 'No connection. Please try again.' });
    }
  };

  return (
    <form className="signup" onSubmit={submit} noValidate>
      <label className="signup-label" htmlFor={`${id}-email`}>
        Email address
      </label>
      <div className={`signup-row${mode === 'manage' ? ' signup-row-stack' : ''}`}>
        <input
          id={`${id}-email`}
          className="signup-input"
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          required
          maxLength={254}
        />
        <button className="signup-button" type="submit" disabled={state.kind === 'sending'}>
          {state.kind === 'sending' ? 'Sending…' : mode === 'manage' ? 'Email me my link' : 'Sign up'}
        </button>
      </div>
      {/* A trap for bots. People never see or reach this field. */}
      <div className="signup-trap" aria-hidden="true">
        <label htmlFor={`${id}-company`}>Company</label>
        <input id={`${id}-company`} type="text" name="company" tabIndex={-1} autoComplete="off" />
      </div>
      <p className={`signup-status signup-${state.kind}`} role="status" aria-live="polite">
        {state.message ?? ''}
      </p>
    </form>
  );
}

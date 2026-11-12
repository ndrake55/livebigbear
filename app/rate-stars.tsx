'use client';

import { useEffect, useState } from 'react';

type Rating = { avg: number; count: number };

/** Lets a visitor give one to five stars. Tapping again changes their rating. */
export function RateStars({ item, what }: { item: string; what: string }) {
  const [rating, setRating] = useState<Rating | null>(null);
  const [mine, setMine] = useState<number | null>(null);
  const [off, setOff] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let gone = false;
    fetch(`/api/rate?item=${encodeURIComponent(item)}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d: { ok?: boolean; off?: boolean; rating?: Rating | null; mine?: number | null }) => {
        if (gone) return;
        if (d.off) setOff(true);
        if (d.ok) {
          setRating(d.rating ?? null);
          setMine(d.mine ?? null);
        }
      })
      .catch(() => {});
    return () => {
      gone = true;
    };
  }, [item]);

  if (off) return null;

  const send = async (stars: number) => {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      const res = await fetch('/api/rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item, stars }),
      });
      const d = (await res.json()) as { ok?: boolean; rating?: Rating; mine?: number; message?: string };
      if (d.ok && d.rating) {
        setRating(d.rating);
        setMine(d.mine ?? stars);
        setMessage('Thanks. Your rating is counted.');
      } else {
        setMessage(d.message ?? 'That did not go through. Please try again.');
      }
    } catch {
      setMessage('That did not go through. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card rate">
      <h2>Rate this {what}</h2>
      <p className="note">
        {rating
          ? `${rating.avg.toFixed(1)} out of 5 from ${rating.count} visitor${rating.count === 1 ? '' : 's'}.`
          : 'No ratings yet. Be the first.'}
      </p>
      <div className="stars" role="group" aria-label={`Rate this ${what} from 1 to 5 stars`}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            className={`star${mine !== null && n <= mine ? ' star-on' : ''}`}
            aria-label={`${n} star${n === 1 ? '' : 's'}`}
            aria-pressed={mine === n}
            disabled={busy}
            onClick={() => send(n)}
          >
            <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
              <path d="M12 2.5l2.9 6.1 6.6.9-4.8 4.6 1.2 6.6L12 17.6l-5.9 3.1 1.2-6.6L2.5 9.5l6.6-.9z" />
            </svg>
          </button>
        ))}
      </div>
      <p className="note" aria-live="polite">
        {message || (mine !== null ? `You gave this ${mine} star${mine === 1 ? '' : 's'}. Tap to change it.` : 'One rating per device.')}
      </p>
    </section>
  );
}

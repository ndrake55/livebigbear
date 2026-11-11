import { NextResponse } from 'next/server';
import { fetchRoadLines } from '@/lib/geometry';

export const dynamic = 'force-dynamic';
export const maxDuration = 40;

/**
 * The shapes of the highways, for drawing colored lines on the map.
 * A good answer is kept by Vercel's cache for a week, so OpenStreetMap is asked rarely.
 * A failed answer is never cached; the map simply shows no lines until the next try works.
 */
export async function GET() {
  try {
    const lines = await fetchRoadLines();
    return NextResponse.json(lines, {
      headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=604800, stale-while-revalidate=2592000' },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'unavailable' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

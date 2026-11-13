import { NextResponse } from 'next/server';
import lines from '@/lib/road-lines.json';

export const dynamic = 'force-static';

/**
 * The shapes of the highways, for drawing colored lines on the map. They are stored in the app
 * (lib/road-lines.json, from OpenStreetMap) because the roads do not move and outside map-data
 * servers could not be reached from where this app runs.
 */
export function GET() {
  return NextResponse.json(lines, {
    headers: { 'Cache-Control': 'public, max-age=86400, s-maxage=31536000' },
  });
}

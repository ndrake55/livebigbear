import { getSnapshot, summarize, type Snapshot } from './caltrans';
import { STORM_SAMPLE } from './sample';

/** Live data, or made-up storm data when the address ends in ?demo=storm. */
export async function loadSnapshot(demo: string | undefined): Promise<Snapshot & { demo: boolean }> {
  if (demo === 'storm') {
    return {
      ok: true,
      demo: true,
      fetchedAt: new Date().toISOString(),
      points: STORM_SAMPLE,
      routes: summarize([...STORM_SAMPLE]),
    };
  }
  return { ...(await getSnapshot()), demo: false };
}

export function pacificTime(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));
}

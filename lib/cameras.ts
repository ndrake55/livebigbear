export interface Camera {
  id: string;
  name: string;
  /** null for cameras that should not be pinned to a spot on the map. */
  lon: number | null;
  lat: number | null;
  /** image: a still that refreshes. youtube: a live stream. link: opens the owner's page. */
  kind: 'image' | 'youtube' | 'link';
  src: string; // image URL, YouTube video id, or page URL
  credit: string;
  group: 'Getting there' | 'On the mountain' | 'Around the valley';
}

// Caltrans CWWP2 camera feed, District 8. Docs: https://cwwp2.dot.ca.gov/documentation/cctv/cctv.htm
export const CCTV_URL =
  process.env.CALTRANS_CCTV_URL ?? 'https://cwwp2.dot.ca.gov/data/d8/cctv/cctvStatusD08.json';

/**
 * Cameras that are not in the Caltrans feed. Positions are approximate and placed by hand.
 * The eagle nest has no position on purpose: its location is kept private to protect the birds.
 * Remove an entry here to take a camera down.
 */
export const EXTRA_CAMERAS: Camera[] = [
  {
    id: 'veterans-park',
    name: 'Veterans Park, Big Bear Blvd',
    lon: -116.908,
    lat: 34.2437,
    kind: 'youtube',
    src: 'pofGnqJbCBY',
    credit: 'Live stream on YouTube',
    group: 'Getting there',
  },
  {
    id: 'snow-summit',
    name: 'Snow Summit',
    lon: -116.8892,
    lat: 34.2364,
    kind: 'link',
    src: 'https://www.bigbearmountainresort.com/webcams/snow-summit',
    credit: 'Big Bear Mountain Resort',
    group: 'On the mountain',
  },
  {
    id: 'bear-mountain',
    name: 'Bear Mountain',
    lon: -116.861,
    lat: 34.2277,
    kind: 'link',
    src: 'https://www.bigbearmountainresort.com/webcams/bear-mountain',
    credit: 'Big Bear Mountain Resort',
    group: 'On the mountain',
  },
  {
    id: 'snow-valley',
    name: 'Snow Valley',
    lon: -117.0364,
    lat: 34.225,
    kind: 'link',
    src: 'https://www.bigbearmountainresort.com/webcams/snow-valley',
    credit: 'Big Bear Mountain Resort',
    group: 'On the mountain',
  },
  {
    id: 'airport',
    name: 'Big Bear Airport',
    lon: -116.856,
    lat: 34.2637,
    kind: 'link',
    src: 'https://www.flybigbear.com/live-web-cam',
    credit: 'Big Bear Airport',
    group: 'Around the valley',
  },
  {
    id: 'eagle-nest',
    name: 'Bald eagle nest',
    lon: null,
    lat: null,
    kind: 'youtube',
    src: 'B4-L2nfGcuE',
    credit: 'Friends of Big Bear Valley',
    group: 'Around the valley',
  },
];

const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : null;
};

/** Find a value by key anywhere inside an object, in case the feed nests it differently than documented. */
function deepFind(obj: unknown, key: string, depth = 0): unknown {
  if (!obj || typeof obj !== 'object' || depth > 6) return undefined;
  const rec = obj as Record<string, unknown>;
  if (key in rec) return rec[key];
  for (const v of Object.values(rec)) {
    const found = deepFind(v, key, depth + 1);
    if (found !== undefined) return found;
  }
  return undefined;
}

export interface CameraTally {
  inFeed: number;
  inArea: number;
  onOurRoads: number;
  inService: number;
  withImage: number;
  /** Roads that have cameras in the area, with how many, e.g. "18 (2), 210 (14)". */
  roadsInArea: string;
}

/**
 * Caltrans highway cameras on Hwy 18, 330 and 38 in and around the valley.
 * `tally` records how many cameras pass each test, so the status page can show where they drop out.
 */
export function parseCameras(json: unknown, tally?: CameraTally): Camera[] {
  const rows = (json as { data?: unknown[] } | null)?.data;
  if (!Array.isArray(rows)) return [];
  const out: Camera[] = [];
  const roads = new Map<string, number>();
  rows.forEach((row, i) => {
    const cctv = (row as { cctv?: Record<string, unknown> } | null)?.cctv;
    if (!cctv) return;
    if (tally) tally.inFeed++;
    const loc = (cctv.location ?? {}) as Record<string, unknown>;
    const route = String(loc.route ?? '').replace(/\D/g, '');
    const lat = num(loc.latitude);
    const lon = num(loc.longitude);
    // Some feeds give an http address for an image that is also served securely.
    const url = String(deepFind(cctv, 'currentImageURL') ?? '').replace(/^http:\/\//, 'https://');
    if (lat === null || lon === null) return;
    if (lat < 34.0 || lat > 34.47 || lon < -117.45 || lon > -116.6) return;
    if (tally) tally.inArea++;
    roads.set(route || '?', (roads.get(route || '?') ?? 0) + 1);
    if (tally) tally.roadsInArea = [...roads].map(([r, n]) => `${r} (${n})`).join(', ');
    if (!['18', '330', '38'].includes(route)) return;
    if (tally) tally.onOurRoads++;
    if (String(cctv.inService ?? 'true').toLowerCase() === 'false') return;
    if (tally) tally.inService++;
    if (!/^https:\/\//.test(url)) return;
    if (tally) tally.withImage++;
    out.push({
      id: `caltrans-${String(cctv.index ?? i)}`,
      name: String(loc.locationName || loc.nearbyPlace || `Hwy ${route} camera`),
      lon,
      lat,
      kind: 'image',
      src: url,
      credit: 'Caltrans',
      group: 'Getting there',
    });
  });
  return out;
}

export async function getCameras(): Promise<{ ok: boolean; error?: string; cameras: Camera[]; tally?: CameraTally }> {
  try {
    const res = await fetch(CCTV_URL, {
      headers: { 'User-Agent': 'LiveBigBear/0.5 (livebigbear.com)', Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 300 },
    });
    if (!res.ok) throw new Error(`Caltrans answered ${res.status}`);
    const tally: CameraTally = { inFeed: 0, inArea: 0, onOurRoads: 0, inService: 0, withImage: 0, roadsInArea: '' };
    const found = parseCameras(await res.json(), tally);
    return { ok: true, cameras: [...found, ...EXTRA_CAMERAS], tally };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unknown error', cameras: EXTRA_CAMERAS };
  }
}

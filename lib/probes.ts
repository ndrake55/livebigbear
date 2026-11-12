import { readLakePage } from './lake';

/**
 * Checks of data sources we plan to use but have not built on yet.
 * They only feed the /status page, so the real field names and coverage can be seen
 * before any feature depends on them.
 */
const BOX = '-117.20,34.10,-116.65,34.40'; // west, south, east, north: the valley and the forest around it

export interface Probe {
  name: string;
  ok: boolean;
  summary: string;
  detail: string;
}

async function getJson(url: string): Promise<any> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'LiveBigBear/0.7 (livebigbear.com)', Accept: 'application/json' },
    signal: AbortSignal.timeout(9000),
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`answered ${res.status}`);
  return res.json();
}

const inBox = (base: string, extra: string) =>
  `${base}/query?where=1%3D1&geometry=${encodeURIComponent(BOX)}&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&${extra}&f=json`;

async function arcgisLayer(name: string, base: string, nameFields: string[]): Promise<Probe> {
  try {
    const [count, sample] = await Promise.all([
      getJson(inBox(base, 'returnCountOnly=true')),
      getJson(inBox(base, 'outFields=*&returnGeometry=false&resultRecordCount=6')),
    ]);
    if (count?.error || sample?.error) throw new Error(JSON.stringify(count?.error ?? sample?.error).slice(0, 200));
    const rows: Record<string, unknown>[] = (sample?.features ?? []).map((f: any) => f?.attributes ?? {});
    const fields = rows[0] ? Object.keys(rows[0]) : [];
    const pickName = (r: Record<string, unknown>) => {
      for (const want of nameFields) {
        const key = Object.keys(r).find((k) => k.toLowerCase() === want.toLowerCase());
        if (key && r[key]) return String(r[key]);
      }
      return '';
    };
    const names = rows.map(pickName).filter(Boolean);
    return {
      name,
      ok: Number(count?.count ?? 0) > 0,
      summary: `${count?.count ?? 0} records near Big Bear`,
      detail: `Examples: ${names.join('; ') || 'none named'}. Fields: ${fields.join(', ') || 'none returned'}`,
    };
  } catch (e) {
    return { name, ok: false, summary: 'Could not read it', detail: e instanceof Error ? e.message : 'error' };
  }
}

async function arcgisLayerList(name: string, base: string): Promise<Probe> {
  try {
    const json = await getJson(`${base}?f=json`);
    const layers: { id: number; name: string }[] = json?.layers ?? [];
    return {
      name,
      ok: layers.length > 0,
      summary: `${layers.length} layers`,
      detail: layers.map((l) => `${l.id}: ${l.name}`).join('; ') || 'none listed',
    };
  } catch (e) {
    return { name, ok: false, summary: 'Could not read it', detail: e instanceof Error ? e.message : 'error' };
  }
}

async function lakePage(): Promise<Probe> {
  const name = 'Lake figures (water district home page)';
  try {
    const res = await fetch('https://www.bbmwd.com/', {
      headers: { 'User-Agent': 'LiveBigBear/0.7 (livebigbear.com)' },
      signal: AbortSignal.timeout(9000),
      next: { revalidate: 3600 },
    });
    if (!res.ok) throw new Error(`answered ${res.status}`);
    const v = readLakePage(await res.text());
    return {
      name,
      ok: Boolean(v.temp || v.down),
      summary: v.temp || v.down ? 'Figures found' : 'Page read, but no figures found',
      detail: `Water temperature: ${v.temp || 'not found'}. Down from full: ${v.down || 'not found'}. Ramps: ${v.ramps || 'not found'}`,
    };
  } catch (e) {
    return { name, ok: false, summary: 'Could not read it', detail: e instanceof Error ? e.message : 'error' };
  }
}

export function runProbes(): Promise<Probe[]> {
  return Promise.all([
    arcgisLayer(
      'Forest Service trails',
      'https://apps.fs.usda.gov/arcx/rest/services/EDW/EDW_TrailNFSPublish_01/MapServer/0',
      ['TRAIL_NAME', 'NAME'],
    ),
    arcgisLayerList('Forest Service motor vehicle map', 'https://apps.fs.usda.gov/arcx/rest/services/EDW/EDW_MVUM_02/MapServer'),
    arcgisLayer(
      'Forest Service off-road trails',
      'https://apps.fs.usda.gov/arcx/rest/services/EDW/EDW_MVUM_02/MapServer/2',
      ['NAME', 'TRAIL_NAME'],
    ),
    lakePage(),
  ]);
}

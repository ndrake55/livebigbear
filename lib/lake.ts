export const LAKE_URL = 'https://www.bbmwd.com/';

export interface Lake {
  ok: boolean;
  error?: string;
  /** Water temperature in °F. */
  tempF: number | null;
  /** Feet below full. */
  downFt: number | null;
  ramps: { name: string; open: boolean }[];
}

/** The water district shows lake figures on its home page as plain text. */
export function readLakePage(html: string): { temp: string; down: string; ramps: string } {
  const plain = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
  const temp = plain.match(/Lake Temperature:?\s*([\d.]+)\s*°?\s*F/i)?.[1] ?? '';
  const down = plain.match(/Down from Full:?\s*([\d.]+)/i)?.[1] ?? '';
  const east = plain.match(/East (?:Launch )?Ramp[^.]{0,80}?(Open|Closed)/i)?.[1] ?? '';
  const west = plain.match(/West (?:Launch )?Ramp[^.]{0,80}?(Open|Closed)/i)?.[1] ?? '';
  return { temp, down, ramps: [east && `East ${east.toLowerCase()}`, west && `West ${west.toLowerCase()}`].filter(Boolean).join(', ') };
}

export function parseLake(html: string): Lake {
  const v = readLakePage(html);
  const num = (s: string) => (s && Number.isFinite(parseFloat(s)) ? parseFloat(s) : null);
  const ramps = v.ramps
    .split(', ')
    .filter(Boolean)
    .map((r) => ({ name: `${r.split(' ')[0]} ramp`, open: r.endsWith('open') }));
  const tempF = num(v.temp);
  const downFt = num(v.down);
  const ok = tempF !== null || downFt !== null || ramps.length > 0;
  return { ok, error: ok ? undefined : 'Page read, but no figures found', tempF, downFt, ramps };
}

export async function getLake(): Promise<Lake> {
  try {
    const res = await fetch(LAKE_URL, {
      headers: { 'User-Agent': 'LiveBigBear/0.8 (livebigbear.com)' },
      signal: AbortSignal.timeout(9000),
      next: { revalidate: 3600 },
    });
    if (!res.ok) throw new Error(`The water district site answered ${res.status}`);
    return parseLake(await res.text());
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'error', tempF: null, downFt: null, ramps: [] };
  }
}

/** A plain note on what the water temperature means for people going in. */
export function waterNote(tempF: number): string {
  if (tempF < 50) return 'Very cold water. Falling in is dangerous within minutes, so wear a life jacket.';
  if (tempF < 60) return 'Cold water. A fall in can take your breath away, so wear a life jacket.';
  if (tempF < 70) return 'Cool water. Fine for boating and paddling; chilly for a long swim.';
  return 'Comfortable water for swimming and paddling.';
}

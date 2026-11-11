export interface ChainPoint {
  route: string; // digits only, e.g. "18"
  locationName: string;
  nearbyPlace: string;
  direction: string;
  lat: number | null;
  lon: number | null;
  inService: boolean;
  status: string;
  description: string;
  statusDate: string; // yyyy-mm-dd, Pacific time, or ""
  statusTime: string; // hh:mm:ss, Pacific time, or ""
}

export interface RouteDef {
  id: string;
  name: string;
  sub: string;
  via: string;
  match: (p: ChainPoint) => boolean;
}

const between = (v: number | null, lo: number, hi: number) => v !== null && v >= lo && v <= hi;

/**
 * The four ways into the valley, in the order most visitors prefer them.
 * Hwy 18 is split by longitude: the front side runs from Running Springs to the dam,
 * the back side from Big Bear City down to Lucerne Valley.
 * These bounds are a first estimate: check /status against real data and tune them.
 */
export const ROUTES: RouteDef[] = [
  {
    id: '330',
    name: 'Hwy 330',
    sub: 'Highland to Running Springs',
    via: 'Hwy 330 from Highland',
    match: (p) => p.route === '330',
  },
  {
    id: '18-front',
    name: 'Hwy 18 front side',
    sub: 'Running Springs to the dam',
    via: 'Hwy 18 from Running Springs',
    match: (p) => p.route === '18' && between(p.lon, -117.13, -116.95),
  },
  {
    id: '38',
    name: 'Hwy 38',
    sub: 'Redlands to Big Bear City',
    via: 'Hwy 38 from Redlands',
    match: (p) => p.route === '38',
  },
  {
    id: '18-back',
    name: 'Hwy 18 back side',
    sub: 'Lucerne Valley to Baldwin Lake',
    via: 'Hwy 18 from Lucerne Valley',
    match: (p) => p.route === '18' && between(p.lon, -116.86, -116.6),
  },
];

export const routeById = (id: string) => ROUTES.find((r) => r.id === id);

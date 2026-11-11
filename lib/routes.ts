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
 * The roads into the valley, in the order most visitors prefer them.
 * Hwy 18 is split by longitude into three stretches: San Bernardino up through Crestline
 * to Running Springs, the front side from Running Springs to the dam, and the back side
 * from Big Bear City down to Lucerne Valley. Check /status to see where each point lands.
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
    id: '18-crestline',
    name: 'Hwy 18 via Crestline',
    sub: 'San Bernardino to Running Springs',
    via: 'Hwy 18 through Crestline',
    match: (p) => p.route === '18' && between(p.lon, -117.4, -117.13),
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

export interface Approach {
  via: string;
  legs: string[]; // route ids driven in order
}

/**
 * Complete ways to drive into the valley. Hwy 330 and Hwy 18 via Crestline both end at
 * Running Springs, so either one still needs the Hwy 18 front side to reach the lake.
 */
export const APPROACHES: Approach[] = [
  { via: 'Hwy 330 from Highland, then Hwy 18', legs: ['330', '18-front'] },
  { via: 'Hwy 18 through Crestline', legs: ['18-crestline', '18-front'] },
  { via: 'Hwy 38 from Redlands', legs: ['38'] },
  { via: 'Hwy 18 from Lucerne Valley', legs: ['18-back'] },
];

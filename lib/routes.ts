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
  short: string; // label for the map badge
  sub: string;
  via: string;
  match: (p: ChainPoint) => boolean;
}

export type Hwy18Stretch = 'crestline' | 'front' | 'valley' | 'back' | 'other';

/**
 * Which stretch of Hwy 18 a spot is on. Hwy 18 climbs from San Bernardino through Crestline
 * to Running Springs, runs the front side to the dam, passes through the valley, then drops
 * down the back side past Baldwin Lake to Lucerne Valley (which sits north-west of the valley,
 * so latitude matters as well as longitude). Beyond Lucerne Valley it is not our road.
 */
export function classify18(lon: number | null, lat: number | null): Hwy18Stretch {
  if (lon === null || lat === null) return 'other';
  if (lat >= 34.3) return lon > -117.0 ? 'back' : 'other';
  if (lon < -117.13) return 'crestline';
  if (lon <= -116.95) return 'front';
  if (lon > -116.86) return 'back';
  return 'valley';
}

const on18 = (p: ChainPoint, stretch: Hwy18Stretch) => p.route === '18' && classify18(p.lon, p.lat) === stretch;

/**
 * The roads into the valley, in the order most visitors prefer them.
 * Check /status to see where each Caltrans point lands.
 */
export const ROUTES: RouteDef[] = [
  {
    id: '330',
    name: 'Hwy 330',
    short: '330',
    sub: 'Highland to Running Springs',
    via: 'Hwy 330 from Highland',
    match: (p) => p.route === '330',
  },
  {
    id: '18-crestline',
    name: 'Hwy 18 via Crestline',
    short: '18 Crestline',
    sub: 'San Bernardino to Running Springs',
    via: 'Hwy 18 through Crestline',
    match: (p) => on18(p, 'crestline'),
  },
  {
    id: '18-front',
    name: 'Hwy 18 front side',
    short: '18 Front',
    sub: 'Running Springs to the dam',
    via: 'Hwy 18 from Running Springs',
    match: (p) => on18(p, 'front'),
  },
  {
    id: '38',
    name: 'Hwy 38',
    short: '38',
    sub: 'Redlands to Big Bear City',
    via: 'Hwy 38 from Redlands',
    match: (p) => p.route === '38',
  },
  {
    id: '18-back',
    name: 'Hwy 18 back side',
    short: '18 Back',
    sub: 'Lucerne Valley to Baldwin Lake',
    via: 'Hwy 18 from Lucerne Valley',
    match: (p) => on18(p, 'back'),
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

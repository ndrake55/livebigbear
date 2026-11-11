import type { ChainPoint } from './routes';

const p = (
  route: string,
  locationName: string,
  lon: number,
  lat: number,
  status: string,
  description: string,
  statusTime: string,
): ChainPoint => ({
  route,
  locationName,
  nearbyPlace: '',
  direction: '',
  lat,
  lon,
  inService: true,
  status,
  description,
  statusDate: '2026-01-15',
  statusTime,
});

/** Made-up storm-day readings, shown only at /?demo=storm so the layout can be reviewed on a clear day. */
export const STORM_SAMPLE: ChainPoint[] = [
  p('330', 'Sample point, lower Hwy 330', -117.17, 34.15, 'R-2', 'Chains required. Sample data.', '16:12:00'),
  p('330', 'Sample point, upper Hwy 330', -117.12, 34.2, 'R-1', 'Chains or snow tires required. Sample data.', '15:40:00'),
  p('18', 'Sample point, Hwy 18 near Snow Valley', -117.04, 34.22, 'R-1', 'Chains or snow tires required. Sample data.', '15:05:00'),
  p('38', 'Sample point, Hwy 38', -116.9, 34.17, 'R-0', 'No chain controls are in effect at this time.', '06:00:00'),
  p('18', 'Sample point, Hwy 18 back side', -116.8, 34.33, 'R-0', 'No chain controls are in effect at this time.', '06:00:00'),
];

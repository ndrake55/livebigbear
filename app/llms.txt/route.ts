import { COMMUNITIES } from '@/lib/communities';
import { ROUTES } from '@/lib/routes';
import { SITE } from '@/lib/site';

export const revalidate = 86400;

/** A plain-text guide to the site for AI assistants, following the llms.txt convention. */
export function GET() {
  const text = `# Live Big Bear

> Live conditions for the Big Bear Valley in the San Bernardino Mountains of Southern California: chain control and road status on every highway up the mountain, weather for each community, cameras, trails, off-road routes, the lake and campgrounds. Free, with no account needed. Pages are refreshed every few minutes from official sources.

Live Big Bear covers Big Bear Lake, Big Bear City, Sugarloaf, Fawnskin and Baldwin Lake. It is an independent community app and is not run by Caltrans, the Forest Service or any government agency. For anything safety-critical, such as evacuations or road closures, the official agency has the final word.

## Roads and chain control
- [All roads into Big Bear](${SITE}/): which roads are open, where chains are required, and the easiest way up right now
${ROUTES.map((r) => `- [${r.name}](${SITE}/roads/${r.id}): ${r.sub}`).join('\n')}
- [Live road map](${SITE}/map): road status, highway and resort cameras, weather and any nearby fires

## Weather by community
${COMMUNITIES.map((c) => `- [${c.name}](${SITE}/${c.slug}): current weather, forecast and expected snow`).join('\n')}

## Getting outside
- [Trails](${SITE}/trails): hiking, mountain biking and horse trails with difficulty, length, trailhead directions, a map and visitor ratings
- [Off-road routes](${SITE}/off-road): 4x4, ATV and dirt bike routes with allowed vehicles and open season
- [The lake](${SITE}/lake): water temperature, lake level and which public launch ramps are open
- [Camping](${SITE}/camping): nearby campgrounds with tonight's forecast low at each

## Where the data comes from
- Road status and chain control: Caltrans
- Weather, snow forecasts and alerts: National Weather Service
- Fires: CAL FIRE
- Air quality: AirNow (US EPA)
- Trails and off-road routes: US Forest Service, San Bernardino National Forest
- Lake figures: Big Bear Municipal Water District
- Campgrounds: Recreation.gov
`;
  return new Response(text, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}

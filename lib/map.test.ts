import { describe, expect, it } from 'vitest';
import { parseCameras } from './cameras';
import { buildLines } from './geometry';
import { classify18 } from './routes';

describe('classify18', () => {
  it('splits Hwy 18 into its stretches', () => {
    expect(classify18(-117.25, 34.23)).toBe('crestline');
    expect(classify18(-117.04, 34.22)).toBe('front');
    expect(classify18(-116.9, 34.245)).toBe('valley');
    expect(classify18(-116.8, 34.28)).toBe('back');
    expect(classify18(-116.97, 34.44)).toBe('back'); // Lucerne Valley is north-west of the valley
    expect(classify18(-117.2, 34.46)).toBe('other'); // on toward Apple Valley
    expect(classify18(null, 34)).toBe('other');
  });
});

describe('buildLines', () => {
  const g = (pts: [number, number][]) => pts.map(([lon, lat]) => ({ lon, lat }));
  const json = {
    elements: [
      { type: 'relation', tags: { ref: '330' }, members: [{ type: 'way', ref: 1 }] },
      { type: 'relation', tags: { ref: '18' }, members: [{ type: 'way', ref: 2 }, { type: 'node', ref: 9 }] },
      { type: 'way', id: 1, geometry: g([[-117.2, 34.15], [-117.15, 34.18], [-117.12, 34.2]]) },
      // one Hwy 18 way that crosses from the Crestline stretch into the front side
      { type: 'way', id: 2, geometry: g([[-117.2, 34.23], [-117.14, 34.22], [-117.1, 34.21], [-117.0, 34.22]]) },
      { type: 'way', id: 2, geometry: g([[0, 0], [1, 1]]) }, // duplicate id is ignored
      { type: 'way', id: 3, geometry: g([[-117, 34.1], [-116.9, 34.1]]) }, // not in any relation
    ],
  };
  it('groups ways by route and cuts Hwy 18 at stretch boundaries', () => {
    const lines = buildLines(json);
    expect(Object.keys(lines).sort()).toEqual(['18-crestline', '18-front', '330']);
    expect(lines['330'][0]).toHaveLength(3);
    // the cut repeats the boundary point so the two colored lines meet
    expect(lines['18-crestline'][0]).toEqual([[-117.2, 34.23], [-117.14, 34.22], [-117.1, 34.21]]);
    expect(lines['18-front'][0]).toEqual([[-117.1, 34.21], [-117, 34.22]]);
    expect(buildLines(null)).toEqual({});
  });
});

describe('parseCameras', () => {
  const cam = (route: string, lat: string, lon: string, url: string, inService = 'true') => ({
    cctv: {
      index: '7',
      location: { route, locationName: 'Test cam', latitude: lat, longitude: lon },
      inService,
      imageData: { static: { currentImageURL: url } },
    },
  });
  it('keeps working valley cameras with a secure image address', () => {
    const out = parseCameras({
      data: [
        cam('SR-330', '34.18', '-117.15', 'https://cwwp2.dot.ca.gov/data/d8/cctv/image/a/a.jpg'),
        cam('I-10', '34.07', '-117.2', 'https://cwwp2.dot.ca.gov/x.jpg'), // wrong road
        cam('SR-18', '34.6', '-117.3', 'https://cwwp2.dot.ca.gov/x.jpg'), // too far north
        cam('SR-38', '34.2', '-116.9', 'Not Reported'), // no image
        cam('SR-38', '34.2', '-116.9', 'https://cwwp2.dot.ca.gov/x.jpg', 'false'), // out of service
        { junk: true },
      ],
    });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: 'caltrans-7', name: 'Test cam', kind: 'image', lon: -117.15 });
    expect(parseCameras(undefined)).toEqual([]);
  });
  it('counts where cameras drop out and accepts http image addresses', () => {
    const tally = { inFeed: 0, inArea: 0, onOurRoads: 0, inService: 0, withImage: 0, roadsInArea: '' };
    const out = parseCameras(
      {
        data: [
          cam('SR-18', '34.22', '-117.1', 'http://cwwp2.dot.ca.gov/a.jpg'),
          cam('SR-210', '34.13', '-117.2', 'https://cwwp2.dot.ca.gov/b.jpg'),
          cam('SR-38', '34.2', '-116.9', 'Not Reported'),
          cam('I-5', '33.0', '-117.2', 'https://cwwp2.dot.ca.gov/c.jpg'),
        ],
      },
      tally,
    );
    expect(out).toHaveLength(1);
    expect(out[0].src).toBe('https://cwwp2.dot.ca.gov/a.jpg');
    expect(tally).toEqual({ inFeed: 4, inArea: 3, onOurRoads: 2, inService: 2, withImage: 1, roadsInArea: '18 (1), 210 (1), 38 (1)' });
  });
});

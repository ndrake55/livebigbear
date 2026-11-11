'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Camera } from '@/lib/cameras';
import type { MapData, MapPoint, MapRoad, MapWeather } from '@/lib/mapdata';

// Free OpenStreetMap-based map tiles from OpenFreeMap. No key needed.
const STYLE = process.env.NEXT_PUBLIC_MAP_STYLE ?? 'https://tiles.openfreemap.org/styles/liberty';
/** Zoomed out further than this, each road shows one badge. Closer in, every chain control point shows. */
const NEAR_ZOOM = 10.6;
const DEFAULT_BOUNDS: Box = [
  [-117.32, 34.03],
  [-116.72, 34.48],
];

type Box = [[number, number], [number, number]];
type Selected =
  | { kind: 'road'; road: MapRoad }
  | { kind: 'point'; point: MapPoint }
  | { kind: 'camera'; camera: Camera }
  | { kind: 'weather'; weather: MapWeather };
type Layers = { roads: boolean; cams: boolean; weather: boolean };

const SVG_NS = 'http://www.w3.org/2000/svg';
const ICONS: Record<string, string[]> = {
  check: ['M5 12.5l4.5 4.5L19 7.5'],
  x: ['M6 6l12 12', 'M18 6L6 18'],
  camera: ['M3 8h11a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z', 'M15 11l6-3v8l-6-3'],
  snow: ['M12 3v18', 'M4.2 7.5l15.6 9', 'M19.8 7.5l-15.6 9'],
};

function icon(name: string, size = 16): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '3');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  for (const d of ICONS[name] ?? []) {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', d);
    svg.append(path);
  }
  return svg;
}

/** A status symbol: an icon for open and closed, text for chain levels. */
function symbolNode(symbol: string): Node {
  return symbol in ICONS ? icon(symbol) : document.createTextNode(symbol);
}

function pin(className: string, label: string, onClick: () => void, ...children: Node[]): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = `mk ${className}`;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'pin';
  btn.setAttribute('aria-label', label);
  btn.append(...children);
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    onClick();
  });
  wrap.append(btn);
  return wrap;
}

function boundsOf(coords: [number, number][], fallback: Box): Box {
  if (coords.length < 2) return fallback;
  const lons = coords.map((c) => c[0]);
  const lats = coords.map((c) => c[1]);
  return [
    [Math.min(...lons), Math.min(...lats)],
    [Math.max(...lons), Math.max(...lats)],
  ];
}

function Panel({ item, onClose, focus }: { item: Selected; onClose: () => void; focus?: string }) {
  let body: React.ReactNode;
  if (item.kind === 'road') {
    const r = item.road;
    body = (
      <>
        <div className="panel-status">
          <span className="map-dot" style={{ background: r.color }} />
          {r.label}
        </div>
        <div className="panel-title">{r.name}</div>
        <div className="panel-sub">
          {r.sub}. {r.headline}.
        </div>
        {focus !== r.id && (
          <Link className="panel-link" href={`/roads/${r.id}`}>
            Road details
          </Link>
        )}
      </>
    );
  } else if (item.kind === 'point') {
    const p = item.point;
    body = (
      <>
        <div className="panel-status">
          <span className="map-dot" style={{ background: p.color }} />
          {p.label} · {p.road}
        </div>
        <div className="panel-title">{p.name}</div>
        {p.description && <div className="panel-sub">{p.description}</div>}
        {focus !== p.roadId && (
          <Link className="panel-link" href={`/roads/${p.roadId}`}>
            Road details
          </Link>
        )}
      </>
    );
  } else if (item.kind === 'camera') {
    const c = item.camera;
    body = (
      <>
        <div className="panel-title">{c.name}</div>
        {c.kind === 'image' && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="panel-media" src={c.src} alt={`Live camera view: ${c.name}`} />
        )}
        {c.kind === 'youtube' && (
          <iframe
            className="panel-media panel-video"
            src={`https://www.youtube-nocookie.com/embed/${c.src}?playsinline=1`}
            title={`Live camera: ${c.name}`}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        )}
        {c.kind === 'link' && (
          <a className="panel-link" href={c.src} target="_blank" rel="noopener noreferrer">
            Open the live camera
          </a>
        )}
        <div className="panel-sub">Camera: {c.credit}</div>
      </>
    );
  } else {
    const w = item.weather;
    body = (
      <>
        <div className="panel-title">
          {w.name}: {w.temp}°F
        </div>
        <div className="panel-sub">
          {w.period}: {w.short}
        </div>
        <Link className="panel-link" href={`/?c=${w.slug}`}>
          Full forecast
        </Link>
      </>
    );
  }
  return (
    <div className="panel" role="dialog" aria-label="Details">
      <button type="button" className="panel-close" aria-label="Close" onClick={onClose}>
        ×
      </button>
      {body}
    </div>
  );
}

/**
 * The interactive map. With `focus` set to a road id it becomes a small map of just that road.
 */
export function MapView({ data, focus }: { data: MapData; focus?: string }) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import('maplibre-gl').Map | null>(null);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<Selected | null>(null);
  const [layers, setLayers] = useState<Layers>({ roads: true, cams: true, weather: true });
  const layersRef = useRef(layers);
  layersRef.current = layers;

  const pinnedCameras = data.cameras.filter((c) => c.lon !== null && c.lat !== null);
  const unpinnedCameras = data.cameras.filter((c) => c.lon === null || c.lat === null);

  useEffect(() => {
    let map: import('maplibre-gl').Map | undefined;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    (async () => {
      try {
        const maplibregl = await import('maplibre-gl');
        const box = el.current;
        if (cancelled || !box) return;
        // Copied into public/ by scripts/copy-map-worker.mjs before each build.
        maplibregl.setWorkerUrl('/maplibre-worker.mjs');

        const points = focus ? data.points.filter((p) => p.roadId === focus) : data.points;
        const roads = focus ? data.roads.filter((r) => r.id === focus) : data.roads;
        // The full map always opens on the whole region; a road's own map opens on that road.
        const start = focus
          ? boundsOf(
              points.map((p) => [p.lon, p.lat]),
              DEFAULT_BOUNDS,
            )
          : DEFAULT_BOUNDS;

        const m = new maplibregl.Map({
          container: box,
          style: STYLE,
          bounds: start,
          fitBoundsOptions: { padding: focus ? 48 : 40, maxZoom: 13 },
          attributionControl: { compact: true },
          cooperativeGestures: Boolean(focus), // on a road's page, one finger scrolls the page, two move the map
        });
        map = m;
        mapRef.current = m;
        m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
        if (!focus) {
          m.addControl(
            new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: false } }),
            'top-right',
          );
        }
        timer = setTimeout(() => {
          if (!cancelled && !m.isStyleLoaded()) setFailed(true);
        }, 12000);

        const place = (node: HTMLElement, lon: number, lat: number) =>
          new maplibregl.Marker({ element: node }).setLngLat([lon, lat]).addTo(m);

        // One badge per road, shown when zoomed out.
        if (!focus) {
          for (const r of roads) {
            if (!r.at) continue;
            const name = document.createElement('span');
            name.className = 'pin-road-name';
            name.textContent = r.short;
            const status = document.createElement('span');
            status.className = 'pin-road-status';
            status.append(symbolNode(r.symbol));
            const node = pin('mk-road', `${r.name}: ${r.label}`, () => setSelected({ kind: 'road', road: r }), name, status);
            node.style.setProperty('--c', r.color);
            place(node, r.at[0], r.at[1]);
          }
        }
        // Every chain control point, shown when zoomed in. Worse statuses sit on top.
        for (const p of [...points].sort((a, b) => a.rank - b.rank)) {
          const node = pin('mk-point', `${p.name}: ${p.label}`, () => setSelected({ kind: 'point', point: p }), symbolNode(p.symbol));
          node.style.setProperty('--c', p.color);
          place(node, p.lon, p.lat);
        }
        for (const c of pinnedCameras) {
          const node = pin('mk-cam', `Camera: ${c.name}`, () => setSelected({ kind: 'camera', camera: c }), icon('camera', 15));
          place(node, c.lon!, c.lat!);
        }
        if (!focus) {
          data.weather.forEach((w, i) => {
            const kids: Node[] = [document.createTextNode(`${w.temp}°`)];
            if (w.snow) kids.push(icon('snow', 12));
            // Zoomed out, one temperature stands for the valley. Zoom in for each community.
            const cls = i === 0 ? 'mk-weather' : 'mk-weather mk-weather-extra';
            const node = pin(cls, `${w.name}: ${w.temp} degrees, ${w.short}`, () => setSelected({ kind: 'weather', weather: w }), ...kids);
            place(node, w.lon, w.lat);
          });
        }

        const syncZoom = () => box.classList.toggle('near', Boolean(focus) || m.getZoom() >= NEAR_ZOOM);
        m.on('zoom', syncZoom);
        syncZoom();
        m.on('click', () => setSelected(null));

        m.on('load', async () => {
          // Colored lines along each road. If the shapes are unavailable the pins still tell the story.
          try {
            const res = await fetch('/api/road-lines');
            if (!res.ok || cancelled) return;
            const lines = (await res.json()) as Record<string, [number, number][][]>;
            const colorOf = new Map(data.roads.map((r) => [r.id, r.color]));
            const features = Object.entries(lines)
              .filter(([id]) => !focus || id === focus)
              .map(([id, coords]) => ({
                type: 'Feature' as const,
                geometry: { type: 'MultiLineString' as const, coordinates: coords },
                properties: { color: colorOf.get(id) ?? '#8E9DAC' },
              }));
            if (features.length === 0 || cancelled) return;
            m.addSource('road-lines', { type: 'geojson', data: { type: 'FeatureCollection', features } });
            const layout = { 'line-cap': 'round' as const, 'line-join': 'round' as const };
            m.addLayer({ id: 'road-lines-case', type: 'line', source: 'road-lines', layout, paint: { 'line-color': '#FFFFFF', 'line-width': 8, 'line-opacity': 0.9 } });
            m.addLayer({ id: 'road-lines', type: 'line', source: 'road-lines', layout, paint: { 'line-color': ['get', 'color'], 'line-width': 4.5 } });
            const vis = layersRef.current.roads ? 'visible' : 'none';
            m.setLayoutProperty('road-lines', 'visibility', vis);
            m.setLayoutProperty('road-lines-case', 'visibility', vis);
            if (focus) {
              const all = features.flatMap((f) => f.geometry.coordinates.flat()) as [number, number][];
              m.fitBounds(boundsOf(all, start), { padding: 40, maxZoom: 13, duration: 0 });
            }
          } catch {
            // No lines this time.
          }
        });
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      mapRef.current = null;
      map?.remove();
    };
    // The map is built once from the data the page was loaded with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Layer switches: pins hide with CSS, lines through the map.
  useEffect(() => {
    const box = el.current;
    if (box) {
      box.classList.toggle('hide-roads', !layers.roads);
      box.classList.toggle('hide-cams', !layers.cams);
      box.classList.toggle('hide-weather', !layers.weather);
    }
    const m = mapRef.current;
    if (m && m.getLayer('road-lines')) {
      const vis = layers.roads ? 'visible' : 'none';
      m.setLayoutProperty('road-lines', 'visibility', vis);
      m.setLayoutProperty('road-lines-case', 'visibility', vis);
    }
  }, [layers]);

  const toggle = (key: keyof Layers) => setLayers((l) => ({ ...l, [key]: !l[key] }));

  return (
    <>
      {!focus && (
        <div className="chips" role="group" aria-label="Show on map">
          {(
            [
              ['roads', 'Roads'],
              ['cams', 'Cameras'],
              ['weather', 'Weather'],
            ] as const
          ).map(([key, text]) => (
            <button
              key={key}
              type="button"
              className={`chip${layers[key] ? ' chip-on' : ''}`}
              aria-pressed={layers[key]}
              onClick={() => toggle(key)}
            >
              {text}
            </button>
          ))}
        </div>
      )}
      <div className={`map-wrap${focus ? ' map-wrap-small' : ''}`}>
        <div ref={el} className="map" role="application" aria-label="Map of road conditions" />
        {failed && (
          <div className="map-failed">The map could not load on this device. The roads list has the same information.</div>
        )}
        {selected && <Panel item={selected} focus={focus} onClose={() => setSelected(null)} />}
      </div>
      {!focus && unpinnedCameras.length > 0 && (
        <div className="list">
          {unpinnedCameras.map((c) => (
            <button key={c.id} type="button" className="row row-button" onClick={() => setSelected({ kind: 'camera', camera: c })}>
              <span className="row-text">
                <span className="row-name">{c.name}</span>
                <span className="row-sub">Live camera, {c.credit}. Location kept private.</span>
              </span>
              <span className="temp">Watch</span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

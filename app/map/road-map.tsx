'use client';

import { useEffect, useRef, useState } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { MapPoint } from '@/lib/mapdata';

// Free OpenStreetMap-based map tiles from OpenFreeMap. No key needed.
const STYLE = process.env.NEXT_PUBLIC_MAP_STYLE ?? 'https://tiles.openfreemap.org/styles/liberty';
// The valley and all the roads up to it.
const DEFAULT_BOUNDS: [[number, number], [number, number]] = [
  [-117.32, 34.03],
  [-116.72, 34.48],
];

function boundsOf(points: MapPoint[]): [[number, number], [number, number]] {
  if (points.length < 2) return DEFAULT_BOUNDS;
  const lons = points.map((p) => p.lon);
  const lats = points.map((p) => p.lat);
  return [
    [Math.min(...lons), Math.min(...lats)],
    [Math.max(...lons), Math.max(...lats)],
  ];
}

function popupNode(items: Record<string, unknown>[]): HTMLElement {
  // Built with textContent so nothing from the Caltrans feed is treated as HTML.
  const root = document.createElement('div');
  root.className = 'map-popup';
  items.slice(0, 4).forEach((p) => {
    const item = document.createElement('div');
    item.className = 'map-popup-item';
    const status = document.createElement('div');
    status.className = 'map-popup-status';
    const dot = document.createElement('span');
    dot.className = 'map-dot';
    dot.style.background = String(p.color);
    status.append(dot, `${p.label} · ${p.road}`);
    const name = document.createElement('div');
    name.className = 'map-popup-name';
    name.textContent = String(p.name);
    item.append(status, name);
    if (p.description) {
      const d = document.createElement('div');
      d.className = 'map-popup-desc';
      d.textContent = String(p.description);
      item.append(d);
    }
    root.append(item);
  });
  return root;
}

export function RoadMap({ points }: { points: MapPoint[] }) {
  const el = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let map: import('maplibre-gl').Map | undefined;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    (async () => {
      try {
        const maplibregl = await import('maplibre-gl');
        if (cancelled || !el.current) return;
        // Copied into public/ by scripts/copy-map-worker.mjs before each build.
        maplibregl.setWorkerUrl('/maplibre-worker.mjs');
        const m = new maplibregl.Map({
          container: el.current,
          style: STYLE,
          bounds: boundsOf(points),
          fitBoundsOptions: { padding: 40, maxZoom: 12 },
          attributionControl: { compact: true },
        });
        map = m;
        m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
        m.addControl(
          new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: false } }),
          'top-right',
        );
        // If the background map never arrives (blocked or offline), say so.
        timer = setTimeout(() => {
          if (!cancelled && !m.isStyleLoaded()) setFailed(true);
        }, 12000);

        m.on('load', () => {
          m.addSource('cc', {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: points.map((p) => ({
                type: 'Feature' as const,
                geometry: { type: 'Point' as const, coordinates: [p.lon, p.lat] },
                properties: { ...p },
              })),
            },
          });
          m.addLayer({
            id: 'cc',
            type: 'circle',
            source: 'cc',
            layout: { 'circle-sort-key': ['get', 'rank'] },
            paint: {
              'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 7, 13, 11],
              'circle-color': ['get', 'color'],
              'circle-stroke-width': 2.5,
              'circle-stroke-color': '#FFFFFF',
            },
          });
          m.on('click', 'cc', (e) => {
            const feats = e.features ?? [];
            if (feats.length === 0) return;
            new maplibregl.Popup({ maxWidth: '280px', offset: 10 })
              .setLngLat(e.lngLat)
              .setDOMContent(popupNode(feats.map((f) => f.properties ?? {})))
              .addTo(m);
          });
          m.on('mouseenter', 'cc', () => (m.getCanvas().style.cursor = 'pointer'));
          m.on('mouseleave', 'cc', () => (m.getCanvas().style.cursor = ''));
        });
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      map?.remove();
    };
  }, [points]);

  return (
    <div className="map-wrap">
      <div ref={el} className="map" role="application" aria-label="Map of chain control points" />
      {failed && (
        <div className="map-failed">The map could not load on this device. The roads list has the same information.</div>
      )}
    </div>
  );
}

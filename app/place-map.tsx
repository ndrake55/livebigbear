'use client';

import { useEffect, useRef, useState } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';

const STYLE = process.env.NEXT_PUBLIC_MAP_STYLE ?? 'https://tiles.openfreemap.org/styles/liberty';

export interface PlacePin {
  lon: number;
  lat: number;
  label: string;
  /** Letter or short text shown in the pin. */
  text: string;
  tone?: 'good' | 'poor' | 'start';
}

/** A small map showing one place: a trail or route as a line, plus labeled pins. */
export function PlaceMap({ lines = [], pins = [], label }: { lines?: number[][][]; pins?: PlacePin[]; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let map: import('maplibre-gl').Map | undefined;
    let gone = false;
    (async () => {
      try {
        const maplibregl = await import('maplibre-gl');
        if (gone || !ref.current) return;
        maplibregl.setWorkerUrl('/maplibre-worker.mjs');
        const all: number[][] = [...lines.flat(), ...pins.map((p) => [p.lon, p.lat])];
        if (all.length === 0) throw new Error('nothing to show');
        const lons = all.map((c) => c[0]);
        const lats = all.map((c) => c[1]);
        const pad = all.length === 1 ? 0.01 : 0;
        const m = new maplibregl.Map({
          container: ref.current,
          style: STYLE,
          bounds: [
            [Math.min(...lons) - pad, Math.min(...lats) - pad],
            [Math.max(...lons) + pad, Math.max(...lats) + pad],
          ],
          fitBoundsOptions: { padding: 44, maxZoom: 14.5 },
          attributionControl: { compact: true },
          cooperativeGestures: true,
        });
        map = m;
        m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
        m.on('error', (e) => {
          if (!m.isStyleLoaded()) setFailed(true);
          console.error(e.error);
        });
        for (const p of pins) {
          const el = document.createElement('div');
          el.className = `mk mk-place mk-place-${p.tone ?? 'start'}`;
          el.setAttribute('role', 'img');
          el.setAttribute('aria-label', p.label);
          el.title = p.label;
          const dot = document.createElement('span');
          dot.className = 'pin';
          dot.textContent = p.text;
          el.append(dot);
          new maplibregl.Marker({ element: el }).setLngLat([p.lon, p.lat]).addTo(m);
        }
        m.on('load', () => {
          if (lines.length === 0) return;
          m.addSource('place-line', {
            type: 'geojson',
            data: { type: 'Feature', properties: {}, geometry: { type: 'MultiLineString', coordinates: lines } },
          });
          const layout = { 'line-cap': 'round', 'line-join': 'round' } as const;
          m.addLayer({ id: 'place-line-case', type: 'line', source: 'place-line', layout, paint: { 'line-color': '#FFFFFF', 'line-width': 7, 'line-opacity': 0.9 } });
          m.addLayer({ id: 'place-line', type: 'line', source: 'place-line', layout, paint: { 'line-color': '#C2410C', 'line-width': 4 } });
        });
      } catch (e) {
        console.error(e);
        setFailed(true);
      }
    })();
    return () => {
      gone = true;
      map?.remove();
    };
  }, [lines, pins]);

  return (
    <div className="map-wrap map-wrap-small">
      <div ref={ref} className="map near" role="application" aria-label={label} />
      {failed && <div className="map-failed">The map could not load. The details below still apply.</div>}
    </div>
  );
}

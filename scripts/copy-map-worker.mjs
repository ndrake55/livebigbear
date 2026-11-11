// The map library runs part of its work in a background worker file that must be served
// from our own site. Copy it out of the installed package before every build so it always
// matches the library version.
import { copyFileSync, mkdirSync } from 'node:fs';

mkdirSync('public', { recursive: true });
copyFileSync('node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs', 'public/maplibre-worker.mjs');
console.log('Copied map worker to public/maplibre-worker.mjs');

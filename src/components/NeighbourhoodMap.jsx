import React, { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { PROJECT, CONNECTIVITY_PLACES, TOURIST_SPOTS, TOURS, CATEGORY_META, ALL_PLACES, findPlace } from '../data/neighbourhood';

// Self-contained map for the Neighbourhood view. Same base style + terrain +
// masterplan overlay as the Home map, but instead of plots it shows the PDF's
// connectivity + tourist landmarks. Selecting a place (Connectivity OR Scenic
// Tourist Spot) plays a cinematic "moment": the camera drops onto the place, then
// flies along the real (OSRM) road route — tracing the gold path behind it — and
// arrives at the Belle Vie / Kasara plot. It can also play a ~5s tour through a
// group of places. Fully separate from Map.jsx.

const MASTERPLAN_COORDS = [
  [73.45426414958871, 19.64090642755213],
  [73.4627119222577, 19.65026986516813],
  [73.46851736082246, 19.64503214935796],
  [73.46006958815347, 19.63566871174196],
];

const TOTAL_TOUR_MS = 5000; // whole play-journey completes in ~5 seconds

// Match the Home map's initial framing so the Neighbourhood tab opens on the same site view.
// A place fly-along also settles back into exactly this view, so "arrived" looks like "home".
const HOME_CAMERA = { center: [73.462444, 19.643662], zoom: 16.42, pitch: 0, bearing: -42.2 };

const TRAVEL_PITCH = 58;   // cruising tilt while following the route (flattens to HOME's pitch on arrival)

function geoBearing(origin, dest) {
  const toRad = (d) => (d * Math.PI) / 180;
  const toDeg = (r) => (r * 180) / Math.PI;
  const lon1 = toRad(origin[0]), lat1 = toRad(origin[1]);
  const lon2 = toRad(dest[0]), lat2 = toRad(dest[1]);
  const dLon = lon2 - lon1;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

// Great-circle distance in metres between two [lng, lat] points.
function haversineM(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const la1 = toRad(a[1]), la2 = toRad(b[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Shortest-path interpolation between two compass bearings (handles 359°→1° wrap).
function lerpAngle(a, b, t) {
  const diff = ((b - a + 540) % 360) - 180;
  return (a + diff * t + 360) % 360;
}

// Point [lng, lat] at `target` metres along a route, using its cumulative-distance
// table so travel speed is constant regardless of how densely the road is sampled.
function pointAtDist(coords, cum, target) {
  if (target <= 0) return coords[0];
  const total = cum[cum.length - 1];
  if (target >= total) return coords[coords.length - 1];
  let lo = 0, hi = cum.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] < target) lo = mid + 1; else hi = mid;
  }
  const i = Math.max(1, lo);
  const segStart = cum[i - 1], segEnd = cum[i];
  const f = segEnd > segStart ? (target - segStart) / (segEnd - segStart) : 0;
  const a = coords[i - 1], b = coords[i];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
}

// Route clipped to the first `target` metres — the "trail" revealed behind the camera.
function sliceToDist(coords, cum, target) {
  if (target <= 0) return [coords[0], coords[0]];
  const total = cum[cum.length - 1];
  if (target >= total) return coords;
  const out = [coords[0]];
  for (let i = 1; i < coords.length; i++) {
    if (cum[i] <= target) { out.push(coords[i]); }
    else { out.push(pointAtDist(coords, cum, target)); break; }
  }
  return out;
}

// Smooth 0→1 ramp between edges a and b (zero velocity at both ends) — blends camera
// keyframes (zoom / pitch / bearing) without any speed discontinuity.
function smoothstep(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// Cruising zoom for a route of the given length: longer routes sit a bit higher so the
// (necessarily quick) middle stretch doesn't blur past — but kept fairly close to the
// ground per preference: ~13.6 for short hops (≤8 km) down to a ~12.0 floor for the
// ~100 km city runs (the camera stays much nearer the ground than a true overview).
function zoomForDistance(meters) {
  const km = Math.max(1, meters / 1000);
  return Math.max(12.0, Math.min(13.8, 13.6 - Math.log2(km / 8)));
}

// Even-spaced resample of a route every `step` metres (keeps the exact endpoints) — a
// prerequisite for distance-window smoothing that's independent of how OSRM sampled it.
function resamplePath(coords, cum, step) {
  const total = cum[cum.length - 1];
  if (total <= 0 || step <= 0) return coords.slice();
  const out = [];
  for (let d = 0; d < total; d += step) out.push(pointAtDist(coords, cum, d));
  out.push(coords[coords.length - 1]);
  return out;
}

// Moving-average smoothing over a ±`half`-sample window (endpoints fixed) — rounds off
// sharp road corners so the camera glides through turns instead of twitching on each one.
function movingAverage(pts, half) {
  if (pts.length <= 2 || half < 1) return pts;
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const lo = Math.max(0, i - half), hi = Math.min(pts.length - 1, i + half);
    let sx = 0, sy = 0;
    for (let j = lo; j <= hi; j++) { sx += pts[j][0]; sy += pts[j][1]; }
    const n = hi - lo + 1;
    out.push([sx / n, sy / n]);
  }
  out.push(pts[pts.length - 1]);
  return out;
}

const placeFeatures = ALL_PLACES.map((p) => ({
  type: 'Feature',
  properties: {
    id: p.id,
    name: p.name,
    category: p.category,
    color: (CATEGORY_META[p.category] && CATEGORY_META[p.category].color) || '#CE9A52',
    isProject: p.category === 'destination',
    distance: p.distance || '',
  },
  geometry: { type: 'Point', coordinates: p.coords },
}));

export default function NeighbourhoodMap({
  theme,
  mapType,
  selectedPlace,
  tour,
  tourPlayToken,
  playing,
  onTourStep,
  onTourEnd,
  onSelectPlace,
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);

  const themeRef = useRef(theme);
  const mapTypeRef = useRef(mapType);
  const selectedPlaceRef = useRef(selectedPlace);
  const tourRef = useRef(tour);
  const onTourStepRef = useRef(onTourStep);
  const onTourEndRef = useRef(onTourEnd);
  const onSelectPlaceRef = useRef(onSelectPlace);

  const tourTimerRef = useRef(null);
  const tourRunningRef = useRef(false);
  const routeAbortRef = useRef(null);
  const pendingPlayRef = useRef(false);
  const initialTokenRef = useRef(tourPlayToken);

  // Cinematic place fly-along (camera follows the road from the place to the project).
  const flyAlongRafRef = useRef(null);
  const flyAlongTimerRef = useRef(null);
  const flyAlongActiveRef = useRef(false);
  const pulseRafRef = useRef(null); // breathing-glow animation on the route halo

  useEffect(() => { themeRef.current = theme; }, [theme]);
  useEffect(() => { mapTypeRef.current = mapType; }, [mapType]);
  useEffect(() => { selectedPlaceRef.current = selectedPlace; }, [selectedPlace]);
  useEffect(() => { tourRef.current = tour; }, [tour]);
  useEffect(() => { onTourStepRef.current = onTourStep; }, [onTourStep]);
  useEffect(() => { onTourEndRef.current = onTourEnd; }, [onTourEnd]);
  useEffect(() => { onSelectPlaceRef.current = onSelectPlace; }, [onSelectPlace]);

  const getStyle = () => {
    const key = import.meta.env.VITE_MAPTILER_KEY;
    if (mapTypeRef.current === 'satellite')
      return `https://api.maptiler.com/maps/hybrid/style.json?key=${key}`;
    return `https://api.maptiler.com/maps/landscape/style.json?key=${key}`;
  };

  const cancelTour = () => {
    tourRunningRef.current = false;
    if (tourTimerRef.current) { clearTimeout(tourTimerRef.current); tourTimerRef.current = null; }
  };

  const cancelFlyAlong = () => {
    flyAlongActiveRef.current = false;
    if (flyAlongRafRef.current) { cancelAnimationFrame(flyAlongRafRef.current); flyAlongRafRef.current = null; }
    if (flyAlongTimerRef.current) { clearTimeout(flyAlongTimerRef.current); flyAlongTimerRef.current = null; }
  };

  // Continuously "breathe" the route halo (width + opacity) for a Google-Maps-like
  // pulse. Runs for the map's lifetime; the halo is invisible when no route is set,
  // and the getLayer guard keeps it safe across style swaps.
  const stopPulse = () => {
    if (pulseRafRef.current) { cancelAnimationFrame(pulseRafRef.current); pulseRafRef.current = null; }
  };
  const startPulse = (map) => {
    if (pulseRafRef.current) return;
    let t0 = null;
    const tick = (ts) => {
      if (t0 === null) t0 = ts;
      const s = 0.5 + 0.5 * Math.sin(((ts - t0) / 1000) * Math.PI * 1.3); // ~1.5s breathing cycle, 0..1
      if (map.getLayer('route-glow')) {
        map.setPaintProperty('route-glow', 'line-width', 16 + s * 14);     // 16 → 30 px
        map.setPaintProperty('route-glow', 'line-opacity', 0.18 + s * 0.34); // 0.18 → 0.52
      }
      pulseRafRef.current = requestAnimationFrame(tick);
    };
    pulseRafRef.current = requestAnimationFrame(tick);
  };

  const setRoute = (map, coords) => {
    const src = map.getSource('route');
    if (!src) return;
    if (coords && coords.length >= 2) {
      src.setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: coords } });
    } else {
      src.setData({ type: 'FeatureCollection', features: [] });
    }
  };

  // Fly to frame the origin→dest path with the path receding toward the top.
  const frameRoute = (map, origin, dest, duration) => {
    const bearing = geoBearing(origin, dest);
    try {
      const bounds = new maplibregl.LngLatBounds(
        [Math.min(origin[0], dest[0]), Math.min(origin[1], dest[1])],
        [Math.max(origin[0], dest[0]), Math.max(origin[1], dest[1])]
      );
      const cam = map.cameraForBounds(bounds, { bearing, padding: { top: 90, bottom: 130, left: 380, right: 90 }, maxZoom: 12.5 });
      if (cam && cam.center) {
        map.flyTo({ center: cam.center, zoom: cam.zoom, bearing, pitch: 55, duration, curve: 1.42, easing: (t) => t * (2 - t), essential: true });
        return;
      }
    } catch { /* fall through */ }
    map.flyTo({ center: dest, zoom: 11, bearing, pitch: 55, duration, essential: true });
  };

  // Single place selected → cinematic camera moment: drop onto the place, then fly
  // along the real (OSRM) road route and arrive at the Belle Vie / Kasara plot.
  // The route is requested place → project so the camera follows it in travel order.
  const drawSingleRoute = (map, dest) => {
    if (routeAbortRef.current) { routeAbortRef.current.abort(); routeAbortRef.current = null; }
    cancelTour();
    cancelFlyAlong();
    const project = PROJECT.coords;

    // Place co-located with the project (e.g. the Samruddhi connection point) → just
    // settle on the site; there is no route to travel.
    if (project[0] === dest[0] && project[1] === dest[1]) {
      setRoute(map, null);
      map.easeTo({ ...HOME_CAMERA, duration: 1200, essential: true });
      return;
    }

    setRoute(map, null);          // clear any prior path so the new one traces from scratch
    flyAlongActiveRef.current = true; // claim the camera for this fly-along

    // Entry: ease the camera onto the place, facing Belle Vie, AT THE CRUISE HEIGHT — so
    // once the start is shown the camera moves straight forward without rising or dipping.
    const entryBearing = geoBearing(dest, project);
    const cruiseZoom = zoomForDistance(haversineM(dest, project) * 1.3); // ~road-distance estimate → height
    map.flyTo({ center: dest, zoom: cruiseZoom, bearing: entryBearing, pitch: TRAVEL_PITCH, duration: 1500, curve: 1.4, easing: (t) => t * (2 - t), essential: true });

    // Start the traversal once BOTH the entry move has settled and the route has
    // arrived — whichever finishes last triggers it, exactly once (`started` guard).
    // The entry bearing + cruise zoom are threaded through so the fly-along begins
    // perfectly continuous — no bearing or height jump at the hand-off.
    let coordsReady = null;
    let entryDone = false;
    let started = false;
    const startIfReady = () => {
      if (started || !flyAlongActiveRef.current || !entryDone || !coordsReady) return;
      started = true;
      flyAlongRoute(map, coordsReady, entryBearing, cruiseZoom);
    };
    // Gate just past the 1500ms entry flyTo so it has fully settled before we hand off.
    flyAlongTimerRef.current = setTimeout(() => { entryDone = true; startIfReady(); }, 1600);

    const controller = new AbortController();
    routeAbortRef.current = controller;
    const url = `https://router.project-osrm.org/route/v1/driving/${dest[0]},${dest[1]};${project[0]},${project[1]}?overview=full&geometries=geojson`;
    fetch(url, { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => {
        if (controller.signal.aborted) return;
        let line = data.routes && data.routes[0] && data.routes[0].geometry && data.routes[0].geometry.coordinates;
        if (!line || line.length < 2) line = [dest, project]; // straight-line fallback if OSRM returns no usable route
        // OSRM snaps the endpoints to the nearest road; stitch the exact place + project
        // back on so the drawn line spans marker → marker with no gap before Belle Vie.
        if (haversineM(line[0], dest) > 2) line = [dest, ...line];
        if (haversineM(line[line.length - 1], project) > 2) line = [...line, project];
        coordsReady = line;
        startIfReady();
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        coordsReady = [dest, project]; // straight-line fallback
        startIfReady();
      });
  };

  // Animate the camera along an ordered route (coords[0] = place, last = project),
  // tracing the gold path behind it, then settle on the Belle Vie site on arrival.
  // `startBearing` is the entry bearing, so the first frame is bearing-continuous.
  const flyAlongRoute = (map, coords, startBearing, cruiseZoom) => {
    if (!flyAlongActiveRef.current) return;
    if (!coords || coords.length < 2) { setRoute(map, coords); flyAlongActiveRef.current = false; return; }

    // Cumulative metres along the real route → drives the blue line reveal at constant speed.
    const cum = [0];
    for (let i = 1; i < coords.length; i++) cum[i] = cum[i - 1] + haversineM(coords[i - 1], coords[i]);
    const total = cum[cum.length - 1];
    if (total <= 0) { setRoute(map, coords); flyAlongActiveRef.current = false; return; }

    // Separate, SMOOTHED path just for the camera: resample evenly, then average over a
    // distance window so sharp corners are rounded off. The camera follows this glassy
    // path (no twitch) while the drawn blue line still traces the real road exactly.
    const step = Math.max(40, total / 400);
    const camPts = movingAverage(resamplePath(coords, cum, step), 6);
    const camCum = [0];
    for (let i = 1; i < camPts.length; i++) camCum[i] = camCum[i - 1] + haversineM(camPts[i - 1], camPts[i]);
    const camTotal = camCum[camCum.length - 1] || total;

    const dest = coords[coords.length - 1]; // destination (Belle Vie) — the camera faces this the whole way
    const km = total / 1000;
    const durMs = Math.min(8000, Math.max(4000, 2800 + km * 55)); // ~4s short hops → ~8s for the far city runs, never rushed
    const revealStep = total / 240;                            // throttle line redraws during the (zoomed-out) cruise
    const TURN_TAU = 600;                                      // heading low-pass (ms) — mostly smooths the launch transient now
    let smoothBearing = startBearing;                          // low-pass-filtered heading, seeded from the entry bearing
    let lastReveal = -Infinity;
    let startTs = null;
    let prevTs = null;
    // Slow-fast-slow distance profile: gentle launch from the place, gentle arrival at the plot.
    const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

    const frame = (ts) => {
      if (!flyAlongActiveRef.current) return;
      if (startTs === null) startTs = ts;
      const dt = prevTs === null ? 16 : Math.min(64, ts - prevTs); // clamp so a dropped frame can't snap the camera
      prevTs = ts;
      const t = Math.min(1, (ts - startTs) / durMs);
      const p = easeInOut(t);

      // Position comes from the SMOOTHED path (no translational zigzag through switchbacks).
      const camAlong = p * camTotal;
      const pos = pointAtDist(camPts, camCum, camAlong);

      // Heading faces the DESTINATION, not the road's local tangent — the key anti-twitch
      // move. The angle from a moving point to a fixed target changes only slowly and
      // monotonically, so winding / switchback-heavy roads no longer swing the camera
      // left and right at all. (Hold the heading once we're basically on top of it.)
      const target = haversineM(pos, dest) < 150 ? smoothBearing : geoBearing(pos, dest);
      smoothBearing = lerpAngle(smoothBearing, target, 1 - Math.exp(-dt / TURN_TAU));

      // Height holds at the cruise zoom (set at entry) the whole way — NO rise after the
      // start — and only zooms IN onto the plot at the very end. Pitch flattens on that descent.
      const zIn = smoothstep(0.62, 1.0, t);
      const zoom = cruiseZoom + (HOME_CAMERA.zoom - cruiseZoom) * zIn;
      const pitch = TRAVEL_PITCH + (HOME_CAMERA.pitch - TRAVEL_PITCH) * zIn;
      const bearing = lerpAngle(smoothBearing, HOME_CAMERA.bearing, smoothstep(0.72, 1.0, t));
      // Ease onto the masterplan centre only in the final moments.
      const c = smoothstep(0.85, 1.0, t);
      const center = [pos[0] + (HOME_CAMERA.center[0] - pos[0]) * c, pos[1] + (HOME_CAMERA.center[1] - pos[1]) * c];

      map.jumpTo({ center, bearing, pitch, zoom });

      // Reveal the real route line up to the same journey fraction. During the zoomed-in
      // descent (t > 0.6) redraw EVERY frame so the line reaches Belle Vie smoothly with no
      // gap; during the zoomed-out cruise the coarse throttle is invisible and cheaper.
      const along = p * total;
      if (along - lastReveal >= revealStep || t > 0.6) {
        setRoute(map, sliceToDist(coords, cum, along));
        lastReveal = along;
      }
      if (t < 1) {
        flyAlongRafRef.current = requestAnimationFrame(frame);
      } else {
        // The final frame already rests at HOME_CAMERA — just settle cleanly (no extra move).
        flyAlongActiveRef.current = false;
        flyAlongRafRef.current = null;
        setRoute(map, coords); // full path stays drawn after arrival
      }
    };
    flyAlongRafRef.current = requestAnimationFrame(frame);
  };

  // Play a ~5s cinematic tour through a group of places (project → each).
  const runTour = () => {
    const map = mapRef.current;
    const t = tourRef.current;
    if (!map || !t || !TOURS[t]) return;
    if (routeAbortRef.current) { routeAbortRef.current.abort(); routeAbortRef.current = null; }
    cancelTour();
    cancelFlyAlong();
    const places = TOURS[t].places;
    if (!places.length) return;
    tourRunningRef.current = true;
    const origin = PROJECT.coords;
    const legMs = Math.max(450, Math.round(TOTAL_TOUR_MS / places.length));
    let i = 0;
    const step = () => {
      if (!tourRunningRef.current) return;
      if (i >= places.length) {
        tourRunningRef.current = false;
        if (onTourEndRef.current) onTourEndRef.current();
        return;
      }
      const place = places[i];
      if (onTourStepRef.current) onTourStepRef.current(i);
      setRoute(map, [origin, place.coords]);
      frameRoute(map, origin, place.coords, legMs);
      i++;
      tourTimerRef.current = setTimeout(step, legMs);
    };
    step();
  };

  const applyLayers = (map) => {
    const key = import.meta.env.VITE_MAPTILER_KEY;

    if (!map.getSource('terrain')) {
      map.addSource('terrain', { type: 'raster-dem', url: `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=${key}`, tileSize: 256 });
    }
    map.setTerrain({ source: 'terrain', exaggeration: 1.6 });

    if (!map.getSource('masterplan')) {
      map.addSource('masterplan', { type: 'image', url: '/data/layer-1-masterplan.png', coordinates: MASTERPLAN_COORDS });
    }
    if (!map.getLayer('masterplan-layer')) {
      map.addLayer({ id: 'masterplan-layer', type: 'raster', source: 'masterplan', paint: { 'raster-opacity': 0.9 } });
    }

    // Route line — Google-Maps-style blue: a pulsing halo (bottom), a dark-blue casing
    // for definition, and a bright blue core on top. The halo's width/opacity are
    // animated by the pulse loop (startPulse) for a "live" breathing effect.
    if (!map.getSource('route')) {
      map.addSource('route', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    }
    if (!map.getLayer('route-glow')) {
      map.addLayer({ id: 'route-glow', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#4DA3FF', 'line-width': 18, 'line-opacity': 0.28, 'line-blur': 6 } });
    }
    if (!map.getLayer('route-casing')) {
      map.addLayer({ id: 'route-casing', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#0B3D91', 'line-width': 12, 'line-opacity': 0.9 } });
    }
    if (!map.getLayer('route-core')) {
      map.addLayer({ id: 'route-core', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#1A73E8', 'line-width': 7, 'line-opacity': 1 } });
    }

    // Landmark markers (drawn above the route).
    if (!map.getSource('places')) {
      map.addSource('places', { type: 'geojson', data: { type: 'FeatureCollection', features: placeFeatures } });
    }
    if (!map.getLayer('places-halo')) {
      map.addLayer({ id: 'places-halo', type: 'circle', source: 'places', filter: ['==', ['get', 'isProject'], true], paint: { 'circle-radius': 20, 'circle-color': '#CE9A52', 'circle-opacity': 0.18 } });
    }
    if (!map.getLayer('places-circle')) {
      map.addLayer({
        id: 'places-circle', type: 'circle', source: 'places',
        paint: {
          'circle-radius': ['case', ['get', 'isProject'], 11, 7],
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.95,
          'circle-stroke-color': '#FFFFFF',
          'circle-stroke-width': ['case', ['get', 'isProject'], 3, 1.5],
        },
      });
    }
    if (!map.getLayer('places-label')) {
      map.addLayer({
        id: 'places-label', type: 'symbol', source: 'places',
        layout: { 'text-field': ['get', 'name'], 'text-size': ['case', ['get', 'isProject'], 13, 11], 'text-offset': [0, 1.4], 'text-anchor': 'top', 'text-allow-overlap': false },
        paint: { 'text-color': '#FFFFFF', 'text-halo-color': '#000000', 'text-halo-width': 1.4 },
      });
    }
  };

  // Init map once
  useEffect(() => {
    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: getStyle(),
      center: HOME_CAMERA.center,
      zoom: HOME_CAMERA.zoom,
      pitch: HOME_CAMERA.pitch,
      bearing: HOME_CAMERA.bearing,
      maxPitch: 85,
      antialias: true,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'bottom-right');

    const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 12, className: 'mbpop' });

    map.on('load', () => {
      applyLayers(map);
      mapRef.current = map;
      startPulse(map); // begin the route halo's breathing pulse
      // Replay any selection/play requested before the style finished loading.
      if (pendingPlayRef.current) {
        pendingPlayRef.current = false;
        runTour();
      } else if (selectedPlaceRef.current) {
        const pl = findPlace(selectedPlaceRef.current);
        if (pl) drawSingleRoute(map, pl.coords);
      }

      const updateCursor = (c) => (map.getCanvas().style.cursor = c);
      map.on('mouseenter', 'places-circle', (e) => {
        updateCursor('pointer');
        const f = e.features && e.features[0];
        if (!f) return;
        const meta = CATEGORY_META[f.properties.category];
        popup.setLngLat(f.geometry.coordinates).setHTML(
          `<div style="font-family:'Inter',sans-serif;padding:4px 2px;min-width:130px">
             <div style="font-family:'Playfair Display',serif;font-size:14px;font-weight:700;color:#CE9A52">${f.properties.name}</div>
             <div style="font-size:10px;letter-spacing:0.08em;text-transform:uppercase;color:#999;margin-top:2px">${meta ? meta.label : ''}${f.properties.distance ? ' · ' + f.properties.distance : ''}</div>
           </div>`
        ).addTo(map);
      });
      map.on('mouseleave', 'places-circle', () => { updateCursor(''); popup.remove(); });
      map.on('click', 'places-circle', (e) => {
        const f = e.features && e.features[0];
        if (!f) return;
        if (onSelectPlaceRef.current) onSelectPlaceRef.current(f.properties.id);
      });
    });

    map.on('style.load', () => {
      if (!mapRef.current) return;
      applyLayers(mapRef.current);
    });

    return () => {
      cancelTour();
      cancelFlyAlong();
      stopPulse();
      if (routeAbortRef.current) { routeAbortRef.current.abort(); routeAbortRef.current = null; }
      if (onTourEndRef.current) onTourEndRef.current(); // reset play state on leave
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Theme / map-type change → swap base style (layers re-added on style.load).
  // A style swap tears down + rebuilds all sources (incl. 'route'), so stop any
  // in-flight fly-along first — otherwise it keeps driving a vanished route source.
  useEffect(() => {
    if (mapRef.current) {
      cancelFlyAlong();
      mapRef.current.setStyle(getStyle());
    }
  }, [theme, mapType]);

  // Stop pressed (playing → false) → halt the tour + clear a deferred play.
  // cancelFlyAlong() is defensive: a single-place fly-along never runs while
  // `playing` is true, so this won't clobber an active place selection.
  useEffect(() => {
    if (!playing) {
      pendingPlayRef.current = false;
      cancelTour();
      cancelFlyAlong();
    }
  }, [playing]);

  // Selected place → draw its path + frame it; cleared → clear path + return home
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    if (selectedPlace) {
      const place = findPlace(selectedPlace);
      if (place) drawSingleRoute(map, place.coords);
    } else if (!playing && !tourRunningRef.current) {
      // User deselected (not a tour starting) → stop any fly-along, clear path + ease home
      if (routeAbortRef.current) { routeAbortRef.current.abort(); routeAbortRef.current = null; }
      cancelFlyAlong();
      setRoute(map, null);
      map.easeTo({ ...HOME_CAMERA, duration: 1200 });
    }
  }, [selectedPlace]);

  // Play token increments → run the ~5s tour (deferred to load if style not ready)
  useEffect(() => {
    if (tourPlayToken === initialTokenRef.current) return;
    if (!mapRef.current || !mapRef.current.isStyleLoaded()) {
      pendingPlayRef.current = true;
      return;
    }
    runTour();
  }, [tourPlayToken]);

  return (
    <div id="nmap-wrap">
      <div id="nmap-label" className="headline">Location Advantages · Kasara</div>
      <div id="nmap" ref={mapContainerRef}></div>
      <style>{`
        #nmap-wrap { flex: 1; position: relative; background: var(--bg-secondary); }
        #nmap { width: 100%; height: 100%; }
        #nmap-label { position: absolute; top: 24px; left: 24px; z-index: 10; background: var(--glass-bg); backdrop-filter: blur(8px); border: 1px solid var(--brand-gold); padding: 8px 16px; font-size: 10px; letter-spacing: 0.2em; color: var(--brand-gold); }
      `}</style>
    </div>
  );
}

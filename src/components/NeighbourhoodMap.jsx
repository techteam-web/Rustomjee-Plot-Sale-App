import React, { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { PROJECT, CONNECTIVITY_PLACES, TOURIST_SPOTS, TOURS, CATEGORY_META, ALL_PLACES, findPlace, ROUTE_WAYPOINTS } from '../data/neighbourhood';
import { responsiveMapZoom } from '../utils';
import { prefersReducedMotion } from '../lib/Gsapconfig';

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
// The camera flies a Catmull-Rom spline through this many control points sampled along the
// route. FEWER = smoother / more arc-like (cuts corners); MORE = hugs the road. 8 ≈ sweet spot.
const CAM_CTRL_POINTS = 8;

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

// Tiny duotone-ish glyphs for journey waypoint cards (gold stroke via CSS currentColor).
const WAYPOINT_GLYPH = {
  toll:     '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="8" width="5" height="12" rx="0.6"/><path d="M9 11h11M9 15h11"/><path d="M20 11v9"/></svg>',
  tunnel:   '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21V12a9 9 0 0 1 18 0v9"/><path d="M9 21v-8a3 3 0 0 1 6 0v8"/></svg>',
  bridge:   '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8v9M21 8v9"/><path d="M3 13h18"/><path d="M3 13c5-6 13-6 18 0"/></svg>',
  landmark: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11Z"/><circle cx="12" cy="10" r="2.2"/></svg>',
};

// Reveal curve for a waypoint as journey progress `p` passes its position `wpP`:
// hidden before → fades in to full right as the line reaches it → settles to a dim
// "passed" state (lightly visible, never gone). Matches the approved spec.
function waypointOpacity(p, wpP) {
  if (p < wpP) return 0;
  const FADE_IN = 0.06; // ramp 0→1 as the line reaches it
  const SETTLE = 0.16;  // then ease 1→0.5 once clearly passed
  if (p < wpP + FADE_IN) return (p - wpP) / FADE_IN;
  const k = Math.min(1, (p - wpP - FADE_IN) / SETTLE);
  return 1 - 0.5 * k;
}

// Snap a real [lng, lat] onto the route polyline → its progress (0–1 along the line).
// Dependency-free equivalent of turf.nearestPointOnLine + turf.length: projects the point
// onto each segment in a local equirectangular frame (accurate at these distances) and
// returns the cumulative along-line distance of the nearest projection / total length.
// Use: ROUTE_WAYPOINTS could later store [lng,lat] and we'd derive `progress` via this.
function progressForCoord(pt, coords, cum) {
  const total = cum[cum.length - 1];
  if (!total) return 0;
  const kx = Math.cos((pt[1] * Math.PI) / 180); // lng→x scale at this latitude
  const px = pt[0] * kx, py = pt[1];
  let best = { d2: Infinity, dist: 0 };
  for (let i = 1; i < coords.length; i++) {
    const ax = coords[i - 1][0] * kx, ay = coords[i - 1][1];
    const bx = coords[i][0] * kx, by = coords[i][1];
    const dx = bx - ax, dy = by - ay;
    const seg2 = dx * dx + dy * dy;
    let f = seg2 ? ((px - ax) * dx + (py - ay) * dy) / seg2 : 0;
    f = Math.max(0, Math.min(1, f));
    const cx = ax + dx * f, cy = ay + dy * f;
    const d2 = (px - cx) ** 2 + (py - cy) ** 2;
    if (d2 < best.d2) best = { d2, dist: cum[i - 1] + (cum[i] - cum[i - 1]) * f };
  }
  return best.dist / total;
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

// Sample `n` points spaced evenly by distance along a route (endpoints exactly included).
function sampleEven(coords, cum, n) {
  const total = cum[cum.length - 1];
  const out = [];
  for (let i = 0; i < n; i++) out.push(pointAtDist(coords, cum, (i / (n - 1)) * total));
  return out;
}

// Centripetal Catmull-Rom spline through the control points → one smooth, C1-continuous
// curve that passes through every control point with NO overshoot or cusps (the centripetal
// parameterisation is what prevents the curve from looping outside sharp turns). Reflected
// phantom endpoints make the first/last segments well-defined. This is the camera's travel
// path: it follows the route's macro shape but carries none of the road's local jitter.
function catmullRom(ctrl, samplesPerSeg) {
  const n = ctrl.length;
  if (n < 3) return ctrl.slice();
  const c0 = [2 * ctrl[0][0] - ctrl[1][0], 2 * ctrl[0][1] - ctrl[1][1]];
  const cN = [2 * ctrl[n - 1][0] - ctrl[n - 2][0], 2 * ctrl[n - 1][1] - ctrl[n - 2][1]];
  const cp = [c0, ...ctrl, cN];
  const d = (a, b) => Math.max(1e-6, Math.sqrt(Math.hypot(b[0] - a[0], b[1] - a[1]))); // alpha = 0.5
  const lerp = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
  const out = [];
  for (let i = 1; i < cp.length - 2; i++) {
    const p0 = cp[i - 1], p1 = cp[i], p2 = cp[i + 1], p3 = cp[i + 2];
    const t0 = 0, t1 = t0 + d(p0, p1), t2 = t1 + d(p1, p2), t3 = t2 + d(p2, p3);
    for (let s = 0; s < samplesPerSeg; s++) {
      const t = t1 + (s / samplesPerSeg) * (t2 - t1);
      const A1 = lerp(p0, p1, (t - t0) / (t1 - t0));
      const A2 = lerp(p1, p2, (t - t1) / (t2 - t1));
      const A3 = lerp(p2, p3, (t - t2) / (t3 - t2));
      const B1 = lerp(A1, A2, (t - t0) / (t2 - t0));
      const B2 = lerp(A2, A3, (t - t1) / (t3 - t1));
      out.push(lerp(B1, B2, (t - t1) / (t2 - t1)));
    }
  }
  out.push(ctrl[n - 1]); // exact final endpoint (Belle Vie)
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
  const homeZoomRef = useRef(HOME_CAMERA.zoom); // responsive home zoom (recomputed for the current map width)

  const themeRef = useRef(theme);
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
  const waypointMarkersRef = useRef([]); // DOM marker cards for journey waypoints (tunnel/toll/bridge/landmark)
  const waypointDefsRef = useRef([]);    // pending waypoint defs — built only once the travel (line-progress) phase starts

  useEffect(() => { themeRef.current = theme; }, [theme]);
  useEffect(() => { selectedPlaceRef.current = selectedPlace; }, [selectedPlace]);
  useEffect(() => { tourRef.current = tour; }, [tour]);
  useEffect(() => { onTourStepRef.current = onTourStep; }, [onTourStep]);
  useEffect(() => { onTourEndRef.current = onTourEnd; }, [onTourEnd]);
  useEffect(() => { onSelectPlaceRef.current = onSelectPlace; }, [onSelectPlace]);

  const getStyle = () => {
    const key = import.meta.env.VITE_MAPTILER_KEY;
    // Satellite-only (this view was always satellite; raster removed project-wide).
    return `https://api.maptiler.com/maps/hybrid/style.json?key=${key}`;
  };

  const cancelTour = () => {
    tourRunningRef.current = false;
    if (tourTimerRef.current) { clearTimeout(tourTimerRef.current); tourTimerRef.current = null; }
  };

  // Remove all journey-waypoint DOM cards + empty their dot source. Called whenever a
  // journey is replaced/cancelled (NOT on natural arrival — there they persist, dimmed).
  const clearWaypoints = () => {
    waypointMarkersRef.current.forEach((w) => { if (w.marker) w.marker.remove(); });
    waypointMarkersRef.current = [];
    waypointDefsRef.current = [];
    const map = mapRef.current;
    const src = map && map.getSource && map.getSource('journey-waypoints');
    if (src) src.setData({ type: 'FeatureCollection', features: [] });
  };

  const cancelFlyAlong = () => {
    flyAlongActiveRef.current = false;
    clearWaypoints();
    if (flyAlongRafRef.current) { cancelAnimationFrame(flyAlongRafRef.current); flyAlongRafRef.current = null; }
    if (flyAlongTimerRef.current) { clearTimeout(flyAlongTimerRef.current); flyAlongTimerRef.current = null; }
    // Re-clamp the camera centre to the terrain. During a fly-along we unclamp it and drive our own
    // smoothed elevation (so 3D terrain doesn't bob the camera); restore normal clamping on any exit.
    const map = mapRef.current;
    if (map && map.getCenterClampedToGround && !map.getCenterClampedToGround()) map.setCenterClampedToGround(true);
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

  // Push current opacities to the dot source + DOM cards, given journey progress `p`.
  // Throttled: only writes (setData + DOM) when an opacity actually moves, so steady states
  // (all-hidden / settled-dim) cost nothing per frame — keeps the camera animation smooth.
  const updateWaypoints = (map, p) => {
    const list = waypointMarkersRef.current;
    if (!list.length) return;
    let changed = false;
    const features = list.map((w) => {
      const o = waypointOpacity(p, w.progress);
      if (w.lastO === undefined || Math.abs(o - w.lastO) > 0.012) {
        w.lastO = o;
        if (w.el) w.el.style.opacity = String(o);
        changed = true;
      }
      return { type: 'Feature', properties: { opacity: w.lastO }, geometry: { type: 'Point', coordinates: w.coord } };
    });
    if (!changed) return;
    const src = map.getSource('journey-waypoints');
    if (src) src.setData({ type: 'FeatureCollection', features });
  };

  // Reduced-motion / static fallback: every waypoint fully visible at once (no timed reveal).
  const revealAllWaypoints = (map) => {
    const list = waypointMarkersRef.current;
    const features = list.map((w) => {
      w.lastO = 1;
      if (w.el) w.el.style.opacity = '1';
      return { type: 'Feature', properties: { opacity: 1 }, geometry: { type: 'Point', coordinates: w.coord } };
    });
    const src = map.getSource('journey-waypoints');
    if (src) src.setData({ type: 'FeatureCollection', features });
  };

  // When a route lands, position each waypoint on the real polyline (pointAtDist at
  // progress·total), compute "km to site" remaining, and create its glass DOM card (hidden
  // until the reveal). prefers-reduced-motion → show them all immediately, statically.
  const buildWaypoints = (map, camData, defs) => {
    if (!defs || !defs.length) return;
    const { coords, cum, total } = camData;
    const list = defs.map((w, idx) => {
      // Each waypoint is positioned by `progress` (fraction along route). If a real [lng,lat]
      // `coord` is supplied instead, snap it onto the polyline to derive its progress.
      const progress = w.progress != null ? w.progress : progressForCoord(w.coord, coords, cum);
      const dist = progress * total;
      const coord = pointAtDist(coords, cum, dist);
      const remainingKm = ((total - dist) / 1000).toFixed(1);
      const el = document.createElement('div');
      el.className = 'nwp-card';
      el.style.opacity = prefersReducedMotion ? '1' : '0';
      el.innerHTML =
        `<span class="nwp-glyph">${WAYPOINT_GLYPH[w.type] || WAYPOINT_GLYPH.landmark}</span>` +
        `<span class="nwp-text"><span class="nwp-name">${w.name}</span>` +
        `<span class="nwp-dist">${remainingKm} km to site</span></span>`;
      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom', offset: [0, -10] }).setLngLat(coord).addTo(map);
      return { id: `${idx}-${w.name}`, name: w.name, type: w.type, progress, coord, remainingKm, el, marker };
    });
    waypointMarkersRef.current = list;
    if (prefersReducedMotion) revealAllWaypoints(map);
    else updateWaypoints(map, 0); // all hidden initially
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

  // Build the camera-path data (spline + distance tables + duration) from a route line.
  const buildCamData = (coords) => {
    const cum = [0];
    for (let i = 1; i < coords.length; i++) cum[i] = cum[i - 1] + haversineM(coords[i - 1], coords[i]);
    const total = cum[cum.length - 1];
    if (total <= 0) return null;
    const ctrl = sampleEven(coords, cum, CAM_CTRL_POINTS);
    // End the camera path ON the masterplan (home centre) so the camera glides to the final
    // framing as the natural end of ONE curve — no sideways pan at arrival. The blue line
    // still ends at the real project marker.
    ctrl[ctrl.length - 1] = [HOME_CAMERA.center[0], HOME_CAMERA.center[1]];
    const camPts = catmullRom(ctrl, 28);
    const camCum = [0];
    for (let i = 1; i < camPts.length; i++) camCum[i] = camCum[i - 1] + haversineM(camPts[i - 1], camPts[i]);
    const camTotal = camCum[camCum.length - 1] || total;
    // Unhurried travel along the route (slower = smoother): ~9s for short hops up to ~13s for the
    // long city runs. (~2km≈9.0s, ~50km≈9.0s, ~75km≈10.0s, ~100km≈12.0s, ≥113km=13.0s.) Easing unchanged.
    const durMs = Math.min(15000, Math.max(14000, 12000 + (total / 1000) * 50));
    return { coords, cum, total, camPts, camCum, camTotal, durMs, dest: coords[coords.length - 1] };
  };

  // Single place selected → ONE continuous cinematic move (entry → travel → arrival) run as
  // a single rAF, with NO separate flyTo — so there is never a hand-off snap. See flyAlongRoute.
  const drawSingleRoute = (map, dest, waypointDefs = []) => {
    if (routeAbortRef.current) { routeAbortRef.current.abort(); routeAbortRef.current = null; }
    cancelTour();
    cancelFlyAlong(); // also clears any prior waypoint cards
    const project = PROJECT.coords;

    // Place co-located with the project (e.g. the Samruddhi connection point) → just settle.
    if (project[0] === dest[0] && project[1] === dest[1]) {
      setRoute(map, null);
      map.easeTo({ ...HOME_CAMERA, zoom: homeZoomRef.current, duration: 1200, essential: true });
      return;
    }

    setRoute(map, null);
    flyAlongActiveRef.current = true;
    waypointDefsRef.current = waypointDefs; // built later, only when the travel phase begins

    const entryBearing = geoBearing(dest, project);
    const cruiseZoom = zoomForDistance(haversineM(dest, project) * 1.3);
    // Snapshot the camera's CURRENT state — the entry animates out of exactly this, in-loop.
    // Capture the centre elevation while it's still terrain-clamped, then UNCLAMP so the loop can
    // drive its own smoothed elevation each frame: the 3D terrain stays at full exaggeration but no
    // longer bobs the camera over the ghats (we follow a low-passed ground height instead). See flyAlongRoute.
    const from = { c: map.getCenter().toArray(), z: map.getZoom(), b: map.getBearing(), pi: map.getPitch(), el: map.getCenterElevation() };
    map.setCenterClampedToGround(false);

    // Fetch the route; build the camera-path data when it lands (the entry plays meanwhile).
    let camData = null;
    const controller = new AbortController();
    routeAbortRef.current = controller;
    const url = `https://router.project-osrm.org/route/v1/driving/${dest[0]},${dest[1]};${project[0]},${project[1]}?overview=full&geometries=geojson`;
    fetch(url, { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => {
        if (controller.signal.aborted) return;
        let line = data.routes && data.routes[0] && data.routes[0].geometry && data.routes[0].geometry.coordinates;
        if (!line || line.length < 2) line = [dest, project];
        if (haversineM(line[0], dest) > 2) line = [dest, ...line];                    // stitch exact place
        if (haversineM(line[line.length - 1], project) > 2) line = [...line, project]; // stitch exact project
        camData = buildCamData(line);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        camData = buildCamData([dest, project]);
      });

    flyAlongRoute(map, dest, from, entryBearing, cruiseZoom, () => camData);
  };

  // The whole cinematic move as ONE rAF loop: entry (fly from `from` onto the place) →
  // travel (follow the spline) → arrival (settle on the plot). Every frame is one jumpTo we
  // control, so the entry ends EXACTLY at the travel's first frame and the travel ends
  // EXACTLY at the home framing — no hand-off between camera systems anywhere, hence no snap.
  const flyAlongRoute = (map, dest, from, entryBearing, cruiseZoom, getCamData) => {
    if (!flyAlongActiveRef.current) return;
    // Smooth, unhurried fly-in from the plot out to the place: ≥3s (farther places a little longer,
    // up to 5s). Also gives the OSRM route ample time to land before travel starts → no freeze-snap.
    const ENTRY_MS = Math.min(5000, Math.max(3000, 2400 + haversineM(from.c, dest) / 50));
    const ARRIVE = 0.6, TURN_TAU = 600, ELEV_TAU = 600;
    const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
    // Zoom-out arc depth for the fly-in: farther entries pull out more so they don't blur past.
    const entryDip = Math.min(5, Math.max(0, Math.log2(Math.max(1, haversineM(from.c, dest) / 2000))));

    let phase = 'entry';
    let entryStart = null, travelStart = null, prevTs = null, lastReveal = -Infinity;
    let cruiseHeading = entryBearing;
    // Smoothed centre-elevation (metres ASL, on the exaggerated scale — same as queryTerrainElevation).
    // Seeded at the camera's current clamped height so frame 1 doesn't jump; each frame it eases toward
    // the terrain under the camera, so we glide over bumps (no bob) while the terrain stays fully 3D.
    // Held at its last value when a DEM tile isn't loaded yet (far routes), so it can never snap.
    let elevCtrl = from.el;

    const loop = (ts) => {
      if (!flyAlongActiveRef.current) return;
      const dt = prevTs === null ? 16 : Math.min(64, ts - prevTs); // clamp so a dropped frame can't snap the camera
      prevTs = ts;

      if (phase === 'entry') {
        if (entryStart === null) entryStart = ts;
        const e = smoothstep(0, ENTRY_MS, ts - entryStart); // gentle (peak 1.5×) so the fly-in tilt/rotate isn't aggressive
        // From the camera's real state → (place, cruiseZoom, entryBearing, TRAVEL_PITCH), with
        // a gentle zoom-out arc. Ends EXACTLY where travel begins, so the transition is seamless.
        const center = [from.c[0] + (dest[0] - from.c[0]) * e, from.c[1] + (dest[1] - from.c[1]) * e];
        const zoom = (from.z + (cruiseZoom - from.z) * e) - entryDip * Math.sin(Math.PI * e);
        const bearing = lerpAngle(from.b, entryBearing, e);
        const pitch = from.pi + (TRAVEL_PITCH - from.pi) * e;
        const rawE = map.queryTerrainElevation(center);
        if (rawE != null) elevCtrl += (rawE - elevCtrl) * (1 - Math.exp(-dt / ELEV_TAU));
        map.jumpTo({ center, zoom, bearing, pitch, elevation: elevCtrl });
        if (e >= 1 && getCamData()) {
          phase = 'travel';
          // Build waypoint cards ONLY now — as the line-progress journey starts, never during the fly-in.
          if (!waypointMarkersRef.current.length) buildWaypoints(map, getCamData(), waypointDefsRef.current);
        }
        flyAlongRafRef.current = requestAnimationFrame(loop);
        return;
      }

      // ---- travel + arrival ----
      if (travelStart === null) travelStart = ts;
      const { coords, cum, total, camPts, camCum, camTotal, durMs, dest: routeDest } = getCamData();
      const t = Math.min(1, (ts - travelStart) / durMs);
      const p = easeInOut(t);
      const pos = pointAtDist(camPts, camCum, p * camTotal);

      // Heading faces the destination during the cruise (no per-curve twitch), then the arrival
      // blend `a` settles it onto the home bearing. CRUCIAL fix for the intermittent end-jerk:
      // FULLY freeze the destination-chase early in the arrival (chaseFade → 0 by ARRIVE+0.18),
      // *before* the camera passes near the project where geoBearing(pos, project) swings wildly.
      // So the heading never tracks that swing — it just rotates cleanly to home. The fade is
      // smoothstepped (C1, no hitch) and the final bearing is exactly home at a = 1.
      const a = smoothstep(ARRIVE, 1.0, t);
      const chaseFade = 1 - smoothstep(ARRIVE, ARRIVE + 0.18, t);
      cruiseHeading = lerpAngle(cruiseHeading, geoBearing(pos, routeDest), (1 - Math.exp(-dt / TURN_TAU)) * chaseFade);
      const bearing = lerpAngle(cruiseHeading, HOME_CAMERA.bearing, a);
      const zoom = cruiseZoom + (homeZoomRef.current - cruiseZoom) * a;
      const pitch = TRAVEL_PITCH + (HOME_CAMERA.pitch - TRAVEL_PITCH) * a;
      const rawE = map.queryTerrainElevation(pos);
      if (rawE != null) elevCtrl += (rawE - elevCtrl) * (1 - Math.exp(-dt / ELEV_TAU));
      map.jumpTo({ center: pos, bearing, pitch, zoom, elevation: elevCtrl });

      // Reveal the real route line up to the same journey fraction (every frame on the
      // zoomed-in descent so it reaches Belle Vie with no gap).
      const along = p * total;
      if (along - lastReveal >= total / 240 || t > 0.6) {
        setRoute(map, sliceToDist(coords, cum, along));
        lastReveal = along;
      }
      // Progress-driven waypoint reveal (skipped under reduced motion — those show statically).
      if (!prefersReducedMotion && waypointMarkersRef.current.length) updateWaypoints(map, p);
      if (t < 1) {
        flyAlongRafRef.current = requestAnimationFrame(loop);
      } else {
        flyAlongActiveRef.current = false;
        flyAlongRafRef.current = null;
        setRoute(map, coords); // full path stays drawn after arrival
        map.setCenterClampedToGround(true); // re-clamp centre to terrain (top-down at pitch 0 → invisible)
      }
    };
    flyAlongRafRef.current = requestAnimationFrame(loop);
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

    // Journey-waypoint dots (sits ON TOP of the frozen route/marker/label layers; data-driven
    // per-feature `opacity` is updated each frame by updateWaypoints during the fly-along).
    // The matching labels are glass DOM-marker cards (see buildWaypoints). Empty until a journey.
    if (!map.getSource('journey-waypoints')) {
      map.addSource('journey-waypoints', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    }
    if (!map.getLayer('journey-waypoint-dot')) {
      map.addLayer({
        id: 'journey-waypoint-dot', type: 'circle', source: 'journey-waypoints',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 3, 14, 5, 17, 6.5],
          'circle-color': '#CE9A52',
          'circle-opacity': ['get', 'opacity'],
          'circle-stroke-color': '#FFFFFF',
          'circle-stroke-width': 1.5,
          'circle-stroke-opacity': ['get', 'opacity'],
        },
      });
    }
  };

  // Init map once
  useEffect(() => {
    // Responsive home zoom for the current map width (zooms out on smaller screens).
    homeZoomRef.current = responsiveMapZoom(HOME_CAMERA.zoom, mapContainerRef.current?.clientWidth || window.innerWidth);
    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: getStyle(),
      center: HOME_CAMERA.center,
      zoom: homeZoomRef.current,
      pitch: HOME_CAMERA.pitch,
      bearing: HOME_CAMERA.bearing,
      maxPitch: 85,
      antialias: true,
      attributionControl: false, // re-added below at bottom-left
    });
    // Map chrome lives bottom-LEFT so the bottom-right corner stays free for the
    // global Brainwing credit mark (see BrandCredit.jsx). MapLibre prepends controls
    // in bottom corners, so adding attribution first leaves it below the nav buttons.
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');
    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'bottom-left');

    // MapLibre renders the compact attribution EXPANDED and only collapses it on the
    // first drag, which on a narrow canvas wraps to three lines and climbs into the
    // bottom-centre hint. Collapse it up front so it rests as a single (i) button;
    // tapping it still expands the full credits. (`maplibregl-compact-show` is only
    // re-added by MapLibre before the `maplibregl-compact` class exists, so this sticks.)
    const collapseAttribution = () => {
      map.getContainer()
        .querySelectorAll('.maplibregl-ctrl-attrib.maplibregl-compact-show')
        .forEach((el) => el.classList.remove('maplibregl-compact-show'));
    };
    map.once('load', collapseAttribution);
    map.once('idle', collapseAttribution);

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
        if (pl) drawSingleRoute(map, pl.coords, ROUTE_WAYPOINTS[pl.id] || []);
      }

      const updateCursor = (c) => (map.getCanvas().style.cursor = c);
      map.on('mouseenter', 'places-circle', (e) => {
        updateCursor('pointer');
        const f = e.features && e.features[0];
        if (!f) return;
        const meta = CATEGORY_META[f.properties.category];
        const titleColor = themeRef.current === 'dark' ? '#9FCAD6' : '#1A3A4A';
        popup.setLngLat(f.geometry.coordinates).setHTML(
          `<div style="font-family:'Inter',sans-serif;padding:4px 2px;min-width:130px">
             <div style="font-family:'Cormorant Garamond',serif;font-size:14px;font-weight:500;color:${titleColor}">${f.properties.name}</div>
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

    // Responsive: re-fit the canvas and recompute home zoom on viewport resize;
    // when idle (settled at home) ease to the new zoom so the site stays framed.
    let resizeRaf = null;
    const handleResize = () => {
      if (resizeRaf) cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(() => {
        if (!mapRef.current) return;
        mapRef.current.resize();
        homeZoomRef.current = responsiveMapZoom(HOME_CAMERA.zoom, mapContainerRef.current?.clientWidth || window.innerWidth);
        const idle = !selectedPlaceRef.current && !tourRunningRef.current && !flyAlongActiveRef.current && !pendingPlayRef.current;
        if (idle) mapRef.current.easeTo({ zoom: homeZoomRef.current, duration: 350 });
      });
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelTour();
      cancelFlyAlong();
      stopPulse();
      window.removeEventListener('resize', handleResize);
      if (resizeRaf) cancelAnimationFrame(resizeRaf);
      if (routeAbortRef.current) { routeAbortRef.current.abort(); routeAbortRef.current = null; }
      if (onTourEndRef.current) onTourEndRef.current(); // reset play state on leave
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // (Theme/map-type style-swap effect removed — satellite-only, and this view's layers
  // don't read theme. The hover popup reads themeRef live; no setStyle needed.)

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
      if (place) drawSingleRoute(map, place.coords, ROUTE_WAYPOINTS[place.id] || []);
    } else if (!playing && !tourRunningRef.current) {
      // User deselected (not a tour starting) → stop any fly-along, clear path + ease home
      if (routeAbortRef.current) { routeAbortRef.current.abort(); routeAbortRef.current = null; }
      cancelFlyAlong(); // also re-clamps the centre to terrain if the journey was interrupted mid-flight
      setRoute(map, null);
      map.easeTo({ ...HOME_CAMERA, zoom: homeZoomRef.current, duration: 1200 });
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
        /* Reserve the bottom-right corner lane for the Brainwing credit mark:
           the expanded attribution wraps instead of growing into it. */
        #nmap-wrap .maplibregl-ctrl-bottom-left { max-width: calc(100% - 220px); }
        @media (max-width: 1024px) { #nmap-wrap .maplibregl-ctrl-bottom-left { max-width: calc(100% - 175px); } }
        /* Landscape phones: the map is only a ~150px band between the header and the
           bottom sheet, so the zoom stack would climb into the corner label. Drop it
           there — pinch-to-zoom covers it on those devices. Attribution stays. */
        @media (max-width: 1024px) and (max-height: 500px) { #nmap-wrap .maplibregl-ctrl-group { display: none; } }
        #nmap-label { position: absolute; top: 24px; left: 24px; z-index: 10; background: var(--glass-bg); backdrop-filter: blur(8px); border: 1px solid var(--brand-gold); padding: 8px 16px; font-size: 10px; letter-spacing: 0.2em; color: var(--brand-gold); }
        /* Journey waypoint cards — glass / hairline / gold accent, Sora. Colours come from the
           theme CSS variables (--glass-bg / --text-primary / --brand-gold) so they follow the
           current light or dark theme automatically. Opacity is driven per-frame by the reveal. */
        .nwp-card { display: flex; align-items: center; gap: 7px; padding: 5px 9px; font-family: 'Sora', 'Inter', sans-serif; background: var(--glass-bg); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border: 1px solid var(--brand-gold); border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.28); white-space: nowrap; pointer-events: none; will-change: opacity; }
        .nwp-glyph { color: var(--brand-gold); display: flex; align-items: center; }
        .nwp-text { display: flex; flex-direction: column; line-height: 1.2; }
        .nwp-name { font-size: 11px; font-weight: 600; color: var(--text-primary); letter-spacing: 0.01em; }
        .nwp-dist { font-size: 9px; font-weight: 500; color: var(--brand-gold); letter-spacing: 0.03em; }
      `}</style>
    </div>
  );
}

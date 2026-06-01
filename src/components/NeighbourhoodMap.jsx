import React, { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { PROJECT, CONNECTIVITY_PLACES, TOURIST_SPOTS, TOURS, CATEGORY_META, ALL_PLACES, findPlace } from '../data/neighbourhood';

// Self-contained map for the Neighbourhood view. Same base style + terrain +
// masterplan overlay as the Home map, but instead of plots it shows the PDF's
// connectivity + tourist landmarks, draws a real road path from the project to a
// selected place (with a camera move, like the Home connectivity), and can play a
// ~5-second cinematic tour through a group of places. Fully separate from Map.jsx.

const MASTERPLAN_COORDS = [
  [73.45426414958871, 19.64090642755213],
  [73.4627119222577, 19.65026986516813],
  [73.46851736082246, 19.64503214935796],
  [73.46006958815347, 19.63566871174196],
];

const TOTAL_TOUR_MS = 5000; // whole play-journey completes in ~5 seconds

// Match the Home map's initial framing so the Neighbourhood tab opens on the same site view.
const HOME_CAMERA = { center: [73.462444, 19.643662], zoom: 16.42, pitch: 0, bearing: -42.2 };

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

  // Single place selected → draw the real (OSRM) road path from the project + frame it.
  const drawSingleRoute = (map, dest) => {
    if (routeAbortRef.current) { routeAbortRef.current.abort(); routeAbortRef.current = null; }
    cancelTour();
    const origin = PROJECT.coords;
    frameRoute(map, origin, dest, 1800);
    if (origin[0] === dest[0] && origin[1] === dest[1]) { setRoute(map, [origin, dest]); return; }
    const controller = new AbortController();
    routeAbortRef.current = controller;
    const url = `https://router.project-osrm.org/route/v1/driving/${origin[0]},${origin[1]};${dest[0]},${dest[1]}?overview=full&geometries=geojson`;
    fetch(url, { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => {
        if (controller.signal.aborted) return;
        if (data.routes && data.routes[0]) setRoute(map, data.routes[0].geometry.coordinates);
        else setRoute(map, [origin, dest]);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setRoute(map, [origin, dest]); // straight-line fallback
      });
  };

  // Play a ~5s cinematic tour through a group of places (project → each).
  const runTour = () => {
    const map = mapRef.current;
    const t = tourRef.current;
    if (!map || !t || !TOURS[t]) return;
    if (routeAbortRef.current) { routeAbortRef.current.abort(); routeAbortRef.current = null; }
    cancelTour();
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

    // Premium route line: dark casing + soft gold glow + crisp gold core (no dashes).
    if (!map.getSource('route')) {
      map.addSource('route', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    }
    if (!map.getLayer('route-casing')) {
      map.addLayer({ id: 'route-casing', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#1A1207', 'line-width': 9, 'line-opacity': 0.5, 'line-blur': 1.5 } });
    }
    if (!map.getLayer('route-glow')) {
      map.addLayer({ id: 'route-glow', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#FFD27A', 'line-width': 11, 'line-opacity': 0.28, 'line-blur': 3.5 } });
    }
    if (!map.getLayer('route-core')) {
      map.addLayer({ id: 'route-core', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#FFCD4B', 'line-width': 3.5, 'line-opacity': 0.98 } });
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
      if (routeAbortRef.current) { routeAbortRef.current.abort(); routeAbortRef.current = null; }
      if (onTourEndRef.current) onTourEndRef.current(); // reset play state on leave
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Theme / map-type change → swap base style (layers re-added on style.load)
  useEffect(() => {
    if (mapRef.current) mapRef.current.setStyle(getStyle());
  }, [theme, mapType]);

  // Stop pressed (playing → false) → halt the tour + clear a deferred play
  useEffect(() => {
    if (!playing) {
      pendingPlayRef.current = false;
      cancelTour();
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
      // User deselected (not a tour starting) → clear path + ease back to the project
      if (routeAbortRef.current) { routeAbortRef.current.abort(); routeAbortRef.current = null; }
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

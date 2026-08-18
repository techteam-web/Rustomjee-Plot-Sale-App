import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { formatCurrency, getAmenitiesWithDistance, responsiveMapZoom } from '../utils';
import amenitiesData from '../data/amenities.json';
import { CONNECTIVITY, KAASA_CENTER } from '../data/connectivity';

// Home framing tuned for a large (2k/4xl) screen; responsiveMapZoom() scales it
// down on smaller viewports so the whole estate stays in view.
const HOME_BASE_ZOOM = 16.42;
// Plot-detail framing, also tuned for a large screen and scaled down responsively
// so selecting a plot on a narrow map doesn't bury the camera in the ground.
const PLOT_BASE_ZOOM = 18.2;

// Initial great-circle bearing from origin to dest, degrees CW from north (0..360).
// origin and dest are [lng, lat] in degrees. Assigned directly to MapLibre's
// camera `bearing` so the destination direction ends up toward the TOP of screen.
function geoBearing(origin, dest) {
  const toRad = (d) => (d * Math.PI) / 180;
  const toDeg = (r) => (r * 180) / Math.PI;
  const lon1 = toRad(origin[0]), lat1 = toRad(origin[1]);
  const lon2 = toRad(dest[0]),   lat2 = toRad(dest[1]);
  const dLon = lon2 - lon1;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) -
            Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360; // normalized 0..360
}

export default function Map({ plots, activePlot, onPlotClick, viewMode, theme, selectedConnectivity, activeZone }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const themeRef = useRef(theme);
  const viewModeRef = useRef(viewMode);
  const selectedConnectivityRef = useRef(selectedConnectivity);
  const activeZoneRef = useRef(activeZone);
  const styleReadyRef = useRef(false); // true after the first style.load; gates one-time camera setup
  const pendingCamRef = useRef(null);  // camera captured before a style swap, restored after it loads
  const rotationAnimationRef = useRef(null);
  const stopRotationRef = useRef(null);
  const startRotationRef = useRef(null);
  const resetIdleTimerRef = useRef(null);
  const activePlotRef = useRef(activePlot);
  const plotsRef = useRef(plots);
  const onPlotClickRef = useRef(onPlotClick);
  const idleTimeoutRef = useRef(null);
  const isAnimatingConnectivityRef = useRef(false);
  const connectivityAbortRef = useRef(null);
  const homeCameraRef = useRef({ center: [73.462444, 19.643662], zoom: HOME_BASE_ZOOM, pitch: 0, bearing: -42.2 });
  const [isRotating, setIsRotating] = useState(true);

  useEffect(() => {
    activePlotRef.current = activePlot;
  }, [activePlot]);

  useEffect(() => { plotsRef.current = plots; }, [plots]);
  useEffect(() => { onPlotClickRef.current = onPlotClick; }, [onPlotClick]);

  useEffect(() => { themeRef.current = theme; }, [theme]);
  useEffect(() => { viewModeRef.current = viewMode; }, [viewMode]);
  useEffect(() => { selectedConnectivityRef.current = selectedConnectivity; }, [selectedConnectivity]);
  useEffect(() => { activeZoneRef.current = activeZone; }, [activeZone]);

  const getStyle = () => {
    const key = import.meta.env.VITE_MAPTILER_KEY;
    // Satellite-only: the raster (landscape) style + Map View toggle were removed.
    return `https://api.maptiler.com/maps/hybrid/style.json?key=${key}`;
  };

  const mkGeo = (coords) => ({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [coords] } });

  const applyMapLayers = (map) => {
    const key = import.meta.env.VITE_MAPTILER_KEY;

    // 1. Terrain
    if (!map.getSource('terrain')) {
      map.addSource('terrain', {
        type: 'raster-dem',
        url: `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=${key}`,
        tileSize: 256,
      });
    }
    map.setTerrain({ source: 'terrain', exaggeration: 1.8 });
    // Removed hillshade layer — terrain 3D exaggeration provides depth without color overlay

    // Layer 1.png Masterplan Overlay (with 47.94° rotation applied)
    if (!map.getSource('masterplan')) {
      map.addSource('masterplan', {
        type: 'image',
        url: '/data/layer-1-masterplan.png',
        coordinates: [
          [73.45426414958871, 19.64090642755213], // NW (rotated)
          [73.4627119222577, 19.65026986516813],  // NE (rotated)
          [73.46851736082246, 19.64503214935796], // SE (rotated)
          [73.46006958815347, 19.63566871174196]  // SW (rotated)
        ]
      });
      console.log('Masterplan source added with rotation');
    }
    if (!map.getLayer('masterplan-layer')) {
      map.addLayer({
        id: 'masterplan-layer',
        type: 'raster',
        source: 'masterplan',
        paint: { 'raster-opacity': 0.9 }
      });
      console.log('Masterplan layer added');
    }

    // Plots circle layer (from GeoJSON with static status property)
    // Clustering: nearby plots group into bubbles below clusterMaxZoom; the
    // individual-plot layers below filter to unclustered leaves (!point_count)
    // so the existing click/hover/highlight wiring keeps working unchanged.
    if (!map.getSource('plots')) {
      map.addSource('plots', {
        type: 'geojson',
        data: '/data/plots.geojson',
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 45,
      });
    }
    if (!map.getLayer('plots-circle')) {
      map.addLayer({
        id: 'plots-circle', type: 'circle', source: 'plots',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 2.5, 15, 4.5, 16, 7, 17, 10, 18, 13, 19, 16, 20, 19],
          'circle-color': ['case',
            ['==', ['get', 'category'], 'saleable'], ['case',
              ['==', ['get', 'status'], 'sold'], '#9A8E78',
              ['==', ['get', 'status'], 'reserved'], '#B58A4A',
              '#4E6B45'
            ],
            ['in', ['get', 'category'], ['literal', ['park', 'garden', 'playground']]], '#6E8A5A',
            ['==', ['get', 'category'], 'clubhouse'], '#B89B6B',
            '#8A8170',
          ],
          'circle-stroke-color': '#FFFFFF',
          'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 14, 1, 18, 1.75, 20, 2.25],
          'circle-opacity': 1,
          'circle-stroke-opacity': 1,
        }
      });
    }

    // Amenities source and layer
    if (!map.getSource('amenities')) {
      const amenityFeatures = amenitiesData.map(a => ({
        type: 'Feature',
        properties: { id: a.id, name: a.name, category: a.category },
        geometry: { type: 'Point', coordinates: [a.longitude, a.latitude] }
      }));
      map.addSource('amenities', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: amenityFeatures }
      });
    }
    if (!map.getLayer('amenities-circle')) {
      map.addLayer({
        id: 'amenities-circle',
        type: 'circle',
        source: 'amenities',
        paint: {
          'circle-radius': 5,
          'circle-color': '#CE9A52',
          'circle-opacity': 0.6,
          'circle-stroke-color': '#FFFFFF',
          'circle-stroke-width': 1
        }
      }, 'plots-circle');
    }
    if (!map.getLayer('plots-glow')) {
      map.addLayer({
        id: 'plots-glow', type: 'circle', source: 'plots',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 6, 16, 10, 18, 16],
          'circle-color': '#FFFFFF',
          'circle-opacity': 0,
          'circle-stroke-color': '#FFFFFF',
          'circle-stroke-width': 0,
        }
      });
    }
    // Two white ring layers that pulse outward from the selected plot, phase-offset
    // by half a cycle for a continuous heartbeat. Added on top of plots-circle (no
    // beforeId) so the rings are never occluded by neighbouring dots; the number
    // labels are added after this, so they still sit above the rings. Filter +
    // animation are driven from the highlight effect; idle = no-match filter.
    ['plots-pulse', 'plots-pulse-2'].forEach((id) => {
      if (!map.getLayer(id)) {
        map.addLayer({
          id, type: 'circle', source: 'plots',
          filter: ['==', ['get', 'name'], '__none__'],
          paint: {
            'circle-radius': 6,
            'circle-color': 'rgba(255,255,255,0)', // ring only — no fill
            'circle-opacity': 0,
            'circle-stroke-color': '#FFFFFF',
            'circle-stroke-width': 3,
            'circle-stroke-opacity': 0,
          }
        });
      }
    });

    // Connectivity line layer (actual road routing)
    if (!map.getSource('connectivity')) {
      map.addSource('connectivity', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });
    }
    if (!map.getLayer('connectivity-line-shadow')) {
      map.addLayer({
        id: 'connectivity-line-shadow', type: 'line', source: 'connectivity',
        paint: {
          'line-color': '#000000',
          'line-width': 10,
          'line-opacity': 0.4
        }
      }, 'plots-circle');
    }
    if (!map.getLayer('connectivity-line')) {
      map.addLayer({
        id: 'connectivity-line', type: 'line', source: 'connectivity',
        layout: {
          'line-cap': 'round',
          'line-join': 'round'
        },
        paint: {
          'line-color': '#FFD700',
          'line-width': 6,
          'line-opacity': 1.0
        }
      }, 'plots-circle');
    }
    if (!map.getLayer('plots-label')) {
      map.addLayer({
        id: 'plots-label', type: 'symbol', source: 'plots',
        minzoom: 16,
        filter: ['all', ['==', ['get', 'category'], 'saleable'], ['!', ['has', 'point_count']]],
        layout: {
          'text-field': ['to-string', ['get', 'plotNo']],
          'text-size': ['interpolate', ['linear'], ['zoom'], 16, 10, 18, 12.5, 20, 14.5],
          'text-anchor': 'center',
          'text-offset': [0, 0],
          'text-allow-overlap': false,
          'text-ignore-placement': false,
          'text-optional': true,
        },
        paint: { 'text-color': '#FFFFFF', 'text-halo-color': 'rgba(14,16,13,0.9)', 'text-halo-width': 1.6 },
      });
    }
    // Highlight label for the SELECTED plot — allow-overlap so its number never hides in a
    // dense field. Filter is driven from activePlot in the highlight effect (sentinel = no match).
    if (!map.getLayer('plots-label-active')) {
      map.addLayer({
        id: 'plots-label-active', type: 'symbol', source: 'plots',
        minzoom: 16,
        filter: ['all', ['==', ['get', 'category'], 'saleable'], ['!', ['has', 'point_count']], ['==', ['get', 'name'], '__none__']],
        layout: {
          'text-field': ['to-string', ['get', 'plotNo']],
          'text-size': ['interpolate', ['linear'], ['zoom'], 16, 10, 18, 12.5, 20, 14.5],
          'text-anchor': 'center',
          'text-offset': [0, 0],
          'text-allow-overlap': true,
          'text-ignore-placement': true,
        },
        paint: { 'text-color': '#FFFFFF', 'text-halo-color': 'rgba(14,16,13,0.9)', 'text-halo-width': 1.6 },
      });
    }

    // Cluster bubbles (only render aggregated points — those carrying point_count).
    // Added last so they sit on top of the individual plot dots for visibility.
    if (!map.getLayer('clusters')) {
      map.addLayer({
        id: 'clusters', type: 'circle', source: 'plots',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': ['step', ['get', 'point_count'], '#CE9A52', 10, '#C4883E', 30, '#B4782E'],
          'circle-radius': ['step', ['get', 'point_count'], 16, 10, 22, 30, 28],
          'circle-opacity': 0.9,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#FFFFFF',
        },
      });
    }
    if (!map.getLayer('cluster-count')) {
      map.addLayer({
        id: 'cluster-count', type: 'symbol', source: 'plots',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-size': 12,
        },
        paint: { 'text-color': '#000000' },
      });
    }
  };

  useEffect(() => {
    // Responsive home zoom for the current map width (zooms out on smaller screens).
    const homeZoom = responsiveMapZoom(HOME_BASE_ZOOM, mapContainerRef.current?.clientWidth || window.innerWidth);
    homeCameraRef.current.zoom = homeZoom;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: getStyle(),
      center: [73.462444, 19.643662],
      zoom: homeZoom,
      pitch: 0,
      bearing: -42.2,
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

    // Camera capture feature - Press 'C' to log current camera state
    const handleCameraCapture = (e) => {
      if (e.key.toLowerCase() === 'c' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const center = map.getCenter();
        const cameraState = {
          center: [center.lng, center.lat],
          zoom: map.getZoom(),
          pitch: map.getPitch(),
          bearing: map.getBearing()
        };
        console.log('📸 Camera State Captured:');
        console.log(JSON.stringify(cameraState, null, 2));
        alert(`Camera captured! Check console.\n\ncenter: [${center.lng.toFixed(6)}, ${center.lat.toFixed(6)}]\nzoom: ${map.getZoom().toFixed(2)}\npitch: ${map.getPitch().toFixed(1)}\nbearing: ${map.getBearing().toFixed(1)}`);
      }
    };
    window.addEventListener('keydown', handleCameraCapture);

    // Smooth, subtle camera rotation with smart idle detection & auto-return
    const initialCenter = [73.462444, 19.643662];
    let isReturning = false;

    const startRotation = () => {
      if (rotationAnimationRef.current) return;
      if (activePlotRef.current) return; // Don't rotate if a plot is selected
      if (isAnimatingConnectivityRef.current) return; // Don't rotate during connectivity view
      setIsRotating(true);
      const rotate = () => {
        const currentBearing = map.getBearing();
        map.setBearing(currentBearing + 0.03);
        rotationAnimationRef.current = requestAnimationFrame(rotate);
      };
      rotationAnimationRef.current = requestAnimationFrame(rotate);
    };

    const stopRotation = () => {
      if (rotationAnimationRef.current) {
        cancelAnimationFrame(rotationAnimationRef.current);
        rotationAnimationRef.current = null;
      }
      setIsRotating(false);
    };

    const returnToCenter = () => {
      isReturning = true;
      stopRotation();
      const currentCenter = map.getCenter();
      const startLng = currentCenter.lng;
      const startLat = currentCenter.lat;

      import('gsap').then(({ default: gsap }) => {
        gsap.to({ lng: startLng, lat: startLat }, {
          lng: initialCenter[0],
          lat: initialCenter[1],
          duration: 10,
          ease: 'power1.inOut',
          onUpdate: function() {
            map.setCenter([this.targets()[0].lng, this.targets()[0].lat]);
          },
          onComplete: () => {
            isReturning = false;
            if (!activePlotRef.current) {
              startRotation();
            }
          }
        });
      });
    };

    const resetIdleTimer = () => {
      // Don't reset idle timer or rotation if a plot is selected or connectivity is active
      if (activePlotRef.current) return;
      if (isAnimatingConnectivityRef.current) return;

      stopRotation();
      if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
      isReturning = false;
      idleTimeoutRef.current = setTimeout(() => {
        returnToCenter();
      }, 10000);
    };

    // Store functions in refs for external access
    stopRotationRef.current = stopRotation;
    startRotationRef.current = startRotation;
    resetIdleTimerRef.current = resetIdleTimer;

    const handleUserActivity = () => {
      resetIdleTimer();
      setIsRotating(false);
    };

    // Only allow idle timer reset if no plot is selected
    const handleUserActivitySafe = () => {
      if (!activePlotRef.current) {
        handleUserActivity();
      }
    };

    mapContainerRef.current?.addEventListener('mousedown', handleUserActivitySafe);
    mapContainerRef.current?.addEventListener('touchstart', handleUserActivitySafe);
    mapContainerRef.current?.addEventListener('wheel', handleUserActivitySafe);

    // Keep the framing responsive: on viewport resize, re-fit the canvas and
    // recompute the home zoom. While idle (rotating at home) snap to the new
    // zoom so the whole estate stays framed on any screen.
    let resizeRaf = null;
    const handleResize = () => {
      if (resizeRaf) cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(() => {
        map.resize();
        const z = responsiveMapZoom(HOME_BASE_ZOOM, mapContainerRef.current?.clientWidth || window.innerWidth);
        homeCameraRef.current.zoom = z;
        const idle = !activePlotRef.current &&
          (selectedConnectivityRef.current === null || selectedConnectivityRef.current === undefined) &&
          !isAnimatingConnectivityRef.current;
        if (idle) map.setZoom(z);
      });
    };
    window.addEventListener('resize', handleResize);

    map.on('load', () => {
      applyMapLayers(map);
      startRotation();

      // Single global click handler — queries what is under the cursor.
      // This avoids any race between layer-specific and global click handlers.
      const handleMapClick = (e) => {
        // Find any plot feature (circle or label) under the click point
        const hits = map.queryRenderedFeatures(e.point, {
          layers: ['plots-circle', 'plots-label']
        });

        const currentPlots = plotsRef.current;
        const fire = onPlotClickRef.current;

        if (hits && hits.length > 0) {
          // A plot was clicked — resolve it to a processed plot object
          const props = hits[0].properties;
          let p = props.name ? currentPlots.find(x => x.name === props.name) : null;
          if (!p && (props.plotNo !== undefined && props.plotNo !== null)) {
            p = currentPlots.find(x => x.name === `Plot ${props.plotNo}`);
          }
          if (p) {
            // Toggle: clicking the same plot again deselects it
            if (activePlotRef.current === p.name) {
              fire(null);
            } else {
              fire(p);
            }
          }
        } else {
          // Clicked empty map area — deselect if a plot is active
          if (activePlotRef.current) {
            fire(null);
          }
        }
      };

      map.on('click', handleMapClick);

      const updateCursor = (cursor) => map.getCanvas().style.cursor = cursor;
      map.on('mouseenter', 'plots-circle', () => updateCursor('pointer'));
      map.on('mouseleave', 'plots-circle', () => updateCursor(''));
      map.on('mouseenter', 'plots-label', () => updateCursor('pointer'));
      map.on('mouseleave', 'plots-label', () => updateCursor(''));

      // Cluster: click a bubble to zoom in until it expands into individual plots
      map.on('click', 'clusters', (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
        if (!features.length) return;
        const clusterId = features[0].properties.cluster_id;
        const src = map.getSource('plots');
        if (!src || !src.getClusterExpansionZoom) return;
        // maplibre-gl v5: getClusterExpansionZoom is Promise-based (no callback form)
        src.getClusterExpansionZoom(clusterId)
          .then((zoom) => {
            map.easeTo({ center: features[0].geometry.coordinates, zoom: zoom + 0.5, duration: 600 });
          })
          .catch(() => {});
      });
      map.on('mouseenter', 'clusters', () => updateCursor('pointer'));
      map.on('mouseleave', 'clusters', () => updateCursor(''));

      const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 10, className: 'mbpop' });

      const handleMouseMove = (e) => {
        const p = plots.find(x => x.name === e.features[0].properties.name);
        if (!p) return;
        const currentTheme = themeRef.current;
        const stColor = p.status === 'available' ? '#2E4A57' : p.status === 'reserved' ? '#93A691' : '#B3AA9E';
        const titleColor = currentTheme === 'dark' ? '#9FCAD6' : '#1A3A4A';
        const txtPrimary = currentTheme === 'dark' ? '#FFFFFF' : '#000000';
        const txtSecondary = currentTheme === 'dark' ? '#DAD4C6' : '#444444';

        popup.setLngLat(e.lngLat).setHTML(`
          <div style="font-family:'Inter',sans-serif;padding:6px 2px;min-width:180px;line-height:1.4;">
            <div style="font-family:'Cormorant Garamond',serif;font-size:16px;font-weight:500;color:${titleColor};margin-bottom:2px">${p.name}</div>
            <div style="font-size:11px;color:${txtSecondary};letter-spacing:0.05em;margin-bottom:6px">${p.area_sqft.toLocaleString()} SQFT · ${p.cat}</div>
            <div style="font-size:14px;color:${txtPrimary};font-weight:500;margin-bottom:10px">${formatCurrency(p.pr.total)}</div>
            <div style="font-size:10px;letter-spacing:0.15em;text-transform:uppercase;color:${stColor};font-weight:500;border-top:1px solid ${currentTheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'};padding-top:8px">${p.status}</div>
          </div>`).addTo(map);
      };

      const handleMouseLeave = () => popup.remove();

      map.on('mousemove', 'plots-circle', handleMouseMove);
      map.on('mouseleave', 'plots-circle', handleMouseLeave);

      mapRef.current = map;
    });

    map.on('style.load', () => {
      if (mapRef.current) {
        const m = mapRef.current;
        applyMapLayers(m);
        // A style swap (theme / map-type change) rebuilds all layers with their
        // default paint, wiping any active zone dimming. Restore it from the ref.
        const zone = activeZoneRef.current;
        if (m.getLayer('plots-circle')) {
          if (zone && zone.plotSet) {
            const names = [...zone.plotSet];
            m.setPaintProperty('plots-circle', 'circle-opacity',
              ['case', ['in', ['get', 'name'], ['literal', names]], 0.9, 0.12]);
          } else {
            m.setPaintProperty('plots-circle', 'circle-opacity', 1);
          }
        }
        if (pendingCamRef.current) {
          // A style swap (Satellite⇄Raster / theme): restore the EXACT camera the
          // user was looking at before the swap, so the two modes stay in sync.
          m.jumpTo(pendingCamRef.current);
          pendingCamRef.current = null;
        } else if (!styleReadyRef.current) {
          // First load only: establish the initial 3D pose.
          styleReadyRef.current = true;
          if (viewModeRef.current === '3D') {
            m.setPitch(60);
            m.setBearing(-15);
          }
        }
      }
    });

    const container = mapContainerRef.current;
    return () => {
      if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
      if (rotationAnimationRef.current) cancelAnimationFrame(rotationAnimationRef.current);
      window.removeEventListener('keydown', handleCameraCapture);
      window.removeEventListener('resize', handleResize);
      if (resizeRaf) cancelAnimationFrame(resizeRaf);
      container?.removeEventListener('mousedown', handleUserActivitySafe);
      container?.removeEventListener('touchstart', handleUserActivitySafe);
      container?.removeEventListener('wheel', handleUserActivitySafe);
      map.remove();
    };
  }, []);

  // (Theme/Map-type style-swap effect removed — satellite-only, and the plot markers no
  // longer read theme, so no setStyle is needed. The hover popup reads themeRef live instead.)

  // Handle plot selection: camera movement, highlights, and interaction control
  useEffect(() => {
    if (!mapRef.current) return;

    if (activePlot) {
      // Plot selected: COMPLETELY stop rotation and auto-return
      if (stopRotationRef.current) stopRotationRef.current();
      if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
      if (rotationAnimationRef.current) cancelAnimationFrame(rotationAnimationRef.current);
      rotationAnimationRef.current = null;

      // Find the plot and zoom to it with optimal camera positioning.
      // Scale the zoom to the map's current width so it frames the plot the same
      // on a narrow map as on a wide one (avoids the over-zoomed close-up on small screens).
      const selectedPlot = plots.find(p => p.name === activePlot);
      if (selectedPlot && mapRef.current) {
        const z = responsiveMapZoom(PLOT_BASE_ZOOM, mapContainerRef.current?.clientWidth || window.innerWidth);
        mapRef.current.flyTo({
          center: selectedPlot.center,
          zoom: z,
          duration: 1200,
          pitch: 45,
          bearing: -35,
          speed: 1.2
        });
      }
    } else {
      // Plot deselected: return to center and resume rotation.
      // Skip if a connectivity view is taking over the camera (its flyTo owns it).
      const connActive =
        (selectedConnectivityRef.current !== null && selectedConnectivityRef.current !== undefined) ||
        isAnimatingConnectivityRef.current;
      if (mapRef.current && idleTimeoutRef.current === null && !connActive) {
        import('gsap').then(({ default: gsap }) => {
          const currentCenter = mapRef.current.getCenter();
          gsap.to({ lng: currentCenter.lng, lat: currentCenter.lat }, {
            lng: 73.462444,
            lat: 19.643662,
            duration: 10,
            ease: 'power1.inOut',
            onUpdate: function() {
              if (mapRef.current && !activePlotRef.current && !isAnimatingConnectivityRef.current) {
                mapRef.current.setCenter([this.targets()[0].lng, this.targets()[0].lat]);
              }
            },
            onComplete: () => {
              if (mapRef.current && !activePlotRef.current && !isAnimatingConnectivityRef.current && startRotationRef.current) {
                startRotationRef.current();
              }
            }
          });
        });
      }
    }
  }, [activePlot, plots]);

  // Update highlights and visual states.
  // NOTE: the "markers" are MapLibre WebGL layers, not DOM elements — so the selected
  // highlight system (dim others / invert selected to white+gold / pulse rings) is
  // expressed as paint on plots-circle + the label/pulse layers, all keyed off the
  // existing activePlot. No map-init / clustering / camera code is touched here.
  useEffect(() => {
    if (!mapRef.current || !mapRef.current.isStyleLoaded()) return;
    const map = mapRef.current;

    const isSel = ['==', ['get', 'name'], activePlot || '__none__'];
    const SEL_SCALE = 1.45; // selected dot scale, on top of the zoom baseline

    // Existing per-status fill — UNCHANGED for non-selected plots; only the selected
    // plot is overridden to white below. (Data-only expression — no zoom — so valid.)
    const baseColor = ['case',
      ['==', ['get', 'category'], 'saleable'], ['case',
        ['==', ['get', 'status'], 'sold'], '#9A8E78',
        ['==', ['get', 'status'], 'reserved'], '#B58A4A',
        '#4E6B45'
      ],
      ['in', ['get', 'category'], ['literal', ['park', 'garden', 'playground']]], '#6E8A5A',
      ['==', ['get', 'category'], 'clubhouse'], '#B89B6B',
      '#8A8170',
    ];

    // Zoom→size baselines (match the plots-circle paint). MapLibre allows only ONE
    // top-level zoom interpolate per expression, so per-feature selection is folded into
    // the interpolate's stop OUTPUTS (a composite expression) — never a zoom curve wrapped
    // inside ['case', …], which throws.
    const RADIUS_STOPS = [[13, 2.5], [15, 4.5], [16, 7], [17, 10], [18, 13], [19, 16], [20, 19]];
    const STROKE_STOPS = [[14, 1], [18, 1.75], [20, 2.25]];
    const composite = (stops, selFn, otherFn) => {
      const expr = ['interpolate', ['linear'], ['zoom']];
      stops.forEach(([z, v]) => { expr.push(z, ['case', isSel, selFn(v), otherFn(v)]); });
      return expr;
    };

    // Smooth the paint changes like CSS transitions (GL paint transitions). plots-circle
    // ONLY — never the pulse layers, whose radius/opacity are driven per frame.
    map.setPaintProperty('plots-circle', 'circle-radius-transition', { duration: 300 });
    map.setPaintProperty('plots-circle', 'circle-color-transition', { duration: 250 });
    map.setPaintProperty('plots-circle', 'circle-stroke-color-transition', { duration: 250 });
    map.setPaintProperty('plots-circle', 'circle-opacity-transition', { duration: 350 });
    map.setPaintProperty('plots-circle', 'circle-stroke-opacity-transition', { duration: 350 });

    // --- Layer 2: selected plot inverts to a white fill + gold ring, scaled 1.45x. ---
    map.setPaintProperty('plots-circle', 'circle-radius',
      composite(RADIUS_STOPS, (r) => r * SEL_SCALE, (r) => r));
    map.setPaintProperty('plots-circle', 'circle-color', ['case', isSel, '#FFFFFF', baseColor]);
    map.setPaintProperty('plots-circle', 'circle-stroke-color', ['case', isSel, '#CE9A52', '#FFFFFF']);
    map.setPaintProperty('plots-circle', 'circle-stroke-width',
      composite(STROKE_STOPS, () => 3.5, (w) => w));

    // --- Layer 1: dim every non-selected plot (and its number) while one is selected. ---
    if (activePlot) {
      const dim = ['case', isSel, 1, 0.28];
      map.setPaintProperty('plots-circle', 'circle-opacity', dim);
      map.setPaintProperty('plots-circle', 'circle-stroke-opacity', dim);
      if (map.getLayer('plots-label')) map.setPaintProperty('plots-label', 'text-opacity', 0.28);
    } else {
      // Nothing selected — full opacity, but honour an active zone dim if present
      // (zone state lives in activeZoneRef; its own effect is gated while a plot is up).
      const zone = activeZoneRef.current;
      if (zone && zone.plotSet) {
        const names = [...zone.plotSet];
        map.setPaintProperty('plots-circle', 'circle-opacity',
          ['case', ['in', ['get', 'name'], ['literal', names]], 0.9, 0.12]);
      } else {
        map.setPaintProperty('plots-circle', 'circle-opacity', 1);
      }
      map.setPaintProperty('plots-circle', 'circle-stroke-opacity', 1);
      if (map.getLayer('plots-label')) map.setPaintProperty('plots-label', 'text-opacity', 1);
    }

    // Glow: soft accent disc behind the selected plot (same gold @0.22, larger radius).
    map.setPaintProperty('plots-glow', 'circle-color', '#CE9A52');
    map.setPaintProperty('plots-glow', 'circle-radius',
      composite(RADIUS_STOPS, (r) => r + 12, () => 8));
    map.setPaintProperty('plots-glow', 'circle-stroke-width', 0);
    map.setPaintProperty('plots-glow', 'circle-opacity', ['case', isSel, 0.22, 0]);

    // Selected plot's number always shows (allow-overlap highlight layer), in gold so
    // it stays legible on the white fill.
    if (map.getLayer('plots-label-active')) {
      map.setFilter('plots-label-active', ['all',
        ['==', ['get', 'category'], 'saleable'],
        ['!', ['has', 'point_count']],
        ['==', ['get', 'name'], activePlot || '__none__'],
      ]);
      map.setPaintProperty('plots-label-active', 'text-color', '#CE9A52');
    }

    // Highlight amenities when plot is selected
    map.setPaintProperty('amenities-circle', 'circle-radius', ['case', activePlot ? true : false, 7, 5]);
    map.setPaintProperty('amenities-circle', 'circle-stroke-width', ['case', activePlot ? true : false, 2, 1]);

    // --- Layer 3: two white rings pulse out from the selected dot. Translated from the
    // brief's keyframe — scale 1→2, opacity 0.65→0 over 2s, the second ring 0.75s behind.
    // The base radius tracks the (1.45x) selected dot so the rings emanate from its edge.
    let pulseRaf = null;
    if (map.getLayer('plots-pulse')) {
      if (activePlot) {
        const sel = ['all', ['!', ['has', 'point_count']], ['==', ['get', 'name'], activePlot]];
        map.setFilter('plots-pulse', sel);
        map.setFilter('plots-pulse-2', sel);
        map.setPaintProperty('plots-pulse', 'circle-stroke-width', 1.5);
        map.setPaintProperty('plots-pulse-2', 'circle-stroke-width', 1.5);

        // Ring radius is computed numerically each frame — a zoom "interpolate"
        // expression can't be nested inside arithmetic for circle-radius, so we read
        // the live zoom and pass a plain number. Mirrors the RADIUS_STOPS curve × SEL_SCALE
        // (the selected dot size) so the rings always emanate from the dot's edge.
        const dotRadiusAt = (z) => {
          const s = RADIUS_STOPS;
          let base;
          if (z <= s[0][0]) base = s[0][1];
          else if (z >= s[s.length - 1][0]) base = s[s.length - 1][1];
          else {
            base = s[s.length - 1][1];
            for (let i = 0; i < s.length - 1; i++) {
              if (z >= s[i][0] && z <= s[i + 1][0]) {
                const f = (z - s[i][0]) / (s[i + 1][0] - s[i][0]);
                base = s[i][1] + (s[i + 1][1] - s[i][1]) * f;
                break;
              }
            }
          }
          return base * SEL_SCALE; // selected dot radius
        };

        const reduceMotion = typeof window !== 'undefined' && window.matchMedia &&
          window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        if (reduceMotion) {
          // Static ring instead of a pulse for reduced-motion users.
          map.setPaintProperty('plots-pulse', 'circle-radius', dotRadiusAt(map.getZoom()) * 1.5);
          map.setPaintProperty('plots-pulse', 'circle-stroke-opacity', 0.6);
        } else {
          const PERIOD = 2000;   // 2s per ring cycle
          const OFFSET = 0.375;  // 0.75s of 2s — the second ring's phase lead
          const start = performance.now();
          const frame = (now) => {
            const t = ((now - start) % PERIOD) / PERIOD;
            const t2 = (t + OFFSET) % 1;
            const dotR = dotRadiusAt(map.getZoom()); // numeric — tracks zoom per frame
            map.setPaintProperty('plots-pulse', 'circle-radius', dotR * (1 + t));   // scale 1→2
            map.setPaintProperty('plots-pulse', 'circle-stroke-opacity', (1 - t) * 0.65);
            map.setPaintProperty('plots-pulse-2', 'circle-radius', dotR * (1 + t2));
            map.setPaintProperty('plots-pulse-2', 'circle-stroke-opacity', (1 - t2) * 0.65);
            pulseRaf = requestAnimationFrame(frame);
          };
          pulseRaf = requestAnimationFrame(frame);
        }
      } else {
        // Deselected — park the rings on a no-match filter so nothing draws.
        map.setFilter('plots-pulse', ['==', ['get', 'name'], '__none__']);
        map.setFilter('plots-pulse-2', ['==', ['get', 'name'], '__none__']);
      }
    }

    return () => { if (pulseRaf) cancelAnimationFrame(pulseRaf); };
  }, [activePlot]);

  // Zone highlighting: dim plots outside the selected zone (matched by plot name)
  useEffect(() => {
    if (!mapRef.current || !mapRef.current.isStyleLoaded()) return;
    const map = mapRef.current;
    if (!map.getLayer('plots-circle')) return;
    // A selected plot owns circle-opacity (its dimming wins); the highlight effect
    // restores the zone dim from activeZoneRef when the plot is deselected.
    if (activePlotRef.current) return;
    if (activeZone && activeZone.plotSet) {
      const names = [...activeZone.plotSet];
      map.setPaintProperty('plots-circle', 'circle-opacity',
        ['case', ['in', ['get', 'name'], ['literal', names]], 0.9, 0.12]);
    } else {
      map.setPaintProperty('plots-circle', 'circle-opacity', 1);
    }
  }, [activeZone]);

  // Handle View Mode
  useEffect(() => {
    if (!mapRef.current || !mapRef.current.isStyleLoaded()) return;
    const map = mapRef.current;
    if (viewMode === '3D') {
      map.easeTo({ pitch: 50, bearing: -35, duration: 1500 });
    } else {
      map.easeTo({ pitch: 0, bearing: 0, duration: 1000 });
    }
  }, [viewMode]);

  // Handle Connectivity Visualization: route line + camera framing toward the road
  useEffect(() => {
    if (!mapRef.current || !mapRef.current.isStyleLoaded()) return;
    const map = mapRef.current;

    // Cancel any in-flight route fetch from a previous selection
    if (connectivityAbortRef.current) {
      connectivityAbortRef.current.abort();
      connectivityAbortRef.current = null;
    }

    // Source can be briefly missing during a style swap — guard before setData
    const safeSetRoute = (featureCollection) => {
      const src = map.getSource('connectivity');
      if (src) src.setData(featureCollection);
    };

    if (selectedConnectivity !== null && selectedConnectivity !== undefined) {
      const destination = CONNECTIVITY[selectedConnectivity];
      // Bounds/validity guard: ignore stale or out-of-range indices
      if (!destination || !destination.coords) return;

      const origin = KAASA_CENTER;
      const dest = destination.coords;

      // --- Take over the camera: stop rotation + idle timer, set the guard ---
      isAnimatingConnectivityRef.current = true;
      if (stopRotationRef.current) stopRotationRef.current();
      if (idleTimeoutRef.current) {
        clearTimeout(idleTimeoutRef.current);
        idleTimeoutRef.current = null;
      }
      if (rotationAnimationRef.current) {
        cancelAnimationFrame(rotationAnimationRef.current);
        rotationAnimationRef.current = null;
      }

      // --- Animate camera to face the road (destination direction = top of screen) ---
      const bearing = geoBearing(origin, dest);
      let flyOptions = null;
      try {
        const bounds = new maplibregl.LngLatBounds(
          [Math.min(origin[0], dest[0]), Math.min(origin[1], dest[1])],
          [Math.max(origin[0], dest[0]), Math.max(origin[1], dest[1])]
        );
        const cam = map.cameraForBounds(bounds, {
          bearing,
          padding: { top: 100, bottom: 340, left: 100, right: 100 },
          maxZoom: 13.5,
        });
        if (cam && cam.center) {
          flyOptions = { center: cam.center, zoom: cam.zoom, bearing, pitch: 60 };
        }
      } catch {
        flyOptions = null;
      }
      if (!flyOptions) {
        // Fallback: nudge center 30% toward the destination so the road recedes upward
        const center = [
          origin[0] + (dest[0] - origin[0]) * 0.3,
          origin[1] + (dest[1] - origin[1]) * 0.3,
        ];
        flyOptions = { center, zoom: 11.5, bearing, pitch: 60 };
      }
      map.flyTo({
        ...flyOptions,
        duration: 2200,
        curve: 1.42,
        easing: (t) => t * (2 - t), // easeOutQuad
        essential: true,
      });

      // --- Fetch the real OSRM driving route (abortable) ---
      const controller = new AbortController();
      connectivityAbortRef.current = controller;
      const osmUrl = `https://router.project-osrm.org/route/v1/driving/${origin[0]},${origin[1]};${dest[0]},${dest[1]}?overview=full&geometries=geojson`;

      fetch(osmUrl, { signal: controller.signal })
        .then((res) => res.json())
        .then((data) => {
          if (controller.signal.aborted) return; // a newer selection superseded this one
          if (data.routes && data.routes.length > 0) {
            safeSetRoute({
              type: 'FeatureCollection',
              features: [{ type: 'Feature', geometry: data.routes[0].geometry }],
            });
          }
        })
        .catch((err) => {
          if (err.name === 'AbortError') return; // expected on rapid switching
          // Fallback to a straight line if routing fails
          safeSetRoute({
            type: 'FeatureCollection',
            features: [{
              type: 'Feature',
              geometry: { type: 'LineString', coordinates: [origin, dest] },
            }],
          });
        });
    } else {
      // --- Deselected: clear route, release guard, ease home, resume rotation ---
      safeSetRoute({ type: 'FeatureCollection', features: [] });
      isAnimatingConnectivityRef.current = false;

      // Don't fight an active plot's own camera logic
      if (!activePlotRef.current) {
        const home = homeCameraRef.current;
        map.easeTo({
          center: home.center,
          zoom: home.zoom,
          pitch: home.pitch,
          bearing: home.bearing,
          duration: 1500,
          easing: (t) => t * (2 - t),
        });
        // Resume idle rotation only after the return settles, and only if still idle.
        setTimeout(() => {
          if (
            !activePlotRef.current &&
            !isAnimatingConnectivityRef.current &&
            (selectedConnectivityRef.current === null || selectedConnectivityRef.current === undefined) &&
            startRotationRef.current
          ) {
            startRotationRef.current();
          }
        }, 1600);
      }
    }

    // Abort any pending fetch on unmount or before the next run
    return () => {
      if (connectivityAbortRef.current) {
        connectivityAbortRef.current.abort();
        connectivityAbortRef.current = null;
      }
    };
  }, [selectedConnectivity]);

  const toggleRotation = () => {
    if (isRotating) {
      if (rotationAnimationRef.current) {
        cancelAnimationFrame(rotationAnimationRef.current);
        rotationAnimationRef.current = null;
      }
      setIsRotating(false);
    } else {
      if (mapRef.current) {
        const rotate = () => {
          const currentBearing = mapRef.current.getBearing();
          mapRef.current.setBearing(currentBearing + 0.03);
          rotationAnimationRef.current = requestAnimationFrame(rotate);
        };
        rotationAnimationRef.current = requestAnimationFrame(rotate);
        setIsRotating(true);
      }
    }
  };

  return (
    <div id="mwrap">
      <div id="mlabel" className="headline">Belle Vie · Kasara Hills</div>
      <div id="map" ref={mapContainerRef}></div>
      <button id="rotate-btn" onClick={toggleRotation} title={isRotating ? 'Pause rotation' : 'Resume rotation'}>
        {isRotating ? '⏸' : '▶'}
      </button>
      {viewMode === '3D' && <div id="hint3d" className="headline">🖱 Drag to rotate · Scroll to zoom</div>}
      <style>{`
        #mwrap { flex: 1; position: relative; background: var(--bg-secondary); transition: background-color 0.3s ease-in-out; }
        #map { width: 100%; height: 100%; transition: opacity 0.3s ease-in-out, filter 0.3s ease-in-out; }
        /* Reserve the bottom-right corner lane for the Brainwing credit mark:
           the expanded attribution wraps instead of growing into it. */
        #mwrap .maplibregl-ctrl-bottom-left { max-width: calc(100% - 220px); }
        @media (max-width: 1024px) { #mwrap .maplibregl-ctrl-bottom-left { max-width: calc(100% - 175px); } }
        /* Landscape phones: the map is only a ~150px band between the header and the
           bottom sheet, so the zoom stack would climb into the corner label. Drop it
           there — pinch-to-zoom covers it on those devices. Attribution stays. */
        @media (max-width: 1024px) and (max-height: 500px) { #mwrap .maplibregl-ctrl-group { display: none; } }
        #mlabel { position: absolute; top: 24px; left: 24px; z-index: 10; background: var(--glass-bg); backdrop-filter: blur(8px); border: 1px solid var(--border-color); padding: 8px 16px; font-size: 10px; letter-spacing: 0.2em; color: var(--text-primary); transition: all 0.3s ease-in-out; }
        #rotate-btn { position: absolute; top: 24px; right: 24px; z-index: 10; background: var(--glass-bg); backdrop-filter: blur(8px); border: 1px solid var(--brand-gold); width: 40px; height: 40px; border-radius: 0; cursor: pointer; font-size: 16px; color: var(--brand-gold); display: flex; align-items: center; justify-content: center; transition: all 0.3s ease-in-out; }
        #rotate-btn:hover { background: var(--brand-gold); color: var(--on-gold); }
        #hint3d { position: absolute; bottom: 24px; left: 50%; transform: translateX(-50%); z-index: 10; background: var(--glass-bg); backdrop-filter: blur(8px); border: 1px solid var(--brand-gold); padding: 8px 20px; font-size: 9px; letter-spacing: 0.1em; color: var(--text-primary); pointer-events: none; transition: all 0.3s ease-in-out; }
        /* On a narrow canvas (phones, or desktop with the 340px plot panel open) the
           centred hint reaches far enough right to touch the Brainwing credit mark in
           the corner — lift it one row so the two never share a band. */
        @media (max-width: 1280px) { #hint3d { bottom: 68px; } }
        @media (max-width: 360px) { #hint3d { padding: 7px 12px; font-size: 8px; } }
      `}</style>
    </div>
  );
}

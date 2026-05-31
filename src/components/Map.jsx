import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { formatCurrency, getAmenitiesWithDistance } from '../utils';
import amenitiesData from '../data/amenities.json';
import { CONNECTIVITY, KAASA_CENTER } from '../data/connectivity';

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

export default function Map({ plots, activePlot, onPlotClick, viewMode, mapType, theme, selectedConnectivity }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const themeRef = useRef(theme);
  const mapTypeRef = useRef(mapType);
  const viewModeRef = useRef(viewMode);
  const selectedConnectivityRef = useRef(selectedConnectivity);
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
  const homeCameraRef = useRef({ center: [73.462444, 19.643662], zoom: 16.42, pitch: 0, bearing: -42.2 });
  const [isRotating, setIsRotating] = useState(true);

  useEffect(() => {
    activePlotRef.current = activePlot;
  }, [activePlot]);

  useEffect(() => { plotsRef.current = plots; }, [plots]);
  useEffect(() => { onPlotClickRef.current = onPlotClick; }, [onPlotClick]);

  useEffect(() => { themeRef.current = theme; }, [theme]);
  useEffect(() => { mapTypeRef.current = mapType; }, [mapType]);
  useEffect(() => { viewModeRef.current = viewMode; }, [viewMode]);
  useEffect(() => { selectedConnectivityRef.current = selectedConnectivity; }, [selectedConnectivity]);

  const getStyle = () => {
    const key = import.meta.env.VITE_MAPTILER_KEY;
    if (mapType === 'satellite')
      return `https://api.maptiler.com/maps/hybrid/style.json?key=${key}`;
    return `https://api.maptiler.com/maps/landscape/style.json?key=${key}`;
  };

  const mkGeo = (coords) => ({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [coords] } });

  const applyMapLayers = (map) => {
    const key = import.meta.env.VITE_MAPTILER_KEY;
    const currentTheme = themeRef.current;
    const currentMapType = mapTypeRef.current;
    const isSat = currentMapType === 'satellite';

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
    if (!map.getSource('plots')) {
      map.addSource('plots', { type: 'geojson', data: '/data/plots.geojson' });
    }
    if (!map.getLayer('plots-circle')) {
      map.addLayer({
        id: 'plots-circle', type: 'circle', source: 'plots',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 4, 16, 8, 18, 14],
          'circle-color': ['case',
            ['==', ['get', 'category'], 'saleable'], ['case',
              ['==', ['get', 'status'], 'sold'],
                isSat ? '#555555' : (currentTheme === 'dark' ? '#333333' : '#B4BCC9'),
              ['==', ['get', 'status'], 'reserved'], '#CE9A52',
              isSat ? '#FFFFFF' : (currentTheme === 'dark' ? '#4C586B' : '#E2E8ED')
            ],
            ['in', ['get', 'category'], ['literal', ['park', 'garden', 'playground']]], '#B5D18D',
            ['==', ['get', 'category'], 'clubhouse'], '#FFCCBC',
            '#888888',
          ],
          'circle-stroke-color': isSat ? '#cccccc' : (currentTheme === 'dark' ? '#CE9A52' : '#B3863E'),
          'circle-stroke-width': 1,
          'circle-opacity': 0.55,
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
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 6, 16, 10, 18, 16],
          'circle-color': '#FFFFFF',
          'circle-opacity': 0,
          'circle-stroke-color': '#FFFFFF',
          'circle-stroke-width': 0,
        }
      });
    }

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
        minzoom: 16.5,
        filter: ['==', ['get', 'category'], 'saleable'],
        layout: {
          'text-field': ['to-string', ['get', 'plotNo']],
          'text-size': 9,
          'text-allow-overlap': false,
        },
        paint: { 'text-color': '#FFFFFF', 'text-halo-color': '#000000', 'text-halo-width': 1 },
      });
    }
  };

  useEffect(() => {
    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: getStyle(),
      center: [73.462444, 19.643662],
      zoom: 16.42,
      pitch: 0,
      bearing: -42.2,
      maxPitch: 85,
      antialias: true,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'bottom-right');

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

      const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 10, className: 'mbpop' });

      const handleMouseMove = (e) => {
        const p = plots.find(x => x.name === e.features[0].properties.name);
        if (!p) return;
        const currentTheme = themeRef.current;
        const stColor = p.status === 'available' ? '#2E7D32' : p.status === 'reserved' ? '#CE9A52' : '#555555';
        const txtPrimary = currentTheme === 'dark' ? '#FFFFFF' : '#000000';
        const txtSecondary = currentTheme === 'dark' ? '#DAD4C6' : '#444444';

        popup.setLngLat(e.lngLat).setHTML(`
          <div style="font-family:'Inter',sans-serif;padding:6px 2px;min-width:180px;line-height:1.4;">
            <div style="font-family:'Playfair Display',serif;font-size:16px;font-weight:700;color:#CE9A52;margin-bottom:2px">${p.name}</div>
            <div style="font-size:11px;color:${txtSecondary};letter-spacing:0.05em;margin-bottom:6px">${p.area_sqft.toLocaleString()} SQFT · ${p.cat}</div>
            <div style="font-size:14px;color:${txtPrimary};font-weight:800;margin-bottom:10px">${formatCurrency(p.pr.total)}</div>
            <div style="font-size:10px;letter-spacing:0.15em;text-transform:uppercase;color:${stColor};font-weight:800;border-top:1px solid ${currentTheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'};padding-top:8px">${p.status}</div>
          </div>`).addTo(map);
      };

      const handleMouseLeave = () => popup.remove();

      map.on('mousemove', 'plots-circle', handleMouseMove);
      map.on('mouseleave', 'plots-circle', handleMouseLeave);

      mapRef.current = map;
    });

    map.on('style.load', () => {
      if (mapRef.current) {
        applyMapLayers(mapRef.current);
        if (viewModeRef.current === '3D') {
          mapRef.current.setPitch(60);
          mapRef.current.setBearing(-15);
        }
      }
    });

    const container = mapContainerRef.current;
    return () => {
      if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
      if (rotationAnimationRef.current) cancelAnimationFrame(rotationAnimationRef.current);
      window.removeEventListener('keydown', handleCameraCapture);
      container?.removeEventListener('mousedown', handleUserActivitySafe);
      container?.removeEventListener('touchstart', handleUserActivitySafe);
      container?.removeEventListener('wheel', handleUserActivitySafe);
      map.remove();
    };
  }, []);

  // Handle Theme/MapType Change
  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.setStyle(getStyle());
  }, [theme, mapType]);

  // Handle plot selection: camera movement, highlights, and interaction control
  useEffect(() => {
    if (!mapRef.current) return;

    if (activePlot) {
      // Plot selected: COMPLETELY stop rotation and auto-return
      if (stopRotationRef.current) stopRotationRef.current();
      if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
      if (rotationAnimationRef.current) cancelAnimationFrame(rotationAnimationRef.current);
      rotationAnimationRef.current = null;

      // Find the plot and zoom to it with optimal camera positioning
      const selectedPlot = plots.find(p => p.name === activePlot);
      if (selectedPlot && mapRef.current) {
        mapRef.current.flyTo({
          center: selectedPlot.center,
          zoom: 18.2,
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

  // Update highlights and visual states
  useEffect(() => {
    if (!mapRef.current || !mapRef.current.isStyleLoaded()) return;
    const map = mapRef.current;
    const isSat = mapType === 'satellite';

    // Update plot circle stroke color and width
    map.setPaintProperty('plots-circle', 'circle-stroke-color', ['case',
      ['==', ['get', 'name'], activePlot || ''], '#FFD700',
      isSat ? '#cccccc' : (theme === 'dark' ? '#CE9A52' : '#B3863E')
    ]);
    map.setPaintProperty('plots-circle', 'circle-stroke-width', ['case', ['==', ['get', 'name'], activePlot || ''], 6, 1]);

    // Update glow layer for active plot
    map.setPaintProperty('plots-glow', 'circle-radius', ['case', ['==', ['get', 'name'], activePlot || ''], 14, 10]);
    map.setPaintProperty('plots-glow', 'circle-stroke-width', ['case', ['==', ['get', 'name'], activePlot || ''], 5, 0]);
    map.setPaintProperty('plots-glow', 'circle-stroke-color', ['case', ['==', ['get', 'name'], activePlot || ''], '#FFD700', 'transparent']);
    map.setPaintProperty('plots-glow', 'circle-opacity', ['case', ['==', ['get', 'name'], activePlot || ''], 0.25, 0]);

    // Highlight amenities when plot is selected
    map.setPaintProperty('amenities-circle', 'circle-radius', ['case', activePlot ? true : false, 7, 5]);
    map.setPaintProperty('amenities-circle', 'circle-stroke-width', ['case', activePlot ? true : false, 2, 1]);
  }, [activePlot, theme, mapType]);

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
        #mlabel { position: absolute; top: 24px; left: 24px; z-index: 10; background: var(--glass-bg); backdrop-filter: blur(8px); border: 1px solid var(--brand-gold); padding: 8px 16px; font-size: 10px; letter-spacing: 0.2em; color: var(--brand-gold); transition: all 0.3s ease-in-out; }
        #rotate-btn { position: absolute; top: 24px; right: 24px; z-index: 10; background: var(--glass-bg); backdrop-filter: blur(8px); border: 1px solid var(--brand-gold); width: 40px; height: 40px; border-radius: 4px; cursor: pointer; font-size: 16px; color: var(--brand-gold); display: flex; align-items: center; justify-content: center; transition: all 0.3s ease-in-out; }
        #rotate-btn:hover { background: var(--brand-gold); color: var(--on-gold); }
        #hint3d { position: absolute; bottom: 24px; left: 50%; transform: translateX(-50%); z-index: 10; background: var(--glass-bg); backdrop-filter: blur(8px); border: 1px solid var(--brand-gold); padding: 8px 20px; font-size: 9px; letter-spacing: 0.1em; color: var(--text-primary); pointer-events: none; transition: all 0.3s ease-in-out; }
      `}</style>
    </div>
  );
}

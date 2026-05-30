import React, { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { formatCurrency } from '../utils';

export default function Map({ plots, activePlot, onPlotClick, viewMode, mapType, theme, selectedConnectivity }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const themeRef = useRef(theme);
  const mapTypeRef = useRef(mapType);
  const viewModeRef = useRef(viewMode);
  const selectedConnectivityRef = useRef(selectedConnectivity);

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

  // Connectivity destinations (approximate coordinates near Kasara Hills)
  const connectivityLocations = [
    { label: 'Mumbai City', coords: [72.8479, 19.0760] },
    { label: 'Navi Mumbai', coords: [73.0169, 19.0330] },
    { label: 'NH-4 (Mumbai-Pune)', coords: [73.4589, 19.6550] },
    { label: 'Mumbai Airport', coords: [72.8691, 19.0886] }
  ];

  const kaasaCenter = [73.4621, 19.6428];

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
          'circle-opacity': 0.92,
        }
      });
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
        paint: {
          'line-color': '#FFD700',
          'line-width': 6,
          'line-opacity': 1.0,
          'line-cap': 'round',
          'line-join': 'round'
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
      center: [73.4621, 19.6428],
      zoom: 15,
      pitch: 50,
      bearing: -35,
      maxPitch: 85,
      antialias: true,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'bottom-right');

    map.on('load', () => {
      applyMapLayers(map);

      const handlePlotClick = (e) => {
        const name = e.features[0].properties.name;
        const p = plots.find(x => x.name === name);
        if (p) onPlotClick(p);
      };

      map.on('click', 'plots-circle', handlePlotClick);

      const updateCursor = (cursor) => map.getCanvas().style.cursor = cursor;
      map.on('mouseenter', 'plots-circle', () => updateCursor('pointer'));
      map.on('mouseleave', 'plots-circle', () => updateCursor(''));

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

    return () => map.remove();
  }, []);

  // Handle Theme/MapType Change
  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.setStyle(getStyle());
  }, [theme, mapType]);

  // Update highlights
  useEffect(() => {
    if (!mapRef.current || !mapRef.current.isStyleLoaded()) return;
    const map = mapRef.current;
    const isSat = mapType === 'satellite';

    map.setPaintProperty('plots-circle', 'circle-stroke-color', ['case',
      ['==', ['get', 'name'], activePlot || ''], '#FFFFFF',
      isSat ? '#cccccc' : (theme === 'dark' ? '#CE9A52' : '#B3863E')
    ]);
    map.setPaintProperty('plots-circle', 'circle-stroke-width', ['case', ['==', ['get', 'name'], activePlot || ''], 4, 1]);

    // Update glow layer for active plot
    map.setPaintProperty('plots-glow', 'circle-stroke-width', ['case', ['==', ['get', 'name'], activePlot || ''], 3, 0]);
    map.setPaintProperty('plots-glow', 'circle-stroke-color', ['case', ['==', ['get', 'name'], activePlot || ''], '#FFFFFF', 'transparent']);
    map.setPaintProperty('plots-glow', 'circle-opacity', ['case', ['==', ['get', 'name'], activePlot || ''], 0.15, 0]);

    if (activePlot) {
      const p = plots.find(x => x.name === activePlot);
      if (p) map.flyTo({ center: p.center, zoom: 17.5, duration: 1200, pitch: 45 });
    }
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

  // Handle Connectivity Visualization (with actual road routing)
  useEffect(() => {
    if (!mapRef.current || !mapRef.current.isStyleLoaded()) return;
    const map = mapRef.current;

    if (selectedConnectivity !== null && selectedConnectivity !== undefined) {
      const destination = connectivityLocations[selectedConnectivity];

      // Fetch actual road route from OSRM (Open Source Routing Machine)
      const osmUrl = `https://router.project-osrm.org/route/v1/driving/${kaasaCenter[0]},${kaasaCenter[1]};${destination.coords[0]},${destination.coords[1]}?overview=full&geometries=geojson`;

      fetch(osmUrl)
        .then(res => res.json())
        .then(data => {
          if (data.routes && data.routes.length > 0) {
            const route = data.routes[0];
            const line = {
              type: 'Feature',
              geometry: route.geometry
            };
            map.getSource('connectivity').setData({ type: 'FeatureCollection', features: [line] });
          }
        })
        .catch(() => {
          // Fallback to straight line if routing fails
          const line = {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: [kaasaCenter, destination.coords]
            }
          };
          map.getSource('connectivity').setData({ type: 'FeatureCollection', features: [line] });
        });
    } else {
      map.getSource('connectivity').setData({ type: 'FeatureCollection', features: [] });
    }
  }, [selectedConnectivity]);

  return (
    <div id="mwrap">
      <div id="mlabel" className="headline">Belle Vie · Kasara Hills</div>
      <div id="map" ref={mapContainerRef}></div>
      {viewMode === '3D' && <div id="hint3d" className="headline">🖱 Drag to rotate · Scroll to zoom</div>}
      <style>{`
        #mwrap { flex: 1; position: relative; background: var(--bg-secondary); transition: background-color 0.3s ease-in-out; }
        #map { width: 100%; height: 100%; transition: opacity 0.3s ease-in-out, filter 0.3s ease-in-out; }
        #mlabel { position: absolute; top: 24px; left: 24px; z-index: 10; background: var(--glass-bg); backdrop-filter: blur(8px); border: 1px solid var(--brand-gold); padding: 8px 16px; font-size: 10px; letter-spacing: 0.2em; color: var(--brand-gold); transition: all 0.3s ease-in-out; }
        #hint3d { position: absolute; bottom: 24px; left: 50%; transform: translateX(-50%); z-index: 10; background: var(--glass-bg); backdrop-filter: blur(8px); border: 1px solid var(--brand-gold); padding: 8px 20px; font-size: 9px; letter-spacing: 0.1em; color: var(--text-primary); pointer-events: none; transition: all 0.3s ease-in-out; }
      `}</style>
    </div>
  );
}

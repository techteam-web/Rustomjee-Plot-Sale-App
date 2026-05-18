import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import { formatCurrency } from '../utils';
import { BOUNDARY, ROAD_COORDS, IROAD1, IROAD2, PARK1, PARK2, WATER, CLUBHOUSE } from '../data/plots';

mapboxgl.accessToken = 'pk.eyJ1IjoibmlsZXNocGF0aGFyZSIsImEiOiJjbTAyOTVjYXMwMDVtMm5zNnpvaHlmaDZjIn0.MBcXShFJ8vc1cl26zkTcfQ';

export default function Map({ plots, activePlot, onPlotClick, viewMode, mapType, theme }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const themeRef = useRef(theme);
  const mapTypeRef = useRef(mapType);

  const viewModeRef = useRef(viewMode);

  // Keep refs in sync
  useEffect(() => { themeRef.current = theme; }, [theme]);
  useEffect(() => { mapTypeRef.current = mapType; }, [mapType]);
  useEffect(() => { viewModeRef.current = viewMode; }, [viewMode]);

  const setupLayers = (map) => {
    if (!map || !map.getStyle()) return;
    const currentTheme = themeRef.current;
    const currentMapType = mapTypeRef.current;
    const currentViewMode = viewModeRef.current;
    const mkGeo = (coords) => ({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [coords] } });

    // Colors
    const isSat = currentMapType === 'satellite';
    const gold = '#CE9A52';
    const white = '#FFFFFF';
    
    // Boundary
    if (!map.getSource('boundary')) {
      map.addSource('boundary', { type: 'geojson', data: { type: 'FeatureCollection', features: [mkGeo(BOUNDARY)] } });
    }
    if (!map.getLayer('boundary-line')) {
      map.addLayer({ id: 'boundary-line', type: 'line', source: 'boundary', paint: { 'line-color': isSat ? white : gold, 'line-width': isSat ? 1 : 2, 'line-dasharray': [4, 3], 'line-opacity': isSat ? 0.5 : 0.7 } });
    }

    // Roads
    if (!map.getSource('roads')) {
      map.addSource('roads', { type: 'geojson', data: { type: 'FeatureCollection', features: [mkGeo(ROAD_COORDS), mkGeo(IROAD1), mkGeo(IROAD2)] } });
    }
    if (!map.getLayer('roads-fill')) {
      map.addLayer({ id: 'roads-fill', type: 'fill', source: 'roads', paint: { 'fill-color': isSat ? white : (currentTheme === 'dark' ? '#1a1a1a' : '#CBD5E1'), 'fill-opacity': 1 } });
    }

    // Landuse layers - Always show, solid opacity
    if (!map.getSource('parks')) {
      map.addSource('parks', { type: 'geojson', data: { type: 'FeatureCollection', features: [mkGeo(PARK1), mkGeo(PARK2)] } });
    }
    if (!map.getLayer('parks-fill')) {
      map.addLayer({ id: 'parks-fill', type: 'fill', source: 'parks', paint: { 'fill-color': currentTheme === 'dark' ? '#B5D18D' : '#C5E1A5', 'fill-opacity': 1 } });
    }

    if (!map.getSource('water')) {
      map.addSource('water', { type: 'geojson', data: { type: 'FeatureCollection', features: [mkGeo(WATER)] } });
    }
    if (!map.getLayer('water-fill')) {
      map.addLayer({ id: 'water-fill', type: 'fill', source: 'water', paint: { 'fill-color': currentTheme === 'dark' ? '#CAF0FD' : '#B3E5FC', 'fill-opacity': 1 } });
    }

    if (!map.getSource('club')) {
      map.addSource('club', { type: 'geojson', data: { type: 'FeatureCollection', features: [mkGeo(CLUBHOUSE)] } });
    }
    if (!map.getLayer('club-fill')) {
      map.addLayer({ id: 'club-fill', type: 'fill', source: 'club', paint: { 'fill-color': currentTheme === 'dark' ? '#FFB9A1' : '#FFCCBC', 'fill-opacity': 1 } });
    }

    // Plots
    const plotFeatures = plots.map(p => ({
      type: 'Feature',
      properties: {
        id: p.name,
        status: p.status,
        height: p.area_sqft / 2000 * 2,
        name: p.name,
        price: formatCurrency(p.pr.total),
        area: p.area_sqft.toLocaleString(),
      },
      geometry: { type: 'Polygon', coordinates: [p.coords] }
    }));
    
    if (!map.getSource('plots')) {
      map.addSource('plots', { type: 'geojson', data: { type: 'FeatureCollection', features: plotFeatures } });
    }

    // 2D Layers
    if (!map.getLayer('plots-fill')) {
      map.addLayer({
        id: 'plots-fill', type: 'fill', source: 'plots',
        layout: { visibility: currentViewMode === '3D' ? 'none' : 'visible' },
        paint: {
          'fill-color': ['case',
            ['==', ['get', 'status'], 'sold'], isSat ? '#555555' : (currentTheme === 'dark' ? '#333333' : '#B4BCC9'),
            ['==', ['get', 'status'], 'reserved'], gold,
            isSat ? white : (currentTheme === 'dark' ? '#4C586B' : '#E2E8ED')
          ],
          'fill-opacity': 1
        }
      });
    }
    if (!map.getLayer('plots-outline')) {
      map.addLayer({
        id: 'plots-outline', type: 'line', source: 'plots',
        layout: { visibility: currentViewMode === '3D' ? 'none' : 'visible' },
        paint: {
          'line-color': ['case',
            ['==', ['get', 'status'], 'sold'], currentTheme === 'dark' ? '#222222' : '#8A93A6',
            ['==', ['get', 'status'], 'reserved'], '#b38541',
            isSat ? '#cccccc' : (currentTheme === 'dark' ? '#b38541' : '#B3863E')
          ],
          'line-width': 1,
          'line-opacity': 1
        }
      });
    }

    // 3D Layer
    if (!map.getLayer('plots-3d')) {
      map.addLayer({
        id: 'plots-3d', type: 'fill-extrusion', source: 'plots',
        layout: { visibility: currentViewMode === '3D' ? 'visible' : 'none' },
        paint: {
          'fill-extrusion-color': ['case',
            ['==', ['get', 'status'], 'sold'], isSat ? '#444444' : (currentTheme === 'dark' ? '#222222' : '#B4BCC9'),
            ['==', ['get', 'status'], 'reserved'], gold,
            isSat ? white : (currentTheme === 'dark' ? '#4C586B' : '#E2E8ED')
          ],
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-base': 0,
          'fill-extrusion-opacity': 1
        }
      });
    }
  };

  useEffect(() => {
    const getStyle = () => {
      if (mapType === 'satellite') {
        return theme === 'dark' ? 'mapbox://styles/mapbox/satellite-v9' : 'mapbox://styles/mapbox/satellite-streets-v12';
      }
      return theme === 'dark' ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/light-v11';
    };

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: getStyle(),
      center: [73.46265, 19.64076],
      zoom: 15,
      pitch: viewMode === '3D' ? 60 : 0,
      bearing: viewMode === '3D' ? -25 : 0,
      antialias: true
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: true }), 'bottom-right');

    map.on('load', () => {
      setupLayers(map);
      
      const handlePlotClick = (e) => {
        const id = e.features[0].properties.id;
        const p = plots.find(x => x.name === id);
        if (p) onPlotClick(p);
      };

      map.on('click', 'plots-fill', handlePlotClick);
      map.on('click', 'plots-3d', handlePlotClick);
      
      const updateCursor = (cursor) => map.getCanvas().style.cursor = cursor;
      map.on('mouseenter', 'plots-fill', () => updateCursor('pointer'));
      map.on('mouseleave', 'plots-fill', () => updateCursor(''));
      map.on('mouseenter', 'plots-3d', () => updateCursor('pointer'));
      map.on('mouseleave', 'plots-3d', () => updateCursor(''));
      
      const popup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, offset: 10, className: 'mbpop' });
      
      const handleMouseMove = (e) => {
        const p = plots.find(x => x.name === e.features[0].properties.id);
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

      map.on('mousemove', 'plots-fill', handleMouseMove);
      map.on('mouseleave', 'plots-fill', handleMouseLeave);
      map.on('mousemove', 'plots-3d', handleMouseMove);
      map.on('mouseleave', 'plots-3d', handleMouseLeave);

      mapRef.current = map;
    });

    map.on('style.load', () => {
      if (mapRef.current) {
        setupLayers(mapRef.current);
        // Re-apply 3D camera state if needed
        if (viewModeRef.current === '3D') {
          mapRef.current.setPitch(60);
          mapRef.current.setBearing(-25);
        }
      }
    });

    return () => map.remove();
  }, []);

  // Handle Theme/MapType Change
  useEffect(() => {
    if (!mapRef.current) return;
    const getStyle = () => {
      if (mapType === 'satellite') {
        return theme === 'dark' ? 'mapbox://styles/mapbox/satellite-v9' : 'mapbox://styles/mapbox/satellite-streets-v12';
      }
      return theme === 'dark' ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/light-v11';
    };
    mapRef.current.setStyle(getStyle());
  }, [theme, mapType]);

  // Update highlights
  useEffect(() => {
    if (!mapRef.current || !mapRef.current.isStyleLoaded()) return;
    const map = mapRef.current;
    const isSat = mapType === 'satellite';
    const gold = '#CE9A52';
    const white = '#FFFFFF';
    
    map.setPaintProperty('plots-fill', 'fill-color', ['case',
      ['==', ['get', 'id'], activePlot || ''], gold,
      ['==', ['get', 'status'], 'sold'], isSat ? '#555555' : (theme === 'dark' ? '#333333' : '#B4BCC9'),
      ['==', ['get', 'status'], 'reserved'], gold,
      isSat ? white : (theme === 'dark' ? '#4C586B' : '#E2E8ED')
    ]);
    map.setPaintProperty('plots-outline', 'line-width', ['case', ['==', ['get', 'id'], activePlot || ''], 2, 1]);
    map.setPaintProperty('plots-outline', 'line-opacity', 1);
    map.setPaintProperty('plots-outline', 'line-color', ['case', ['==', ['get', 'id'], activePlot || ''], white, isSat ? '#cccccc' : (theme === 'dark' ? '#b38541' : '#B3863E')]);
    
    if (activePlot) {
      const p = plots.find(x => x.name === activePlot);
      if (p) map.flyTo({ center: p.center, zoom: 17, duration: 1200, pitch: 45 });
    }
  }, [activePlot, theme, mapType]);

  // Handle View Mode
  useEffect(() => {
    if (!mapRef.current || !mapRef.current.isStyleLoaded()) return;
    const map = mapRef.current;
    if (viewMode === '3D') {
      map.setLayoutProperty('plots-fill', 'visibility', 'none');
      map.setLayoutProperty('plots-outline', 'visibility', 'none');
      map.setLayoutProperty('plots-3d', 'visibility', 'visible');
      map.easeTo({ pitch: 60, bearing: -25, duration: 1500 });
    } else {
      map.setLayoutProperty('plots-3d', 'visibility', 'none');
      map.setLayoutProperty('plots-fill', 'visibility', 'visible');
      map.setLayoutProperty('plots-outline', 'visibility', 'visible');
      map.easeTo({ pitch: 0, bearing: 0, duration: 1000 });
    }
  }, [viewMode]);

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

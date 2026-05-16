import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import { formatCurrency } from '../utils';
import { BOUNDARY, ROAD_COORDS, IROAD1, IROAD2, PARK1, PARK2, WATER, CLUBHOUSE } from '../data/plots';

mapboxgl.accessToken = 'pk.eyJ1IjoibmlsZXNocGF0aGFyZSIsImEiOiJjbTAyOTVjYXMwMDVtMm5zNnpvaHlmaDZjIn0.MBcXShFJ8vc1cl26zkTcfQ';

export default function Map({ plots, activePlot, onPlotClick, viewMode }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [73.46265, 19.64076],
      zoom: 15,
      pitch: 0,
      bearing: 0,
      antialias: true
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: true }), 'bottom-right');

    map.on('load', () => {
      const mkGeo = (coords) => ({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [coords] } });

      // Boundary
      map.addSource('boundary', { type: 'geojson', data: { type: 'FeatureCollection', features: [mkGeo(BOUNDARY)] } });
      map.addLayer({ id: 'boundary-line', type: 'line', source: 'boundary', paint: { 'line-color': '#CE9A52', 'line-width': 2, 'line-dasharray': [4, 3], 'line-opacity': .7 } });

      // Roads
      map.addSource('roads', { type: 'geojson', data: { type: 'FeatureCollection', features: [mkGeo(ROAD_COORDS), mkGeo(IROAD1), mkGeo(IROAD2)] } });
      map.addLayer({ id: 'roads-fill', type: 'fill', source: 'roads', paint: { 'fill-color': '#1a1a1a', 'fill-opacity': 0.9 } });

      // Parks
      map.addSource('parks', { type: 'geojson', data: { type: 'FeatureCollection', features: [mkGeo(PARK1), mkGeo(PARK2)] } });
      map.addLayer({ id: 'parks-fill', type: 'fill', source: 'parks', paint: { 'fill-color': '#B5D18D', 'fill-opacity': 0.3 } });

      // Water
      map.addSource('water', { type: 'geojson', data: { type: 'FeatureCollection', features: [mkGeo(WATER)] } });
      map.addLayer({ id: 'water-fill', type: 'fill', source: 'water', paint: { 'fill-color': '#CAF0FD', 'fill-opacity': 0.25 } });

      // Clubhouse
      map.addSource('club', { type: 'geojson', data: { type: 'FeatureCollection', features: [mkGeo(CLUBHOUSE)] } });
      map.addLayer({ id: 'club-fill', type: 'fill', source: 'club', paint: { 'fill-color': '#FFB9A1', 'fill-opacity': 0.3 } });

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
      map.addSource('plots', { type: 'geojson', data: { type: 'FeatureCollection', features: plotFeatures } });

      // 2D Layers
      map.addLayer({
        id: 'plots-fill', type: 'fill', source: 'plots',
        paint: {
          'fill-color': ['case',
            ['==', ['get', 'status'], 'sold'], '#333333',
            ['==', ['get', 'status'], 'reserved'], 'rgba(206, 154, 82, 0.3)',
            'rgba(218, 212, 198, 0.2)'
          ],
          'fill-opacity': 1
        }
      });
      map.addLayer({
        id: 'plots-outline', type: 'line', source: 'plots',
        paint: {
          'line-color': ['case',
            ['==', ['get', 'status'], 'sold'], '#444444',
            ['==', ['get', 'status'], 'reserved'], '#CE9A52',
            '#CE9A52'
          ],
          'line-width': 1,
          'line-opacity': 0.5
        }
      });

      // 3D Layer
      map.addLayer({
        id: 'plots-3d', type: 'fill-extrusion', source: 'plots',
        layout: { visibility: 'none' },
        paint: {
          'fill-extrusion-color': ['case',
            ['==', ['get', 'status'], 'sold'], '#222222',
            ['==', ['get', 'status'], 'reserved'], '#b38541',
            '#CE9A52'
          ],
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-base': 0,
          'fill-extrusion-opacity': 0.9
        }
      });

      // Click and Hover handlers
      map.on('click', 'plots-fill', (e) => onPlotClick(plots.find(p => p.name === e.features[0].properties.id)));
      map.on('click', 'plots-3d', (e) => onPlotClick(plots.find(p => p.name === e.features[0].properties.id)));
      
      map.on('mouseenter', 'plots-fill', () => map.getCanvas().style.cursor = 'pointer');
      map.on('mouseleave', 'plots-fill', () => map.getCanvas().style.cursor = '');
      
      const popup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, offset: 10, className: 'mbpop' });
      map.on('mousemove', 'plots-fill', (e) => {
        const p = plots.find(x => x.name === e.features[0].properties.id);
        if (!p) return;
        const stColor = p.status === 'available' ? '#B5D18D' : p.status === 'reserved' ? '#CE9A52' : '#8A93A6';
        popup.setLngLat(e.lngLat).setHTML(`
          <div style="font-family:'Inter',sans-serif;padding:4px 2px;min-width:160px;">
            <div style="font-family:'Playfair Display',serif;font-size:15px;font-weight:700;color:#CE9A52">${p.name}</div>
            <div style="font-size:11px;color:#DAD4C6;margin-top:6px;letter-spacing:0.05em">${p.area_sqft.toLocaleString()} SQFT · ${p.cat}</div>
            <div style="font-size:13px;color:#FFFFFF;font-weight:600;margin-top:4px">${formatCurrency(p.pr.total)}</div>
            <div style="font-size:9px;letter-spacing:0.15em;text-transform:uppercase;color:${stColor};margin-top:8px;font-weight:700;border-top:1px solid rgba(255,255,255,0.1);padding-top:6px">${p.status}</div>
          </div>`).addTo(map);
      });
      map.on('mouseleave', 'plots-fill', () => popup.remove());

      mapRef.current = map;
    });

    return () => map.remove();
  }, []);

  // Update highlights
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    
    map.setPaintProperty('plots-fill', 'fill-color', ['case',
      ['==', ['get', 'id'], activePlot || ''], 'rgba(206, 154, 82, 0.8)',
      ['==', ['get', 'status'], 'sold'], '#333333',
      ['==', ['get', 'status'], 'reserved'], 'rgba(206, 154, 82, 0.3)',
      'rgba(218, 212, 198, 0.2)'
    ]);
    map.setPaintProperty('plots-outline', 'line-width', ['case', ['==', ['get', 'id'], activePlot || ''], 2, 1]);
    map.setPaintProperty('plots-outline', 'line-opacity', ['case', ['==', ['get', 'id'], activePlot || ''], 1, 0.5]);
    
    if (activePlot) {
      const p = plots.find(x => x.name === activePlot);
      if (p) map.flyTo({ center: p.center, zoom: 17, duration: 1200, pitch: 45 });
    }
  }, [activePlot]);

  // Handle View Mode
  useEffect(() => {
    if (!mapRef.current) return;
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
        #mwrap { flex: 1; position: relative; background: #000; }
        #map { width: 100%; height: 100%; }
        #mlabel { position: absolute; top: 24px; left: 24px; z-index: 10; background: rgba(0,0,0,0.9); border: 1px solid var(--brand-gold); padding: 8px 16px; font-size: 10px; letter-spacing: 0.2em; color: var(--brand-gold); }
        #hint3d { position: absolute; bottom: 24px; left: 50%; transform: translateX(-50%); z-index: 10; background: rgba(0,0,0,0.9); border: 1px solid var(--brand-gold); padding: 8px 20px; font-size: 9px; letter-spacing: 0.1em; color: var(--brand-white); pointer-events: none; }
      `}</style>
    </div>
  );
}

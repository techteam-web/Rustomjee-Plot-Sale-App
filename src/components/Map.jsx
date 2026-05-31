import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import { formatCurrency } from '../utils';

mapboxgl.accessToken = 'pk.eyJ1IjoibmlsZXNocGF0aGFyZSIsImEiOiJjbTAyOTVjYXMwMDVtMm5zNnpvaHlmaDZjIn0.MBcXShFJ8vc1cl26zkTcfQ';

const DEM_SOURCE = 'mapbox-dem';
const DEM_URL    = 'mapbox://mapbox.mapbox-terrain-dem-v1';

export default function Map({ plots, activePlot, onPlotClick, viewMode, mapType, theme, masterplanOpacity, showMasterplanOverlay, showMarkers, activeZone, onElevationsLoaded, terrainExaggeration }) {
  const mapContainerRef = useRef(null);
  const mapRef          = useRef(null);
  const themeRef        = useRef(theme);
  const mapTypeRef      = useRef(mapType);
  const viewModeRef     = useRef(viewMode);
  const showMasterplanOverlayRef     = useRef(showMasterplanOverlay);
  const masterplanOpacityRef         = useRef(masterplanOpacity);
  const showMarkersRef               = useRef(showMarkers);
  const plotsRef                     = useRef(plots);
  const activeZoneRef                = useRef(activeZone);
  const terrainExaggerationRef       = useRef(terrainExaggeration);
  const elevReportedRef              = useRef(false);

  useEffect(() => { themeRef.current = theme; }, [theme]);
  useEffect(() => { mapTypeRef.current = mapType; }, [mapType]);
  useEffect(() => { viewModeRef.current = viewMode; }, [viewMode]);
  useEffect(() => { showMasterplanOverlayRef.current = showMasterplanOverlay; }, [showMasterplanOverlay]);
  useEffect(() => { masterplanOpacityRef.current = masterplanOpacity; }, [masterplanOpacity]);
  useEffect(() => { showMarkersRef.current = showMarkers; }, [showMarkers]);
  useEffect(() => { plotsRef.current = plots; }, [plots]);
  useEffect(() => { activeZoneRef.current = activeZone; }, [activeZone]);
  useEffect(() => { terrainExaggerationRef.current = terrainExaggeration; }, [terrainExaggeration]);

  const buildMarkerFeatures = (plotList, zoneSet) => plotList.map(p => ({
    type: 'Feature',
    properties: {
      id: p.name,
      plotNo: p.plotNo,
      status: p.status,
      area_sqm: p.total_sqm,
      area_sqft: p.area_sqft,
      price: p.pr ? formatCurrency(p.pr.total) : '',
      inZone: zoneSet ? zoneSet.has(p.name) : true,
    },
    geometry: { type: 'Point', coordinates: [p.longitude, p.latitude] }
  }));

  const enableTerrain = (map, exaggeration) => {
    const ex = exaggeration ?? terrainExaggerationRef.current ?? 1;
    if (!map.getSource(DEM_SOURCE)) {
      map.addSource(DEM_SOURCE, { type: 'raster-dem', url: DEM_URL, tileSize: 512, maxzoom: 14 });
    }
    map.setTerrain({ source: DEM_SOURCE, exaggeration: ex });
  };

  const addSkyLayer = (map) => {
    if (map.getLayer('sky')) return;
    map.addLayer({
      id: 'sky',
      type: 'sky',
      paint: {
        'sky-type': 'atmosphere',
        'sky-atmosphere-sun': [0.0, 90.0],
        'sky-atmosphere-sun-intensity': 15,
        'sky-atmosphere-color': 'rgba(85, 151, 210, 0.75)',
        'sky-atmosphere-halo-color': 'rgba(255, 255, 255, 0.5)',
      }
    });
  };

  const addContourLayers = (map) => {
    if (!map.getSource('terrain-contour')) {
      map.addSource('terrain-contour', { type: 'vector', url: 'mapbox://mapbox.mapbox-terrain-v2' });
    }
    if (!map.getLayer('contour-lines')) {
      map.addLayer({
        id: 'contour-lines', type: 'line', source: 'terrain-contour', 'source-layer': 'contour',
        paint: {
          'line-color': ['case',
            ['==', ['%', ['get', 'ele'], 100], 0], 'rgba(255,200,50,0.85)',
            'rgba(255,255,255,0.18)'
          ],
          'line-width': ['case', ['==', ['%', ['get', 'ele'], 100], 0], 1.5, 0.5],
        }
      }, map.getLayer('masterplan-img-layer') ? 'masterplan-img-layer' : 'kml-markers-layer');
    }
    if (!map.getLayer('contour-labels')) {
      map.addLayer({
        id: 'contour-labels', type: 'symbol', source: 'terrain-contour', 'source-layer': 'contour',
        filter: ['==', ['%', ['get', 'ele'], 100], 0],
        layout: {
          'symbol-placement': 'line',
          'text-field': ['concat', ['to-string', ['get', 'ele']], 'm'],
          'text-size': 9,
          'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
        },
        paint: {
          'text-color': 'rgba(255,200,50,1)',
          'text-halo-color': 'rgba(0,0,0,0.65)',
          'text-halo-width': 1.5,
        }
      });
    }
  };

  const queryElevations = (map) => {
    if (elevReportedRef.current || !onElevationsLoaded) return;
    const elevations = {};
    plotsRef.current.forEach(p => {
      const e = map.queryTerrainElevation([p.longitude, p.latitude], { exaggerated: false });
      if (e !== null) elevations[p.name] = Math.round(e);
    });
    if (Object.keys(elevations).length > 0) {
      elevReportedRef.current = true;
      onElevationsLoaded(elevations);
    }
  };

  const setupLayers = (map) => {
    if (!map || !map.getStyle()) return;

    // Terrain DEM + sky
    const isTerrainMode = mapTypeRef.current === 'terrain';
    const ex = viewModeRef.current === '3D' ? 2 : isTerrainMode ? terrainExaggerationRef.current : 1;
    enableTerrain(map, ex);
    if (isTerrainMode) addSkyLayer(map);

    // Masterplan image overlay — rotated 47.94° around centre
    const n = 19.64687878918523, s = 19.63905978772486;
    const e = 73.46769628506151, w = 73.45508522534966;
    const cx = (e + w) / 2, cy = (n + s) / 2;
    const angle = (47.94295501708985 * Math.PI) / 180;
    const aspect = Math.cos(cy * Math.PI / 180);
    const rot = (lng, lat) => {
      const dx = (lng - cx) * aspect, dy = lat - cy;
      const rx = Math.cos(angle) * dx - Math.sin(angle) * dy;
      const ry = Math.sin(angle) * dx + Math.cos(angle) * dy;
      return [(rx / aspect) + cx, ry + cy];
    };

    if (!map.getSource('masterplan-img')) {
      map.addSource('masterplan-img', {
        type: 'image', url: '/Layer_1.png',
        coordinates: [rot(w, n), rot(e, n), rot(e, s), rot(w, s)]
      });
    }
    if (!map.getLayer('masterplan-img-layer')) {
      map.addLayer({
        id: 'masterplan-img-layer', type: 'raster', source: 'masterplan-img',
        layout: { visibility: showMasterplanOverlayRef.current ? 'visible' : 'none' },
        paint: { 'raster-opacity': masterplanOpacityRef.current / 100, 'raster-blend': 'screen' }
      });
    }

    // Plot markers
    if (!map.getSource('kml-markers')) {
      map.addSource('kml-markers', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: buildMarkerFeatures(plotsRef.current) }
      });
    }
    if (isTerrainMode) addContourLayers(map);

    if (!map.getLayer('kml-markers-layer')) {
      map.addLayer({
        id: 'kml-markers-layer',
        type: 'circle',
        source: 'kml-markers',
        layout: { visibility: showMarkersRef.current ? 'visible' : 'none' },
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 3, 16, 6, 18, 9],
          'circle-color': [
            'match', ['get', 'status'],
            'available', '#00C853',
            'reserved', '#FFD600',
            'sold', '#FF1744',
            '#00C853'
          ],
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#FFFFFF'
        }
      });
    }
  };

  useEffect(() => {
    const getStyle = () => {
      if (mapType === 'terrain') return 'mapbox://styles/mapbox/satellite-streets-v12';
      if (mapType === 'satellite') return theme === 'dark' ? 'mapbox://styles/mapbox/satellite-v9' : 'mapbox://styles/mapbox/satellite-streets-v12';
      return theme === 'dark' ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/light-v11';
    };

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: getStyle(),
      center: [73.4613, 19.6430],
      zoom: 15,
      pitch: viewMode === '3D' ? 60 : 0,
      bearing: viewMode === '3D' ? -25 : 0,
      antialias: true
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: true }), 'bottom-right');

    map.on('load', () => {
      setupLayers(map);

      const updateCursor = (cursor) => map.getCanvas().style.cursor = cursor;
      const popup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, offset: 10, className: 'mbpop' });

      map.on('mousemove', 'kml-markers-layer', (e) => {
        const props = e.features[0].properties;
        const ct = themeRef.current;
        const stColor = props.status === 'available' ? '#00C853' : props.status === 'reserved' ? '#FFD600' : '#FF1744';
        const txtPrimary = ct === 'dark' ? '#FFFFFF' : '#000000';
        const txtSecondary = ct === 'dark' ? '#DAD4C6' : '#444444';
        popup.setLngLat(e.lngLat).setHTML(`
          <div style="font-family:'Inter',sans-serif;padding:6px 2px;min-width:160px;line-height:1.4;">
            <div style="font-family:'Playfair Display',serif;font-size:15px;font-weight:700;color:#CE9A52;margin-bottom:2px">Plot ${props.plotNo}</div>
            <div style="font-size:11px;color:${txtSecondary};margin-bottom:6px">${props.area_sqft ? props.area_sqft.toLocaleString() : '—'} sqft · ${props.area_sqm ? props.area_sqm + ' sq.m' : ''}</div>
            <div style="font-size:13px;color:${txtPrimary};font-weight:700;margin-bottom:8px">${props.price || ''}</div>
            <div style="font-size:9px;letter-spacing:0.15em;text-transform:uppercase;color:${stColor};font-weight:800;border-top:1px solid rgba(128,128,128,0.2);padding-top:7px">${props.status}</div>
          </div>`).addTo(map);
      });
      map.on('mouseleave', 'kml-markers-layer', () => popup.remove());
      map.on('mouseenter', 'kml-markers-layer', () => updateCursor('pointer'));
      map.on('mouseleave', 'kml-markers-layer', () => updateCursor(''));

      map.on('click', 'kml-markers-layer', (e) => {
        const id = e.features[0].properties.id;
        const p = plotsRef.current.find(x => x.name === id);
        if (p) onPlotClick(p);
      });

      mapRef.current = map;

      // Query terrain elevations once tiles are loaded
      map.once('idle', () => queryElevations(map));
    });

    map.on('style.load', () => {
      if (!mapRef.current) return;
      setupLayers(mapRef.current);
      if (viewModeRef.current === '3D') {
        mapRef.current.easeTo({ pitch: 60, bearing: -25, duration: 800 });
      } else if (mapTypeRef.current === 'terrain') {
        mapRef.current.easeTo({ pitch: 45, bearing: -20, duration: 800 });
      } else {
        mapRef.current.easeTo({ pitch: 0, bearing: 0, duration: 600 });
      }
      const src = mapRef.current.getSource('kml-markers');
      if (src && plotsRef.current.length) {
        src.setData({ type: 'FeatureCollection', features: buildMarkerFeatures(plotsRef.current) });
      }
      // Re-query elevations after style switch (tiles reload, may get new values)
      mapRef.current.once('idle', () => {
        elevReportedRef.current = false;
        queryElevations(mapRef.current);
      });
    });

    return () => map.remove();
  }, []);

  // Theme / map style switch
  useEffect(() => {
    if (!mapRef.current) return;
    const getStyle = () => {
      if (mapType === 'terrain') return 'mapbox://styles/mapbox/satellite-streets-v12';
      if (mapType === 'satellite') return theme === 'dark' ? 'mapbox://styles/mapbox/satellite-v9' : 'mapbox://styles/mapbox/satellite-streets-v12';
      return theme === 'dark' ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/light-v11';
    };
    mapRef.current.setStyle(getStyle());
  }, [theme, mapType]);

  // Masterplan opacity / visibility
  useEffect(() => {
    if (!mapRef.current || !mapRef.current.isStyleLoaded()) return;
    if (mapRef.current.getLayer('masterplan-img-layer')) {
      mapRef.current.setPaintProperty('masterplan-img-layer', 'raster-opacity', masterplanOpacity / 100);
      mapRef.current.setLayoutProperty('masterplan-img-layer', 'visibility', showMasterplanOverlay ? 'visible' : 'none');
    }
  }, [masterplanOpacity, showMasterplanOverlay]);

  // Marker visibility toggle
  useEffect(() => {
    if (!mapRef.current || !mapRef.current.isStyleLoaded()) return;
    if (mapRef.current.getLayer('kml-markers-layer')) {
      mapRef.current.setLayoutProperty('kml-markers-layer', 'visibility', showMarkers ? 'visible' : 'none');
    }
  }, [showMarkers]);

  // Zone highlight + active plot highlight + fly-to (unified)
  useEffect(() => {
    if (!mapRef.current || !mapRef.current.isStyleLoaded()) return;
    const map = mapRef.current;
    if (!map.getLayer('kml-markers-layer')) return;

    const src = map.getSource('kml-markers');
    if (src) {
      src.setData({ type: 'FeatureCollection', features: buildMarkerFeatures(plotsRef.current, activeZone?.plotSet) });
    }

    if (activeZone) {
      map.setPaintProperty('kml-markers-layer', 'circle-color', [
        'case',
        ['==', ['get', 'id'], activePlot || ''], '#CE9A52',
        ['==', ['get', 'inZone'], true], activeZone.color,
        'rgba(120,120,120,0.2)'
      ]);
      map.setPaintProperty('kml-markers-layer', 'circle-radius', [
        'case',
        ['==', ['get', 'inZone'], true],
        ['interpolate', ['linear'], ['zoom'], 13, 4, 16, 8, 18, 11],
        ['interpolate', ['linear'], ['zoom'], 13, 2, 16, 3, 18, 5]
      ]);
      map.setPaintProperty('kml-markers-layer', 'circle-stroke-width', [
        'case', ['==', ['get', 'id'], activePlot || ''], 3,
        ['==', ['get', 'inZone'], true], 1.5,
        0.5
      ]);

      if (!activePlot) {
        const zonePlots = plotsRef.current.filter(p => activeZone.plotSet.has(p.name));
        if (zonePlots.length) {
          const lngs = zonePlots.map(p => p.longitude);
          const lats = zonePlots.map(p => p.latitude);
          map.fitBounds(
            [[Math.min(...lngs) - 0.001, Math.min(...lats) - 0.001], [Math.max(...lngs) + 0.001, Math.max(...lats) + 0.001]],
            { padding: 80, maxZoom: 16, duration: 1200 }
          );
        }
      }
    } else {
      map.setPaintProperty('kml-markers-layer', 'circle-color', [
        'case',
        ['==', ['get', 'id'], activePlot || ''], '#CE9A52',
        ['match', ['get', 'status'], 'available', true, false], '#00C853',
        ['match', ['get', 'status'], 'reserved', true, false], '#FFD600',
        '#FF1744'
      ]);
      map.setPaintProperty('kml-markers-layer', 'circle-radius',
        ['interpolate', ['linear'], ['zoom'], 13, 3, 16, 6, 18, 9]
      );
      map.setPaintProperty('kml-markers-layer', 'circle-stroke-width', [
        'case', ['==', ['get', 'id'], activePlot || ''], 3, 1.5
      ]);
    }

    if (activePlot) {
      const p = plotsRef.current.find(x => x.name === activePlot);
      if (p) map.flyTo({ center: [p.longitude, p.latitude], zoom: 17, duration: 1200, pitch: 45 });
    }
  }, [activePlot, activeZone, theme, mapType]);

  // 3D / 2D camera + terrain exaggeration
  useEffect(() => {
    if (!mapRef.current || !mapRef.current.isStyleLoaded()) return;
    const map = mapRef.current;
    if (viewMode === '3D') {
      map.easeTo({ pitch: 60, bearing: -25, duration: 1500 });
      if (map.getSource(DEM_SOURCE)) map.setTerrain({ source: DEM_SOURCE, exaggeration: 2 });
    } else {
      const isTerrain = mapTypeRef.current === 'terrain';
      map.easeTo({ pitch: isTerrain ? 45 : 0, bearing: isTerrain ? -20 : 0, duration: 1000 });
      const ex = isTerrain ? terrainExaggerationRef.current : 1;
      if (map.getSource(DEM_SOURCE)) map.setTerrain({ source: DEM_SOURCE, exaggeration: ex });
    }
  }, [viewMode]);

  // Live terrain exaggeration slider
  useEffect(() => {
    if (!mapRef.current || !mapRef.current.isStyleLoaded()) return;
    if (mapRef.current.getSource(DEM_SOURCE)) {
      mapRef.current.setTerrain({ source: DEM_SOURCE, exaggeration: terrainExaggeration });
    }
  }, [terrainExaggeration]);

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

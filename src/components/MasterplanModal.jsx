import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import { BOUNDARY, PLOTS_RAW, PARK1, PARK2, CLUBHOUSE, WATER, STATUS_LIST } from '../data/plots';

export default function MasterplanModal({ show, onClose, theme }) {
  const mapRef = useRef(null);
  const mapContainerRef = useRef(null);

  const setupLayers = (map) => {
    if (!map || !map.getCanvas()) return;
    
    // Cleanup existing to be safe if called on style load
    const mkGeo = (coords) => ({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [coords] } });

    if (!map.getSource('b')) {
      map.addSource('b', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'Polygon', coordinates: [BOUNDARY] } } });
    }
    if (!map.getLayer('bl')) {
      map.addLayer({ id: 'bl', type: 'line', source: 'b', paint: { 'line-color': '#CE9A52', 'line-width': 2, 'line-dasharray': [4, 3] } });
    }
    
    const pf = PLOTS_RAW.map((p, i) => ({
      type: 'Feature',
      properties: { status: STATUS_LIST[i] },
      geometry: { type: 'Polygon', coordinates: [p.coords] }
    }));

    if (!map.getSource('mp')) {
      map.addSource('mp', { type: 'geojson', data: { type: 'FeatureCollection', features: pf } });
    }

    if (!map.getLayer('mf')) {
      map.addLayer({ id: 'mf', type: 'fill', source: 'mp', paint: { 'fill-color': ['case', ['==', ['get', 'status'], 'sold'], theme === 'dark' ? '#222' : '#ccc', ['==', ['get', 'status'], 'reserved'], 'rgba(206, 154, 82, 0.35)', theme === 'dark' ? 'rgba(218, 212, 198, 0.25)' : 'rgba(27, 43, 75, 0.1)'], 'fill-opacity': 1 } });
    }
    if (!map.getLayer('mo')) {
      map.addLayer({ id: 'mo', type: 'line', source: 'mp', paint: { 'line-color': ['case', ['==', ['get', 'status'], 'sold'], theme === 'dark' ? '#444' : '#999', ['==', ['get', 'status'], 'reserved'], '#CE9A52', '#CE9A52'], 'line-width': 1 } });
    }
    
    const addArea = (id, coords, color) => {
      if (!map.getSource(id)) {
        map.addSource(id, { type: 'geojson', data: { type: 'Feature', geometry: { type: 'Polygon', coordinates: [coords] } } });
      }
      if (!map.getLayer(id + '-l')) {
        map.addLayer({ id: id + '-l', type: 'fill', source: id, paint: { 'fill-color': color, 'fill-opacity': 0.3 } });
      }
    };
    
    addArea('pk1', PARK1, '#B5D18D');
    addArea('pk2', PARK2, '#B5D18D');
    addArea('cl', CLUBHOUSE, '#FFB9A1');
    addArea('wr', WATER, '#CAF0FD');
  };

  useEffect(() => {
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: theme === 'dark' ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/light-v11',
      center: [73.46265, 19.64076],
      zoom: 14.5,
      antialias: true
    });

    map.on('load', () => {
      setupLayers(map);
      mapRef.current = map;
    });

    map.on('style.load', () => {
      setupLayers(map);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []); // Init once on mount

  // Resize when shown
  useEffect(() => {
    if (show && mapRef.current) {
      setTimeout(() => {
        mapRef.current.resize();
        mapRef.current.easeTo({ center: [73.46265, 19.64076], zoom: 14.5, duration: 800 });
      }, 300);
    }
  }, [show]);

  // Handle Theme Change
  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.setStyle(theme === 'dark' ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/light-v11');
  }, [theme]);

  return (
    <div id="mpmod" className={show ? 'show' : ''} onClick={onClose}>
      <div className="mpinner brand-frame" onClick={e => e.stopPropagation()}>
        <div className="mpclose" onClick={onClose}>✕</div>
        <div className="mptitle headline">Belle Vie · Masterplan</div>
        <div className="mpsub subhead">35.6 Hectares · 18 Premium Residential Plots</div>
        <div className="mpgrid">
          <div className="mpcard">
            <div className="mpcico">🏡</div>
            <div className="mpctit headline">18 Premium Plots</div>
            <div className="mpcdesc">Individually curated plots with panoramic hill views.</div>
          </div>
          <div className="mpcard">
            <div className="mpcico">🌳</div>
            <div className="mpctit headline">Nature Trails</div>
            <div className="mpcdesc">Over 41,000 sqm of landscaped greens and walking trails.</div>
          </div>
          <div className="mpcard">
            <div className="mpcico">🏛️</div>
            <div className="mpctit headline">Clubhouse</div>
            <div className="mpcdesc">A signature Rustomjee experience with world-class amenities.</div>
          </div>
        </div>
        <div id="mpmap" ref={mapContainerRef}></div>
      </div>
      <style>{`
        #mpmod { 
          position: fixed; inset: 0; z-index: 2000; background: var(--glass-bg); 
          backdrop-filter: blur(20px); display: flex; align-items: center; justify-content: center; padding: 40px;
          opacity: 0; pointer-events: none; transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }
        #mpmod.show { opacity: 1; pointer-events: auto; }
        .mpinner { 
          background: var(--bg-primary); width: 100%; max-width: 1000px; max-height: 90vh; 
          overflow: auto; padding: 48px; position: relative; border-color: var(--gold-b);
          transform: translateY(20px); transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }
        #mpmod.show .mpinner { transform: translateY(0); }
        .mpclose { position: absolute; top: 24px; right: 24px; width: 40px; height: 40px; background: var(--card-bg); border: 1px solid var(--border); cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 18px; color: var(--brand-gold); transition: all 0.3s; }
        .mpclose:hover { background: var(--brand-gold); color: var(--bg-primary); }
        .mptitle { font-size: 32px; margin-bottom: 8px; color: var(--text-primary); }
        .mpsub { font-size: 14px; color: var(--brand-gold); margin-bottom: 32px; letter-spacing: 0.05em; }
        .mpgrid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-bottom: 40px; }
        .mpcard { background: var(--card-bg); border: 1px solid var(--border); padding: 24px; transition: all 0.3s; }
        .mpcard:hover { border-color: var(--brand-gold); background: var(--gold-p); }
        .mpcico { font-size: 28px; margin-bottom: 12px; }
        .mpctit { font-size: 14px; font-weight: 700; margin-bottom: 8px; color: var(--text-primary); letter-spacing: 0.1em; }
        .mpcdesc { font-size: 12px; color: var(--text-muted); line-height: 1.6; }
        #mpmap { width: 100%; height: 350px; border: 1px solid var(--border); filter: ${theme === 'dark' ? 'grayscale(0.2) contrast(1.1)' : 'none'}; }
        @media (max-width: 768px) {
          #mpmod { padding: 16px; }
          .mpinner { padding: 24px; }
          .mpgrid { grid-template-columns: 1fr; gap: 16px; }
          .mptitle { font-size: 24px; }
          .mpclose { top: 16px; right: 16px; width: 32px; height: 32px; }
        }
      `}</style>
    </div>
  );
}


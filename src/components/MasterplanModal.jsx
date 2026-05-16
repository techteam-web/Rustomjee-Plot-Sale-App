import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import { BOUNDARY, PLOTS_RAW, PARK1, PARK2, CLUBHOUSE, WATER, STATUS_LIST } from '../data/plots';

export default function MasterplanModal({ show, onClose }) {
  const mapRef = useRef(null);
  const mapContainerRef = useRef(null);

  useEffect(() => {
    if (show && !mapRef.current) {
      setTimeout(() => {
        const map = new mapboxgl.Map({
          container: mapContainerRef.current,
          style: 'mapbox://styles/mapbox/dark-v11',
          center: [73.46265, 19.64076],
          zoom: 14.5,
          antialias: true
        });

        map.on('load', () => {
          map.addSource('b', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'Polygon', coordinates: [BOUNDARY] } } });
          map.addLayer({ id: 'bl', type: 'line', source: 'b', paint: { 'line-color': '#CE9A52', 'line-width': 2, 'line-dasharray': [4, 3] } });
          
          const pf = PLOTS_RAW.map((p, i) => ({
            type: 'Feature',
            properties: { status: STATUS_LIST[i] },
            geometry: { type: 'Polygon', coordinates: [p.coords] }
          }));
          map.addSource('mp', { type: 'geojson', data: { type: 'FeatureCollection', features: pf } });
          map.addLayer({ id: 'mf', type: 'fill', source: 'mp', paint: { 'fill-color': ['case', ['==', ['get', 'status'], 'sold'], '#222', ['==', ['get', 'status'], 'reserved'], 'rgba(206, 154, 82, 0.35)', 'rgba(218, 212, 198, 0.25)'], 'fill-opacity': 1 } });
          map.addLayer({ id: 'mo', type: 'line', source: 'mp', paint: { 'line-color': ['case', ['==', ['get', 'status'], 'sold'], '#444', ['==', ['get', 'status'], 'reserved'], '#CE9A52', '#CE9A52'], 'line-width': 1 } });
          
          const addArea = (id, coords, color) => {
            map.addSource(id, { type: 'geojson', data: { type: 'Feature', geometry: { type: 'Polygon', coordinates: [coords] } } });
            map.addLayer({ id: id + '-l', type: 'fill', source: id, paint: { 'fill-color': color, 'fill-opacity': 0.3 } });
          };
          
          addArea('pk1', PARK1, '#B5D18D');
          addArea('pk2', PARK2, '#B5D18D');
          addArea('cl', CLUBHOUSE, '#FFB9A1');
          addArea('wr', WATER, '#CAF0FD');
        });
        mapRef.current = map;
      }, 150);
    } else if (show && mapRef.current) {
      setTimeout(() => mapRef.current.resize(), 200);
    }
  }, [show]);

  if (!show) return null;

  return (
    <div id="mpmod" className="show" onClick={onClose}>
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
        #mpmod { position: fixed; inset: 0; z-index: 2000; background: rgba(0,0,0,.98); backdrop-filter: blur(20px); display: flex; align-items: center; justify-content: center; padding: 40px; }
        .mpinner { background: var(--brand-black); width: 100%; max-width: 1000px; max-height: 90vh; overflow: auto; padding: 48px; position: relative; }
        .mpclose { position: absolute; top: 24px; right: 24px; width: 40px; height: 40px; background: rgba(255,255,255,.05); border: 1px solid var(--border); cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 18px; color: var(--brand-gold); transition: all 0.3s; }
        .mpclose:hover { background: var(--brand-gold); color: var(--brand-black); }
        .mptitle { font-size: 32px; margin-bottom: 8px; color: var(--brand-white); }
        .mpsub { font-size: 14px; color: var(--brand-gold); margin-bottom: 32px; letter-spacing: 0.05em; }
        .mpgrid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-bottom: 40px; }
        .mpcard { background: rgba(255,255,255,.02); border: 1px solid var(--border); padding: 24px; transition: all 0.3s; }
        .mpcard:hover { border-color: var(--brand-gold); background: rgba(206, 154, 82, 0.03); }
        .mpcico { font-size: 28px; margin-bottom: 12px; }
        .mpctit { font-size: 14px; font-weight: 700; margin-bottom: 8px; color: var(--brand-white); letter-spacing: 0.1em; }
        .mpcdesc { font-size: 12px; color: var(--gray); line-height: 1.6; }
        #mpmap { width: 100%; height: 350px; border: 1px solid var(--border); filter: grayscale(0.2) contrast(1.1); }
      `}</style>
    </div>
  );
}

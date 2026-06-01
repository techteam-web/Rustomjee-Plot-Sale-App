import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';

const MAPTILER_KEY = 'Z9dW9MP2fONkRosZa0j0';
import { PLOT_INVENTORY } from '../data/plotInventory';

export default function MasterplanModal({ show, onClose, theme }) {
  const mapRef = useRef(null);
  const mapContainerRef = useRef(null);

  const setupLayers = (map) => {
    if (!map || !map.getCanvas()) return;

    const pf = PLOT_INVENTORY.map(p => ({
      type: 'Feature',
      properties: { status: p.status },
      geometry: { type: 'Point', coordinates: [p.longitude, p.latitude] }
    }));

    if (!map.getSource('mp')) {
      map.addSource('mp', { type: 'geojson', data: { type: 'FeatureCollection', features: pf } });
    }

    if (!map.getLayer('mf')) {
      map.addLayer({
        id: 'mf', type: 'circle', source: 'mp',
        paint: {
          'circle-radius': 4,
          'circle-color': ['match', ['get', 'status'], 'sold', '#555555', 'reserved', '#CE9A52', '#00C853'],
          'circle-stroke-width': 1,
          'circle-stroke-color': '#FFFFFF'
        }
      });
    }
    
  };

  useEffect(() => {
    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: `https://api.maptiler.com/maps/019e818f-2ef6-77ca-af90-84fedc9100a3/style.json?key=${MAPTILER_KEY}`,
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
    mapRef.current.setStyle(`https://api.maptiler.com/maps/019e818f-2ef6-77ca-af90-84fedc9100a3/style.json?key=${MAPTILER_KEY}`);
  }, [theme]);

  return (
    <div id="mpmod" className={show ? 'show' : ''} onClick={onClose}>
      <div className="mpinner brand-frame" onClick={e => e.stopPropagation()}>
        <div className="mpclose" onClick={onClose}>✕</div>
        <div className="mptitle headline">Belle Vie · Kasara Hills</div>
        <div className="mpsub subhead">482 Plots · 5 Lifestyle Zones · 35.6 Hectares · 26 Amenities</div>
        <div className="mpgrid">
          <div className="mpcard">
            <div className="mpcico">🏡</div>
            <div className="mpctit headline">482 Residential Plots</div>
            <div className="mpcdesc">Five curated zones across Kasara Hills — Gateway District, Recreation Hub, Garden Valley, Forest Ridge & Water's Edge.</div>
          </div>
          <div className="mpcard">
            <div className="mpcico">🌿</div>
            <div className="mpctit headline">26 Amenities</div>
            <div className="mpcdesc">Nature trails, bamboo groves, elevated walkway, viewpoint, oasis parks, water reservoir dam, and serenity gardens.</div>
          </div>
          <div className="mpcard">
            <div className="mpcico">🏛️</div>
            <div className="mpctit headline">Valley Vista Clubhouse</div>
            <div className="mpcdesc">Swimming pool, Pavilion Clubhouse, Joy Junction Kids Park and scenic hill views across the entire estate.</div>
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


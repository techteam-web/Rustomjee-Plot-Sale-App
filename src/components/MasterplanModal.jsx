import React, { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { responsiveMapZoom } from '../utils';

// Same georeferenced corners as the live homepage map so the modal shows the
// exact "nicely made" masterplan rendering (satellite + 3D terrain + the
// rendered masterplan artwork). No plot circles — just the neighbourhood map.
// The camera matches the Home / Neighbourhood framing and is LOCKED (non-interactive).
const MASTERPLAN_COORDS = [
  [73.45426414958871, 19.64090642755213], // NW (rotated)
  [73.4627119222577, 19.65026986516813],  // NE (rotated)
  [73.46851736082246, 19.64503214935796], // SE (rotated)
  [73.46006958815347, 19.63566871174196], // SW (rotated)
];

export default function MasterplanModal({ show, onClose, theme }) {
  const mapRef = useRef(null);
  const mapContainerRef = useRef(null);

  const setupLayers = (map) => {
    if (!map || !map.getCanvas()) return;
    const key = import.meta.env.VITE_MAPTILER_KEY;

    // 3D terrain — gives the Kasara hills their relief under a pitched camera
    if (!map.getSource('terrain')) {
      map.addSource('terrain', {
        type: 'raster-dem',
        url: `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=${key}`,
        tileSize: 256,
      });
    }
    map.setTerrain({ source: 'terrain', exaggeration: 1.8 });

    // The rendered masterplan artwork, draped over the satellite imagery
    if (!map.getSource('masterplan')) {
      map.addSource('masterplan', {
        type: 'image',
        url: '/data/layer-1-masterplan.png',
        coordinates: MASTERPLAN_COORDS,
      });
    }
    if (!map.getLayer('masterplan-layer')) {
      map.addLayer({
        id: 'masterplan-layer',
        type: 'raster',
        source: 'masterplan',
        paint: { 'raster-opacity': 0.95 },
      });
    }
    // No plot circles here — the masterplan shows the neighbourhood map only.
  };

  // Frame the masterplan to match the Home / Neighbourhood "normal" view:
  // same center + bearing, a gentle 3D tilt, and a width-responsive zoom so the
  // estate is framed identically across screen sizes.
  const frameMasterplan = (map, animate) => {
    if (!map) return;
    const width = mapContainerRef.current?.clientWidth || window.innerWidth;
    const camera = {
      center: [73.462444, 19.643662], // same center as the Home / Neighbourhood view
      zoom: responsiveMapZoom(16.42, width),
      pitch: 45,
      bearing: -42.2,
    };
    if (animate) map.flyTo({ ...camera, duration: 1400, essential: true });
    else map.jumpTo(camera);
  };

  useEffect(() => {
    const key = import.meta.env.VITE_MAPTILER_KEY;
    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: `https://api.maptiler.com/maps/hybrid/style.json?key=${key}`,
      center: [73.462444, 19.643662],
      zoom: 15,
      pitch: 45,
      bearing: -42.2,
      maxPitch: 85,
      antialias: true,
      interactive: false, // locked, still presentation map — no drag / zoom / rotate
    });

    map.on('load', () => {
      setupLayers(map);
      frameMasterplan(map, false);
      mapRef.current = map;
    });

    // A style swap rebuilds all layers — re-add ours.
    map.on('style.load', () => {
      setupLayers(map);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []); // Init once on mount

  // Resize + re-frame when the modal becomes visible
  useEffect(() => {
    if (show && mapRef.current) {
      setTimeout(() => {
        mapRef.current.resize();
        frameMasterplan(mapRef.current, true);
      }, 300);
    }
  }, [show]);

  // Keep the locked framing responsive if the window resizes while open
  useEffect(() => {
    if (!show) return;
    const onResize = () => {
      if (!mapRef.current) return;
      mapRef.current.resize();
      frameMasterplan(mapRef.current, false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [show]);

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
        .mpsub { font-size: 14px; color: var(--brand-gold); margin-bottom: 32px; letter-spacing: 0.05em; font-family: 'Inter', sans-serif; font-weight: 300; font-style: normal; }
        .mpgrid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-bottom: 40px; }
        .mpcard { background: var(--card-bg); border: 1px solid var(--border); padding: 24px; transition: all 0.3s; }
        .mpcard:hover { border-color: var(--brand-gold); background: var(--gold-p); }
        .mpcico { font-size: 28px; margin-bottom: 12px; }
        .mpctit { font-size: 14px; font-weight: 400; margin-bottom: 8px; color: var(--text-primary); letter-spacing: 0.1em; }
        .mpcdesc { font-size: 12px; color: var(--text-muted); line-height: 1.6; }
        #mpmap { width: 100%; height: 350px; border: 1px solid var(--border); }
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

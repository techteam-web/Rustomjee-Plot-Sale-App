import React from 'react';
import { CONNECTIVITY_PLACES, TOURIST_SPOTS, TOURS, CATEGORY_META } from '../data/neighbourhood';
import PlaceIcon from './PlaceIcon';

// Neighbourhood sidebar: Connectivity + Scenic Tourist Spots, each with real
// distances, click-to-show-path, and a ~5s "Play Journey" cinematic tour.
export default function NeighbourhoodPanel({
  activeTour,
  onPlayTour,
  onStopTour,
  playing,
  tourStep,
  selectedPlace,
  onSelectPlace,
}) {
  const renderSection = (groupId, title, places) => {
    const isThisPlaying = playing && activeTour === groupId;
    return (
      <div className="nsb-sec">
        <div className="nsb-sechead">
          <div className="sbt headline">{title}</div>
          {/* Play Journey button removed for now — tour wiring kept for easy restore */}
        </div>
        <div className="place-list">
          {places.map((p, i) => {
            const meta = CATEGORY_META[p.category] || {};
            const isSel = selectedPlace === p.id;
            const isHere = isThisPlaying && tourStep === i;
            return (
              <div
                key={p.id}
                className={`place-card ${isSel ? 'on' : ''} ${isHere ? 'here' : ''}`}
                style={{ '--pc': meta.color || '#CE9A52' }}
                onClick={() => onSelectPlace(isSel ? null : p.id)}
              >
                <div className="place-icon"><PlaceIcon category={p.category} /></div>
                <div className="place-info">
                  <div className="place-name">{p.name}</div>
                  <div className="place-note">{p.note}</div>
                </div>
                <div className="place-meta">
                  {p.time && <div className="place-time"><svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7.5 V12 L15 13.5" /></svg>{p.time}</div>}
                  <div className="place-dist">{p.distance}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div id="nsb">
      {renderSection('connectivity', 'Connectivity', CONNECTIVITY_PLACES)}
      {renderSection('tourist', 'Scenic Tourist Spots', TOURIST_SPOTS)}

      <style>{`
        #nsb {
          width: 340px; min-width: 340px; background: var(--brand-black);
          border-right: 1px solid var(--gold-b); display: flex; flex-direction: column;
          overflow-y: auto; overflow-x: hidden;
        }
        @media (max-width: 1024px) {
          #nsb { width: 100%; min-width: 100%; border-right: none; border-top: 1px solid var(--gold-b); height: 42vh; }
        }
        .nsb-sec { padding: 16px 22px; border-bottom: 1px solid var(--border); flex-shrink: 0; }
        .sbt { font-size: 11px; letter-spacing: 0.2em; color: var(--brand-gold); font-weight: 600; }
        .nsb-sechead { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; gap: 10px; }
        .tour-btn {
          flex-shrink: 0; padding: 6px 12px; font-size: 9px; letter-spacing: 0.12em; text-transform: uppercase;
          font-weight: 700; cursor: pointer; font-family: 'Inter', sans-serif; transition: all 0.2s;
          background: var(--brand-gold); border: 1px solid var(--brand-gold); color: var(--bg-primary);
        }
        .tour-btn:hover { background: var(--brand-gold-dark, #b3863e); }
        .tour-btn.stop { background: transparent; color: var(--brand-gold); }
        .place-list { display: flex; flex-direction: column; gap: 6px; }
        .place-card {
          display: flex; align-items: center; gap: 11px; padding: 10px 12px;
          background: var(--card-bg); border: 1px solid var(--border); cursor: pointer;
          transition: all 0.2s; border-left: 3px solid var(--pc);
        }
        .place-card:hover { background: var(--gold-p); }
        .place-card.on { background: var(--bg-secondary); border-color: var(--pc); }
        .place-card.here { background: var(--gold-p); border-color: var(--brand-gold); box-shadow: 0 0 12px rgba(206,154,82,0.35); }
        .place-icon { flex-shrink: 0; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; color: var(--pc); border-radius: 9px; background: color-mix(in srgb, var(--pc) 11%, transparent); border: 1px solid color-mix(in srgb, var(--pc) 24%, transparent); }
        .place-icon svg { width: 21px; height: 21px; display: block; }
        .place-info { flex: 1; min-width: 0; }
        .place-name { font-size: 12px; font-weight: 600; color: var(--text-primary); }
        .place-note { font-size: 10px; color: var(--text-muted); margin-top: 2px; }
        .place-meta { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
        .place-time { display: inline-flex; align-items: center; gap: 3px; font-size: 10px; color: var(--text-muted); font-family: 'Inter', sans-serif; white-space: nowrap; }
        .place-time svg { opacity: 0.8; flex-shrink: 0; }
        .place-dist { font-size: 11px; font-weight: 700; color: var(--brand-gold); flex-shrink: 0; font-family: 'Inter', sans-serif; }
      `}</style>
    </div>
  );
}

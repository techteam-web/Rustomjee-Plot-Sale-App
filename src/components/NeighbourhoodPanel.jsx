import React from 'react';
import { CONNECTIVITY_PLACES, TOURIST_SPOTS, TOURS, CATEGORY_META } from '../data/neighbourhood';

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
                <div className="place-icon">{meta.icon || '📍'}</div>
                <div className="place-info">
                  <div className="place-name">{p.name}</div>
                  <div className="place-note">{p.note}</div>
                </div>
                <div className="place-dist">{p.distance}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div id="nsb">
      <div className="nsb-sec nsb-intro-sec">
        <div className="sbt headline">Location Advantages</div>
        <div className="nsb-intro">Tap any place to trace the route from Belle Vie, or play a cinematic journey through the area.</div>
      </div>

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
        .nsb-intro-sec { padding-bottom: 18px; }
        .sbt { font-size: 11px; letter-spacing: 0.2em; color: var(--brand-gold); font-weight: 600; }
        .nsb-intro { font-size: 11px; color: var(--text-muted); line-height: 1.6; margin-top: 10px; }
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
        .place-icon { font-size: 18px; flex-shrink: 0; width: 22px; text-align: center; }
        .place-info { flex: 1; min-width: 0; }
        .place-name { font-size: 12px; font-weight: 600; color: var(--text-primary); }
        .place-note { font-size: 10px; color: var(--text-muted); margin-top: 2px; }
        .place-dist { font-size: 11px; font-weight: 700; color: var(--brand-gold); flex-shrink: 0; font-family: 'Inter', sans-serif; }
      `}</style>
    </div>
  );
}

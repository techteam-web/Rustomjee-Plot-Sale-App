import React, { useState, useEffect } from 'react';
import { formatCurrency, hdist } from '../utils';
import { CITIES, AMEN } from '../data/plots';

export default function PlotDetails({ plot, onClose }) {
  if (!plot) return null;

  const handleWA = () => {
    const msg = `Hi, I'm interested in ${plot.name} at Rustomjee Kasara Hill Estates.\n\nArea: ${plot.area_sqft.toLocaleString()} sqft\nPrice: ${formatCurrency(plot.pr.total)} (₹${plot.pr.psf.toLocaleString()}/sqft)\nStatus: ${plot.status}\n\nKindly share more details.`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div id="panel" className={plot ? 'open' : ''}>
      <div className="pi">
        <div className="phero">
          <div className="phg"></div>
          <div className="phgl"></div>
          <div className="phnum headline">{plot.name.replace('Plot ', '')}</div>
          <div className="phx" onClick={onClose}>✕</div>
          <div className="pht">
            <div className="phn headline">{plot.name}</div>
            <div className="php subhead">{plot.cat} · {plot.facing} Facing</div>
          </div>
        </div>
        <div className="pb">
          <div className="ps">
            <div className={`sbadge ${plot.status}`}><div className="sbdot"></div>{plot.status.charAt(0).toUpperCase() + plot.status.slice(1)}</div>
            {plot.status === 'sold' && plot.soldTo && <div className="sn subhead">Registered to: {plot.soldTo}</div>}
            <div className="pbox brand-frame">
              <div>
                <div className="pmain headline">{formatCurrency(plot.pr.total)}</div>
                <div className="ppsf">₹{plot.pr.psf.toLocaleString()} per sqft</div>
              </div>
            </div>
          </div>

          <div className="ps">
            <div className="pst headline">Plot Specifications</div>
            <div className="dgrid">
              <div className="spec-item">
                <div className="di-l headline">Area (sqft)</div>
                <div className="di-v headline gold">{plot.area_sqft.toLocaleString()}</div>
              </div>
              <div className="spec-item">
                <div className="di-l headline">Facing</div>
                <div className="di-v headline">{plot.facing}</div>
              </div>
              <div className="spec-item">
                <div className="di-l headline">Category</div>
                <div className="di-v headline">{plot.cat}</div>
              </div>
              <div className="spec-item">
                <div className="di-l headline">Road Width</div>
                <div className="di-v headline">{plot.road}</div>
              </div>
            </div>
          </div>

          <div className="ps">
            <div className="pst headline">Proximity to Amenities</div>
            <div className="amen-list">
              {Object.values(AMEN).map((am, i) => {
                const d = Math.round(hdist(plot.center, am.center));
                const pct = Math.max(5, Math.min(100, 100 - d / am.max * 100));
                return (
                  <div key={i} className="amrow">
                    <div className="aml">
                      <span className="am-icon">{am.icon}</span>
                      <div className="am-info">
                        <div className="am-name">{am.name}</div>
                        <div className="ambar"><div className="amfill" style={{ width: `${pct}%` }}></div></div>
                      </div>
                    </div>
                    <div className="amdist headline">{d}m</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="ps" style={{ borderBottom: 'none', marginTop: 'auto' }}>
            <div className="actrow">
              <button
                className="btn-brand primary flex-1"
                disabled={plot.status === 'sold'}
                onClick={() => alert(plot.status === 'reserved' ? `Added to waitlist for ${plot.name}.` : `Site visit for ${plot.name} scheduled.`)}
                style={{ opacity: plot.status === 'sold' ? 0.4 : 1 }}
              >
                {plot.status === 'sold' ? 'Plot Sold' : 'Book Site Visit'}
              </button>
              <button className="btn-brand flex-1" onClick={handleWA}>WhatsApp</button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        #panel {
          width: 0; min-width: 0; background: var(--bg-primary);
          border-left: 1px solid var(--gold-b);
          overflow: hidden; transition: width .4s cubic-bezier(.4,0,.2,1);
          display: flex; flex-direction: column; z-index: 200;
        }
        #panel.open { width: 400px; min-width: 400px; }
        .pi { width: 400px; overflow-y: auto; height: 100%; display: flex; flex-direction: column; background: var(--bg-primary); }
        .phero { min-height: 200px; position: relative; overflow: hidden; background: var(--bg-secondary); border-bottom: 1px solid var(--gold-b); display: flex; align-items: flex-end; padding: 24px; padding-top: 40px; }
        .phnum { position: absolute; top: 10px; right: 10px; font-size: 80px; color: var(--gold-p); font-weight: 900; line-height: 1; pointer-events: none; opacity: 0.8; }
        .phx { position: absolute; top: 20px; right: 20px; width: 32px; height: 32px; background: var(--card-bg); border: 1px solid var(--border); cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 14px; color: var(--brand-gold); z-index: 2; transition: all 0.3s; }
        .phx:hover { background: var(--brand-gold); color: var(--on-gold); }
        .phn { font-size: 24px; font-weight: 700; color: var(--text-primary); position: relative; z-index: 1; margin-bottom: 4px; }
        .php { font-size: 11px; color: var(--brand-gold); text-transform: uppercase; letter-spacing: 0.1em; position: relative; z-index: 1; }
        .pb { padding: 24px; display: flex; flex-direction: column; flex: 1; }
        .ps { border-bottom: 1px solid var(--border); padding-bottom: 20px; margin-bottom: 20px; }
        .pst { font-size: 10px; letter-spacing: 0.2em; color: var(--brand-gold); margin-bottom: 16px; font-weight: 700; }
        .sbadge { display: inline-flex; align-items: center; gap: 8px; padding: 6px 14px; font-size: 10px; letter-spacing: 0.15em; text-transform: uppercase; font-weight: 700; border: 1px solid var(--border); margin-bottom: 16px; }
        .sbadge.available { color: var(--brand-green); border-color: rgba(181, 209, 141, 0.3); background: rgba(181, 209, 141, 0.05); }
        .sbadge.sold { color: var(--gray); border-color: var(--border); }
        .sbadge.reserved { color: var(--brand-gold); border-color: var(--gold-b); background: var(--gold-p); }
        .sbdot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
        .pbox { background: var(--bg-secondary); padding: 20px; display: flex; align-items: center; justify-content: space-between; margin-top: 4px; border: 1px solid var(--gold-b); }
        .pmain { font-size: 26px; color: var(--text-primary); font-weight: 700; }
        .ppsf { font-size: 11px; color: var(--text-muted); margin-top: 4px; }
        .ppi-l { font-size: 9px; color: var(--brand-gold); letter-spacing: 0.1em; }
        .ppi-v { font-size: 14px; color: var(--text-secondary); margin-top: 4px; }
        .bdr { background: var(--bg-secondary); padding: 16px; border: 1px solid var(--border); }
        .brow { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; }
        .blbl { font-size: 12px; color: var(--text-muted); }
        .bval { font-size: 12px; color: var(--text-secondary); font-weight: 500; }
        .bdiv { height: 1px; background: var(--border); margin: 12px 0; }
        .tot { color: var(--brand-gold) !important; font-size: 14px !important; }
        .dgrid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .di-l { font-size: 9px; color: var(--text-muted); letter-spacing: 0.1em; margin-bottom: 4px; }
        .di-v { font-size: 14px; font-weight: 600; color: var(--text-primary); }
        .gold { color: var(--brand-gold) !important; }
        .amrow { display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--border); }
        .amrow:last-child { border-bottom: none; }
        .aml { display: flex; align-items: center; gap: 14px; flex: 1; }
        .am-icon { font-size: 20px; width: 24px; }
        .am-info { flex: 1; }
        .am-name { font-size: 12px; color: var(--text-primary); margin-bottom: 6px; }
        .ambar { height: 2px; background: var(--border); width: 80%; border-radius: 2px; }
        .amfill { height: 100%; background: var(--brand-gold); border-radius: 2px; }
        .amdist { font-size: 12px; color: var(--brand-gold); }
        .roii { display: flex; gap: 12px; margin-bottom: 16px; }
        .roir { flex: 1; }
        .roil { font-size: 10px; color: var(--text-muted); display: block; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.05em; }
        .roiinp { background: var(--card-bg); border: 1px solid var(--border); color: var(--text-primary); padding: 8px; font-size: 13px; width: 100%; outline: none; transition: border-color 0.3s; }
        .roiinp:focus { border-color: var(--brand-gold); }
        .roigrid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .roic { background: var(--gold-p); border: 1px solid var(--gold-b); padding: 14px; text-align: center; }
        .roicl { font-size: 9px; color: var(--text-muted); margin-bottom: 6px; }
        .roicv { font-size: 16px; color: var(--text-primary); }
        .actrow { display: flex; gap: 12px; }
      `}</style>
    </div>
  );
}

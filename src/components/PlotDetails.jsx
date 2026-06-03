import React, { useState, useEffect, useRef } from 'react';
import { formatCurrency, getAmenitiesWithDistance } from '../utils';
import amenitiesData from '../data/amenities.json';
import AmenityIcon from './AmenityIcon';
import gsap from 'gsap';

export default function PlotDetails({ plot, onClose }) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (plot && panelRef.current) {
      // Trigger GSAP animation when a new plot is selected
      gsap.fromTo(
        panelRef.current.querySelectorAll('.gsap-stagger'),
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.6, stagger: 0.1, ease: "power3.out", clearProps: "all" }
      );
    }
  }, [plot]);

  if (!plot) return null;

  const handleWA = () => {
    const msg = `Hi, I'm interested in ${plot.name} at Rustomjee Kasara Hill Estates.\n\nArea: ${plot.area_sqft.toLocaleString()} sqft\nPrice: ${formatCurrency(plot.pr.total)} (₹${plot.pr.psf.toLocaleString()}/sqft)\nStatus: ${plot.status}\n\nKindly share more details.`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div id="panel" className={plot ? 'open' : ''} ref={panelRef}>
      <div className="pi">
        <div className="phero gsap-stagger">
          <div className="phg"></div>
          <div className="phgl"></div>
          <div className="phnum headline">{plot.name.replace('Plot ', '')}</div>
          <div className="phx" onClick={onClose}>✕</div>
          <div className="pht">
            <div className="phn headline">{plot.name}</div>
            <div className="php subhead">{plot.cat}</div>
          </div>
        </div>
        <div className="pb">
          <div className="ps gsap-stagger">
            <div className={`sbadge ${plot.status}`}><div className="sbdot"></div>{plot.status.charAt(0).toUpperCase() + plot.status.slice(1)}</div>
            {plot.status === 'sold' && plot.soldTo && <div className="sn subhead">Registered to: {plot.soldTo}</div>}
            <div className="pbox brand-frame">
              <div>
                <div className="pmain headline">{formatCurrency(plot.pr.total)}</div>
                <div className="ppsf">₹{plot.pr.psf.toLocaleString()} per sqft</div>
              </div>
            </div>
          </div>

          <div className="ps gsap-stagger">
            <div className="pst headline">Plot Specifications</div>
            <div className="dgrid">
              <div className="spec-item">
                <div className="di-l headline">Area (sqft)</div>
                <div className="di-v headline gold">{plot.area_sqft.toLocaleString()}</div>
              </div>
              <div className="spec-item">
                <div className="di-l headline">Area (sqm)</div>
                <div className="di-v headline">{plot.area_sqm?.toFixed(1)}</div>
              </div>
              <div className="spec-item">
                <div className="di-l headline">Category</div>
                <div className="di-v headline">{plot.cat}</div>
              </div>
              <div className="spec-item">
                <div className="di-l headline">Survey / Owner</div>
                <div className="di-v headline">{plot.owner || '—'}</div>
              </div>
            </div>
          </div>

          <div className="ps gsap-stagger ps-amen">
            <div className="pst headline">All Amenities & Distance <span className="amen-count">{getAmenitiesWithDistance(plot.center, amenitiesData).length}</span></div>
            <div className="amen-list">
              {getAmenitiesWithDistance(plot.center, amenitiesData).map((am) => (
                <div key={am.id} className="amrow">
                  <div className="aml">
                    <span className="am-icon"><AmenityIcon name={am.name} category={am.category} /></span>
                    <div className="am-info">
                      <div className="am-name">{am.name}</div>
                    </div>
                  </div>
                  <div className="amdist headline">{am.distanceKm} km</div>
                </div>
              ))}
            </div>
          </div>

          <div className="ps gsap-stagger ps-actions" style={{ borderBottom: 'none' }}>
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
        #panel.open { width: 340px; min-width: 340px; }
        @media (max-width: 1024px) {
          #panel {
            position: fixed; top: 64px; right: 0; bottom: 0; height: calc(100vh - 64px);
            border-left: 1px solid var(--gold-b); box-shadow: none;
          }
          #panel.open { width: 100%; min-width: 100%; }
        }
        .pi { width: 100%; max-width: 340px; margin: 0 auto; overflow-y: auto; height: 100%; display: flex; flex-direction: column; background: var(--bg-primary); }
        .phero { min-height: 100px; position: relative; overflow: hidden; background: var(--bg-secondary); border-bottom: 1px solid var(--gold-b); display: flex; align-items: flex-end; padding: 16px; padding-top: 24px; }
        .phnum { display: none; }
        .phx { position: absolute; top: 12px; right: 12px; width: 28px; height: 28px; background: var(--card-bg); border: 1px solid var(--border); cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 12px; color: var(--brand-gold); z-index: 2; transition: all 0.3s; }
        .phx:hover { background: var(--brand-gold); color: var(--on-gold); }
        .pht { padding-right: 40px; }
        .phn { font-size: 20px; color: var(--text-primary); position: relative; z-index: 1; margin-bottom: 2px; }
        .php { font-size: 10px; color: var(--brand-gold); text-transform: uppercase; letter-spacing: 0.1em; position: relative; z-index: 1; }
        .pb { padding: 16px; display: flex; flex-direction: column; flex: 1; min-height: 0; }
        .ps { border-bottom: 1px solid var(--border); padding-bottom: 14px; margin-bottom: 14px; }
        .ps-amen { flex: 1 1 auto; min-height: 200px; display: flex; flex-direction: column; }
        .ps-actions { flex-shrink: 0; }
        .pst { font-size: 9px; letter-spacing: 0.2em; color: var(--brand-gold); margin-bottom: 12px; font-weight: 400; }
        .sbadge { display: inline-flex; align-items: center; gap: 8px; padding: 6px 14px; font-size: 10px; letter-spacing: 0.15em; text-transform: uppercase; font-weight: 400; border: 1px solid var(--border); margin-bottom: 16px; }
        .sbadge.available { color: var(--status-available); border-color: var(--gold-b); background: var(--gold-p); }
        .sbadge.sold { color: var(--status-sold); border-color: var(--border); }
        .sbadge.reserved { color: var(--status-reserved); border-color: var(--gold-b); background: var(--gold-p); }
        .sbdot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
        .pbox { background: var(--bg-secondary); padding: 14px; display: flex; align-items: center; justify-content: space-between; margin-top: 4px; border: 1px solid var(--gold-b); }
        .pmain { font-size: 22px; color: var(--text-primary); }
        .ppsf { font-size: 9px; color: var(--text-muted); margin-top: 3px; }
        .ppi-l { font-size: 9px; color: var(--brand-gold); letter-spacing: 0.1em; }
        .ppi-v { font-size: 14px; color: var(--text-secondary); margin-top: 4px; }
        .bdr { background: var(--bg-secondary); padding: 16px; border: 1px solid var(--border); }
        .brow { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; }
        .blbl { font-size: 12px; color: var(--text-muted); }
        .bval { font-size: 12px; color: var(--text-secondary); font-weight: 500; }
        .bdiv { height: 1px; background: var(--border); margin: 12px 0; }
        .tot { color: var(--brand-gold) !important; font-size: 14px !important; }
        .dgrid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .di-l { font-size: 8px; color: var(--text-muted); letter-spacing: 0.1em; margin-bottom: 3px; }
        .di-v { font-size: 12px; font-weight: 400; color: var(--text-primary); }
        .gold { color: var(--brand-gold) !important; }
        .amen-list { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding-right: 6px; }
        .amen-count { color: var(--text-muted); font-weight: 400; letter-spacing: 0; }
        .amrow { display: flex; align-items: center; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border); }
        .amrow:last-child { border-bottom: none; }
        .aml { display: flex; align-items: center; gap: 10px; flex: 1; }
        .am-icon { width: 24px; height: 24px; display: inline-flex; align-items: center; justify-content: center; color: var(--brand-gold); flex-shrink: 0; }
        .am-info { flex: 1; }
        .am-name { font-size: 10px; color: var(--text-primary); margin-bottom: 4px; }
        .ambar { height: 2px; background: var(--border); width: 80%; border-radius: 2px; }
        .amfill { height: 100%; background: var(--brand-gold); border-radius: 2px; }
        .amdist { font-size: 10px; color: var(--brand-gold); }
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

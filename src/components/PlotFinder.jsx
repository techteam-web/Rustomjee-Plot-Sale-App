import { useState, useMemo } from 'react';
import { formatCurrency } from '../utils';

export const ZONES = [
  {
    id: 'gateway',
    name: 'Gateway District',
    icon: '🚪',
    tagline: 'Entrance avenue · Entry gardens · Easy access',
    color: '#A8A8A8',
    test: p => p.latitude < 19.641,
    lifestyles: ['access'],
  },
  {
    id: 'recreation',
    name: 'Recreation Hub',
    icon: '🏊',
    tagline: 'Valley Vista Clubhouse · Swimming Pool · Pavilion',
    color: '#CE9A52',
    test: p => p.latitude >= 19.641 && p.latitude < 19.644 && p.longitude > 73.4620,
    lifestyles: ['recreation'],
  },
  {
    id: 'parks',
    name: 'Garden Valley',
    icon: '🌳',
    tagline: 'Oasis Park · Joy Junction · Sanctuary Park',
    color: '#B5D18D',
    test: p => p.latitude >= 19.641 && p.latitude < 19.644 && p.longitude <= 73.4620,
    lifestyles: ['parks'],
  },
  {
    id: 'nature',
    name: 'Forest Ridge',
    icon: '🌲',
    tagline: 'Nature trail · Forest areas · Elevated walkway',
    color: '#7CB974',
    test: p => p.latitude >= 19.644 && p.longitude > 73.462,
    lifestyles: ['nature', 'vistas'],
  },
  {
    id: 'water',
    name: "Water's Edge",
    icon: '💧',
    tagline: 'Canal · Bamboo groves · Forest stream · Viewpoint',
    color: '#4FC3F7',
    test: p => p.latitude >= 19.644 && p.longitude <= 73.462,
    lifestyles: ['water', 'nature'],
  },
];

const LIFESTYLE_OPTIONS = [
  { key: 'recreation', label: 'Recreation', icon: '🏊' },
  { key: 'nature',     label: 'Nature',     icon: '🌲' },
  { key: 'parks',      label: 'Parks',      icon: '🌳' },
  { key: 'water',      label: 'Water',      icon: '💧' },
  { key: 'vistas',     label: 'Vistas',     icon: '🔭' },
  { key: 'access',     label: 'Access',     icon: '🚪' },
];

export function assignPlotZones(plots) {
  const map = {};
  plots.forEach(p => {
    const zone = ZONES.find(z => z.test(p)) || ZONES[0];
    map[p.name] = zone.id;
  });
  return map;
}

function terrainLabel(avgElev, siteMin, siteMax) {
  const range = siteMax - siteMin || 1;
  const pct = (avgElev - siteMin) / range;
  if (pct < 0.33) return { label: 'Valley Floor', icon: '🏞️' };
  if (pct < 0.66) return { label: 'Hillside',     icon: '⛰️' };
  return                { label: 'Ridge',          icon: '🗻' };
}

export default function PlotFinder({ plots, activeZone, onZoneSelect, onZoneClear, plotElevations }) {
  const [open, setOpen] = useState(false);
  const [lifestyle, setLifestyle] = useState(null);

  const zoneAssignment = useMemo(() => assignPlotZones(plots), [plots]);

  const elevHasData = Object.keys(plotElevations).length > 0;

  const { siteMinElev, siteMaxElev } = useMemo(() => {
    const vals = Object.values(plotElevations);
    return vals.length
      ? { siteMinElev: Math.min(...vals), siteMaxElev: Math.max(...vals) }
      : { siteMinElev: 0, siteMaxElev: 1 };
  }, [plotElevations]);

  const zoneStats = useMemo(() => ZONES.map(z => {
    const zonePlots = plots.filter(p => zoneAssignment[p.name] === z.id);
    const available = zonePlots.filter(p => p.status === 'available');
    const prices = available.map(p => p.pr.total);
    const elevVals = zonePlots.map(p => plotElevations[p.name]).filter(e => e != null);
    const avgElev = elevVals.length ? Math.round(elevVals.reduce((a, b) => a + b, 0) / elevVals.length) : null;
    return {
      ...z,
      total: zonePlots.length,
      available: available.length,
      minPrice: prices.length ? Math.min(...prices) : 0,
      plotSet: new Set(zonePlots.map(p => p.name)),
      avgElev,
      terrain: avgElev != null ? terrainLabel(avgElev, siteMinElev, siteMaxElev) : null,
    };
  }), [plots, zoneAssignment, plotElevations, siteMinElev, siteMaxElev]);

  const sortedZones = useMemo(() => {
    if (!lifestyle) return zoneStats;
    return [...zoneStats].sort((a, b) => {
      const am = a.lifestyles.includes(lifestyle) ? 1 : 0;
      const bm = b.lifestyles.includes(lifestyle) ? 1 : 0;
      return bm - am;
    });
  }, [zoneStats, lifestyle]);

  return (
    <div className="finder-wrap">
      <div className="finder-trigger sbs-stagger" onClick={() => setOpen(o => !o)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span className="headline">✦ Best Zone For You</span>
          {activeZone && (
            <span className="finder-active-badge">{activeZone.icon} {activeZone.name}</span>
          )}
        </div>
        <span className="finder-arrow">{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div className="finder-body">
          <div className="finder-q">
            <div className="finder-ql">
              What matters most?
              <span className="finder-hint">optional — reorders zones</span>
            </div>
            <div className="finder-chips">
              {LIFESTYLE_OPTIONS.map(o => (
                <div
                  key={o.key}
                  className={`finder-chip ${lifestyle === o.key ? 'on' : ''}`}
                  onClick={() => setLifestyle(l => l === o.key ? null : o.key)}
                >
                  <span>{o.icon}</span>{o.label}
                </div>
              ))}
            </div>
          </div>

          <div className="zone-list">
            {sortedZones.map(z => {
              const isMatch = lifestyle && z.lifestyles.includes(lifestyle);
              const isActive = activeZone?.id === z.id;
              return (
                <div
                  key={z.id}
                  className={`zone-card ${isActive ? 'zc-active' : ''} ${isMatch ? 'zc-match' : ''}`}
                  style={{ '--zc': z.color }}
                  onClick={() => isActive ? onZoneClear() : onZoneSelect({ id: z.id, name: z.name, color: z.color, icon: z.icon, plotSet: z.plotSet })}
                >
                  <div className="zc-bar" />
                  <div className="zc-icon">{z.icon}</div>
                  <div className="zc-info">
                    <div className="zc-name headline">
                      {z.name}
                      {isMatch && <span className="zc-best">Best Match</span>}
                      {isActive && <span className="zc-active-label">Active</span>}
                    </div>
                    <div className="zc-tag">{z.tagline}</div>
                  </div>
                  <div className="zc-right">
                    <div className="zc-count">{z.available}</div>
                    <div className="zc-avail-label">available</div>
                    {z.minPrice > 0 && <div className="zc-price">{formatCurrency(z.minPrice)}+</div>}
                    {z.terrain && elevHasData && (
                      <div className="zc-terrain" title={`Avg elevation ${z.avgElev}m`}>
                        {z.terrain.icon} <span>{z.terrain.label}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {activeZone && (
            <div className="finder-clear" onClick={onZoneClear}>
              ✕ Show all plots
            </div>
          )}
        </div>
      )}

      <style>{`
        .finder-wrap { border-bottom: 1px solid var(--border); flex-shrink: 0; }
        .finder-trigger { padding: 16px 24px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: background 0.2s; }
        .finder-trigger:hover { background: var(--card-bg); }
        .finder-trigger .headline { font-size: 11px; letter-spacing: 0.2em; color: var(--brand-gold); font-weight: 700; }
        .finder-active-badge { font-size: 9px; color: var(--brand-gold); background: var(--gold-p); padding: 2px 8px; border: 1px solid var(--gold-b); letter-spacing: 0.05em; }
        .finder-arrow { font-size: 9px; color: var(--brand-gold); flex-shrink: 0; }
        .finder-body { padding: 4px 24px 20px; display: flex; flex-direction: column; gap: 14px; }
        .finder-q {}
        .finder-ql { font-size: 9px; color: var(--text-muted); letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 8px; font-weight: 700; display: flex; align-items: center; gap: 8px; }
        .finder-hint { font-size: 8px; color: var(--gray); letter-spacing: 0; text-transform: none; font-weight: 400; }
        .finder-chips { display: flex; flex-wrap: wrap; gap: 6px; }
        .finder-chip { padding: 5px 10px; border: 1px solid var(--border); font-size: 10px; color: var(--text-muted); cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 5px; }
        .finder-chip:hover { border-color: var(--brand-gold); color: var(--text-primary); }
        .finder-chip.on { border-color: var(--brand-gold); background: var(--gold-p); color: var(--brand-gold); font-weight: 700; }
        .zone-list { display: flex; flex-direction: column; gap: 6px; }
        .zone-card { position: relative; background: var(--card-bg); border: 1px solid var(--border); padding: 12px 14px 12px 20px; cursor: pointer; transition: all 0.25s; display: flex; align-items: center; gap: 12px; overflow: hidden; }
        .zone-card:hover { border-color: var(--zc); }
        .zone-card.zc-match { border-color: var(--zc); }
        .zone-card.zc-active { border-color: var(--zc); background: var(--bg-secondary); }
        .zc-bar { position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: var(--zc); opacity: 0.4; transition: opacity 0.3s; }
        .zone-card:hover .zc-bar, .zone-card.zc-match .zc-bar, .zone-card.zc-active .zc-bar { opacity: 1; }
        .zc-icon { font-size: 22px; flex-shrink: 0; }
        .zc-info { flex: 1; min-width: 0; }
        .zc-name { font-size: 13px; font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
        .zc-best { font-size: 8px; background: var(--zc); color: #000; padding: 1px 5px; letter-spacing: 0.1em; text-transform: uppercase; font-weight: 800; }
        .zc-active-label { font-size: 8px; border: 1px solid var(--zc); color: var(--zc); padding: 1px 5px; letter-spacing: 0.1em; text-transform: uppercase; font-weight: 700; }
        .zc-tag { font-size: 10px; color: var(--text-muted); margin-top: 3px; line-height: 1.4; }
        .zc-right { text-align: right; flex-shrink: 0; }
        .zc-count { font-size: 18px; font-family: 'Playfair Display', serif; color: var(--text-primary); font-weight: 700; line-height: 1; }
        .zc-avail-label { font-size: 8px; color: var(--gray); letter-spacing: 0.08em; text-transform: uppercase; margin-top: 2px; }
        .zc-price { font-size: 10px; color: var(--brand-gold); font-weight: 600; margin-top: 4px; }
        .zc-terrain { font-size: 9px; color: var(--text-muted); margin-top: 4px; display: flex; align-items: center; gap: 3px; justify-content: flex-end; }
        .zc-terrain span { letter-spacing: 0.03em; }
        .finder-clear { font-size: 10px; color: var(--gray); cursor: pointer; text-align: center; padding: 4px; transition: color 0.2s; letter-spacing: 0.05em; }
        .finder-clear:hover { color: var(--text-primary); }
      `}</style>
    </div>
  );
}

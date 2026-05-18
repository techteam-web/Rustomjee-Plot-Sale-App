import React, { useEffect, useRef } from 'react';
import { formatCurrency } from '../utils';
import gsap from 'gsap';

export default function Sidebar({ 
  plots, 
  filteredPlots, 
  activeStatus, 
  setActiveStatus, 
  sizeRange, 
  setSizeRange, 
  sizeChip, 
  setSizeChip, 
  activePlot, 
  onPlotClick,
  viewMode,
  setViewMode,
  mapType,
  setMapType
}) {
  const sidebarRef = useRef(null);

  useEffect(() => {
    if (sidebarRef.current) {
      gsap.fromTo(
        sidebarRef.current.querySelectorAll('.sbs-stagger'),
        { opacity: 0, x: -20 },
        { opacity: 1, x: 0, duration: 0.6, stagger: 0.05, ease: "power2.out", clearProps: "all" }
      );
    }
  }, []);

  const availableCount = plots.filter(p => p.status === 'available').length;
  const reservedCount = plots.filter(p => p.status === 'reserved').length;
  const soldCount = plots.filter(p => p.status === 'sold').length;
  const minPrice = Math.min(...plots.map(p => p.pr.total));

  return (
    <div id="sb" ref={sidebarRef}>
      <div className="sbs sbs-stagger">
        <div className="sbt headline">Map View</div>
        <div className="vtrow" style={{ marginBottom: '12px' }}>
          <div className={`vt ${viewMode === '2D' ? 'on' : ''}`} onClick={() => setViewMode('2D')}>2D Map</div>
          <div className={`vt ${viewMode === '3D' ? 'on' : ''}`} onClick={() => setViewMode('3D')}>3D View</div>
        </div>
        <div className="vtrow">
          <div className={`vt ${mapType === 'standard' ? 'on' : ''}`} onClick={() => setMapType('standard')}>Raster</div>
          <div className={`vt ${mapType === 'satellite' ? 'on' : ''}`} onClick={() => setMapType('satellite')}>Satellite</div>
        </div>
      </div>

      <div className="sbs sbs-stagger">
        <div className="sbt headline">Availability</div>
        <div className="leg">
          <div className={`legr ${activeStatus === 'available' ? 'active' : ''}`} onClick={() => setActiveStatus(activeStatus === 'available' ? null : 'available')}>
            <div className="ld" style={{ background: 'var(--brand-green)' }}></div>
            <div className="ll">Available</div>
            <div className="lc">{availableCount}</div>
          </div>
          <div className={`legr ${activeStatus === 'reserved' ? 'active' : ''}`} onClick={() => setActiveStatus(activeStatus === 'reserved' ? null : 'reserved')}>
            <div className="ld" style={{ background: 'var(--brand-gold)' }}></div>
            <div className="ll">Reserved</div>
            <div className="lc">{reservedCount}</div>
          </div>
          <div className={`legr ${activeStatus === 'sold' ? 'active' : ''}`} onClick={() => setActiveStatus(activeStatus === 'sold' ? null : 'sold')}>
            <div className="ld" style={{ background: 'var(--gray)' }}></div>
            <div className="ll">Sold</div>
            <div className="lc">{soldCount}</div>
          </div>
        </div>
      </div>

      <div className="sbs sbs-stagger">
        <div className="sbt headline">Filter by Size (sqft)</div>
        <div className="rrow">
          <span className="rv">{sizeRange[0].toLocaleString()}</span>
          <span className="rv">{sizeRange[1].toLocaleString()}</span>
        </div>
        <div className="range-container">
          <input 
            type="range" min="5000" max="75000" step="500" 
            value={sizeRange[0]} 
            onChange={(e) => setSizeRange([parseInt(e.target.value), sizeRange[1]])}
          />
          <input 
            type="range" min="5000" max="75000" step="500" 
            value={sizeRange[1]} 
            onChange={(e) => setSizeRange([sizeRange[0], parseInt(e.target.value)])}
          />
        </div>
        <div className="chips">
          {['all', 's', 'm', 'l'].map(chip => (
            <div 
              key={chip}
              className={`chip ${sizeChip === chip ? 'on' : ''}`} 
              onClick={() => setSizeChip(chip)}
            >
              {chip === 'all' ? 'All' : chip === 's' ? 'Under 10K' : chip === 'm' ? '10K–30K' : '30K+'}
            </div>
          ))}
        </div>
      </div>

      <div className="sbs sbs-stagger" style={{ paddingBottom: '8px' }}><div className="sbt headline">Plot Inventory</div></div>
      <div id="plist" className="sbs-stagger">
        {filteredPlots.map(p => (
          <div 
            key={p.name}
            className={`pli ${activePlot === p.name ? 'on' : ''}`}
            onClick={() => onPlotClick(p)}
          >
            <div>
              <div className="pln headline">{p.name}</div>
              <div className="plm subhead">{p.area_sqft.toLocaleString()} sqft · {p.cat}</div>
            </div>
            <div>
              <div className="plp">{formatCurrency(p.pr.total)}</div>
              <div className={`pls ${p.status}`}>
                {p.status}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="sbs sbs-stagger" style={{ borderTop: '1px solid var(--border)', borderBottom: 'none' }}>
        <div className="sbt headline">Project Overview</div>
        <div className="sgrid">
          <div className="sc">
            <div className="sv">{plots.length}</div>
            <div className="sl">Total Plots</div>
          </div>
          <div className="sc">
            <div className="sv">{availableCount}</div>
            <div className="sl">Available</div>
          </div>
          <div className="sc">
            <div className="sv">35.6</div>
            <div className="sl">Hectares</div>
          </div>
          <div className="sc">
            <div className="sv">{(minPrice / 10000000).toFixed(2)}</div>
            <div className="sl">From ₹ Cr</div>
          </div>
        </div>
      </div>

      <style>{`
        #sb {
          width: 320px; min-width: 320px; background: var(--brand-black);
          border-right: 1px solid var(--gold-b); display: flex; flex-direction: column; overflow: hidden;
        }
        .sbs { padding: 20px 24px; border-bottom: 1px solid var(--border); }
        .sbt { font-size: 11px; letter-spacing: 0.2em; color: var(--brand-gold); margin-bottom: 16px; font-weight: 600; }
        .sgrid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .sc { background: var(--card-bg); border: 1px solid var(--border); padding: 12px; transition: all 0.3s; }
        .sc:hover { background: var(--gold-p); border-color: var(--gold-b); }
        .sv { font-size: 22px; font-family: 'Playfair Display', serif; color: var(--text-primary); font-weight: 600; }
        .sl { font-size: 9px; color: var(--gray); letter-spacing: 0.1em; text-transform: uppercase; margin-top: 4px; }
        .vtrow { display: flex; gap: 1px; background: var(--gold-b); border: 1px solid var(--gold-b); }
        .vt { flex: 1; padding: 10px; text-align: center; font-size: 10px; letter-spacing: 0.15em; text-transform: uppercase;
              cursor: pointer; background: var(--brand-black); color: var(--gray); transition: all 0.3s; font-weight: 500; }
        .vt.on { background: var(--text-secondary); color: var(--bg-primary); }
        .leg { display: flex; flex-direction: column; gap: 10px; }
        .legr { display: flex; align-items: center; gap: 12px; cursor: pointer; padding: 4px 0; opacity: 0.7; transition: all 0.3s; }
        .legr:hover, .legr.active { opacity: 1; }
        .ld { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .ll { font-size: 12px; color: var(--text-secondary); letter-spacing: 0.05em; font-weight: 500; }
        .lc { margin-left: auto; font-size: 10px; color: var(--brand-gold); font-weight: 600; background: var(--gold-p); padding: 2px 8px; }
        .rrow { display: flex; justify-content: space-between; margin-bottom: 8px; }
        .rv { font-size: 12px; color: var(--brand-gold); font-weight: 600; font-family: 'Inter', sans-serif; }
        .range-container { position: relative; height: 20px; margin-bottom: 12px; }
        input[type=range] { width: 100%; accent-color: var(--brand-gold); height: 2px; cursor: pointer; position: absolute; top: 0; background: transparent; -webkit-appearance: none; }
        input[type=range]::-webkit-slider-runnable-track { background: var(--border); height: 2px; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; height: 12px; width: 12px; border-radius: 50%; background: var(--brand-gold); margin-top: -5px; }
        .chips { display: flex; gap: 6px; margin-top: 12px; overflow-x: auto; padding-bottom: 4px; scrollbar-width: none; }
        .chips::-webkit-scrollbar { display: none; }
        .chip { padding: 6px 10px; border: 1px solid var(--border); font-size: 9px; color: var(--text-muted); cursor: pointer; transition: all 0.3s; text-transform: uppercase; letter-spacing: 0.05em; white-space: nowrap; flex-shrink: 0; }
        .chip.on { border-color: var(--text-secondary); color: var(--bg-primary); background: var(--text-secondary); }
        .chip:hover { border-color: var(--text-secondary); }
        #plist { flex: 1; overflow-y: auto; background: var(--bg-secondary); }
        .pli { padding: 16px 24px; display: flex; align-items: center; justify-content: space-between;
               cursor: pointer; border-bottom: 1px solid var(--border); transition: all 0.3s; }
        .pli:hover { background: var(--card-bg); }
        .pli.on { background: var(--card-bg); border-left: 4px solid var(--text-secondary); }
        .pln { font-size: 14px; font-weight: 600; color: var(--text-primary); }
        .plm { font-size: 11px; color: var(--gray); margin-top: 4px; }
        .plp { font-size: 14px; color: var(--brand-gold); font-weight: 600; text-align: right; }
        .pls { font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase; margin-top: 4px; text-align: right; font-weight: 700; }
        .pls.available { color: var(--brand-green); }
        .pls.sold { color: var(--gray); }
        .pls.reserved { color: var(--brand-gold); }
      `}</style>
    </div>
  );
}

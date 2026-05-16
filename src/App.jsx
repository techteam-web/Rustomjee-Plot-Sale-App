import React, { useState, useMemo } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import Map from './components/Map';
import PlotDetails from './components/PlotDetails';
import MasterplanModal from './components/MasterplanModal';
import { PLOTS_RAW, STATUS_LIST, FACING_LIST, ROAD_LIST, SOLD_NAMES } from './data/plots';
import { calcPrice } from './utils';

const processedPlots = PLOTS_RAW.map((p, i) => {
  const pr = calcPrice(p, i);
  return {
    ...p,
    status: STATUS_LIST[i],
    facing: FACING_LIST[i],
    road: ROAD_LIST[i],
    soldTo: STATUS_LIST[i] === 'sold' ? SOLD_NAMES[i % SOLD_NAMES.length] : null,
    pr,
    cat: pr.premium > 800 ? 'Premium' : pr.premium > 400 ? 'Value+' : 'Standard',
    idx: i + 1
  };
});

function App() {
  const [activePlot, setActivePlot] = useState(null);
  const [activeStatus, setActiveStatus] = useState(null);
  const [sizeRange, setSizeRange] = useState([5000, 75000]);
  const [sizeChip, setSizeChip] = useState('all');
  const [viewMode, setViewMode] = useState('2D');
  const [showMasterplan, setShowMasterplan] = useState(false);

  const filteredPlots = useMemo(() => {
    let fp = [...processedPlots];
    if (activeStatus) fp = fp.filter(p => p.status === activeStatus);
    
    fp = fp.filter(p => p.area_sqft >= sizeRange[0] && p.area_sqft <= sizeRange[1]);
    
    if (sizeChip === 's') fp = fp.filter(p => p.area_sqft < 10000);
    if (sizeChip === 'm') fp = fp.filter(p => p.area_sqft >= 10000 && p.area_sqft <= 30000);
    if (sizeChip === 'l') fp = fp.filter(p => p.area_sqft > 30000);
    
    return fp;
  }, [activeStatus, sizeRange, sizeChip]);

  const selectedPlotData = useMemo(() => {
    return processedPlots.find(p => p.name === activePlot) || null;
  }, [activePlot]);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Header 
        onShowMasterplan={() => setShowMasterplan(true)} 
        onOpenROI={() => {
          if (!activePlot) alert('Please select a plot first to open the ROI calculator.');
          else document.getElementById('roi-section')?.scrollIntoView({ behavior: 'smooth' });
        }}
      />
      
      <div id="app" className="flex flex-1 pt-14">
        <Sidebar 
          plots={processedPlots}
          filteredPlots={filteredPlots}
          activeStatus={activeStatus}
          setActiveStatus={setActiveStatus}
          sizeRange={sizeRange}
          setSizeRange={setSizeRange}
          sizeChip={sizeChip}
          setSizeChip={setSizeChip}
          activePlot={activePlot}
          onPlotClick={(p) => setActivePlot(p.name)}
          viewMode={viewMode}
          setViewMode={setViewMode}
        />
        
        <Map 
          plots={processedPlots}
          filteredPlots={filteredPlots}
          activePlot={activePlot}
          onPlotClick={(p) => setActivePlot(p.name)}
          viewMode={viewMode}
        />
        
        <PlotDetails 
          plot={selectedPlotData} 
          onClose={() => setActivePlot(null)} 
        />
      </div>

      <MasterplanModal 
        show={showMasterplan} 
        onClose={() => setShowMasterplan(false)} 
      />

      <style>{`
        #app { display: flex; height: 100vh; padding-top: 56px; }
      `}</style>
    </div>
  );
}

export default App;

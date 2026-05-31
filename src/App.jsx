import React, { useState, useMemo } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import Map from './components/Map';
import PlotDetails from './components/PlotDetails';
import MasterplanModal from './components/MasterplanModal';
import { PLOT_INVENTORY } from './data/plotInventory';
import { calcPrice } from './utils';

const processedPlots = PLOT_INVENTORY.map((p) => {
  const pr = calcPrice(p);
  return {
    ...p,
    pr,
    cat: pr.premium > 1000 ? 'Imperial' : pr.premium > 850 ? 'Royal' : pr.premium > 750 ? 'Signature' : pr.premium > 500 ? 'Elite' : pr.premium > 250 ? 'Heritage' : 'Classic',
  };
});

function App() {
  const [activePlot, setActivePlot]                   = useState(null);
  const [activeStatus, setActiveStatus]               = useState(null);
  const [sizeRange, setSizeRange]                     = useState([1000, 10000]);
  const [sizeChip, setSizeChip]                       = useState('all');
  const [viewMode, setViewMode]                       = useState('2D');
  const [showMasterplan, setShowMasterplan]           = useState(false);
  const [theme, setTheme]                             = useState('dark');
  const [mapType, setMapType]                         = useState('standard');
  const [masterplanOpacity]     = useState(85);
  const [showMasterplanOverlay] = useState(true);
  const [showMarkers]           = useState(true);
  const [activeZone, setActiveZone]                   = useState(null);
  const [plotElevations, setPlotElevations]           = useState({});
  const [terrainExaggeration, setTerrainExaggeration] = useState(1.5);

  React.useEffect(() => {
    document.body.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  const filteredPlots = useMemo(() => {
    let fp = activeZone
      ? processedPlots.filter(p => activeZone.plotSet.has(p.name))
      : [...processedPlots];
    if (activeStatus) fp = fp.filter(p => p.status === activeStatus);
    fp = fp.filter(p => p.area_sqft >= sizeRange[0] && p.area_sqft <= sizeRange[1]);
    if (sizeChip === 's') fp = fp.filter(p => p.area_sqft < 3000);
    if (sizeChip === 'm') fp = fp.filter(p => p.area_sqft >= 3000 && p.area_sqft <= 6000);
    if (sizeChip === 'l') fp = fp.filter(p => p.area_sqft > 6000);
    return fp;
  }, [activeStatus, sizeRange, sizeChip, activeZone]);

  const selectedPlotData = useMemo(() => {
    return processedPlots.find(p => p.name === activePlot) || null;
  }, [activePlot]);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Header
        theme={theme}
        onToggleTheme={toggleTheme}
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
          mapType={mapType}
          setMapType={setMapType}
          activeZone={activeZone}
          onZoneSelect={setActiveZone}
          onZoneClear={() => setActiveZone(null)}
          plotElevations={plotElevations}
          terrainExaggeration={terrainExaggeration}
          setTerrainExaggeration={setTerrainExaggeration}
        />

        <Map
          plots={processedPlots}
          activePlot={activePlot}
          onPlotClick={(p) => setActivePlot(p.name)}
          viewMode={viewMode}
          mapType={mapType}
          theme={theme}
          masterplanOpacity={masterplanOpacity}
          showMasterplanOverlay={showMasterplanOverlay}
          showMarkers={showMarkers}
          activeZone={activeZone}
          onElevationsLoaded={setPlotElevations}
          terrainExaggeration={terrainExaggeration}
        />

        <PlotDetails
          plot={selectedPlotData}
          onClose={() => setActivePlot(null)}
          theme={theme}
        />
      </div>

      <MasterplanModal
        show={showMasterplan}
        onClose={() => setShowMasterplan(false)}
        theme={theme}
      />

      <style>{`
        #app { display: flex; height: 100vh; padding-top: 64px; flex-direction: row; }
        @media (max-width: 1024px) {
          #app { flex-direction: column-reverse; }
        }
      `}</style>
    </div>
  );
}

export default App;

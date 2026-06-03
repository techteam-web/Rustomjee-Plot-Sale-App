import React, { useState, useMemo, useEffect } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import Map from './components/Map';
import PlotDetails from './components/PlotDetails';
import MasterplanModal from './components/MasterplanModal';
import NeighbourhoodPanel from './components/NeighbourhoodPanel';
import NeighbourhoodMap from './components/NeighbourhoodMap';
import { STATUS_LIST, SOLD_NAMES, AMEN } from './data/plots';
import { calcPrice } from './utils';

function App() {
  const [page, setPage] = useState('home');
  const [processedPlots, setProcessedPlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activePlot, setActivePlot] = useState(null);
  const [activeStatus, setActiveStatus] = useState('available');
  const [sizeRange, setSizeRange] = useState([2000, 12000]);
  const [sizeChip, setSizeChip] = useState('all');
  const [viewMode, setViewMode] = useState('3D');
  const [showMasterplan, setShowMasterplan] = useState(false);
  const [theme, setTheme] = useState('light');
  const [selectedConnectivity, setSelectedConnectivity] = useState(null);
  const [activeZone, setActiveZone] = useState(null);
  const [plotElevations, setPlotElevations] = useState({});

  // Neighbourhood (explore) view state
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [activeTour, setActiveTour] = useState(null);
  const [tourPlayToken, setTourPlayToken] = useState(0);
  const [tourStep, setTourStep] = useState(null);
  const [playing, setPlaying] = useState(false);

  // Load GeoJSON plots + amenities
  useEffect(() => {
    Promise.all([
      fetch('/data/amenities.json').then(r => r.json()),
      fetch('/data/plots.geojson').then(r => r.json()),
    ]).then(([amenData, fc]) => {
      const AMEN_REAL = {
        club: amenData.club,
        park1: amenData.park1,
        park2: amenData.park2,
        water: amenData.water,
      };

      const plots = fc.features
        .filter(f => f.properties.category === 'saleable')
        .map(f => {
          const p = f.properties;
          const center = f.geometry.coordinates;
          const pr = calcPrice({ center, area_sqft: p.areaSqft }, AMEN_REAL);
          const statusIdx = p.plotNo % STATUS_LIST.length;
          return {
            ...p,
            name: `Plot ${p.plotNo}`,
            center,
            latitude: center[1],
            longitude: center[0],
            area_sqft: p.areaSqft,
            area_sqm: p.areaSqm,
            status: STATUS_LIST[statusIdx],
            soldTo: STATUS_LIST[statusIdx] === 'sold' ? SOLD_NAMES[p.plotNo % SOLD_NAMES.length] : null,
            pr,
            cat: pr.premium > 1000 ? 'Imperial' : pr.premium > 850 ? 'Royal'
               : pr.premium > 750 ? 'Signature' : pr.premium > 500 ? 'Elite'
               : pr.premium > 250 ? 'Heritage' : 'Classic',
          };
        });
      setProcessedPlots(plots);
      setLoading(false);
    }).catch(err => {
      console.error('Failed to load plots:', err);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  // Plot and connectivity views are mutually exclusive — selecting one clears the other
  // so their camera animations never fight and no stale highlight lingers.
  const handleSelectPlot = (name) => {
    setActivePlot(name);
    if (name !== null) setSelectedConnectivity(null);
  };

  const handleSelectConnectivity = (idx) => {
    setSelectedConnectivity(idx);
    if (idx !== null && idx !== undefined) setActivePlot(null);
  };

  // Neighbourhood handlers
  const handlePlayTour = (groupId) => {
    setActiveTour(groupId);
    setSelectedPlace(null);
    setTourStep(0);
    setPlaying(true);
    setTourPlayToken((t) => t + 1);
  };
  const handleStopTour = () => {
    setPlaying(false);
  };
  const handleSelectPlace = (id) => {
    setSelectedPlace(id);
    if (id !== null) setPlaying(false);
  };

  const filteredPlots = useMemo(() => {
    let fp = [...processedPlots];
    if (activeStatus) fp = fp.filter(p => p.status === activeStatus);
    fp = fp.filter(p => p.area_sqft >= sizeRange[0] && p.area_sqft <= sizeRange[1]);
    if (sizeChip === 's') fp = fp.filter(p => p.area_sqft < 3500);
    if (sizeChip === 'm') fp = fp.filter(p => p.area_sqft >= 3500 && p.area_sqft <= 5000);
    if (sizeChip === 'l') fp = fp.filter(p => p.area_sqft > 5000);
    return fp;
  }, [processedPlots, activeStatus, sizeRange, sizeChip]);

  const selectedPlotData = useMemo(() => {
    return processedPlots.find(p => p.name === activePlot) || null;
  }, [processedPlots, activePlot]);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Header
        theme={theme}
        onToggleTheme={toggleTheme}
        page={page}
        setPage={setPage}
        onShowMasterplan={() => setShowMasterplan(true)}
        onOpenROI={() => {
          if (!activePlot) alert('Please select a plot first to open the ROI calculator.');
          else document.getElementById('roi-section')?.scrollIntoView({ behavior: 'smooth' });
        }}
      />

      {loading ? (
        <div style={{flex:1, display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg-primary)'}}>
          <div className="headline" style={{color:'var(--brand-gold)'}}>Loading plots…</div>
        </div>
      ) : page === 'explore' ? (
        <div id="app" className="flex flex-1 pt-14">
          <NeighbourhoodPanel
            activeTour={activeTour}
            onPlayTour={handlePlayTour}
            onStopTour={handleStopTour}
            playing={playing}
            tourStep={tourStep}
            selectedPlace={selectedPlace}
            onSelectPlace={handleSelectPlace}
          />
          <NeighbourhoodMap
            theme={theme}
            selectedPlace={selectedPlace}
            tour={activeTour}
            tourPlayToken={tourPlayToken}
            playing={playing}
            onTourStep={setTourStep}
            onTourEnd={handleStopTour}
            onSelectPlace={handleSelectPlace}
          />
        </div>
      ) : (
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
            onPlotClick={(p) => handleSelectPlot(p ? p.name : null)}
            viewMode={viewMode}
            setViewMode={setViewMode}
            theme={theme}
            selectedConnectivity={selectedConnectivity}
            setSelectedConnectivity={handleSelectConnectivity}
            activeZone={activeZone}
            onZoneSelect={setActiveZone}
            onZoneClear={() => setActiveZone(null)}
            plotElevations={plotElevations}
          />

          <Map
            plots={processedPlots}
            activePlot={activePlot}
            onPlotClick={(p) => handleSelectPlot(p ? p.name : null)}
            viewMode={viewMode}
            theme={theme}
            selectedConnectivity={selectedConnectivity}
            activeZone={activeZone}
          />

          <PlotDetails
            plot={selectedPlotData}
            onClose={() => setActivePlot(null)}
            theme={theme}
          />
        </div>
      )}

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

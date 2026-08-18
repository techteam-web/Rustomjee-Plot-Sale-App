import React from 'react';
import Sidebar from '../components/Sidebar';
import Map from '../components/Map';
import PlotDetails from '../components/PlotDetails';

// The plot-selection tool — sidebar filters + interactive map + plot detail panel.
// Lifted verbatim from App.jsx's former "home" view. All plot/map/clustering/camera
// logic is unchanged; the owning state still lives in App and is passed down as props,
// so switching tabs neither refetches data nor drops the current selection/filters.
// This component is purely the layout wrapper for the three pieces.
export default function PlotPage({
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
  theme,
  selectedConnectivity,
  setSelectedConnectivity,
  activeZone,
  onZoneSelect,
  onZoneClear,
  plotElevations,
  selectedPlotData,
  onClosePlot,
}) {
  return (
    <div id="app" className="flex flex-1 pt-14">
      <Sidebar
        plots={plots}
        filteredPlots={filteredPlots}
        activeStatus={activeStatus}
        setActiveStatus={setActiveStatus}
        sizeRange={sizeRange}
        setSizeRange={setSizeRange}
        sizeChip={sizeChip}
        setSizeChip={setSizeChip}
        activePlot={activePlot}
        onPlotClick={onPlotClick}
        viewMode={viewMode}
        setViewMode={setViewMode}
        theme={theme}
        selectedConnectivity={selectedConnectivity}
        setSelectedConnectivity={setSelectedConnectivity}
        activeZone={activeZone}
        onZoneSelect={onZoneSelect}
        onZoneClear={onZoneClear}
        plotElevations={plotElevations}
      />

      <Map
        plots={plots}
        activePlot={activePlot}
        onPlotClick={onPlotClick}
        viewMode={viewMode}
        theme={theme}
        selectedConnectivity={selectedConnectivity}
        activeZone={activeZone}
      />

      <PlotDetails
        plot={selectedPlotData}
        onClose={onClosePlot}
        theme={theme}
      />
    </div>
  );
}

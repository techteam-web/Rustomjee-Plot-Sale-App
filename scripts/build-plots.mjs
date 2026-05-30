import fs from 'fs';
import { readFileSync } from 'fs';
import XLSX from 'xlsx';

const KML_PATH = 'C:\\Users\\arsal\\Downloads\\doc.kml';
const XLSX_PATH = 'C:\\Users\\arsal\\Downloads\\BelleVue_PlotAreaStatement.xlsx';
const OUT_GEOJSON = 'public/data/plots.geojson';
const OUT_AMENITIES = 'public/data/amenities.json';

const STATUS_LIST = [
  'available', 'available', 'sold', 'available', 'reserved', 'available',
  'sold', 'available', 'available', 'sold', 'available', 'reserved',
  'available', 'available', 'sold', 'available', 'reserved', 'available'
];

const NON_SALEABLE = new Set([110, 484, 490, 494, 495, 496, 497, 498, 499, 500, 501, 502, 503, 504, 506, 507, 508, 509, 510]);

const CATEGORY_MAP = {
  110: 'clubhouse',
  484: 'park', 494: 'park', 495: 'park', 496: 'park',
  490: 'infra',
  497: 'garden', 498: 'garden', 499: 'garden', 500: 'garden', 501: 'garden', 502: 'garden', 503: 'garden',
  504: 'playground',
  506: 'stp', 507: 'stp',
  508: 'gwp', 509: 'gwp',
  510: 'landscape',
};

const WATER_POLYGON = [
  [73.46557006, 19.64217444], [73.46529166, 19.64224967], [73.46505636, 19.64233090],
  [73.46490080, 19.64254895], [73.46481175, 19.64270638], [73.46469208, 19.64282419],
  [73.46451482, 19.64309262], [73.46410177, 19.64340340], [73.46365590, 19.64364369],
  [73.46326088, 19.64369631], [73.46295595, 19.64377990], [73.46250183, 19.64390641],
  [73.46211917, 19.64409230], [73.46157667, 19.64436469], [73.46102320, 19.64459172],
  [73.46056697, 19.64484001], [73.46020966, 19.64501411], [73.46002854, 19.64508646],
  [73.45999735, 19.64503566], [73.46019143, 19.64483369], [73.46047499, 19.64470858],
  [73.46078552, 19.64458838], [73.46108154, 19.64438142], [73.46120878, 19.64429371],
  [73.46147797, 19.64427247], [73.46188377, 19.64402107], [73.46208375, 19.64385698],
  [73.46238882, 19.64383833], [73.46257921, 19.64363331], [73.46290681, 19.64358074],
  [73.46341107, 19.64357906], [73.46405876, 19.64326168], [73.46442389, 19.64287254],
  [73.46462375, 19.64248506], [73.46360476, 19.64215947], [73.46319921, 19.64181190],
  [73.46336797, 19.64168214], [73.46356753, 19.64161007], [73.46368753, 19.64173581],
  [73.46384284, 19.64182982], [73.46412200, 19.64194659], [73.46442593, 19.64204553],
  [73.46466171, 19.64212943], [73.46492082, 19.64216068], [73.46507066, 19.64208181],
  [73.46530110, 19.64206082], [73.46544950, 19.64206310], [73.46553413, 19.64206379],
  [73.46557006, 19.64217444]
];

console.log('Building plots geojson from KML + Excel...\n');

// === STEP 1: Parse KML ===
console.log('📄 Reading KML...');
const kmlContent = readFileSync(KML_PATH, 'utf-8');

// Find "Plots" folder
const plotsFolderMatch = kmlContent.match(/<Folder>[\s\S]*?<name>Plots<\/name>[\s\S]*?<\/Folder>/);
if (!plotsFolderMatch) throw new Error('Could not find "Plots" folder in KML');
const plotsFolder = plotsFolderMatch[0];

// Extract all Placemarks from Plots folder
const placemarksRaw = plotsFolder.split('<Placemark>').slice(1);
const placemarks = placemarksRaw.map(block => {
  const nameMatch = block.match(/<name>(.*?)<\/name>/);
  const coordMatch = block.match(/<coordinates>(.*?)<\/coordinates>/);
  if (!nameMatch || !coordMatch) return null;
  const name = nameMatch[1].trim();
  const coordStr = coordMatch[1].trim();
  const parts = coordStr.split(',');
  const plotNo = parseInt(name);
  if (isNaN(plotNo)) return null;
  return { plotNo, lon: parseFloat(parts[0]), lat: parseFloat(parts[1]) };
}).filter(Boolean);

console.log(`  Found ${placemarks.length} numeric placemarks in Plots folder`);

// Dedupe: last occurrence wins for plots 368 and 378
const seen = {};
const dupeLog = {};
placemarks.forEach(p => {
  if (seen[p.plotNo]) {
    dupeLog[p.plotNo] = [seen[p.plotNo], p];  // log both coords
  }
  seen[p.plotNo] = p;
});
const dedupedPlacemarks = Object.values(seen);

// Drop plot 550 (outside inventory range)
const finalPlacemarks = dedupedPlacemarks.filter(p => p.plotNo <= 505);
const droppedPlots = dedupedPlacemarks.filter(p => p.plotNo > 505);

console.log(`  Deduped: ${Object.keys(dupeLog).length} duplicates (${Object.keys(dupeLog).join(', ')})`);
console.log(`  Dropped: ${droppedPlots.length} plots (${droppedPlots.map(p => p.plotNo).join(', ')})`);

// === STEP 2: Parse Excel ===
console.log('\n📊 Reading Excel...');
const workbook = XLSX.readFile(XLSX_PATH);
const sheet = workbook.Sheets['Plot Inventory'];
const rows = XLSX.utils.sheet_to_json(sheet);
const inventoryMap = {};
rows.forEach(row => {
  // Headers are merged cells, so they appear as __EMPTY columns
  const plotNoKey = Object.keys(row)[0];  // First column has Plot No
  const plotNo = parseInt(row[plotNoKey]);
  if (!isNaN(plotNo) && plotNo > 0) {
    const keys = Object.keys(row);
    inventoryMap[plotNo] = {
      type: row[keys[1]] || 'DETACHED',
      areaSqm: parseFloat(row[keys[2]]) || 0,
      areaSqft: parseFloat(row[keys[3]]) || 0,
      cornerArea: parseFloat(row[keys[4]]) || null,
      totalArea: parseFloat(row[keys[5]]) || 0,
      owner: row[keys[6]] || null,
    };
  }
});
console.log(`  Loaded ${Object.keys(inventoryMap).length} inventory entries`);

// === STEP 3: Extract amenity centers ===
console.log('\n🏛️  Extracting amenity centers from KML...');

// Club: plot 110
const clubPin = finalPlacemarks.find(p => p.plotNo === 110);
const clubCenter = clubPin ? [clubPin.lon, clubPin.lat] : null;

// Parks: centroid of 484, 494, 495, 496
const parkPins = finalPlacemarks.filter(p => [484, 494, 495, 496].includes(p.plotNo));
const park1Center = parkPins.length > 0 ? [
  parkPins.reduce((sum, p) => sum + p.lon, 0) / parkPins.length,
  parkPins.reduce((sum, p) => sum + p.lat, 0) / parkPins.length,
] : null;

// Water: centroid of WATER polygon
const waterCenter = [
  WATER_POLYGON.reduce((sum, c) => sum + c[0], 0) / WATER_POLYGON.length,
  WATER_POLYGON.reduce((sum, c) => sum + c[1], 0) / WATER_POLYGON.length,
];

console.log(`  Club (pin 110): [${clubCenter[0].toFixed(6)}, ${clubCenter[1].toFixed(6)}]`);
console.log(`  Park (centroid of 484,494–496): [${park1Center[0].toFixed(6)}, ${park1Center[1].toFixed(6)}]`);
console.log(`  Water (centroid of WATER polygon): [${waterCenter[0].toFixed(6)}, ${waterCenter[1].toFixed(6)}]`);

const amenities = {
  club: clubCenter,
  park1: park1Center || park1Center,  // same for both if only one
  park2: park1Center || park1Center,  // can be split later if needed
  water: waterCenter,
};

// === STEP 4: Build GeoJSON features ===
console.log('\n✨ Building GeoJSON features...');
const features = finalPlacemarks.map((pin, idx) => {
  const inv = inventoryMap[pin.plotNo];
  const statusIdx = pin.plotNo % STATUS_LIST.length;
  const status = STATUS_LIST[statusIdx];
  const category = CATEGORY_MAP[pin.plotNo] || (NON_SALEABLE.has(pin.plotNo) ? 'other' : 'saleable');

  return {
    type: 'Feature',
    id: pin.plotNo,
    geometry: { type: 'Point', coordinates: [pin.lon, pin.lat] },
    properties: {
      plotNo: pin.plotNo,
      name: `Plot ${pin.plotNo}`,
      category: category,
      type: inv?.type || 'DETACHED',
      areaSqm: inv?.areaSqm || 0,
      areaSqft: inv?.areaSqft || 0,
      owner: inv?.owner || null,
      cornerArea: inv?.cornerArea || null,
      status: status,  // Static status field
    }
  };
});

const saleableCount = features.filter(f => f.properties.category === 'saleable').length;
const amenityCount = features.filter(f => f.properties.category !== 'saleable').length;

console.log(`  Total features: ${features.length}`);
console.log(`  Saleable: ${saleableCount}, Amenity/Other: ${amenityCount}`);

// === STEP 5: Write outputs ===
console.log('\n💾 Writing outputs...');

// GeoJSON
const geojson = {
  type: 'FeatureCollection',
  features: features
};
fs.mkdirSync('public/data', { recursive: true });
fs.writeFileSync(OUT_GEOJSON, JSON.stringify(geojson, null, 2));
console.log(`  ✓ ${OUT_GEOJSON} (${features.length} features)`);

// Amenities JSON
fs.writeFileSync(OUT_AMENITIES, JSON.stringify(amenities, null, 2));
console.log(`  ✓ ${OUT_AMENITIES}`);

// === SUMMARY ===
console.log('\n📋 Summary:');
console.log(`  Placemarks in "Plots" folder: ${placemarks.length}`);
console.log(`  After dedup & filter: ${features.length}`);
console.log(`  Deduplicated plots: 368, 378`);
console.log(`  Dropped (>505): 550`);
console.log(`  Unmatched (no xlsx row): ${features.filter(f => !inventoryMap[f.properties.plotNo]).length}`);
console.log(`\n✅ Build complete!`);

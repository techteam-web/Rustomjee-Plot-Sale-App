// Neighbourhood / location-advantages data.
// Source: Kasara_Project_Location_Advantages.pdf (Rustomjee Belle Vie, Kasara).
// Distances are taken VERBATIM from the PDF. Coordinates are [lng, lat]; the
// project origin (Samruddhi connection) is EXACT from the PDF, the rest are
// approximate town/landmark placements (easy to refine — the UI reads generically).

// Project origin — "Samruddhi Highway Connection Coordinates: 19.634989, 73.461891"
export const PROJECT = {
  id: 'belle-vie',
  name: 'Rustomjee Belle Vie',
  category: 'destination',
  coords: [73.461891, 19.634989], // [lng, lat] — exact from PDF
  note: 'Kasara Hills · on the Samruddhi corridor',
};

// Categories drive marker colour + icon (panel + map).
export const CATEGORY_META = {
  destination: { icon: '🏠', color: '#CE9A52', label: 'Project' },
  city:        { icon: '🏙️', color: '#9AA7B8', label: 'City' },
  hill:        { icon: '⛰️', color: '#88C9A1', label: 'Hill Station' },
  station:     { icon: '🚉', color: '#E0C068', label: 'Railway' },
  highway:     { icon: '🛣️', color: '#E0C068', label: 'Highway' },
  airport:     { icon: '✈️', color: '#7FB3D5', label: 'Airport' },
  ghat:        { icon: '🛤️', color: '#A9856B', label: 'Ghat' },
  waterfall:   { icon: '💦', color: '#4FC3F7', label: 'Waterfall' },
  dam:         { icon: '💧', color: '#4FC3F7', label: 'Dam' },
  temple:      { icon: '🛕', color: '#E8A87C', label: 'Temple' },
  fort:        { icon: '🏯', color: '#C8B88A', label: 'Fort' },
};

// Connectivity points (PDF: "Connectivity"). distance is the PDF string.
export const CONNECTIVITY_PLACES = [
  { id: 'mumbai',        name: 'Mumbai',                 category: 'city',    coords: [72.8777, 19.0760], distance: '98 km',         note: 'Financial capital' },
  { id: 'thane',         name: 'Thane',                  category: 'city',    coords: [72.9781, 19.2183], distance: '79 km',         note: 'Via NH-160' },
  { id: 'nashik',        name: 'Nashik',                 category: 'city',    coords: [73.7898, 19.9975], distance: '68 km',         note: 'Wine capital' },
  { id: 'igatpuri',      name: 'Igatpuri',               category: 'hill',    coords: [73.5620, 19.6953], distance: '22 km',         note: 'Nearest hill town' },
  { id: 'mn-highway',    name: 'Mumbai–Nashik Highway',  category: 'highway', coords: [73.4790, 19.6380], distance: '2 km',          note: 'NH-160 access' },
  { id: 'kasara-stn',    name: 'Kasara Railway Station', category: 'station', coords: [73.4836, 19.6403], distance: '2 km',          note: 'Central Line terminus' },
  { id: 'samruddhi',     name: 'Samruddhi Expressway',   category: 'highway', coords: [73.461891, 19.634989], distance: 'Well Connected', note: 'Mumbai–Nagpur corridor' },
  { id: 'nmia',          name: 'Navi Mumbai Airport',    category: 'airport', coords: [73.0780, 18.9970], distance: '100 km',        note: 'Upcoming (NMIA)' },
];

// Scenic tourist spots (PDF: "Scenic Tourist Spots"), ordered by distance.
export const TOURIST_SPOTS = [
  { id: 'kasara-ghat', name: 'Kasara Ghat',          category: 'ghat',      coords: [73.5120, 19.6560], distance: '8 km',    note: 'Thal Ghat viewpoints' },
  { id: 'ashoka',      name: 'Ashoka Waterfall',     category: 'waterfall', coords: [73.5470, 19.6850], distance: '17.3 km', note: 'Monsoon cascade' },
  { id: 'igatpuri-hs', name: 'Igatpuri Hill Station',category: 'hill',      coords: [73.5620, 19.6953], distance: '22.6 km', note: 'Sahyadri hill town' },
  { id: 'vipassana',   name: 'Vipassana Centre',     category: 'temple',    coords: [73.5460, 19.6960], distance: '22.9 km', note: 'Dhamma Giri, Igatpuri' },
  { id: 'bhavali',     name: 'Bhavali Dam',          category: 'dam',       coords: [73.6050, 19.7350], distance: '29.5 km', note: 'Reservoir near Ghoti' },
  { id: 'bhatsa',      name: 'Bhatsa Dam',           category: 'dam',       coords: [73.4470, 19.5240], distance: '32.1 km', note: 'River valley dam' },
  { id: 'vaitarna',    name: 'Vaitarna Dam',         category: 'dam',       coords: [73.4700, 19.7900], distance: '32.3 km', note: 'Upper Vaitarna' },
  { id: 'manas',       name: 'Manas Mandir',         category: 'temple',    coords: [73.3380, 19.4480], distance: '40.3 km', note: 'Shahapur shrine' },
  { id: 'mahuli',      name: 'Mahuli Fort',          category: 'fort',      coords: [73.2680, 19.4900], distance: '52.9 km', note: 'Trekking fort' },
];

// Tours for the "Play Journey" fly-through (camera visits each, total ~5s).
export const TOURS = {
  tourist:      { id: 'tourist',      label: 'Scenic Tourist Tour', places: TOURIST_SPOTS },
  connectivity: { id: 'connectivity', label: 'Connectivity Tour',   places: CONNECTIVITY_PLACES },
};

// Lookup any place (incl. project) by id.
export const ALL_PLACES = [PROJECT, ...CONNECTIVITY_PLACES, ...TOURIST_SPOTS];
export const findPlace = (id) => ALL_PLACES.find((p) => p.id === id) || null;

export default { PROJECT, CONNECTIVITY_PLACES, TOURIST_SPOTS, TOURS, CATEGORY_META, ALL_PLACES, findPlace };

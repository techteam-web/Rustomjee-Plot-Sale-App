// Neighbourhood / location-advantages data.
// Source: Kasara_Project_Location_Advantages.pdf (Rustomjee Belle Vie, Kasara).
// Distances are taken VERBATIM from the PDF. Coordinates are [lng, lat]; the
// project origin (Samruddhi connection) is EXACT from the PDF, the rest are
// approximate town/landmark placements (easy to refine — the UI reads generically).

// Project location — Rustomjee Belle Vie, Kasara Hills (actual site, not the highway point).
export const PROJECT = {
  id: 'belle-vie',
  name: 'Rustomjee Belle Vie',
  category: 'destination',
  coords: [73.457945, 19.639584], // [lng, lat] — given as 19.639584, 73.457945 (lat, lng)
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
// coords verified Jun 2026 against OSM / Wikipedia / Mappls (match Google Maps).
// time = typical driving estimate from Belle Vie (road routing + ghat/traffic buffer).
export const CONNECTIVITY_PLACES = [
  { id: 'mumbai',        name: 'Mumbai',                 category: 'city',    coords: [72.8777, 19.0760],     distance: '98 km',          time: '2h 45m', note: 'Financial capital' },
  { id: 'thane',         name: 'Thane',                  category: 'city',    coords: [72.9781, 19.2183],     distance: '79 km',          time: '2h',     note: 'Via NH-160' },
  { id: 'nashik',        name: 'Nashik',                 category: 'city',    coords: [73.7898, 19.9975],     distance: '68 km',          time: '1h 30m', note: 'Wine capital' },
  { id: 'igatpuri',      name: 'Igatpuri',               category: 'hill',    coords: [73.5620, 19.6953],     distance: '22 km',          time: '30 min', note: 'Nearest hill town' },
  { id: 'mn-highway',    name: 'Mumbai–Nashik Highway',  category: 'highway', coords: [73.4790, 19.6380],     distance: '2 km',           time: '5 min',  note: 'NH-160 access' },
  { id: 'kasara-stn',    name: 'Kasara Railway Station', category: 'station', coords: [73.4836, 19.6403],     distance: '2 km',           time: '10 min', note: 'Central Line terminus' },
  { id: 'samruddhi',     name: 'Samruddhi Expressway',   category: 'highway', coords: [73.461891, 19.634989], distance: 'Well Connected', time: '5 min',  note: 'Mumbai–Nagpur corridor' },
  { id: 'nmia',          name: 'Navi Mumbai Airport',    category: 'airport', coords: [73.0657, 18.9914],     distance: '100 km',         time: '2h 45m', note: 'Upcoming (NMIA)' },
];

// Scenic tourist spots (PDF: "Scenic Tourist Spots"), ordered by distance.
// coords verified Jun 2026 against OSM / Wikipedia / Mappls (match Google Maps).
export const TOURIST_SPOTS = [
  { id: 'kasara-ghat', name: 'Kasara Ghat',          category: 'ghat',      coords: [73.4948, 19.6902], distance: '8 km',    time: '20 min', note: 'Thal Ghat viewpoints' },
  { id: 'ashoka',      name: 'Ashoka Waterfall',     category: 'waterfall', coords: [73.4925, 19.6880], distance: '17.3 km', time: '30 min', note: 'Monsoon cascade' },
  { id: 'igatpuri-hs', name: 'Igatpuri Hill Station',category: 'hill',      coords: [73.5620, 19.6953], distance: '22.6 km', time: '30 min', note: 'Sahyadri hill town' },
  { id: 'vipassana',   name: 'Vipassana Centre',     category: 'temple',    coords: [73.5540, 19.7025], distance: '22.9 km', time: '35 min', note: 'Dhamma Giri, Igatpuri' },
  { id: 'bhavali',     name: 'Bhavali Dam',          category: 'dam',       coords: [73.5906, 19.6351], distance: '29.5 km', time: '40 min', note: 'Reservoir near Ghoti' },
  { id: 'bhatsa',      name: 'Bhatsa Dam',           category: 'dam',       coords: [73.4174, 19.5131], distance: '32.1 km', time: '45 min', note: 'River valley dam' },
  { id: 'vaitarna',    name: 'Vaitarna Dam',         category: 'dam',       coords: [73.5429, 19.8143], distance: '32.3 km', time: '1h',     note: 'Upper Vaitarna' },
  { id: 'manas',       name: 'Manas Mandir',         category: 'temple',    coords: [73.3021, 19.4519], distance: '40.3 km', time: '50 min', note: 'Shahapur shrine' },
  { id: 'mahuli',      name: 'Mahuli Fort',          category: 'fort',      coords: [73.2496, 19.4903], distance: '52.9 km', time: '1h 10m', note: 'Trekking fort' },
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

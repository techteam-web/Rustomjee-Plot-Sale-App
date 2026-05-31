// Single source of truth for the Connectivity feature.
// Consumed by Sidebar.jsx (cards) and Map.jsx (routing + camera).
// Selection is by array index, so ORDER here is the contract — keep it stable.

// Routing origin: Rustomjee Belle Vie, Kasara Hills. [lng, lat]
export const KAASA_CENTER = [73.4621, 19.6428];

export const CONNECTIVITY = [
  {
    id: 'mumbai-city',
    label: 'Mumbai City',
    coords: [72.8347, 18.9388], // [lng, lat]
    distance: '~122 km',
    driveTime: '2.5h',
    icon: '🏙️',
  },
  {
    id: 'navi-mumbai',
    label: 'Navi Mumbai',
    coords: [73.0158, 19.0368],
    distance: '~99 km',
    driveTime: '2h',
    icon: '🌆',
  },
  {
    id: 'nashik',
    label: 'Nashik',
    coords: [73.7910, 19.9973],
    distance: '~65 km',
    driveTime: '1h',
    icon: '🚗',
  },
  {
    id: 'samruddhi',
    label: 'Samruddhi (Highway)',
    coords: [73.5626, 19.6900],
    distance: '~20 km',
    driveTime: '25 min',
    icon: '🛣️',
  },
];

export default CONNECTIVITY;

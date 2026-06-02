import React from 'react';

// Custom, classy duotone icons for each location category — a tasteful
// replacement for the emojis in the Neighbourhood "Location Advantages" panel.
//
// Each glyph is drawn in a 24×24 box, inherits `color` via currentColor (so it
// tints to its category colour, matching the card's left border), and pairs a
// soft fill with a crisp stroke for a premium, high-quality feel at small sizes.

const F = { fill: 'currentColor', fillOpacity: 0.16 }; // soft duotone fill

const ICONS = {
  // Project home / villa (used on the map + as a sensible default)
  destination: (
    <>
      <path {...F} d="M4.5 10.5 L12 4.2 L19.5 10.5 V20 H4.5 Z" />
      <path d="M3 11 L12 4 L21 11" />
      <path d="M5.5 9.8 V20 H18.5 V9.8" />
      <path d="M9.6 20 V13.7 H14.4 V20" />
    </>
  ),

  // City skyline
  city: (
    <>
      <rect {...F} x="3" y="9.5" width="6" height="11" rx="0.6" />
      <rect {...F} x="9" y="4" width="6" height="16.5" rx="0.6" />
      <rect {...F} x="15" y="12.5" width="6" height="8" rx="0.6" />
      <path d="M3 20.5 H21" />
      <path d="M5.3 12.5 h1.2 M5.3 15.5 h1.2 M11 7 h1.2 M11 10 h1.2 M11 13 h1.2 M17.2 15.6 h1.2" />
    </>
  ),

  // Hill station — peaks + sun + snow cap
  hill: (
    <>
      <circle {...F} cx="17.6" cy="7" r="2.3" />
      <path {...F} d="M2 20 L8 9 L12 14 L15 10 L22 20 Z" />
      <path d="M6.2 11.6 L8 9 L9.8 11.6" />
      <path d="M2 20 H22" />
    </>
  ),

  // Railway station — train front
  station: (
    <>
      <rect {...F} x="5.5" y="3.5" width="13" height="14" rx="3.2" />
      <path d="M5.5 11 H18.5" />
      <rect x="8.3" y="6.2" width="7.4" height="3.6" rx="0.8" />
      <circle cx="9" cy="14" r="0.9" fill="currentColor" />
      <circle cx="15" cy="14" r="0.9" fill="currentColor" />
      <path d="M8 17.5 L6.5 21 M16 17.5 L17.5 21" />
      <path d="M4.5 21 H19.5" />
    </>
  ),

  // Highway — road in perspective with centre dashes
  highway: (
    <>
      <path {...F} d="M6 21 L9.7 4.5 H14.3 L18 21 Z" />
      <path d="M3.5 21 H20.5" />
      <path d="M12 6 v2.6 M12 11.2 v3 M12 16.8 v3.2" />
    </>
  ),

  // Airport — clean airplane silhouette (solid reads best at this size)
  airport: (
    <path
      fill="currentColor"
      stroke="none"
      d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"
    />
  ),

  // Ghat — winding switchback road through the hills
  ghat: (
    <>
      <path {...F} d="M2 21 L8 10 L12.5 16 L17 9 L22 21 Z" />
      <path d="M6.5 21 C 10 19 7.5 16 11 14.5 C 14.5 13 12 9.5 15.5 8" />
    </>
  ),

  // Waterfall — cliff ledge, falling streams, pool ripples
  waterfall: (
    <>
      <path {...F} d="M3 3 H12 V6.5 H3 Z" />
      <path d="M5 6.5 q -1.1 4 0 7.5 q 1.1 3 0 5" />
      <path d="M8.5 6.5 q -1.1 4 0 7.5 q 1.1 3 0 5" />
      <path d="M11 6.5 q -1 3.5 0 6.5" />
      <path d="M4 20 q 5 1.6 9 0" />
      <path d="M6 21.3 q 3.5 1.2 6.5 0" />
    </>
  ),

  // Dam — reservoir held by a curved crest, water spilling to the river
  dam: (
    <>
      <path {...F} d="M3 5 H21 V10 Q12 13 3 10 Z" />
      <path d="M3 10 Q12 13 21 10" />
      <path d="M3 10 V13.5 M21 10 V13.5" />
      <path d="M9 12 V18 M12 12.8 V19 M15 12 V18" />
      <path d="M5 20.6 Q12 22 19 20.6" />
    </>
  ),

  // Temple — shikhara tower with kalash finial over a pillared base
  temple: (
    <>
      <path d="M12 2 V4.2" />
      <circle cx="12" cy="4.6" r="0.75" fill="currentColor" />
      <path {...F} d="M9.2 12 C9.2 7.5 12 5.2 12 5.2 C12 5.2 14.8 7.5 14.8 12 Z" />
      <path {...F} d="M6.5 12 H17.5 L16 15 H8 Z" />
      <path d="M8 15 V20 H16 V15" />
      <path d="M10.3 20 V16.5 H13.7 V20" />
      <path d="M5 20 H19" />
    </>
  ),

  // Fort — crenellated rampart with an arched gate and a pennant
  fort: (
    <>
      <path d="M12 9 V5.4" />
      <path d="M12 5.4 H15 L13.7 6.5 L15 7.6 H12 Z" fill="currentColor" fillOpacity="0.55" />
      <path {...F} d="M3 20 V9 H5 V11 H7 V9 H9 V11 H11 V9 H13 V11 H15 V9 H17 V11 H19 V9 H21 V20 Z" />
      <path d="M9.3 20 V15 Q9.3 12.6 12 12.6 Q14.7 12.6 14.7 15 V20" />
      <path d="M3 20.5 H21" />
    </>
  ),
};

// Generic map-pin fallback for any unmapped category.
const FALLBACK = (
  <>
    <path {...F} d="M12 21 C12 21 18 14.5 18 9.5 A6 6 0 1 0 6 9.5 C6 14.5 12 21 12 21 Z" />
    <circle cx="12" cy="9.5" r="2.2" />
  </>
);

export default function PlaceIcon({ category, size = 22, className }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {ICONS[category] || FALLBACK}
    </svg>
  );
}

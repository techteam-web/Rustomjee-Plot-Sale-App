import React from 'react';
import {
  Briefcase, Sprout, Trees, TreePine, Flower, Flower2, Footprints, Route,
  Armchair, Sofa, Waves, Droplets, Landmark, Dumbbell, Baby, Blocks, LandPlot,
  Building2, HeartPulse, Theater, Film, Library, BookOpen, ShieldCheck, MapPin,
} from 'lucide-react';

// Accurate per-amenity icons for the Plot Details list, replacing the generic
// red 📍 pin. Mostly Lucide (already a project dependency); a couple of custom
// line glyphs fill the gaps Lucide lacks (tennis racket, basketball), drawn in
// the same 24-box / stroke style so the set stays visually consistent.

const svgBase = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

const Basketball = ({ size = 24, strokeWidth = 2, ...rest }) => (
  <svg width={size} height={size} strokeWidth={strokeWidth} {...svgBase} {...rest}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 3 V21 M3 12 H21" />
    <path d="M5.6 5.6 C 9 9 9 15 5.6 18.4" />
    <path d="M18.4 5.6 C 15 9 15 15 18.4 18.4" />
  </svg>
);

const TennisRacket = ({ size = 24, strokeWidth = 2, ...rest }) => (
  <svg width={size} height={size} strokeWidth={strokeWidth} {...svgBase} {...rest}>
    <ellipse cx="12" cy="8" rx="5" ry="6" />
    <path d="M12 2.2 V13.8 M7.1 8 H16.9" />
    <path d="M12 14 V21 M10.5 21 H13.5" />
  </svg>
);

// Exact amenity name → icon (most accurate).
const NAME_MAP = {
  'Site Office': Briefcase,
  'Community Garden': Sprout,
  'Open Green Space': Trees,
  'Playground': Blocks,
  'Jogging Track': Footprints,
  'Sitting Area': Armchair,
  'Water Feature': Droplets,
  'Clubhouse': Landmark,
  'Swimming Pool': Waves,
  'Fitness Center': Dumbbell,
  'Tennis Court': TennisRacket,
  'Basketball Court': Basketball,
  'Multi-Purpose Court': LandPlot,
  "Children's Play Area": Baby,
  'Landscaped Garden': Flower2,
  'Park Area': TreePine,
  'Walking Path': Route,
  'Community Hall': Building2,
  'Yoga & Wellness Center': HeartPulse,
  'Amphitheater': Theater,
  'Lounge Area': Sofa,
  'Library': Library,
  'Study Space': BookOpen,
  'Outdoor Theater': Film,
  'Meditation Garden': Flower,
  'Security Gate': ShieldCheck,
};

// Category fallback if a name isn't mapped.
const CATEGORY_MAP = {
  office: Briefcase,
  garden: Sprout,
  park: Trees,
  recreation: Footprints,
  feature: Droplets,
  clubhouse: Landmark,
  recreational: Waves,
  sports: LandPlot,
  wellness: HeartPulse,
  community: Library,
  security: ShieldCheck,
};

export default function AmenityIcon({ name, category, size = 17 }) {
  const Icon = NAME_MAP[name] || CATEGORY_MAP[category] || MapPin;
  return <Icon size={size} strokeWidth={1.8} aria-hidden="true" />;
}

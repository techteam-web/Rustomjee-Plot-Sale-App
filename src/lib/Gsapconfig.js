// Single source of truth for GSAP across the app.
// Imports gsap + the React hook once and registers them here, so components
// import from this module instead of reaching for 'gsap' / '@gsap/react' directly.
//
// Convention (project-wide):
//   - animate with `useGSAP` + `.set()` / `.to()` ONLY — never `.from()` / `.fromTo()`
//   - gate non-essential motion behind `prefers-reduced-motion`
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP);

// Honour the OS "reduce motion" setting once, app-wide.
export const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export { gsap, useGSAP };

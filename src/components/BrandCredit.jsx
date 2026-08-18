import React from 'react';

/**
 * "Powered by Brainwing Innovations" credit mark.
 *
 * Rendered once from App, fixed to the bottom-right corner on every page and
 * every breakpoint. It is always parked inside the map canvas — never on top of
 * another control — because it moves out of the way of the two things that can
 * claim that corner:
 *
 *   · desktop (>1024px) — the plot detail panel is an in-flow 340px column on
 *     the right, so the mark steps left by exactly that width while it is open
 *     (same easing/duration as the panel's own width transition).
 *   · tablet + phone (<=1024px) — #app flips to column-reverse, so the bottom of
 *     the screen belongs to the Sidebar (40vh) / NeighbourhoodPanel (42vh) bottom
 *     sheet. The mark rides just above whichever sheet is on screen.
 *
 * The MapLibre navigation + attribution controls were moved to the map's
 * bottom-left to leave this corner free, and #hint3d is lifted on narrow
 * canvases (see Map.jsx).
 *
 * pointer-events: none — map drag/zoom passes straight through it, so it can
 * never swallow an interaction even where it sits over the canvas. z-index 150
 * keeps it under the header (1000), the mobile full-screen plot panel (200) and
 * the masterplan modal (2000).
 */
export default function BrandCredit({ page = 'home', panelOpen = false, hidden = false }) {
  if (hidden) return null;

  const cls = ['bwm', page === 'explore' ? 'bwm-explore' : '', panelOpen ? 'bwm-shift' : '']
    .filter(Boolean)
    .join(' ');

  return (
    <div className={cls}>
      <img
        src="/Images/Brainwing-logo.webp"
        alt="Powered by Brainwing Innovations"
        width="800"
        height="215"
        decoding="async"
      />

      <style>{`
        .bwm {
          position: fixed;
          right: 18px;
          bottom: 16px;
          /* keep clear of iOS home-indicator / notch in landscape */
          right: calc(18px + env(safe-area-inset-right, 0px));
          bottom: calc(16px + env(safe-area-inset-bottom, 0px));
          z-index: 150;
          line-height: 0;
          pointer-events: none;
          user-select: none;
          -webkit-user-select: none;
          transition: right .4s cubic-bezier(.4,0,.2,1), bottom .3s ease-in-out;
        }
        .bwm img {
          display: block;
          width: clamp(110px, 9vw, 190px);
          height: auto;
          opacity: 0.78;
          /* the mark is pure white with alpha and always sits on the map: satellite
             imagery in most places, but also the bone-coloured masterplan drape.
             A tight dark edge plus a soft halo keeps it legible on both without
             needing a visible plate behind it. */
          filter:
            drop-shadow(0 1px 1px rgba(0,0,0,0.60))
            drop-shadow(0 0 3px rgba(0,0,0,0.55))
            drop-shadow(0 0 14px rgba(0,0,0,0.35));
        }

        /* Desktop — step left of the 340px plot detail panel while it is open. */
        @media (min-width: 1025px) {
          .bwm.bwm-shift {
            right: calc(358px + env(safe-area-inset-right, 0px));
          }
        }

        /* Tablet + phone — the bottom of the viewport is the sidebar sheet, so
           sit just above it, at the bottom-right of the map. */
        @media (max-width: 1024px) {
          .bwm {
            right: calc(12px + env(safe-area-inset-right, 0px));
            bottom: calc(40vh + 10px);
          }
          .bwm.bwm-explore { bottom: calc(42vh + 10px); }
          /* the plot panel goes full-screen here — drop the mark entirely rather
             than let it sit behind the sheet */
          .bwm.bwm-shift { display: none; }
          .bwm img {
            width: clamp(96px, 15vw, 150px);
            opacity: 0.82;
          }
        }

        /* Short landscape phones — the map band is only ~170px tall, so keep the
           mark deliberately small. */
        @media (max-width: 1024px) and (max-height: 460px) {
          .bwm img { width: clamp(88px, 11vw, 124px); }
        }

        @media (prefers-reduced-motion: reduce) {
          .bwm { transition: none; }
        }
      `}</style>
    </div>
  );
}

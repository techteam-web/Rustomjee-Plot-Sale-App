import { useRef } from 'react';
import { gsap, useGSAP, SplitText, prefersReducedMotion } from '../lib/Gsapconfig';

// Video intro / loading splash for Belle Vie (Kasara Hill Estates, Rustomjee).
// Plays fullscreen on first load, reveals three heading segments in sequence
// (each one leaves before the next arrives), then surfaces an "Enter Experience"
// button. All sequencing is driven off the <video> element via refs + GSAP
// callbacks — never React state — so the choreography stays in lockstep with the
// footage and re-renders cannot retrigger it.

// The three heading beats. Timings below assume a ~14s reference cut; the master
// timeline is timeScale'd to the real duration on loadedmetadata, so the beats
// land proportionally on a shorter or longer video. (Middots, never em dashes.)
const SEGMENTS = [
  { heading: 'A Life Above the Ordinary', sub: 'Kasara Hill Estates, Rustomjee' },
  { heading: 'Where Nature Meets Refinement', sub: 'Private Hill Residences · Western Ghats' },
  { heading: 'Belle Vue', sub: 'The Beautiful Life' },
];

const DESIGN_TOTAL = 14;     // seconds the timings below are authored against
const NO_VIDEO_SECONDS = 9;  // brisk self-driven length when no video is available

export default function IntroScreen({ onComplete }) {
  const rootRef = useRef(null);
  const videoRef = useRef(null);
  const headingRefs = useRef([]); // <h1> per segment
  const subRefs = useRef([]);     // subheading per segment
  const buttonRef = useRef(null);

  // GSAP / playback bookkeeping (refs, not state — these must never re-render).
  const tlRef = useRef(null);          // paused master timeline for the heading beats
  const splitsRef = useRef([]);        // SplitText instances per heading
  const scaleRef = useRef(0);          // timeScale derived from real video duration
  const safetyRef = useRef(null);      // delayedCall fallback if the video never plays
  const startedRef = useRef(false);    // has playback begun (first timeupdate)
  const readyRef = useRef(false);      // is the split + timeline built
  const buttonShownRef = useRef(false); // has the Enter button been revealed (idempotent)
  const exitingRef = useRef(false);    // is the exit fade running
  const revealRef = useRef(null);      // reveal-button fn, called from video events
  const exitRef = useRef(null);        // exit fn, called from the button click
  const beginRef = useRef(null);       // starts the heading sequence (play / error / fallback)

  useGSAP(() => {
    let cancelled = false;

    // ---- initial hidden states (set before first paint, no SplitText needed yet)
    gsap.set(headingRefs.current.filter(Boolean), { opacity: 0 });
    gsap.set(subRefs.current.filter(Boolean), { opacity: 0, letterSpacing: '0.4em' });
    gsap.set(buttonRef.current, { opacity: 0, y: prefersReducedMotion ? 0 : 20 });

    // Fade the currently-shown heading out and bring the button in. Idempotent so
    // it can be fired by both onEnded and the timeline tail without doubling up.
    const playButton = () => {
      if (buttonShownRef.current || exitingRef.current) return;
      buttonShownRef.current = true;
      const tl = gsap.timeline();
      if (!prefersReducedMotion) {
        const i = SEGMENTS.length - 1; // the last heading is the one on screen
        const lines = splitsRef.current[i] && splitsRef.current[i].lines;
        const sub = subRefs.current[i];
        if (lines) tl.to(lines, { opacity: 0, y: -18, duration: 0.7, ease: 'power2.in', stagger: 0.06 }, 0);
        if (sub) tl.to(sub, { opacity: 0, duration: 0.5, ease: 'power2.in' }, 0);
      }
      tl.to(
        buttonRef.current,
        { opacity: 1, y: 0, duration: prefersReducedMotion ? 0.5 : 1.2, ease: 'power3.out' },
        prefersReducedMotion ? 0 : 0.4
      );
    };
    revealRef.current = playButton;

    // Fade the whole splash out, then hand control back to the app.
    exitRef.current = () => {
      if (exitingRef.current) return;
      exitingRef.current = true;
      if (videoRef.current) { try { videoRef.current.pause(); } catch { /* ignore */ } }
      gsap.to(rootRef.current, {
        opacity: 0,
        duration: 0.8,
        ease: 'power2.inOut',
        onComplete: () => { if (typeof onComplete === 'function') onComplete(); },
      });
    };

    // ---- per-heading IN / OUT (the OUT is lighter and quicker, not a mirror)
    const headingIn = (tl, i, at) => {
      const lines = splitsRef.current[i] && splitsRef.current[i].lines;
      const sub = subRefs.current[i];
      if (lines) {
        tl.to(lines, {
          opacity: 1, y: 0, clipPath: 'inset(0 0 0% 0)',
          duration: 1.1, ease: 'expo.out', stagger: 0.12,
        }, at);
      }
      // Subheading trails the heading slightly, settling its letter-spacing in.
      if (sub) tl.to(sub, { opacity: 1, letterSpacing: '0.25em', duration: 1.4, ease: 'power3.out' }, at + 0.25);
    };
    const headingOut = (tl, i, at) => {
      const lines = splitsRef.current[i] && splitsRef.current[i].lines;
      const sub = subRefs.current[i];
      if (lines) tl.to(lines, { opacity: 0, y: -18, duration: 0.7, ease: 'power2.in', stagger: 0.06 }, at);
      if (sub) tl.to(sub, { opacity: 0, duration: 0.5, ease: 'power2.in' }, at);
    };

    const buildSequence = () => {
      const tl = gsap.timeline({ paused: true });
      headingIn(tl, 0, 1);   // "A Life Above the Ordinary" — in ~1s
      headingOut(tl, 0, 4);  //                              — out ~4s
      headingIn(tl, 1, 5);   // "Where Nature Meets Refinement" — in ~5s
      headingOut(tl, 1, 9);  //                                 — out ~9s
      headingIn(tl, 2, 10);  // "Belle Vie" — in ~10s, then holds until the video ends
      // If the cut runs long, still surface the button near the reference end.
      tl.call(playButton, null, DESIGN_TOTAL - 0.2);
      return tl;
    };

    // Resolve playback rate: a real video sets scaleRef from its duration; with no
    // usable video we fall back to a brisk self-driven pace so the splash still runs.
    const applyScale = () => {
      if (tlRef.current) tlRef.current.timeScale(scaleRef.current || DESIGN_TOTAL / NO_VIDEO_SECONDS);
    };

    // Build SplitText + the timeline. Deferred until fonts are ready so line
    // breaks are measured against Cormorant Garamond, not a fallback face.
    const build = () => {
      if (cancelled) return;
      try {
        splitsRef.current.forEach((s) => s && s.revert()); // clear any stale split (StrictMode)
        splitsRef.current = headingRefs.current.map((el) =>
          el ? new SplitText(el, { type: 'lines', linesClass: 'intro-line' }) : null
        );
        splitsRef.current.forEach((s) => {
          if (s) gsap.set(s.lines, { opacity: 0, y: 30, clipPath: 'inset(0 0 100% 0)' });
        });
        gsap.set(headingRefs.current.filter(Boolean), { opacity: 1 }); // reveal containers; lines stay hidden
        tlRef.current = buildSequence();
        applyScale();
        readyRef.current = true;
        if (startedRef.current) tlRef.current.play(0); // playback already begun — catch up
      } catch (err) {
        // Splitting should never fail for this copy, but never trap the visitor.
        console.warn('IntroScreen: heading split failed, revealing the button.', err);
        readyRef.current = true;
        gsap.delayedCall(0.6, () => revealRef.current && revealRef.current());
      }
    };

    // Start the heading sequence exactly once, however it is triggered (video
    // playing, video error, or the fallback timer below).
    const beginSequence = () => {
      if (startedRef.current) return;
      startedRef.current = true;
      if (tlRef.current) { applyScale(); tlRef.current.play(0); }
      // If the timeline is not built yet, build() will play it once it is ready.
    };
    beginRef.current = beginSequence;

    if (prefersReducedMotion) {
      // Reduced motion: skip the choreography. Show the final beat statically and
      // ease only the button's opacity in shortly after.
      const last = SEGMENTS.length - 1;
      if (headingRefs.current[last]) gsap.set(headingRefs.current[last], { opacity: 1 });
      if (subRefs.current[last]) gsap.set(subRefs.current[last], { opacity: 1, letterSpacing: '0.25em' });
      safetyRef.current = gsap.delayedCall(0.6, () => revealRef.current && revealRef.current());
    } else {
      const fontsReady =
        typeof document !== 'undefined' && document.fonts && document.fonts.ready
          ? document.fonts.ready
          : null;
      if (fontsReady && typeof fontsReady.then === 'function') fontsReady.then(build);
      else build();
      // The video drives the sequence, but if it never reports playback (missing
      // file, blocked autoplay, decode error) we start it ourselves so the splash
      // animates over its backdrop rather than sitting on a dead frame.
      safetyRef.current = gsap.delayedCall(4, () => beginRef.current && beginRef.current());
    }

    return () => {
      cancelled = true;
      if (safetyRef.current) { safetyRef.current.kill(); safetyRef.current = null; }
      if (tlRef.current) { tlRef.current.kill(); tlRef.current = null; }
      splitsRef.current.forEach((s) => s && s.revert());
      splitsRef.current = [];
      readyRef.current = false;
      startedRef.current = false;
      buttonShownRef.current = false;
    };
  }, { scope: rootRef });

  // ---- thin video-driven handlers (no state; they only poke refs / timelines)

  // React only sets the `muted` attribute, not the DOM property, so we set the
  // property ourselves. Without it the browser can treat the video as unmuted and
  // block autoplay — which shows up as "the video won't play on reload".
  const setVideoRef = (el) => {
    videoRef.current = el;
    if (el) el.muted = true;
  };

  const tryPlay = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    const p = v.play();
    if (p && typeof p.catch === 'function') p.catch(() => { /* blocked — the safety net still runs the splash */ });
  };

  const handleLoadedMetadata = () => {
    const v = videoRef.current;
    if (!v) return;
    const d = v.duration;
    if (d && isFinite(d) && d > 0) {
      // Speed the beats up for a short cut, but never stretch them across a long
      // brand film: past the reference length the beats finish, the button
      // appears, and the footage simply keeps rolling behind it.
      const scale = d < DESIGN_TOTAL ? DESIGN_TOTAL / d : 1;
      scaleRef.current = scale;
      if (tlRef.current) tlRef.current.timeScale(scale);
    }
    tryPlay();
  };

  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (v && v.currentTime > 0 && beginRef.current) beginRef.current(); // begin is idempotent
  };

  // Missing file / unsupported source / decode failure: don't strand the visitor
  // on the backdrop — run the sequence self-driven (the button still arrives).
  const handleError = () => { if (beginRef.current) beginRef.current(); };
  const handleEnded = () => { if (revealRef.current) revealRef.current(); };
  const handleEnter = () => { if (exitRef.current) exitRef.current(); };

  return (
    <div ref={rootRef} className="intro-root" aria-label="Belle Vue intro">
      <video
        ref={setVideoRef}
        className="intro-video"
        src="/videos/rustomjee-intro.mp4"
        muted
        autoPlay
        playsInline
        preload="auto"
        onLoadedMetadata={handleLoadedMetadata}
        onCanPlay={tryPlay}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onError={handleError}
      />
      <div className="intro-overlay" />

      <div className="intro-text">
        {SEGMENTS.map((seg, i) => (
          <div className="intro-heading-block" key={seg.heading}>
            <h1 className="intro-heading" ref={(el) => { headingRefs.current[i] = el; }}>
              {seg.heading}
            </h1>
            <p className="intro-sub" ref={(el) => { subRefs.current[i] = el; }}>
              {seg.sub}
            </p>
          </div>
        ))}
      </div>

      <div className="intro-enter-wrap">
        <button ref={buttonRef} className="intro-enter" type="button" onClick={handleEnter}>
          Enter Experience
        </button>
      </div>

      <style>{`
        .intro-root {
          position: fixed; inset: 0;
          /* Header is z-index:1000 and the masterplan modal 2000 — sit above both so
             the splash truly covers the viewport (the brief's "z-50" would not). */
          z-index: 9000;
          /* Warm espresso backdrop so the splash reads as intentional even before
             (or without) the video — never a flat dead black. */
          background: radial-gradient(circle at 50% 38%, #251e15 0%, #16120c 58%, #0c0a07 100%);
          overflow: hidden;
        }
        .intro-video {
          position: absolute; inset: 0;
          width: 100%; height: 100%;
          object-fit: cover;
          display: block;
        }
        .intro-overlay {
          position: absolute; inset: 0;
          background: rgba(0, 0, 0, 0.30); /* keeps the type legible over the footage */
        }
        .intro-text {
          position: absolute; inset: 0;
          pointer-events: none;
        }
        .intro-heading-block {
          position: absolute; top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          width: min(90vw, 1100px);
          text-align: center;
        }
        .intro-heading {
          font-family: 'Cormorant Garamond', serif;
          font-style: italic;
          font-weight: 300;
          color: #F4EFE4;
          font-size: clamp(2.4rem, 6vw, 5.4rem);
          line-height: 1.04;
          letter-spacing: 0.01em;
          text-transform: none;
          margin: 0;
          will-change: opacity;
        }
        .intro-sub {
          font-family: 'Sora', sans-serif;
          font-weight: 300;
          color: #DAD4C6;
          font-size: clamp(0.7rem, 1.15vw, 0.95rem);
          letter-spacing: 0.25em;
          text-transform: uppercase;
          margin: 1.3rem 0 0;
        }
        .intro-enter-wrap {
          position: absolute; top: 65vh; left: 0; right: 0;
          display: flex; justify-content: center;
          pointer-events: none;
        }
        .intro-enter {
          pointer-events: auto;
          /* Solid warm-dark fill so the footage never shows through the button. */
          background: #15110B;
          border: 1px solid rgba(206, 154, 82, 0.75);
          color: #CE9A52;
          font-family: 'Sora', sans-serif;
          font-weight: 300;
          font-size: 0.8rem;
          letter-spacing: 0.35em;
          text-indent: 0.35em; /* balance the trailing tracking */
          text-transform: uppercase;
          padding: 17px 46px;
          cursor: pointer;
          transition: background-color 0.45s ease, border-color 0.45s ease, color 0.45s ease;
          animation: intro-enter-glow 2.8s ease-in-out infinite;
        }
        /* Premium flip on hover: the plate fills gold, the type goes dark. */
        .intro-enter:hover {
          background: #CE9A52;
          border-color: #CE9A52;
          color: #15110B;
        }
        @keyframes intro-enter-glow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(206, 154, 82, 0); }
          50% { box-shadow: 0 0 26px 2px rgba(206, 154, 82, 0.30); }
        }
        @media (prefers-reduced-motion: reduce) {
          .intro-enter { animation: none; }
        }
        @media (max-width: 768px) {
          .intro-enter-wrap { top: 70vh; }
          .intro-enter { font-size: 0.7rem; padding: 14px 30px; letter-spacing: 0.28em; }
        }
      `}</style>
    </div>
  );
}

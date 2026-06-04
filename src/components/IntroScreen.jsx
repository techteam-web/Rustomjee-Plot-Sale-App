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

const DESIGN_TOTAL = 12;      // seconds the timings below are authored against (matches the cut)
const NO_VIDEO_SECONDS = 10;  // self-driven length when no video is available

// Final-sequence timing (Issue 2), measured back from the ACTUAL video duration.
const BUTTON_IN_DURATION = 1.4; // Enter button fade-in (the last heading stays on screen)

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
  const timersRef = useRef([]);        // gsap.delayedCalls to cancel on cleanup
  const startedRef = useRef(false);    // has playback begun (first timeupdate)
  const readyRef = useRef(false);      // is the split + timeline built
  const exitingRef = useRef(false);    // is the exit fade running
  const revealRef = useRef(null);      // button-reveal fn (video-end milestone / fallback)
  const exitRef = useRef(null);        // exit fn, called from the button click
  const beginRef = useRef(null);       // starts the heading sequence (play / error / fallback)
  // Video-end synchronisation (Issue 2): button-reveal milestone from the real duration.
  const buttonRevealStartRef = useRef(null); // currentTime at which the button reveals
  const buttonHasRevealed = useRef(false);   // milestone fired (idempotent)

  useGSAP(() => {
    let cancelled = false;

    // Track every delayedCall so cleanup can cancel them (StrictMode / unmount).
    const timer = (delay, fn) => {
      const t = gsap.delayedCall(delay, fn);
      timersRef.current.push(t);
      return t;
    };

    // ---- initial hidden states (set before first paint, no SplitText needed yet).
    // force3D pins each element onto its own GPU layer so transforms composite
    // cleanly (no sub-pixel stutter on the fades).
    gsap.set(headingRefs.current.filter(Boolean), { opacity: 0, force3D: true });
    gsap.set(subRefs.current.filter(Boolean), { opacity: 0, letterSpacing: '0.4em', force3D: true });
    gsap.set(buttonRef.current, { opacity: 0, y: prefersReducedMotion ? 0 : 14, force3D: true });

    // Bring the Enter button in. Idempotent, so the timeupdate milestone and the
    // onEnded fallback can both call it safely.
    const playButton = () => {
      if (buttonHasRevealed.current || exitingRef.current) return;
      buttonHasRevealed.current = true;
      gsap.set(buttonRef.current, { opacity: 0, y: prefersReducedMotion ? 0 : 14, force3D: true });
      gsap.to(buttonRef.current, {
        opacity: 1,
        y: 0,
        duration: BUTTON_IN_DURATION,
        ease: 'power2.out',
        force3D: true,
      });
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
        force3D: true,
        onComplete: () => { if (typeof onComplete === 'function') onComplete(); },
      });
    };

    // ---- per-heading IN / OUT — slow and fade-led: opacity carries the motion
    // with only a whisper of vertical drift (no hard wipes). power2.out breathes
    // into its final position (gentler tail than expo) to avoid sub-pixel stutter.
    const headingIn = (tl, i, at) => {
      const lines = splitsRef.current[i] && splitsRef.current[i].lines;
      const sub = subRefs.current[i];
      if (lines) tl.to(lines, {
        opacity: 1, y: 0, duration: 2.0, ease: 'power2.out', stagger: 0.14, force3D: true,
        onComplete: () => {
          // Settled — drop the GPU hint so it doesn't pin a layer for the whole intro.
          if (headingRefs.current[i]) headingRefs.current[i].style.willChange = 'auto';
          if (subRefs.current[i]) subRefs.current[i].style.willChange = 'auto';
        },
      }, at);
      // Subheading trails the heading, easing its letter-spacing in.
      if (sub) tl.to(sub, { opacity: 1, letterSpacing: '0.26em', duration: 1.0, ease: 'power2.out', force3D: true }, at + 0.3);
    };
    const headingOut = (tl, i, at) => {
      const lines = splitsRef.current[i] && splitsRef.current[i].lines;
      const sub = subRefs.current[i];
      if (lines) tl.to(lines, { opacity: 0, y: -10, duration: 1.25, ease: 'power1.inOut', stagger: 0.08, force3D: true }, at);
      if (sub) tl.to(sub, { opacity: 0, duration: 1.05, ease: 'power1.inOut', force3D: true }, at);
    };

    const buildSequence = () => {
      const tl = gsap.timeline({ paused: true });
      headingIn(tl, 0, 0.6);   // "A Life Above the Ordinary"
      headingOut(tl, 0, 3.1);
      headingIn(tl, 1, 4.4);   // "Where Nature Meets Refinement"
      headingOut(tl, 1, 6.9);
      headingIn(tl, 2, 8.2);   // last heading — stays on screen; the button reveal
                               // is driven by the video-end milestone, not this timeline.
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
          if (s) gsap.set(s.lines, { opacity: 0, y: 16, force3D: true });
        });
        gsap.set(headingRefs.current.filter(Boolean), { opacity: 1, force3D: true }); // reveal containers; lines stay hidden
        tlRef.current = buildSequence();
        applyScale();
        readyRef.current = true;
        if (startedRef.current) tlRef.current.play(0); // playback already begun — catch up
      } catch (err) {
        // Splitting should never fail for this copy, but never trap the visitor.
        console.warn('IntroScreen: heading split failed, revealing the button.', err);
        readyRef.current = true;
        timer(0.6, () => revealRef.current && revealRef.current());
      }
    };

    // Start the heading sequence exactly once, however it is triggered (video
    // playing, video error, or the fallback timer below).
    const beginSequence = () => {
      if (startedRef.current) return;
      startedRef.current = true;
      if (tlRef.current) { applyScale(); tlRef.current.play(0); }
      // No real video duration (missing / errored): the timeupdate milestone can't
      // fire, so reveal the button on a timer instead.
      if (buttonRevealStartRef.current == null) {
        timer(NO_VIDEO_SECONDS - BUTTON_IN_DURATION, () => revealRef.current && revealRef.current());
      }
      // If the timeline is not built yet, build() will play it once it is ready.
    };
    beginRef.current = beginSequence;

    if (prefersReducedMotion) {
      // Reduced motion: skip the choreography. Show the final beat statically and
      // ease only the button's opacity in shortly after.
      const last = SEGMENTS.length - 1;
      if (headingRefs.current[last]) gsap.set(headingRefs.current[last], { opacity: 1, force3D: true });
      if (subRefs.current[last]) gsap.set(subRefs.current[last], { opacity: 1, letterSpacing: '0.25em', force3D: true });
      timer(0.6, () => revealRef.current && revealRef.current());
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
      timer(4, () => beginRef.current && beginRef.current());
    }

    return () => {
      cancelled = true;
      timersRef.current.forEach((t) => t && t.kill());
      timersRef.current = [];
      if (tlRef.current) { tlRef.current.kill(); tlRef.current = null; }
      splitsRef.current.forEach((s) => s && s.revert());
      splitsRef.current = [];
      readyRef.current = false;
      startedRef.current = false;
      buttonHasRevealed.current = false;
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
      // brand film: past the reference length the beats finish at the authored pace.
      const scale = d < DESIGN_TOTAL ? DESIGN_TOTAL / d : 1;
      scaleRef.current = scale;
      if (tlRef.current) tlRef.current.timeScale(scale);
      // Button-reveal milestone derived from the ACTUAL duration (Issue 2):
      buttonRevealStartRef.current = d - BUTTON_IN_DURATION; // button settles as the last frame hits
    }
    tryPlay();
  };

  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.currentTime > 0 && beginRef.current) beginRef.current(); // begin is idempotent
    // Reveal the button off the ACTUAL playhead so it settles as the video ends.
    const t = v.currentTime;
    if (!buttonHasRevealed.current && buttonRevealStartRef.current != null && t >= buttonRevealStartRef.current) {
      if (revealRef.current) revealRef.current();
    }
  };

  // Missing file / unsupported source / decode failure: don't strand the visitor
  // on the backdrop — run the sequence self-driven (the finale still arrives).
  const handleError = () => { if (beginRef.current) beginRef.current(); };
  // Fallback only: if timeupdate fired late, make sure the button is in by the end.
  const handleEnded = () => {
    if (!buttonHasRevealed.current && revealRef.current) revealRef.current();
  };
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
          /* GPU compositing hints — keep transforms on their own layer and stop
             sub-pixel text shimmer during the fades. Cleared once the IN settles. */
          will-change: transform;
          backface-visibility: hidden;
          -webkit-font-smoothing: antialiased;
        }
        .intro-line { backface-visibility: hidden; }
        .intro-sub {
          font-family: 'Sora', sans-serif;
          font-weight: 300;
          color: #DAD4C6;
          font-size: clamp(0.7rem, 1.15vw, 0.95rem);
          letter-spacing: 0.25em;
          text-transform: uppercase;
          margin: 1.3rem 0 0;
          will-change: transform;
          backface-visibility: hidden;
          -webkit-font-smoothing: antialiased;
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
        @media (max-width: 480px) {
          /* Smallest phones: ease the floor so the longest heading stays tidy. */
          .intro-heading { font-size: clamp(1.9rem, 9vw, 2.5rem); }
          .intro-sub { font-size: 0.66rem; letter-spacing: 0.2em; }
        }
        /* The base heading clamp tops out ~1440px. Scale the hero up on large
           displays so it still commands the frame on 3xl / 4xl / 5xl screens.
           (Breakpoints mirror index.css: 1920 / 2560 / 3200.) */
        @media (min-width: 1920px) { /* 3xl */
          .intro-heading-block { width: min(88vw, 1440px); }
          .intro-heading { font-size: clamp(5.4rem, 5.2vw, 7rem); }
          .intro-sub { font-size: clamp(0.95rem, 0.95vw, 1.25rem); }
          .intro-enter { font-size: 0.95rem; padding: 20px 58px; }
        }
        @media (min-width: 2560px) { /* 4xl */
          .intro-heading-block { width: min(86vw, 1800px); }
          .intro-heading { font-size: clamp(7rem, 5vw, 9rem); }
          .intro-sub { font-size: clamp(1.25rem, 0.9vw, 1.6rem); margin-top: 1.8rem; }
          .intro-enter { font-size: 1.15rem; padding: 24px 70px; letter-spacing: 0.4em; }
        }
        @media (min-width: 3200px) { /* 5xl */
          .intro-heading-block { width: min(84vw, 2200px); }
          .intro-heading { font-size: clamp(9rem, 4.8vw, 11rem); }
          .intro-sub { font-size: clamp(1.6rem, 0.85vw, 2rem); margin-top: 2.4rem; }
          .intro-enter { font-size: 1.4rem; padding: 30px 86px; }
        }
      `}</style>
    </div>
  );
}

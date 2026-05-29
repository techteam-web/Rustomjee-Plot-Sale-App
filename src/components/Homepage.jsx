import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { MapPin, ArrowRight, ArrowDown, Compass, Trees, Droplets, Building2, Footprints, Mountain } from 'lucide-react';
import { CITIES } from '../data/plots';

const CATEGORIES = [
  { name: 'Imperial', tag: 'The Crown', desc: 'The crown of Belle Vie, with expansive frontages framed by the finest hill and water vistas.' },
  { name: 'Royal', tag: 'Grand Living', desc: 'Grand plots moments from the clubhouse, embraced by landscaped greens.' },
  { name: 'Signature', tag: 'Distinctive', desc: 'Distinctive corner and park-facing parcels with elevated privacy.' },
  { name: 'Elite', tag: 'Boulevard', desc: 'Generously sized homesites lining the central tree-shaded boulevard.' },
  { name: 'Heritage', tag: 'Family', desc: 'Classic family homesites nestled within the gated forest enclave.' },
  { name: 'Classic', tag: 'The Address', desc: 'Thoughtfully scaled plots that make the perfect first step into the Rustomjee address.' },
];

const AMENITIES = [
  { Icon: Building2, title: 'Signature Clubhouse', desc: 'A world-class Rustomjee clubhouse at the heart of the estate.' },
  { Icon: Trees, title: 'Two Forest Parks', desc: 'Over 41,000 sqm of landscaped greens and quiet groves.' },
  { Icon: Droplets, title: 'Natural Water Stream', desc: 'A living water edge winding gently through the neighbourhood.' },
  { Icon: Footprints, title: 'Nature Trails', desc: 'Walking and cycling trails threading the hillside.' },
  { Icon: Compass, title: '15m Boulevards', desc: 'Wide, tree-lined avenues designed for an unhurried life.' },
  { Icon: Mountain, title: 'Sahyadri Vistas', desc: 'Uninterrupted panoramas of the Western Ghats.' },
];

export default function Homepage({ plots, onExplore, onShowMasterplan }) {
  const rootRef = useRef(null);
  const heroRef = useRef(null);
  const bgRef = useRef(null);

  const minPrice = plots && plots.length ? Math.min(...plots.map(p => p.pr.total)) : 0;
  const startFrom = (minPrice / 10000000);

  const STATS = [
    { value: plots ? plots.length : 18, label: 'Estate Plots', decimals: 0 },
    { value: 35.6, label: 'Hectares', decimals: 1 },
    { value: 6, label: 'Collections', decimals: 0 },
    { value: startFrom, label: 'From ₹ Cr', decimals: 2 },
  ];

  // Hero entrance timeline
  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      tl.from('.hero-eyebrow', { y: 24, opacity: 0, duration: 0.7 })
        .from('.hero-line', { y: 48, opacity: 0, duration: 0.9, stagger: 0.12 }, '-=0.35')
        .from('.hero-sub', { y: 24, opacity: 0, duration: 0.7 }, '-=0.5')
        .from('.hero-cta', { y: 20, opacity: 0, duration: 0.6, stagger: 0.1 }, '-=0.4')
        .from('.hero-meta-item', { y: 16, opacity: 0, duration: 0.5, stagger: 0.08 }, '-=0.3')
        .from('.hero-scroll', { opacity: 0, duration: 0.6 }, '-=0.2');
    }, rootRef);
    return () => ctx.revert();
  }, []);

  // Scroll-driven parallax + reveal observers
  useEffect(() => {
    const scroller = rootRef.current;
    if (!scroller) return;

    const onScroll = () => {
      const y = scroller.scrollTop;
      if (bgRef.current) gsap.set(bgRef.current, { y: y * 0.25 });
      if (heroRef.current) gsap.set('.hero-inner', { y: y * 0.12, opacity: Math.max(0, 1 - y / 520) });
    };
    scroller.addEventListener('scroll', onScroll, { passive: true });

    // Reveal-on-scroll
    const revealEls = scroller.querySelectorAll('.reveal');
    gsap.set(revealEls, { opacity: 0, y: 40 });
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const el = entry.target;
          gsap.to(el, { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out', delay: Number(el.dataset.delay || 0) });
          io.unobserve(el);
        }
      });
    }, { root: scroller, threshold: 0.18 });
    revealEls.forEach((el) => io.observe(el));

    // Count-up for stats
    const statEls = scroller.querySelectorAll('.stat-value');
    const countIO = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const el = entry.target;
          const target = parseFloat(el.dataset.target);
          const decimals = parseInt(el.dataset.decimals || '0', 10);
          const obj = { v: 0 };
          gsap.to(obj, {
            v: target, duration: 1.6, ease: 'power2.out',
            onUpdate: () => { el.textContent = obj.v.toFixed(decimals); },
          });
          countIO.unobserve(el);
        }
      });
    }, { root: scroller, threshold: 0.5 });
    statEls.forEach((el) => countIO.observe(el));

    return () => {
      scroller.removeEventListener('scroll', onScroll);
      io.disconnect();
      countIO.disconnect();
    };
  }, []);

  return (
    <div id="home" ref={rootRef}>
      {/* ───────────────── HERO ───────────────── */}
      <section className="hero" ref={heroRef}>
        <div className="hero-bg" ref={bgRef}>
          <svg className="hero-contours" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
            {Array.from({ length: 9 }).map((_, i) => (
              <path
                key={i}
                d={`M-50 ${250 + i * 70} C 250 ${180 + i * 70}, 520 ${360 + i * 70}, 760 ${280 + i * 70} S 1240 ${180 + i * 70}, 1500 ${300 + i * 70}`}
                fill="none"
                stroke="var(--brand-gold)"
                strokeWidth="1"
                opacity={0.12 - i * 0.006}
              />
            ))}
          </svg>
          <div className="hero-glow" />
          <div className="hero-vignette" />
        </div>

        <div className="hero-inner">
          <div className="hero-eyebrow">
            IT'S THOUGHTFUL. IT'S RUSTOMJEE
          </div>
          <h1 className="hero-title">
            <span className="hero-line">Belle Vie</span>
            <span className="hero-line hero-line--sub">at Kasara Hills</span>
          </h1>
          <p className="hero-sub">
            A limited collection of eighteen hillside estate plots, framed by forest,
            water and the open sky of the Sahyadris.
          </p>
          <div className="hero-ctas">
            <button className="cta cta--gold hero-cta" onClick={onExplore}>
              Explore the Neighbourhood <ArrowRight size={16} />
            </button>
            <button className="cta cta--ghost hero-cta" onClick={onShowMasterplan}>
              View Masterplan
            </button>
          </div>
          <div className="hero-meta">
            <div className="hero-meta-item"><MapPin size={14} /> Kasara · Maharashtra</div>
            <div className="hero-meta-item">18 Estate Plots</div>
            <div className="hero-meta-item">35.6 Hectares</div>
          </div>
        </div>

        <div className="hero-scroll" onClick={() => rootRef.current?.scrollTo({ top: window.innerHeight - 80, behavior: 'smooth' })} role="button" aria-label="Scroll down">
          <ArrowDown size={18} />
        </div>
      </section>

      {/* ───────────────── STATS ───────────────── */}
      <section className="stats reveal">
        {STATS.map((s, i) => (
          <div className="stat" key={s.label}>
            <div className="stat-num">
              <span className="stat-value" data-target={s.value} data-decimals={s.decimals}>0</span>
            </div>
            <div className="stat-label">{s.label}</div>
            {i < STATS.length - 1 && <div className="stat-div" />}
          </div>
        ))}
      </section>

      {/* ───────────────── VISION ───────────────── */}
      <section className="vision">
        <div className="vision-text reveal">
          <div className="sec-eyebrow">The Vision</div>
          <h2 className="sec-title">An address<br />that breathes.</h2>
          <p className="vision-body vision-lead">
            Set high in the folds of the Western Ghats, Belle Vie is a gated sanctuary
            where every plot is curated to its outlook, whether clubhouse, parkland or water's edge.
          </p>
          <p className="vision-body">
            Three kilometres from Kasara station and a gentle drive from Mumbai, it is close
            enough to belong to the city, yet far enough to feel like another world entirely.
          </p>
          <button className="cta cta--text" onClick={onShowMasterplan}>
            Discover the Masterplan <ArrowRight size={15} />
          </button>
        </div>
        <div className="vision-frame reveal" data-delay="0.15">
          <div className="vision-card">
            <div className="vision-card-num">35.6</div>
            <div className="vision-card-unit">Hectares of curated hillside</div>
            <div className="vision-card-line" />
            <div className="vision-card-row"><span>Greens & Trails</span><strong>41,000+ sqm</strong></div>
            <div className="vision-card-row"><span>Estate Plots</span><strong>18 Exclusive</strong></div>
            <div className="vision-card-row"><span>Collections</span><strong>6 Curated</strong></div>
          </div>
        </div>
      </section>

      {/* TODO: sections below are not built yet — temporarily disabled. Page ends at "An address that breathes". */}
      {false && (
      <>
      {/* ───────────────── CATEGORIES ───────────────── */}
      <section className="cats">
        <div className="sec-head reveal">
          <div className="sec-eyebrow">The Collections</div>
          <h2 className="sec-title">Six ways to belong.</h2>
          <p className="sec-lead">Every plot belongs to a collection that reflects its size, outlook and proximity to the best of Belle Vie.</p>
        </div>
        <div className="cat-grid">
          {CATEGORIES.map((c, i) => (
            <div className="cat-card reveal" data-delay={(i % 3) * 0.08} key={c.name}>
              <div className="cat-index">0{i + 1}</div>
              <div className="cat-tag">{c.tag}</div>
              <h3 className="cat-name">{c.name}</h3>
              <p className="cat-desc">{c.desc}</p>
              <div className="cat-arrow"><ArrowRight size={16} /></div>
            </div>
          ))}
        </div>
      </section>

      {/* ───────────────── AMENITIES ───────────────── */}
      <section className="amen">
        <div className="sec-head reveal">
          <div className="sec-eyebrow">The Neighbourhood</div>
          <h2 className="sec-title">A life, well framed.</h2>
        </div>
        <div className="amen-grid">
          {AMENITIES.map(({ Icon, title, desc }, i) => (
            <div className="amen-card reveal" data-delay={(i % 3) * 0.08} key={title}>
              <div className="amen-ico"><Icon size={22} /></div>
              <h3 className="amen-title">{title}</h3>
              <p className="amen-desc">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ───────────────── CONNECTIVITY ───────────────── */}
      <section className="conn reveal">
        <div className="sec-eyebrow">The Connection</div>
        <h2 className="sec-title">Close to everything<br />that matters.</h2>
        <div className="conn-grid">
          {CITIES.map((c) => (
            <div className="conn-item" key={c.name}>
              <div className="conn-ico">{c.icon}</div>
              <div className="conn-name">{c.name}</div>
              <div className="conn-dist">{c.road_km} km <span>by road</span></div>
            </div>
          ))}
        </div>
      </section>

      {/* ───────────────── CTA BAND ───────────────── */}
      <section className="cta-band reveal">
        <div className="cta-band-inner">
          <div className="sec-eyebrow gold-accent">Belle Vie · Kasara Hills</div>
          <h2 className="cta-band-title">Step inside the neighbourhood.</h2>
          <p className="cta-band-sub">Walk the masterplan, explore every plot and discover the one that is yours.</p>
          <button className="cta cta--gold cta--lg" onClick={onExplore}>
            Enter the Interactive Map <ArrowRight size={18} />
          </button>
        </div>
      </section>

      {/* ───────────────── FOOTER ───────────────── */}
      <footer className="home-footer">
        <div className="foot-brand">
          <div className="brand-tagline">IT'S THOUGHTFUL. IT'S</div>
          <div className="foot-name">Rustomjee</div>
        </div>
        <div className="foot-meta">
          <span>Belle Vie · Kasara Hills</span>
          <span>Maharashtra, India</span>
          <span>© {new Date().getFullYear()} Rustomjee Group</span>
        </div>
      </footer>
      </>
      )}

      <style>{`
        #home {
          position: fixed; top: 64px; left: 0; right: 0; bottom: 0;
          overflow-y: auto; overflow-x: hidden;
          background: var(--bg-primary); color: var(--text-primary);
          scroll-behavior: smooth;
        }

        /* ---------- shared section bits ---------- */
        .sec-eyebrow {
          font-size: 11px; letter-spacing: 0.28em; text-transform: uppercase;
          color: var(--brand-gold); font-weight: 600; margin-bottom: 18px;
        }
        .sec-title {
          font-family: 'Hanken Grotesk', sans-serif; font-weight: 700; text-transform: none;
          letter-spacing: -0.02em; font-size: clamp(30px, 4vw, 50px); line-height: 1.1;
          color: var(--text-primary);
        }
        .sec-lead { font-size: 16px; color: var(--text-secondary); margin-top: 18px; max-width: 540px; line-height: 1.7; }
        .sec-head { text-align: center; max-width: 640px; margin: 0 auto 56px; }
        .sec-head .sec-lead { margin-left: auto; margin-right: auto; }

        /* ---------- buttons ---------- */
        .cta {
          display: inline-flex; align-items: center; gap: 10px;
          font-family: 'Inter', sans-serif; font-size: 12px; font-weight: 600;
          letter-spacing: 0.14em; text-transform: uppercase; cursor: pointer;
          padding: 15px 28px; border: 1px solid transparent; transition: all 0.35s cubic-bezier(0.4,0,0.2,1);
        }
        .cta svg { transition: transform 0.35s ease; }
        .cta:hover svg { transform: translateX(4px); }
        .cta--gold { background: var(--brand-gold); color: var(--on-gold); border-color: var(--brand-gold); }
        .cta--gold:hover { background: var(--brand-gold-dark); box-shadow: 0 14px 40px -12px var(--brand-gold); transform: translateY(-2px); }
        .cta--ghost { background: transparent; color: var(--text-primary); border-color: var(--gold-b); }
        .cta--ghost:hover { border-color: var(--brand-gold); color: var(--brand-gold); }
        .cta--text { background: none; border: none; padding: 14px 0; color: var(--brand-gold); }
        .cta--text:hover { gap: 14px; }
        .cta--lg { padding: 18px 40px; font-size: 13px; }

        /* ---------- HERO ---------- */
        .hero { position: relative; min-height: calc(100vh - 64px); display: flex; flex-direction: column;
                align-items: center; justify-content: center; text-align: center; padding: 80px 24px 120px; overflow: hidden; }
        .hero-bg { position: absolute; inset: -10% 0 0 0; z-index: 0; }
        .hero-contours { position: absolute; inset: 0; width: 100%; height: 100%; }
        .hero-glow {
          position: absolute; top: 8%; left: 50%; transform: translateX(-50%);
          width: 60vw; height: 60vw; max-width: 760px; max-height: 760px; border-radius: 50%;
          background: radial-gradient(circle, var(--gold-p) 0%, transparent 62%);
          filter: blur(20px);
        }
        .hero-vignette { position: absolute; inset: 0;
          background: radial-gradient(ellipse at 50% 35%, transparent 35%, var(--bg-primary) 88%); }
        .hero-inner { position: relative; z-index: 2; max-width: 880px; will-change: transform; }
        .hero-eyebrow {
          display: inline-flex; align-items: center; gap: 12px;
          font-size: 11px; letter-spacing: 0.3em; text-transform: uppercase;
          color: var(--text-secondary); margin-bottom: 28px;
        }
        .hero-title { display: flex; flex-direction: column; gap: 2px; margin-bottom: 26px; }
        .hero-line {
          font-family: 'Hanken Grotesk', sans-serif; font-weight: 700; text-transform: none; letter-spacing: -0.035em;
          font-size: clamp(48px, 8.5vw, 112px); line-height: 0.98; color: var(--text-primary);
        }
        .hero-line--sub {
          font-size: clamp(20px, 3vw, 34px); color: var(--brand-gold);
          letter-spacing: -0.01em; margin-top: 8px; font-weight: 500; text-transform: none;
        }
        .hero-sub { font-size: clamp(15px, 1.6vw, 19px); color: var(--text-secondary);
          max-width: 600px; margin: 0 auto 38px; line-height: 1.7; }
        .hero-ctas { display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; margin-bottom: 48px; }
        .hero-meta { display: flex; gap: 28px; justify-content: center; flex-wrap: wrap;
          padding-top: 28px; border-top: 1px solid var(--border); max-width: 560px; margin: 0 auto; }
        .hero-meta-item { display: inline-flex; align-items: center; gap: 8px;
          font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-muted); }
        .hero-meta-item svg { color: var(--brand-gold); }
        .hero-scroll { position: absolute; bottom: 30px; left: 50%; transform: translateX(-50%); z-index: 2;
          display: flex; align-items: center; justify-content: center; cursor: pointer; padding: 8px; }
        .hero-scroll svg { color: var(--brand-gold); animation: bob 1.8s ease-in-out infinite; }
        @keyframes bob { 0%,100%{ transform: translateY(0);} 50%{ transform: translateY(6px);} }

        /* ---------- STATS ---------- */
        .stats { display: flex; justify-content: center; flex-wrap: wrap; gap: 0;
          padding: 56px 24px; border-top: 1px solid var(--border); border-bottom: 1px solid var(--border);
          background: var(--bg-secondary); }
        .stat { position: relative; flex: 1 1 180px; max-width: 260px; text-align: center; padding: 0 24px; }
        .stat-num { font-family: 'Hanken Grotesk', sans-serif; font-size: clamp(36px, 4.5vw, 54px);
          font-weight: 700; letter-spacing: -0.02em; color: var(--text-primary); line-height: 1; }
        .stat-label { margin-top: 12px; font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--brand-gold); }
        .stat-div { position: absolute; right: 0; top: 50%; transform: translateY(-50%); width: 1px; height: 56px; background: var(--border); }

        /* ---------- VISION ---------- */
        .vision { display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 80px; align-items: center;
          max-width: 1200px; margin: 0 auto; padding: 120px 40px; }
        .vision-body { font-size: 16px; color: var(--text-secondary); line-height: 1.85; margin: 22px 0; }
        .vision-lead { color: var(--text-primary); font-size: 18px; }
        .sec-title + .vision-body { margin-top: 28px; }
        .vision-frame { position: relative; }
        .vision-card { background: var(--card-bg); border: 1px solid var(--gold-b); padding: 44px; position: relative; }
        .vision-card::before { content: ''; position: absolute; inset: 10px; border: 1px solid var(--border); pointer-events: none; }
        .vision-card-num { font-family: 'Hanken Grotesk', sans-serif; font-size: 60px; font-weight: 700; letter-spacing: -0.02em; color: var(--brand-gold); line-height: 1; }
        .vision-card-unit { font-size: 13px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-muted); margin-top: 8px; }
        .vision-card-line { height: 1px; background: var(--border); margin: 28px 0; }
        .vision-card-row { display: flex; justify-content: space-between; align-items: baseline; padding: 12px 0; font-size: 14px; color: var(--text-secondary); }
        .vision-card-row strong { color: var(--text-primary); font-weight: 600; }

        /* ---------- CATEGORIES ---------- */
        .cats { max-width: 1200px; margin: 0 auto; padding: 40px 40px 120px; }
        .cat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
        .cat-card { position: relative; padding: 40px 32px 56px; border: 1px solid var(--border);
          background: var(--card-bg); overflow: hidden; transition: all 0.4s cubic-bezier(0.4,0,0.2,1); cursor: default; }
        .cat-card::after { content: ''; position: absolute; left: 0; bottom: 0; height: 2px; width: 0; background: var(--brand-gold); transition: width 0.45s ease; }
        .cat-card:hover { transform: translateY(-6px); border-color: var(--gold-b); background: var(--gold-p); box-shadow: 0 24px 50px -28px rgba(0,0,0,0.5); }
        .cat-card:hover::after { width: 100%; }
        .cat-index { font-family: 'Hanken Grotesk', sans-serif; font-size: 14px; color: var(--brand-gold); opacity: 0.7; margin-bottom: 20px; }
        .cat-tag { font-size: 10px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--text-muted); margin-bottom: 8px; }
        .cat-name { font-family: 'Hanken Grotesk', sans-serif; font-size: 26px; font-weight: 700; color: var(--text-primary); text-transform: none; letter-spacing: -0.02em; margin-bottom: 14px; }
        .cat-desc { font-size: 14px; line-height: 1.7; color: var(--text-secondary); }
        .cat-arrow { position: absolute; bottom: 28px; right: 28px; color: var(--brand-gold); opacity: 0; transform: translateX(-8px); transition: all 0.4s ease; }
        .cat-card:hover .cat-arrow { opacity: 1; transform: translateX(0); }

        /* ---------- AMENITIES ---------- */
        .amen { background: var(--bg-secondary); border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); padding: 110px 40px; }
        .amen-grid { max-width: 1100px; margin: 0 auto; display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; background: var(--border); border: 1px solid var(--border); }
        .amen-card { background: var(--bg-secondary); padding: 44px 36px; transition: background 0.35s ease; }
        .amen-card:hover { background: var(--gold-p); }
        .amen-ico { width: 52px; height: 52px; display: flex; align-items: center; justify-content: center; border: 1px solid var(--gold-b); color: var(--brand-gold); margin-bottom: 22px; }
        .amen-title { font-family: 'Hanken Grotesk', sans-serif; font-size: 19px; font-weight: 700; text-transform: none; letter-spacing: -0.01em; color: var(--text-primary); margin-bottom: 10px; }
        .amen-desc { font-size: 14px; line-height: 1.7; color: var(--text-secondary); }

        /* ---------- CONNECTIVITY ---------- */
        .conn { max-width: 1100px; margin: 0 auto; padding: 120px 40px; text-align: center; }
        .conn .sec-title { margin-bottom: 56px; }
        .conn-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 0; border: 1px solid var(--border); }
        .conn-item { padding: 32px 16px; border-right: 1px solid var(--border); transition: background 0.3s ease; }
        .conn-item:last-child { border-right: none; }
        .conn-item:hover { background: var(--card-bg); }
        .conn-ico { font-size: 26px; margin-bottom: 14px; }
        .conn-name { font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-primary); font-weight: 600; margin-bottom: 8px; }
        .conn-dist { font-family: 'Hanken Grotesk', sans-serif; font-size: 22px; font-weight: 700; letter-spacing: -0.01em; color: var(--brand-gold); }
        .conn-dist span { font-family: 'Inter', sans-serif; font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-muted); display: block; margin-top: 2px; }

        /* ---------- CTA BAND ---------- */
        .cta-band { padding: 40px; }
        .cta-band-inner { position: relative; max-width: 1200px; margin: 0 auto; text-align: center;
          padding: 96px 32px; border: 1px solid var(--gold-b); background: var(--card-bg); overflow: hidden; }
        .cta-band-inner::before { content: ''; position: absolute; top: -50%; left: 50%; transform: translateX(-50%);
          width: 70%; height: 200%; background: radial-gradient(ellipse, var(--gold-p), transparent 60%); pointer-events: none; }
        .cta-band-title { position: relative; font-family: 'Hanken Grotesk', sans-serif; font-weight: 700; text-transform: none;
          letter-spacing: -0.02em; font-size: clamp(30px, 4.5vw, 54px); color: var(--text-primary); margin: 12px 0 18px; }
        .cta-band-sub { position: relative; font-size: 17px; color: var(--text-secondary); margin-bottom: 40px; }

        /* ---------- FOOTER ---------- */
        .home-footer { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 20px;
          padding: 44px 40px; border-top: 1px solid var(--border); }
        .foot-name { font-family: 'Hanken Grotesk', sans-serif; font-size: 22px; font-weight: 700; color: var(--text-primary); }
        .foot-brand .brand-tagline { font-size: 9px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--text-muted); }
        .foot-meta { display: flex; gap: 28px; flex-wrap: wrap; font-size: 12px; letter-spacing: 0.05em; color: var(--text-muted); }

        /* ---------- RESPONSIVE ---------- */
        @media (max-width: 1024px) {
          .vision { grid-template-columns: 1fr; gap: 48px; padding: 96px 32px; }
          .cats { padding: 32px 32px 96px; }
          .amen { padding: 96px 32px; }
          .conn { padding: 96px 32px; }
          .cat-grid { grid-template-columns: repeat(2, 1fr); }
          .amen-grid { grid-template-columns: repeat(2, 1fr); }
          .amen-card { padding: 36px 28px; }
          .conn-grid { grid-template-columns: repeat(3, 1fr); }
          .conn-item:nth-child(3n) { border-right: none; }
          .conn-item:nth-child(n+4) { border-top: 1px solid var(--border); }
          .sec-head { margin-bottom: 44px; }
        }
        @media (max-width: 768px) {
          .hero { padding: 64px 20px 100px; }
          .hero-eyebrow { margin-bottom: 22px; font-size: 10px; letter-spacing: 0.22em; }
          .hero-ctas { margin-bottom: 40px; }
          .hero-ctas .cta { width: 100%; justify-content: center; }
          .stats { padding: 44px 20px; }
          .vision { padding: 72px 24px; gap: 40px; }
          .vision-card { padding: 36px 28px; }
          .vision-card-num { font-size: 52px; }
          .cats { padding: 24px 24px 72px; }
          .amen { padding: 72px 24px; }
          .conn { padding: 72px 24px; }
          .conn .sec-title { margin-bottom: 40px; }
          .cta-band { padding: 24px; }
          .cta-band-inner { padding: 72px 24px; }
        }
        @media (max-width: 600px) {
          .stats { gap: 36px 0; }
          .stat { flex: 1 1 45%; max-width: none; padding: 0 12px; }
          .stat-div { display: none; }
          .cat-grid { grid-template-columns: 1fr; }
          .amen-grid { grid-template-columns: 1fr; }
          .conn-grid { grid-template-columns: repeat(2, 1fr); }
          .conn-item { border-right: 1px solid var(--border); border-bottom: none; }
          .conn-item:nth-child(2n) { border-right: none; }
          .conn-item:nth-child(n+3) { border-top: 1px solid var(--border); }
          .hero-meta { gap: 14px 18px; padding-top: 22px; }
          .hero-meta-item { font-size: 11px; }
          .cta--lg { padding: 16px 28px; font-size: 12px; }
          .home-footer { flex-direction: column; align-items: flex-start; gap: 16px; }
          .foot-meta { flex-direction: column; gap: 6px; }
        }
      `}</style>
    </div>
  );
}

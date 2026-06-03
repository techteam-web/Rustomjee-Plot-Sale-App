import React from 'react';
import { Sun, Moon } from 'lucide-react';

export default function Header({ theme, onToggleTheme, onShowMasterplan, onOpenROI, page = 'home', setPage = () => {} }) {
  return (
    <header id="hdr">
      <div className="logo" onClick={() => setPage('home')} role="button" title="Back to home">
        <div className="brand-tagline">IT'S THOUGHTFUL. IT'S</div>
        <div className="brand-name">Rustomjee</div>
      </div>
      <nav className="hdr-nav">
        <button className={`navlink ${page === 'home' ? 'on' : ''}`} onClick={() => setPage('home')}>Home</button>
        <button className={`navlink ${page === 'explore' ? 'on' : ''}`} onClick={() => setPage('explore')}>Neighbourhood</button>
      </nav>
      <div className="hdr-r">
        <button className="theme-toggle" onClick={onToggleTheme} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <button className="hbtn-brand" onClick={onShowMasterplan}>Masterplan</button>
        <button className="hbtn-brand primary" onClick={() => alert('Our advisor will contact you shortly. Thank you!')}>Book Site Visit</button>
      </div>
      <style>{`
        #hdr {
          position: fixed; top: 0; left: 0; right: 0; z-index: 1000; height: 64px;
          display: flex; align-items: center; justify-content: space-between; padding: 0 32px;
          background: var(--bg-primary); border-bottom: 1px solid var(--border);
        }
        .logo { display: flex; align-items: baseline; gap: 8px; cursor: pointer; }
        .hdr-nav {
          position: absolute; left: 50%; transform: translateX(-50%);
          display: flex; align-items: center; gap: 4px;
        }
        .navlink {
          background: transparent; border: none; cursor: pointer; position: relative;
          font-family: 'Inter', sans-serif; font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase;
          font-weight: 300; color: var(--text-muted); padding: 8px 16px; transition: color 0.3s ease;
        }
        .navlink::after {
          content: ''; position: absolute; left: 16px; right: 16px; bottom: 2px; height: 1px;
          background: var(--brand-gold); transform: scaleX(0); transform-origin: left; transition: transform 0.35s ease;
        }
        .navlink:hover { color: var(--text-primary); }
        .navlink.on { color: var(--brand-gold); }
        .navlink.on::after { transform: scaleX(1); }
        .brand-tagline { 
          font-family: 'Inter', sans-serif; font-size: 10px; letter-spacing: 0.2em; font-weight: 300; 
          text-transform: uppercase; color: var(--brand-white); opacity: 0.8;
        }
        .brand-name { 
          font-size: 20px; 
          color: var(--text-primary); letter-spacing: 0.02em;
        }
        .hdr-mid {
          position: absolute; left: 50%; transform: translateX(-50%);
          font-size: 14px; color: var(--brand-gold); letter-spacing: 0.05em;
        }
        .hdr-r { display: flex; align-items: center; gap: 12px; }
        .theme-toggle {
          background: transparent; border: none; color: var(--brand-gold);
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          padding: 8px; border-radius: 50%; transition: background 0.3s;
        }
        @media (max-width: 1024px) {
          #hdr { padding: 0 16px; }
          .hdr-nav { position: static; transform: none; gap: 0; margin-left: 12px; }
          .navlink { padding: 8px 9px; font-size: 9px; letter-spacing: 0.1em; }
          .logo { flex-direction: column; gap: 0; align-items: flex-start; }
          .brand-tagline { font-size: 8px; }
          .brand-name { font-size: 16px; }
          .hbtn-brand { padding: 6px 12px; font-size: 9px; }
        }
        @media (max-width: 560px) {
          /* Keep nav reachable on phones: compact segmented control, header stays 64px */
          .brand-tagline { display: none; }
          .hbtn-brand { display: none; }
          .hdr-nav { position: static; transform: none; gap: 0; margin-left: 8px; }
          .navlink { font-size: 10px; letter-spacing: 0.12em; font-weight: 300; padding: 8px 10px; }
        }
        .theme-toggle:hover { background: var(--gold-p); }
        .hbtn-brand {
          padding: 8px 20px; font-size: 11px; letter-spacing: 0.15em; text-transform: uppercase;
          font-weight: 500; cursor: pointer; transition: all 0.3s ease;
          background: transparent; border: 1px solid var(--gold-b); color: var(--text-secondary);
          font-family: 'Inter', sans-serif;
        }
        .hbtn-brand:hover { border-color: var(--brand-gold); color: var(--brand-gold); }
        .hbtn-brand.primary { background: var(--brand-gold); border-color: var(--brand-gold); color: var(--bg-primary); }
        .hbtn-brand.primary:hover { background: var(--brand-gold-dark); }
      `}</style>
    </header>
  );
}

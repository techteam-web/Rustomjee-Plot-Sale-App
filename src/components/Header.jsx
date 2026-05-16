import React from 'react';
import { Sun, Moon } from 'lucide-react';

export default function Header({ theme, onToggleTheme, onShowMasterplan, onOpenROI }) {
  return (
    <header id="hdr">
      <div className="logo">
        <div className="brand-tagline">IT'S THOUGHTFUL. IT'S</div>
        <div className="brand-name">Rustomjee</div>
      </div>
      <div className="hdr-mid subhead">Belle Vie · Kasara Hills</div>
      <div className="hdr-r">
        <button className="theme-toggle" onClick={onToggleTheme} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <button className="hbtn-brand" onClick={onShowMasterplan}>Masterplan</button>
        <button className="hbtn-brand" onClick={onOpenROI}>ROI Calculator</button>
        <button className="hbtn-brand primary" onClick={() => alert('Our advisor will contact you shortly. Thank you!')}>Book Site Visit</button>
      </div>
      <style>{`
        #hdr {
          position: fixed; top: 0; left: 0; right: 0; z-index: 1000; height: 64px;
          display: flex; align-items: center; justify-content: space-between; padding: 0 32px;
          background: var(--bg-primary); border-bottom: 1px solid var(--border);
        }
        .logo { display: flex; align-items: baseline; gap: 8px; }
        .brand-tagline { 
          font-family: 'Inter', sans-serif; font-size: 10px; letter-spacing: 0.2em; 
          text-transform: uppercase; color: var(--brand-white); opacity: 0.8;
        }
        .brand-name { 
          font-family: 'Playfair Display', serif; font-size: 20px; font-weight: 700; 
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
        .theme-toggle:hover { background: var(--gold-p); }
        .hbtn-brand {
          padding: 8px 20px; font-size: 11px; letter-spacing: 0.15em; text-transform: uppercase;
          font-weight: 500; cursor: pointer; transition: all 0.3s ease;
          background: transparent; border: 1px solid var(--gold-b); color: var(--text-secondary);
          font-family: 'Inter', sans-serif;
        }
        .hbtn-brand:hover { border-color: var(--brand-gold); color: var(--brand-gold); }
        .hbtn-brand.primary { background: var(--brand-gold); border-color: var(--brand-gold); color: var(--bg-primary); font-weight: 600; }
        .hbtn-brand.primary:hover { background: var(--brand-gold-dark); }
      `}</style>
    </header>
  );
}

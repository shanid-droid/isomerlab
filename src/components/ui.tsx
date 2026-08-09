import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

/* ── ISOMER Logo mark ──────────────────────────────────────────── */
export const IsomerLogo: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({ size = 'md' }) => {
  const sizes = {
    sm: { text: 'text-lg',   sub: 'text-[9px]' },
    md: { text: 'text-xl',   sub: 'text-[10px]' },
    lg: { text: 'text-3xl',  sub: 'text-xs' },
  };
  const s = sizes[size];

  return (
    <div className="flex flex-col leading-none select-none">
      <span className={`font-display font-bold tracking-widest ${s.text} text-white`}>
        ISOM<span className="text-eg">≡</span>R
      </span>
      <span className={`font-mono-custom font-light italic text-eg/70 tracking-wider ${s.sub} mt-0.5`}>
        Be inspire!
      </span>
    </div>
  );
};

/* ── Arrow icon ─────────────────────────────────────────────────── */
export const ArrowRight: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

/* ── External link icon ─────────────────────────────────────────── */
export const ExternalLink: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" strokeLinecap="round" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

/* ── Nav ────────────────────────────────────────────────────────── */
export const Navbar: React.FC = () => {
  const [scrolled, setScrolled]   = useState(false);
  const [menuOpen, setMenuOpen]   = useState(false);
  const [active,   setActive]     = useState('home');
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });

    // Auth session monitoring for Navbar button
    supabase.auth.getSession().then(({ data: { session } }) => setHasSession(!!session?.user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(!!session?.user);
    });

    return () => {
      window.removeEventListener('scroll', onScroll);
      subscription.unsubscribe();
    };
  }, []);

  const links = [
    { id: 'home',     label: 'Home'     },
    { id: 'about',    label: 'About'    },
    { id: 'projects', label: 'Projects' },
    { id: 'contact',  label: 'Contact'  },
  ];

  const scrollTo = (id: string) => {
    setActive(id);
    setMenuOpen(false);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled ? 'glass-dark border-b border-eg/10 py-3' : 'py-5 bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        {/* Logo */}
        <Link to="/admin/login" className="focus:outline-none">
          <IsomerLogo size="md" />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8">
          {links.map(l => (
            <button
              key={l.id}
              onClick={() => scrollTo(l.id)}
              className={`nav-link ${active === l.id ? 'active' : ''}`}
            >
              {l.label}
            </button>
          ))}
        </nav>

        {/* CTA & User Portal link */}
        <div className="hidden md:flex items-center gap-4">
          <Link
            to={hasSession ? "/dashboard" : "/login"}
            className="font-mono-custom text-xs text-white/70 hover:text-eg transition-colors px-3 py-1.5 rounded border border-white/10"
          >
            {hasSession ? "Dashboard" : "Sign In"}
          </Link>

          <button
            onClick={() => scrollTo('contact')}
            className="btn-primary"
            id="nav-cta"
          >
            Get In Touch
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Mobile hamburger */}
        <button
          id="mobile-menu-toggle"
          aria-label="Toggle navigation menu"
          className="md:hidden flex flex-col gap-1.5 p-2"
          onClick={() => setMenuOpen(v => !v)}
        >
          <span className={`block w-6 h-px bg-white transition-all duration-300 ${menuOpen ? 'rotate-45 translate-y-2.5' : ''}`} />
          <span className={`block w-6 h-px bg-white transition-all duration-300 ${menuOpen ? 'opacity-0' : ''}`} />
          <span className={`block w-6 h-px bg-white transition-all duration-300 ${menuOpen ? '-rotate-45 -translate-y-2.5' : ''}`} />
        </button>
      </div>

      {/* Mobile drawer */}
      <div className={`md:hidden overflow-hidden transition-all duration-500 ${menuOpen ? 'max-h-80' : 'max-h-0'}`}>
        <nav className="flex flex-col gap-1 px-6 pt-4 pb-6 glass-dark border-t border-eg/10">
          {links.map(l => (
            <button
              key={l.id}
              onClick={() => scrollTo(l.id)}
              className={`nav-link text-left py-3 border-b border-eg/5 last:border-0 ${active === l.id ? 'active' : ''}`}
            >
              {l.label}
            </button>
          ))}
          <Link
            to={hasSession ? "/dashboard" : "/login"}
            className="nav-link text-left py-3 border-b border-eg/5 text-eg font-mono-custom text-xs"
          >
            {hasSession ? "→ My Dashboard" : "→ Sign In"}
          </Link>
          <button onClick={() => scrollTo('contact')} className="btn-primary mt-4 justify-center">
            Get In Touch <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </nav>
      </div>
    </header>
  );
};

/* ── Rotating radar graphic ─────────────────────────────────────── */
export const RadarGraphic: React.FC = () => (
  <div className="relative w-28 h-28 opacity-80">
    {/* Rings */}
    {[1, 0.65, 0.35].map((scale, i) => (
      <div
        key={i}
        className="absolute inset-0 rounded-full border border-eg/20"
        style={{ transform: `scale(${scale})`, top: `${(1-scale)*50}%`, left: `${(1-scale)*50}%`, width: `${scale*100}%`, height: `${scale*100}%` }}
      />
    ))}
    {/* Rotating sweep */}
    <div className="absolute inset-0 ring-rotate">
      <div className="w-full h-full rounded-full" style={{
        background: 'conic-gradient(from 0deg, rgba(0,255,136,0.25) 0deg, transparent 90deg)',
      }} />
    </div>
    {/* Center dot */}
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="w-2.5 h-2.5 rounded-full bg-eg shadow-eg-sm animate-pulse-slow" />
    </div>
    {/* Cross hairs */}
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="w-full h-px bg-eg/15" />
    </div>
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="h-full w-px bg-eg/15" />
    </div>
  </div>
);

/* ── Mountain / terrain graphic ─────────────────────────────────── */
export const TerrainGraphic: React.FC = () => (
  <div className="relative w-28 h-24 opacity-70">
    <svg viewBox="0 0 112 96" fill="none" className="w-full h-full">
      {/* Grid lines */}
      {[20, 40, 60, 80].map(y => (
        <line key={y} x1="0" y1={y} x2="112" y2={y} stroke="rgba(0,255,136,0.12)" strokeWidth="0.5" />
      ))}
      {[14, 28, 42, 56, 70, 84, 98].map(x => (
        <line key={x} x1={x} y1="0" x2={x} y2="96" stroke="rgba(0,255,136,0.12)" strokeWidth="0.5" />
      ))}
      {/* Mountain fill */}
      <path d="M0 96 L28 40 L56 10 L84 50 L112 32 L112 96 Z" fill="rgba(0,255,136,0.08)" />
      {/* Mountain stroke */}
      <path d="M0 96 L28 40 L56 10 L84 50 L112 32" stroke="rgba(0,255,136,0.6)" strokeWidth="1.5" fill="none" />
      {/* Peak dot */}
      <circle cx="56" cy="10" r="3" fill="#00ff88" opacity="0.9" />
    </svg>
  </div>
);

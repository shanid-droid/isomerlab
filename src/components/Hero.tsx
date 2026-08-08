import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight } from './ui';

/* ── Typing text effect ─────────────────────────────────────────── */
const words = ['ENGINEER', 'INNOVATOR', 'CREATOR'];

const TypingText: React.FC = () => {
  const [wordIndex, setWordIndex]   = useState(0);
  const [charIndex, setCharIndex]   = useState(0);
  const [deleting,  setDeleting]    = useState(false);

  useEffect(() => {
    const current = words[wordIndex];
    let timeout: ReturnType<typeof setTimeout>;

    if (!deleting && charIndex === current.length) {
      timeout = setTimeout(() => setDeleting(true), 1800);
    } else if (deleting && charIndex === 0) {
      setDeleting(false);
      setWordIndex(i => (i + 1) % words.length);
    } else {
      timeout = setTimeout(() => {
        setCharIndex(i => i + (deleting ? -1 : 1));
      }, deleting ? 60 : 110);
    }
    return () => clearTimeout(timeout);
  }, [charIndex, deleting, wordIndex]);

  return (
    <span className="font-display text-xs tracking-[0.3em] text-eg/80">
      {words[wordIndex].slice(0, charIndex)}
      <span className="animate-blink">|</span>
    </span>
  );
};

/* ── Hero ────────────────────────────────────────────────────────── */
const Hero: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <section
      id="home"
      ref={ref}
      className="relative min-h-screen flex items-center bg-circuit overflow-hidden"
    >
      {/* Ambient green radial glow */}
      <div
        className="absolute pointer-events-none"
        style={{
          right: '10%',
          top: '50%',
          transform: 'translateY(-50%)',
          width: '55%',
          height: '80%',
          background: 'radial-gradient(ellipse at center, rgba(0,255,136,0.07) 0%, transparent 70%)',
        }}
      />

      {/* Right decorative vertical text */}
      <div className="absolute right-6 top-1/2 -translate-y-1/2 hidden lg:flex flex-col gap-4 items-center">
        {['ENGINEER', 'INNOVATOR', 'CREATOR'].map((w, i) => (
          <div key={w} className="flex items-center gap-3">
            {i > 0 && <div className="w-px h-8 bg-eg/20" />}
            <span
              className="font-mono-custom text-[10px] tracking-[0.25em] text-white/30"
              style={{ writingMode: 'vertical-rl' }}
            >
              {w}
            </span>
          </div>
        ))}
      </div>

      <div className="max-w-7xl mx-auto px-6 pt-28 pb-16 w-full">
        <div className="relative glass border border-eg/10 rounded-xl overflow-hidden min-h-[560px] flex">

          {/* Scan line overlay */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="scan-line" />
          </div>

          {/* Left content */}
          <div
            className={`flex-1 flex flex-col justify-center px-8 md:px-12 lg:px-16 py-12 z-10 transition-all duration-1000 ${
              visible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-8'
            }`}
          >
            {/* Brand name */}
            <div className="mb-3">
              <h1 className="font-display font-black text-5xl md:text-6xl lg:text-7xl tracking-widest leading-none text-white">
                ISOM<span className="text-eg text-glow">≡</span>R
              </h1>
              <p className="font-mono-custom italic text-eg text-base mt-1 tracking-wider text-glow-sm">
                Be inspire!
              </p>
            </div>

            {/* Divider */}
            <div className="w-16 h-px bg-eg/40 my-6" />

            {/* Focus block */}
            <div className="border-l-2 border-eg/50 pl-5 mb-6">
              {['FOCUS.', 'CREATE.', 'ELEVATE.'].map((line, i) => (
                <p
                  key={line}
                  className={`font-display text-xl md:text-2xl font-medium tracking-widest text-white leading-relaxed transition-all duration-700 ${
                    visible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'
                  }`}
                  style={{ transitionDelay: `${200 + i * 120}ms` }}
                >
                  {line}
                </p>
              ))}
            </div>

            {/* Tagline */}
            <p className="font-sans text-sm text-white/50 leading-relaxed mb-8 max-w-xs">
              STAY DISCIPLINED.{' '}
              <br />
              KEEP BUILDING.{' '}
              <br />
              MAKE{' '}
              <span className="text-eg font-semibold text-glow-sm">IMPACT.</span>
            </p>

            {/* Hexagon badge */}
            <div className="flex items-center gap-3 mb-8">
              <div className="relative w-10 h-10 hexagon bg-eg/10 border border-eg/40 flex items-center justify-center shadow-eg-sm">
                <span className="font-display text-eg font-bold text-sm">I</span>
              </div>
              <div>
                <p className="font-display text-xs tracking-[0.3em] text-white">ISOMER</p>
                <p className="font-mono-custom text-[10px] text-eg/60 tracking-wider">EST. 2024</p>
              </div>
            </div>

            {/* CTA buttons */}
            <div className="flex flex-wrap gap-4">
              <button
                id="hero-explore-btn"
                className="btn-primary"
                onClick={() => document.getElementById('projects')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Explore Projects
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                id="hero-about-btn"
                className="btn-outline"
                onClick={() => document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Learn More
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Right image */}
          <div
            className={`relative hidden md:block w-[42%] lg:w-[45%] transition-all duration-1000 delay-300 ${
              visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'
            }`}
          >
            {/* Dark image using the provided ISOMER reference as B&W portrait style */}
            <div className="absolute inset-0">
              <div
                className="w-full h-full"
                style={{
                  background: 'linear-gradient(135deg, #0d1a12 0%, #0a160e 50%, #081009 100%)',
                }}
              />
              {/* Abstract digital figure overlay */}
              <svg
                className="absolute inset-0 w-full h-full opacity-30"
                viewBox="0 0 400 500"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                preserveAspectRatio="xMidYMid slice"
              >
                {/* Circuit traces */}
                <path d="M200 500 L200 350 L280 350 L280 280 L340 280" stroke="rgba(0,255,136,0.5)" strokeWidth="1" />
                <path d="M200 500 L200 350 L120 350 L120 280 L60 280" stroke="rgba(0,255,136,0.5)" strokeWidth="1" />
                <path d="M200 350 L200 200" stroke="rgba(0,255,136,0.3)" strokeWidth="1.5" />
                <circle cx="280" cy="280" r="4" fill="#00ff88" opacity="0.6" />
                <circle cx="60" cy="280" r="4" fill="#00ff88" opacity="0.6" />
                <circle cx="200" cy="200" r="6" fill="#00ff88" opacity="0.4" />
                {/* Horizontal lines */}
                {[100, 150, 200, 250, 300, 350, 400].map(y => (
                  <line key={y} x1="0" y1={y} x2="400" y2={y} stroke="rgba(0,255,136,0.04)" strokeWidth="1" />
                ))}
              </svg>

              {/* Green bottom fog */}
              <div
                className="absolute bottom-0 left-0 right-0 h-1/3"
                style={{ background: 'linear-gradient(to top, rgba(0,255,136,0.12), transparent)' }}
              />
              {/* Left fade */}
              <div
                className="absolute top-0 left-0 bottom-0 w-1/4"
                style={{ background: 'linear-gradient(to right, #080c0a, transparent)' }}
              />
            </div>

            {/* Typing text overlay */}
            <div className="absolute top-8 right-8 text-right">
              <TypingText />
            </div>

            {/* Corner decorations */}
            <div className="absolute top-4 right-4 w-6 h-6 border-t border-r border-eg/40" />
            <div className="absolute bottom-4 left-4 w-6 h-6 border-b border-l border-eg/40" />
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-40">
        <span className="font-mono-custom text-[9px] tracking-widest text-white uppercase">Scroll</span>
        <div className="w-px h-8 bg-gradient-to-b from-white/40 to-transparent" />
      </div>
    </section>
  );
};

export default Hero;

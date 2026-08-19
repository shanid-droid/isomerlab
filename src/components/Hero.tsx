import React, { useEffect, useState, useRef } from 'react';
import { ArrowRight } from './ui';

export const Hero: React.FC = () => {
  const [mounted, setMounted] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Respect reduced motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = setTimeout(() => setMounted(true), prefersReducedMotion ? 10 : 80);
    return () => clearTimeout(timer);
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setMousePos({ x, y });
  };

  const scrollToProjects = () => {
    document.getElementById('featured-project')?.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollToLab = () => {
    document.getElementById('the-lab')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section
      id="home"
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className="relative min-h-[92vh] lg:min-h-screen flex items-center justify-center bg-dark overflow-hidden select-none pt-24 pb-16"
    >
      {/* ── Living Background ── */}
      {/* Technical Grid */}
      <div
        className="absolute inset-0 bg-circuit opacity-60 pointer-events-none"
        style={{
          maskImage: 'radial-gradient(ellipse 80% 60% at 50% 50%, black 20%, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 50%, black 20%, transparent 80%)',
        }}
      />

      {/* Mouse-reactive Ambient Glow */}
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-1000 ease-out"
        style={{
          background: `radial-gradient(650px circle at ${mousePos.x}% ${mousePos.y}%, rgba(0, 255, 136, 0.07), transparent 60%)`,
        }}
      />

      {/* Soft Center Ambient Light */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] pointer-events-none opacity-40 blur-[120px]"
        style={{ background: 'radial-gradient(ellipse, rgba(0, 255, 136, 0.15) 0%, transparent 70%)' }}
      />

      {/* Subtle Horizontal Scanning Line */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-25">
        <div className="scan-line" />
      </div>

      {/* ── Hero Main Content ── */}
      <div className="max-w-5xl mx-auto px-6 relative z-10 text-center flex flex-col items-center">
        {/* Top Technical Status Tag */}
        <div
          className={`inline-flex items-center gap-2.5 px-3.5 py-1 rounded-full border border-eg/20 bg-dark-200/80 backdrop-blur-md mb-8 transition-all duration-700 ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-eg animate-pulse" />
          <span className="font-mono-custom text-[11px] tracking-[0.25em] text-white/70 uppercase">
            ISOMER <span className="text-eg/50">/</span> TECHNOLOGY LABORATORY
          </span>
        </div>

        {/* ── Powerful Main Heading (Cinematic Staggered Reveal) ── */}
        <h1 className="font-display font-black text-4xl sm:text-6xl md:text-7xl lg:text-8xl tracking-tight leading-[1.05] text-white max-w-4xl">
          <span
            className={`inline-block transition-all duration-700 ease-out ${
              mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}
            style={{ transitionDelay: '150ms' }}
          >
            WE BUILD
          </span>{' '}
          <span
            className={`inline-block text-transparent bg-clip-text bg-gradient-to-r from-white via-eg to-eg transition-all duration-700 ease-out text-glow-sm ${
              mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}
            style={{ transitionDelay: '350ms' }}
          >
            WHAT'S NEXT.
          </span>
        </h1>

        {/* ── Concise Supporting Statement ── */}
        <p
          className={`font-sans text-sm sm:text-base md:text-lg text-white/60 font-light mt-6 max-w-xl leading-relaxed transition-all duration-700 ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
          style={{ transitionDelay: '500ms' }}
        >
          A laboratory for technology, ideas, experiments and creators. Where precision meets relentless innovation.
        </p>

        {/* ── Primary & Secondary CTAs ── */}
        <div
          className={`flex flex-wrap items-center justify-center gap-4 mt-10 transition-all duration-700 ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
          style={{ transitionDelay: '650ms' }}
        >
          {/* Primary CTA */}
          <button
            id="hero-explore-projects-btn"
            onClick={scrollToProjects}
            className="group relative inline-flex items-center gap-3 px-7 py-3.5 rounded-xl font-mono-custom text-xs tracking-widest uppercase text-dark bg-eg hover:bg-eg-200 transition-all duration-300 shadow-lg shadow-eg/20 hover:shadow-eg/40 hover:scale-[1.02] active:scale-[0.98] font-bold"
          >
            <span>EXPLORE PROJECTS</span>
            <ArrowRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-1" />
          </button>

          {/* Secondary Action */}
          <button
            id="hero-enter-lab-btn"
            onClick={scrollToLab}
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl font-mono-custom text-xs tracking-widest uppercase text-white/70 hover:text-white border border-white/10 hover:border-eg/40 bg-dark-200/50 hover:bg-eg/5 transition-all duration-300 backdrop-blur-md"
          >
            <span>THE LAB</span>
            <span className="text-eg/60">↓</span>
          </button>
        </div>

        {/* ── Technical Micro Data Bar ── */}
        <div
          className={`mt-16 sm:mt-20 flex items-center justify-center gap-6 sm:gap-10 text-white/30 font-mono-custom text-[10px] tracking-widest uppercase transition-all duration-1000 ${
            mounted ? 'opacity-100' : 'opacity-0'
          }`}
          style={{ transitionDelay: '800ms' }}
        >
          <div className="flex items-center gap-2">
            <span className="w-1 h-1 rounded-full bg-eg/60" />
            <span>EST. 2024</span>
          </div>
          <div className="h-3 w-px bg-white/10" />
          <div className="flex items-center gap-2">
            <span className="w-1 h-1 rounded-full bg-eg/60" />
            <span>OPEN ARCHITECTURE</span>
          </div>
          <div className="h-3 w-px bg-white/10 hidden sm:block" />
          <div className="hidden sm:flex items-center gap-2">
            <span className="w-1 h-1 rounded-full bg-eg/60" />
            <span>EXPERIMENT · BUILD</span>
          </div>
        </div>
      </div>

      {/* ── Scroll Indicator ── */}
      <div
        onClick={scrollToProjects}
        className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 opacity-40 hover:opacity-100 transition-opacity cursor-pointer z-10"
      >
        <span className="font-mono-custom text-[9px] tracking-widest text-white uppercase">SCROLL</span>
        <div className="w-px h-6 bg-gradient-to-b from-eg/60 to-transparent animate-pulse" />
      </div>
    </section>
  );
};

export default Hero;

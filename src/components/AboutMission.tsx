import React, { useEffect, useRef, useState } from 'react';
import { RadarGraphic, TerrainGraphic } from './ui';

/* ── Intersection-observer hook ─────────────────────────────────── */
function useVisible(threshold = 0.2) {
  const ref  = useRef<HTMLDivElement>(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVis(true); }, { threshold });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, vis };
}

/* ── Card wrapper ───────────────────────────────────────────────── */
const InfoCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  graphic: React.ReactNode;
  children: React.ReactNode;
  delay?: string;
  vis: boolean;
  id?: string;
}> = ({ icon, label, graphic, children, delay = '0ms', vis, id }) => (
  <div
    id={id}
    className={`card flex-1 p-8 transition-all duration-700 ${
      vis ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
    }`}
    style={{ transitionDelay: delay }}
  >
    {/* Header row */}
    <div className="flex items-start justify-between mb-6">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-sm bg-eg/10 border border-eg/20 flex items-center justify-center text-eg flex-shrink-0">
          {icon}
        </div>
        <h2 className="font-display text-base tracking-widest text-white">{label}</h2>
      </div>
      <div className="flex-shrink-0 opacity-70">
        {graphic}
      </div>
    </div>

    {/* Body */}
    <div className="font-sans text-sm text-white/50 leading-relaxed space-y-3">
      {children}
    </div>

    {/* Bottom line accent */}
    <div className="mt-6 h-px bg-gradient-to-r from-eg/30 via-eg/10 to-transparent" />
  </div>
);

/* ── Person icon ────────────────────────────────────────────────── */
const PersonIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" strokeLinecap="round" />
  </svg>
);

/* ── Target icon ─────────────────────────────────────────────────── */
const TargetIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="5" />
    <circle cx="12" cy="12" r="1.5" fill="currentColor" />
  </svg>
);

/* ── About & Mission Section ────────────────────────────────────── */
const AboutMission: React.FC = () => {
  const { ref, vis } = useVisible(0.15);

  return (
    <section id="about" ref={ref} className="py-20 md:py-28 bg-circuit relative">
      {/* Ambient glow */}
      <div
        className="absolute pointer-events-none inset-0"
        style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(0,255,136,0.04) 0%, transparent 70%)' }}
      />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        {/* Section header */}
        <div
          className={`text-center mb-14 transition-all duration-700 ${
            vis ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          <p className="section-label justify-center">
            <span className="w-6 h-px bg-eg/50" />
            Who We Are
            <span className="w-6 h-px bg-eg/50" />
          </p>
          <h2 className="font-display text-2xl md:text-3xl tracking-widest text-white">
            ABOUT &amp; MISSION
          </h2>
        </div>

        {/* Cards */}
        <div className="flex flex-col md:flex-row gap-6">
          <InfoCard
            id="about-card"
            icon={<PersonIcon />}
            label="ABOUT"
            graphic={<TerrainGraphic />}
            delay="0ms"
            vis={vis}
          >
            <p>
              ISOMER is a platform built for the focused, the disciplined, and those who dare to
              build things that matter. We operate at the intersection of engineering, design, and
              creative technology.
            </p>
            <p>
              Founded in 2024, our mission is to harness cutting-edge tools and methodologies to
              create products that leave a lasting mark on the world.
            </p>
            <p>
              Every line of code, every design decision, every project we undertake is guided by
              a singular principle: <span className="text-eg">make it exceptional</span>.
            </p>
          </InfoCard>

          <InfoCard
            id="mission-card"
            icon={<TargetIcon />}
            label="MISSION"
            graphic={<RadarGraphic />}
            delay="150ms"
            vis={vis}
          >
            <p>
              Our mission is to build, inspire, and elevate — to push the boundaries of what's
              possible through technology, and to cultivate a mindset of relentless progress
              and disciplined innovation.
            </p>
            <p>
              We believe great work demands focus, consistency, and courage. We're committed to
              projects that challenge the status quo and deliver real-world impact.
            </p>
            <p>
              Stay disciplined. Keep building.{' '}
              <span className="text-eg font-semibold">Make IMPACT.</span>
            </p>
          </InfoCard>
        </div>

        {/* Stats bar */}
        <div
          className={`mt-10 glass rounded-lg p-6 flex flex-wrap items-center justify-around gap-6 transition-all duration-700 delay-300 ${
            vis ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          {[
            { value: '2024', label: 'Est.' },
            { value: '∞',   label: 'Ambition' },
            { value: '100%', label: 'Commitment' },
            { value: '0→1',  label: 'Builder mindset' },
          ].map(stat => (
            <div key={stat.label} className="text-center">
              <div className="font-display text-2xl md:text-3xl font-bold text-eg text-glow-sm">
                {stat.value}
              </div>
              <div className="font-mono-custom text-[10px] tracking-widest text-white/40 uppercase mt-1">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default AboutMission;

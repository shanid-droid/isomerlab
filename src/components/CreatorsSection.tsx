import React, { useRef, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from './ui';
import { useFeaturedCreators, useProjects } from '../lib/hooks';
import type { FeaturedCreator } from '../lib/hooks';

/* ── Live Metric Counter Component ──────────────────────────────── */
const CounterItem: React.FC<{ value: number; label: string; suffix?: string; vis: boolean }> = ({
  value, label, suffix = '', vis,
}) => {
  const [displayVal, setDisplayVal] = useState(0);

  useEffect(() => {
    if (!vis) return;
    let start = 0;
    const duration = 1200;
    const stepTime = 30;
    const steps = duration / stepTime;
    const increment = value / steps;

    const timer = setInterval(() => {
      start += increment;
      if (start >= value) {
        setDisplayVal(value);
        clearInterval(timer);
      } else {
        setDisplayVal(Math.floor(start));
      }
    }, stepTime);

    return () => clearInterval(timer);
  }, [value, vis]);

  return (
    <div className="flex flex-col items-center sm:items-start">
      <div className="font-display font-black text-3xl sm:text-4xl md:text-5xl text-white tracking-tight flex items-baseline">
        <span>{displayVal}</span>
        {suffix && <span className="text-eg ml-0.5">{suffix}</span>}
      </div>
      <span className="font-mono-custom text-[11px] tracking-[0.2em] text-white/40 uppercase mt-1">
        {label}
      </span>
    </div>
  );
};

/* ── Single Creator Card ─────────────────────────────────────────── */
const CreatorCard: React.FC<{ creator: FeaturedCreator; index: number; vis: boolean }> = ({
  creator, index, vis,
}) => {
  const initials = creator.full_name
    ? creator.full_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'CR';

  const roleLabel = creator.role === 'admin' || creator.role === 'owner'
    ? 'CORE TEAM'
    : creator.role === 'creator'
    ? 'CREATOR'
    : 'MEMBER';

  return (
    <Link
      to={`/profile/${creator.id}`}
      id={`creator-card-${creator.id}`}
      className={`group glass-dark rounded-2xl p-5 sm:p-6 border border-white/10 hover:border-eg/50 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-eg/10 flex flex-col justify-between relative ${
        vis ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      }`}
      style={{ transitionDelay: `${index * 80}ms` }}
    >
      {/* Corner bracket */}
      <div className="absolute top-2.5 right-2.5 w-3 h-3 border-t border-r border-eg/30 opacity-0 group-hover:opacity-100 transition-opacity" />

      <div className="space-y-4">
        {/* Avatar & Role Header */}
        <div className="flex items-center justify-between">
          <div className="relative">
            {creator.avatar_url ? (
              <img
                src={creator.avatar_url}
                alt={creator.full_name || 'Creator'}
                className="w-12 h-12 rounded-xl object-cover border border-eg/30 group-hover:border-eg transition-colors"
                loading="lazy"
              />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-dark-300 border border-eg/30 flex items-center justify-center group-hover:border-eg transition-colors">
                <span className="font-display text-sm font-bold text-eg">{initials}</span>
              </div>
            )}
            <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-eg border-2 border-dark" />
          </div>

          <span className="font-mono-custom text-[9px] px-2 py-0.5 rounded border border-eg/20 bg-eg/5 text-eg tracking-widest uppercase">
            {roleLabel}
          </span>
        </div>

        {/* Name & Bio */}
        <div>
          <h4 className="font-display text-base font-bold text-white group-hover:text-eg transition-colors tracking-wide line-clamp-1">
            {creator.full_name || 'Anonymous Creator'}
          </h4>
          {creator.bio && (
            <p className="font-sans text-xs text-white/50 leading-relaxed line-clamp-2 mt-1">
              {creator.bio}
            </p>
          )}
        </div>
      </div>

      {/* Projects count bottom bar */}
      <div className="pt-4 mt-4 border-t border-white/5 flex items-center justify-between font-mono-custom text-[10px]">
        <span className="text-white/40 tracking-wider">
          {creator.projects_count} {creator.projects_count === 1 ? 'PROJECT' : 'PROJECTS'}
        </span>
        <span className="text-eg opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 font-semibold">
          VIEW PROFILE →
        </span>
      </div>
    </Link>
  );
};

/* ── Main Creators Section ───────────────────────────────────────── */
export const CreatorsSection: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null);
  const [vis, setVis] = useState(false);

  const { creators, loading: creatorsLoading } = useFeaturedCreators();
  const { projects } = useProjects();

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVis(true);
      },
      { threshold: 0.15 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  const totalProjects = projects.length;
  const totalCreators = creators.length;

  return (
    <section id="creators" ref={ref} className="py-24 md:py-32 bg-dark relative">
      {/* Top divider */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-eg/20 to-transparent" />

      <div className="max-w-7xl mx-auto px-6 relative z-10 space-y-16">
        {/* Header with Statement & Live Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-end border-b border-white/5 pb-10">
          <div
            className={`lg:col-span-7 space-y-3 transition-all duration-700 ${
              vis ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
            }`}
          >
            <div className="inline-flex items-center gap-2 font-mono-custom text-[11px] tracking-[0.25em] text-eg uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-eg animate-pulse" />
              COMMUNITY & ARCHITECTURE
            </div>
            <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white">
              BUILT BY PEOPLE
            </h2>
            <p className="font-sans text-base sm:text-lg text-white/60 font-light leading-relaxed">
              Creators. Developers. Makers. Experimenters.
            </p>
          </div>

          {/* Live Platform Stats */}
          <div
            className={`lg:col-span-5 grid grid-cols-2 gap-8 transition-all duration-700 delay-200 ${
              vis ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
            }`}
          >
            <CounterItem
              value={totalProjects > 0 ? totalProjects : 1}
              label="Published Projects"
              suffix="+"
              vis={vis}
            />
            <CounterItem
              value={totalCreators > 0 ? totalCreators : 1}
              label="Verified Creators"
              suffix=""
              vis={vis}
            />
          </div>
        </div>

        {/* Creators Grid */}
        {creatorsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="glass-dark rounded-2xl h-44 animate-pulse border border-white/5" />
            ))}
          </div>
        ) : creators.length === 0 ? (
          <div className="glass-dark rounded-2xl p-12 border border-white/10 text-center space-y-3">
            <p className="font-display text-sm tracking-widest text-white uppercase">CREATORS JOINING SOON</p>
            <p className="font-mono-custom text-xs text-white/40">Apply to become an approved ISOMER creator.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {creators.slice(0, 8).map((creator, i) => (
              <CreatorCard key={creator.id} creator={creator} index={i} vis={vis} />
            ))}
          </div>
        )}

        {/* Join as creator banner */}
        <div
          className={`glass-dark rounded-2xl p-8 border border-eg/20 flex flex-col sm:flex-row items-center justify-between gap-6 transition-all duration-700 delay-300 ${
            vis ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          <div className="space-y-1 text-center sm:text-left">
            <h4 className="font-display text-lg font-bold text-white tracking-wide">
              BUILD AND PUBLISH YOUR SYSTEMS
            </h4>
            <p className="font-sans text-xs text-white/50">
              Join ISOMER as a verified creator to upload projects, version architectures, and showcase work.
            </p>
          </div>
          <Link
            to="/apply-creator"
            id="creators-join-btn"
            className="btn-primary text-xs py-3 px-6 whitespace-nowrap flex-shrink-0"
          >
            <span>JOIN AS CREATOR</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
};

export default CreatorsSection;

import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from './ui';
import { useProjects } from '../lib/hooks';
import type { ProjectWithCreator } from '../lib/types';

export const FeaturedProjectSection: React.FC = () => {
  const { projects, loading, error } = useProjects();
  const [activeIndex, setActiveIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  // Take top published projects (up to 5)
  const featuredList = useMemo(() => projects.slice(0, 5), [projects]);
  const total = featuredList.length;

  useEffect(() => {
    if (activeIndex >= total && total > 0) {
      setActiveIndex(0);
    }
  }, [total, activeIndex]);

  const currentProject: ProjectWithCreator | undefined = featuredList[activeIndex];

  const handlePrev = () => {
    setActiveIndex((prev) => (prev > 0 ? prev - 1 : total - 1));
  };

  const handleNext = () => {
    setActiveIndex((prev) => (prev < total - 1 ? prev + 1 : 0));
  };

  // Parse technology chips
  const comps = useMemo(() => {
    if (!currentProject?.components) return [];
    if (Array.isArray(currentProject.components)) return currentProject.components;
    return currentProject.components.split(',').map((c) => c.trim()).filter(Boolean);
  }, [currentProject?.components]);

  if (loading) {
    return (
      <section id="featured-project" className="py-20 md:py-28 bg-dark relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="glass-dark rounded-2xl border border-eg/10 h-[480px] animate-pulse flex items-center justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-eg/30 border-t-eg animate-spin" />
          </div>
        </div>
      </section>
    );
  }

  if (error || !currentProject) {
    return null; // Gracefully hidden if no published project exists yet
  }

  const numDisplay = String(activeIndex + 1).padStart(2, '0');
  const totalDisplay = String(total).padStart(2, '0');

  return (
    <section id="featured-project" className="py-20 md:py-28 bg-dark relative">
      {/* Subtle top divider line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-eg/20 to-transparent" />

      <div className="max-w-7xl mx-auto px-6 relative z-10 space-y-8">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-white/5 pb-6">
          <div>
            <div className="inline-flex items-center gap-2 font-mono-custom text-[11px] tracking-[0.25em] text-eg uppercase mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-eg animate-pulse" />
              SPOTLIGHT
            </div>
            <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-white">
              FEATURED PROJECT
            </h2>
          </div>

          {/* Carousel Counter & Controls */}
          {total > 1 && (
            <div className="flex items-center gap-4">
              <div className="font-mono-custom text-xs tracking-widest text-white/50">
                <span className="text-white font-semibold">{numDisplay}</span>
                <span className="text-white/20 mx-1">/</span>
                <span>{totalDisplay}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handlePrev}
                  aria-label="Previous project"
                  className="w-9 h-9 rounded-xl border border-white/15 bg-dark-200/60 hover:border-eg/50 hover:bg-eg/10 text-white/60 hover:text-eg flex items-center justify-center transition-all duration-200"
                >
                  <ArrowRight className="w-3.5 h-3.5 rotate-180" />
                </button>
                <button
                  onClick={handleNext}
                  aria-label="Next project"
                  className="w-9 h-9 rounded-xl border border-white/15 bg-dark-200/60 hover:border-eg/50 hover:bg-eg/10 text-white/60 hover:text-eg flex items-center justify-center transition-all duration-200"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Main Featured Showcase Card ── */}
        <div
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className="group relative glass-dark rounded-2xl border border-eg/20 overflow-hidden transition-all duration-500 hover:border-eg/50 hover:shadow-2xl hover:shadow-eg/10"
        >
          {/* Cyberpunk corner accents */}
          <div className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-eg/60 pointer-events-none z-20" />
          <div className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-eg/60 pointer-events-none z-20" />
          <div className="absolute bottom-3 left-3 w-4 h-4 border-b-2 border-l-2 border-eg/60 pointer-events-none z-20" />
          <div className="absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 border-eg/60 pointer-events-none z-20" />

          {/* Scanning line animation on hover */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none z-10 opacity-0 group-hover:opacity-30 transition-opacity">
            <div className="scan-line" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-0">
            {/* Left: Project Visual */}
            <div className="lg:col-span-7 relative min-h-[300px] sm:min-h-[400px] lg:min-h-[480px] bg-dark-300 overflow-hidden flex items-center justify-center">
              {currentProject.thumbnail_url ? (
                <img
                  src={currentProject.thumbnail_url}
                  alt={currentProject.title}
                  className={`w-full h-full object-cover transition-transform duration-700 ease-out ${
                    isHovered ? 'scale-105' : 'scale-100'
                  }`}
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-circuit p-8 text-center">
                  <span className="font-display text-7xl font-bold text-eg/15">{numDisplay}</span>
                  <span className="font-mono-custom text-xs text-eg/40 tracking-widest uppercase mt-2">
                    ISOMER ARCHITECTURE SHOWCASE
                  </span>
                </div>
              )}

              {/* Gradient shading overlay */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: 'linear-gradient(to top, rgba(8,12,10,0.9) 0%, rgba(8,12,10,0.2) 60%, transparent 100%)',
                }}
              />

              {/* Number Badge */}
              <div className="absolute top-6 left-6 z-10">
                <span className="font-mono-custom text-xs font-bold text-eg bg-dark-100/90 border border-eg/40 px-3 py-1 rounded-lg backdrop-blur-md">
                  INDEX / {numDisplay}
                </span>
              </div>
            </div>

            {/* Right: Project Details & Action */}
            <div className="lg:col-span-5 p-8 sm:p-10 md:p-12 flex flex-col justify-between space-y-6 relative z-20">
              <div className="space-y-4">
                {/* Tech Chips */}
                {comps.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {comps.slice(0, 4).map((tech, i) => (
                      <span
                        key={i}
                        className="font-mono-custom text-[10px] px-2.5 py-1 rounded-md bg-dark-200 border border-eg/25 text-white/80 tracking-wider uppercase"
                      >
                        {tech}
                      </span>
                    ))}
                  </div>
                )}

                {/* Project Title */}
                <h3 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-white group-hover:text-eg transition-colors duration-300">
                  {currentProject.title}
                </h3>

                {/* Project Description */}
                <p className="font-sans text-sm sm:text-base text-white/60 leading-relaxed line-clamp-4">
                  {currentProject.description}
                </p>

                {/* Creator attribution */}
                {currentProject.created_by && (
                  <div className="pt-2 flex items-center gap-3">
                    {currentProject.creator_avatar_url ? (
                      <img
                        src={currentProject.creator_avatar_url}
                        alt={currentProject.creator_name || 'Creator'}
                        className="w-7 h-7 rounded-full object-cover border border-eg/30"
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-dark-300 border border-eg/30 flex items-center justify-center">
                        <span className="font-display text-[9px] font-bold text-eg">
                          {currentProject.creator_name?.[0] || 'C'}
                        </span>
                      </div>
                    )}
                    <Link
                      to={`/profile/${currentProject.created_by}`}
                      className="font-mono-custom text-xs text-white/50 hover:text-eg transition-colors tracking-wide truncate"
                    >
                      Built by <span className="text-white/80 font-medium">{currentProject.creator_name || 'Anonymous Creator'}</span>
                    </Link>
                  </div>
                )}
              </div>

              {/* Explore CTA */}
              <div className="pt-6 border-t border-white/5">
                <Link
                  to={`/projects/${currentProject.slug}`}
                  id="featured-explore-cta"
                  className="inline-flex items-center justify-between w-full p-4 rounded-xl border border-eg/30 bg-eg/5 hover:bg-eg/15 text-eg font-mono-custom text-xs tracking-widest uppercase transition-all duration-300 group/btn"
                >
                  <span className="font-bold">EXPLORE PROJECT SPECIFICATION</span>
                  <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover/btn:translate-x-1" />
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Carousel Dot Indicators */}
        {total > 1 && (
          <div className="flex items-center justify-center gap-2 pt-2">
            {featuredList.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveIndex(i)}
                aria-label={`Go to project ${i + 1}`}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  activeIndex === i ? 'w-8 bg-eg shadow-sm shadow-eg/50' : 'w-2 bg-white/20 hover:bg-white/40'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default FeaturedProjectSection;

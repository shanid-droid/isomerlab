import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from './ui';
import { useProjects } from '../lib/hooks';
import type { ProjectWithCreator } from '../lib/types';

export const ProjectDiscoverySection: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null);
  const [vis, setVis] = useState(false);
  const { projects, loading, error } = useProjects();

  const [activeProject, setActiveProject] = useState<ProjectWithCreator | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'catalogue' | 'grid'>('catalogue');

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVis(true);
      },
      { threshold: 0.1 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  // Filter projects by title, components, or creator
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return projects;
    const q = searchQuery.toLowerCase().trim();
    return projects.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.creator_name?.toLowerCase().includes(q) ||
        (typeof p.components === 'string' && p.components.toLowerCase().includes(q)) ||
        (Array.isArray(p.components) && p.components.some((c) => c.toLowerCase().includes(q)))
    );
  }, [projects, searchQuery]);

  // Set default active project for catalogue view preview
  useEffect(() => {
    if (filtered.length > 0 && !activeProject) {
      setActiveProject(filtered[0]);
    } else if (filtered.length > 0 && activeProject && !filtered.some((p) => p.id === activeProject.id)) {
      setActiveProject(filtered[0]);
    }
  }, [filtered, activeProject]);

  const parseTech = (d?: string[] | string | null): string[] => {
    if (!d) return [];
    if (Array.isArray(d)) return d;
    return d.split(',').map((c) => c.trim()).filter(Boolean);
  };

  return (
    <section id="projects" ref={ref} className="py-24 md:py-32 bg-dark bg-circuit relative">
      {/* Top line accent */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-eg/20 to-transparent" />

      <div className="max-w-7xl mx-auto px-6 relative z-10 space-y-12">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/5 pb-8">
          <div
            className={`space-y-3 transition-all duration-700 ${
              vis ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
            }`}
          >
            <div className="inline-flex items-center gap-2 font-mono-custom text-[11px] tracking-[0.25em] text-eg uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-eg animate-pulse" />
              LAB ARCHIVE
            </div>
            <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white">
              PROJECT CATALOGUE
            </h2>
            <p className="font-sans text-sm sm:text-base text-white/50 font-light">
              Explore documented systems, experiments and open architectures.
            </p>
          </div>

          {/* Search Bar & View Toggle */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[240px] sm:min-w-[280px]">
              <svg
                className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-eg/60"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
              </svg>
              <input
                id="catalogue-search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search systems, creators, stack..."
                className="w-full bg-dark-200/80 border border-white/15 focus:border-eg rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-eg transition-all font-mono-custom"
              />
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center p-1 bg-dark-200/80 border border-white/10 rounded-xl">
              <button
                onClick={() => setViewMode('catalogue')}
                className={`px-3 py-1.5 rounded-lg font-mono-custom text-[10px] uppercase transition-all ${
                  viewMode === 'catalogue' ? 'bg-eg/20 text-eg' : 'text-white/40 hover:text-white'
                }`}
              >
                CATALOGUE
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-1.5 rounded-lg font-mono-custom text-[10px] uppercase transition-all ${
                  viewMode === 'grid' ? 'bg-eg/20 text-eg' : 'text-white/40 hover:text-white'
                }`}
              >
                GRID
              </button>
            </div>
          </div>
        </div>

        {/* Content Area */}
        {loading ? (
          <div className="py-24 text-center">
            <div className="w-8 h-8 rounded-full border-2 border-eg/30 border-t-eg animate-spin mx-auto" />
            <p className="font-mono-custom text-xs text-white/40 mt-4 tracking-widest uppercase">LOADING ARCHIVE...</p>
          </div>
        ) : error ? (
          <div className="glass-dark rounded-2xl p-12 text-center border border-red-500/30">
            <p className="font-mono-custom text-xs text-red-400 uppercase tracking-widest">{error}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass-dark rounded-2xl py-16 px-6 text-center border border-white/10 space-y-3">
            <p className="font-display text-sm tracking-widest text-white uppercase">NO PROJECTS MATCH CRITERIA</p>
            <button
              onClick={() => setSearchQuery('')}
              className="font-mono-custom text-xs text-eg hover:underline"
            >
              Reset search filter
            </button>
          </div>
        ) : viewMode === 'catalogue' ? (
          /* ── Editorial Catalogue View (Interactive Split Layout) ── */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left: Project List */}
            <div className="lg:col-span-7 divide-y divide-white/5 border-y border-white/5">
              {filtered.map((proj, idx) => {
                const num = String(idx + 1).padStart(2, '0');
                const isSelected = activeProject?.id === proj.id;
                const techList = parseTech(proj.components);

                return (
                  <div
                    key={proj.id}
                    onMouseEnter={() => setActiveProject(proj)}
                    className={`group py-5 px-4 sm:px-6 transition-all duration-200 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl ${
                      isSelected ? 'bg-dark-200/90 border border-eg/30 shadow-lg shadow-eg/5' : 'hover:bg-dark-200/40'
                    }`}
                  >
                    <div className="flex items-start sm:items-center gap-4">
                      <span className={`font-mono-custom text-xs font-bold transition-colors ${
                        isSelected ? 'text-eg' : 'text-white/30 group-hover:text-white/60'
                      }`}>
                        {num}
                      </span>
                      <div>
                        <h4 className={`font-display text-base sm:text-lg font-bold tracking-wide transition-colors ${
                          isSelected ? 'text-eg' : 'text-white group-hover:text-eg'
                        }`}>
                          {proj.title}
                        </h4>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span className="font-mono-custom text-[10px] text-white/40">
                            {proj.creator_name || 'Anonymous'}
                          </span>
                          {techList.length > 0 && (
                            <>
                              <span className="text-white/20 text-[10px]">•</span>
                              <span className="font-mono-custom text-[10px] text-eg/60">
                                {techList.slice(0, 2).join(', ')}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <Link
                      to={`/projects/${proj.slug}`}
                      className="inline-flex items-center gap-1.5 font-mono-custom text-xs text-eg font-semibold hover:underline self-end sm:self-center"
                    >
                      <span>SPECS</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                );
              })}
            </div>

            {/* Right: Sticky Live Preview Card */}
            <div className="lg:col-span-5 hidden lg:block sticky top-28">
              {activeProject && (
                <div className="glass-dark rounded-2xl p-6 border border-eg/30 shadow-2xl space-y-5 animate-fade-in-up">
                  {/* Thumbnail Preview */}
                  <div className="relative h-60 rounded-xl overflow-hidden bg-dark-300 border border-eg/20">
                    {activeProject.thumbnail_url ? (
                      <img
                        src={activeProject.thumbnail_url}
                        alt={activeProject.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-circuit">
                        <span className="font-display text-4xl font-bold text-eg/20">ISOMER</span>
                      </div>
                    )}
                    <div
                      className="absolute inset-0 pointer-events-none"
                      style={{ background: 'linear-gradient(to top, rgba(8,12,10,0.85) 0%, transparent 60%)' }}
                    />
                    <div className="absolute top-3 left-3">
                      <span className="font-mono-custom text-[10px] text-eg font-bold bg-dark-100/90 px-2.5 py-1 rounded border border-eg/40 backdrop-blur-md">
                        LIVE PREVIEW
                      </span>
                    </div>
                  </div>

                  {/* Title & Excerpt */}
                  <div className="space-y-2">
                    <h3 className="font-display text-xl font-bold text-white tracking-wide">
                      {activeProject.title}
                    </h3>
                    <p className="font-sans text-xs text-white/60 leading-relaxed line-clamp-3">
                      {activeProject.description}
                    </p>
                  </div>

                  {/* Tech stack */}
                  {parseTech(activeProject.components).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {parseTech(activeProject.components).slice(0, 4).map((tech, i) => (
                        <span
                          key={i}
                          className="font-mono-custom text-[9px] px-2 py-0.5 rounded bg-dark-200 border border-eg/20 text-white/70 tracking-wider uppercase"
                        >
                          {tech}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Link CTA */}
                  <div className="pt-4 border-t border-white/5">
                    <Link
                      to={`/projects/${activeProject.slug}`}
                      className="btn-primary w-full justify-center text-xs py-3"
                    >
                      <span>VIEW FULL ARCHITECTURE</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ── Grid View ── */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((proj, idx) => {
              const num = String(idx + 1).padStart(2, '0');
              const techList = parseTech(proj.components);

              return (
                <Link
                  key={proj.id}
                  to={`/projects/${proj.slug}`}
                  className="group glass-dark rounded-2xl overflow-hidden border border-white/10 hover:border-eg/50 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-eg/10 flex flex-col justify-between"
                >
                  <div className="relative h-48 bg-dark-300 overflow-hidden">
                    {proj.thumbnail_url ? (
                      <img
                        src={proj.thumbnail_url}
                        alt={proj.title}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-circuit">
                        <span className="font-display text-4xl font-bold text-eg/20">{num}</span>
                      </div>
                    )}
                    <div
                      className="absolute inset-0 pointer-events-none"
                      style={{ background: 'linear-gradient(to top, rgba(8,12,10,0.85) 0%, transparent 60%)' }}
                    />
                    <div className="absolute top-3 left-3">
                      <span className="font-mono-custom text-[10px] text-eg font-bold bg-dark-100/90 px-2 py-0.5 rounded border border-eg/30">
                        {num}
                      </span>
                    </div>
                  </div>

                  <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                    <div className="space-y-2">
                      <h4 className="font-display text-base font-bold text-white group-hover:text-eg transition-colors line-clamp-1">
                        {proj.title}
                      </h4>
                      <p className="font-sans text-xs text-white/50 leading-relaxed line-clamp-2">
                        {proj.description}
                      </p>
                    </div>

                    {techList.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {techList.slice(0, 3).map((t, i) => (
                          <span key={i} className="font-mono-custom text-[9px] px-2 py-0.5 rounded bg-dark-200 border border-eg/20 text-white/60">
                            {t}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="pt-3 border-t border-white/5 flex items-center justify-between text-xs font-mono-custom">
                      <span className="text-white/40 text-[10px] truncate max-w-[140px]">
                        {proj.creator_name || 'Anonymous'}
                      </span>
                      <span className="text-eg flex items-center gap-1 font-semibold">
                        VIEW →
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};

export default ProjectDiscoverySection;

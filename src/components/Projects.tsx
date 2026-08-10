import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from './ui';
import { useProjects } from '../lib/hooks';
import type { ProjectWithCreator } from '../lib/types';

/* ── Intersection-Observer Hook ─────────────────────────────────── */
function useVisible(threshold = 0.1) {
  const ref  = useRef<HTMLDivElement>(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVis(true); },
      { threshold },
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, vis };
}

/* ── Creator Avatar Mini Component ──────────────────────────────── */
const CreatorAvatar: React.FC<{
  name: string | null;
  avatarUrl: string | null;
  creatorId: string | null;
  size?: 'sm' | 'xs';
}> = ({ name, avatarUrl, creatorId, size = 'xs' }) => {
  const dim = size === 'xs' ? 'w-6 h-6' : 'w-8 h-8';
  const initials = name
    ? name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : '??';

  const inner = avatarUrl ? (
    <img
      src={avatarUrl}
      alt={name || 'Creator'}
      className={`${dim} rounded-full object-cover border border-eg/30 flex-shrink-0`}
      loading="lazy"
    />
  ) : (
    <div className={`${dim} rounded-full bg-dark-300 border border-eg/30 flex items-center justify-center flex-shrink-0`}>
      <span className="font-display font-bold text-eg" style={{ fontSize: '8px' }}>{initials}</span>
    </div>
  );

  if (!creatorId) return inner;

  return (
    <Link to={`/profile/${creatorId}`} onClick={(e) => e.stopPropagation()} title={`View ${name || 'creator'}'s profile`}>
      {inner}
    </Link>
  );
};

/* ── Skeleton Card (Loading State) ──────────────────────────────── */
const SkeletonCard: React.FC<{ delay: string }> = ({ delay }) => (
  <div
    className="glass rounded-2xl overflow-hidden animate-pulse border border-eg/10 flex flex-col h-[460px]"
    style={{ animationDelay: delay }}
  >
    <div className="h-52 bg-dark-300/80 relative">
      <div className="absolute top-4 left-4 h-4 w-12 rounded bg-dark-400/80" />
    </div>
    <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
      <div className="space-y-3">
        <div className="h-5 w-3/4 rounded bg-dark-400/80" />
        <div className="h-3 w-full rounded bg-dark-400/50" />
        <div className="h-3 w-5/6 rounded bg-dark-400/50" />
      </div>
      <div className="flex gap-2 pt-4 border-t border-eg/5">
        <div className="h-5 w-16 rounded bg-dark-400/60" />
        <div className="h-5 w-20 rounded bg-dark-400/60" />
      </div>
      <div className="flex items-center gap-2 pt-2">
        <div className="w-6 h-6 rounded-full bg-dark-400/60" />
        <div className="h-3 w-24 rounded bg-dark-400/50" />
      </div>
    </div>
  </div>
);

/* ── Error State ─────────────────────────────────────────────────── */
const ErrorState: React.FC<{ message: string }> = ({ message }) => (
  <div className="col-span-full glass rounded-2xl p-12 border border-red-500/30 flex flex-col items-center justify-center text-center gap-4">
    <div className="w-12 h-12 rounded-full border border-red-500/40 bg-red-500/10 flex items-center justify-center">
      <svg className="w-5 h-5 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
      </svg>
    </div>
    <p className="font-mono-custom text-xs tracking-widest text-red-400 uppercase font-semibold">
      UNABLE TO FETCH PUBLISHED PROJECTS
    </p>
    <p className="font-sans text-xs text-white/40 max-w-sm">{message}</p>
  </div>
);

/* ── Empty State ─────────────────────────────────────────────────── */
const EmptyState: React.FC<{ filtered?: boolean }> = ({ filtered }) => (
  <div className="col-span-full glass rounded-2xl py-16 px-6 border border-eg/20 flex flex-col items-center justify-center text-center gap-4">
    <div className="w-14 h-14 rounded-full border border-eg/30 bg-eg/10 flex items-center justify-center text-eg">
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M9 9h6M9 12h6M9 15h4" strokeLinecap="round" />
      </svg>
    </div>
    <div>
      <p className="font-display text-sm tracking-widest text-white uppercase mb-1">
        {filtered ? 'NO PROJECTS MATCH YOUR FILTER' : 'NO PUBLISHED PROJECTS YET'}
      </p>
      <p className="font-mono-custom text-xs text-eg/60 tracking-wider">
        {filtered ? 'Try a different creator or clear the filter.' : 'Check back soon for new project architecture showcases.'}
      </p>
    </div>
  </div>
);

/* ── Single Project Card ─────────────────────────────────────────── */
const ProjectCard: React.FC<{ project: ProjectWithCreator; index: number; vis: boolean }> = ({
  project, index, vis,
}) => {
  const [hovered, setHovered] = useState(false);
  const num = String(index + 1).padStart(2, '0');

  const parseComponents = (compData: string[] | string | null | undefined): string[] => {
    if (!compData) return [];
    if (Array.isArray(compData)) return compData;
    if (typeof compData === 'string') {
      return compData.split(',').map((c) => c.trim()).filter(Boolean);
    }
    return [];
  };

  const comps = parseComponents(project.components);

  return (
    <Link
      to={`/projects/${project.slug}`}
      id={`project-card-${project.slug}`}
      className={`group relative flex flex-col glass rounded-2xl overflow-hidden border border-eg/15
        transition-all duration-500 hover:-translate-y-2 hover:border-eg/50 hover:shadow-2xl hover:shadow-eg/10 ${
          vis ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
        }`}
      style={{ transitionDelay: `${index * 120}ms` }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* ── Thumbnail ─────────────────────────────────────────────── */}
      <div className="relative h-56 overflow-hidden flex-shrink-0 bg-dark-300">
        {project.thumbnail_url ? (
          <img
            src={project.thumbnail_url}
            alt={project.title}
            className={`w-full h-full object-cover transition-transform duration-700 ${
              hovered ? 'scale-110' : 'scale-100'
            }`}
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-circuit relative p-4">
            <span className="font-display text-4xl font-bold text-eg/20">{num}</span>
            <span className="font-mono-custom text-[10px] text-eg/40 tracking-widest uppercase mt-1">
              ISOMER PROJECT
            </span>
          </div>
        )}

        {/* Ambient Dark Overlay */}
        <div
          className="absolute inset-0 transition-opacity duration-500"
          style={{
            background: 'linear-gradient(to bottom, rgba(8,12,10,0.1) 0%, rgba(8,12,10,0.85) 100%)',
            opacity: hovered ? 0.4 : 0.85,
          }}
        />

        {/* Green Radial Glow on Hover */}
        <div
          className="absolute inset-0 transition-opacity duration-500 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(0,255,136,0.12) 0%, transparent 70%)',
            opacity: hovered ? 1 : 0,
          }}
        />

        {/* Number Badge */}
        <div className="absolute top-4 left-4 flex items-center gap-2">
          <span className="font-display text-xs font-bold text-eg text-glow-sm tracking-wider bg-dark-100/80 px-2 py-0.5 rounded border border-eg/30">
            PROJ-{num}
          </span>
        </div>

        {/* Futuristic Corner Framing on Hover */}
        <div className={`absolute top-3 right-3 w-5 h-5 border-t-2 border-r-2 transition-all duration-300 ${
          hovered ? 'border-eg opacity-100 scale-100' : 'border-eg/20 opacity-0 scale-90'
        }`} />
        <div className={`absolute bottom-3 left-3 w-5 h-5 border-b-2 border-l-2 transition-all duration-300 ${
          hovered ? 'border-eg opacity-100 scale-100' : 'border-eg/20 opacity-0 scale-90'
        }`} />
      </div>

      {/* ── Content ───────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 p-6 space-y-3">
        {/* Title */}
        <h3 className={`font-display text-base font-semibold tracking-wider transition-colors duration-300 ${
          hovered ? 'text-eg text-glow-sm' : 'text-white'
        }`}>
          {project.title}
        </h3>

        {/* Short Description */}
        <p className="font-sans text-xs text-white/50 leading-relaxed line-clamp-3 flex-1">
          {project.description}
        </p>

        {/* Tech Component Chips */}
        {comps.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {comps.slice(0, 3).map((tech, i) => (
              <span
                key={i}
                className="font-mono-custom text-[10px] px-2 py-0.5 rounded-md bg-dark-200 border border-eg/20 text-white/70 tracking-wider"
              >
                {tech}
              </span>
            ))}
            {comps.length > 3 && (
              <span className="font-mono-custom text-[10px] px-1.5 py-0.5 rounded-md bg-dark-200 border border-white/10 text-white/40">
                +{comps.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Creator Row */}
        {project.created_by && (
          <div className="flex items-center gap-2 pt-2 border-t border-eg/10">
            <CreatorAvatar
              name={project.creator_name ?? null}
              avatarUrl={project.creator_avatar_url ?? null}
              creatorId={project.created_by ?? null}
              size="xs"
            />
            <Link
              to={`/profile/${project.created_by}`}
              onClick={(e) => e.stopPropagation()}
              className="font-mono-custom text-[10px] text-white/40 hover:text-eg transition-colors tracking-wider truncate"
            >
              Created by {project.creator_name || 'Unknown'}
            </Link>
          </div>
        )}

        {/* Divider */}
        <div className={`h-px bg-gradient-to-r transition-all duration-500 ${
          hovered ? 'from-eg/50 via-eg/20 to-transparent' : 'from-eg/10 to-transparent'
        }`} />

        {/* CTA */}
        <div className="flex items-center justify-between pt-1">
          <span
            className={`btn-outline text-xs transition-all duration-300 ${
              hovered ? 'text-eg text-glow-sm' : 'text-eg/70'
            }`}
          >
            VIEW DETAILS
            <ArrowRight className="w-3.5 h-3.5" />
          </span>
          <span className="font-mono-custom text-[10px] text-white/30 tracking-widest uppercase group-hover:text-eg/60 transition-colors">
            /{project.slug}
          </span>
        </div>
      </div>
    </Link>
  );
};

/* ── Projects Section ────────────────────────────────────────────── */
const Projects: React.FC = () => {
  const { ref, vis } = useVisible(0.1);
  const { projects, loading, error } = useProjects();
  const [creatorFilter, setCreatorFilter] = useState('');
  const [creatorSearch, setCreatorSearch] = useState('');

  // Build unique creator list for filter dropdown
  const creators = useMemo(() => {
    const seen = new Map<string, string>();
    for (const p of projects) {
      if (p.created_by && p.creator_name && !seen.has(p.created_by)) {
        seen.set(p.created_by, p.creator_name);
      }
    }
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [projects]);

  // Filter projects by selected creator OR creator search text
  const filteredProjects = useMemo(() => {
    if (creatorFilter) {
      return projects.filter((p) => p.created_by === creatorFilter);
    }
    if (creatorSearch.trim()) {
      const q = creatorSearch.toLowerCase();
      return projects.filter((p) =>
        p.creator_name?.toLowerCase().includes(q) ||
        p.title.toLowerCase().includes(q)
      );
    }
    return projects;
  }, [projects, creatorFilter, creatorSearch]);

  const isFiltered = Boolean(creatorFilter || creatorSearch.trim());

  return (
    <section id="projects" ref={ref} className="py-20 md:py-28 bg-dark bg-circuit relative">
      {/* Top Gradient Border */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-eg/30 to-transparent" />

      <div className="max-w-7xl mx-auto px-6 relative z-10 space-y-10">
        {/* Section Header */}
        <div
          className={`flex items-center justify-between transition-all duration-700 ${
            vis ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          <div className="space-y-1">
            <div className="section-label">
              <span className="w-2 h-2 rounded-full bg-eg animate-pulse" />
              CURATED SHOWCASE
            </div>
            <h2 className="font-display text-2xl md:text-3xl font-bold tracking-widest text-white">
              FEATURED PROJECTS
            </h2>
          </div>
        </div>

        {/* Creator Filter Bar */}
        {!loading && !error && projects.length > 0 && (
          <div
            className={`flex flex-col sm:flex-row gap-3 transition-all duration-700 delay-100 ${
              vis ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
          >
            {/* Creator Search Input */}
            <div className="relative flex-1 max-w-sm">
              <svg
                className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-eg/50"
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
              >
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
              </svg>
              <input
                id="creator-search-input"
                type="text"
                value={creatorSearch}
                onChange={(e) => { setCreatorSearch(e.target.value); setCreatorFilter(''); }}
                placeholder="Search by creator..."
                className="w-full bg-dark-200/80 border border-eg/20 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-eg focus:ring-1 focus:ring-eg transition-all font-mono-custom"
              />
            </div>

            {/* Creator Filter Dropdown */}
            {creators.length > 1 && (
              <div className="relative">
                <select
                  id="creator-filter-select"
                  value={creatorFilter}
                  onChange={(e) => { setCreatorFilter(e.target.value); setCreatorSearch(''); }}
                  className="appearance-none bg-dark-200/80 border border-eg/20 rounded-xl pl-4 pr-9 py-2.5 text-xs text-white/80 focus:outline-none focus:border-eg focus:ring-1 focus:ring-eg transition-all font-mono-custom cursor-pointer min-w-[180px]"
                >
                  <option value="">ALL CREATORS</option>
                  {creators.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name.toUpperCase()}
                    </option>
                  ))}
                </select>
                <svg
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-eg/50 pointer-events-none"
                  viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                >
                  <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            )}

            {/* Clear Filter */}
            {isFiltered && (
              <button
                onClick={() => { setCreatorFilter(''); setCreatorSearch(''); }}
                className="font-mono-custom text-[10px] tracking-widest text-eg/70 hover:text-eg transition-colors px-3 py-2.5 rounded-xl border border-eg/20 hover:border-eg/50 bg-eg/5"
              >
                CLEAR ✕
              </button>
            )}
          </div>
        )}

        {/* Active creator filter label */}
        {creatorFilter && (
          <div className="flex items-center gap-2">
            <span className="font-mono-custom text-[10px] text-white/40 tracking-widest uppercase">FILTERING BY:</span>
            <Link
              to={`/profile/${creatorFilter}`}
              className="font-mono-custom text-[10px] tracking-widest text-eg px-2.5 py-1 rounded-full border border-eg/30 bg-eg/10 hover:bg-eg/20 transition-colors"
            >
              {creators.find((c) => c.id === creatorFilter)?.name || 'Creator'}
            </Link>
          </div>
        )}

        {/* Projects Grid / States */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <SkeletonCard key={i} delay={`${i * 150}ms`} />
            ))
          ) : error ? (
            <ErrorState message={error} />
          ) : filteredProjects.length === 0 ? (
            <EmptyState filtered={isFiltered} />
          ) : (
            filteredProjects.map((p, i) => (
              <ProjectCard key={p.id} project={p} index={i} vis={vis} />
            ))
          )}
        </div>

        {/* Footer Counter Badge */}
        {!loading && !error && filteredProjects.length > 0 && (
          <div
            className={`text-center pt-6 transition-all duration-700 delay-300 ${
              vis ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
            }`}
          >
            <p className="font-mono-custom text-xs text-white/30 tracking-widest mb-3 uppercase">
              SHOWING {filteredProjects.length}{isFiltered ? ` OF ${projects.length}` : ''} PUBLISHED PROJECT{filteredProjects.length !== 1 ? 'S' : ''}
            </p>
            <div className="flex items-center justify-center gap-3">
              <div className="w-16 h-px bg-eg/20" />
              <div className="w-2 h-2 rounded-full bg-eg animate-pulse" />
              <div className="w-16 h-px bg-eg/20" />
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default Projects;

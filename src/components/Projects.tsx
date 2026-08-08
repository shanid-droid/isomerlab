import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from './ui';
import { useProjects } from '../lib/hooks';
import type { Project } from '../lib/types';

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

/* ── Skeleton Card (Loading State) ──────────────────────────────── */
const SkeletonCard: React.FC<{ delay: string }> = ({ delay }) => (
  <div
    className="glass rounded-2xl overflow-hidden animate-pulse border border-eg/10 flex flex-col h-[420px]"
    style={{ animationDelay: delay }}
  >
    {/* Image Placeholder */}
    <div className="h-52 bg-dark-300/80 relative">
      <div className="absolute top-4 left-4 h-4 w-12 rounded bg-dark-400/80" />
    </div>
    {/* Content Placeholder */}
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
const EmptyState: React.FC = () => (
  <div className="col-span-full glass rounded-2xl py-16 px-6 border border-eg/20 flex flex-col items-center justify-center text-center gap-4">
    <div className="w-14 h-14 rounded-full border border-eg/30 bg-eg/10 flex items-center justify-center text-eg">
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M9 9h6M9 12h6M9 15h4" strokeLinecap="round" />
      </svg>
    </div>
    <div>
      <p className="font-display text-sm tracking-widest text-white uppercase mb-1">
        NO PUBLISHED PROJECTS YET
      </p>
      <p className="font-mono-custom text-xs text-eg/60 tracking-wider">
        Check back soon for new project architecture showcases.
      </p>
    </div>
  </div>
);

/* ── Single Project Card ─────────────────────────────────────────── */
const ProjectCard: React.FC<{ project: Project; index: number; vis: boolean }> = ({
  project, index, vis,
}) => {
  const [hovered, setHovered] = useState(false);

  // Index number display e.g. "01", "02"
  const num = String(index + 1).padStart(2, '0');

  // Parse components tags
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
          /* Fallback when no thumbnail is set */
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
      <div className="flex flex-col flex-1 p-6 space-y-4">
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
          <div className="flex flex-wrap gap-1.5 pt-2">
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

        {/* Divider */}
        <div className={`pt-2 h-px bg-gradient-to-r transition-all duration-500 ${
          hovered ? 'from-eg/50 via-eg/20 to-transparent' : 'from-eg/10 to-transparent'
        }`} />

        {/* CTA Link Action */}
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

  return (
    <section id="projects" ref={ref} className="py-20 md:py-28 bg-dark bg-circuit relative">
      {/* Top Gradient Border */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-eg/30 to-transparent" />

      <div className="max-w-7xl mx-auto px-6 relative z-10 space-y-12">
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

        {/* Projects Grid / States */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <SkeletonCard key={i} delay={`${i * 150}ms`} />
            ))
          ) : error ? (
            <ErrorState message={error} />
          ) : projects.length === 0 ? (
            <EmptyState />
          ) : (
            projects.map((p, i) => (
              <ProjectCard key={p.id} project={p} index={i} vis={vis} />
            ))
          )}
        </div>

        {/* Footer Counter Badge */}
        {!loading && !error && projects.length > 0 && (
          <div
            className={`text-center pt-6 transition-all duration-700 delay-300 ${
              vis ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
            }`}
          >
            <p className="font-mono-custom text-xs text-white/30 tracking-widest mb-3 uppercase">
              SHOWING {projects.length} PUBLISHED PROJECT{projects.length !== 1 ? 'S' : ''}
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

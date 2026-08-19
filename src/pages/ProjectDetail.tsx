import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { useProjectBySlug, useProjects } from '../lib/hooks';
import { useProjectVersions } from '../lib/projectVersionHooks';
import { useRecordProjectView } from '../lib/leaderboardHooks';
import { supabase } from '../lib/supabase';
import { IsomerLogo, ArrowRight } from '../components/ui';
import type { UserProfile, ProjectVersion, ProjectLink } from '../lib/types';
import { LikeButton } from '../components/LikeButton';
import { ProjectCommentsSection } from '../components/ProjectCommentsSection';
import { ProjectLinksDisplay } from '../components/ProjectLinks';
import { ProjectGallery, IsomerVideoPlayer } from '../components/ProjectGallery';

/* ── Skeleton Loading State ──────────────────────────────────────── */
const Skeleton: React.FC = () => (
  <div className="animate-pulse space-y-10 max-w-5xl mx-auto py-12">
    <div className="space-y-4">
      <div className="h-4 w-32 rounded bg-dark-300" />
      <div className="h-14 w-3/4 rounded-xl bg-dark-300" />
      <div className="h-4 w-1/2 rounded bg-dark-300" />
      <div className="flex gap-4 pt-4">
        <div className="h-8 w-28 rounded-lg bg-dark-300" />
        <div className="h-8 w-28 rounded-lg bg-dark-300" />
      </div>
    </div>
    <div className="h-[360px] sm:h-[480px] rounded-2xl bg-dark-300/80 border border-white/5" />
    <div className="glass-dark rounded-2xl p-8 space-y-4">
      <div className="h-5 w-48 rounded bg-dark-300" />
      <div className="h-4 w-full rounded bg-dark-300/60" />
      <div className="h-4 w-5/6 rounded bg-dark-300/60" />
      <div className="h-4 w-4/6 rounded bg-dark-300/60" />
    </div>
  </div>
);

/* ── Not Found State ─────────────────────────────────────────────── */
const NotFound: React.FC = () => (
  <div className="flex flex-col items-center justify-center min-h-[65vh] text-center gap-6 px-4">
    <div className="w-20 h-20 rounded-2xl border border-eg/30 bg-eg/5 flex items-center justify-center relative shadow-lg shadow-eg/5">
      <span className="font-display text-eg text-2xl font-bold text-glow-sm">404</span>
    </div>
    <div className="max-w-md space-y-2">
      <h1 className="font-display text-2xl tracking-widest text-white uppercase">
        SPECIFICATION NOT FOUND
      </h1>
      <p className="font-sans text-sm text-white/40 leading-relaxed">
        The requested system architecture does not exist in the laboratory archive.
      </p>
    </div>
    <Link to="/" className="btn-primary mt-4 flex items-center gap-2">
      <ArrowRight className="w-4 h-4 rotate-180" />
      BACK TO ALL PROJECTS
    </Link>
  </div>
);

/* ── Creator Rich Spotlight Card ─────────────────────────────────── */
const CreatorSpotlight: React.FC<{ creatorId: string }> = ({ creatorId }) => {
  const [creator, setCreator] = useState<Partial<UserProfile> | null>(null);
  const [projectCount, setProjectCount] = useState<number>(1);

  useEffect(() => {
    let cancelled = false;
    async function loadCreator() {
      // Fetch public profile
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, role, bio')
        .eq('id', creatorId)
        .maybeSingle();

      if (!cancelled && data) {
        setCreator(data);
      }

      // Count creator projects
      const { count } = await supabase
        .from('projects')
        .select('id', { count: 'exact', head: true })
        .eq('created_by', creatorId)
        .eq('published', true);

      if (!cancelled && count !== null) {
        setProjectCount(count);
      }
    }
    loadCreator();
    return () => { cancelled = true; };
  }, [creatorId]);

  if (!creator) return null;

  const initials = creator.full_name
    ? creator.full_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'CR';

  const roleLabel = creator.role === 'admin' || creator.role === 'owner'
    ? 'CORE TEAM'
    : creator.role === 'creator'
    ? 'VERIFIED CREATOR'
    : 'MEMBER';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-eg animate-pulse" />
        <h3 className="font-mono-custom text-xs tracking-[0.2em] text-white/50 uppercase">
          BUILT BY
        </h3>
      </div>

      <Link
        to={`/profile/${creatorId}`}
        id="project-creator-profile-card"
        className="group glass-dark rounded-2xl p-6 sm:p-8 border border-white/10 hover:border-eg/50 transition-all duration-300 hover:shadow-xl hover:shadow-eg/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 relative overflow-hidden"
      >
        <div className="flex items-center gap-4 sm:gap-5">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            {creator.avatar_url ? (
              <img
                src={creator.avatar_url}
                alt={creator.full_name || 'Creator'}
                className="w-16 h-16 rounded-2xl object-cover border-2 border-eg/40 group-hover:border-eg transition-colors shadow-lg"
              />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-dark-300 border-2 border-eg/40 flex items-center justify-center group-hover:border-eg transition-colors shadow-lg">
                <span className="font-display text-lg font-bold text-eg">{initials}</span>
              </div>
            )}
            <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-eg border-2 border-dark" />
          </div>

          {/* Info */}
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h4 className="font-display text-lg sm:text-xl font-bold text-white group-hover:text-eg transition-colors tracking-wide">
                {creator.full_name || 'Anonymous Creator'}
              </h4>
              <span className="font-mono-custom text-[9px] px-2 py-0.5 rounded-md border border-eg/30 bg-eg/10 text-eg font-semibold uppercase tracking-wider">
                {roleLabel}
              </span>
            </div>
            {creator.bio ? (
              <p className="font-sans text-xs text-white/50 leading-relaxed line-clamp-2 max-w-lg">
                {creator.bio}
              </p>
            ) : (
              <p className="font-mono-custom text-[11px] text-white/40">
                ISOMER Laboratory Contributor
              </p>
            )}
            <p className="font-mono-custom text-[10px] text-eg/70 tracking-wider pt-0.5">
              {projectCount} {projectCount === 1 ? 'PUBLISHED ARCHITECTURE' : 'PUBLISHED ARCHITECTURES'}
            </p>
          </div>
        </div>

        {/* View Profile Action */}
        <div className="inline-flex items-center gap-2 font-mono-custom text-xs text-eg font-semibold group-hover:translate-x-1 transition-transform self-end sm:self-center flex-shrink-0">
          <span>CREATOR DOSSIER</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </div>
      </Link>
    </div>
  );
};

/* ── Related Projects Section ────────────────────────────────────── */
const RelatedProjects: React.FC<{ currentProjectId: string }> = ({ currentProjectId }) => {
  const { projects } = useProjects();

  const related = useMemo(() => {
    return projects.filter((p) => p.id !== currentProjectId).slice(0, 3);
  }, [projects, currentProjectId]);

  if (related.length === 0) return null;

  return (
    <section className="space-y-6 pt-12 border-t border-white/5">
      <div className="flex items-center justify-between">
        <div>
          <span className="font-mono-custom text-[10px] tracking-[0.25em] text-eg uppercase block mb-1">
            LABORATORY ARCHIVE
          </span>
          <h3 className="font-display text-2xl font-bold text-white tracking-wide">
            MORE FROM ISOMER
          </h3>
        </div>
        <Link
          to="/#projects"
          className="font-mono-custom text-xs text-white/50 hover:text-eg transition-colors flex items-center gap-1"
        >
          <span>VIEW ALL</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {related.map((p) => (
          <Link
            key={p.id}
            to={`/projects/${p.slug}`}
            className="group glass-dark rounded-2xl overflow-hidden border border-white/10 hover:border-eg/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-eg/10 flex flex-col justify-between"
          >
            <div className="relative h-40 bg-dark-300 overflow-hidden">
              {p.thumbnail_url ? (
                <img
                  src={p.thumbnail_url}
                  alt={p.title}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-circuit">
                  <span className="font-display text-3xl font-bold text-eg/20">ISOMER</span>
                </div>
              )}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{ background: 'linear-gradient(to top, rgba(8,12,10,0.85) 0%, transparent 60%)' }}
              />
            </div>
            <div className="p-5 space-y-2 flex-1 flex flex-col justify-between">
              <div>
                <h4 className="font-display text-base font-bold text-white group-hover:text-eg transition-colors line-clamp-1">
                  {p.title}
                </h4>
                <p className="font-sans text-xs text-white/50 line-clamp-2 mt-1">
                  {p.description}
                </p>
              </div>
              <div className="pt-3 border-t border-white/5 flex items-center justify-between font-mono-custom text-[10px]">
                <span className="text-white/40">{p.creator_name || 'Anonymous'}</span>
                <span className="text-eg font-semibold flex items-center gap-0.5">
                  SPECS →
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
};

/* ── Main ProjectDetail Component ─────────────────────────────────── */
const ProjectDetail: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const { project, gallery, loading, error } = useProjectBySlug(slug);
  const [searchParams, setSearchParams] = useSearchParams();
  const { versions: projectVersions } = useProjectVersions(project?.id);
  useRecordProjectView(project?.id);

  const [scrollProgress, setScrollProgress] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Scroll Progress Tracker
  useEffect(() => {
    const handleScroll = () => {
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (totalHeight <= 0) return;
      const current = window.scrollY;
      setScrollProgress(Math.min(100, Math.max(0, (current / totalHeight) * 100)));
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Version resolution logic
  const versionIdFromUrl = searchParams.get('version');
  const activeVersion: ProjectVersion | undefined = useMemo(() => {
    if (!projectVersions || projectVersions.length === 0) return undefined;
    if (versionIdFromUrl) {
      const found = projectVersions.find((v) => v.id === versionIdFromUrl);
      if (found) return found;
    }
    const defaultVer = projectVersions.find((v) => v.is_default);
    if (defaultVer) return defaultVer;
    return projectVersions[0];
  }, [projectVersions, versionIdFromUrl]);

  const handleVersionChange = (versionId: string) => {
    if (versionId === activeVersion?.id) return;
    setIsTransitioning(true);
    setTimeout(() => {
      if (versionId) {
        setSearchParams({ version: versionId }, { replace: true });
      } else {
        setSearchParams({}, { replace: true });
      }
      setIsTransitioning(false);
    }, 250);
  };

  // Parse components/technologies
  const componentsList = useMemo(() => {
    const raw = project?.components;
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') {
      return raw.split(',').map((c) => c.trim()).filter(Boolean);
    }
    return [];
  }, [project?.components]);

  // Version-specific content fallbacks
  const versionDescription = activeVersion?.description ?? project?.description ?? '';
  const versionLinks = (activeVersion?.project_links && activeVersion.project_links.length > 0)
    ? activeVersion.project_links
    : (project?.project_links ?? []);
  const versionThumbnail = activeVersion?.thumbnail_url ?? project?.thumbnail_url ?? null;
  const versionVideoUrl = activeVersion?.video_url ?? null;

  // Format date helper
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return null;
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return null;
    }
  };

  // Split description into paragraphs for editorial formatting
  const paragraphs = useMemo(() => {
    if (!versionDescription) return [];
    return versionDescription.split('\n\n').map((p) => p.trim()).filter(Boolean);
  }, [versionDescription]);

  // Split What's New into changelog points
  const whatsNewItems = useMemo(() => {
    if (!activeVersion?.whats_new) return [];
    return activeVersion.whats_new
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.replace(/^[+•\-*]\s*/, ''));
  }, [activeVersion?.whats_new]);

  return (
    <div className="min-h-screen bg-dark bg-circuit text-white flex flex-col selection:bg-eg/30">
      {/* ── 1. Subtle Scroll Progress Bar ── */}
      <div
        className="fixed top-0 left-0 h-[2px] bg-eg z-50 transition-all duration-75 ease-out shadow-[0_0_8px_#00ff88]"
        style={{ width: `${scrollProgress}%` }}
      />

      {/* ── 2. Sticky Minimal Navigation Header ── */}
      <header className="glass-dark border-b border-white/5 py-4 sticky top-0 z-40 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <Link to="/" className="focus:outline-none">
            <IsomerLogo size="md" />
          </Link>
          <div className="flex items-center gap-4">
            <Link
              to="/#projects"
              id="back-to-projects-nav-btn"
              className="inline-flex items-center gap-2 font-mono-custom text-xs text-white/70 hover:text-eg transition-colors px-3 py-1.5 rounded-xl border border-white/10 hover:border-eg/40 bg-dark-200/40"
            >
              <ArrowRight className="w-3.5 h-3.5 rotate-180 text-eg" />
              <span>CATALOGUE</span>
            </Link>
          </div>
        </div>
      </header>

      {/* ── 3. Main Project Container ── */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-10 sm:py-16 space-y-16 sm:space-y-24">
        {loading ? (
          <Skeleton />
        ) : error || !project ? (
          <NotFound />
        ) : (
          <article className={`space-y-16 sm:space-y-20 transition-opacity duration-300 ${isTransitioning ? 'opacity-30' : 'opacity-100'}`}>
            {/* ── 4. Project Identity (Hero) ── */}
            <div className="space-y-6">
              {/* Top Tag & Status */}
              <div className="flex items-center justify-between flex-wrap gap-4 border-b border-white/5 pb-4">
                <div className="flex items-center gap-2.5 font-mono-custom text-xs tracking-[0.25em] text-eg uppercase">
                  <span className="w-1.5 h-1.5 rounded-full bg-eg animate-pulse" />
                  <span>PROJECT SPECIFICATION</span>
                </div>
                <span className="font-mono-custom text-[10px] text-white/40 tracking-widest uppercase">
                  ID: /{project.slug}
                </span>
              </div>

              {/* Title (Large Responsive Futuristic Display) */}
              <h1 className="font-display font-black text-4xl sm:text-6xl md:text-7xl tracking-tight leading-[1.08] text-white">
                {project.title}
              </h1>

              {/* Teaser Introduction (First Paragraph) */}
              {paragraphs.length > 0 && (
                <p className="font-sans text-base sm:text-xl text-white/70 font-light leading-relaxed max-w-3xl pt-1">
                  {paragraphs[0]}
                </p>
              )}

              {/* Compact Technical Metadata Bar */}
              <div className="flex flex-wrap items-center gap-6 sm:gap-10 pt-4 font-mono-custom text-xs text-white/60 border-t border-white/5">
                <div>
                  <span className="text-[10px] text-white/30 tracking-widest uppercase block">CREATOR</span>
                  <span className="text-white font-medium">{(project as any).creator_name || 'Creator'}</span>
                </div>

                {project.created_at && (
                  <div>
                    <span className="text-[10px] text-white/30 tracking-widest uppercase block">UPLOADED</span>
                    <span className="text-white">{formatDate(project.created_at)}</span>
                  </div>
                )}

                {activeVersion && (
                  <div>
                    <span className="text-[10px] text-white/30 tracking-widest uppercase block">ACTIVE VERSION</span>
                    <span className="text-eg font-semibold">
                      v{activeVersion.version_number}
                    </span>
                  </div>
                )}

                <div>
                  <span className="text-[10px] text-white/30 tracking-widest uppercase block">INTERACTIONS</span>
                  <div className="flex items-center gap-3 pt-0.5">
                    <LikeButton projectId={project.id} />
                  </div>
                </div>
              </div>
            </div>

            {/* ── 5. Version Selector Bar (If multiple versions exist) ── */}
            {projectVersions.length > 1 && (
              <div className="glass-dark rounded-2xl p-4 sm:p-5 border border-eg/20 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono-custom text-[10px] tracking-[0.25em] text-white/50 uppercase flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-eg" />
                    VERSION ARCHIVE
                  </span>
                  <span className="font-mono-custom text-[10px] text-eg/80 tracking-wider">
                    {projectVersions.length} VERSIONS RECORDED
                  </span>
                </div>

                <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
                  {projectVersions.map((v) => {
                    const isSelected = activeVersion?.id === v.id;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => handleVersionChange(v.id)}
                        className={`px-4 py-2.5 rounded-xl font-mono-custom text-xs transition-all flex items-center gap-2.5 flex-shrink-0 cursor-pointer ${
                          isSelected
                            ? 'bg-eg/20 border border-eg text-white shadow-lg shadow-eg/10 font-bold'
                            : 'bg-dark-200/60 border border-white/10 text-white/50 hover:border-eg/40 hover:text-white'
                        }`}
                      >
                        <span className={`text-[10px] ${isSelected ? 'text-eg' : 'text-white/40'}`}>
                          v{v.version_number}
                        </span>
                        <span className="tracking-wide uppercase text-[11px]">
                          {v.version_name}
                        </span>
                        {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-eg animate-pulse" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── 6. Main Project Experience (Centerpiece Video / Media) ── */}
            <div className="relative rounded-2xl overflow-hidden border border-eg/25 glass-dark shadow-2xl bg-black group">
              {/* Corner Cyberpunk Accents */}
              <div className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-eg/60 pointer-events-none z-20" />
              <div className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-eg/60 pointer-events-none z-20" />
              <div className="absolute bottom-3 left-3 w-4 h-4 border-b-2 border-l-2 border-eg/60 pointer-events-none z-20" />
              <div className="absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 border-eg/60 pointer-events-none z-20" />

              {versionVideoUrl ? (
                /* Active Version Video Player */
                <div className="w-full aspect-video min-h-[320px] sm:min-h-[460px] md:min-h-[520px] bg-black">
                  <IsomerVideoPlayer
                    key={versionVideoUrl}
                    src={versionVideoUrl}
                    expand
                  />
                </div>
              ) : versionThumbnail ? (
                /* High-Res Hero Thumbnail */
                <div className="w-full h-[340px] sm:h-[460px] md:h-[540px] relative overflow-hidden bg-dark-300">
                  <img
                    src={versionThumbnail}
                    alt={project.title}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background: 'linear-gradient(to top, rgba(8,12,10,0.85) 0%, transparent 60%)',
                    }}
                  />
                  <div className="scan-line pointer-events-none" />
                  <div className="absolute top-6 left-6 z-10">
                    <span className="font-mono-custom text-[10px] text-eg font-bold bg-dark-100/90 border border-eg/40 px-3 py-1 rounded-lg backdrop-blur-md">
                      SPECIFICATION OVERVIEW
                    </span>
                  </div>
                </div>
              ) : (
                /* Abstract Brand Placeholder */
                <div className="w-full h-[320px] sm:h-[420px] flex flex-col items-center justify-center bg-circuit p-8 text-center">
                  <span className="font-display text-7xl font-bold text-eg/15">ISOMER</span>
                  <span className="font-mono-custom text-xs text-eg/50 tracking-widest uppercase mt-3">
                    SYSTEM ARCHITECTURE ARCHIVE
                  </span>
                </div>
              )}
            </div>

            {/* ── 7. What's New In This Version (Changelog) ── */}
            {whatsNewItems.length > 0 && (
              <section className="glass-dark rounded-2xl p-6 sm:p-8 border border-eg/30 space-y-4 relative overflow-hidden">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-eg" />
                  <h3 className="font-mono-custom text-xs tracking-[0.2em] text-eg uppercase font-bold">
                    WHAT'S NEW IN v{activeVersion?.version_number} — {activeVersion?.version_name}
                  </h3>
                </div>

                <ul className="space-y-2.5 pt-2">
                  {whatsNewItems.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-3 text-sm text-white/80 font-sans">
                      <span className="text-eg font-mono-custom font-bold text-base leading-none select-none">+</span>
                      <span className="leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* ── 8. Project Story / Editorial Overview ── */}
            {paragraphs.length > 1 && (
              <section className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-eg" />
                  <h3 className="font-mono-custom text-xs tracking-[0.2em] text-white/50 uppercase">
                    ABOUT THE SYSTEM
                  </h3>
                </div>

                <div className="space-y-4 max-w-3xl font-sans text-sm sm:text-base text-white/80 leading-relaxed">
                  {paragraphs.slice(1).map((p, idx) => (
                    <p key={idx}>{p}</p>
                  ))}
                </div>
              </section>
            )}

            {/* ── 9. Technologies & Components ── */}
            {componentsList.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-eg" />
                  <h3 className="font-mono-custom text-xs tracking-[0.2em] text-white/50 uppercase">
                    TECHNOLOGY STACK & SUBSYSTEMS
                  </h3>
                </div>

                <div className="flex flex-wrap gap-2 sm:gap-3">
                  {componentsList.map((comp, idx) => (
                    <div
                      key={idx}
                      className="px-4 py-2 rounded-xl border border-white/10 glass-dark text-xs font-mono-custom text-white/90 tracking-wider flex items-center gap-2 hover:border-eg/50 hover:text-eg transition-all"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-eg" />
                      <span>{comp}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ── 10. Project Links & Resources ── */}
            {versionLinks && versionLinks.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-eg" />
                  <h3 className="font-mono-custom text-xs tracking-[0.2em] text-white/50 uppercase">
                    PROJECT RESOURCES & REPOSITORIES
                  </h3>
                </div>

                <ProjectLinksDisplay
                  links={versionLinks as ProjectLink[]}
                  fallbackGithubUrl={project.github_url}
                  variant="hero"
                />
              </section>
            )}

            {/* ── 11. Project Gallery (Images & Videos with Lightbox) ── */}
            <section>
              <ProjectGallery gallery={gallery} activeVersion={activeVersion} />
            </section>

            {/* ── 12. Creator Spotlight Card ── */}
            {project.created_by && (
              <section>
                <CreatorSpotlight creatorId={project.created_by} />
              </section>
            )}

            {/* ── 13. Discussion & Comments ── */}
            <section className="pt-4 border-t border-white/5">
              <ProjectCommentsSection
                projectId={project.id}
                projectOwnerId={project.created_by}
              />
            </section>

            {/* ── 14. Related Projects ── */}
            <RelatedProjects currentProjectId={project.id} />
          </article>
        )}
      </main>

      {/* ── 15. Minimal Technical Footer ── */}
      <footer className="border-t border-white/5 py-8 mt-auto bg-dark">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="font-display font-bold text-sm tracking-widest text-white">
              ISOM<span className="text-eg">≡</span>R
            </span>
            <span className="font-mono-custom text-[10px] text-white/30 tracking-widest uppercase">
              FOCUS · CREATE · ELEVATE
            </span>
          </div>
          <p className="font-mono-custom text-[10px] tracking-wider text-white/20">
            © 2026 ISOMER LAB. All specifications verified.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default ProjectDetail;

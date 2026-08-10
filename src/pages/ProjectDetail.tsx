import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useProjectBySlug } from '../lib/hooks';
import { supabase } from '../lib/supabase';
import { IsomerLogo, ArrowRight } from '../components/ui';
import type { UserProfile } from '../lib/types';

/* ── GitHub Icon Component ───────────────────────────────────────── */
const GithubIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
  </svg>
);

/* ── Lightbox Modal ──────────────────────────────────────────────── */
const LightboxModal: React.FC<{
  images: string[];
  currentIndex: number;
  onClose: () => void;
  onSelectIndex: (idx: number) => void;
}> = ({ images, currentIndex, onClose, onSelectIndex }) => {
  const total = images.length;
  const currentUrl = images[currentIndex];

  const handlePrev = useCallback(() => {
    onSelectIndex((currentIndex - 1 + total) % total);
  }, [currentIndex, total, onSelectIndex]);

  const handleNext = useCallback(() => {
    onSelectIndex((currentIndex + 1) % total);
  }, [currentIndex, total, onSelectIndex]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && total > 1) handlePrev();
      if (e.key === 'ArrowRight' && total > 1) handleNext();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, handlePrev, handleNext, total]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 select-none animate-fade-in"
      onClick={onClose}
    >
      <div className="relative max-w-6xl w-full flex flex-col items-center gap-4" onClick={(e) => e.stopPropagation()}>
        <div className="w-full flex items-center justify-between px-2 text-white/70">
          <div className="font-mono-custom text-xs tracking-widest text-eg/90 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-eg animate-pulse" />
            IMAGE {currentIndex + 1} OF {total}
          </div>
          <button
            onClick={onClose}
            className="font-mono-custom text-xs text-white/60 hover:text-eg tracking-widest transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded border border-white/10 glass"
          >
            CLOSE [ESC ✕]
          </button>
        </div>

        <div className="relative border border-eg/30 rounded-2xl overflow-hidden glass p-2 max-h-[75vh] w-full flex items-center justify-center shadow-2xl group">
          <img
            src={currentUrl}
            alt={`Gallery view ${currentIndex + 1}`}
            className="max-h-[72vh] max-w-full object-contain rounded-xl transition-all duration-300"
          />
          <div className="absolute top-4 left-4 w-5 h-5 border-t-2 border-l-2 border-eg/70" />
          <div className="absolute top-4 right-4 w-5 h-5 border-t-2 border-r-2 border-eg/70" />
          <div className="absolute bottom-4 left-4 w-5 h-5 border-b-2 border-l-2 border-eg/70" />
          <div className="absolute bottom-4 right-4 w-5 h-5 border-b-2 border-r-2 border-eg/70" />

          {total > 1 && (
            <button
              onClick={handlePrev}
              aria-label="Previous image"
              className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full glass border border-eg/40 text-eg flex items-center justify-center hover:bg-eg/20 hover:scale-110 transition-all"
            >←</button>
          )}
          {total > 1 && (
            <button
              onClick={handleNext}
              aria-label="Next image"
              className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full glass border border-eg/40 text-eg flex items-center justify-center hover:bg-eg/20 hover:scale-110 transition-all"
            >→</button>
          )}
        </div>

        {total > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto max-w-full p-2">
            {images.map((url, idx) => (
              <button
                key={idx}
                onClick={() => onSelectIndex(idx)}
                className={`w-14 h-10 rounded-lg overflow-hidden border transition-all flex-shrink-0 ${
                  idx === currentIndex ? 'border-eg ring-2 ring-eg/50 scale-105' : 'border-white/20 opacity-50 hover:opacity-100'
                }`}
              >
                <img src={url} alt={`Thumb ${idx + 1}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

/* ── Skeleton Loading State ──────────────────────────────────────── */
const Skeleton: React.FC = () => (
  <div className="animate-pulse space-y-8 max-w-5xl mx-auto">
    <div className="h-6 w-48 rounded bg-dark-400/60" />
    <div className="h-[360px] sm:h-[450px] rounded-2xl bg-dark-300/60" />
    <div className="space-y-4">
      <div className="h-10 w-3/4 rounded bg-dark-400/80" />
      <div className="flex gap-2">
        <div className="h-7 w-24 rounded-md bg-dark-400/60" />
        <div className="h-7 w-28 rounded-md bg-dark-400/60" />
      </div>
    </div>
    <div className="glass rounded-xl p-8 space-y-4">
      <div className="h-4 w-full rounded bg-dark-400/60" />
      <div className="h-4 w-5/6 rounded bg-dark-400/60" />
      <div className="h-4 w-4/6 rounded bg-dark-400/60" />
    </div>
  </div>
);

/* ── Not Found State ─────────────────────────────────────────────── */
const NotFound: React.FC = () => (
  <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-6 px-4">
    <div className="w-20 h-20 rounded-full border border-eg/30 bg-eg/5 flex items-center justify-center relative">
      <span className="font-display text-eg text-2xl font-bold text-glow-sm">404</span>
      <div className="absolute inset-0 rounded-full border border-eg/20 animate-ping opacity-25" />
    </div>
    <div className="max-w-md">
      <h1 className="font-display text-xl md:text-2xl tracking-widest text-white mb-3 uppercase">
        PROJECT NOT FOUND
      </h1>
      <p className="font-sans text-xs md:text-sm text-white/40 leading-relaxed">
        The requested project does not exist or has not been published yet.
      </p>
    </div>
    <Link to="/" className="btn-primary mt-2 flex items-center gap-2">
      <ArrowRight className="w-4 h-4 rotate-180" />
      BACK TO PROJECTS
    </Link>
  </div>
);

/* ── Creator Profile Chip ────────────────────────────────────────── */
const CreatorChip: React.FC<{ creatorId: string }> = ({ creatorId }) => {
  const [creator, setCreator] = useState<Partial<UserProfile> | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .eq('id', creatorId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setCreator(data);
      });
    return () => { cancelled = true; };
  }, [creatorId]);

  if (!creator) return null;

  const initials = creator.full_name
    ? creator.full_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  return (
    <Link
      to={`/profile/${creatorId}`}
      id="project-creator-link"
      className="inline-flex items-center gap-3 glass rounded-2xl px-5 py-3 border border-eg/20 hover:border-eg/50 transition-all duration-300 group"
    >
      {creator.avatar_url ? (
        <img
          src={creator.avatar_url}
          alt={creator.full_name || 'Creator'}
          className="w-10 h-10 rounded-full object-cover border-2 border-eg/40"
        />
      ) : (
        <div className="w-10 h-10 rounded-full bg-dark-300 border-2 border-eg/40 flex items-center justify-center">
          <span className="font-display text-sm font-bold text-eg">{initials}</span>
        </div>
      )}
      <div>
        <p className="font-mono-custom text-[10px] tracking-widest text-white/40 uppercase">CREATED BY</p>
        <p className="font-display text-sm font-semibold text-white group-hover:text-eg transition-colors">
          {creator.full_name || 'ISOMER Member'}
        </p>
      </div>
      <ArrowRight className="w-3.5 h-3.5 text-eg/40 group-hover:text-eg ml-auto transition-colors" />
    </Link>
  );
};

/* ── Project Detail Page ─────────────────────────────────────────── */
const ProjectDetail: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const { project, gallery, loading, error } = useProjectBySlug(slug);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);

  const parseComponents = (compData: string[] | string | null | undefined): string[] => {
    if (!compData) return [];
    if (Array.isArray(compData)) return compData;
    if (typeof compData === 'string') {
      return compData.split(',').map((c) => c.trim()).filter(Boolean);
    }
    return [];
  };

  const componentsList = parseComponents(project?.components);
  const galleryUrls = gallery.map((item) => item.image_url);

  const descriptionText = project?.description || '';
  const firstParagraphEnd = descriptionText.indexOf('\n\n');
  const shortIntro = firstParagraphEnd !== -1 ? descriptionText.substring(0, firstParagraphEnd) : null;
  const mainDescription = firstParagraphEnd !== -1 ? descriptionText.substring(firstParagraphEnd).trim() : descriptionText;

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return null;
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
      });
    } catch { return null; }
  };

  return (
    <div className="min-h-screen bg-dark bg-circuit text-white flex flex-col selection:bg-eg/30">
      {/* ── Sticky Header ──────────────────────────────────────────── */}
      <header className="glass-dark border-b border-eg/10 py-4 sticky top-0 z-40 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <Link to="/" className="focus:outline-none">
            <IsomerLogo size="md" />
          </Link>
          <Link
            to="/#projects"
            id="back-to-projects-nav-btn"
            className="btn-outline text-[11px] flex items-center gap-2"
          >
            <ArrowRight className="w-3.5 h-3.5 rotate-180 text-eg" />
            BACK TO PROJECTS
          </Link>
        </div>
      </header>

      {/* ── Main Content ───────────────────────────────────────────── */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-8 md:py-12">
        {loading ? (
          <Skeleton />
        ) : error || !project ? (
          <NotFound />
        ) : (
          <article className="space-y-10 animate-fade-in-up">
            {/* 1. Breadcrumb */}
            <div className="flex items-center justify-between gap-4 flex-wrap pb-2 border-b border-eg/10">
              <nav className="flex items-center gap-2 font-mono-custom text-[11px] tracking-widest text-white/40 uppercase">
                <Link to="/" className="hover:text-eg transition-colors duration-200">HOME</Link>
                <span className="text-eg/40">/</span>
                <Link to="/#projects" className="hover:text-eg transition-colors duration-200">PROJECTS</Link>
                <span className="text-eg/40">/</span>
                <span className="text-eg tracking-wider font-semibold truncate max-w-[180px] sm:max-w-xs">{project.title}</span>
              </nav>
              <Link
                to="/#projects"
                id="back-to-projects-top-btn"
                className="font-mono-custom text-xs text-white/50 hover:text-eg transition-colors flex items-center gap-1.5"
              >
                ← Back to Catalog
              </Link>
            </div>

            {/* 2. Hero Thumbnail */}
            <div className="relative rounded-2xl overflow-hidden border border-eg/30 glass shadow-2xl bg-dark-300 group">
              {project.thumbnail_url ? (
                <div className="w-full h-[320px] sm:h-[420px] md:h-[500px] overflow-hidden relative">
                  <img
                    src={project.thumbnail_url}
                    alt={project.title}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="scan-line pointer-events-none" />
                </div>
              ) : (
                <div className="w-full h-[280px] sm:h-[380px] flex flex-col items-center justify-center bg-circuit relative p-6">
                  <div className="w-20 h-20 rounded-full border border-eg/40 bg-eg/10 flex items-center justify-center mb-4 shadow-eg-sm">
                    <span className="font-display text-eg text-2xl font-bold tracking-widest">ISO</span>
                  </div>
                  <p className="font-display text-xl tracking-widest text-white/90 text-center uppercase">
                    {project.title}
                  </p>
                  <p className="font-mono-custom text-xs text-eg/60 tracking-widest mt-2">
                    PROJECT ARCHITECTURE & SPECIFICATIONS
                  </p>
                </div>
              )}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{ background: 'linear-gradient(to bottom, transparent 40%, rgba(8,12,10,0.9) 100%)' }}
              />
              <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-eg/70" />
              <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-eg/70" />
              <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-eg/70" />
              <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-eg/70" />
              <div className="absolute top-6 left-6 flex items-center gap-2 bg-dark-100/90 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-eg/40 shadow-lg">
                <span className="w-2 h-2 rounded-full bg-eg animate-pulse" />
                <span className="font-mono-custom text-[10px] tracking-widest text-eg uppercase font-semibold">
                  PUBLISHED PROJECT
                </span>
              </div>
            </div>

            {/* 3. Title & GitHub */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-eg/15">
              <div className="space-y-3 max-w-2xl">
                <div className="flex items-center gap-2">
                  <span className="w-8 h-px bg-eg" />
                  <span className="font-mono-custom text-xs tracking-widest text-eg uppercase font-semibold">
                    PROJECT SPECIFICATION
                  </span>
                </div>
                <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold tracking-wider text-white leading-tight text-glow-sm">
                  {project.title}
                </h1>
              </div>

              {project.github_url ? (
                <a
                  href={project.github_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  id="project-github-btn"
                  className="btn-primary inline-flex items-center gap-2.5 self-start md:self-auto px-6 py-3 text-xs tracking-widest hover:scale-105 transition-transform"
                >
                  <GithubIcon className="w-4 h-4 text-dark" />
                  VIEW ON GITHUB
                  <ArrowRight className="w-3.5 h-3.5" />
                </a>
              ) : (
                <div className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl border border-white/10 bg-dark-200/60 text-white/40 text-xs font-mono-custom tracking-wider">
                  <GithubIcon className="w-4 h-4 opacity-40" />
                  PRIVATE REPOSITORY
                </div>
              )}
            </div>

            {/* 4. Creator + Date Row */}
            {project.created_by && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <CreatorChip creatorId={project.created_by} />
                {project.created_at && (
                  <div className="flex items-center gap-2 glass rounded-2xl px-5 py-3 border border-white/10">
                    <svg className="w-4 h-4 text-eg/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    <div>
                      <p className="font-mono-custom text-[10px] tracking-widest text-white/40 uppercase">UPLOADED</p>
                      <p className="font-display text-sm font-semibold text-white">{formatDate(project.created_at)}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 5. Short Intro Callout */}
            {shortIntro && (
              <div className="glass rounded-2xl p-6 border-l-4 border-l-eg border-eg/20 bg-eg/5 relative overflow-hidden">
                <p className="font-sans text-base sm:text-lg text-white/90 leading-relaxed italic font-light">
                  "{shortIntro}"
                </p>
              </div>
            )}

            {/* 6. Technologies */}
            {componentsList.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-mono-custom text-xs tracking-widest text-white/50 uppercase flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-eg" />
                  TECHNOLOGIES & COMPONENTS USED
                </h3>
                <div className="flex flex-wrap gap-2 sm:gap-3">
                  {componentsList.map((component, idx) => (
                    <div
                      key={idx}
                      className="px-4 py-2 rounded-xl border border-eg/20 glass text-xs font-mono-custom text-white/90 tracking-wider flex items-center gap-2 hover:border-eg/60 hover:text-eg hover:scale-105 transition-all duration-300 shadow-sm"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-eg shadow-eg-sm" />
                      {component}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 7. Full Description */}
            <div className="space-y-3">
              <h3 className="font-mono-custom text-xs tracking-widest text-white/50 uppercase flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-eg" />
                FULL DESCRIPTION & OVERVIEW
              </h3>
              <div className="glass rounded-2xl p-6 sm:p-8 border border-eg/15 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-40 h-40 bg-eg/5 rounded-full blur-3xl pointer-events-none" />
                <p className="font-sans text-sm sm:text-base text-white/85 leading-relaxed whitespace-pre-line relative z-10">
                  {mainDescription}
                </p>
              </div>
            </div>

            {/* 8. Gallery */}
            <div className="space-y-4 pt-4">
              <div className="flex items-center justify-between">
                <h3 className="font-mono-custom text-xs tracking-widest text-white/50 uppercase flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-eg" />
                  PROJECT GALLERY
                  {galleryUrls.length > 0 && (
                    <span className="text-eg font-semibold">({galleryUrls.length})</span>
                  )}
                </h3>
                {galleryUrls.length > 0 && (
                  <span className="font-mono-custom text-[10px] text-white/30 uppercase tracking-widest">
                    CLICK IMAGE TO ENLARGE
                  </span>
                )}
              </div>

              {galleryUrls.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
                  {galleryUrls.map((imageUrl, idx) => (
                    <div
                      key={idx}
                      onClick={() => setSelectedImageIndex(idx)}
                      className="group relative rounded-2xl overflow-hidden glass border border-eg/20 h-52 cursor-pointer transition-all duration-500 hover:border-eg/70 hover:shadow-eg-sm"
                    >
                      <img
                        src={imageUrl}
                        alt={`Gallery media ${idx + 1}`}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-dark-100/70 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-2">
                        <span className="font-mono-custom text-[11px] text-eg tracking-widest border border-eg/50 px-3.5 py-1.5 rounded-lg bg-dark/90 shadow-lg">
                          VIEW FULL MEDIA ↗
                        </span>
                      </div>
                      <div className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-eg/60 opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 border-eg/60 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="glass rounded-2xl p-8 border border-white/5 text-center flex flex-col items-center justify-center gap-3">
                  <div className="w-12 h-12 rounded-full border border-white/10 bg-dark-200/50 flex items-center justify-center text-white/30">📷</div>
                  <p className="font-mono-custom text-xs tracking-widest text-white/30 uppercase">
                    NO ADDITIONAL GALLERY MEDIA AVAILABLE FOR THIS PROJECT
                  </p>
                </div>
              )}
            </div>

            {/* 9. Bottom Nav */}
            <div className="pt-8 pb-4 border-t border-eg/15 flex items-center justify-between flex-wrap gap-4">
              <Link
                to="/#projects"
                id="back-to-projects-bottom-btn"
                className="btn-outline flex items-center gap-2 text-xs"
              >
                <ArrowRight className="w-4 h-4 rotate-180" />
                BACK TO ALL PROJECTS
              </Link>
              {project.github_url && (
                <a
                  href={project.github_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary text-xs flex items-center gap-2 px-4 py-2"
                >
                  <GithubIcon className="w-3.5 h-3.5" />
                  GitHub Repository ↗
                </a>
              )}
            </div>
          </article>
        )}
      </main>

      {/* Lightbox */}
      {selectedImageIndex !== null && galleryUrls.length > 0 && (
        <LightboxModal
          images={galleryUrls}
          currentIndex={selectedImageIndex}
          onClose={() => setSelectedImageIndex(null)}
          onSelectIndex={(idx) => setSelectedImageIndex(idx)}
        />
      )}

      {/* Footer */}
      <footer className="border-t border-eg/10 py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <p className="font-mono-custom text-[10px] tracking-widest text-white/20 uppercase">
            © 2025 ISOMER. All rights reserved.
          </p>
          <p className="font-mono-custom text-[10px] tracking-widest text-white/15 uppercase hidden sm:block">
            Focus · Create · Elevate
          </p>
        </div>
      </footer>
    </div>
  );
};

export default ProjectDetail;

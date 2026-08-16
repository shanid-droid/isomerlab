import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { usePublicProfile, useCreatorProjects } from '../lib/hooks';
import { supabase } from '../lib/supabase';
import { IsomerLogo, ArrowRight } from '../components/ui';
import type { SocialLinks, Project } from '../lib/types';
import { isCreatorRole, isAdminRole, isOwner } from '../lib/roles';

/* ── Social Link Icons ───────────────────────────────────────────── */
const SocialIcon: React.FC<{ platform: string; className?: string }> = ({ platform, className = 'w-4 h-4' }) => {
  const icons: Record<string, React.ReactNode> = {
    github: (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
      </svg>
    ),
    twitter: (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    ),
    linkedin: (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
      </svg>
    ),
    instagram: (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
      </svg>
    ),
    youtube: (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
      </svg>
    ),
    website: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <circle cx="12" cy="12" r="10" />
        <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" strokeLinecap="round" />
      </svg>
    ),
  };
  return <>{icons[platform] || icons.website}</>;
};

/* ── Mini Project Card for Profile ──────────────────────────────── */
const MiniProjectCard: React.FC<{ project: Project; index: number }> = ({ project, index }) => {
  const num = String(index + 1).padStart(2, '0');
  const parseComponents = (d: string[] | string | null | undefined): string[] => {
    if (!d) return [];
    if (Array.isArray(d)) return d;
    return d.split(',').map((c) => c.trim()).filter(Boolean);
  };
  const comps = parseComponents(project.components).slice(0, 2);

  return (
    <Link
      to={`/projects/${project.slug}`}
      className="group glass rounded-2xl overflow-hidden border border-eg/15 hover:border-eg/50 transition-all duration-400 hover:-translate-y-1 hover:shadow-xl hover:shadow-eg/10 flex flex-col"
    >
      {/* Thumbnail */}
      <div className="relative h-44 overflow-hidden bg-dark-300 flex-shrink-0">
        {project.thumbnail_url ? (
          <img
            src={project.thumbnail_url}
            alt={project.title}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-circuit">
            <span className="font-display text-4xl font-bold text-eg/20">{num}</span>
          </div>
        )}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(to bottom, transparent 40%, rgba(8,12,10,0.85) 100%)' }}
        />
        <div className="absolute top-3 left-3">
          <span className="font-display text-[10px] font-bold text-eg bg-dark-100/80 px-2 py-0.5 rounded border border-eg/30">
            PROJ-{num}
          </span>
        </div>
        <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-eg/50 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col gap-2 flex-1">
        <h3 className="font-display text-sm font-semibold tracking-wider text-white group-hover:text-eg transition-colors line-clamp-1">
          {project.title}
        </h3>
        <p className="font-sans text-xs text-white/40 leading-relaxed line-clamp-2 flex-1">
          {project.description}
        </p>
        {comps.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            {comps.map((c, i) => (
              <span key={i} className="font-mono-custom text-[9px] px-2 py-0.5 rounded bg-dark-200 border border-eg/20 text-white/60">
                {c}
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center gap-1 pt-1 text-eg/60 group-hover:text-eg transition-colors">
          <span className="font-mono-custom text-[10px] tracking-widest">VIEW PROJECT</span>
          <ArrowRight className="w-3 h-3" />
        </div>
      </div>
    </Link>
  );
};

/* ── Skeleton Loading ────────────────────────────────────────────── */
const ProfileSkeleton: React.FC = () => (
  <div className="animate-pulse space-y-8 max-w-4xl mx-auto">
    <div className="glass rounded-2xl p-8 border border-eg/10">
      <div className="flex flex-col md:flex-row gap-8 items-center md:items-start">
        <div className="w-28 h-28 rounded-2xl bg-dark-400/60 flex-shrink-0" />
        <div className="flex-1 space-y-3 w-full">
          <div className="h-8 w-48 rounded bg-dark-400/80" />
          <div className="h-4 w-64 rounded bg-dark-400/50" />
          <div className="h-3 w-full max-w-sm rounded bg-dark-400/40 mt-4" />
          <div className="h-3 w-5/6 max-w-sm rounded bg-dark-400/40" />
        </div>
      </div>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
      {[1, 2, 3].map((i) => (
        <div key={i} className="glass rounded-2xl h-64 bg-dark-300/40 border border-eg/10 animate-pulse" style={{ animationDelay: `${i * 100}ms` }} />
      ))}
    </div>
  </div>
);

/* ── Not Found ───────────────────────────────────────────────────── */
const ProfileNotFound: React.FC = () => (
  <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-6 px-4">
    <div className="w-20 h-20 rounded-full border border-eg/30 bg-eg/5 flex items-center justify-center">
      <span className="font-display text-eg text-2xl font-bold">404</span>
    </div>
    <div>
      <h1 className="font-display text-xl tracking-widest text-white mb-2">PROFILE NOT FOUND</h1>
      <p className="font-sans text-xs text-white/40">This user profile does not exist or may have been removed.</p>
    </div>
    <Link to="/" className="btn-primary flex items-center gap-2">
      <ArrowRight className="w-4 h-4 rotate-180" /> BACK TO HOME
    </Link>
  </div>
);

/* ── Public Profile Page Component ───────────────────────────────── */
export const PublicProfile: React.FC = () => {
  const { id, userId } = useParams<{ id?: string; userId?: string }>();
  const targetUserId = id || userId;

  const { profile, loading: profileLoading, error: profileError } = usePublicProfile(targetUserId);
  const { projects, loading: projectsLoading } = useCreatorProjects(targetUserId);

  // Authenticated user detection to conditionally show "← Dashboard"
  const [currentAuthUserId, setCurrentAuthUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentAuthUserId(session?.user?.id || null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentAuthUserId(session?.user?.id || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const isOwnProfile = !!(currentAuthUserId && targetUserId && currentAuthUserId === targetUserId);

  const formatDate = (d?: string | null) => {
    if (!d) return null;
    try {
      return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
    } catch {
      return null;
    }
  };

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'US';

  const socialLinks = (profile?.social_links || {}) as SocialLinks;
  const socialEntries = Object.entries(socialLinks).filter(([, v]) => v);

  const isCreator = isCreatorRole(profile?.role) || isOwner(profile) || !!profile?.creator_approved_at;
  const isAdmin = isAdminRole(profile?.role) || isOwner(profile);

  const loading = profileLoading || projectsLoading;

  return (
    <div className="min-h-screen bg-dark bg-circuit text-white flex flex-col selection:bg-eg/30">
      {/* Header */}
      <header className="glass-dark border-b border-eg/10 py-4 sticky top-0 z-40 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <Link to="/" className="focus:outline-none">
            <IsomerLogo size="md" />
          </Link>

          <div className="flex items-center gap-3">
            {/* Show "← Dashboard" ONLY when user is viewing their OWN profile */}
            {isOwnProfile && (
              <Link
                to="/dashboard"
                id="header-dashboard-return-btn"
                className="btn-outline text-xs px-3.5 py-1.5 flex items-center gap-1.5 text-eg border-eg/40 hover:bg-eg/10 font-mono-custom transition-all"
              >
                <span>←</span>
                <span>Dashboard</span>
              </Link>
            )}

            <Link to="/#projects" className="btn-outline text-[11px] flex items-center gap-2">
              <ArrowRight className="w-3.5 h-3.5 rotate-180 text-eg" />
              ALL PROJECTS
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-8 md:py-12">
        {loading ? (
          <ProfileSkeleton />
        ) : profileError || !profile ? (
          <ProfileNotFound />
        ) : (
          <div className="space-y-10 animate-fade-in-up">
            {/* Breadcrumb Navigation */}
            <div className="flex items-center justify-between flex-wrap gap-4">
              <nav className="flex items-center gap-2 font-mono-custom text-[11px] tracking-widest text-white/40 uppercase">
                <Link to="/" className="hover:text-eg transition-colors">
                  HOME
                </Link>
                <span className="text-eg/40">/</span>
                <span className="text-eg font-semibold">
                  {isCreator ? 'CREATOR PROFILE' : 'USER PROFILE'}
                </span>
              </nav>

              {isOwnProfile && (
                <div className="flex items-center gap-2">
                  <span className="font-mono-custom text-[10px] text-eg bg-eg/10 border border-eg/30 px-2.5 py-1 rounded-full">
                    ● Viewing Your Public Profile
                  </span>
                  <Link
                    to="/profile/edit"
                    className="text-xs font-mono-custom text-white/60 hover:text-eg underline ml-1"
                  >
                    Edit Profile ↗
                  </Link>
                </div>
              )}
            </div>

            {/* Profile Hero Card */}
            <div className="glass rounded-2xl p-8 border border-eg/20 shadow-2xl relative overflow-hidden">
              {/* Futuristic Corner Accents */}
              <div className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-eg/60" />
              <div className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-eg/60" />
              <div className="absolute bottom-3 left-3 w-4 h-4 border-b-2 border-l-2 border-eg/60" />
              <div className="absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 border-eg/60" />
              
              {/* Ambient glow */}
              <div className="absolute top-0 right-0 w-60 h-60 bg-eg/5 rounded-full blur-3xl pointer-events-none" />

              <div className="flex flex-col md:flex-row items-center md:items-start gap-8 relative z-10">
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  {profile.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={profile.full_name || 'User'}
                      className="w-28 h-28 rounded-2xl object-cover border-2 border-eg/40 shadow-eg-sm"
                    />
                  ) : (
                    <div className="w-28 h-28 rounded-2xl bg-dark-300 border-2 border-eg/40 flex items-center justify-center shadow-eg-sm">
                      <span className="font-display text-3xl font-bold text-eg">{initials}</span>
                    </div>
                  )}
                  {isCreator && (
                    <div className="absolute -bottom-2 -right-2 w-7 h-7 rounded-full bg-eg flex items-center justify-center shadow-sm" title="Verified Creator">
                      <svg className="w-3.5 h-3.5 text-dark" viewBox="0 0 24 24" fill="currentColor">
                        <path fillRule="evenodd" clipRule="evenodd" d="M20.707 5.293a1 1 0 010 1.414l-11 11a1 1 0 01-1.414 0l-5-5a1 1 0 011.414-1.414L9 15.586l10.293-10.293a1 1 0 011.414 0z" />
                      </svg>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 space-y-4 text-center md:text-left">
                  <div>
                    {/* Badge */}
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border mb-3 font-mono-custom text-[10px] tracking-widest uppercase">
                      {isAdmin ? (
                        <>
                          <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                          <span className="text-purple-300">ISOMER CORE TEAM</span>
                        </>
                      ) : isCreator ? (
                        <>
                          <span className="w-2 h-2 rounded-full bg-eg animate-pulse" />
                          <span className="text-eg">ISOMER CREATOR</span>
                        </>
                      ) : (
                        <>
                          <span className="w-2 h-2 rounded-full bg-white/40" />
                          <span className="text-white/60">COMMUNITY MEMBER</span>
                        </>
                      )}
                    </div>

                    <h1 className="font-display text-3xl md:text-4xl font-bold tracking-wide text-white">
                      {profile.full_name || 'ISOMER Member'}
                    </h1>

                    {profile.bio && (
                      <p className="font-sans text-sm text-white/70 mt-2 leading-relaxed max-w-2xl">
                        {profile.bio}
                      </p>
                    )}
                  </div>

                  {/* Stats row */}
                  <div className="flex flex-wrap gap-3 justify-center md:justify-start">
                    <div className="flex items-center gap-2 px-4 py-2 rounded-xl border border-eg/20 bg-dark-200/60">
                      <svg className="w-4 h-4 text-eg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <path d="M9 9h6M9 12h6M9 15h4" strokeLinecap="round" />
                      </svg>
                      <span className="font-mono-custom text-xs text-white font-semibold">{projects.length}</span>
                      <span className="font-mono-custom text-[10px] text-white/40 uppercase tracking-wider">
                        {projects.length === 1 ? 'Project' : 'Projects'}
                      </span>
                    </div>

                    {profile.created_at && (
                      <div className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 bg-dark-200/60">
                        <svg className="w-4 h-4 text-white/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                          <rect x="3" y="4" width="18" height="18" rx="2" />
                          <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                        <span className="font-mono-custom text-[10px] text-white/40 uppercase tracking-wider">
                          Joined {formatDate(profile.created_at)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Social Links */}
                  {socialEntries.length > 0 && (
                    <div className="flex flex-wrap gap-2 justify-center md:justify-start pt-1">
                      {socialEntries.map(([platform, url]) => (
                        <a
                          key={platform}
                          href={url as string}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-eg/20 bg-dark-200/60 text-white/60 hover:text-eg hover:border-eg/50 transition-all duration-200 font-mono-custom text-[10px] tracking-wider uppercase"
                        >
                          <SocialIcon platform={platform} className="w-3.5 h-3.5" />
                          {platform}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* About Section */}
            {profile.about && (
              <div className="space-y-3">
                <h2 className="font-mono-custom text-xs tracking-widest text-white/50 uppercase flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-eg" />
                  ABOUT
                </h2>
                <div className="glass rounded-2xl p-6 sm:p-8 border border-eg/15 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-40 h-40 bg-eg/5 rounded-full blur-3xl pointer-events-none" />
                  <p className="font-sans text-sm text-white/80 leading-relaxed whitespace-pre-line relative z-10">
                    {profile.about}
                  </p>
                </div>
              </div>
            )}

            {/* Projects Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-mono-custom text-xs tracking-widest text-white/50 uppercase flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-eg" />
                  PUBLISHED PROJECTS
                  {projects.length > 0 && (
                    <span className="text-eg font-semibold">({projects.length})</span>
                  )}
                </h2>
              </div>

              {projects.length === 0 ? (
                <div className="glass rounded-2xl py-14 px-6 border border-eg/20 flex flex-col items-center justify-center text-center gap-4">
                  <div className="w-14 h-14 rounded-full border border-eg/30 bg-eg/10 flex items-center justify-center">
                    <svg className="w-6 h-6 text-eg/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <path d="M9 9h6M9 12h6" strokeLinecap="round" />
                    </svg>
                  </div>
                  <p className="font-display text-sm tracking-widest text-white uppercase">
                    NO PUBLISHED PROJECTS YET
                  </p>
                  <p className="font-mono-custom text-xs text-eg/50 tracking-wider">
                    {isOwnProfile
                      ? 'You have not uploaded any published projects yet.'
                      : 'This creator has not published any projects yet.'}
                  </p>
                  {isOwnProfile && isCreator && (
                    <Link to="/creator" className="btn-primary text-xs py-2 px-4 mt-2">
                      Upload Project via Creator Dashboard →
                    </Link>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {projects.map((p, i) => (
                    <MiniProjectCard key={p.id} project={p} index={i} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-eg/10 py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <p className="font-mono-custom text-[10px] tracking-widest text-white/20 uppercase">
            © 2026 ISOMER. All rights reserved.
          </p>
          <p className="font-mono-custom text-[10px] tracking-widest text-white/15 uppercase hidden sm:block">
            Focus · Create · Elevate
          </p>
        </div>
      </footer>
    </div>
  );
};

export default PublicProfile;

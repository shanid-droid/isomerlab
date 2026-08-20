import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { usePublicProfile, useCreatorProjects } from '../lib/hooks';
import { useUserBadges } from '../lib/badgeCampaignHooks';
import { supabase } from '../lib/supabase';
import { IsomerLogo, ArrowRight } from '../components/ui';
import { BadgeCard, BadgeDetailModal } from '../components/ui/BadgeVisual';
import type { SocialLinks, Project } from '../lib/types';
import type { UserBadge } from '../lib/types';
import { isCreatorRole, isAdminRole, isOwner, formatRoleLabel } from '../lib/roles';

/* ── Social Link Metadata & Icons ────────────────────────────────── */
interface SocialPlatformMeta {
  label: string;
  icon: React.ReactNode;
}

const getSocialMeta = (platform: string, className = 'w-4 h-4'): SocialPlatformMeta => {
  const p = platform.toLowerCase().trim();
  switch (p) {
    case 'github':
      return {
        label: 'GitHub',
        icon: (
          <svg className={className} viewBox="0 0 24 24" fill="currentColor">
            <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
          </svg>
        ),
      };
    case 'discord':
      return {
        label: 'Discord',
        icon: (
          <svg className={className} viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.317 4.492c-1.53-.69-3.17-1.2-4.885-1.49a.075.075 0 0 0-.079.036c-.21.369-.444.85-.608 1.23a18.566 18.566 0 0 0-5.487 0 12.36 12.36 0 0 0-.617-1.23A.077.077 0 0 0 8.562 3c-1.714.29-3.354.8-4.885 1.491a.07.07 0 0 0-.032.027C.533 9.093-.32 13.555.099 17.961a.08.08 0 0 0 .031.055 20.03 20.03 0 0 0 5.993 2.98.078.078 0 0 0 .084-.026c.462-.62.874-1.275 1.226-1.963a.074.074 0 0 0-.041-.104 13.201 13.201 0 0 1-1.872-.878.075.075 0 0 1-.008-.125c.126-.093.252-.19.372-.287a.075.075 0 0 1 .078-.01c3.927 1.764 8.18 1.764 12.061 0a.075.075 0 0 1 .079.009c.12.098.245.195.372.288a.075.075 0 0 1-.006.125c-.598.344-1.22.635-1.873.877a.075.075 0 0 0-.041.105c.36.687.772 1.341 1.225 1.962a.077.077 0 0 0 .084.028 19.963 19.963 0 0 0 6.002-2.981.076.076 0 0 0 .032-.054c.5-5.094-.838-9.52-3.549-13.442a.06.06 0 0 0-.031-.028zM8.02 15.278c-1.182 0-2.157-1.069-2.157-2.38 0-1.312.956-2.38 2.157-2.38 1.21 0 2.176 1.077 2.157 2.38 0 1.312-.956 2.38-2.157 2.38zm7.975 0c-1.183 0-2.157-1.069-2.157-2.38 0-1.312.955-2.38 2.157-2.38 1.21 0 2.176 1.077 2.157 2.38 0 1.312-.946 2.38-2.157 2.38z"/>
          </svg>
        ),
      };
    case 'twitter':
    case 'x':
      return {
        label: 'X / Twitter',
        icon: (
          <svg className={className} viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
          </svg>
        ),
      };
    case 'linkedin':
      return {
        label: 'LinkedIn',
        icon: (
          <svg className={className} viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
          </svg>
        ),
      };
    case 'instagram':
      return {
        label: 'Instagram',
        icon: (
          <svg className={className} viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
          </svg>
        ),
      };
    case 'youtube':
      return {
        label: 'YouTube',
        icon: (
          <svg className={className} viewBox="0 0 24 24" fill="currentColor">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
          </svg>
        ),
      };
    case 'portfolio':
    case 'website':
    default:
      return {
        label: p === 'portfolio' ? 'Portfolio' : p === 'website' ? 'Website' : platform.charAt(0).toUpperCase() + platform.slice(1),
        icon: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <circle cx="12" cy="12" r="10" />
            <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" strokeLinecap="round" />
          </svg>
        ),
      };
  }
};

function formatSocialUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed) || /^mailto:/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function parseChips(input?: string | string[] | null): string[] {
  if (!input) return [];
  if (Array.isArray(input)) return input.map((s) => s.trim()).filter(Boolean);
  return input.split(',').map((s) => s.trim()).filter(Boolean);
}

/* ── Project Card ────────────────────────────────────────────────── */
const ProjectCard: React.FC<{ project: Project; index: number }> = ({ project, index }) => {
  const num = String(index + 1).padStart(2, '0');
  const comps = parseChips(project.components).slice(0, 3);

  return (
    <Link
      to={`/projects/${project.slug}`}
      className="group glass-dark rounded-2xl overflow-hidden border border-eg/15 hover:border-eg/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-eg/10 flex flex-col relative"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* Thumbnail */}
      <div className="relative h-48 overflow-hidden bg-dark-300 flex-shrink-0">
        {project.thumbnail_url ? (
          <img
            src={project.thumbnail_url}
            alt={project.title}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-circuit">
            <span className="font-display text-5xl font-bold text-eg/15">{num}</span>
          </div>
        )}
        {/* Gradient overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(to bottom, transparent 50%, rgba(8,12,10,0.9) 100%)' }}
        />
        {/* Project index badge */}
        <div className="absolute top-3 left-3">
          <span className="font-display text-[10px] font-bold text-eg bg-dark-100/90 px-2 py-0.5 rounded border border-eg/30 backdrop-blur-md">
            PROJ-{num}
          </span>
        </div>
        {/* Corner accent */}
        <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-eg/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </div>

      {/* Content */}
      <div className="p-5 flex flex-col gap-2.5 flex-1">
        <h3 className="font-display text-sm font-semibold tracking-wider text-white group-hover:text-eg transition-colors line-clamp-1">
          {project.title}
        </h3>
        <p className="font-sans text-xs text-white/40 leading-relaxed line-clamp-2 flex-1">
          {project.description}
        </p>
        {comps.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            {comps.map((c) => (
              <span key={c} className="font-mono-custom text-[9px] px-2 py-0.5 rounded bg-dark-200 border border-eg/20 text-white/60">
                {c}
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1 text-eg/50 group-hover:text-eg transition-colors">
            <span className="font-mono-custom text-[10px] tracking-widest">VIEW PROJECT</span>
            <ArrowRight className="w-3 h-3" />
          </div>
        </div>
      </div>
    </Link>
  );
};

/* ── Skeleton Loading ─────────────────────────────────────────────── */
const ProfileSkeleton: React.FC = () => (
  <div className="animate-pulse space-y-8 max-w-5xl mx-auto">
    <div className="glass-dark rounded-2xl p-8 border border-eg/10">
      <div className="flex flex-col md:flex-row gap-8 items-center md:items-start">
        <div className="w-32 h-32 rounded-2xl bg-dark-400/60 flex-shrink-0" />
        <div className="flex-1 space-y-4 w-full">
          <div className="h-4 w-28 rounded bg-dark-400/50" />
          <div className="h-8 w-56 rounded bg-dark-400/70" />
          <div className="h-4 w-40 rounded bg-dark-400/40" />
          <div className="h-3 w-full max-w-md rounded bg-dark-400/30" />
          <div className="h-3 w-3/4 max-w-sm rounded bg-dark-400/30" />
          <div className="flex gap-2 pt-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="w-9 h-9 rounded-xl bg-dark-400/50" />
            ))}
          </div>
        </div>
      </div>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="glass rounded-2xl h-64 bg-dark-300/40 border border-eg/10 animate-pulse"
          style={{ animationDelay: `${i * 80}ms` }}
        />
      ))}
    </div>
  </div>
);

/* ── Not Found ────────────────────────────────────────────────────── */
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

/* ── Section Label ────────────────────────────────────────────────── */
const SectionLabel: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex items-center gap-2 mb-4">
    <span className="w-1.5 h-1.5 rounded-full bg-eg animate-pulse flex-shrink-0" />
    <h2 className="font-mono-custom text-[10px] tracking-[0.3em] text-white/40 uppercase">{label}</h2>
    <div className="flex-1 h-px bg-white/5" />
  </div>
);

/* ── Profile Badges Section ───────────────────────────────────────── */
const ProfileBadgesSection: React.FC<{ targetUserId?: string }> = ({ targetUserId }) => {
  const { userBadges, loading } = useUserBadges(targetUserId);
  const [selectedBadge, setSelectedBadge] = useState<UserBadge | null>(null);

  if (loading) {
    return (
      <div>
        <SectionLabel label="Badges" />
        <div className="flex gap-3 flex-wrap">
          {[1, 2, 3].map((i) => (
            <div key={i} className="w-20 h-20 rounded-2xl bg-dark-300/50 animate-pulse border border-eg/10" />
          ))}
        </div>
      </div>
    );
  }

  if (!userBadges || userBadges.length === 0) return null;

  return (
    <div>
      <SectionLabel label="Badges" />
      <div className="glass-dark rounded-2xl p-6 border border-eg/15 relative overflow-hidden">
        <div className="absolute top-3 left-3 w-4 h-4 border-t border-l border-eg/40" />
        <div className="absolute bottom-3 right-3 w-4 h-4 border-b border-r border-eg/40" />
        <div className="flex flex-wrap gap-3 relative z-10">
          {userBadges.map((ub) => (
            <BadgeCard
              key={ub.id}
              badge={ub.badge!}
              userBadge={ub}
              size="sm"
              onClick={() => setSelectedBadge(ub)}
            />
          ))}
        </div>
      </div>
      {selectedBadge && (
        <BadgeDetailModal
          isOpen={!!selectedBadge}
          userBadge={selectedBadge}
          badge={selectedBadge.badge ?? null}
          onClose={() => setSelectedBadge(null)}
        />
      )}
    </div>
  );
};

/* ── Public Profile Page ──────────────────────────────────────────── */
export const PublicProfile: React.FC = () => {
  const { id, userId } = useParams<{ id?: string; userId?: string }>();
  const targetUserId = id || userId;

  const { profile, loading: profileLoading, error: profileError } = usePublicProfile(targetUserId);
  const { projects, loading: projectsLoading } = useCreatorProjects(targetUserId);

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
      return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
    } catch { return null; }
  };

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'US';

  const handle = useMemo(() => {
    if (!profile?.full_name) return profile?.id ? profile.id.slice(0, 8) : 'creator';
    return profile.full_name.toLowerCase().replace(/[^a-z0-9_]/g, '');
  }, [profile]);

  // Social links — only non-empty entries, filter out profession/role custom keys
  const socialEntries = useMemo(() => {
    const raw = (profile?.social_links || {}) as SocialLinks;
    const knownPlatforms = ['github', 'twitter', 'x', 'linkedin', 'instagram', 'youtube', 'website', 'portfolio', 'discord'];
    return Object.entries(raw).filter(([k, v]) => {
      if (typeof v !== 'string' || !v.trim()) return false;
      // Include known platforms + any unknown string platform
      const lk = k.toLowerCase();
      if (knownPlatforms.includes(lk)) return true;
      // Skip non-URL data stored in social_links
      if (lk === 'profession' || lk === 'current_role' || lk === 'education') return false;
      return true;
    });
  }, [profile?.social_links]);

  const profession = useMemo(() => {
    const p = profile?.profession || (profile?.social_links as any)?.profession;
    return typeof p === 'string' && p.trim() ? p.trim() : null;
  }, [profile?.profession, profile?.social_links]);

  const currentRole = useMemo(() => {
    const r = profile?.current_role || (profile?.social_links as any)?.current_role;
    return typeof r === 'string' && r.trim() ? r.trim() : null;
  }, [profile?.current_role, profile?.social_links]);

  const education = useMemo(() => {
    const e = profile?.education;
    return typeof e === 'string' && e.trim() ? e.trim() : null;
  }, [profile?.education]);

  const educationDetails = useMemo(() => {
    const ed = profile?.education_details;
    return typeof ed === 'string' && ed.trim() ? ed.trim() : null;
  }, [profile?.education_details]);

  const experienceLevel = useMemo(() => {
    const exp = profile?.experience_level;
    return typeof exp === 'string' && exp.trim() ? exp.trim() : null;
  }, [profile?.experience_level]);

  const location = useMemo(() => {
    const loc = profile?.location;
    return typeof loc === 'string' && loc.trim() ? loc.trim() : null;
  }, [profile?.location]);

  const identityLine = useMemo(() => {
    const parts = [profession, currentRole].filter(Boolean);
    if (parts.length === 0) return null;
    if (parts.length === 2 && parts[0]?.toLowerCase() === parts[1]?.toLowerCase()) return parts[0];
    return parts.join(' • ');
  }, [profession, currentRole]);

  const skillsList = useMemo(() => parseChips(profile?.skills), [profile?.skills]);
  const projectTypesList = useMemo(() => parseChips(profile?.project_types), [profile?.project_types]);

  const hasProfessionalDetails = !!(profession || currentRole || education || educationDetails || experienceLevel || location);
  const hasSkillsOrProjects = skillsList.length > 0 || projectTypesList.length > 0;

  const isCreator = isCreatorRole(profile?.role) || isOwner(profile) || !!profile?.creator_approved_at;
  const isAdmin = isAdminRole(profile?.role) || isOwner(profile);

  const loading = profileLoading || projectsLoading;

  return (
    <div className="min-h-screen bg-dark bg-circuit text-white flex flex-col selection:bg-eg/30">
      {/* ── Navigation ── */}
      <header className="glass-dark border-b border-eg/10 py-3.5 sticky top-0 z-40 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-5 flex items-center justify-between gap-4">
          <Link to="/" className="focus:outline-none">
            <IsomerLogo size="md" />
          </Link>
          <div className="flex items-center gap-2">
            {isOwnProfile && (
              <Link
                to="/creator"
                id="header-dashboard-return-btn"
                className="font-mono-custom text-xs text-eg border border-eg/30 hover:bg-eg/10 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5"
              >
                <span>←</span>
                <span>Dashboard</span>
              </Link>
            )}
            <Link
              to="/#projects"
              className="font-mono-custom text-[11px] text-white/50 hover:text-eg border border-white/10 hover:border-eg/30 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5"
            >
              <ArrowRight className="w-3 h-3 rotate-180 text-eg" />
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
          <div className="space-y-10">

            {/* Own profile banner */}
            {isOwnProfile && (
              <div className="flex items-center justify-between px-4 py-2.5 rounded-xl border border-eg/20 bg-eg/5">
                <span className="font-mono-custom text-[10px] text-eg tracking-wider uppercase">
                  ● Viewing Your Public Profile
                </span>
                <Link
                  to="/profile/edit"
                  className="font-mono-custom text-[10px] text-white/60 hover:text-eg underline transition-colors"
                >
                  Edit Profile ↗
                </Link>
              </div>
            )}

            {/* ════════════════════════════════════════
                CREATOR PROFILE HERO
            ════════════════════════════════════════ */}
            <div className="glass-dark rounded-2xl border border-eg/20 shadow-2xl relative overflow-hidden">
              {/* Corner accents */}
              <div className="absolute top-3 left-3 w-5 h-5 border-t-2 border-l-2 border-eg/60 pointer-events-none" />
              <div className="absolute top-3 right-3 w-5 h-5 border-t-2 border-r-2 border-eg/60 pointer-events-none" />
              <div className="absolute bottom-3 left-3 w-5 h-5 border-b-2 border-l-2 border-eg/60 pointer-events-none" />
              <div className="absolute bottom-3 right-3 w-5 h-5 border-b-2 border-r-2 border-eg/60 pointer-events-none" />
              {/* Ambient glow */}
              <div className="absolute top-0 right-0 w-72 h-72 bg-eg/8 rounded-full blur-3xl pointer-events-none" />

              {/* Main hero area */}
              <div className="p-6 sm:p-8 md:p-10 relative z-10">
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 sm:gap-8">
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    {profile.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt={profile.full_name || 'Creator avatar'}
                        className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl object-cover border-2 border-eg/40 shadow-eg-sm"
                      />
                    ) : (
                      <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl bg-dark-300 border-2 border-eg/40 flex items-center justify-center shadow-eg-sm">
                        <span className="font-display text-3xl sm:text-4xl font-bold text-eg">{initials}</span>
                      </div>
                    )}
                    {isCreator && (
                      <div
                        className="absolute -bottom-2 -right-2 w-7 h-7 rounded-full bg-eg flex items-center justify-center shadow-md border-2 border-dark"
                        title="Verified ISOMER Creator"
                      >
                        <svg className="w-3.5 h-3.5 text-dark" viewBox="0 0 24 24" fill="currentColor">
                          <path fillRule="evenodd" clipRule="evenodd" d="M20.707 5.293a1 1 0 010 1.414l-11 11a1 1 0 01-1.414 0l-5-5a1 1 0 011.414-1.414L9 15.586l10.293-10.293a1 1 0 011.414 0z" />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Identity */}
                  <div className="flex-1 text-center sm:text-left space-y-3 min-w-0">
                    {/* Role badge + location */}
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-eg/25 bg-dark-200/80 font-mono-custom text-[10px] tracking-widest uppercase">
                        {isAdmin ? (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                            <span className="text-purple-300 font-semibold">ISOMER CORE TEAM</span>
                          </>
                        ) : isCreator ? (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-eg animate-pulse" />
                            <span className="text-eg font-semibold">ISOMER CREATOR</span>
                          </>
                        ) : (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-white/40" />
                            <span className="text-white/70">{formatRoleLabel(profile.role)}</span>
                          </>
                        )}
                      </div>
                      {location && (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-white/10 bg-dark-200/70 font-mono-custom text-[10px] text-white/60">
                          <svg className="w-3 h-3 text-eg/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" strokeLinecap="round" strokeLinejoin="round" />
                            <circle cx="12" cy="9" r="2.5" />
                          </svg>
                          {location}
                        </div>
                      )}
                    </div>

                    {/* Name */}
                    <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-bold tracking-wider text-white leading-tight break-words text-glow-sm">
                      {profile.full_name || 'ISOMER Member'}
                    </h1>

                    {/* Handle + identity line */}
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 font-mono-custom text-xs">
                      <span className="text-eg/70 tracking-[0.2em] font-semibold">@{handle}</span>
                      {identityLine && (
                        <>
                          <span className="w-1 h-1 rounded-full bg-white/20" />
                          <span className="text-white/80 tracking-wide font-medium">{identityLine}</span>
                        </>
                      )}
                    </div>

                    {/* Bio (short) */}
                    {profile.bio && (
                      <p className="font-sans text-base text-white/80 leading-relaxed max-w-2xl mx-auto sm:mx-0">
                        {profile.bio}
                      </p>
                    )}

                    {/* Social icons row */}
                    {socialEntries.length > 0 && (
                      <div className="flex flex-wrap gap-2 justify-center sm:justify-start pt-1">
                        {socialEntries.map(([platform, url]) => {
                          const meta = getSocialMeta(platform, 'w-4 h-4');
                          const formatted = formatSocialUrl(url as string);
                          if (!formatted) return null;
                          return (
                            <a
                              key={platform}
                              href={formatted}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={meta.label}
                              aria-label={`Visit ${meta.label}`}
                              className="w-9 h-9 flex items-center justify-center rounded-xl border border-eg/20 bg-dark-200/70 text-white/50 hover:text-eg hover:border-eg/60 hover:bg-eg/10 hover:shadow-eg-sm transition-all duration-200 hover:-translate-y-0.5"
                            >
                              {meta.icon}
                            </a>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Stats strip */}
              <div className="border-t border-eg/10 grid grid-cols-2 sm:grid-cols-4 divide-x divide-eg/10">
                <div className="px-5 py-4 flex items-center gap-3">
                  <svg className="w-4 h-4 text-eg flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <path d="M9 9h6M9 12h6M9 15h4" strokeLinecap="round" />
                  </svg>
                  <div>
                    <span className="font-display text-xl font-bold text-white">{projects.length}</span>
                    <span className="font-mono-custom text-[10px] text-white/30 tracking-widest uppercase block">
                      {projects.length === 1 ? 'Project' : 'Projects'}
                    </span>
                  </div>
                </div>
                {profile.created_at && (
                  <div className="px-5 py-4 flex items-center gap-3">
                    <svg className="w-4 h-4 text-white/30 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                      <rect x="3" y="4" width="18" height="18" rx="2" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    <div>
                      <span className="font-mono-custom text-xs text-white/60 block">{formatDate(profile.created_at)}</span>
                      <span className="font-mono-custom text-[10px] text-white/25 uppercase tracking-wider block">Joined</span>
                    </div>
                  </div>
                )}
                {isCreator && (
                  <div className="px-5 py-4 hidden sm:flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-eg animate-pulse flex-shrink-0" />
                    <div>
                      <span className="font-mono-custom text-xs text-eg font-semibold block">VERIFIED</span>
                      <span className="font-mono-custom text-[10px] text-white/25 uppercase tracking-wider block">Creator</span>
                    </div>
                  </div>
                )}
                {isAdmin && (
                  <div className="px-5 py-4 hidden sm:flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse flex-shrink-0" />
                    <div>
                      <span className="font-mono-custom text-xs text-purple-300 font-semibold block">CORE TEAM</span>
                      <span className="font-mono-custom text-[10px] text-white/25 uppercase tracking-wider block">Admin</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ════════════════════════════════════════
                ABOUT
            ════════════════════════════════════════ */}
            {profile.about && (
              <div>
                <SectionLabel label="About" />
                <div className="glass-dark rounded-2xl p-6 sm:p-8 border border-eg/15 relative overflow-hidden">
                  <div className="absolute top-3 left-3 w-4 h-4 border-t border-l border-eg/40" />
                  <div className="absolute bottom-3 right-3 w-4 h-4 border-b border-r border-eg/40" />
                  <div className="absolute top-0 right-0 w-40 h-40 bg-eg/5 rounded-full blur-2xl pointer-events-none" />
                  <p className="font-sans text-sm sm:text-base text-white/80 leading-relaxed whitespace-pre-line relative z-10 max-w-3xl">
                    {profile.about}
                  </p>
                </div>
              </div>
            )}

            {/* ════════════════════════════════════════
                PROFESSIONAL PROFILE
            ════════════════════════════════════════ */}
            {hasProfessionalDetails && (
              <div>
                <SectionLabel label="Professional Profile" />
                <div className="glass-dark rounded-2xl p-6 sm:p-8 border border-eg/15 relative overflow-hidden">
                  <div className="absolute top-3 left-3 w-4 h-4 border-t border-l border-eg/40" />
                  <div className="absolute bottom-3 right-3 w-4 h-4 border-b border-r border-eg/40" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 relative z-10">
                    {profession && (
                      <div className="p-4 rounded-xl border border-eg/15 bg-dark-200/50 space-y-1">
                        <span className="font-mono-custom text-[9px] tracking-widest text-white/35 uppercase block">PROFESSION</span>
                        <span className="font-display text-sm font-semibold text-white tracking-wide block">{profession}</span>
                      </div>
                    )}
                    {currentRole && (
                      <div className="p-4 rounded-xl border border-eg/15 bg-dark-200/50 space-y-1">
                        <span className="font-mono-custom text-[9px] tracking-widest text-white/35 uppercase block">CURRENT ROLE</span>
                        <span className="font-display text-sm font-semibold text-white tracking-wide block">{currentRole}</span>
                      </div>
                    )}
                    {education && (
                      <div className="p-4 rounded-xl border border-eg/15 bg-dark-200/50 space-y-1">
                        <span className="font-mono-custom text-[9px] tracking-widest text-white/35 uppercase block">EDUCATION</span>
                        <span className="font-display text-sm font-semibold text-white tracking-wide block">{education}</span>
                        {educationDetails && (
                          <span className="font-sans text-[11px] text-white/50 block">{educationDetails}</span>
                        )}
                      </div>
                    )}
                    {experienceLevel && (
                      <div className="p-4 rounded-xl border border-eg/15 bg-dark-200/50 space-y-1">
                        <span className="font-mono-custom text-[9px] tracking-widest text-white/35 uppercase block">EXPERIENCE</span>
                        <span className="font-display text-sm font-semibold text-eg tracking-wide block">{experienceLevel}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ════════════════════════════════════════
                SKILLS & DOMAINS
            ════════════════════════════════════════ */}
            {hasSkillsOrProjects && (
              <div>
                <SectionLabel label="Skills & Domains" />
                <div className="glass-dark rounded-2xl p-6 sm:p-8 border border-eg/15 relative overflow-hidden space-y-5">
                  <div className="absolute top-3 left-3 w-4 h-4 border-t border-l border-eg/40" />
                  <div className="absolute bottom-3 right-3 w-4 h-4 border-b border-r border-eg/40" />
                  {skillsList.length > 0 && (
                    <div className="space-y-2 relative z-10">
                      <span className="font-mono-custom text-[9px] tracking-widest text-white/35 uppercase block">PRIMARY SKILLS</span>
                      <div className="flex flex-wrap gap-2">
                        {skillsList.map((skill) => (
                          <span
                            key={skill}
                            className="px-3 py-1.5 rounded-xl border border-eg/25 bg-eg/8 text-eg font-mono-custom text-xs tracking-wide hover:border-eg/50 transition-colors"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {projectTypesList.length > 0 && (
                    <div className="space-y-2 relative z-10">
                      <span className="font-mono-custom text-[9px] tracking-widest text-white/35 uppercase block">PROJECT DOMAINS</span>
                      <div className="flex flex-wrap gap-2">
                        {projectTypesList.map((pt) => (
                          <span
                            key={pt}
                            className="px-3 py-1.5 rounded-xl border border-purple-500/25 bg-purple-500/8 text-purple-300 font-mono-custom text-xs tracking-wide hover:border-purple-500/50 transition-colors"
                          >
                            {pt}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ════════════════════════════════════════
                BADGES
            ════════════════════════════════════════ */}
            <ProfileBadgesSection targetUserId={targetUserId} />

            {/* ════════════════════════════════════════
                PROJECTS
            ════════════════════════════════════════ */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="w-1.5 h-1.5 rounded-full bg-eg animate-pulse flex-shrink-0" />
                <h2 className="font-mono-custom text-[10px] tracking-[0.3em] text-white/40 uppercase">
                  Projects
                  {projects.length > 0 && (
                    <span className="ml-2 text-eg font-semibold">({projects.length})</span>
                  )}
                </h2>
                <div className="flex-1 h-px bg-white/5" />
              </div>

              {projectsLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-64 rounded-2xl bg-dark-300/40 border border-eg/10 animate-pulse" />
                  ))}
                </div>
              ) : projects.length === 0 ? (
                <div className="glass-dark rounded-2xl py-16 px-6 border border-eg/15 flex flex-col items-center justify-center text-center gap-4">
                  <div className="w-14 h-14 rounded-full border border-eg/25 bg-eg/8 flex items-center justify-center">
                    <svg className="w-6 h-6 text-eg/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <path d="M9 9h6M9 12h6" strokeLinecap="round" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-display text-sm tracking-widest text-white uppercase mb-1">NO PUBLISHED PROJECTS YET</p>
                    <p className="font-mono-custom text-xs text-white/30">
                      {isOwnProfile
                        ? 'Upload your first project from the Creator Dashboard.'
                        : 'This creator has not published any projects yet.'}
                    </p>
                  </div>
                  {isOwnProfile && isCreator && (
                    <Link to="/creator" className="btn-primary text-xs py-2 px-4 mt-1">
                      Open Creator Dashboard →
                    </Link>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {projects.map((p, i) => (
                    <ProjectCard key={p.id} project={p} index={i} />
                  ))}
                </div>
              )}
            </div>

          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-eg/10 py-6 mt-auto">
        <div className="max-w-5xl mx-auto px-6 flex items-center justify-between">
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

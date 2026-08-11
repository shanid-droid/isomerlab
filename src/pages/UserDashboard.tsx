import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useUserProfile } from '../lib/hooks';
import { IsomerLogo, ArrowRight } from '../components/ui';
import { logAuthEvent } from '../lib/activityLog';
import type { SocialLinks } from '../lib/types';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isValidUUID = (v?: string | null): v is string => !!v && UUID_REGEX.test(v);

const SOCIAL_ICONS: Record<string, React.ReactNode> = {
  github: (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  ),
  twitter: (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  ),
  linkedin: (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>
  ),
  website: (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" strokeLinecap="round" />
    </svg>
  ),
};

const UserDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { profile, loading, error } = useUserProfile();

  const handleLogout = async () => {
    await logAuthEvent('user_logout', { email: profile?.email ?? undefined, method: 'user_dashboard' });
    await supabase.auth.signOut();
    navigate('/login', { replace: true });
  };

  const getInitials = (name: string | null | undefined, email: string | null | undefined) => {
    if (name && name.trim()) {
      const parts = name.trim().split(' ');
      if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
      }
      return name.substring(0, 2).toUpperCase();
    }
    if (email && email.trim()) {
      return email.substring(0, 2).toUpperCase();
    }
    return 'US';
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const socialLinks = (profile?.social_links || {}) as SocialLinks;
  const socialEntries = Object.entries(socialLinks).filter(([, v]) => v);

  if (loading) {
    return (
      <div className="min-h-screen bg-dark bg-circuit flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-2 border-eg/30 border-t-eg animate-spin" />
          <span className="font-mono-custom text-xs tracking-widest text-eg/70 uppercase">
            LOADING PROFILE...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark bg-circuit text-white flex flex-col selection:bg-eg/30">
      {/* Header / Navbar */}
      <header className="glass-dark border-b border-eg/10 sticky top-0 z-30 py-4 px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Link to="/">
              <IsomerLogo size="md" />
            </Link>
            <div className="h-5 w-px bg-eg/20 hidden sm:block" />
            <span className="font-mono-custom text-[10px] tracking-widest text-eg/80 uppercase bg-eg/10 px-2.5 py-1 rounded border border-eg/30 hidden sm:inline-block">
              USER DASHBOARD
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="font-mono-custom text-xs text-white/60 hover:text-eg transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded border border-white/10"
            >
              Public Site ↗
            </Link>

            {profile?.role === 'admin' && (
              <Link
                to="/admin"
                className="font-mono-custom text-xs text-eg hover:bg-eg/10 transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded border border-eg/40 bg-eg/5"
              >
                Admin Console ↗
              </Link>
            )}

            <button
              id="user-logout-btn"
              onClick={handleLogout}
              className="btn-primary py-1.5 px-4 text-xs font-mono-custom flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              LOGOUT
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-12 space-y-8">
        {error && (
          <div className="p-4 rounded-xl border border-red-500/40 bg-red-500/10 flex items-center gap-3">
            <span className="font-mono-custom text-xs text-red-400">Error loading profile: {error}</span>
          </div>
        )}

        {/* Profile Card */}
        <div className="glass rounded-2xl p-8 border border-eg/20 shadow-2xl relative overflow-hidden">
          {/* Futuristic Corner Accents */}
          <div className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-eg/60" />
          <div className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-eg/60" />
          <div className="absolute bottom-3 left-3 w-4 h-4 border-b-2 border-l-2 border-eg/60" />
          <div className="absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 border-eg/60" />
          <div className="absolute top-0 right-0 w-60 h-60 bg-eg/5 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
            {/* Profile Avatar */}
            <div className="relative flex-shrink-0">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.full_name || 'User Avatar'}
                  className="w-24 h-24 rounded-2xl object-cover border-2 border-eg/40 shadow-eg-sm"
                />
              ) : (
                <div className="w-24 h-24 rounded-2xl bg-dark-300 border-2 border-eg/40 flex items-center justify-center shadow-eg-sm">
                  <span className="font-display text-2xl font-bold text-eg tracking-wider">
                    {getInitials(profile?.full_name, profile?.email)}
                  </span>
                </div>
              )}
              <div className="absolute -bottom-2 -right-2 w-6 h-6 rounded-full bg-eg flex items-center justify-center text-dark font-bold text-[10px] shadow-sm">
                ✓
              </div>
            </div>

            {/* Profile Info */}
            <div className="flex-1 text-center md:text-left space-y-4">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-eg/30 bg-eg/10 mb-2">
                  <span className="w-2 h-2 rounded-full bg-eg animate-pulse" />
                  <span className="font-mono-custom text-[10px] tracking-widest text-eg uppercase">
                    ROLE: {profile?.role?.toUpperCase() || 'USER'}
                  </span>
                </div>
                <h1 className="font-display text-2xl md:text-3xl font-bold tracking-wide text-white">
                  {profile?.full_name || 'Member Profile'}
                </h1>
                <p className="font-mono-custom text-sm text-white/50 mt-1">
                  {profile?.email}
                </p>
                {profile?.bio && (
                  <p className="font-sans text-sm text-white/60 mt-2 leading-relaxed">
                    {profile.bio}
                  </p>
                )}
              </div>

              {/* Social Links (if set) */}
              {socialEntries.length > 0 && (
                <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                  {socialEntries.map(([platform, url]) => (
                    <a
                      key={platform}
                      href={url as string}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-eg/20 bg-dark-200/60 text-white/50 hover:text-eg hover:border-eg/50 transition-all duration-200 font-mono-custom text-[10px] tracking-wider uppercase"
                    >
                      {SOCIAL_ICONS[platform] || SOCIAL_ICONS.website}
                      {platform}
                    </a>
                  ))}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3 justify-center md:justify-start pt-1">
                <Link
                  to="/profile/edit"
                  id="edit-profile-btn"
                  className="btn-primary py-2 px-5 text-xs flex items-center gap-2"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                    <path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  EDIT PROFILE
                </Link>
                {isValidUUID(profile?.id) && (
                  <Link
                    to={`/profile/${profile.id}`}
                    id="view-public-profile-btn"
                    className="btn-outline py-2 px-5 text-xs flex items-center gap-2"
                  >
                    VIEW PUBLIC PROFILE
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* About Section (if set) */}
        {profile?.about && (
          <div className="glass rounded-2xl p-6 border border-eg/15 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-eg/5 rounded-full blur-3xl pointer-events-none" />
            <h2 className="font-mono-custom text-xs tracking-widest text-white/50 uppercase flex items-center gap-2 mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-eg" />
              ABOUT
            </h2>
            <p className="font-sans text-sm text-white/70 leading-relaxed whitespace-pre-line relative z-10">
              {profile.about}
            </p>
          </div>
        )}

        {/* Profile Meta Info Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-dark-200/60 p-4 rounded-xl border border-white/5">
            <p className="font-mono-custom text-[10px] tracking-widest text-white/40 uppercase mb-1">
              ACCOUNT CREATED
            </p>
            <p className="font-mono-custom text-sm text-white font-medium">
              {formatDate(profile?.created_at)}
            </p>
          </div>

          <div className="bg-dark-200/60 p-4 rounded-xl border border-white/5">
            <p className="font-mono-custom text-[10px] tracking-widest text-white/40 uppercase mb-1">
              SYSTEM STATUS
            </p>
            <p className="font-mono-custom text-sm text-eg font-medium flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-eg animate-pulse" />
              AUTHENTICATED
            </p>
          </div>

          <div className="bg-dark-200/60 p-4 rounded-xl border border-white/5">
            <p className="font-mono-custom text-[10px] tracking-widest text-white/40 uppercase mb-1">
              PUBLIC PROFILE
            </p>
            {isValidUUID(profile?.id) ? (
              <Link
                to={`/profile/${profile.id}`}
                className="font-mono-custom text-sm text-eg/80 hover:text-eg transition-colors font-medium flex items-center gap-1.5"
              >
                VIEW PROFILE ↗
              </Link>
            ) : (
              <span className="font-mono-custom text-sm text-white/20">Loading…</span>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default UserDashboard;

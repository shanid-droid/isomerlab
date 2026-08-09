import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useUserProfile } from '../lib/hooks';
import { IsomerLogo } from '../components/ui';

const UserDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { profile, loading, error } = useUserProfile();

  const handleLogout = async () => {
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

          <div className="flex items-center gap-4">
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

          <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
            {/* Profile Avatar */}
            <div className="relative">
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

            {/* Profile Info Details */}
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
              </div>

              {/* Profile Meta Info Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-eg/10">
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
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default UserDashboard;

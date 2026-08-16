import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { IsomerLogo } from '../components/ui';
import {
  useLeaderboard,
  useLeaderboardSettings,
  useMyCreatorRank,
} from '../lib/leaderboardHooks';
import type {
  LeaderboardType,
  LeaderboardPeriod,
  ProjectLeaderboardMetadata,
  CreatorLeaderboardMetadata,
} from '../lib/types';
import { isCreatorRole, isAdminRole } from '../lib/roles';

export const LeaderboardPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<LeaderboardType>('projects');
  const [activePeriod, setActivePeriod] = useState<LeaderboardPeriod>('all_time');
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const { settings, loading: settingsLoading } = useLeaderboardSettings();
  const { entries, publishedAt, loading, error, isUnpublished, refetch } = useLeaderboard(
    activeTab,
    activePeriod
  );
  const { myRank } = useMyCreatorRank(activePeriod);

  // Check auth user session & role
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUserId(session.user.id);
        supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .maybeSingle()
          .then(({ data }) => setUserRole(data?.role || 'user'));
      } else {
        setUserId(null);
        setUserRole(null);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUserId(session.user.id);
        supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .maybeSingle()
          .then(({ data }) => setUserRole(data?.role || 'user'));
      } else {
        setUserId(null);
        setUserRole(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Update period if current active period is disabled in settings
  useEffect(() => {
    if (settings) {
      if (activePeriod === 'all_time' && !settings.all_time_enabled) {
        if (settings.monthly_enabled) setActivePeriod('monthly');
        else if (settings.weekly_enabled) setActivePeriod('weekly');
      } else if (activePeriod === 'monthly' && !settings.monthly_enabled) {
        if (settings.all_time_enabled) setActivePeriod('all_time');
        else if (settings.weekly_enabled) setActivePeriod('weekly');
      } else if (activePeriod === 'weekly' && !settings.weekly_enabled) {
        if (settings.all_time_enabled) setActivePeriod('all_time');
        else if (settings.monthly_enabled) setActivePeriod('monthly');
      }
    }
  }, [settings, activePeriod]);

  const isOwnerOrAdmin = isAdminRole(userRole as any) || userId === '9d5d6287-1843-4cd0-afee-fc1830411571';
  const isCreator = isCreatorRole(userRole as any);

  // Determine visibility authorization
  const isVisibilityAllowed = () => {
    if (!settings) return true;
    if (!settings.enabled && !isOwnerOrAdmin) return false;
    if (settings.visibility === 'no_one' && !isOwnerOrAdmin) return false;
    if (settings.visibility === 'admins_only' && !isOwnerOrAdmin) return false;
    if (settings.visibility === 'creators_only' && !isCreator && !isOwnerOrAdmin) return false;
    return true;
  };

  const topThree = entries.slice(0, 3);
  const remainingEntries = entries.slice(3);

  // Format rank number with leading zero
  const formatRank = (r: number) => (r < 10 ? `0${r}` : `${r}`);

  return (
    <div className="min-h-screen bg-dark bg-circuit text-white flex flex-col selection:bg-eg selection:text-dark">
      {/* ── Top Header / Navbar ─────────────────────────────────── */}
      <header className="glass-dark border-b border-eg/10 sticky top-0 z-40 py-4 px-6 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link to="/" className="focus:outline-none hover:opacity-90 transition-opacity">
              <IsomerLogo size="md" />
            </Link>
            <div className="h-5 w-px bg-eg/20 hidden sm:block" />
            <span className="font-mono-custom text-[10px] tracking-widest text-eg/80 uppercase bg-eg/10 px-2.5 py-1 rounded border border-eg/30 hidden sm:inline-block">
              COMMUNITY RANKINGS
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="font-mono-custom text-xs text-white/60 hover:text-eg transition-colors px-3 py-1.5 rounded border border-white/10"
            >
              ← Public Site
            </Link>

            {userId ? (
              <Link
                to={isOwnerOrAdmin ? '/admin' : isCreator ? '/creator' : '/dashboard'}
                className="btn-primary py-1.5 px-3.5 text-xs font-mono-custom flex items-center gap-1.5"
              >
                Dashboard
              </Link>
            ) : (
              <Link
                to="/login"
                className="btn-primary py-1.5 px-3.5 text-xs font-mono-custom flex items-center gap-1.5"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* ── Hero Banner ─────────────────────────────────────────── */}
      <section className="relative pt-12 pb-8 px-6 border-b border-eg/10 overflow-hidden">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-eg/5 rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-7xl mx-auto space-y-6 relative z-10">
          
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-eg/30 bg-eg/5 text-eg font-mono-custom text-[11px] uppercase tracking-widest">
                <span className="w-2 h-2 rounded-full bg-eg animate-pulse" />
                OFFICIAL COMMUNITY METRICS
              </div>
              <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-white uppercase">
                LEADERBOARD
              </h1>
              <p className="font-mono-custom text-xs sm:text-sm text-white/60 tracking-wider uppercase">
                ISOMER COMMUNITY RANKINGS & CONTRIBUTIONS
              </p>
            </div>

            {/* Publication Timestamp */}
            {publishedAt && (
              <div className="font-mono-custom text-[11px] text-white/40 border border-eg/15 rounded-xl px-4 py-2 bg-dark-200/40 flex items-center gap-2 self-start md:self-auto">
                <span className="text-eg">◈</span>
                <span>PUBLISHED: {new Date(publishedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              </div>
            )}
          </div>

          {/* ── Logged-in Creator Position Card ─────────────────── */}
          {isCreator && myRank && myRank.is_creator && (
            <div className="glass rounded-2xl p-5 border border-eg/30 shadow-eg-sm relative overflow-hidden bg-gradient-to-r from-dark-200/90 via-dark-200/60 to-eg/5">
              <div className="absolute top-0 right-0 w-32 h-32 bg-eg/10 rounded-full blur-2xl pointer-events-none" />
              <div className="flex flex-wrap items-center justify-between gap-4 relative z-10">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-eg/10 border border-eg/40 flex items-center justify-center font-display text-xl font-bold text-eg">
                    {myRank.rank ? `#${myRank.rank}` : '—'}
                  </div>
                  <div>
                    <div className="font-mono-custom text-[10px] tracking-widest text-eg uppercase font-semibold">
                      YOUR CREATOR RANKING
                    </div>
                    <div className="font-display text-lg font-bold text-white">
                      {myRank.rank ? `Rank #${myRank.rank} of ${myRank.total_creators}` : 'Not ranked in published snapshot'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  {myRank.score !== null && (
                    <div>
                      <div className="font-mono-custom text-[10px] tracking-widest text-white/40 uppercase">
                        YOUR SCORE
                      </div>
                      <div className="font-mono-custom text-base font-bold text-eg">
                        {Number(myRank.score).toLocaleString()} PTS
                      </div>
                    </div>
                  )}

                  {myRank.rank_delta !== 0 && (
                    <div className="hidden sm:block">
                      <div className="font-mono-custom text-[10px] tracking-widest text-white/40 uppercase">
                        POSITION MOVEMENT
                      </div>
                      <div className={`font-mono-custom text-xs font-semibold flex items-center gap-1 ${
                        myRank.rank_delta > 0 ? 'text-eg' : 'text-red-400'
                      }`}>
                        {myRank.rank_delta > 0 ? `↑ +${myRank.rank_delta} positions` : `↓ ${myRank.rank_delta} positions`}
                      </div>
                    </div>
                  )}

                  <Link
                    to="/creator"
                    className="font-mono-custom text-xs text-white/70 hover:text-eg transition-colors px-3 py-1.5 rounded-lg border border-white/15 hover:border-eg/40"
                  >
                    Creator Studio →
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* ── Tab and Period Controls Bar ─────────────────────── */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-2">
            {/* Tabs: Projects vs Creators */}
            <div className="flex items-center p-1 rounded-xl bg-dark-300/80 border border-eg/20 w-fit">
              <button
                id="tab-projects"
                onClick={() => setActiveTab('projects')}
                className={`font-mono-custom text-xs tracking-widest px-6 py-2 rounded-lg transition-all flex items-center gap-2 ${
                  activeTab === 'projects'
                    ? 'bg-eg text-dark font-bold shadow-eg-sm'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                📁 PROJECTS
              </button>
              <button
                id="tab-creators"
                onClick={() => setActiveTab('creators')}
                className={`font-mono-custom text-xs tracking-widest px-6 py-2 rounded-lg transition-all flex items-center gap-2 ${
                  activeTab === 'creators'
                    ? 'bg-eg text-dark font-bold shadow-eg-sm'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                ✦ CREATORS
              </button>
            </div>

            {/* Time Period Selector */}
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-dark-300/80 border border-eg/10 self-start sm:self-auto">
              {(settings?.all_time_enabled ?? true) && (
                <button
                  id="period-all-time"
                  onClick={() => setActivePeriod('all_time')}
                  className={`font-mono-custom text-[11px] tracking-wider px-3.5 py-1.5 rounded-lg transition-all ${
                    activePeriod === 'all_time'
                      ? 'bg-white/15 text-white font-semibold border border-white/20'
                      : 'text-white/40 hover:text-white'
                  }`}
                >
                  ALL TIME
                </button>
              )}
              {(settings?.monthly_enabled ?? true) && (
                <button
                  id="period-monthly"
                  onClick={() => setActivePeriod('monthly')}
                  className={`font-mono-custom text-[11px] tracking-wider px-3.5 py-1.5 rounded-lg transition-all ${
                    activePeriod === 'monthly'
                      ? 'bg-white/15 text-white font-semibold border border-white/20'
                      : 'text-white/40 hover:text-white'
                  }`}
                >
                  MONTHLY
                </button>
              )}
              {(settings?.weekly_enabled ?? true) && (
                <button
                  id="period-weekly"
                  onClick={() => setActivePeriod('weekly')}
                  className={`font-mono-custom text-[11px] tracking-wider px-3.5 py-1.5 rounded-lg transition-all ${
                    activePeriod === 'weekly'
                      ? 'bg-white/15 text-white font-semibold border border-white/20'
                      : 'text-white/40 hover:text-white'
                  }`}
                >
                  WEEKLY
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Main Content Area ───────────────────────────────────── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-10">
        
        {/* Access Restricted Screen */}
        {!isVisibilityAllowed() ? (
          <div className="glass rounded-2xl p-12 border border-eg/20 text-center max-w-2xl mx-auto space-y-6">
            <div className="w-16 h-16 rounded-full border border-eg/40 bg-eg/10 text-eg mx-auto flex items-center justify-center font-mono-custom text-2xl">
              🔒
            </div>
            <div className="space-y-2">
              <h2 className="font-display text-2xl font-bold text-white uppercase tracking-wider">
                ACCESS RESTRICTED
              </h2>
              <p className="font-mono-custom text-xs text-white/60 leading-relaxed max-w-md mx-auto">
                {settings?.visibility === 'creators_only'
                  ? 'This leaderboard is exclusively accessible to verified ISOMER Creators and Admins.'
                  : settings?.visibility === 'admins_only'
                  ? 'This leaderboard is currently in administrative review mode.'
                  : 'The community leaderboard is temporarily offline.'}
              </p>
            </div>
            {settings?.visibility === 'creators_only' && !userId && (
              <div className="pt-2 flex justify-center gap-4">
                <Link to="/login" className="btn-primary text-xs px-6 py-2 font-mono-custom">
                  Sign In as Creator
                </Link>
                <Link to="/apply-creator" className="btn-outline text-xs px-6 py-2 font-mono-custom">
                  Apply for Creator
                </Link>
              </div>
            )}
          </div>
        ) : loading || settingsLoading ? (
          /* Loading State */
          <div className="py-20 flex flex-col items-center justify-center gap-4">
            <div className="w-10 h-10 rounded-full border-2 border-eg/30 border-t-eg animate-spin" />
            <span className="font-mono-custom text-xs tracking-widest text-eg/70 uppercase">
              CALCULATING LEADERBOARD METRICS...
            </span>
          </div>
        ) : error ? (
          /* Error State */
          <div className="glass rounded-2xl p-8 border border-red-500/30 text-center space-y-4 max-w-xl mx-auto">
            <p className="font-mono-custom text-xs text-red-400">{error}</p>
            <button onClick={() => refetch()} className="btn-outline text-xs py-1.5 px-4">
              Try Again
            </button>
          </div>
        ) : isUnpublished || entries.length === 0 ? (
          /* Unpublished / Empty State */
          <div className="glass rounded-2xl p-12 border border-white/10 text-center max-w-xl mx-auto space-y-4">
            <div className="w-12 h-12 rounded-full border border-white/15 bg-dark-200/60 text-white/40 mx-auto flex items-center justify-center font-mono-custom text-xl">
              ◈
            </div>
            <h3 className="font-display text-xl font-bold text-white uppercase tracking-wider">
              RANKINGS CURRENTLY IN PREPARATION
            </h3>
            <p className="font-mono-custom text-xs text-white/50 leading-relaxed">
              The official snapshot for this period has not yet been published by the administration. Check back soon!
            </p>
          </div>
        ) : (
          /* Rankings Render */
          <div className="space-y-12">
            
            {/* ── TOP 3 SPOTLIGHT CARDS ─────────────────────────── */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 font-mono-custom text-xs text-eg tracking-widest uppercase font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-eg" />
                TOP CONTRIBUTORS & ACHIEVEMENTS
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {topThree.map((entry) => {
                  const isFirst = entry.rank === 1;
                  const isSecond = entry.rank === 2;

                  if (activeTab === 'projects') {
                    const meta = entry.metadata as ProjectLeaderboardMetadata;
                    return (
                      <div
                        key={entry.id}
                        className={`group relative glass rounded-2xl overflow-hidden border transition-all duration-300 flex flex-col justify-between ${
                          isFirst
                            ? 'border-eg/50 shadow-eg-sm bg-gradient-to-b from-dark-200/90 via-dark-200/70 to-eg/10 md:-translate-y-2'
                            : isSecond
                            ? 'border-white/20 hover:border-eg/40 bg-dark-200/60'
                            : 'border-white/15 hover:border-eg/30 bg-dark-200/50'
                        }`}
                      >
                        {/* Rank Badge Header */}
                        <div className="p-4 pb-0 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`font-display text-2xl font-bold tracking-tight ${
                              isFirst ? 'text-eg' : 'text-white/80'
                            }`}>
                              {formatRank(entry.rank)}
                            </span>
                            {isFirst && (
                              <span className="font-mono-custom text-[9px] tracking-widest uppercase bg-eg text-dark px-2 py-0.5 rounded font-bold">
                                LEADER
                              </span>
                            )}
                          </div>

                          <div className="font-mono-custom text-xs font-bold text-eg bg-dark/60 px-3 py-1 rounded-lg border border-eg/20">
                            {Number(entry.score).toLocaleString()} PTS
                          </div>
                        </div>

                        {/* Thumbnail & Info */}
                        <div className="p-4 space-y-4">
                          <Link
                            to={`/projects/${meta.slug || ''}`}
                            className="block relative aspect-video rounded-xl overflow-hidden border border-white/10 group-hover:border-eg/40 transition-colors bg-dark-300"
                          >
                            {meta.thumbnail_url ? (
                              <img
                                src={meta.thumbnail_url}
                                alt={meta.title || 'Project thumbnail'}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                loading="lazy"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center font-mono-custom text-xs text-white/30">
                                NO THUMBNAIL
                              </div>
                            )}
                            <div className="absolute inset-0 bg-dark/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <span className="font-mono-custom text-[11px] text-eg border border-eg/60 px-3 py-1 rounded-lg bg-dark/90 tracking-wider">
                                VIEW PROJECT ↗
                              </span>
                            </div>
                          </Link>

                          <div className="space-y-1.5">
                            <Link
                              to={`/projects/${meta.slug || ''}`}
                              className="font-display text-base font-bold text-white group-hover:text-eg transition-colors line-clamp-1 block"
                            >
                              {meta.title || 'Untitled Project'}
                            </Link>

                            <div className="flex items-center gap-2 text-xs text-white/60 font-mono-custom">
                              <span>by</span>
                              {meta.created_by ? (
                                <Link
                                  to={`/profile/${meta.created_by}`}
                                  className="text-white hover:text-eg transition-colors flex items-center gap-1.5 font-semibold"
                                >
                                  {meta.creator_avatar && (
                                    <img
                                      src={meta.creator_avatar}
                                      alt={meta.creator_name || ''}
                                      className="w-4 h-4 rounded-full object-cover border border-white/20"
                                    />
                                  )}
                                  <span>{meta.creator_name || 'ISOMER Creator'}</span>
                                </Link>
                              ) : (
                                <span>ISOMER Creator</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Metrics Footer */}
                        <div className="px-4 py-3 border-t border-white/5 bg-dark-300/40 flex items-center justify-between text-xs font-mono-custom text-white/50">
                          <div className="flex items-center gap-4">
                            <span className="flex items-center gap-1 text-white/70">
                              <span className="text-red-400">♥</span> {entry.likes}
                            </span>
                            <span className="flex items-center gap-1 text-white/70">
                              <span className="text-blue-400">💬</span> {entry.comments}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 text-[10px] text-white/40">
                            {meta.github_bonus && <span title="GitHub Bonus Included">🐙 GH+</span>}
                            {meta.gallery_bonus && <span title="Gallery Media Included">📷 GAL+</span>}
                          </div>
                        </div>
                      </div>
                    );
                  } else {
                    const meta = entry.metadata as CreatorLeaderboardMetadata;
                    return (
                      <div
                        key={entry.id}
                        className={`group relative glass rounded-2xl overflow-hidden border transition-all duration-300 flex flex-col justify-between p-5 space-y-4 ${
                          isFirst
                            ? 'border-eg/50 shadow-eg-sm bg-gradient-to-b from-dark-200/90 via-dark-200/70 to-eg/10 md:-translate-y-2'
                            : isSecond
                            ? 'border-white/20 hover:border-eg/40 bg-dark-200/60'
                            : 'border-white/15 hover:border-eg/30 bg-dark-200/50'
                        }`}
                      >
                        {/* Header */}
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <span className={`font-display text-2xl font-bold ${
                              isFirst ? 'text-eg' : 'text-white/80'
                            }`}>
                              {formatRank(entry.rank)}
                            </span>
                            
                            <Link to={`/profile/${entry.entity_id}`} className="block relative">
                              {meta.creator_avatar ? (
                                <img
                                  src={meta.creator_avatar}
                                  alt={meta.creator_name}
                                  className="w-12 h-12 rounded-xl object-cover border border-eg/30 group-hover:border-eg transition-colors"
                                />
                              ) : (
                                <div className="w-12 h-12 rounded-xl bg-dark-300 border border-white/15 flex items-center justify-center font-mono-custom text-sm text-eg font-bold">
                                  {meta.creator_name?.charAt(0) || 'C'}
                                </div>
                              )}
                            </Link>

                            <div>
                              <Link
                                to={`/profile/${entry.entity_id}`}
                                className="font-display text-base font-bold text-white group-hover:text-eg transition-colors block line-clamp-1"
                              >
                                {meta.creator_name}
                              </Link>
                              <span className="font-mono-custom text-[10px] text-white/40 uppercase tracking-wider">
                                VERIFIED CREATOR
                              </span>
                            </div>
                          </div>

                          <div className="font-mono-custom text-xs font-bold text-eg bg-dark/60 px-3 py-1 rounded-lg border border-eg/20">
                            {Number(entry.score).toLocaleString()} PTS
                          </div>
                        </div>

                        {/* Details */}
                        <div className="space-y-3 pt-1">
                          <div className="grid grid-cols-2 gap-2 text-center">
                            <div className="p-2.5 rounded-xl bg-dark-300/50 border border-white/5">
                              <span className="block font-mono-custom text-[10px] text-white/40 uppercase">PROJECTS</span>
                              <span className="font-mono-custom text-sm font-bold text-white">{entry.projects_count}</span>
                            </div>
                            <div className="p-2.5 rounded-xl bg-dark-300/50 border border-white/5">
                              <span className="block font-mono-custom text-[10px] text-white/40 uppercase">LIKES REC'D</span>
                              <span className="font-mono-custom text-sm font-bold text-white">{entry.likes}</span>
                            </div>
                          </div>

                          {meta.top_project_title && (
                            <div className="font-mono-custom text-[11px] text-white/60 p-2.5 rounded-xl bg-dark-300/30 border border-white/5 flex items-center justify-between gap-2">
                              <span className="text-white/40 uppercase text-[10px]">TOP WORK:</span>
                              <Link
                                to={`/projects/${meta.top_project_slug || ''}`}
                                className="text-eg hover:underline font-semibold truncate max-w-[180px]"
                              >
                                {meta.top_project_title} ↗
                              </Link>
                            </div>
                          )}
                        </div>

                        {/* Footer */}
                        <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs font-mono-custom">
                          <span className="text-white/40 text-[10px] uppercase">
                            ACTIVITY SCORE: <span className="text-white font-semibold">{entry.activity_score}</span>
                          </span>
                          <Link
                            to={`/profile/${entry.entity_id}`}
                            className="text-eg hover:underline text-[11px]"
                          >
                            View Profile →
                          </Link>
                        </div>
                      </div>
                    );
                  }
                })}
              </div>
            </div>

            {/* ── REMAINING ENTRIES TABLE (04+) ──────────────────── */}
            {remainingEntries.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 font-mono-custom text-xs text-white/50 tracking-widest uppercase font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-white/40" />
                  RANKINGS 04 – {formatRank(entries.length)}
                </div>

                <div className="glass rounded-2xl border border-white/10 overflow-hidden divide-y divide-white/5">
                  {remainingEntries.map((entry) => {
                    if (activeTab === 'projects') {
                      const meta = entry.metadata as ProjectLeaderboardMetadata;
                      return (
                        <div
                          key={entry.id}
                          className="p-4 sm:px-6 flex items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors flex-wrap sm:flex-nowrap"
                        >
                          {/* Rank + Thumbnail + Title */}
                          <div className="flex items-center gap-4 min-w-0">
                            <span className="font-display text-lg sm:text-xl font-bold text-white/40 min-w-[28px]">
                              {formatRank(entry.rank)}
                            </span>

                            <Link
                              to={`/projects/${meta.slug || ''}`}
                              className="w-14 h-10 sm:w-16 sm:h-12 rounded-lg overflow-hidden border border-white/10 flex-shrink-0 bg-dark-300"
                            >
                              {meta.thumbnail_url ? (
                                <img
                                  src={meta.thumbnail_url}
                                  alt={meta.title || ''}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-[9px] font-mono-custom text-white/20">
                                  N/A
                                </div>
                              )}
                            </Link>

                            <div className="min-w-0">
                              <Link
                                to={`/projects/${meta.slug || ''}`}
                                className="font-display text-sm sm:text-base font-bold text-white hover:text-eg transition-colors block truncate"
                              >
                                {meta.title}
                              </Link>
                              <div className="font-mono-custom text-xs text-white/50 flex items-center gap-1.5 truncate">
                                <span>by</span>
                                {meta.created_by ? (
                                  <Link
                                    to={`/profile/${meta.created_by}`}
                                    className="hover:text-eg transition-colors truncate"
                                  >
                                    {meta.creator_name || 'ISOMER Creator'}
                                  </Link>
                                ) : (
                                  <span>ISOMER Creator</span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Stats + Score */}
                          <div className="flex items-center gap-6 sm:gap-8 flex-shrink-0 ml-auto sm:ml-0">
                            <div className="hidden sm:flex items-center gap-4 text-xs font-mono-custom text-white/60">
                              <span className="flex items-center gap-1">
                                <span className="text-red-400">♥</span> {entry.likes}
                              </span>
                              <span className="flex items-center gap-1">
                                <span className="text-blue-400">💬</span> {entry.comments}
                              </span>
                            </div>

                            <div className="text-right">
                              <div className="font-mono-custom text-sm sm:text-base font-bold text-eg">
                                {Number(entry.score).toLocaleString()} <span className="text-[10px] text-white/40">PTS</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    } else {
                      const meta = entry.metadata as CreatorLeaderboardMetadata;
                      return (
                        <div
                          key={entry.id}
                          className="p-4 sm:px-6 flex items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors flex-wrap sm:flex-nowrap"
                        >
                          {/* Rank + Avatar + Name */}
                          <div className="flex items-center gap-4 min-w-0">
                            <span className="font-display text-lg sm:text-xl font-bold text-white/40 min-w-[28px]">
                              {formatRank(entry.rank)}
                            </span>

                            <Link
                              to={`/profile/${entry.entity_id}`}
                              className="w-10 h-10 rounded-xl overflow-hidden border border-white/15 flex-shrink-0 bg-dark-300 flex items-center justify-center"
                            >
                              {meta.creator_avatar ? (
                                <img
                                  src={meta.creator_avatar}
                                  alt={meta.creator_name}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                />
                              ) : (
                                <span className="font-mono-custom text-xs text-eg font-bold">
                                  {meta.creator_name?.charAt(0) || 'C'}
                                </span>
                              )}
                            </Link>

                            <div className="min-w-0">
                              <Link
                                to={`/profile/${entry.entity_id}`}
                                className="font-display text-sm sm:text-base font-bold text-white hover:text-eg transition-colors block truncate"
                              >
                                {meta.creator_name}
                              </Link>
                              {meta.top_project_title && (
                                <span className="font-mono-custom text-[11px] text-white/40 block truncate">
                                  Top: {meta.top_project_title}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Stats + Score */}
                          <div className="flex items-center gap-6 sm:gap-8 flex-shrink-0 ml-auto sm:ml-0">
                            <div className="hidden md:flex items-center gap-4 text-xs font-mono-custom text-white/60">
                              <span>{entry.projects_count} projects</span>
                              <span>·</span>
                              <span>{entry.likes} likes</span>
                            </div>

                            <div className="text-right">
                              <div className="font-mono-custom text-sm sm:text-base font-bold text-eg">
                                {Number(entry.score).toLocaleString()} <span className="text-[10px] text-white/40">PTS</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    }
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="border-t border-eg/10 py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <p className="font-mono-custom text-[10px] tracking-widest text-white/30 uppercase">
            © 2026 ISOMER LAB. All rights reserved.
          </p>
          <p className="font-mono-custom text-[10px] tracking-widest text-eg/60 uppercase font-mono-custom text-xs">
            DETERMINISTIC RANKING ENGINE
          </p>
        </div>
      </footer>
    </div>
  );
};

export default LeaderboardPage;

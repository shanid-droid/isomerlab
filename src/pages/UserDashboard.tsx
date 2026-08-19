import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useUserProfile, useCreatorApplication } from '../lib/hooks';
import { useUserDashboardData } from '../lib/userDashboardHooks';
import { ArrowRight } from '../components/ui';
import { UserWorkspaceHeader } from '../components/ui/UserWorkspaceHeader';
import { ProjectMiniCard, formatRelativeTime } from '../components/ui/ProjectMiniCard';
import { DashboardSkeleton } from '../components/ui/Skeleton';
import { logAuthEvent } from '../lib/activityLog';
import type { CreatorApplicationStatus } from '../lib/types';
import {
  isAdminRole,
  formatRoleLabel,
  resolveUserRole,
} from '../lib/roles';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isValidUUID = (v?: string | null): v is string => !!v && UUID_REGEX.test(v);

function getInitials(name: string | null | undefined, email: string | null | undefined) {
  if (name?.trim()) {
    const parts = name.trim().split(' ');
    return parts.length >= 2
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : name.substring(0, 2).toUpperCase();
  }
  if (email?.trim()) return email.substring(0, 2).toUpperCase();
  return 'U';
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="glass-dark rounded-xl p-4 border border-eg/10 hover:border-eg/25 transition-colors">
      <p className="font-mono-custom text-[10px] tracking-widest text-white/40 uppercase mb-1">{label}</p>
      <p className="font-display text-xl font-bold text-white tabular-nums">{value}</p>
      {sub && <p className="font-mono-custom text-[10px] text-white/30 mt-0.5">{sub}</p>}
    </div>
  );
}

function CreatorStatusBanner({
  status,
  rejectionReason,
}: {
  status: CreatorApplicationStatus | 'none';
  rejectionReason?: string | null;
}) {
  if (status === 'none') {
    return (
      <div className="glass rounded-2xl p-5 sm:p-6 border border-purple-500/25 bg-purple-500/5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="font-mono-custom text-[10px] tracking-widest text-purple-400 uppercase mb-1">Become a Creator</p>
            <h2 className="font-display text-lg font-bold text-white">Share your work with the ISOMER community</h2>
            <p className="font-sans text-xs text-white/50 mt-1 max-w-md">
              Apply to publish projects, join the creator leaderboard, and inspire what comes next.
            </p>
          </div>
          <Link
            to="/apply-creator"
            className="btn-outline py-2.5 px-5 text-xs flex items-center gap-2 border-purple-500/40 text-purple-300 hover:bg-purple-500/10 flex-shrink-0 self-start sm:self-center"
          >
            START APPLICATION <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    );
  }

  if (status === 'pending') {
    return (
      <div className="glass rounded-2xl p-5 sm:p-6 border border-amber-500/30 bg-amber-500/5">
        <p className="font-mono-custom text-[10px] tracking-widest text-amber-400 uppercase mb-1">Application Under Review</p>
        <h2 className="font-display text-lg font-bold text-white">Your creator application has been received</h2>
        <p className="font-sans text-xs text-white/50 mt-1">
          We&apos;ll notify you once your application has been reviewed. This usually takes a few days.
        </p>
      </div>
    );
  }

  if (status === 'approved') {
    return (
      <div className="glass rounded-2xl p-5 sm:p-6 border border-eg/30 bg-eg/5">
        <p className="font-mono-custom text-[10px] tracking-widest text-eg uppercase mb-1">You&apos;re In</p>
        <h2 className="font-display text-lg font-bold text-white">Your creator account is ready</h2>
        <p className="font-sans text-xs text-white/50 mt-1 mb-4">
          Head to your creator dashboard to publish your first project.
        </p>
        <Link to="/creator" className="btn-primary py-2 px-5 text-xs inline-flex items-center gap-2">
          OPEN CREATOR DASHBOARD <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl p-5 sm:p-6 border border-red-500/25 bg-red-500/5">
      <p className="font-mono-custom text-[10px] tracking-widest text-red-400 uppercase mb-1">Application Not Approved</p>
      <h2 className="font-display text-lg font-bold text-white">Your previous application was not approved</h2>
      {rejectionReason && (
        <p className="font-sans text-xs text-white/55 mt-2 leading-relaxed border-l-2 border-red-500/40 pl-3">
          {rejectionReason}
        </p>
      )}
      <Link
        to="/apply-creator"
        className="mt-4 btn-outline py-2 px-5 text-xs inline-flex items-center gap-2"
      >
        SUBMIT NEW APPLICATION <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
}

const UserDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { profile, loading: profileLoading, error: profileError } = useUserProfile();
  const { application, loading: appLoading } = useCreatorApplication();
  const { stats, likedProjects, recentComments, activity, loading: dashLoading, error: dashError, refresh } =
    useUserDashboardData();

  const loading = profileLoading || appLoading || dashLoading;
  const effectiveRole = resolveUserRole(profile?.id, profile?.role);
  const isUserAdmin = isAdminRole(effectiveRole, profile?.id);
  const isUserCreator = profile?.role === 'creator';
  const isNormalUser = profile?.role === 'user';

  const handleLogout = async () => {
    await logAuthEvent('user_logout', { email: profile?.email ?? undefined, method: 'user_dashboard' });
    await supabase.auth.signOut();
    navigate('/login', { replace: true });
  };

  const creatorStatus: CreatorApplicationStatus | 'none' = isUserCreator
    ? 'approved'
    : application?.status ?? 'none';

  const welcomeName = profile?.full_name?.split(' ')[0] || 'there';

  if (loading) {
    return (
      <div className="min-h-screen bg-dark bg-circuit text-white flex flex-col">
        <UserWorkspaceHeader badge="MY WORKSPACE" />
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8">
          <DashboardSkeleton />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark bg-circuit text-white flex flex-col selection:bg-eg/30">
      <UserWorkspaceHeader
        badge="MY WORKSPACE"
        backTo={{ label: '← Site', path: '/' }}
        actions={
          <>
            {isUserAdmin && (
              <Link
                to="/admin"
                className="font-mono-custom text-xs text-eg hover:bg-eg/10 transition-colors px-2.5 py-1.5 rounded-lg border border-eg/30 hidden sm:inline-flex"
              >
                Admin
              </Link>
            )}
            {isUserCreator && (
              <Link
                to="/creator"
                className="font-mono-custom text-xs text-purple-400 hover:bg-purple-500/10 transition-colors px-2.5 py-1.5 rounded-lg border border-purple-500/30 hidden sm:inline-flex"
              >
                Creator
              </Link>
            )}
            <button
              type="button"
              onClick={handleLogout}
              className="font-mono-custom text-xs text-white/50 hover:text-red-400 transition-colors px-2.5 py-1.5 rounded-lg border border-white/10"
            >
              Logout
            </button>
          </>
        }
      />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 space-y-8">
        {(profileError || dashError) && (
          <div className="p-4 rounded-xl border border-red-500/40 bg-red-500/10 flex items-center justify-between gap-4">
            <p className="font-mono-custom text-xs text-red-300">
              {profileError || dashError}
            </p>
            <button type="button" onClick={() => refresh()} className="btn-outline py-1.5 px-3 text-[10px] flex-shrink-0">
              Retry
            </button>
          </div>
        )}

        {/* Header strip */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="relative flex-shrink-0">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt=""
                className="w-16 h-16 rounded-xl object-cover border-2 border-eg/30"
              />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-dark-300 border-2 border-eg/30 flex items-center justify-center">
                <span className="font-display text-xl font-bold text-eg">
                  {getInitials(profile?.full_name, profile?.email)}
                </span>
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-mono-custom text-[10px] tracking-widest text-eg/70 uppercase">
              Welcome back
            </p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-wide text-white truncate">
              {profile?.full_name || 'Member'}
            </h1>
            <p className="font-sans text-sm text-white/45 mt-0.5">
              Hi {welcomeName} — your personal ISOMER workspace
            </p>
          </div>
          <div className="flex flex-wrap gap-2 sm:flex-shrink-0">
            <Link to="/profile/edit" className="btn-primary py-2 px-4 text-xs">
              Edit Profile
            </Link>
            {isValidUUID(profile?.id) && (
              <Link to={`/profile/${profile!.id}`} className="btn-outline py-2 px-4 text-xs">
                Public Profile
              </Link>
            )}
          </div>
        </div>

        {/* Overview stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <StatCard label="Projects Liked" value={stats.likesCount} />
          <StatCard label="Comments" value={stats.commentsCount} />
          <StatCard
            label="Role"
            value={formatRoleLabel(effectiveRole, profile?.id).split(' ')[0]}
            sub={formatRoleLabel(effectiveRole, profile?.id)}
          />
          <StatCard
            label="Member Since"
            value={
              profile?.created_at
                ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                : '—'
            }
          />
        </div>

        {/* Creator status — only for non-creator/non-admin users */}
        {isNormalUser && (
          <CreatorStatusBanner
            status={creatorStatus}
            rejectionReason={application?.status === 'rejected' ? application.rejection_reason : null}
          />
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Activity feed */}
          <section className="lg:col-span-1 glass rounded-2xl p-5 border border-eg/15 space-y-4">
            <h2 className="font-mono-custom text-xs tracking-widest text-white/50 uppercase flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-eg" />
              Recent Activity
            </h2>
            {activity.length === 0 ? (
              <div className="py-8 text-center">
                <p className="font-mono-custom text-[10px] tracking-widest text-white/30 uppercase">Nothing here yet</p>
                <p className="font-sans text-xs text-white/40 mt-1">Like or comment on projects to see activity.</p>
                <Link to="/#projects" className="inline-block mt-3 text-eg font-mono-custom text-xs hover:underline">
                  Browse projects →
                </Link>
              </div>
            ) : (
              <ul className="space-y-3">
                {activity.map((item) => (
                  <li key={item.id}>
                    <Link
                      to={`/projects/${item.projectSlug}`}
                      className="block p-3 rounded-xl border border-white/5 bg-dark-200/40 hover:border-eg/25 hover:bg-dark-200/70 transition-all group"
                    >
                      <p className="font-mono-custom text-[10px] text-eg/80 uppercase tracking-wider">
                        {item.type === 'like' ? 'Liked' : 'Commented on'}
                      </p>
                      <p className="font-display text-xs font-semibold text-white group-hover:text-eg transition-colors truncate mt-0.5">
                        {item.projectTitle}
                      </p>
                      {item.preview && (
                        <p className="font-sans text-[11px] text-white/45 mt-1 line-clamp-2 italic">
                          &ldquo;{item.preview}&rdquo;
                        </p>
                      )}
                      <p className="font-mono-custom text-[10px] text-white/30 mt-1.5">
                        {formatRelativeTime(item.createdAt)}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Liked projects + comments */}
          <div className="lg:col-span-2 space-y-6">
            {/* Liked projects */}
            <section className="glass rounded-2xl p-5 border border-eg/15 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-mono-custom text-xs tracking-widest text-white/50 uppercase flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-eg" />
                  Liked Projects
                </h2>
                {stats.likesCount > 6 && (
                  <span className="font-mono-custom text-[10px] text-white/30">
                    Showing 6 of {stats.likesCount}
                  </span>
                )}
              </div>
              {likedProjects.length === 0 ? (
                <div className="py-10 text-center rounded-xl border border-dashed border-white/10">
                  <p className="font-mono-custom text-[10px] tracking-widest text-white/30 uppercase">Nothing here yet</p>
                  <p className="font-sans text-xs text-white/40 mt-1">Your liked projects will appear here.</p>
                  <Link to="/#projects" className="inline-block mt-3 btn-outline py-2 px-4 text-xs">
                    Discover Projects
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {likedProjects.map((p, i) => (
                    <ProjectMiniCard key={p.id} project={p} index={i} />
                  ))}
                </div>
              )}
            </section>

            {/* Recent comments */}
            {stats.commentsCount > 0 && (
              <section className="glass rounded-2xl p-5 border border-eg/15 space-y-4">
                <h2 className="font-mono-custom text-xs tracking-widest text-white/50 uppercase flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-eg" />
                  Your Comments
                </h2>
                <ul className="space-y-3">
                  {recentComments.map((c) => (
                    <li key={c.id}>
                      {c.project_slug ? (
                        <Link
                          to={`/projects/${c.project_slug}#comments-section`}
                          className="block p-4 rounded-xl border border-white/5 bg-dark-200/40 hover:border-eg/25 transition-all group"
                        >
                          <p className="font-mono-custom text-[10px] text-white/40 uppercase tracking-wider">
                            on {c.project_title || 'Project'}
                          </p>
                          <p className="font-sans text-sm text-white/75 mt-1 line-clamp-2 group-hover:text-white transition-colors">
                            &ldquo;{c.content}&rdquo;
                          </p>
                          <p className="font-mono-custom text-[10px] text-white/30 mt-2">
                            {formatRelativeTime(c.created_at)}
                          </p>
                        </Link>
                      ) : (
                        <div className="p-4 rounded-xl border border-white/5 bg-dark-200/40">
                          <p className="font-sans text-sm text-white/75 line-clamp-2">&ldquo;{c.content}&rdquo;</p>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </div>

        {/* Quick links */}
        <div className="flex flex-wrap gap-3 pt-2 border-t border-eg/10">
          <Link to="/notifications" className="font-mono-custom text-xs text-white/50 hover:text-eg transition-colors px-3 py-2 rounded-lg border border-white/10 hover:border-eg/30">
            Notifications →
          </Link>
          <Link to="/leaderboard" className="font-mono-custom text-xs text-white/50 hover:text-eg transition-colors px-3 py-2 rounded-lg border border-white/10 hover:border-eg/30">
            Leaderboard →
          </Link>
          <Link to="/#projects" className="font-mono-custom text-xs text-white/50 hover:text-eg transition-colors px-3 py-2 rounded-lg border border-white/10 hover:border-eg/30">
            Browse Projects →
          </Link>
        </div>
      </main>
    </div>
  );
};

export default UserDashboard;

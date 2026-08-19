import React, { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { isAccessDeniedError } from '../../lib/activityLog';
import ActivityLogsPanel from './ActivityLogsPanel';

interface ControlCenterOverviewProps {
  isOwner: boolean;
  userName: string | null;
  onNavigate: (tab: string) => void;
}

interface PlatformStats {
  projects: number;
  creators: number;
  users: number;
  comments: number;
  unreadMessages: number;
  pendingApplications: number;
}

/* ── Animated count-up number ─────────────────────────────────── */
const CountUp: React.FC<{ value: number; suffix?: string }> = ({ value, suffix = '' }) => {
  const [display, setDisplay] = useState(0);
  const prevRef = useRef(0);

  useEffect(() => {
    const start = prevRef.current;
    const delta = value - start;
    if (delta === 0) return;

    const duration = 900;
    const steps = 40;
    const stepTime = duration / steps;
    let step = 0;

    const id = setInterval(() => {
      step++;
      const pct = step / steps;
      const eased = 1 - Math.pow(1 - pct, 3);
      setDisplay(Math.round(start + delta * eased));
      if (step >= steps) {
        setDisplay(value);
        prevRef.current = value;
        clearInterval(id);
      }
    }, stepTime);

    return () => clearInterval(id);
  }, [value]);

  return (
    <span>
      {display}
      {suffix}
    </span>
  );
};

/* ── System status check ─────────────────────────────────────── */
type SystemStatus = 'online' | 'unknown' | 'error';

interface SystemChecks {
  database: SystemStatus;
  storage: SystemStatus;
  auth: SystemStatus;
}

async function checkSystemStatus(): Promise<SystemChecks> {
  const checks: SystemChecks = {
    database: 'unknown',
    storage: 'unknown',
    auth: 'unknown',
  };

  // Database check — lightweight query
  try {
    const { error } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true });
    checks.database = error ? 'error' : 'online';
  } catch {
    checks.database = 'error';
  }

  // Auth check — session presence
  try {
    const { data: { session } } = await supabase.auth.getSession();
    checks.auth = session ? 'online' : 'error';
  } catch {
    checks.auth = 'error';
  }

  // Storage check — list bucket (non-fatal)
  try {
    const { error } = await supabase.storage.from('project-images').list('', { limit: 1 });
    checks.storage = error ? 'unknown' : 'online';
  } catch {
    checks.storage = 'unknown';
  }

  return checks;
}

/* ── Greeting based on time ──────────────────────────────────── */
function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'GOOD MORNING';
  if (h < 17) return 'GOOD AFTERNOON';
  return 'GOOD EVENING';
}

/* ── StatusDot ───────────────────────────────────────────────── */
const StatusDot: React.FC<{ status: SystemStatus }> = ({ status }) => {
  if (status === 'online')
    return <span className="w-2 h-2 rounded-full bg-eg animate-pulse flex-shrink-0" />;
  if (status === 'error')
    return <span className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />;
  return <span className="w-2 h-2 rounded-full bg-white/30 flex-shrink-0" />;
};

const statusLabel: Record<SystemStatus, string> = {
  online: 'ONLINE',
  error: 'ERROR',
  unknown: 'UNKNOWN',
};

const statusColor: Record<SystemStatus, string> = {
  online: 'text-eg',
  error: 'text-red-400',
  unknown: 'text-white/40',
};

/* ── Main component ──────────────────────────────────────────── */
const ControlCenterOverview: React.FC<ControlCenterOverviewProps> = ({
  isOwner,
  userName,
  onNavigate,
}) => {
  const [stats, setStats] = useState<PlatformStats>({
    projects: 0,
    creators: 0,
    users: 0,
    comments: 0,
    unreadMessages: 0,
    pendingApplications: 0,
  });
  const [systemStatus, setSystemStatus] = useState<SystemChecks>({
    database: 'unknown',
    storage: 'unknown',
    auth: 'unknown',
  });
  const [statsLoading, setStatsLoading] = useState(true);
  const [visible, setVisible] = useState(false);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const queries: any[] = [
        supabase.from('projects').select('id', { count: 'exact', head: true }),
        supabase.from('profiles').select('id, role, creator_approved_at', { count: 'exact' }),
        supabase.from('project_comments').select('id', { count: 'exact', head: true }).is('deleted_at', null),
        supabase.from('creator_applications').select('status'),
      ];

      if (isOwner) {
        queries.push(supabase.from('contact_messages').select('status'));
      }

      const [projRes, profRes, commRes, appRes, msgRes] = await Promise.all(queries);

      const profiles = (profRes.data ?? []) as Array<{ role: string; creator_approved_at: string | null }>;
      const creatorCount = profiles.filter(
        (p) => p.role === 'creator' || p.role === 'admin' || p.role === 'owner' || p.creator_approved_at
      ).length;

      const apps = (appRes.data ?? []) as Array<{ status: string }>;
      const pendingApps = apps.filter((a) => a.status === 'pending').length;

      let unreadMsgs = 0;
      if (isOwner && msgRes) {
        const msgs = !isAccessDeniedError(msgRes.error) ? (msgRes.data ?? []) : [];
        unreadMsgs = msgs.filter((m: any) => m.status === 'unread').length;
      }

      setStats({
        projects: projRes.count ?? 0,
        creators: creatorCount,
        users: profRes.count ?? 0,
        comments: commRes.count ?? 0,
        unreadMessages: unreadMsgs,
        pendingApplications: pendingApps,
      });
    } catch {
      /* non-fatal */
    } finally {
      setStatsLoading(false);
    }
  }, [isOwner]);

  useEffect(() => {
    fetchStats();
    checkSystemStatus().then(setSystemStatus);
    // Stagger in
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, [fetchStats]);

  const greeting = getGreeting();
  const displayName = userName
    ? userName.split('@')[0].split(' ')[0].toUpperCase()
    : null;

  const needsAttention = stats.pendingApplications > 0 || stats.unreadMessages > 0;

  return (
    <div className="space-y-10">
      {/* ── 1. Hero Greeting ── */}
      <div
        className={`space-y-2 transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
      >
        <div className="flex items-center gap-2 font-mono-custom text-[11px] tracking-[0.3em] text-eg/70 uppercase">
          <span className="w-1.5 h-1.5 rounded-full bg-eg animate-pulse" />
          ISOMER CONTROL CENTER
        </div>
        <h1 className="font-display font-black text-3xl sm:text-4xl md:text-5xl tracking-tight text-white leading-tight">
          {greeting}
          {displayName ? (
            <>
              ,{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-eg">
                {displayName}.
              </span>
            </>
          ) : (
            '.'
          )}
        </h1>
        <p className="font-mono-custom text-xs text-white/40 tracking-widest uppercase">
          {new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </div>

      {/* ── 2. Platform Metric Strip ── */}
      <div
        className={`transition-all duration-700 delay-100 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
      >
        <div className="flex items-center gap-2 mb-4">
          <span className="w-1 h-1 rounded-full bg-eg/60" />
          <span className="font-mono-custom text-[10px] tracking-[0.3em] text-white/40 uppercase">
            Platform Metrics
          </span>
          <div className="flex-1 h-px bg-white/5" />
          <button
            onClick={fetchStats}
            className="font-mono-custom text-[9px] text-white/30 hover:text-eg transition-colors tracking-wider"
          >
            REFRESH
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-white/5 rounded-2xl overflow-hidden border border-white/5">
          {[
            { label: 'PROJECTS', value: stats.projects, onClick: () => onNavigate('projects'), color: 'text-white' },
            { label: 'CREATORS', value: stats.creators, onClick: () => onNavigate('applications'), color: 'text-eg' },
            { label: 'USERS', value: stats.users, onClick: isOwner ? () => onNavigate('users') : undefined, color: 'text-white' },
            { label: 'COMMENTS', value: stats.comments, onClick: () => onNavigate('comments'), color: 'text-white' },
          ].map((m) => (
            <button
              key={m.label}
              onClick={m.onClick}
              disabled={!m.onClick}
              className={`bg-dark-100/60 p-6 sm:p-8 text-left space-y-2 transition-all ${
                m.onClick ? 'hover:bg-eg/5 cursor-pointer group' : 'cursor-default'
              }`}
            >
              <span className="font-mono-custom text-[10px] tracking-[0.25em] text-white/30 uppercase block">
                {m.label}
              </span>
              <span className={`font-display font-black text-3xl sm:text-4xl ${m.color} block`}>
                {statsLoading ? (
                  <span className="inline-block h-9 w-12 bg-white/10 rounded animate-pulse" />
                ) : (
                  <CountUp value={m.value} />
                )}
              </span>
              {m.onClick && (
                <span className="font-mono-custom text-[9px] text-white/20 group-hover:text-eg transition-colors tracking-wider">
                  VIEW →
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── 3. Two-column: System Status + Attention Required ── */}
      <div
        className={`grid grid-cols-1 lg:grid-cols-2 gap-6 transition-all duration-700 delay-200 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
      >
        {/* System Status */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-1 h-1 rounded-full bg-eg/60" />
            <span className="font-mono-custom text-[10px] tracking-[0.3em] text-white/40 uppercase">
              System Status
            </span>
            <div className="flex-1 h-px bg-white/5" />
          </div>

          <div className="rounded-2xl border border-white/5 bg-dark-100/40 overflow-hidden divide-y divide-white/5">
            {[
              { label: 'DATABASE', status: systemStatus.database },
              { label: 'STORAGE', status: systemStatus.storage },
              { label: 'AUTHENTICATION', status: systemStatus.auth },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between px-5 py-3.5">
                <div className="flex items-center gap-3">
                  <StatusDot status={row.status} />
                  <span className="font-mono-custom text-xs text-white/60 tracking-widest">
                    {row.label}
                  </span>
                </div>
                <span className={`font-mono-custom text-[10px] tracking-widest font-semibold ${statusColor[row.status]}`}>
                  {statusLabel[row.status]}
                </span>
              </div>
            ))}
            {/* API status — determined by whether stats loaded */}
            <div className="flex items-center justify-between px-5 py-3.5">
              <div className="flex items-center gap-3">
                <StatusDot status={statsLoading ? 'unknown' : 'online'} />
                <span className="font-mono-custom text-xs text-white/60 tracking-widest">
                  API
                </span>
              </div>
              <span className={`font-mono-custom text-[10px] tracking-widest font-semibold ${statsLoading ? 'text-white/40' : 'text-eg'}`}>
                {statsLoading ? 'CHECKING' : 'ONLINE'}
              </span>
            </div>
          </div>
        </div>

        {/* Attention Required */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-1 h-1 rounded-full bg-eg/60" />
            <span className="font-mono-custom text-[10px] tracking-[0.3em] text-white/40 uppercase">
              Attention Required
            </span>
            <div className="flex-1 h-px bg-white/5" />
          </div>

          <div className="rounded-2xl border border-white/5 bg-dark-100/40 overflow-hidden">
            {!statsLoading && !needsAttention ? (
              <div className="px-6 py-10 text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-eg/10 border border-eg/30 flex items-center justify-center mx-auto">
                  <span className="text-eg text-lg">✓</span>
                </div>
                <p className="font-mono-custom text-xs text-white/40 tracking-wider uppercase">
                  All clear
                </p>
                <p className="font-sans text-[11px] text-white/25">
                  No pending actions required.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {stats.pendingApplications > 0 && (
                  <button
                    onClick={() => onNavigate('applications')}
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-eg/5 transition-colors group text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-amber-400 text-xs font-bold">{stats.pendingApplications}</span>
                      </div>
                      <div>
                        <p className="font-mono-custom text-xs text-white/80 tracking-wide">
                          CREATOR APPLICATIONS
                        </p>
                        <p className="font-sans text-[11px] text-white/40 mt-0.5">
                          {stats.pendingApplications} pending review
                        </p>
                      </div>
                    </div>
                    <span className="font-mono-custom text-[10px] text-eg opacity-0 group-hover:opacity-100 transition-opacity">
                      REVIEW →
                    </span>
                  </button>
                )}

                {isOwner && stats.unreadMessages > 0 && (
                  <button
                    onClick={() => onNavigate('inbox')}
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-eg/5 transition-colors group text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-blue-400 text-xs font-bold">{stats.unreadMessages}</span>
                      </div>
                      <div>
                        <p className="font-mono-custom text-xs text-white/80 tracking-wide">
                          UNREAD MESSAGES
                        </p>
                        <p className="font-sans text-[11px] text-white/40 mt-0.5">
                          {stats.unreadMessages} new inbox message{stats.unreadMessages !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <span className="font-mono-custom text-[10px] text-eg opacity-0 group-hover:opacity-100 transition-opacity">
                      OPEN →
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── 4. Recent Activity Timeline ── */}
      {isOwner && (
        <div
          className={`transition-all duration-700 delay-300 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
        >
          <div className="flex items-center gap-2 mb-4">
            <span className="w-1 h-1 rounded-full bg-eg/60" />
            <span className="font-mono-custom text-[10px] tracking-[0.3em] text-white/40 uppercase">
              Recent Activity
            </span>
            <div className="flex-1 h-px bg-white/5" />
          </div>
          <div className="rounded-2xl border border-white/5 bg-dark-100/40 p-5">
            <ActivityLogsPanel
              limit={8}
              compact
              onViewAll={() => onNavigate('activity')}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ControlCenterOverview;

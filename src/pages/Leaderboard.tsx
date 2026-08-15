import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { IsomerLogo } from '../components/ui';
import { supabase } from '../lib/supabase';
import {
  useLeaderboard,
  useLeaderboardAccess,
  useMyLeaderboardPosition,
} from '../lib/leaderboardHooks';
import { ProjectRankCard } from '../components/leaderboard/ProjectRankCard';
import { CreatorRankCard } from '../components/leaderboard/CreatorRankCard';
import { YourPositionCard } from '../components/leaderboard/YourPositionCard';
import type { LeaderboardPeriod, LeaderboardType } from '../lib/types';

const PERIOD_LABELS: Record<LeaderboardPeriod, string> = {
  all_time: 'ALL TIME',
  monthly: 'MONTH',
  weekly: 'WEEK',
};

const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen bg-dark bg-circuit text-white flex flex-col overflow-x-hidden selection:bg-eg/30">
    <header className="glass-dark border-b border-eg/10 py-4 sticky top-0 z-40 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-4">
        <Link to="/"><IsomerLogo size="sm" /></Link>
        <Link
          to="/"
          className="font-mono-custom text-[11px] tracking-widest text-white/50 hover:text-eg transition-colors"
        >
          ← BACK
        </Link>
      </div>
    </header>
    <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-10">{children}</main>
  </div>
);

const StateMessage: React.FC<{ title: string; body: string }> = ({ title, body }) => (
  <div className="flex flex-col items-center justify-center text-center gap-3 py-24">
    <div className="w-12 h-12 rounded-full border border-eg/25 bg-eg/5 flex items-center justify-center">
      <span className="w-2 h-2 rounded-full bg-eg/70" />
    </div>
    <h2 className="font-display text-base tracking-widest uppercase text-white">{title}</h2>
    <p className="font-mono-custom text-xs text-white/45 max-w-sm">{body}</p>
  </div>
);

const Leaderboard: React.FC = () => {
  const { access, loading: accessLoading } = useLeaderboardAccess();
  const [tab, setTab] = useState<LeaderboardType>('project');
  const [period, setPeriod] = useState<LeaderboardPeriod>('all_time');
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!cancelled) setHasSession(!!session?.user);
    });
    return () => { cancelled = true; };
  }, []);

  const periods = useMemo(() => {
    const enabled = access?.periods;
    return (['all_time', 'monthly', 'weekly'] as LeaderboardPeriod[]).filter((p) => enabled?.[p]);
  }, [access]);

  useEffect(() => {
    if (periods.length > 0 && !periods.includes(period)) setPeriod(periods[0]);
  }, [periods, period]);

  useEffect(() => {
    if (access && !access.project_enabled && access.creator_enabled) setTab('creator');
  }, [access]);

  const canView = !!access?.can_view;
  const { result, entries, loading } = useLeaderboard(tab, period);
  const myPosition = useMyLeaderboardPosition(period, canView && hasSession);

  if (accessLoading) {
    return <Shell><StateMessage title="LOADING" body="Fetching community rankings." /></Shell>;
  }

  if (!canView) {
    return (
      <Shell>
        <StateMessage
          title="LEADERBOARD UNAVAILABLE"
          body={
            access?.visibility === 'creators'
              ? 'The leaderboard is currently visible to ISOMER creators only.'
              : access?.visibility === 'admins'
                ? 'The leaderboard is currently restricted to the ISOMER team.'
                : 'The leaderboard is currently disabled.'
          }
        />
      </Shell>
    );
  }

  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);

  return (
    <Shell>
      <div className="mb-8">
        <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-[0.2em] uppercase text-white">
          LEADERBOARD
        </h1>
        <p className="font-mono-custom text-[11px] tracking-widest text-eg/70 mt-1">
          ISOMER COMMUNITY RANKINGS
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-white/10 mb-5 overflow-x-auto">
        {([
          ['project', 'PROJECTS', access?.project_enabled],
          ['creator', 'CREATORS', access?.creator_enabled],
        ] as [LeaderboardType, string, boolean | undefined][])
          .filter(([, , enabled]) => enabled)
          .map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={`font-mono-custom text-[11px] tracking-widest px-4 py-2.5 border-b-2 transition-colors whitespace-nowrap ${
                tab === value
                  ? 'border-eg text-eg'
                  : 'border-transparent text-white/45 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
      </div>

      {/* Period selector */}
      {periods.length > 1 && (
        <div className="flex flex-wrap items-center gap-2 mb-6">
          {periods.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`font-mono-custom text-[10px] tracking-widest px-3 py-1.5 rounded-lg border transition-colors ${
                period === p
                  ? 'border-eg/60 bg-eg/10 text-eg'
                  : 'border-white/10 text-white/45 hover:text-white hover:border-white/25'
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      )}

      {myPosition && tab === 'creator' && (
        <div className="mb-8">
          <YourPositionCard position={myPosition} />
        </div>
      )}

      {loading ? (
        <div className="space-y-2 animate-pulse">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-dark-200/50" />
          ))}
        </div>
      ) : result?.status !== 'published' ? (
        <StateMessage
          title={result?.status === 'disabled' ? 'RANKING DISABLED' : 'RANKINGS NOT PUBLISHED'}
          body={
            result?.status === 'disabled'
              ? 'This ranking is currently switched off.'
              : 'No published ranking is available yet. Check back once the ISOMER team publishes the next snapshot.'
          }
        />
      ) : entries.length === 0 ? (
        <StateMessage title="NO ENTRIES" body="The published snapshot has no qualifying entries for this period." />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {top3.map((entry) =>
              tab === 'project'
                ? <ProjectRankCard key={entry.entity_id} entry={entry} highlight />
                : <CreatorRankCard key={entry.entity_id} entry={entry} highlight />
            )}
          </div>

          {rest.length > 0 && (
            <div className="space-y-2">
              {rest.map((entry) =>
                tab === 'project'
                  ? <ProjectRankCard key={entry.entity_id} entry={entry} />
                  : <CreatorRankCard key={entry.entity_id} entry={entry} />
              )}
            </div>
          )}

          {result.snapshot?.published_at && (
            <p className="font-mono-custom text-[10px] text-white/30 tracking-widest pt-2">
              PUBLISHED {new Date(result.snapshot.published_at).toLocaleString()}
            </p>
          )}
        </div>
      )}
    </Shell>
  );
};

export default Leaderboard;

import React, { useCallback, useState } from 'react';
import {
  generateLeaderboardSnapshot,
  previewLeaderboard,
  publishLeaderboardSnapshot,
  refreshLeaderboard,
  unpublishLeaderboard,
  useLeaderboardHistory,
} from '../../lib/leaderboardHooks';
import { formatRank, formatScore } from '../leaderboard/format';
import type { LeaderboardEntry, LeaderboardPeriod, LeaderboardType } from '../../lib/types';

const TYPES: [LeaderboardType, string][] = [
  ['project', 'PROJECTS'],
  ['creator', 'CREATORS'],
];

const PERIODS: [LeaderboardPeriod, string][] = [
  ['all_time', 'ALL TIME'],
  ['monthly', 'MONTH'],
  ['weekly', 'WEEK'],
];

const errorText = (e: unknown) => (e instanceof Error ? e.message : 'Action failed');

/**
 * Publishing controls — available to every admin.
 * Scoring weights are deliberately absent here; they are owner-only.
 */
export const LeaderboardPublishingPanel: React.FC = () => {
  const [type, setType] = useState<LeaderboardType>('project');
  const [period, setPeriod] = useState<LeaderboardPeriod>('all_time');
  const [preview, setPreview] = useState<LeaderboardEntry[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<null | 'publish' | 'unpublish' | 'refresh'>(null);

  const { history, reload: reloadHistory } = useLeaderboardHistory(true);

  const run = useCallback(async (label: string, action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      await action();
      setStatus(label);
      await reloadHistory();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }, [reloadHistory]);

  const latestDraft = history.find(
    (h) => h.leaderboard_type === type && h.period === period && h.status !== 'published'
  );

  return (
    <div className="space-y-6">
      <div className="glass rounded-xl border border-eg/15 p-5 space-y-4">
        <h3 className="font-display text-sm tracking-widest text-white uppercase">Leaderboard Publishing</h3>

        <div className="flex flex-wrap gap-2">
          {TYPES.map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => { setType(value); setPreview(null); }}
              className={`font-mono-custom text-[10px] tracking-widest px-3 py-1.5 rounded-lg border transition-colors ${
                type === value ? 'border-eg/60 bg-eg/10 text-eg' : 'border-white/10 text-white/50 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
          <span className="w-px bg-white/10 mx-1" />
          {PERIODS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => { setPeriod(value); setPreview(null); }}
              className={`font-mono-custom text-[10px] tracking-widest px-3 py-1.5 rounded-lg border transition-colors ${
                period === value ? 'border-eg/60 bg-eg/10 text-eg' : 'border-white/10 text-white/50 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => run('Snapshot generated.', () => generateLeaderboardSnapshot(type, period))}
            className="font-mono-custom text-[10px] tracking-widest px-4 py-2 rounded-lg border border-white/15 text-white/70 hover:text-white hover:border-white/30 disabled:opacity-40"
          >
            GENERATE SNAPSHOT
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => run('Preview loaded.', async () => setPreview(await previewLeaderboard(type, period)))}
            className="font-mono-custom text-[10px] tracking-widest px-4 py-2 rounded-lg border border-white/15 text-white/70 hover:text-white hover:border-white/30 disabled:opacity-40"
          >
            PREVIEW LIVE RANKINGS
          </button>
          <button
            type="button"
            disabled={busy || !latestDraft}
            onClick={() => setConfirm('publish')}
            className="font-mono-custom text-[10px] tracking-widest px-4 py-2 rounded-lg border border-eg/50 bg-eg/10 text-eg hover:bg-eg/20 disabled:opacity-40"
          >
            PUBLISH LATEST SNAPSHOT
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setConfirm('refresh')}
            className="font-mono-custom text-[10px] tracking-widest px-4 py-2 rounded-lg border border-eg/30 text-eg/80 hover:bg-eg/10 disabled:opacity-40"
          >
            REFRESH &amp; PUBLISH
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setConfirm('unpublish')}
            className="font-mono-custom text-[10px] tracking-widest px-4 py-2 rounded-lg border border-red-500/40 text-red-300 hover:bg-red-500/10 disabled:opacity-40"
          >
            UNPUBLISH
          </button>
        </div>

        {status && <p className="font-mono-custom text-[10px] text-eg">{status}</p>}
        {error && <p className="font-mono-custom text-[10px] text-red-400">{error}</p>}
      </div>

      {confirm && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass rounded-2xl border border-eg/25 p-6 max-w-sm w-full space-y-4">
            <h4 className="font-display text-sm tracking-widest uppercase text-white">
              {confirm === 'unpublish' ? 'Unpublish leaderboard?' : 'Publish leaderboard?'}
            </h4>
            <p className="font-mono-custom text-[11px] text-white/50">
              {confirm === 'unpublish'
                ? `The public ${type} / ${period} ranking will become unavailable immediately.`
                : `The ${type} / ${period} ranking will become publicly visible according to the owner's visibility setting.`}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirm(null)}
                className="font-mono-custom text-[10px] tracking-widest px-4 py-2 rounded-lg border border-white/15 text-white/60"
              >
                CANCEL
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (confirm === 'unpublish') {
                    void run('Leaderboard unpublished.', () => unpublishLeaderboard(type, period));
                  } else if (confirm === 'refresh') {
                    void run('Rankings refreshed and published.', () => refreshLeaderboard(type, period));
                  } else if (latestDraft) {
                    void run('Snapshot published.', () => publishLeaderboardSnapshot(latestDraft.id));
                  }
                }}
                className="font-mono-custom text-[10px] tracking-widest px-4 py-2 rounded-lg border border-eg/50 bg-eg/10 text-eg disabled:opacity-40"
              >
                CONFIRM
              </button>
            </div>
          </div>
        </div>
      )}

      {preview && (
        <div className="glass rounded-xl border border-white/10 p-5">
          <h4 className="font-mono-custom text-[10px] tracking-widest text-white/40 mb-3">
            LIVE PREVIEW — NOT PUBLISHED
          </h4>
          <div className="space-y-1">
            {preview.length === 0 && (
              <p className="font-mono-custom text-[11px] text-white/40">No qualifying entries.</p>
            )}
            {preview.map((e) => (
              <div key={e.entity_id} className="flex items-center gap-3 text-xs font-mono-custom text-white/60 min-w-0">
                <span className="text-eg/70 tabular-nums w-8">{formatRank(e.rank)}</span>
                <span className="truncate flex-1">{e.metadata.title ?? e.metadata.name ?? e.entity_id}</span>
                <span className="tabular-nums text-white/80">{formatScore(e.score)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="glass rounded-xl border border-white/10 p-5">
        <h4 className="font-mono-custom text-[10px] tracking-widest text-white/40 mb-3">PUBLICATION HISTORY</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono-custom text-[11px] text-white/60">
            <thead className="text-white/30">
              <tr>
                <th className="py-1 pr-4">TYPE</th>
                <th className="py-1 pr-4">PERIOD</th>
                <th className="py-1 pr-4">STATUS</th>
                <th className="py-1 pr-4">ENTRIES</th>
                <th className="py-1 pr-4">GENERATED</th>
                <th className="py-1 pr-4">PUBLISHED</th>
                <th className="py-1">BY</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id} className="border-t border-white/5">
                  <td className="py-1.5 pr-4">{h.leaderboard_type}</td>
                  <td className="py-1.5 pr-4">{h.period}</td>
                  <td className={`py-1.5 pr-4 ${h.status === 'published' ? 'text-eg' : ''}`}>{h.status}</td>
                  <td className="py-1.5 pr-4 tabular-nums">{h.entry_count}</td>
                  <td className="py-1.5 pr-4">{new Date(h.created_at).toLocaleString()}</td>
                  <td className="py-1.5 pr-4">{h.published_at ? new Date(h.published_at).toLocaleString() : '—'}</td>
                  <td className="py-1.5">{h.published_by_name ?? h.created_by_name ?? '—'}</td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr><td colSpan={7} className="py-3 text-white/30">No snapshots yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

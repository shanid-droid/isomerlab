import React, { useState, useEffect } from 'react';
import {
  useAdminLeaderboard,
  useLiveLeaderboardPreview,
} from '../../lib/leaderboardHooks';
import type { LeaderboardType, LeaderboardPeriod } from '../../lib/types';

export const LeaderboardPublishingPanel: React.FC = () => {
  const [selectedType, setSelectedType] = useState<LeaderboardType>('projects');
  const [selectedPeriod, setSelectedPeriod] = useState<LeaderboardPeriod>('all_time');

  const {
    snapshots,
    loadingHistory,
    actionLoading,
    actionError,
    fetchSnapshotsHistory,
    generateSnapshot,
    publishSnapshot,
    unpublishSnapshot,
  } = useAdminLeaderboard();

  const {
    projectItems,
    creatorItems,
    loading: previewLoading,
    fetchLive,
  } = useLiveLeaderboardPreview(selectedType, selectedPeriod);

  // Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => Promise<void>;
  }>({
    open: false,
    title: '',
    message: '',
    onConfirm: async () => {},
  });

  useEffect(() => {
    fetchSnapshotsHistory();
    fetchLive();
  }, [fetchSnapshotsHistory, fetchLive, selectedType, selectedPeriod]);

  const handleGenerate = async () => {
    setConfirmModal({
      open: true,
      title: 'GENERATE NEW SNAPSHOT',
      message: `Generate a new draft snapshot for ${selectedType.toUpperCase()} (${selectedPeriod.replace('_', ' ')}) based on current live statistics?`,
      onConfirm: async () => {
        await generateSnapshot(selectedType, selectedPeriod);
      },
    });
  };

  const handlePublish = async (snapshotId: string) => {
    setConfirmModal({
      open: true,
      title: 'PUBLISH SNAPSHOT TO WEBSITE',
      message: 'Publishing this snapshot will update the official rankings displayed to public visitors and creators. Proceed?',
      onConfirm: async () => {
        await publishSnapshot(snapshotId);
      },
    });
  };

  const handleUnpublish = async (snapshotId: string) => {
    setConfirmModal({
      open: true,
      title: 'UNPUBLISH SNAPSHOT',
      message: 'Unpublishing will withdraw this snapshot from public view. Proceed?',
      onConfirm: async () => {
        await unpublishSnapshot(snapshotId);
      },
    });
  };

  return (
    <div className="space-y-10">
      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-eg/15 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full border border-eg/40 bg-eg/10 text-eg font-mono-custom text-[10px] uppercase tracking-widest mb-2">
            ADMINISTRATIVE CONSOLE
          </div>
          <h2 className="font-display text-2xl font-bold text-white uppercase tracking-wider">
            LEADERBOARD PUBLISHING & SNAPSHOTS
          </h2>
          <p className="font-mono-custom text-xs text-white/60">
            Preview calculated rankings, generate official snapshots, and manage public release status.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchLive()}
            disabled={previewLoading}
            className="btn-outline text-xs px-4 py-2 font-mono-custom flex items-center gap-1.5"
          >
            {previewLoading ? 'Refreshing Live Data...' : '↻ Refresh Live Preview'}
          </button>
        </div>
      </div>

      {actionError && (
        <div className="p-4 rounded-xl border border-red-500/50 bg-red-500/10 text-red-400 font-mono-custom text-xs">
          {actionError}
        </div>
      )}

      {/* ── Notice: Scoring Configuration ─────────────────────── */}
      <div className="p-4 rounded-xl border border-white/10 bg-dark-200/50 flex items-start gap-3 text-xs font-mono-custom text-white/60">
        <span className="text-eg font-bold">ℹ</span>
        <div>
          <span className="text-white font-semibold">Note on Scoring Weights:</span> Leaderboard scoring formulas, point weights, and visibility permissions are managed exclusively by the System Owner. Admins can preview calculations and publish official snapshots.
        </div>
      </div>

      {/* ── Controls: Select Type & Period ─────────────────────── */}
      <div className="glass rounded-2xl p-6 sm:p-8 border border-eg/20 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* Type Selector */}
            <div className="flex items-center p-1 rounded-xl bg-dark border border-eg/20">
              <button
                onClick={() => setSelectedType('projects')}
                className={`font-mono-custom text-xs px-4 py-1.5 rounded-lg transition-all ${
                  selectedType === 'projects'
                    ? 'bg-eg text-dark font-bold'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                PROJECTS
              </button>
              <button
                onClick={() => setSelectedType('creators')}
                className={`font-mono-custom text-xs px-4 py-1.5 rounded-lg transition-all ${
                  selectedType === 'creators'
                    ? 'bg-eg text-dark font-bold'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                CREATORS
              </button>
            </div>

            {/* Period Selector */}
            <div className="flex items-center p-1 rounded-xl bg-dark border border-white/10">
              {(['all_time', 'monthly', 'weekly'] as LeaderboardPeriod[]).map((period) => (
                <button
                  key={period}
                  onClick={() => setSelectedPeriod(period)}
                  className={`font-mono-custom text-[11px] px-3 py-1.5 rounded-lg transition-all ${
                    selectedPeriod === period
                      ? 'bg-white/20 text-white font-semibold'
                      : 'text-white/40 hover:text-white'
                  }`}
                >
                  {period.replace('_', ' ').toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={actionLoading}
            className="btn-primary text-xs py-2 px-5 font-mono-custom flex items-center gap-2"
          >
            <span>+</span> Generate Snapshot
          </button>
        </div>

        {/* ── Live Preview Table ───────────────────────────────── */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <span className="font-mono-custom text-[11px] text-eg uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-eg animate-pulse" />
              LIVE CALCULATED RANKINGS PREVIEW ({selectedType.toUpperCase()} · {selectedPeriod.toUpperCase()}):
            </span>
          </div>

          {previewLoading ? (
            <div className="py-12 text-center text-xs font-mono-custom text-white/50">
              Calculating rankings...
            </div>
          ) : selectedType === 'projects' ? (
            projectItems.length === 0 ? (
              <p className="text-xs font-mono-custom text-white/40 py-6 text-center">
                No published projects found for this period.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full text-left font-mono-custom text-xs">
                  <thead className="bg-dark-300 text-white/50 text-[10px] uppercase border-b border-white/10">
                    <tr>
                      <th className="p-3 w-16">RANK</th>
                      <th className="p-3">PROJECT TITLE</th>
                      <th className="p-3">CREATOR</th>
                      <th className="p-3">LIKES</th>
                      <th className="p-3">COMMENTS</th>
                      <th className="p-3">VIEWS</th>
                      <th className="p-3 text-right">CALCULATED SCORE</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 bg-dark-200/40">
                    {projectItems.slice(0, 10).map((item) => (
                      <tr key={item.project_id} className="hover:bg-white/[0.02]">
                        <td className="p-3 font-bold text-white/80">#{item.rank}</td>
                        <td className="p-3 font-semibold text-white">{item.title}</td>
                        <td className="p-3 text-white/70">{item.creator_name}</td>
                        <td className="p-3 text-red-400">♥ {item.likes_count}</td>
                        <td className="p-3 text-blue-400">💬 {item.comments_count}</td>
                        <td className="p-3 text-white/40">{item.views_count}</td>
                        <td className="p-3 text-right text-eg font-bold">{item.score} PTS</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : creatorItems.length === 0 ? (
            <p className="text-xs font-mono-custom text-white/40 py-6 text-center">
              No creators found for this period.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full text-left font-mono-custom text-xs">
                <thead className="bg-dark-300 text-white/50 text-[10px] uppercase border-b border-white/10">
                  <tr>
                    <th className="p-3 w-16">RANK</th>
                    <th className="p-3">CREATOR</th>
                    <th className="p-3">PROJECTS</th>
                    <th className="p-3">LIKES REC'D</th>
                    <th className="p-3">TOP WORK</th>
                    <th className="p-3">ACTIVITY</th>
                    <th className="p-3 text-right">CALCULATED SCORE</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 bg-dark-200/40">
                  {creatorItems.slice(0, 10).map((item) => (
                    <tr key={item.creator_id} className="hover:bg-white/[0.02]">
                      <td className="p-3 font-bold text-white/80">#{item.rank}</td>
                      <td className="p-3 font-semibold text-white">{item.creator_name}</td>
                      <td className="p-3 text-white/70">{item.projects_count}</td>
                      <td className="p-3 text-red-400">♥ {item.total_likes_received}</td>
                      <td className="p-3 text-white/60">{item.top_project_title || '—'}</td>
                      <td className="p-3 text-white/40">{item.activity_score}</td>
                      <td className="p-3 text-right text-eg font-bold">{item.score} PTS</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Snapshot Publication History ───────────────────────── */}
      <div className="glass rounded-2xl p-6 sm:p-8 border border-eg/20 space-y-6">
        <h3 className="font-mono-custom text-xs tracking-widest text-eg uppercase flex items-center gap-2 border-b border-eg/10 pb-3">
          <span className="w-1.5 h-1.5 rounded-full bg-eg" />
          SNAPSHOT PUBLICATION HISTORY
        </h3>

        {loadingHistory ? (
          <p className="font-mono-custom text-xs text-white/40">Loading snapshot history...</p>
        ) : snapshots.length === 0 ? (
          <p className="font-mono-custom text-xs text-white/40 italic">No snapshots generated yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-left font-mono-custom text-xs">
              <thead className="bg-dark-300 text-white/50 text-[10px] uppercase border-b border-white/10">
                <tr>
                  <th className="p-3">TYPE</th>
                  <th className="p-3">PERIOD</th>
                  <th className="p-3">STATUS</th>
                  <th className="p-3">CREATED AT</th>
                  <th className="p-3">PUBLISHED AT</th>
                  <th className="p-3 text-right">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 bg-dark-200/40">
                {snapshots.map((snap) => (
                  <tr key={snap.id} className="hover:bg-white/[0.02]">
                    <td className="p-3 uppercase font-semibold text-white">{snap.leaderboard_type}</td>
                    <td className="p-3 uppercase text-white/60">{snap.period.replace('_', ' ')}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-semibold ${
                        snap.status === 'published'
                          ? 'bg-eg/10 text-eg border border-eg/30'
                          : snap.status === 'archived'
                          ? 'bg-white/5 text-white/40 border border-white/10'
                          : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30'
                      }`}>
                        {snap.status}
                      </span>
                    </td>
                    <td className="p-3 text-white/50">
                      {new Date(snap.created_at).toLocaleString('en-GB')}
                    </td>
                    <td className="p-3 text-white/50">
                      {snap.published_at ? new Date(snap.published_at).toLocaleString('en-GB') : '—'}
                    </td>
                    <td className="p-3 text-right">
                      {snap.status === 'published' ? (
                        <button
                          onClick={() => handleUnpublish(snap.id)}
                          disabled={actionLoading}
                          className="text-red-400 hover:text-red-300 font-mono-custom text-[11px] underline"
                        >
                          Unpublish
                        </button>
                      ) : (
                        <button
                          onClick={() => handlePublish(snap.id)}
                          disabled={actionLoading}
                          className="text-eg hover:text-white font-mono-custom text-[11px] underline"
                        >
                          Publish
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Confirmation Modal ─────────────────────────────────── */}
      {confirmModal.open && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass rounded-2xl p-6 sm:p-8 max-w-md w-full border border-eg/30 space-y-6 shadow-2xl">
            <div className="space-y-2">
              <h3 className="font-display text-lg font-bold text-white uppercase tracking-wider">
                {confirmModal.title}
              </h3>
              <p className="font-mono-custom text-xs text-white/70 leading-relaxed">
                {confirmModal.message}
              </p>
            </div>
            <div className="flex justify-end gap-3 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setConfirmModal({ ...confirmModal, open: false })}
                className="px-4 py-2 rounded-xl text-xs font-mono-custom text-white/60 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await confirmModal.onConfirm();
                    setConfirmModal({ ...confirmModal, open: false });
                  } catch (err: any) {
                    alert(`Action failed: ${err.message}`);
                  }
                }}
                className="btn-primary px-5 py-2 text-xs font-mono-custom"
              >
                CONFIRM & PROCEED
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeaderboardPublishingPanel;

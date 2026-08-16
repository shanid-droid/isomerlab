import React, { useState, useEffect } from 'react';
import {
  useLeaderboardSettings,
  useOwnerLeaderboardControls,
  useAdminLeaderboard,
} from '../../lib/leaderboardHooks';
import type {
  LeaderboardSettings,
  LeaderboardType,
  LeaderboardPeriod,
  LeaderboardVisibility,
} from '../../lib/types';

export const LeaderboardControlPanel: React.FC = () => {
  const { settings, loading: settingsLoading, refreshSettings } = useLeaderboardSettings();
  const { updating, error: updateError, updateSettings, overrideEntryScore } = useOwnerLeaderboardControls();
  const {
    snapshots,
    loadingHistory,
    actionLoading,
    fetchSnapshotsHistory,
    generateSnapshot,
    publishSnapshot,
    unpublishSnapshot,
  } = useAdminLeaderboard();

  // Local Form State
  const [formData, setFormData] = useState<LeaderboardSettings | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Snapshot generation dialog
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

  // Manual Override Form
  const [overrideModal, setOverrideModal] = useState(false);
  const [overrideEntryId, setOverrideEntryId] = useState('');
  const [overrideScore, setOverrideScore] = useState<number>(100);
  const [overrideRank, setOverrideRank] = useState<number>(1);
  const [overrideNotes, setOverrideNotes] = useState('');

  useEffect(() => {
    if (settings) {
      setFormData(settings);
    }
  }, [settings]);

  useEffect(() => {
    fetchSnapshotsHistory();
  }, [fetchSnapshotsHistory]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData) return;

    try {
      await updateSettings(formData);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
      await refreshSettings();
    } catch (err) {
      console.error(err);
    }
  };

  const handleGenerateAndPublish = async (type: LeaderboardType, period: LeaderboardPeriod) => {
    setConfirmModal({
      open: true,
      title: `GENERATE & PUBLISH SNAPSHOT`,
      message: `Are you sure you want to generate a new snapshot for ${type.toUpperCase()} (${period}) and immediately publish it to the public leaderboard?`,
      onConfirm: async () => {
        const newSnapId = await generateSnapshot(type, period);
        await publishSnapshot(newSnapId);
      },
    });
  };

  const handleApplyOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideEntryId.trim()) return;

    try {
      await overrideEntryScore(overrideEntryId.trim(), overrideScore, overrideRank, overrideNotes);
      setOverrideModal(false);
      setOverrideEntryId('');
      setOverrideNotes('');
      await fetchSnapshotsHistory();
      alert('Override successfully recorded.');
    } catch (err: any) {
      alert(`Override failed: ${err.message}`);
    }
  };

  if (settingsLoading || !formData) {
    return (
      <div className="py-16 text-center">
        <div className="w-8 h-8 rounded-full border-2 border-eg/30 border-t-eg animate-spin mx-auto mb-3" />
        <p className="font-mono-custom text-xs text-white/50 uppercase">Loading leaderboard controls...</p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-eg/15 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full border border-eg/40 bg-eg/10 text-eg font-mono-custom text-[10px] uppercase tracking-widest mb-2">
            👑 SYSTEM OWNER EXCLUSIVE
          </div>
          <h2 className="font-display text-2xl font-bold text-white uppercase tracking-wider">
            LEADERBOARD CONTROL & SCORING RULES
          </h2>
          <p className="font-mono-custom text-xs text-white/60">
            Configure algorithmic scoring weights, access visibility, and publishing governance.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="/leaderboard"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-outline text-xs px-4 py-2 flex items-center gap-1.5 font-mono-custom"
          >
            View Public Leaderboard ↗
          </a>

          <button
            type="button"
            onClick={() => setOverrideModal(true)}
            className="px-4 py-2 rounded-xl border border-purple-500/40 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 font-mono-custom text-xs transition-colors"
          >
            Manual Override
          </button>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-4 rounded-xl border border-eg/50 bg-eg/10 text-eg font-mono-custom text-xs flex items-center gap-2">
          <span>✓</span> Leaderboard settings and scoring formulas successfully updated!
        </div>
      )}

      {updateError && (
        <div className="p-4 rounded-xl border border-red-500/50 bg-red-500/10 text-red-400 font-mono-custom text-xs">
          Error saving settings: {updateError}
        </div>
      )}

      {/* ── Settings Form ──────────────────────────────────────── */}
      <form onSubmit={handleSaveSettings} className="space-y-8">
        
        {/* Section 1: General & Visibility */}
        <div className="glass rounded-2xl p-6 sm:p-8 border border-eg/20 space-y-6">
          <h3 className="font-mono-custom text-xs tracking-widest text-eg uppercase flex items-center gap-2 border-b border-eg/10 pb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-eg" />
            1. GENERAL SYSTEM & VISIBILITY GOVERNANCE
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Master Toggle */}
            <div className="p-4 rounded-xl bg-dark-200/60 border border-white/10 space-y-2">
              <label className="font-mono-custom text-xs text-white font-semibold flex items-center justify-between cursor-pointer">
                <span>MASTER LEADERBOARD</span>
                <input
                  type="checkbox"
                  checked={formData.enabled}
                  onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                  className="w-4 h-4 rounded border-eg text-eg focus:ring-eg bg-dark"
                />
              </label>
              <p className="font-mono-custom text-[10px] text-white/40">
                Turn off to globally disable all leaderboard functionality.
              </p>
            </div>

            {/* Project Leaderboard Toggle */}
            <div className="p-4 rounded-xl bg-dark-200/60 border border-white/10 space-y-2">
              <label className="font-mono-custom text-xs text-white font-semibold flex items-center justify-between cursor-pointer">
                <span>PROJECTS RANKING</span>
                <input
                  type="checkbox"
                  checked={formData.project_enabled}
                  onChange={(e) => setFormData({ ...formData, project_enabled: e.target.checked })}
                  className="w-4 h-4 rounded border-eg text-eg focus:ring-eg bg-dark"
                />
              </label>
              <p className="font-mono-custom text-[10px] text-white/40">
                Enable ranking of published projects.
              </p>
            </div>

            {/* Creator Leaderboard Toggle */}
            <div className="p-4 rounded-xl bg-dark-200/60 border border-white/10 space-y-2">
              <label className="font-mono-custom text-xs text-white font-semibold flex items-center justify-between cursor-pointer">
                <span>CREATORS RANKING</span>
                <input
                  type="checkbox"
                  checked={formData.creator_enabled}
                  onChange={(e) => setFormData({ ...formData, creator_enabled: e.target.checked })}
                  className="w-4 h-4 rounded border-eg text-eg focus:ring-eg bg-dark"
                />
              </label>
              <p className="font-mono-custom text-[10px] text-white/40">
                Enable ranking of verified creators.
              </p>
            </div>

            {/* Visibility Selector */}
            <div className="p-4 rounded-xl bg-dark-200/60 border border-white/10 space-y-2">
              <label className="font-mono-custom text-xs text-white font-semibold block">
                VISIBILITY ACCESS
              </label>
              <select
                value={formData.visibility}
                onChange={(e) => setFormData({ ...formData, visibility: e.target.value as LeaderboardVisibility })}
                className="w-full bg-dark border border-eg/30 rounded-lg px-3 py-1.5 text-xs text-white font-mono-custom focus:outline-none focus:border-eg"
              >
                <option value="public">PUBLIC (Everyone)</option>
                <option value="creators_only">CREATORS ONLY</option>
                <option value="admins_only">ADMINS ONLY</option>
                <option value="no_one">NO ONE (Offline)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 2: Project Scoring Weights */}
        <div className="glass rounded-2xl p-6 sm:p-8 border border-eg/20 space-y-6">
          <h3 className="font-mono-custom text-xs tracking-widest text-eg uppercase flex items-center gap-2 border-b border-eg/10 pb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-eg" />
            2. PROJECT SCORING WEIGHTS & BONUSES
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-1.5">
              <label className="font-mono-custom text-[11px] text-white/70 uppercase">
                POINTS PER LIKE (DEFAULT: 1.0)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={formData.project_like_weight}
                onChange={(e) => setFormData({ ...formData, project_like_weight: parseFloat(e.target.value) || 0 })}
                className="w-full bg-dark-200/80 border border-eg/20 rounded-xl px-4 py-2 text-xs text-white font-mono-custom focus:outline-none focus:border-eg"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-mono-custom text-[11px] text-white/70 uppercase">
                POINTS PER COMMENT (DEFAULT: 3.0)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={formData.project_comment_weight}
                onChange={(e) => setFormData({ ...formData, project_comment_weight: parseFloat(e.target.value) || 0 })}
                className="w-full bg-dark-200/80 border border-eg/20 rounded-xl px-4 py-2 text-xs text-white font-mono-custom focus:outline-none focus:border-eg"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-mono-custom text-[11px] text-white/70 uppercase">
                POINTS PER VIEW (DEFAULT: 0.1)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.project_view_weight}
                onChange={(e) => setFormData({ ...formData, project_view_weight: parseFloat(e.target.value) || 0 })}
                className="w-full bg-dark-200/80 border border-eg/20 rounded-xl px-4 py-2 text-xs text-white font-mono-custom focus:outline-none focus:border-eg"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-mono-custom text-[11px] text-white/70 uppercase">
                GITHUB REPO BONUS (DEFAULT: 5.0)
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={formData.github_bonus}
                onChange={(e) => setFormData({ ...formData, github_bonus: parseFloat(e.target.value) || 0 })}
                className="w-full bg-dark-200/80 border border-eg/20 rounded-xl px-4 py-2 text-xs text-white font-mono-custom focus:outline-none focus:border-eg"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-mono-custom text-[11px] text-white/70 uppercase">
                GALLERY MEDIA BONUS (DEFAULT: 3.0)
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={formData.gallery_bonus}
                onChange={(e) => setFormData({ ...formData, gallery_bonus: parseFloat(e.target.value) || 0 })}
                className="w-full bg-dark-200/80 border border-eg/20 rounded-xl px-4 py-2 text-xs text-white font-mono-custom focus:outline-none focus:border-eg"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-mono-custom text-[11px] text-white/70 uppercase">
                RECENCY DECAY DAYS (DEFAULT: 90 DAYS)
              </label>
              <input
                type="number"
                step="1"
                min="1"
                value={formData.recency_decay_days}
                onChange={(e) => setFormData({ ...formData, recency_decay_days: parseFloat(e.target.value) || 90 })}
                className="w-full bg-dark-200/80 border border-eg/20 rounded-xl px-4 py-2 text-xs text-white font-mono-custom focus:outline-none focus:border-eg"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Creator Scoring Weights */}
        <div className="glass rounded-2xl p-6 sm:p-8 border border-eg/20 space-y-6">
          <h3 className="font-mono-custom text-xs tracking-widest text-eg uppercase flex items-center gap-2 border-b border-eg/10 pb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-eg" />
            3. CREATOR SCORING WEIGHTS & ACTIVITY BONUSES
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-1.5">
              <label className="font-mono-custom text-[11px] text-white/70 uppercase">
                POINTS PER PUBLISHED PROJECT (DEFAULT: 10.0)
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={formData.creator_project_weight}
                onChange={(e) => setFormData({ ...formData, creator_project_weight: parseFloat(e.target.value) || 0 })}
                className="w-full bg-dark-200/80 border border-eg/20 rounded-xl px-4 py-2 text-xs text-white font-mono-custom focus:outline-none focus:border-eg"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-mono-custom text-[11px] text-white/70 uppercase">
                POINTS PER LIKE RECEIVED (DEFAULT: 1.0)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={formData.creator_like_weight}
                onChange={(e) => setFormData({ ...formData, creator_like_weight: parseFloat(e.target.value) || 0 })}
                className="w-full bg-dark-200/80 border border-eg/20 rounded-xl px-4 py-2 text-xs text-white font-mono-custom focus:outline-none focus:border-eg"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-mono-custom text-[11px] text-white/70 uppercase">
                POINTS PER COMMENT RECEIVED (DEFAULT: 3.0)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={formData.creator_comment_weight}
                onChange={(e) => setFormData({ ...formData, creator_comment_weight: parseFloat(e.target.value) || 0 })}
                className="w-full bg-dark-200/80 border border-eg/20 rounded-xl px-4 py-2 text-xs text-white font-mono-custom focus:outline-none focus:border-eg"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-mono-custom text-[11px] text-white/70 uppercase">
                ACTIVITY WEIGHT (ON OTHERS' WORK, DEFAULT: 2.0)
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={formData.creator_activity_weight}
                onChange={(e) => setFormData({ ...formData, creator_activity_weight: parseFloat(e.target.value) || 0 })}
                className="w-full bg-dark-200/80 border border-eg/20 rounded-xl px-4 py-2 text-xs text-white font-mono-custom focus:outline-none focus:border-eg"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-mono-custom text-[11px] text-white/70 uppercase">
                TOP 3 PROJECT BONUS (DEFAULT: 50.0)
              </label>
              <input
                type="number"
                step="1"
                min="0"
                value={formData.creator_top3_bonus}
                onChange={(e) => setFormData({ ...formData, creator_top3_bonus: parseFloat(e.target.value) || 0 })}
                className="w-full bg-dark-200/80 border border-eg/20 rounded-xl px-4 py-2 text-xs text-white font-mono-custom focus:outline-none focus:border-eg"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-mono-custom text-[11px] text-white/70 uppercase">
                TOP 10 PROJECT BONUS (DEFAULT: 25.0)
              </label>
              <input
                type="number"
                step="1"
                min="0"
                value={formData.creator_top10_bonus}
                onChange={(e) => setFormData({ ...formData, creator_top10_bonus: parseFloat(e.target.value) || 0 })}
                className="w-full bg-dark-200/80 border border-eg/20 rounded-xl px-4 py-2 text-xs text-white font-mono-custom focus:outline-none focus:border-eg"
              />
            </div>
          </div>
        </div>

        {/* Section 4: Enabled Periods */}
        <div className="glass rounded-2xl p-6 sm:p-8 border border-eg/20 space-y-6">
          <h3 className="font-mono-custom text-xs tracking-widest text-eg uppercase flex items-center gap-2 border-b border-eg/10 pb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-eg" />
            4. AVAILABLE TIME PERIODS
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <label className="p-4 rounded-xl bg-dark-200/60 border border-white/10 flex items-center justify-between cursor-pointer">
              <span className="font-mono-custom text-xs text-white font-semibold">ALL TIME PERIOD</span>
              <input
                type="checkbox"
                checked={formData.all_time_enabled}
                onChange={(e) => setFormData({ ...formData, all_time_enabled: e.target.checked })}
                className="w-4 h-4 rounded border-eg text-eg focus:ring-eg bg-dark"
              />
            </label>

            <label className="p-4 rounded-xl bg-dark-200/60 border border-white/10 flex items-center justify-between cursor-pointer">
              <span className="font-mono-custom text-xs text-white font-semibold">MONTHLY PERIOD (30 DAYS)</span>
              <input
                type="checkbox"
                checked={formData.monthly_enabled}
                onChange={(e) => setFormData({ ...formData, monthly_enabled: e.target.checked })}
                className="w-4 h-4 rounded border-eg text-eg focus:ring-eg bg-dark"
              />
            </label>

            <label className="p-4 rounded-xl bg-dark-200/60 border border-white/10 flex items-center justify-between cursor-pointer">
              <span className="font-mono-custom text-xs text-white font-semibold">WEEKLY PERIOD (7 DAYS)</span>
              <input
                type="checkbox"
                checked={formData.weekly_enabled}
                onChange={(e) => setFormData({ ...formData, weekly_enabled: e.target.checked })}
                className="w-4 h-4 rounded border-eg text-eg focus:ring-eg bg-dark"
              />
            </label>
          </div>
        </div>

        {/* Form Submit Button */}
        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={updating}
            className="btn-primary py-3 px-8 text-xs font-mono-custom flex items-center gap-2"
          >
            {updating ? 'Saving Scoring Settings...' : 'SAVE LEADERBOARD SETTINGS'}
          </button>
        </div>
      </form>

      {/* ── Section 5: Quick Publish Controls ─────────────────── */}
      <div className="glass rounded-2xl p-6 sm:p-8 border border-eg/20 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4 border-b border-eg/10 pb-4">
          <h3 className="font-mono-custom text-xs tracking-widest text-eg uppercase flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-eg" />
            5. PUBLISHING & SNAPSHOT ORCHESTRATION
          </h3>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleGenerateAndPublish('projects', 'all_time')}
              disabled={actionLoading}
              className="btn-primary text-xs py-1.5 px-3 font-mono-custom"
            >
              Publish Projects (All Time)
            </button>
            <button
              onClick={() => handleGenerateAndPublish('creators', 'all_time')}
              disabled={actionLoading}
              className="btn-primary text-xs py-1.5 px-3 font-mono-custom"
            >
              Publish Creators (All Time)
            </button>
          </div>
        </div>

        {/* Snapshots Table */}
        <div className="space-y-3">
          <span className="font-mono-custom text-[11px] text-white/50 uppercase tracking-wider block">
            RECENT SNAPSHOTS & PUBLICATION STATUS:
          </span>

          {loadingHistory ? (
            <p className="font-mono-custom text-xs text-white/40">Loading snapshot history...</p>
          ) : snapshots.length === 0 ? (
            <p className="font-mono-custom text-xs text-white/40 italic">No snapshots generated yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full text-left font-mono-custom text-xs">
                <thead className="bg-dark-300/80 text-white/50 text-[10px] uppercase border-b border-white/10">
                  <tr>
                    <th className="p-3">TYPE</th>
                    <th className="p-3">PERIOD</th>
                    <th className="p-3">STATUS</th>
                    <th className="p-3">PUBLISHED AT</th>
                    <th className="p-3 text-right">ACTIONS</th>
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
                        {snap.published_at ? new Date(snap.published_at).toLocaleString('en-GB') : '—'}
                      </td>
                      <td className="p-3 text-right">
                        {snap.status === 'published' ? (
                          <button
                            onClick={() => unpublishSnapshot(snap.id)}
                            disabled={actionLoading}
                            className="text-red-400 hover:text-red-300 font-mono-custom text-[11px] underline"
                          >
                            Unpublish
                          </button>
                        ) : (
                          <button
                            onClick={() => publishSnapshot(snap.id)}
                            disabled={actionLoading}
                            className="text-eg hover:text-white font-mono-custom text-[11px] underline"
                          >
                            Publish Now
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

      {/* ── Manual Override Modal ──────────────────────────────── */}
      {overrideModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleApplyOverride}
            className="glass rounded-2xl p-6 sm:p-8 max-w-lg w-full border border-purple-500/40 space-y-6 shadow-2xl bg-dark-100"
          >
            <div className="space-y-2 border-b border-purple-500/20 pb-4">
              <span className="font-mono-custom text-[10px] text-purple-400 uppercase tracking-widest">
                INTERNAL AUDIT OVERRIDE
              </span>
              <h3 className="font-display text-lg font-bold text-white uppercase tracking-wider">
                MANUAL SCORE & RANK OVERRIDE
              </h3>
              <p className="font-mono-custom text-xs text-white/60">
                Directly adjust an entry's score and rank within an active snapshot. All overrides are logged to security audit logs.
              </p>
            </div>

            <div className="space-y-4 font-mono-custom text-xs">
              <div>
                <label className="block text-white/70 text-[11px] mb-1">ENTRY ID (UUID)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 123e4567-e89b-12d3-a456-426614174000"
                  value={overrideEntryId}
                  onChange={(e) => setOverrideEntryId(e.target.value)}
                  className="w-full bg-dark border border-purple-500/30 rounded-xl px-4 py-2 text-white font-mono-custom text-xs focus:outline-none focus:border-purple-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-white/70 text-[11px] mb-1">NEW SCORE (NUMERIC)</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={overrideScore}
                    onChange={(e) => setOverrideScore(parseFloat(e.target.value) || 0)}
                    className="w-full bg-dark border border-purple-500/30 rounded-xl px-4 py-2 text-white font-mono-custom text-xs focus:outline-none focus:border-purple-400"
                  />
                </div>

                <div>
                  <label className="block text-white/70 text-[11px] mb-1">NEW RANK (INTEGER)</label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    required
                    value={overrideRank}
                    onChange={(e) => setOverrideRank(parseInt(e.target.value) || 1)}
                    className="w-full bg-dark border border-purple-500/30 rounded-xl px-4 py-2 text-white font-mono-custom text-xs focus:outline-none focus:border-purple-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-white/70 text-[11px] mb-1">INTERNAL OVERRIDE AUDIT NOTE</label>
                <textarea
                  rows={2}
                  required
                  placeholder="Reason for manual adjustment (stored in audit log)..."
                  value={overrideNotes}
                  onChange={(e) => setOverrideNotes(e.target.value)}
                  className="w-full bg-dark border border-purple-500/30 rounded-xl px-4 py-2 text-white font-mono-custom text-xs focus:outline-none focus:border-purple-400"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-purple-500/20">
              <button
                type="button"
                onClick={() => setOverrideModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-mono-custom text-white/60 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={updating}
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-mono-custom text-xs font-bold shadow-lg"
              >
                APPLY OVERRIDE
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default LeaderboardControlPanel;

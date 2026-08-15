import React, { useEffect, useState } from 'react';
import {
  clearLeaderboardOverride,
  setLeaderboardOverride,
  useLeaderboardSettings,
} from '../../lib/leaderboardHooks';
import { LeaderboardPublishingPanel } from './LeaderboardPublishingPanel';
import type { LeaderboardSettings, LeaderboardType, LeaderboardVisibility } from '../../lib/types';

const VISIBILITY: [LeaderboardVisibility, string][] = [
  ['public', 'PUBLIC'],
  ['creators', 'CREATORS ONLY'],
  ['admins', 'ADMINS ONLY'],
  ['none', 'NO ONE'],
];

type NumericKey = keyof Pick<LeaderboardSettings,
  | 'project_like_weight' | 'project_comment_weight' | 'project_view_weight'
  | 'github_bonus' | 'gallery_bonus' | 'description_bonus' | 'tags_bonus'
  | 'recency_half_life_days' | 'recency_floor'
  | 'creator_project_weight' | 'creator_like_weight' | 'creator_comment_weight'
  | 'creator_activity_weight' | 'creator_top10_bonus' | 'creator_top3_bonus'
  | 'creator_comment_activity_points' | 'creator_like_activity_points'
  | 'max_scored_comments_per_project' | 'min_projects_for_creator' | 'min_score_to_rank'
>;

type ToggleKey = keyof Pick<LeaderboardSettings,
  'enabled' | 'project_enabled' | 'creator_enabled' | 'all_time_enabled' | 'monthly_enabled' | 'weekly_enabled'
>;

const PROJECT_FIELDS: [NumericKey, string][] = [
  ['project_like_weight', 'LIKE WEIGHT'],
  ['project_comment_weight', 'COMMENT WEIGHT'],
  ['project_view_weight', 'VIEW WEIGHT'],
  ['github_bonus', 'GITHUB BONUS'],
  ['gallery_bonus', 'GALLERY BONUS'],
  ['description_bonus', 'DESCRIPTION BONUS'],
  ['tags_bonus', 'TAGS BONUS'],
  ['recency_half_life_days', 'RECENCY HALF-LIFE (DAYS, 0 = OFF)'],
  ['recency_floor', 'RECENCY FLOOR (0-1)'],
];

const CREATOR_FIELDS: [NumericKey, string][] = [
  ['creator_project_weight', 'PUBLISHED PROJECT'],
  ['creator_like_weight', 'LIKE RECEIVED'],
  ['creator_comment_weight', 'COMMENT RECEIVED'],
  ['creator_activity_weight', 'ACTIVITY MULTIPLIER'],
  ['creator_top3_bonus', 'TOP 3 PROJECT BONUS'],
  ['creator_top10_bonus', 'TOP 10 PROJECT BONUS'],
  ['creator_comment_activity_points', 'COMMENT ON OTHERS'],
  ['creator_like_activity_points', 'LIKE ON OTHERS'],
];

const LIMIT_FIELDS: [NumericKey, string][] = [
  ['max_scored_comments_per_project', 'MAX SCORED COMMENTS / AUTHOR / PROJECT'],
  ['min_projects_for_creator', 'MIN PUBLISHED PROJECTS TO RANK'],
  ['min_score_to_rank', 'MIN SCORE TO RANK'],
];

const Toggle: React.FC<{ label: string; value: boolean; onChange: (v: boolean) => void }> = ({ label, value, onChange }) => (
  <button
    type="button"
    onClick={() => onChange(!value)}
    className={`font-mono-custom text-[10px] tracking-widest px-3 py-2 rounded-lg border transition-colors text-left ${
      value ? 'border-eg/50 bg-eg/10 text-eg' : 'border-white/10 text-white/40 hover:text-white/70'
    }`}
  >
    {value ? '● ' : '○ '}{label}
  </button>
);

const NumberField: React.FC<{ label: string; value: number; onChange: (v: number) => void }> = ({ label, value, onChange }) => (
  <label className="flex flex-col gap-1 min-w-0">
    <span className="font-mono-custom text-[10px] tracking-widest text-white/35">{label}</span>
    <input
      type="number"
      step="0.1"
      value={Number.isFinite(value) ? value : 0}
      onChange={(e) => onChange(Number(e.target.value))}
      className="bg-dark-200/60 border border-white/10 focus:border-eg/50 rounded-lg px-3 py-2 font-mono-custom text-xs text-white outline-none"
    />
  </label>
);

/** Owner-only leaderboard configuration. Admins never render this panel. */
export const LeaderboardControlPanel: React.FC = () => {
  const { settings, loading, save } = useLeaderboardSettings(true);
  const [draft, setDraft] = useState<LeaderboardSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [overrideType, setOverrideType] = useState<LeaderboardType>('project');
  const [overrideId, setOverrideId] = useState('');
  const [overrideScore, setOverrideScore] = useState('');
  const [overrideRank, setOverrideRank] = useState('');
  const [overrideFeatured, setOverrideFeatured] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');

  useEffect(() => { setDraft(settings); }, [settings]);

  if (loading || !draft) {
    return <p className="font-mono-custom text-xs text-white/40">Loading leaderboard settings…</p>;
  }

  const patch = (part: Partial<LeaderboardSettings>) => setDraft({ ...draft, ...part });

  const onSave = async () => {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      await save(draft);
      setMessage('Settings saved.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const applyOverride = async (clear: boolean) => {
    setError(null);
    setMessage(null);
    try {
      if (clear) {
        await clearLeaderboardOverride(overrideType, overrideId.trim());
        setMessage('Override cleared.');
      } else {
        await setLeaderboardOverride({
          entityType: overrideType,
          entityId: overrideId.trim(),
          scoreOverride: overrideScore === '' ? null : Number(overrideScore),
          rankOverride: overrideRank === '' ? null : Number(overrideRank),
          featured: overrideFeatured,
          reason: overrideReason || null,
        });
        setMessage('Override saved. Generate a new snapshot to apply it.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Override failed');
    }
  };

  return (
    <div className="space-y-6">
      {/* GENERAL */}
      <section className="glass rounded-xl border border-eg/15 p-5 space-y-4">
        <h3 className="font-display text-sm tracking-widest text-white uppercase">General</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {([
            ['enabled', 'LEADERBOARD ENABLED'],
            ['project_enabled', 'PROJECT LEADERBOARD'],
            ['creator_enabled', 'CREATOR LEADERBOARD'],
          ] as [ToggleKey, string][]).map(([key, label]) => (
            <Toggle key={key} label={label} value={draft[key]} onChange={(v) => patch({ [key]: v } as Partial<LeaderboardSettings>)} />
          ))}
        </div>

        <div>
          <p className="font-mono-custom text-[10px] tracking-widest text-white/35 mb-2">VISIBILITY</p>
          <div className="flex flex-wrap gap-2">
            {VISIBILITY.map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => patch({ visibility: value })}
                className={`font-mono-custom text-[10px] tracking-widest px-3 py-2 rounded-lg border transition-colors ${
                  draft.visibility === value ? 'border-eg/50 bg-eg/10 text-eg' : 'border-white/10 text-white/40 hover:text-white/70'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* SCORING */}
      <section className="glass rounded-xl border border-eg/15 p-5 space-y-4">
        <h3 className="font-display text-sm tracking-widest text-white uppercase">Project Scoring</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {PROJECT_FIELDS.map(([key, label]) => (
            <NumberField key={key} label={label} value={Number(draft[key])} onChange={(v) => patch({ [key]: v } as Partial<LeaderboardSettings>)} />
          ))}
        </div>
      </section>

      <section className="glass rounded-xl border border-eg/15 p-5 space-y-4">
        <h3 className="font-display text-sm tracking-widest text-white uppercase">Creator Scoring</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {CREATOR_FIELDS.map(([key, label]) => (
            <NumberField key={key} label={label} value={Number(draft[key])} onChange={(v) => patch({ [key]: v } as Partial<LeaderboardSettings>)} />
          ))}
        </div>
      </section>

      <section className="glass rounded-xl border border-eg/15 p-5 space-y-4">
        <h3 className="font-display text-sm tracking-widest text-white uppercase">Limits &amp; Periods</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {LIMIT_FIELDS.map(([key, label]) => (
            <NumberField key={key} label={label} value={Number(draft[key])} onChange={(v) => patch({ [key]: v } as Partial<LeaderboardSettings>)} />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {([
            ['all_time_enabled', 'ALL TIME'],
            ['monthly_enabled', 'MONTHLY'],
            ['weekly_enabled', 'WEEKLY'],
          ] as [ToggleKey, string][]).map(([key, label]) => (
            <Toggle key={key} label={label} value={draft[key]} onChange={(v) => patch({ [key]: v } as Partial<LeaderboardSettings>)} />
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={saving}
            onClick={onSave}
            className="font-mono-custom text-[10px] tracking-widest px-5 py-2.5 rounded-lg border border-eg/50 bg-eg/10 text-eg hover:bg-eg/20 disabled:opacity-40"
          >
            SAVE SETTINGS
          </button>
          {message && <span className="font-mono-custom text-[10px] text-eg">{message}</span>}
          {error && <span className="font-mono-custom text-[10px] text-red-400">{error}</span>}
        </div>
      </section>

      {/* MANUAL OVERRIDES */}
      <section className="glass rounded-xl border border-amber-500/20 p-5 space-y-3">
        <h3 className="font-display text-sm tracking-widest text-white uppercase">Manual Overrides</h3>
        <p className="font-mono-custom text-[10px] text-white/35">
          Overridden entries are flagged internally as manual and take effect on the next generated snapshot.
        </p>
        <div className="flex flex-wrap gap-2">
          {(['project', 'creator'] as LeaderboardType[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setOverrideType(value)}
              className={`font-mono-custom text-[10px] tracking-widest px-3 py-1.5 rounded-lg border ${
                overrideType === value ? 'border-eg/50 bg-eg/10 text-eg' : 'border-white/10 text-white/40'
              }`}
            >
              {value.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="font-mono-custom text-[10px] tracking-widest text-white/35">ENTITY ID (UUID)</span>
            <input
              value={overrideId}
              onChange={(e) => setOverrideId(e.target.value)}
              className="bg-dark-200/60 border border-white/10 focus:border-eg/50 rounded-lg px-3 py-2 font-mono-custom text-xs text-white outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-mono-custom text-[10px] tracking-widest text-white/35">SCORE OVERRIDE</span>
            <input
              type="number"
              value={overrideScore}
              onChange={(e) => setOverrideScore(e.target.value)}
              className="bg-dark-200/60 border border-white/10 focus:border-eg/50 rounded-lg px-3 py-2 font-mono-custom text-xs text-white outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-mono-custom text-[10px] tracking-widest text-white/35">RANK OVERRIDE</span>
            <input
              type="number"
              value={overrideRank}
              onChange={(e) => setOverrideRank(e.target.value)}
              className="bg-dark-200/60 border border-white/10 focus:border-eg/50 rounded-lg px-3 py-2 font-mono-custom text-xs text-white outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 sm:col-span-3">
            <span className="font-mono-custom text-[10px] tracking-widest text-white/35">REASON</span>
            <input
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              className="bg-dark-200/60 border border-white/10 focus:border-eg/50 rounded-lg px-3 py-2 font-mono-custom text-xs text-white outline-none"
            />
          </label>
          <div className="flex items-end">
            <Toggle label="FEATURED" value={overrideFeatured} onChange={setOverrideFeatured} />
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={!overrideId.trim()}
            onClick={() => void applyOverride(false)}
            className="font-mono-custom text-[10px] tracking-widest px-4 py-2 rounded-lg border border-eg/40 text-eg hover:bg-eg/10 disabled:opacity-40"
          >
            SAVE OVERRIDE
          </button>
          <button
            type="button"
            disabled={!overrideId.trim()}
            onClick={() => void applyOverride(true)}
            className="font-mono-custom text-[10px] tracking-widest px-4 py-2 rounded-lg border border-red-500/40 text-red-300 hover:bg-red-500/10 disabled:opacity-40"
          >
            CLEAR OVERRIDE
          </button>
        </div>
      </section>

      {/* PUBLISHING (owner sees the same controls admins have) */}
      <LeaderboardPublishingPanel />
    </div>
  );
};

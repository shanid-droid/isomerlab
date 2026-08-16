import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';
import type {
  LeaderboardSettings,
  LeaderboardType,
  LeaderboardPeriod,
  LeaderboardEntry,
  LiveProjectLeaderboardItem,
  LiveCreatorLeaderboardItem,
  MyCreatorRank,
  LeaderboardSnapshot,
} from './types';

/* ── 1. Fetch Leaderboard Settings ───────────────────────────────── */
export function useLeaderboardSettings() {
  const [settings, setSettings] = useState<LeaderboardSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error: err } = await supabase
        .from('leaderboard_settings')
        .select('*')
        .eq('id', 1)
        .maybeSingle();

      if (err) throw err;
      setSettings(data as LeaderboardSettings);
    } catch (err: any) {
      setError(err.message || 'Failed to load leaderboard settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return { settings, loading, error, refreshSettings: fetchSettings };
}

/* ── 2. Public / Published Leaderboard Hook ───────────────────────── */
export function useLeaderboard(type: LeaderboardType, period: LeaderboardPeriod) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUnpublished, setIsUnpublished] = useState(false);

  const fetchLeaderboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setIsUnpublished(false);

      const { data, error: rpcError } = await supabase.rpc('get_public_leaderboard', {
        p_period: period,
        p_type: type,
      });

      if (rpcError) throw rpcError;

      const rows = (data || []) as (LeaderboardEntry & { published_at?: string })[];
      if (rows.length === 0) {
        setIsUnpublished(true);
        setEntries([]);
        setPublishedAt(null);
      } else {
        setEntries(rows);
        setPublishedAt(rows[0]?.published_at || null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch leaderboard');
    } finally {
      setLoading(false);
    }
  }, [type, period]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  return { entries, publishedAt, loading, error, isUnpublished, refetch: fetchLeaderboard };
}

/* ── 3. Current Logged-in Creator Position Hook ──────────────────── */
export function useMyCreatorRank(period: LeaderboardPeriod) {
  const [myRank, setMyRank] = useState<MyCreatorRank | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRank = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setMyRank(null);
        return;
      }

      const { data, error } = await supabase.rpc('get_creator_my_rank', {
        p_period: period,
      });

      if (error) {
        setMyRank(null);
        return;
      }

      if (data && data.length > 0) {
        setMyRank(data[0] as MyCreatorRank);
      } else {
        setMyRank(null);
      }
    } catch {
      setMyRank(null);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchRank();
  }, [fetchRank]);

  return { myRank, loading, refetchRank: fetchRank };
}

/* ── 4. Live Leaderboard Calculation Preview (Admin / Owner) ─────── */
export function useLiveLeaderboardPreview(type: LeaderboardType, period: LeaderboardPeriod) {
  const [projectItems, setProjectItems] = useState<LiveProjectLeaderboardItem[]>([]);
  const [creatorItems, setCreatorItems] = useState<LiveCreatorLeaderboardItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLive = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      if (type === 'projects') {
        const { data, error: err } = await supabase.rpc('calculate_project_leaderboard', {
          p_period: period,
        });
        if (err) throw err;
        setProjectItems((data || []) as LiveProjectLeaderboardItem[]);
      } else {
        const { data, error: err } = await supabase.rpc('calculate_creator_leaderboard', {
          p_period: period,
        });
        if (err) throw err;
        setCreatorItems((data || []) as LiveCreatorLeaderboardItem[]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to calculate live leaderboard');
    } finally {
      setLoading(false);
    }
  }, [type, period]);

  return { projectItems, creatorItems, loading, error, fetchLive };
}

/* ── 5. Admin Snapshot Management Hook ───────────────────────────── */
export function useAdminLeaderboard() {
  const [snapshots, setSnapshots] = useState<LeaderboardSnapshot[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchSnapshotsHistory = useCallback(async () => {
    try {
      setLoadingHistory(true);
      const { data, error } = await supabase
        .from('leaderboard_snapshots')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(30);

      if (error) throw error;
      setSnapshots((data || []) as LeaderboardSnapshot[]);
    } catch (err: any) {
      console.error('Failed to load snapshots history:', err);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  const generateSnapshot = async (type: LeaderboardType, period: LeaderboardPeriod): Promise<string> => {
    setActionLoading(true);
    setActionError(null);
    try {
      const { data, error } = await supabase.rpc('generate_leaderboard_snapshot', {
        p_type: type,
        p_period: period,
      });
      if (error) throw error;
      await fetchSnapshotsHistory();
      return data as string;
    } catch (err: any) {
      setActionError(err.message || 'Failed to generate snapshot');
      throw err;
    } finally {
      setActionLoading(false);
    }
  };

  const publishSnapshot = async (snapshotId: string): Promise<void> => {
    setActionLoading(true);
    setActionError(null);
    try {
      const { error } = await supabase.rpc('publish_leaderboard_snapshot', {
        p_snapshot_id: snapshotId,
      });
      if (error) throw error;
      await fetchSnapshotsHistory();
    } catch (err: any) {
      setActionError(err.message || 'Failed to publish snapshot');
      throw err;
    } finally {
      setActionLoading(false);
    }
  };

  const unpublishSnapshot = async (snapshotId: string): Promise<void> => {
    setActionLoading(true);
    setActionError(null);
    try {
      const { error } = await supabase.rpc('unpublish_leaderboard_snapshot', {
        p_snapshot_id: snapshotId,
      });
      if (error) throw error;
      await fetchSnapshotsHistory();
    } catch (err: any) {
      setActionError(err.message || 'Failed to unpublish snapshot');
      throw err;
    } finally {
      setActionLoading(false);
    }
  };

  return {
    snapshots,
    loadingHistory,
    actionLoading,
    actionError,
    fetchSnapshotsHistory,
    generateSnapshot,
    publishSnapshot,
    unpublishSnapshot,
  };
}

/* ── 6. Owner Leaderboard Controls Hook ──────────────────────────── */
export function useOwnerLeaderboardControls() {
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateSettings = async (settings: Partial<LeaderboardSettings>): Promise<void> => {
    setUpdating(true);
    setError(null);
    try {
      const { error: rpcError } = await supabase.rpc('update_leaderboard_settings', {
        p_enabled: settings.enabled ?? true,
        p_project_enabled: settings.project_enabled ?? true,
        p_creator_enabled: settings.creator_enabled ?? true,
        p_visibility: settings.visibility ?? 'public',
        p_project_like_weight: Number(settings.project_like_weight ?? 1.0),
        p_project_comment_weight: Number(settings.project_comment_weight ?? 3.0),
        p_project_view_weight: Number(settings.project_view_weight ?? 0.1),
        p_github_bonus: Number(settings.github_bonus ?? 5.0),
        p_gallery_bonus: Number(settings.gallery_bonus ?? 3.0),
        p_recency_decay_days: Number(settings.recency_decay_days ?? 90.0),
        p_creator_project_weight: Number(settings.creator_project_weight ?? 10.0),
        p_creator_like_weight: Number(settings.creator_like_weight ?? 1.0),
        p_creator_comment_weight: Number(settings.creator_comment_weight ?? 3.0),
        p_creator_activity_weight: Number(settings.creator_activity_weight ?? 2.0),
        p_creator_top3_bonus: Number(settings.creator_top3_bonus ?? 50.0),
        p_creator_top10_bonus: Number(settings.creator_top10_bonus ?? 25.0),
        p_weekly_enabled: settings.weekly_enabled ?? true,
        p_monthly_enabled: settings.monthly_enabled ?? true,
        p_all_time_enabled: settings.all_time_enabled ?? true,
      });

      if (rpcError) throw rpcError;
    } catch (err: any) {
      setError(err.message || 'Failed to update settings');
      throw err;
    } finally {
      setUpdating(false);
    }
  };

  const overrideEntryScore = async (
    entryId: string,
    newScore: number,
    newRank: number,
    notes: string
  ): Promise<void> => {
    setUpdating(true);
    setError(null);
    try {
      const { error: rpcError } = await supabase.rpc('override_leaderboard_entry_score', {
        p_entry_id: entryId,
        p_new_score: newScore,
        p_new_rank: newRank,
        p_override_notes: notes,
      });

      if (rpcError) throw rpcError;
    } catch (err: any) {
      setError(err.message || 'Failed to override entry score');
      throw err;
    } finally {
      setUpdating(false);
    }
  };

  return { updating, error, updateSettings, overrideEntryScore };
}

/* ── 7. Atomic Project View Counter Hook ─────────────────────────── */
export function useRecordProjectView(projectId: string | undefined) {
  useEffect(() => {
    if (!projectId) return;

    // Deduplicate within the same browser session for 30 minutes
    const storageKey = `isomer_proj_view_${projectId}`;
    const lastViewed = sessionStorage.getItem(storageKey);
    const now = Date.now();

    if (!lastViewed || now - Number(lastViewed) > 30 * 60 * 1000) {
      sessionStorage.setItem(storageKey, String(now));
      supabase.rpc('record_project_view', { p_project_id: projectId }).then(({ error }) => {
        if (error) {
          console.debug('Project view count note:', error.message);
        }
      });
    }
  }, [projectId]);
}

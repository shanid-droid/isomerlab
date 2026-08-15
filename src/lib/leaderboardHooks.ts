import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';
import type {
  LeaderboardAccess,
  LeaderboardEntry,
  LeaderboardPeriod,
  LeaderboardResult,
  LeaderboardSettings,
  LeaderboardSnapshotRow,
  LeaderboardType,
  MyLeaderboardPosition,
} from './types';

/**
 * All scoring happens in Postgres. These hooks only read the published
 * snapshot (one RPC call per view) or invoke owner/admin RPCs.
 */

export function useLeaderboardAccess() {
  const [access, setAccess] = useState<LeaderboardAccess | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_leaderboard_access');
    if (error) {
      setAccess(null);
    } else {
      setAccess(data as LeaderboardAccess);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    supabase.rpc('get_leaderboard_access').then(({ data, error }) => {
      if (cancelled) return;
      setAccess(error ? null : (data as LeaderboardAccess));
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') void load();
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [load]);

  return { access, loading, reload: load };
}

export function useLeaderboard(type: LeaderboardType, period: LeaderboardPeriod) {
  const [result, setResult] = useState<LeaderboardResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const readIdRef = useRef(0);

  const load = useCallback(async () => {
    const readId = ++readIdRef.current;
    setLoading(true);
    setError(null);

    const { data, error: rpcError } = await supabase.rpc('get_published_leaderboard', {
      p_type: type,
      p_period: period,
    });

    if (readId !== readIdRef.current) return;

    if (rpcError) {
      setError(rpcError.message);
      setResult(null);
    } else {
      setResult(data as LeaderboardResult);
    }
    setLoading(false);
  }, [type, period]);

  useEffect(() => { void load(); }, [load]);

  return { result, entries: (result?.entries ?? []) as LeaderboardEntry[], loading, error, reload: load };
}

export function useMyLeaderboardPosition(period: LeaderboardPeriod, enabled: boolean) {
  const [position, setPosition] = useState<MyLeaderboardPosition | null>(null);

  useEffect(() => {
    if (!enabled) {
      setPosition(null);
      return;
    }
    let cancelled = false;
    supabase.rpc('get_my_leaderboard_position', { p_period: period }).then(({ data, error }) => {
      if (cancelled) return;
      setPosition(error ? null : (data as MyLeaderboardPosition | null));
    });
    return () => { cancelled = true; };
  }, [period, enabled]);

  return position;
}

/* ── Owner / admin ───────────────────────────────────────────────── */

export function useLeaderboardSettings(enabled: boolean) {
  const [settings, setSettings] = useState<LeaderboardSettings | null>(null);
  const [loading, setLoading] = useState(enabled);

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    const { data } = await supabase
      .from('leaderboard_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle();
    setSettings((data as LeaderboardSettings) ?? null);
    setLoading(false);
  }, [enabled]);

  useEffect(() => { void load(); }, [load]);

  const save = useCallback(async (patch: Partial<LeaderboardSettings>) => {
    const { data, error } = await supabase.rpc('update_leaderboard_settings', { p_settings: patch });
    if (error) throw error;
    setSettings(data as LeaderboardSettings);
    return data as LeaderboardSettings;
  }, []);

  return { settings, loading, save, reload: load };
}

export function useLeaderboardHistory(enabled: boolean) {
  const [history, setHistory] = useState<LeaderboardSnapshotRow[]>([]);
  const [loading, setLoading] = useState(enabled);

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    const { data, error } = await supabase.rpc('get_leaderboard_history', { p_limit: 20 });
    setHistory(error ? [] : ((data ?? []) as LeaderboardSnapshotRow[]));
    setLoading(false);
  }, [enabled]);

  useEffect(() => { void load(); }, [load]);

  return { history, loading, reload: load };
}

export async function generateLeaderboardSnapshot(type: LeaderboardType, period: LeaderboardPeriod) {
  const { data, error } = await supabase.rpc('generate_leaderboard_snapshot', {
    p_type: type,
    p_period: period,
  });
  if (error) throw error;
  return data as string;
}

export async function publishLeaderboardSnapshot(snapshotId: string) {
  const { error } = await supabase.rpc('publish_leaderboard_snapshot', { p_snapshot_id: snapshotId });
  if (error) throw error;
}

export async function unpublishLeaderboard(type: LeaderboardType, period: LeaderboardPeriod) {
  const { error } = await supabase.rpc('unpublish_leaderboard', { p_type: type, p_period: period });
  if (error) throw error;
}

export async function refreshLeaderboard(type: LeaderboardType, period: LeaderboardPeriod) {
  const { data, error } = await supabase.rpc('refresh_leaderboard', { p_type: type, p_period: period });
  if (error) throw error;
  return data as string;
}

export async function previewLeaderboard(type: LeaderboardType, period: LeaderboardPeriod, limit = 25) {
  const { data, error } = await supabase.rpc('preview_leaderboard', {
    p_type: type,
    p_period: period,
    p_limit: limit,
  });
  if (error) throw error;
  return ((data as LeaderboardResult)?.entries ?? []) as LeaderboardEntry[];
}

export async function setLeaderboardOverride(input: {
  entityType: LeaderboardType;
  entityId: string;
  scoreOverride?: number | null;
  rankOverride?: number | null;
  featured?: boolean;
  reason?: string | null;
}) {
  const { error } = await supabase.rpc('set_leaderboard_override', {
    p_entity_type: input.entityType,
    p_entity_id: input.entityId,
    p_score_override: input.scoreOverride ?? null,
    p_rank_override: input.rankOverride ?? null,
    p_featured: input.featured ?? false,
    p_reason: input.reason ?? null,
  });
  if (error) throw error;
}

export async function clearLeaderboardOverride(entityType: LeaderboardType, entityId: string) {
  const { error } = await supabase.rpc('clear_leaderboard_override', {
    p_entity_type: entityType,
    p_entity_id: entityId,
  });
  if (error) throw error;
}

/** Fire-and-forget view tracking; the RPC rate limits to one view per day. */
export function recordProjectView(projectId: string | undefined | null) {
  if (!projectId) return;
  void supabase.rpc('record_project_view', { p_project_id: projectId });
}

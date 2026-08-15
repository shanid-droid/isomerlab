/**
 * Notification hooks for ISOMER LAB.
 *
 * Provides:
 *  - useNotifications()           — all visible notifications with read status
 *  - useUnreadCount()             — fast unread badge count with live updates
 *  - usePublicNotifications()     — anon-safe public notifications only
 *  - usePublicBellNotifications() — public bell notifications with read tracking
 *  - useProfileNotifications()    — personal notifications for profile/dashboard
 *  - useAdminNotifications()      — all notifications for owner/admin management
 */

import { useEffect, useState, useCallback } from 'react';
import { supabase } from './supabase';
import type { NotificationWithRead, Notification } from './types';

// ─── Helpers ────────────────────────────────────────────────────────────────

export function isExpiredOrInactive(n: Notification): boolean {
  if (!n.is_active) return true;
  if (n.expires_at && new Date(n.expires_at) <= new Date()) return true;
  return false;
}

// ─── useNotifications ────────────────────────────────────────────────────────

export interface UseNotificationsResult {
  notifications: NotificationWithRead[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
}

/**
 * Fetches all notifications visible to the currently authenticated user,
 * annotated with persistent is_read status.
 */
export function useNotifications(): UseNotificationsResult {
  const [notifications, setNotifications] = useState<NotificationWithRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setNotifications([]);
        setLoading(false);
        return;
      }

      // Fetch visible notifications (RLS handles the filtering)
      const { data: notifData, error: notifErr } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false });

      if (notifErr) throw new Error(notifErr.message);

      const rows = (notifData as Notification[]) ?? [];

      if (rows.length === 0) {
        setNotifications([]);
        setLoading(false);
        return;
      }

      // Fetch read records for current user from DB
      const { data: readData } = await supabase
        .from('notification_reads')
        .select('notification_id')
        .eq('user_id', user.id);

      const readSet = new Set((readData ?? []).map((r: { notification_id: string }) => r.notification_id));

      // Fetch sender display names
      const senderIds = [...new Set(rows.map(n => n.created_by).filter(Boolean))];
      let senderMap: Record<string, string | null> = {};
      if (senderIds.length > 0) {
        const { data: senderProfiles } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', senderIds);
        if (senderProfiles) {
          for (const p of senderProfiles as { id: string; full_name: string | null; email: string | null }[]) {
            senderMap[p.id] = p.full_name || p.email || 'Unknown';
          }
        }
      }

      // Fetch recipient display names for private notifications
      const recipientIds = [...new Set(
        rows.filter(n => n.notification_type === 'private' && (n.recipient_id || n.recipient_user_id))
          .map(n => (n.recipient_id || n.recipient_user_id) as string)
      )];
      let recipientMap: Record<string, string | null> = {};
      if (recipientIds.length > 0) {
        const { data: recipientProfiles } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', recipientIds);
        if (recipientProfiles) {
          for (const p of recipientProfiles as { id: string; full_name: string | null; email: string | null }[]) {
            recipientMap[p.id] = p.full_name || p.email || 'Unknown';
          }
        }
      }

      setNotifications(prev => {
        const prevReadMap = new Map(prev.map(n => [n.id, n.is_read]));
        return rows.map(n => {
          const recId = n.recipient_id || n.recipient_user_id;
          const isRead = readSet.has(n.id) || prevReadMap.get(n.id) === true;
          return {
            ...n,
            is_read: isRead,
            sender_name: senderMap[n.created_by] ?? null,
            recipient_name: recId ? (recipientMap[recId] ?? null) : null,
          };
        });
      });
    } catch (err: unknown) {
      setError((err as Error)?.message ?? 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const markRead = useCallback(async (notificationId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Optimistically update local state immediately
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );

      // Persist to Supabase database via RPC
      const { error: rpcErr } = await supabase.rpc('mark_notification_read', { p_notification_id: notificationId });

      if (rpcErr) {
        console.warn('[useNotifications.markRead] RPC failed, trying direct upsert:', rpcErr.message);
        const { error: directErr } = await supabase
          .from('notification_reads')
          .upsert(
            { notification_id: notificationId, user_id: user.id, read_at: new Date().toISOString() },
            { onConflict: 'notification_id,user_id' }
          );

        if (directErr) {
          console.error('[useNotifications.markRead] Failed to persist read state:', directErr.message);
          setNotifications(prev =>
            prev.map(n => n.id === notificationId ? { ...n, is_read: false } : n)
          );
        }
      }
    } catch (err) {
      console.error('[useNotifications] markRead failed:', err);
    }
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Optimistically update local state
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));

      const { error: rpcErr } = await supabase.rpc('mark_all_notifications_read');

      if (rpcErr) {
        console.warn('[useNotifications.markAllRead] RPC failed, trying direct upsert:', rpcErr.message);
        const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
        if (unreadIds.length > 0) {
          const rowsToInsert = unreadIds.map(id => ({
            notification_id: id,
            user_id: user.id,
            read_at: new Date().toISOString(),
          }));
          await supabase.from('notification_reads').upsert(rowsToInsert, { onConflict: 'notification_id,user_id' });
        }
      }
    } catch (err) {
      console.error('[useNotifications] markAllRead failed:', err);
    }
  }, [notifications]);

  return { notifications, loading, error, refresh: fetch, markRead, markAllRead };
}

// ─── useUnreadCount ──────────────────────────────────────────────────────────

export interface UseUnreadCountResult {
  count: number;
  loading: boolean;
  refresh: () => Promise<void>;
}

/**
 * Returns the number of unread visible notifications for the current user.
 * Subscribes to realtime changes for live badge updates without resetting read state.
 */
export function useUnreadCount(): UseUnreadCountResult {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchCount = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setCount(0); setLoading(false); return; }

      // Get all visible notification IDs
      const { data: notifData } = await supabase
        .from('notifications')
        .select('id')
        .order('created_at', { ascending: false });

      const allIds = (notifData ?? []).map((n: { id: string }) => n.id);
      if (allIds.length === 0) { setCount(0); setLoading(false); return; }

      // Get read IDs for this user
      const { data: readData } = await supabase
        .from('notification_reads')
        .select('notification_id')
        .eq('user_id', user.id)
        .in('notification_id', allIds);

      const readIds = new Set((readData ?? []).map((r: { notification_id: string }) => r.notification_id));
      setCount(allIds.filter(id => !readIds.has(id)).length);
    } catch {
      // Non-fatal
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCount();

    const channelId = `notification_reads_changes_${Math.random().toString(36).substring(2, 9)}`;
    const channel = supabase
      .channel(channelId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notification_reads' }, () => {
        fetchCount();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => {
        fetchCount();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchCount]);

  return { count, loading, refresh: fetchCount };
}

// ─── usePublicNotifications ──────────────────────────────────────────────────

export interface UsePublicNotificationsResult {
  notifications: Notification[];
  loading: boolean;
}

/**
 * Fetches active, non-expired public notifications.
 * Anon-safe — does not require authentication.
 * Used for the public banner on the home page.
 */
export function usePublicNotifications(): UsePublicNotificationsResult {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchPublic() {
      try {
        const { data } = await supabase
          .from('notifications')
          .select('id, title, message, notification_type, created_at, expires_at, is_active, metadata, created_by, updated_at, recipient_id')
          .eq('notification_type', 'public')
          .eq('is_active', true)
          .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
          .order('created_at', { ascending: false })
          .limit(5);

        if (!cancelled) {
          setNotifications((data as Notification[]) ?? []);
        }
      } catch {
        // Non-fatal
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchPublic();
    return () => { cancelled = true; };
  }, []);

  return { notifications, loading };
}

// ─── useAdminNotifications ───────────────────────────────────────────────────

export interface UseAdminNotificationsResult {
  notifications: NotificationWithRead[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Fetches ALL notifications for owner/admin management panel.
 * Includes sender names. No read-status annotation (admin context).
 */
export function useAdminNotifications(): UseAdminNotificationsResult {
  const [notifications, setNotifications] = useState<NotificationWithRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: sbErr } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false });

      if (sbErr) throw new Error(sbErr.message);

      const rows = (data as Notification[]) ?? [];

      // Fetch sender names
      const senderIds = [...new Set(rows.map(n => n.created_by).filter(Boolean))];
      let senderMap: Record<string, string | null> = {};
      if (senderIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', senderIds);
        if (profiles) {
          for (const p of profiles as { id: string; full_name: string | null; email: string | null }[]) {
            senderMap[p.id] = p.full_name || p.email || 'Unknown';
          }
        }
      }

      // Fetch recipient names for private notifications
      const recipientIds = [...new Set(
        rows.filter(n => n.notification_type === 'private' && (n.recipient_id || n.recipient_user_id))
          .map(n => (n.recipient_id || n.recipient_user_id) as string)
      )];
      let recipientMap: Record<string, string | null> = {};
      if (recipientIds.length > 0) {
        const { data: recProfiles } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', recipientIds);
        if (recProfiles) {
          for (const p of recProfiles as { id: string; full_name: string | null; email: string | null }[]) {
            recipientMap[p.id] = p.full_name || p.email || 'Unknown';
          }
        }
      }

      setNotifications(rows.map(n => {
        const recId = n.recipient_id || n.recipient_user_id;
        return {
          ...n,
          is_read: false, // not relevant in admin context
          sender_name: senderMap[n.created_by] ?? null,
          recipient_name: recId ? (recipientMap[recId] ?? null) : null,
        };
      }));
    } catch (err: unknown) {
      setError((err as Error)?.message ?? 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { notifications, loading, error, refresh: fetch };
}

// ─── usePublicBellNotifications ──────────────────────────────────────────────

export interface UsePublicBellNotificationsResult {
  notifications: NotificationWithRead[];
  unreadCount: number;
  loading: boolean;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
}

/**
 * Hook for Home-Page Public Notification Bell.
 * Fetches ONLY active, non-expired PUBLIC notifications.
 * Works for all visitor roles (normal users, creators, admins, owners, anon).
 * Never returns private or creator-only notifications.
 */
export function usePublicBellNotifications(): UsePublicBellNotificationsResult {
  const [notifications, setNotifications] = useState<NotificationWithRead[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPublic = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('notification_type', 'public')
        .eq('is_active', true)
        .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(20);

      const rows = (data as Notification[]) ?? [];

      const { data: { user } } = await supabase.auth.getUser();
      let readSet = new Set<string>();
      if (user && rows.length > 0) {
        const { data: readData } = await supabase
          .from('notification_reads')
          .select('notification_id')
          .eq('user_id', user.id)
          .in('notification_id', rows.map(r => r.id));
        readSet = new Set((readData ?? []).map((r: { notification_id: string }) => r.notification_id));
      }

      setNotifications(prev => {
        const prevReadMap = new Map(prev.map(n => [n.id, n.is_read]));
        return rows.map(n => ({
          ...n,
          is_read: readSet.has(n.id) || prevReadMap.get(n.id) === true,
        }));
      });
    } catch {
      // Non-fatal
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPublic();
  }, [fetchPublic]);

  const markRead = useCallback(async (id: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Optimistically update local state immediately
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));

      if (user) {
        const { error: rpcErr } = await supabase.rpc('mark_notification_read', { p_notification_id: id });
        if (rpcErr) {
          const { error: directErr } = await supabase
            .from('notification_reads')
            .upsert(
              { notification_id: id, user_id: user.id, read_at: new Date().toISOString() },
              { onConflict: 'notification_id,user_id' }
            );
          if (directErr) {
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: false } : n));
          }
        }
      }
    } catch (err) {
      console.error('[usePublicBellNotifications] markRead failed:', err);
    }
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));

      if (user) {
        const { error: rpcErr } = await supabase.rpc('mark_all_notifications_read');
        if (rpcErr) {
          const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
          if (unreadIds.length > 0) {
            const rowsToInsert = unreadIds.map(id => ({
              notification_id: id,
              user_id: user.id,
              read_at: new Date().toISOString(),
            }));
            await supabase.from('notification_reads').upsert(rowsToInsert, { onConflict: 'notification_id,user_id' });
          }
        }
      }
    } catch (err) {
      console.error('[usePublicBellNotifications] markAllRead failed:', err);
    }
  }, [notifications]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return { notifications, unreadCount, loading, refresh: fetchPublic, markRead, markAllRead };
}

// ─── useProfileNotifications ─────────────────────────────────────────────────

export interface UseProfileNotificationsResult {
  notifications: NotificationWithRead[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
}

/**
 * Hook for Profile / User Dashboard personal notifications.
 * Uses RLS to fetch private (recipient_id = auth.uid()) and creator notifications.
 * RLS ensures normal users get only their private notifications and creators get creator notifications too.
 */
export function useProfileNotifications(): UseProfileNotificationsResult {
  const [notifications, setNotifications] = useState<NotificationWithRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setNotifications([]);
        setLoading(false);
        return;
      }

      // Query non-public notifications (RLS enforces private recipient & creator role)
      const { data, error: sbErr } = await supabase
        .from('notifications')
        .select('*')
        .neq('notification_type', 'public')
        .order('created_at', { ascending: false });

      if (sbErr) throw new Error(sbErr.message);

      const rows = (data as Notification[]) ?? [];
      if (rows.length === 0) {
        setNotifications([]);
        setLoading(false);
        return;
      }

      const { data: readData } = await supabase
        .from('notification_reads')
        .select('notification_id')
        .eq('user_id', user.id)
        .in('notification_id', rows.map(r => r.id));

      const readSet = new Set((readData ?? []).map((r: { notification_id: string }) => r.notification_id));

      setNotifications(prev => {
        const prevReadMap = new Map(prev.map(n => [n.id, n.is_read]));
        return rows.map(n => ({
          ...n,
          is_read: readSet.has(n.id) || prevReadMap.get(n.id) === true,
        }));
      });
    } catch (err: unknown) {
      setError((err as Error)?.message ?? 'Failed to load profile notifications');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const markRead = useCallback(async (id: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));

      if (user) {
        const { error: rpcErr } = await supabase.rpc('mark_notification_read', { p_notification_id: id });
        if (rpcErr) {
          const { error: directErr } = await supabase
            .from('notification_reads')
            .upsert(
              { notification_id: id, user_id: user.id, read_at: new Date().toISOString() },
              { onConflict: 'notification_id,user_id' }
            );
          if (directErr) {
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: false } : n));
          }
        }
      }
    } catch (err) {
      console.error('[useProfileNotifications] markRead failed:', err);
    }
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));

      if (user) {
        const { error: rpcErr } = await supabase.rpc('mark_all_notifications_read');
        if (rpcErr) {
          const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
          if (unreadIds.length > 0) {
            const rowsToInsert = unreadIds.map(id => ({
              notification_id: id,
              user_id: user.id,
              read_at: new Date().toISOString(),
            }));
            await supabase.from('notification_reads').upsert(rowsToInsert, { onConflict: 'notification_id,user_id' });
          }
        }
      }
    } catch (err) {
      console.error('[useProfileNotifications] markAllRead failed:', err);
    }
  }, [notifications]);

  return { notifications, loading, error, refresh: fetchProfile, markRead, markAllRead };
}

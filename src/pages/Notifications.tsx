/**
 * /notifications — Full notification history page for authenticated users.
 */

import React, { useState } from 'react';
import { useNotifications } from '../lib/notificationHooks';
import { useUserProfile } from '../lib/hooks';
import { UserWorkspaceHeader } from '../components/ui/UserWorkspaceHeader';
import type { NotificationType } from '../lib/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

function AudienceBadge({ type }: { type: NotificationType }) {
  if (type === 'public') return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-mono-custom tracking-widest bg-eg/10 border border-eg/30 text-eg">
      🌐 PUBLIC
    </span>
  );
  if (type === 'birthday') return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-mono-custom tracking-widest bg-pink-500/10 border border-pink-500/30 text-pink-400">
      🎂 BIRTHDAY
    </span>
  );
  if (type === 'all_creators' || type === 'creators') return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-mono-custom tracking-widest bg-purple-500/10 border border-purple-500/30 text-purple-400">
      ✦ CREATORS
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-mono-custom tracking-widest bg-blue-500/10 border border-blue-500/30 text-blue-400">
      🔒 PRIVATE
    </span>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const NotificationsPage: React.FC = () => {
  const { profile } = useUserProfile();
  const { notifications, loading, error, markRead, markAllRead } = useNotifications();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'all' | NotificationType>('all');
  const [filterRead, setFilterRead] = useState<'all' | 'unread' | 'read'>('all');

  const isCreatorOrAdmin = profile?.role === 'creator' || profile?.role === 'admin';
  const filterTypes = isCreatorOrAdmin
    ? (['all', 'public', 'private', 'creators'] as const)
    : (['all', 'public', 'private'] as const);

  const filtered = notifications.filter(n => {
    if (filterType !== 'all') {
      if (filterType === 'creators' && n.notification_type !== 'creators' && n.notification_type !== 'all_creators') return false;
      if (filterType !== 'creators' && n.notification_type !== filterType) return false;
    }
    if (filterRead === 'unread' && n.is_read) return false;
    if (filterRead === 'read' && !n.is_read) return false;
    return true;
  });

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const handleNotificationClick = async (id: string, isRead: boolean) => {
    setExpandedId(prev => prev === id ? null : id);
    if (!isRead) {
      await markRead(id);
    }
  };

  const getDashboardPath = () => {
    if (!profile) return '/dashboard';
    if (profile.role === 'admin') return '/admin';
    if (profile.role === 'creator') return '/creator';
    return '/dashboard';
  };

  return (
    <div className="min-h-screen bg-dark bg-circuit text-white flex flex-col selection:bg-eg/30">
      <UserWorkspaceHeader
        badge="NOTIFICATIONS"
        backTo={{ label: '← Dashboard', path: getDashboardPath() }}
        actions={
          unreadCount > 0 ? (
            <button
              type="button"
              onClick={markAllRead}
              className="font-mono-custom text-xs text-eg/80 hover:text-eg transition-colors px-2.5 py-1.5 rounded-lg border border-eg/30"
            >
              Mark all read ({unreadCount})
            </button>
          ) : undefined
        }
      />

      {/* Main content */}
      <main className="flex-1 max-w-4xl w-full min-w-0 mx-auto px-4 sm:px-6 py-10 space-y-6">
        {/* Page title */}
        <div className="flex items-center justify-between flex-wrap gap-4 min-w-0 w-full">
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold text-white tracking-wider break-words [overflow-wrap:anywhere]">
              Notification History
            </h1>
            <p className="font-mono-custom text-xs text-white/40 mt-1 break-words [overflow-wrap:anywhere]">
              All notifications visible to your account
              {unreadCount > 0 && (
                <span className="ml-2 px-1.5 py-0.5 rounded-full bg-eg/15 border border-eg/30 text-eg text-[9px]">
                  {unreadCount} unread
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="glass rounded-xl p-4 border border-eg/15 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-wrap min-w-0 w-full">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className="font-mono-custom text-[10px] text-white/30 uppercase tracking-widest">Type:</span>
            {filterTypes.map(f => (
              <button
                key={f}
                onClick={() => setFilterType(f as any)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-mono-custom tracking-widest border transition-all ${
                  filterType === f
                    ? 'bg-eg/15 border-eg/40 text-eg'
                    : 'border-white/10 text-white/50 hover:border-white/20'
                }`}
              >
                {f === 'all' ? 'ALL' : f === 'public' ? '🌐 PUBLIC' : f === 'creators' ? '✦ CREATORS' : '🔒 PRIVATE'}
              </button>
            ))}
          </div>
          <div className="h-4 w-px bg-eg/10 hidden sm:block" />
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className="font-mono-custom text-[10px] text-white/30 uppercase tracking-widest">Status:</span>
            {(['all', 'unread', 'read'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilterRead(f)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-mono-custom tracking-widest border transition-all ${
                  filterRead === f
                    ? 'bg-eg/15 border-eg/40 text-eg'
                    : 'border-white/10 text-white/50 hover:border-white/20'
                }`}
              >
                {f.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="p-4 rounded-xl border border-red-500/40 bg-red-500/10 text-xs text-red-300 font-mono-custom break-words [overflow-wrap:anywhere]">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-16 gap-3">
            <div className="w-6 h-6 rounded-full border-2 border-eg/30 border-t-eg animate-spin" />
            <span className="font-mono-custom text-xs text-white/40">Loading notifications...</span>
          </div>
        )}

        {/* Notification list */}
        {!loading && (
          <div className="space-y-3 w-full min-w-0 max-w-full">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-5 min-w-0">
                <div className="w-16 h-16 rounded-2xl bg-eg/5 border border-eg/15 flex items-center justify-center text-3xl">🔔</div>
                <div className="text-center min-w-0">
                  <p className="font-mono-custom text-sm text-white/50">No notifications</p>
                  <p className="font-mono-custom text-xs text-white/30 mt-1">
                    {notifications.length === 0
                      ? "You don't have any notifications yet."
                      : 'No notifications match your current filters.'}
                  </p>
                </div>
              </div>
            ) : (
              filtered.map(n => (
                <div
                  key={n.id}
                  className={`glass rounded-2xl border transition-all duration-200 cursor-pointer group w-full min-w-0 max-w-full overflow-hidden ${
                    !n.is_read
                      ? 'border-eg/25 bg-eg/[0.03] hover:border-eg/40'
                      : 'border-eg/10 hover:border-eg/20'
                  }`}
                  onClick={() => handleNotificationClick(n.id, n.is_read)}
                >
                  <div className="p-5 w-full min-w-0 max-w-full">
                    {/* Top row */}
                    <div className="flex items-start justify-between gap-4 flex-wrap w-full min-w-0">
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        {/* Unread dot */}
                        {!n.is_read && (
                          <div className="w-2 h-2 rounded-full bg-eg shadow-[0_0_8px_rgba(0,255,136,0.6)] flex-shrink-0 mt-0.5" />
                        )}
                        <AudienceBadge type={n.notification_type} />
                        {n.notification_type === 'private' && n.recipient_name && (
                          <span className="font-mono-custom text-[10px] text-blue-400/60 break-words [overflow-wrap:anywhere]">→ {n.recipient_name}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[10px] font-mono-custom text-white/30 flex-shrink-0">
                        <span>{formatDate(n.created_at)}</span>
                        <span className="text-white/20">{expandedId === n.id ? '▲' : '▼'}</span>
                      </div>
                    </div>

                    {/* Title */}
                    <h2 className={`font-mono-custom text-sm font-semibold mt-3 leading-snug transition-colors w-full min-w-0 max-w-full break-words [overflow-wrap:anywhere] [word-break:break-word] ${
                      !n.is_read ? 'text-white' : 'text-white/70'
                    }`}>
                      {n.title}
                    </h2>

                    {/* Message (expanded) */}
                    {expandedId === n.id && (
                      <div className="mt-4 space-y-3 w-full min-w-0 max-w-full">
                        <p className="font-mono-custom text-sm text-white/60 leading-relaxed whitespace-pre-wrap w-full min-w-0 max-w-full break-words [overflow-wrap:anywhere] [word-break:break-word] border-t border-eg/10 pt-4">
                          {n.message}
                        </p>
                        <div className="flex flex-wrap gap-4 text-[10px] font-mono-custom text-white/30 pt-2 border-t border-eg/5 min-w-0">
                          {n.sender_name && (
                            <span className="break-words [overflow-wrap:anywhere]">Sent by: <span className="text-white/50">{n.sender_name}</span></span>
                          )}
                          {n.expires_at && (
                            <span>Expires: <span className="text-amber-400">{formatDate(n.expires_at)}</span></span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Collapsed preview */}
                    {expandedId !== n.id && (
                      <p className="font-mono-custom text-xs text-white/30 mt-2 line-clamp-2 w-full min-w-0 max-w-full break-words [overflow-wrap:anywhere] [word-break:break-word]">
                        {n.message}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Count summary */}
        {!loading && notifications.length > 0 && (
          <p className="font-mono-custom text-[10px] text-white/20 text-center pt-2">
            Showing {filtered.length} of {notifications.length} notifications
          </p>
        )}
      </main>
    </div>
  );
};

export default NotificationsPage;

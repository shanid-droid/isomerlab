import React, { useState } from 'react';
import { useProfileNotifications } from '../lib/notificationHooks';
import type { NotificationType } from '../lib/types';
import { isCreatorRole } from '../lib/roles';

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

function TypeBadge({ type }: { type: NotificationType }) {
  if (type === 'birthday') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono-custom tracking-widest bg-pink-500/10 border border-pink-500/30 text-pink-400">
        🎂 BIRTHDAY
      </span>
    );
  }
  if (type === 'creators' || type === 'all_creators') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono-custom tracking-widest bg-purple-500/10 border border-purple-500/30 text-purple-400">
        ✦ CREATOR
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono-custom tracking-widest bg-blue-500/10 border border-blue-500/30 text-blue-400">
      🔒 PRIVATE
    </span>
  );
}

interface ProfileNotificationsProps {
  userRole?: string;
  className?: string;
}

export const ProfileNotifications: React.FC<ProfileNotificationsProps> = ({ userRole, className = '' }) => {
  const { notifications, loading, error, markRead, markAllRead } = useProfileNotifications();
  const [filter, setFilter] = useState<'all' | 'private' | 'creator'>('all');

  const isCreator = isCreatorRole(userRole);

  const filtered = notifications.filter(n => {
    if (filter === 'private' && n.notification_type !== 'private') return false;
    if (filter === 'creator' && n.notification_type !== 'creators' && n.notification_type !== 'all_creators') return false;
    return true;
  });

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className={`glass rounded-2xl p-6 border border-eg/15 relative overflow-hidden space-y-5 ${className}`}>
      <div className="absolute top-0 right-0 w-48 h-48 bg-eg/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 relative z-10">
        <div>
          <h2 className="font-mono-custom text-xs tracking-widest text-white/50 uppercase flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-eg" />
            MY NOTIFICATIONS
          </h2>
          <p className="font-mono-custom text-[10px] text-white/40 mt-1">
            Personal updates and notifications sent directly to your profile
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="font-mono-custom text-xs text-eg/80 hover:text-eg hover:bg-eg/10 transition-all flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-eg/30 bg-eg/5"
          >
            ✓ Mark all as read ({unreadCount})
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 flex-wrap border-b border-eg/10 pb-3 relative z-10">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-[10px] font-mono-custom tracking-widest border transition-all ${
            filter === 'all' ? 'bg-eg/15 border-eg/40 text-eg' : 'border-white/10 text-white/50 hover:border-white/20'
          }`}
        >
          ALL ({notifications.length})
        </button>

        <button
          onClick={() => setFilter('private')}
          className={`px-3 py-1.5 rounded-lg text-[10px] font-mono-custom tracking-widest border transition-all ${
            filter === 'private' ? 'bg-blue-500/15 border-blue-500/40 text-blue-400' : 'border-white/10 text-white/50 hover:border-white/20'
          }`}
        >
          🔒 PRIVATE ({notifications.filter(n => n.notification_type === 'private').length})
        </button>

        {isCreator && (
          <button
            onClick={() => setFilter('creator')}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-mono-custom tracking-widest border transition-all ${
              filter === 'creator' ? 'bg-purple-500/15 border-purple-500/40 text-purple-400' : 'border-white/10 text-white/50 hover:border-white/20'
            }`}
          >
            ✦ CREATOR ({notifications.filter(n => n.notification_type === 'creators' || n.notification_type === 'all_creators').length})
          </button>
        )}
      </div>

      {/* Notification List */}
      <div className="space-y-3 relative z-10">
        {loading ? (
          <div className="flex items-center justify-center py-10 gap-2">
            <div className="w-4 h-4 rounded-full border border-eg/30 border-t-eg animate-spin" />
            <span className="font-mono-custom text-xs text-white/40">Loading notifications...</span>
          </div>
        ) : error ? (
          <div className="p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-xs text-red-300 font-mono-custom">
            {error}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
            <div className="w-12 h-12 rounded-xl bg-eg/5 border border-eg/15 flex items-center justify-center text-xl">
              🔔
            </div>
            <p className="font-mono-custom text-xs text-white/50">No notifications</p>
            <p className="font-mono-custom text-[10px] text-white/30">
              {notifications.length === 0 ? "You don't have any personal notifications." : 'No notifications match this filter.'}
            </p>
          </div>
        ) : (
          filtered.map(n => (
            <div
              key={n.id}
              className={`p-4 rounded-xl border transition-all relative w-full min-w-0 max-w-full overflow-hidden ${
                !n.is_read
                  ? 'bg-eg/[0.04] border-eg/30 shadow-[0_0_15px_rgba(0,255,136,0.05)]'
                  : 'bg-dark-200/40 border-white/10 opacity-80 hover:opacity-100'
              }`}
            >
              {!n.is_read && (
                <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-eg shadow-[0_0_8px_rgba(0,255,136,0.8)]" />
              )}

              <div className="flex items-center gap-2 flex-wrap mb-1.5 min-w-0">
                <TypeBadge type={n.notification_type} />
                <span className="font-mono-custom text-[10px] text-white/40">
                  {formatDate(n.created_at)}
                </span>
              </div>

              <h3 className={`font-mono-custom text-sm font-semibold mb-1 w-full min-w-0 max-w-full break-words [overflow-wrap:anywhere] [word-break:break-word] ${!n.is_read ? 'text-white' : 'text-white/80'}`}>
                {n.title}
              </h3>

              <p className="font-mono-custom text-xs text-white/60 leading-relaxed whitespace-pre-wrap w-full min-w-0 max-w-full break-words [overflow-wrap:anywhere] [word-break:break-word]">
                {n.message}
              </p>

              {!n.is_read && (
                <div className="mt-3 flex justify-end">
                  <button
                    onClick={() => markRead(n.id)}
                    className="font-mono-custom text-[10px] text-eg/80 hover:text-eg transition-colors px-2.5 py-1 rounded bg-eg/10 border border-eg/20 hover:border-eg/40"
                  >
                    ✓ Mark as read
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ProfileNotifications;

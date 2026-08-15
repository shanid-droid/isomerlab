/**
 * NotificationBell — user-facing notification icon with dropdown.
 * Shows unread count badge, dropdown preview, and links to /notifications.
 * Used in UserDashboard and CreatorDashboard headers.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useNotifications, useUnreadCount, usePublicBellNotifications } from '../lib/notificationHooks';
import type { NotificationWithRead, NotificationType } from '../lib/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function TypeBadge({ type }: { type: NotificationType }) {
  if (type === 'public') {
    return (
      <span className="text-[9px] font-mono-custom px-1.5 py-0.5 rounded bg-eg/10 border border-eg/20 text-eg/80">
        PUBLIC
      </span>
    );
  }
  if (type === 'birthday') {
    return (
      <span className="text-[9px] font-mono-custom px-1.5 py-0.5 rounded bg-pink-500/10 border border-pink-500/20 text-pink-400">
        🎂 BIRTHDAY
      </span>
    );
  }
  if (type === 'all_creators' || type === 'creators') {
    return (
      <span className="text-[9px] font-mono-custom px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-purple-400/80">
        CREATORS
      </span>
    );
  }
  return (
    <span className="text-[9px] font-mono-custom px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400/80">
      PRIVATE
    </span>
  );
}

// ─── Bell Icon SVG ────────────────────────────────────────────────────────────

const BellIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

// ─── Dropdown notification item ───────────────────────────────────────────────

interface NotificationItemProps {
  notification: NotificationWithRead;
  onMarkRead: (id: string) => void;
}

const NotificationItem: React.FC<NotificationItemProps> = ({ notification, onMarkRead }) => {
  const [expanded, setExpanded] = useState(false);

  const handleClick = () => {
    if (!notification.is_read) {
      onMarkRead(notification.id);
    }
    setExpanded(v => !v);
  };

  return (
    <div
      className={`group relative cursor-pointer transition-colors px-4 py-3 border-b border-eg/5 last:border-0 hover:bg-eg/5 overflow-hidden ${
        !notification.is_read ? 'bg-eg/[0.03]' : ''
      }`}
      onClick={handleClick}
    >
      {/* Unread indicator dot */}
      {!notification.is_read && (
        <div className="absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-eg shadow-[0_0_6px_rgba(0,255,136,0.6)]" />
      )}

      <div className="pl-2.5 pr-1 min-w-0">
        <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
          <TypeBadge type={notification.notification_type} />
          <span className="font-mono-custom text-[9px] text-white/30 flex-shrink-0">
            {formatRelativeTime(notification.created_at)}
          </span>
        </div>

        {/* Title — wraps properly, breaks long words */}
        <h4 className={`font-mono-custom text-xs font-semibold leading-snug break-words [overflow-wrap:anywhere] ${
          notification.is_read ? 'text-white/60' : 'text-white'
        }`}>
          {notification.title}
        </h4>

        {/* Message — line-clamped 3 lines preview, breaks long words/URLs */}
        <p className={`font-mono-custom text-[11px] text-white/50 mt-1 leading-relaxed break-words [overflow-wrap:anywhere] ${
          expanded ? 'whitespace-pre-wrap max-h-36 overflow-y-auto' : 'line-clamp-3'
        }`}>
          {notification.message}
        </p>

        {notification.message.length > 100 && (
          <span className="font-mono-custom text-[9px] text-eg/60 hover:text-eg transition-colors block mt-1">
            {expanded ? '▲ Show less' : '▼ Read more'}
          </span>
        )}
      </div>
    </div>
  );
};

// ─── Main NotificationBell component ─────────────────────────────────────────

interface NotificationBellProps {
  /** Extra CSS classes for the wrapper */
  className?: string;
  /** If true, shows active PUBLIC notifications only (for Home Page Navbar) */
  publicOnly?: boolean;
}

const NotificationBell: React.FC<NotificationBellProps> = ({ className = '', publicOnly = false }) => {
  const [isOpen, setIsOpen] = useState(false);

  // General notification hooks
  const defaultUnread = useUnreadCount();
  const defaultNotifs = useNotifications();

  // Public-only bell hook (for Navbar home page)
  const publicBell = usePublicBellNotifications();

  const notifications = publicOnly ? publicBell.notifications : defaultNotifs.notifications;
  const count = publicOnly ? publicBell.unreadCount : defaultUnread.count;
  const loading = publicOnly ? publicBell.loading : defaultNotifs.loading;
  const markRead = publicOnly ? publicBell.markRead : defaultNotifs.markRead;
  const markAllRead = publicOnly ? publicBell.markAllRead : defaultNotifs.markAllRead;
  const refresh = publicOnly ? publicBell.refresh : defaultNotifs.refresh;

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleMarkRead = useCallback(async (id: string) => {
    await markRead(id);
    if (!publicOnly) defaultUnread.refresh();
  }, [markRead, publicOnly, defaultUnread]);

  const handleMarkAllRead = useCallback(async () => {
    await markAllRead();
    if (!publicOnly) defaultUnread.refresh();
  }, [markAllRead, publicOnly, defaultUnread]);

  const handleOpen = () => {
    setIsOpen(v => !v);
    if (!isOpen) refresh();
  };

  const recentNotifications = notifications.slice(0, 8);
  const unreadCount = notifications.filter((n: NotificationWithRead) => !n.is_read).length;

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {/* Bell button */}
      <button
        id="notification-bell-btn"
        onClick={handleOpen}
        aria-label={`Notifications${count > 0 ? ` (${count} unread)` : ''}`}
        className="relative flex items-center justify-center w-9 h-9 rounded-xl border border-white/10 text-white/60 hover:text-eg hover:border-eg/30 hover:bg-eg/5 transition-all duration-200"
      >
        <BellIcon className="w-4.5 h-4.5" />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-eg text-dark text-[9px] font-bold font-mono-custom shadow-[0_0_8px_rgba(0,255,136,0.5)] px-1">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 max-w-[calc(100vw-2rem)] z-50 glass-dark rounded-2xl border border-eg/20 shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-eg/10">
            <div className="flex items-center gap-2">
              <BellIcon className="w-3.5 h-3.5 text-eg" />
              <span className="font-mono-custom text-[11px] tracking-widest text-white/80 uppercase">
                {publicOnly ? 'Public Notifications' : 'Notifications'}
              </span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-eg/15 border border-eg/30 text-eg text-[9px] font-mono-custom font-bold">
                  {unreadCount} unread
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="font-mono-custom text-[10px] text-white/40 hover:text-eg transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Notification list */}
          <div className="max-h-80 overflow-y-auto overflow-x-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-8 gap-2">
                <div className="w-4 h-4 rounded-full border border-eg/30 border-t-eg animate-spin" />
                <span className="font-mono-custom text-[10px] text-white/40">Loading...</span>
              </div>
            ) : recentNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <BellIcon className="w-8 h-8 text-white/10" />
                <p className="font-mono-custom text-[10px] text-white/30">No notifications</p>
              </div>
            ) : (
              recentNotifications.map((n: NotificationWithRead) => (
                <NotificationItem
                  key={n.id}
                  notification={n}
                  onMarkRead={handleMarkRead}
                />
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-eg/10">
            <Link
              to="/notifications"
              onClick={() => setIsOpen(false)}
              className="block w-full text-center font-mono-custom text-[10px] tracking-widest text-eg/70 hover:text-eg transition-colors py-1"
            >
              View All Notifications →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;

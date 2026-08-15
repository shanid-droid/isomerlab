import React, { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAdminNotifications } from '../../lib/notificationHooks';
import type { NotificationWithRead, NotificationType } from '../../lib/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

function AudienceBadge({ type, recipientName }: { type: NotificationType; recipientName?: string | null }) {
  if (type === 'public') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono-custom tracking-widest bg-eg/10 border border-eg/30 text-eg">
        🌐 PUBLIC
      </span>
    );
  }
  if (type === 'all_creators' || type === 'creators') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono-custom tracking-widest bg-purple-500/10 border border-purple-500/30 text-purple-400">
        ✦ CREATORS
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono-custom tracking-widest bg-blue-500/10 border border-blue-500/30 text-blue-400">
      🔒 PRIVATE {recipientName ? `→ ${recipientName}` : ''}
    </span>
  );
}

// ─── User Search for recipient picker ────────────────────────────────────────

interface UserSearchResult {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  avatar_url?: string | null;
}

function RecipientSearch({ onSelect, selected }: {
  onSelect: (user: UserSearchResult | null) => void;
  selected: UserSearchResult | null;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const search = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) { setResults([]); return; }
    setSearching(true);
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, avatar_url')
        .or(`full_name.ilike.%${trimmed}%,email.ilike.%${trimmed}%`)
        .order('full_name', { ascending: true })
        .limit(10);
      setResults((data as UserSearchResult[]) ?? []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, search]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const roleBadge = (role: string) => {
    if (role === 'creator') return <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 font-mono-custom">CREATOR</span>;
    if (role === 'admin') return <span className="text-[9px] px-1.5 py-0.5 rounded bg-eg/20 text-eg font-mono-custom">ADMIN</span>;
    return <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-mono-custom">USER</span>;
  };

  if (selected) {
    return (
      <div className="flex items-center gap-3 p-3 bg-dark-200/80 rounded-xl border border-eg/20">
        {selected.avatar_url ? (
          <img src={selected.avatar_url} alt="" className="w-8 h-8 rounded-lg object-cover border border-eg/20" />
        ) : (
          <div className="w-8 h-8 rounded-lg bg-dark-300 border border-eg/20 flex items-center justify-center text-eg text-xs font-bold flex-shrink-0">
            {(selected.full_name || selected.email || '?').slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-xs text-white font-mono-custom truncate">
            {selected.full_name || 'No name'}
            {selected.email ? ` — ${selected.email}` : ''}
          </div>
        </div>
        {roleBadge(selected.role)}
        <button
          type="button"
          onClick={() => { onSelect(null); setQuery(''); }}
          className="text-white/40 hover:text-red-400 text-xs font-mono-custom transition-colors ml-1"
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        placeholder="Search users by name or email..."
        value={query}
        onChange={e => { setQuery(e.target.value); setShowDropdown(true); }}
        onFocus={() => setShowDropdown(true)}
        className="w-full bg-dark-200/80 border border-eg/20 rounded-xl px-4 py-2.5 text-xs text-white placeholder-white/30 font-mono-custom focus:outline-none focus:border-eg transition-colors"
      />
      {searching && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="w-3 h-3 rounded-full border border-eg/40 border-t-eg animate-spin" />
        </div>
      )}
      {showDropdown && query.trim().length >= 2 && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-dark-100 border border-eg/20 rounded-xl shadow-xl overflow-hidden max-h-64 overflow-y-auto">
          {results.map(user => (
            <button
              key={user.id}
              type="button"
              onClick={() => { onSelect(user); setShowDropdown(false); setQuery(''); }}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-eg/5 text-left transition-colors border-b border-eg/5 last:border-0"
            >
              {user.avatar_url ? (
                <img src={user.avatar_url} alt="" className="w-8 h-8 rounded-lg object-cover border border-eg/20 flex-shrink-0" />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-dark-300 border border-eg/20 flex items-center justify-center text-eg text-xs font-bold flex-shrink-0">
                  {(user.full_name || user.email || '?').slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-xs text-white font-mono-custom truncate">{user.full_name || 'No name'}</div>
                {user.email && <div className="text-[10px] text-white/40 truncate">{user.email}</div>}
              </div>
              {roleBadge(user.role)}
            </button>
          ))}
        </div>
      )}
      {showDropdown && query.trim().length >= 2 && !searching && results.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-dark-100 border border-eg/20 rounded-xl shadow-xl px-4 py-3">
          <span className="text-xs text-white/40 font-mono-custom">No users found</span>
        </div>
      )}
    </div>
  );
}

// ─── Create / Edit Modal ──────────────────────────────────────────────────────

interface NotificationFormProps {
  editingNotification: NotificationWithRead | null;
  onClose: () => void;
  onSuccess: () => void;
}

function NotificationFormModal({ editingNotification, onClose, onSuccess }: NotificationFormProps) {
  const [type, setType] = useState<NotificationType>(editingNotification?.notification_type ?? 'public');
  const [title, setTitle] = useState(editingNotification?.title ?? '');
  const [message, setMessage] = useState(editingNotification?.message ?? '');
  const [expiresAt, setExpiresAt] = useState(
    editingNotification?.expires_at
      ? new Date(editingNotification.expires_at).toISOString().slice(0, 16)
      : ''
  );
  const [isActive, setIsActive] = useState(editingNotification?.is_active ?? true);
  const [recipient, setRecipient] = useState<{ id: string; full_name: string | null; email: string | null; role: string } | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!editingNotification;

  const confirmMessage = () => {
    if (type === 'private') return `Only ${recipient?.full_name || recipient?.email || 'the selected user'} will receive this notification.`;
    if (type === 'creators' || type === 'all_creators') return 'All approved creators will receive this notification.';
    return 'Everyone will be able to see this notification.';
  };

  const handlePrimary = () => {
    setError(null);
    if (!title.trim()) { setError('Title is required.'); return; }
    if (!message.trim()) { setError('Message is required.'); return; }
    if (type === 'private' && !recipient && !isEditing) { setError('Please select a recipient for private notifications.'); return; }
    setShowConfirm(true);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      if (isEditing) {
        const { error: rpcErr } = await supabase.rpc('update_notification', {
          p_id: editingNotification.id,
          p_title: title.trim(),
          p_message: message.trim(),
          p_expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
          p_is_active: isActive,
          p_metadata: null,
        });
        if (rpcErr) throw new Error(rpcErr.message);
      } else {
        const { error: rpcErr } = await supabase.rpc('create_notification', {
          p_title: title.trim(),
          p_message: message.trim(),
          p_audience: type,
          p_recipient_id: type === 'private' ? (recipient?.id ?? null) : null,
          p_expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
          p_metadata: {},
          p_notification_type: type,
          p_recipient_user_id: type === 'private' ? (recipient?.id ?? null) : null,
        });
        if (rpcErr) throw new Error(rpcErr.message);
      }
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError((err as Error)?.message ?? 'Failed to send notification');
      setShowConfirm(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-2xl glass rounded-2xl border border-eg/20 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-eg/10">
          <div>
            <h2 className="font-display text-base font-bold text-white tracking-wider">
              {isEditing ? 'EDIT NOTIFICATION' : 'CREATE NOTIFICATION'}
            </h2>
            <p className="font-mono-custom text-[10px] text-white/40 mt-0.5">
              {isEditing ? 'Update existing notification' : 'Send a new notification to your audience'}
            </p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors text-xl leading-none">✕</button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {error && (
            <div className="p-3 rounded-xl border border-red-500/40 bg-red-500/10 text-xs text-red-300 font-mono-custom">
              {error}
            </div>
          )}

          {/* Type selector (only for new notifications) */}
          {!isEditing && (
            <div className="space-y-2">
              <label className="font-mono-custom text-[10px] tracking-widest text-white/50 uppercase">
                Notification Type
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['public', 'private', 'creators'] as NotificationType[]).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={`px-3 py-2.5 rounded-xl text-[11px] font-mono-custom tracking-widest border transition-all ${
                      type === t
                        ? t === 'public'
                          ? 'bg-eg/15 border-eg/40 text-eg shadow-eg-sm'
                          : t === 'creators' || t === 'all_creators'
                          ? 'bg-purple-500/15 border-purple-500/40 text-purple-400'
                          : 'bg-blue-500/15 border-blue-500/40 text-blue-400'
                        : 'bg-white/5 border-white/10 text-white/50 hover:border-white/20'
                    }`}
                  >
                    {t === 'public' ? '🌐 PUBLIC' : t === 'creators' || t === 'all_creators' ? '✦ CREATORS' : '🔒 PRIVATE'}
                  </button>
                ))}
              </div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-[10px] text-white/40 font-mono-custom">
                {type === 'public' && '🌐 Visible to everyone, including anonymous visitors.'}
                {type === 'private' && '🔒 Only the selected recipient will see this notification.'}
                {(type === 'creators' || type === 'all_creators') && '✦ Visible to every user with Creator status.'}
              </div>
            </div>
          )}

          {/* All Creators recipient display */}
          {(type === 'creators' || type === 'all_creators') && !isEditing && (
            <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-between">
              <span className="font-mono-custom text-xs text-purple-300 font-medium">Recipients: All Creators</span>
              <span className="text-[10px] font-mono-custom text-purple-400 bg-purple-500/20 px-2 py-0.5 rounded tracking-wider uppercase">AUTOMATIC</span>
            </div>
          )}

          {/* Recipient picker (private only) */}
          {type === 'private' && !isEditing && (
            <div className="space-y-2">
              <label className="font-mono-custom text-[10px] tracking-widest text-white/50 uppercase">
                Recipient <span className="text-red-400">*</span>
              </label>
              <RecipientSearch
                selected={recipient}
                onSelect={setRecipient}
              />
            </div>
          )}
          {type === 'private' && isEditing && editingNotification?.recipient_name && (
            <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/20">
              <span className="font-mono-custom text-[10px] text-white/40">Recipient: </span>
              <span className="font-mono-custom text-xs text-blue-300">{editingNotification.recipient_name}</span>
            </div>
          )}

          {/* Title */}
          <div className="space-y-2">
            <label className="font-mono-custom text-[10px] tracking-widest text-white/50 uppercase">
              Title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Notification title..."
              maxLength={200}
              className="w-full bg-dark-200/80 border border-eg/20 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 font-mono-custom focus:outline-none focus:border-eg transition-colors"
            />
          </div>

          {/* Message */}
          <div className="space-y-2">
            <label className="font-mono-custom text-[10px] tracking-widest text-white/50 uppercase">
              Message <span className="text-red-400">*</span>
            </label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Notification message..."
              rows={5}
              className="w-full bg-dark-200/80 border border-eg/20 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 font-mono-custom focus:outline-none focus:border-eg transition-colors resize-none"
            />
          </div>

          {/* Expiration */}
          <div className="space-y-2">
            <label className="font-mono-custom text-[10px] tracking-widest text-white/50 uppercase">
              Expiration (Optional)
            </label>
            <input
              type="datetime-local"
              value={expiresAt}
              onChange={e => setExpiresAt(e.target.value)}
              className="w-full bg-dark-200/80 border border-eg/20 rounded-xl px-4 py-2.5 text-xs text-white font-mono-custom focus:outline-none focus:border-eg transition-colors"
            />
            <p className="text-[10px] text-white/30 font-mono-custom">Leave blank for no expiration.</p>
          </div>

          {/* Active toggle (edit mode only) */}
          {isEditing && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
              <button
                type="button"
                onClick={() => setIsActive(v => !v)}
                className={`relative w-10 h-5 rounded-full transition-colors ${isActive ? 'bg-eg' : 'bg-white/20'}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${isActive ? 'left-5.5 translate-x-0.5' : 'left-0.5'}`} />
              </button>
              <span className="font-mono-custom text-xs text-white/60">
                {isActive ? 'Active — visible to users' : 'Inactive — hidden from users'}
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-eg/10 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-mono-custom text-white/60 hover:text-white border border-white/10 hover:border-white/20 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handlePrimary}
            className="btn-primary text-xs py-2 px-5"
          >
            {isEditing ? 'Update Notification' : 'Send Notification →'}
          </button>
        </div>
      </div>

      {/* Confirmation overlay */}
      {showConfirm && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md glass rounded-2xl border border-eg/30 p-6 space-y-4">
            <h3 className="font-display text-base font-bold text-white tracking-wider">
              {isEditing ? 'Confirm Update?' : 'Send this notification?'}
            </h3>
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
              <div className="flex items-center gap-2">
                <AudienceBadge type={type} recipientName={recipient?.full_name || recipient?.email} />
              </div>
              <p className="font-mono-custom text-xs text-white font-semibold">{title}</p>
              <p className="font-mono-custom text-[11px] text-white/60 leading-relaxed">{confirmMessage()}</p>
            </div>
            {error && (
              <div className="p-3 rounded-xl border border-red-500/40 bg-red-500/10 text-xs text-red-300 font-mono-custom">
                {error}
              </div>
            )}
            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={submitting}
                className="px-4 py-2 rounded-xl text-xs font-mono-custom text-white/60 hover:text-white border border-white/10 transition-colors"
              >
                Go Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="btn-primary text-xs py-2 px-5 flex items-center gap-2"
              >
                {submitting ? (
                  <><div className="w-3 h-3 rounded-full border border-dark/40 border-t-dark animate-spin" /> Sending...</>
                ) : (
                  isEditing ? '✓ Confirm Update' : '✓ Confirm & Send'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── View Notification Modal ──────────────────────────────────────────────────

function NotificationViewModal({ notification, onClose }: { notification: NotificationWithRead; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-lg glass rounded-2xl border border-eg/20 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-eg/10">
          <div className="flex items-center gap-3">
            <AudienceBadge type={notification.notification_type} recipientName={notification.recipient_name} />
            <span className="font-mono-custom text-[10px] text-white/30">{formatDate(notification.created_at)}</span>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors text-xl leading-none">✕</button>
        </div>
        <div className="p-6 space-y-4">
          <h3 className="font-display text-lg font-bold text-white tracking-wider">{notification.title}</h3>
          <p className="font-mono-custom text-sm text-white/70 leading-relaxed whitespace-pre-wrap">{notification.message}</p>
          <div className="pt-4 border-t border-eg/10 flex flex-wrap gap-4 text-[10px] font-mono-custom text-white/40">
            <span>Sender: <span className="text-white/60">{notification.sender_name ?? 'Unknown'}</span></span>
            {notification.expires_at && (
              <span>Expires: <span className="text-amber-400">{formatDate(notification.expires_at)}</span></span>
            )}
            <span>Status: <span className={notification.is_active ? 'text-eg' : 'text-red-400'}>{notification.is_active ? 'Active' : 'Inactive'}</span></span>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-eg/10">
          <button onClick={onClose} className="w-full py-2 rounded-xl text-xs font-mono-custom text-white/60 hover:text-white border border-white/10 hover:border-white/20 transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

const NotificationsPanel: React.FC = () => {
  const { notifications, loading, error, refresh } = useAdminNotifications();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingNotification, setEditingNotification] = useState<NotificationWithRead | null>(null);
  const [viewingNotification, setViewingNotification] = useState<NotificationWithRead | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<NotificationWithRead | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'all' | NotificationType>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = notifications.filter(n => {
    if (filterType !== 'all') {
      if (filterType === 'creators' && n.notification_type !== 'creators' && n.notification_type !== 'all_creators') return false;
      if (filterType !== 'creators' && n.notification_type !== filterType) return false;
    }
    if (searchQuery && !n.title.toLowerCase().includes(searchQuery.toLowerCase()) && !n.message.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const { error: rpcErr } = await supabase.rpc('delete_notification', { p_id: deleteTarget.id });
      if (rpcErr) throw new Error(rpcErr.message);
      setDeleteTarget(null);
      await refresh();
    } catch (err: unknown) {
      setDeleteError((err as Error)?.message ?? 'Failed to delete notification');
    } finally {
      setDeleting(false);
    }
  };

  const publicCount = notifications.filter(n => n.notification_type === 'public').length;
  const privateCount = notifications.filter(n => n.notification_type === 'private').length;
  const creatorCount = notifications.filter(n => n.notification_type === 'creators' || n.notification_type === 'all_creators').length;
  const activeCount = notifications.filter(n => n.is_active).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="font-display text-lg font-bold text-white tracking-wider">NOTIFICATION CENTER</h2>
          <p className="font-mono-custom text-[10px] text-white/40 mt-1">Manage and send notifications to users</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary text-xs py-2 px-5 flex items-center gap-2"
        >
          <span className="text-sm leading-none">+</span>
          CREATE NOTIFICATION
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'TOTAL', value: notifications.length, color: 'text-white' },
          { label: 'PUBLIC', value: publicCount, color: 'text-eg' },
          { label: 'PRIVATE', value: privateCount, color: 'text-blue-400' },
          { label: 'CREATORS', value: creatorCount, color: 'text-purple-400' },
        ].map(s => (
          <div key={s.label} className="glass rounded-xl p-4 border border-eg/15">
            <p className="font-mono-custom text-[10px] tracking-widest text-white/40 uppercase mb-1">{s.label}</p>
            <p className={`font-display text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="glass rounded-xl p-4 border border-eg/15 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Search notifications..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-dark-200/80 border border-eg/20 rounded-xl px-4 py-2.5 text-xs text-white placeholder-white/30 font-mono-custom focus:outline-none focus:border-eg transition-colors"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {(['all', 'public', 'private', 'creators'] as const).map(f => (
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
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-xl border border-red-500/40 bg-red-500/10 text-xs text-red-300 font-mono-custom">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12 gap-3">
          <div className="w-5 h-5 rounded-full border-2 border-eg/30 border-t-eg animate-spin" />
          <span className="font-mono-custom text-xs text-white/40">Loading notifications...</span>
        </div>
      )}

      {/* Table */}
      {!loading && (
        <div className="glass rounded-xl border border-eg/15 overflow-hidden">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="w-14 h-14 rounded-xl bg-eg/5 border border-eg/15 flex items-center justify-center text-2xl">🔔</div>
              <div className="text-center">
                <p className="font-mono-custom text-xs text-white/50">No notifications found</p>
                <p className="font-mono-custom text-[10px] text-white/30 mt-1">
                  {notifications.length === 0 ? 'Click "Create Notification" to send your first notification.' : 'Try adjusting your filters.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-eg/10">
                    {['TITLE', 'AUDIENCE', 'SENDER', 'DATE', 'STATUS', 'ACTIONS'].map(h => (
                      <th key={h} className="px-4 py-3 text-left font-mono-custom text-[9px] tracking-widest text-white/30 uppercase">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((n, i) => (
                    <tr
                      key={n.id}
                      className={`border-b border-eg/5 last:border-0 hover:bg-eg/3 transition-colors ${i % 2 === 0 ? '' : 'bg-white/[0.015]'}`}
                    >
                      <td className="px-4 py-3 max-w-xs">
                        <p className="font-mono-custom text-xs text-white truncate">{n.title}</p>
                        <p className="font-mono-custom text-[10px] text-white/30 truncate max-w-[200px]">{n.message}</p>
                      </td>
                      <td className="px-4 py-3">
                        <AudienceBadge type={n.notification_type} recipientName={n.recipient_name} />
                        {n.notification_type === 'private' && n.recipient_name && (
                          <p className="font-mono-custom text-[9px] text-white/30 mt-1">→ {n.recipient_name}</p>
                        )}
                        {n.notification_type === 'all_creators' && (
                          <p className="font-mono-custom text-[9px] text-white/30 mt-1">ALL CREATORS</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono-custom text-xs text-white/60">{n.sender_name ?? '—'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono-custom text-[10px] text-white/40 whitespace-nowrap">{formatDate(n.created_at)}</span>
                        {n.expires_at && (
                          <p className="font-mono-custom text-[9px] text-amber-400 mt-0.5">
                            Exp: {formatDate(n.expires_at)}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {n.is_active ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono-custom text-eg">
                            <span className="w-1.5 h-1.5 rounded-full bg-eg animate-pulse" />
                            ACTIVE
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono-custom text-white/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-white/20" />
                            INACTIVE
                          </span>
                        )}
                        {n.expires_at && new Date(n.expires_at) <= new Date() && (
                          <p className="font-mono-custom text-[9px] text-red-400 mt-0.5">EXPIRED</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setViewingNotification(n)}
                            className="px-2.5 py-1 rounded-lg text-[10px] font-mono-custom border border-white/10 text-white/50 hover:border-eg/40 hover:text-eg transition-colors"
                          >
                            VIEW
                          </button>
                          <button
                            onClick={() => setEditingNotification(n)}
                            className="px-2.5 py-1 rounded-lg text-[10px] font-mono-custom border border-white/10 text-white/50 hover:border-eg/40 hover:text-eg transition-colors"
                          >
                            EDIT
                          </button>
                          <button
                            onClick={() => setDeleteTarget(n)}
                            className="px-2.5 py-1 rounded-lg text-[10px] font-mono-custom border border-white/10 text-white/50 hover:border-red-500/40 hover:text-red-400 transition-colors"
                          >
                            DELETE
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Active count footer */}
      {!loading && notifications.length > 0 && (
        <p className="font-mono-custom text-[10px] text-white/30 text-right">
          {activeCount} active · {notifications.length} total notifications
        </p>
      )}

      {/* Modals */}
      {(showCreateModal || editingNotification) && (
        <NotificationFormModal
          editingNotification={editingNotification}
          onClose={() => { setShowCreateModal(false); setEditingNotification(null); }}
          onSuccess={refresh}
        />
      )}

      {viewingNotification && (
        <NotificationViewModal
          notification={viewingNotification}
          onClose={() => setViewingNotification(null)}
        />
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-sm glass rounded-2xl border border-red-500/30 p-6 space-y-4">
            <h3 className="font-display text-base font-bold text-white tracking-wider">DELETE NOTIFICATION?</h3>
            <div className="p-3 rounded-xl bg-white/5 border border-white/10">
              <p className="font-mono-custom text-xs text-white font-semibold">{deleteTarget.title}</p>
              <div className="mt-1">
                <AudienceBadge type={deleteTarget.notification_type} recipientName={deleteTarget.recipient_name} />
              </div>
            </div>
            <p className="font-mono-custom text-xs text-white/50">
              This will permanently delete the notification and all associated read records. This action cannot be undone.
            </p>
            {deleteError && (
              <div className="p-3 rounded-xl border border-red-500/40 bg-red-500/10 text-xs text-red-300 font-mono-custom">
                {deleteError}
              </div>
            )}
            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => { setDeleteTarget(null); setDeleteError(null); }}
                disabled={deleting}
                className="px-4 py-2 rounded-xl text-xs font-mono-custom text-white/60 hover:text-white border border-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 rounded-xl text-xs font-mono-custom bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30 transition-colors flex items-center gap-2"
              >
                {deleting ? (
                  <><div className="w-3 h-3 rounded-full border border-red-300/40 border-t-red-300 animate-spin" /> Deleting...</>
                ) : '✕ Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationsPanel;

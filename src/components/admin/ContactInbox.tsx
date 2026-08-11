import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { ACCESS_DENIED_MESSAGE, isAccessDeniedError } from '../../lib/activityLog';
import type { ContactMessage, ContactMessageStatus } from '../../lib/types';

type StatusFilter = 'all' | ContactMessageStatus;
type SortOrder = 'newest' | 'oldest';

interface ContactInboxProps {
  onCountsChange?: (counts: { unread: number; total: number; archived: number }) => void;
}

const ContactInbox: React.FC<ContactInboxProps> = ({ onCountsChange }) => {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [selectedMessage, setSelectedMessage] = useState<ContactMessage | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('contact_messages')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) {
        if (isAccessDeniedError(fetchError)) {
          setError(ACCESS_DENIED_MESSAGE);
          setMessages([]);
          return;
        }
        throw fetchError;
      }
      setMessages((data as ContactMessage[]) ?? []);
    } catch {
      setError('Unable to load messages. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const counts = useMemo(() => ({
    unread: messages.filter(m => m.status === 'unread').length,
    total: messages.length,
    archived: messages.filter(m => m.status === 'archived').length,
  }), [messages]);

  useEffect(() => {
    onCountsChange?.(counts);
  }, [counts, onCountsChange]);

  const filteredMessages = useMemo(() => {
    let result = [...messages];

    if (statusFilter !== 'all') {
      result = result.filter(m => m.status === statusFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(m =>
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        (m.subject?.toLowerCase().includes(q) ?? false) ||
        m.message.toLowerCase().includes(q)
      );
    }

    result.sort((a, b) => {
      const diff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return sortOrder === 'newest' ? -diff : diff;
    });

    return result;
  }, [messages, statusFilter, searchQuery, sortOrder]);

  const updateMessageStatus = async (id: string, status: ContactMessageStatus) => {
    setActionLoading(true);
    try {
      const { error: updateError } = await supabase
        .from('contact_messages')
        .update({ status })
        .eq('id', id);

      if (updateError) throw updateError;

      setMessages(prev => prev.map(m => m.id === id ? { ...m, status } : m));
      setSelectedMessage(prev => prev?.id === id ? { ...prev, status } : prev);
    } catch {
      alert('Unable to update message. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const deleteMessage = async (id: string) => {
    if (!confirm('Delete this message permanently?')) return;
    setActionLoading(true);
    try {
      const { error: deleteError } = await supabase
        .from('contact_messages')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      setMessages(prev => prev.filter(m => m.id !== id));
      if (selectedMessage?.id === id) setSelectedMessage(null);
    } catch (err: unknown) {
      alert('Unable to delete message. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const openMessage = async (msg: ContactMessage) => {
    setSelectedMessage(msg);
    if (msg.status === 'unread') {
      await updateMessageStatus(msg.id, 'read');
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true,
    });

  const previewText = (text: string, max = 80) =>
    text.length > max ? text.slice(0, max) + '…' : text;

  const statusBadge = (status: ContactMessageStatus) => {
    const styles: Record<ContactMessageStatus, string> = {
      unread: 'bg-eg/20 text-eg border-eg/40',
      read: 'bg-white/10 text-white/60 border-white/20',
      archived: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    };
    return (
      <span className={`font-mono-custom text-[9px] tracking-widest uppercase px-2 py-0.5 rounded border ${styles[status]}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass rounded-xl p-5 border border-eg/15 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-eg/10 rounded-bl-full pointer-events-none" />
          <p className="font-mono-custom text-[10px] tracking-widest text-eg uppercase mb-1">UNREAD</p>
          <p className="font-display text-3xl font-bold text-eg text-glow-sm">{counts.unread}</p>
        </div>
        <div className="glass rounded-xl p-5 border border-eg/15 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-eg/5 rounded-bl-full pointer-events-none" />
          <p className="font-mono-custom text-[10px] tracking-widest text-white/40 uppercase mb-1">TOTAL MESSAGES</p>
          <p className="font-display text-3xl font-bold text-white">{counts.total}</p>
        </div>
        <div className="glass rounded-xl p-5 border border-eg/15 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-amber-500/10 rounded-bl-full pointer-events-none" />
          <p className="font-mono-custom text-[10px] tracking-widest text-amber-400 uppercase mb-1">ARCHIVED</p>
          <p className="font-display text-3xl font-bold text-amber-300">{counts.archived}</p>
        </div>
      </div>

      {/* Search & filters */}
      <div className="glass rounded-xl p-6 border border-eg/20 flex flex-col md:flex-row items-stretch md:items-center gap-4">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Search messages..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-dark-200/80 border border-eg/20 rounded-xl px-4 py-2.5 text-xs text-white placeholder-white/30 font-mono-custom focus:outline-none focus:border-eg"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white text-xs"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 bg-dark-200/60 p-1 rounded-xl border border-eg/10 flex-wrap">
          {(['all', 'unread', 'read', 'archived'] as StatusFilter[]).map(f => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-3 py-1.5 rounded-lg font-mono-custom text-[11px] uppercase transition-all ${
                statusFilter === f ? 'bg-eg/20 text-eg font-semibold' : 'text-white/40 hover:text-white'
              }`}
            >
              {f === 'all' ? `All (${counts.total})` :
               f === 'unread' ? `Unread (${counts.unread})` :
               f === 'archived' ? `Archived (${counts.archived})` :
               `Read (${messages.filter(m => m.status === 'read').length})`}
            </button>
          ))}
        </div>

        <select
          value={sortOrder}
          onChange={e => setSortOrder(e.target.value as SortOrder)}
          className="bg-dark-200/80 border border-eg/20 rounded-xl px-3 py-2.5 text-xs text-white font-mono-custom focus:outline-none focus:border-eg"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>
      </div>

      {error && (
        <div className="p-4 rounded-xl border border-red-500/40 bg-red-500/10 flex items-center justify-between">
          <p className="font-mono-custom text-xs text-red-300">{error}</p>
          <button onClick={fetchMessages} className="btn-primary text-[10px] py-1 px-3">RETRY</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Message list */}
        <div className="lg:col-span-2 space-y-2">
          <p className="font-mono-custom text-[10px] tracking-widest text-white/40 uppercase mb-3">
            CONTACT MESSAGES ({filteredMessages.length})
          </p>

          {loading ? (
            <div className="glass rounded-xl p-8 border border-eg/10 text-center">
              <div className="w-8 h-8 rounded-full border-2 border-eg/30 border-t-eg animate-spin mx-auto mb-3" />
              <p className="font-mono-custom text-xs text-white/40">Loading messages...</p>
            </div>
          ) : filteredMessages.length === 0 ? (
            <div className="glass rounded-xl p-8 border border-eg/10 text-center">
              <p className="font-mono-custom text-xs text-white/40">No messages found.</p>
            </div>
          ) : (
            filteredMessages.map(msg => (
              <button
                key={msg.id}
                onClick={() => openMessage(msg)}
                className={`w-full text-left glass rounded-xl p-4 border transition-all ${
                  selectedMessage?.id === msg.id
                    ? 'border-eg/40 bg-eg/5 shadow-eg-sm'
                    : 'border-eg/10 hover:border-eg/25 hover:bg-white/3'
                }`}
              >
                <div className="flex items-start gap-3">
                  {msg.status === 'unread' && (
                    <span className="w-2 h-2 rounded-full bg-eg shadow-[0_0_8px_rgba(0,255,136,0.6)] flex-shrink-0 mt-1.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="font-sans text-sm text-white font-medium truncate">{msg.name}</p>
                      {statusBadge(msg.status)}
                    </div>
                    <p className="font-mono-custom text-[10px] text-eg/60 truncate mb-1">{msg.email}</p>
                    {msg.subject && (
                      <p className="font-sans text-xs text-white/70 truncate mb-1">{msg.subject}</p>
                    )}
                    <p className="font-sans text-xs text-white/40 truncate">{previewText(msg.message)}</p>
                    <p className="font-mono-custom text-[9px] text-white/25 mt-2">{formatDate(msg.created_at)}</p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Detail panel */}
        <div className="lg:col-span-3">
          {selectedMessage ? (
            <div className="glass rounded-xl border border-eg/20 p-6 space-y-5 sticky top-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    {selectedMessage.status === 'unread' && (
                      <span className="w-2 h-2 rounded-full bg-eg animate-pulse" />
                    )}
                    <h3 className="font-display text-sm tracking-wider text-white">{selectedMessage.name}</h3>
                    {statusBadge(selectedMessage.status)}
                  </div>
                  <a
                    href={`mailto:${selectedMessage.email}?subject=Re: ${encodeURIComponent(selectedMessage.subject ?? 'Your message to ISOMER LAB')}`}
                    className="font-mono-custom text-xs text-eg hover:text-eg/80 transition-colors"
                  >
                    {selectedMessage.email}
                  </a>
                </div>
                <button
                  onClick={() => setSelectedMessage(null)}
                  className="text-white/40 hover:text-white text-sm"
                >
                  ✕
                </button>
              </div>

              {selectedMessage.subject && (
                <div>
                  <p className="font-mono-custom text-[10px] tracking-widest text-white/40 uppercase mb-1">Subject</p>
                  <p className="font-sans text-sm text-white">{selectedMessage.subject}</p>
                </div>
              )}

              <div>
                <p className="font-mono-custom text-[10px] tracking-widest text-white/40 uppercase mb-1">Message</p>
                <p className="font-sans text-sm text-white/80 leading-relaxed whitespace-pre-wrap">
                  {selectedMessage.message}
                </p>
              </div>

              <p className="font-mono-custom text-[10px] text-white/30">
                Received: {formatDate(selectedMessage.created_at)}
              </p>

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-eg/10">
                {selectedMessage.status !== 'read' && (
                  <button
                    disabled={actionLoading}
                    onClick={() => updateMessageStatus(selectedMessage.id, 'read')}
                    className="px-3 py-1.5 rounded-lg border border-eg/30 bg-eg/10 text-eg font-mono-custom text-[10px] tracking-wider hover:bg-eg/20 transition-colors disabled:opacity-50"
                  >
                    Mark as read
                  </button>
                )}
                {selectedMessage.status !== 'unread' && (
                  <button
                    disabled={actionLoading}
                    onClick={() => updateMessageStatus(selectedMessage.id, 'unread')}
                    className="px-3 py-1.5 rounded-lg border border-white/20 bg-white/5 text-white/70 font-mono-custom text-[10px] tracking-wider hover:bg-white/10 transition-colors disabled:opacity-50"
                  >
                    Mark as unread
                  </button>
                )}
                {selectedMessage.status !== 'archived' && (
                  <button
                    disabled={actionLoading}
                    onClick={() => updateMessageStatus(selectedMessage.id, 'archived')}
                    className="px-3 py-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-300 font-mono-custom text-[10px] tracking-wider hover:bg-amber-500/20 transition-colors disabled:opacity-50"
                  >
                    Archive
                  </button>
                )}
                <button
                  disabled={actionLoading}
                  onClick={() => deleteMessage(selectedMessage.id)}
                  className="px-3 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 font-mono-custom text-[10px] tracking-wider hover:bg-red-500/20 transition-colors disabled:opacity-50"
                >
                  Delete
                </button>
                <a
                  href={`mailto:${selectedMessage.email}?subject=Re: ${encodeURIComponent(selectedMessage.subject ?? 'Your message to ISOMER LAB')}&body=${encodeURIComponent(`Hi ${selectedMessage.name},\n\nThank you for reaching out to ISOMER LAB.\n\n`)}`}
                  className="ml-auto btn-primary py-1.5 px-4 text-[10px] flex items-center gap-1.5"
                >
                  Reply by email ↗
                </a>
              </div>
            </div>
          ) : (
            <div className="glass rounded-xl border border-eg/10 p-12 text-center">
              <div className="w-12 h-12 rounded-full border border-eg/20 flex items-center justify-center mx-auto mb-4">
                <span className="text-xl opacity-40">✉</span>
              </div>
              <p className="font-mono-custom text-xs text-white/40">
                Select a message to view details
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContactInbox;

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import type { ProjectCommentWithProfile } from '../../lib/types';

export const CommentsManagementPanel: React.FC = () => {
  const [comments, setComments] = useState<(ProjectCommentWithProfile & { project_title?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'deleted'>('all');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 3500);
  };

  const fetchComments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch raw comments
      const { data: rawComments, error: err } = await supabase
        .from('project_comments')
        .select('*')
        .order('created_at', { ascending: false });

      if (err) throw err;
      const list = rawComments || [];

      // Fetch profiles & projects
      const userIds = Array.from(new Set(list.map(c => c.user_id)));
      const projectIds = Array.from(new Set(list.map(c => c.project_id)));

      let profileMap: Record<string, { full_name: string | null; role: string }> = {};
      let projectMap: Record<string, string> = {};

      if (userIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('id, full_name, role').in('id', userIds);
        if (profiles) {
          profileMap = profiles.reduce((acc, p) => { acc[p.id] = { full_name: p.full_name, role: p.role }; return acc; }, {} as typeof profileMap);
        }
      }

      if (projectIds.length > 0) {
        const { data: projects } = await supabase.from('projects').select('id, title').in('id', projectIds);
        if (projects) {
          projectMap = projects.reduce((acc, p) => { acc[p.id] = p.title; return acc; }, {} as typeof projectMap);
        }
      }

      const enriched = list.map(c => ({
        ...c,
        author_name: profileMap[c.user_id]?.full_name ?? 'Creator',
        author_role: (profileMap[c.user_id]?.role as any) ?? 'creator',
        project_title: projectMap[c.project_id] ?? 'Project',
      }));

      setComments(enriched);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load comments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchComments(); }, [fetchComments]);

  const handleDelete = async () => {
    if (!confirmDeleteId) return;
    setProcessingId(confirmDeleteId);
    try {
      const { error } = await supabase.rpc('soft_delete_project_comment', { p_comment_id: confirmDeleteId });
      if (error) throw error;
      setConfirmDeleteId(null);
      await fetchComments();
      showToast('Comment deleted successfully.');
    } catch (err: any) {
      showToast(err.message ?? 'Failed to delete comment', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const filtered = comments.filter(c => {
    const matchesStatus =
      filterStatus === 'all' ? true :
      filterStatus === 'active' ? !c.deleted_at :
      !!c.deleted_at;

    const q = searchQuery.toLowerCase().trim();
    const matchesQuery = !q ||
      c.content.toLowerCase().includes(q) ||
      (c.author_name || '').toLowerCase().includes(q) ||
      (c.project_title || '').toLowerCase().includes(q);

    return matchesStatus && matchesQuery;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="font-display text-lg font-bold text-white tracking-wider">PROJECT COMMENTS MODERATION</h2>
          <p className="font-mono-custom text-[10px] text-white/40 mt-1">{comments.length} total comments</p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search creator, project, content..."
            className="bg-dark-200/80 border border-eg/20 rounded-xl px-4 py-2 text-xs text-white placeholder-white/30 font-mono-custom focus:outline-none focus:border-eg"
          />

          <div className="flex gap-1 bg-dark-200/60 p-1 rounded-xl border border-eg/10">
            {(['all', 'active', 'deleted'] as const).map(s => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-3 py-1 rounded-lg font-mono-custom text-[10px] uppercase transition-all ${
                  filterStatus === s ? 'bg-eg/20 text-eg' : 'text-white/40 hover:text-white'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {toastMsg && (
        <div className={`p-4 rounded-xl border font-mono-custom text-xs flex items-center justify-between gap-3 animate-fade-in ${
          toastMsg.type === 'success'
            ? 'border-eg/40 bg-eg/10 text-eg'
            : 'border-red-500/40 bg-red-500/10 text-red-300'
        }`}>
          <span>{toastMsg.type === 'success' ? '✓ ' : '✕ '}{toastMsg.text}</span>
          <button onClick={() => setToastMsg(null)} className="text-white/40 hover:text-white text-xs">✕</button>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl border border-red-500/40 bg-red-500/10 text-xs text-red-300 font-mono-custom">{error}</div>
      )}

      <div className="glass rounded-xl border border-eg/20 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center"><div className="w-8 h-8 rounded-full border-2 border-eg/30 border-t-eg animate-spin mx-auto" /></div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center font-mono-custom text-xs text-white/40">NO COMMENTS FOUND</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-eg/10 bg-dark-200/50 font-mono-custom text-[10px] text-white/50 uppercase tracking-widest">
                  <th className="py-3 px-4">AUTHOR</th>
                  <th className="py-3 px-4">PROJECT</th>
                  <th className="py-3 px-4">COMMENT CONTENT</th>
                  <th className="py-3 px-4">DATE</th>
                  <th className="py-3 px-4">STATUS</th>
                  <th className="py-3 px-4 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-eg/10">
                {filtered.map(c => {
                  const isDeleted = !!c.deleted_at;
                  return (
                    <tr key={c.id} className="hover:bg-eg/5">
                      <td className="py-3 px-4 font-medium text-white">
                        <div>
                          <p>{c.author_name}</p>
                          <span className="font-mono-custom text-[9px] text-white/40 uppercase">{c.author_role}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-eg/80 font-mono-custom text-[11px] truncate max-w-[150px]">{c.project_title}</td>
                      <td className="py-3 px-4 text-white/80 max-w-xs break-words">
                        {isDeleted ? (
                          <span className="italic text-white/30">(Deleted: {c.content})</span>
                        ) : (
                          c.content
                        )}
                      </td>
                      <td className="py-3 px-4 text-white/40 font-mono-custom text-[10px]">{new Date(c.created_at).toLocaleDateString()}</td>
                      <td className="py-3 px-4">
                        {isDeleted ? (
                          <span className="font-mono-custom text-[10px] px-2 py-0.5 rounded border border-red-500/30 bg-red-500/10 text-red-400 uppercase">DELETED</span>
                        ) : c.is_pinned ? (
                          <span className="font-mono-custom text-[10px] px-2 py-0.5 rounded border border-eg/30 bg-eg/10 text-eg uppercase font-semibold">📌 PINNED</span>
                        ) : (
                          <span className="font-mono-custom text-[10px] px-2 py-0.5 rounded border border-blue-500/30 bg-blue-500/10 text-blue-400 uppercase">ACTIVE</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {!isDeleted && (
                          <button
                            onClick={() => setConfirmDeleteId(c.id)}
                            disabled={processingId === c.id}
                            className="px-2.5 py-1 rounded border border-red-500/30 text-red-400 hover:bg-red-500/10 font-mono-custom text-[10px]"
                          >
                            DELETE
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Comment Confirm Dialog */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="glass rounded-2xl border border-red-500/40 p-6 max-w-md w-full space-y-4">
            <h3 className="font-display text-sm font-bold text-white">Delete Comment</h3>
            <p className="font-sans text-xs text-white/70">
              Are you sure you want to permanently moderate and soft-delete this project comment?
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                disabled={!!processingId}
                className="px-4 py-2 rounded-xl border border-white/15 font-mono-custom text-xs text-white/60 hover:text-white hover:border-white/30 transition-colors"
              >
                CANCEL
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={!!processingId}
                className="px-4 py-2 rounded-xl font-mono-custom text-xs bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30 transition-colors flex items-center gap-2"
              >
                {processingId && <span className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />}
                {processingId ? 'DELETING...' : 'DELETE COMMENT'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

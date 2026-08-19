import React, { useState } from 'react';
import { useUserProfile } from '../lib/hooks';
import { useProjectComments } from '../lib/projectInteractionHooks';
import { ConfirmDialog } from './ui/ConfirmDialog';
import type { ProjectCommentWithProfile } from '../lib/types';
import { isAdminRole, isCreatorRole, isOwner } from '../lib/roles';

interface ProjectCommentsSectionProps {
  projectId: string;
  projectOwnerId?: string | null;
  className?: string;
}

function formatDate(iso: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);

  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export const ProjectCommentsSection: React.FC<ProjectCommentsSectionProps> = ({
  projectId,
  projectOwnerId,
  className = '',
}) => {
  const { profile } = useUserProfile();
  const {
    comments,
    commentCount,
    loading,
    submitting,
    postComment,
    pinComment,
    softDeleteComment,
    editComment,
  } = useProjectComments(projectId);

  const [topCommentInput, setTopCommentInput] = useState('');
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyInput, setReplyInput] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editInput, setEditInput] = useState('');
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const currentUserId = profile?.id ?? null;
  const isProjectOwner = !!currentUserId && !!projectOwnerId && currentUserId === projectOwnerId;
  const isAdmin = isAdminRole(profile?.role) || isOwner(profile);
  const canPostTopComment = isCreatorRole(profile?.role) || isAdmin;
  const canReply = isProjectOwner || isAdmin;

  const handleTopSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topCommentInput.trim()) return;
    try {
      await postComment(topCommentInput.trim(), null);
      setTopCommentInput('');
    } catch {
      // Handled in hook
    }
  };

  const handleReplySubmit = async (e: React.FormEvent, parentId: string) => {
    e.preventDefault();
    if (!replyInput.trim()) return;
    try {
      await postComment(replyInput.trim(), parentId);
      setReplyInput('');
      setReplyingToId(null);
    } catch {
      // Handled in hook
    }
  };

  const handleEditSubmit = async (e: React.FormEvent, commentId: string) => {
    e.preventDefault();
    if (!editInput.trim()) return;
    try {
      await editComment(commentId, editInput.trim());
      setEditingId(null);
      setEditInput('');
    } catch {
      // Handled in hook
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTargetId) return;
    setDeleting(true);
    try {
      await softDeleteComment(deleteTargetId);
      setDeleteTargetId(null);
    } finally {
      setDeleting(false);
    }
  };

  const renderSingleComment = (comment: ProjectCommentWithProfile, isReply = false) => {
    const isAuthor = !!currentUserId && currentUserId === comment.user_id;
    const canModify = isAuthor || isProjectOwner || isAdmin;
    const isDeleted = !!comment.deleted_at;
    const isEdited = !isDeleted && comment.updated_at && comment.updated_at !== comment.created_at;

    return (
      <div
        key={comment.id}
        className={`rounded-xl border transition-all relative w-full min-w-0 max-w-full overflow-hidden ${
          comment.is_pinned
            ? 'bg-eg/[0.04] border-eg/40 shadow-[0_0_20px_rgba(0,255,136,0.08)] p-4 sm:p-5'
            : isReply
            ? 'bg-dark-300/60 border-white/10 p-3.5 sm:p-4 ml-4 sm:ml-8 mt-2'
            : 'bg-dark-200/50 border-white/10 p-4 sm:p-5'
        }`}
      >
        {/* Pinned Badge */}
        {comment.is_pinned && (
          <div className="flex items-center gap-1.5 font-mono-custom text-[10px] text-eg font-semibold uppercase tracking-widest mb-2.5">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M16 3H5a2 2 0 00-2 2v14l7-3 7 3V5a2 2 0 00-2-2z"/></svg>
            PINNED
          </div>
        )}

        <div className="flex items-start justify-between gap-3 min-w-0">
          <div className="flex items-center gap-3 min-w-0">
            {/* Avatar */}
            <div className="w-8 h-8 rounded-full border border-eg/30 bg-eg/10 flex items-center justify-center font-mono-custom text-xs text-eg font-bold flex-shrink-0">
              {comment.author_avatar_url ? (
                <img src={comment.author_avatar_url} alt={comment.author_name || 'User'} className="w-full h-full rounded-full object-cover" />
              ) : (
                (comment.author_name || 'C')[0].toUpperCase()
              )}
            </div>

            {/* Author Info */}
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <span className="font-mono-custom text-xs font-bold text-white truncate max-w-[140px] sm:max-w-[200px]">
                  {comment.author_name}
                </span>
                {comment.user_id === projectOwnerId && (
                  <span className="px-1.5 py-0.5 rounded bg-eg/15 border border-eg/30 text-eg font-mono-custom text-[9px] uppercase font-semibold">
                    PROJECT CREATOR
                  </span>
                )}
                {comment.author_role === 'admin' && comment.user_id !== projectOwnerId && (
                  <span className="px-1.5 py-0.5 rounded bg-purple-500/15 border border-purple-500/30 text-purple-400 font-mono-custom text-[9px] uppercase">
                    ADMIN
                  </span>
                )}
              </div>
              <p className="font-mono-custom text-[10px] text-white/40 mt-0.5">
                {formatDate(comment.created_at)}
                {isEdited && <span className="ml-1.5 italic text-white/30">(edited)</span>}
              </p>
            </div>
          </div>

          {/* Action buttons (Pin / Delete / Edit) */}
          {!isDeleted && (
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {/* Pin button (Owner/Admin only, top-level comments) */}
              {!isReply && (isProjectOwner || isAdmin) && (
                <button
                  type="button"
                  onClick={() => pinComment(comment.id, !comment.is_pinned)}
                  title={comment.is_pinned ? 'Unpin comment' : 'Pin comment to top'}
                  className={`px-2 py-1 rounded text-[10px] font-mono-custom transition-colors border ${
                    comment.is_pinned
                      ? 'bg-eg/20 text-eg border-eg/40'
                      : 'text-white/40 hover:text-eg border-transparent hover:border-eg/20'
                  }`}
                >
                  📌 {comment.is_pinned ? 'UNPIN' : 'PIN'}
                </button>
              )}

              {/* Edit button (Author only) */}
              {isAuthor && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(editingId === comment.id ? null : comment.id);
                    setEditInput(comment.content);
                  }}
                  className="px-2 py-1 rounded text-[10px] font-mono-custom text-white/40 hover:text-white transition-colors"
                >
                  EDIT
                </button>
              )}

              {/* Delete button (Author, Project Owner, Admin) */}
              {canModify && (
                <button
                  type="button"
                  onClick={() => setDeleteTargetId(comment.id)}
                  className="px-2 py-1 rounded text-[10px] font-mono-custom text-white/40 hover:text-red-400 transition-colors"
                >
                  DELETE
                </button>
              )}
            </div>
          )}
        </div>

        {/* Comment Content / Edit Form */}
        <div className="mt-2.5 min-w-0">
          {isDeleted ? (
            <p className="font-mono-custom text-xs text-white/30 italic">This comment was deleted.</p>
          ) : editingId === comment.id ? (
            <form onSubmit={e => handleEditSubmit(e, comment.id)} className="space-y-2 mt-2">
              <textarea
                rows={2}
                value={editInput}
                onChange={e => setEditInput(e.target.value)}
                className="w-full bg-dark-200/90 border border-eg/30 rounded-xl p-3 text-xs text-white font-sans focus:outline-none focus:border-eg"
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setEditingId(null)} className="px-3 py-1 font-mono-custom text-[10px] text-white/40">CANCEL</button>
                <button type="submit" className="btn-primary px-3 py-1 font-mono-custom text-[10px]">SAVE EDIT</button>
              </div>
            </form>
          ) : (
            <p className="font-sans text-xs sm:text-sm text-white/85 leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere] [word-break:break-word] w-full min-w-0 max-w-full">
              {comment.content}
            </p>
          )}
        </div>

        {/* Reply Trigger Button */}
        {!isDeleted && canReply && (
          <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-2">
            <button
              type="button"
              onClick={() => {
                setReplyingToId(replyingToId === comment.id ? null : comment.id);
                setReplyInput('');
              }}
              className="font-mono-custom text-[10px] text-eg/80 hover:text-eg transition-colors flex items-center gap-1"
            >
              ↳ {replyingToId === comment.id ? 'Cancel Reply' : 'Reply as Creator'}
            </button>
          </div>
        )}

        {/* Inline Reply Form */}
        {replyingToId === comment.id && (
          <form onSubmit={e => handleReplySubmit(e, comment.id)} className="mt-3 space-y-2.5 bg-dark-300 p-3 rounded-xl border border-eg/20">
            <p className="font-mono-custom text-[10px] text-eg uppercase tracking-wider">Replying to {comment.author_name}</p>
            <textarea
              rows={2}
              required
              value={replyInput}
              onChange={e => setReplyInput(e.target.value)}
              placeholder="Write a reply..."
              className="w-full bg-dark-200/80 border border-eg/20 rounded-xl p-3 text-xs text-white font-sans focus:outline-none focus:border-eg placeholder-white/30"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setReplyingToId(null)} className="px-3 py-1 font-mono-custom text-[10px] text-white/40">CANCEL</button>
              <button type="submit" disabled={submitting} className="btn-primary px-4 py-1.5 font-mono-custom text-[10px]">
                {submitting ? 'REPLYING...' : 'SEND REPLY'}
              </button>
            </div>
          </form>
        )}

        {/* Render Replies */}
        {comment.replies && comment.replies.length > 0 && (
          <div className="space-y-2 mt-3 pt-2 border-t border-white/5">
            {comment.replies.map(reply => renderSingleComment(reply, true))}
          </div>
        )}
      </div>
    );
  };

  return (
    <section id="comments-section" className={`space-y-6 pt-8 border-t border-eg/15 ${className}`}>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="font-mono-custom text-xs tracking-widest text-white/70 uppercase flex items-center gap-2 font-bold">
          <span className="w-1.5 h-1.5 rounded-full bg-eg" />
          COMMENTS · <span className="text-eg">{commentCount}</span>
        </h3>
      </div>

      {/* Top Level Comment Input Form */}
      {canPostTopComment ? (
        <form onSubmit={handleTopSubmit} className="glass rounded-2xl p-4 sm:p-5 border border-eg/20 space-y-3">
          <textarea
            rows={3}
            required
            value={topCommentInput}
            onChange={e => setTopCommentInput(e.target.value)}
            placeholder="Write a comment as Creator..."
            className="w-full bg-dark-200/80 border border-eg/20 rounded-xl p-3.5 text-xs text-white font-sans focus:outline-none focus:border-eg placeholder-white/30 leading-relaxed"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting || !topCommentInput.trim()}
              className="btn-primary py-2 px-6 font-mono-custom text-xs disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? 'POSTING...' : 'POST COMMENT'}
            </button>
          </div>
        </form>
      ) : (
        <div className="p-4 rounded-xl border border-white/10 bg-dark-200/40 text-center font-mono-custom text-xs text-white/50">
          🔒 Only creators can comment on projects.
        </div>
      )}

      {/* Comments List */}
      {loading ? (
        <div className="py-8 text-center">
          <div className="w-6 h-6 rounded-full border-2 border-eg/30 border-t-eg animate-spin mx-auto" />
        </div>
      ) : comments.length === 0 ? (
        <div className="p-8 rounded-2xl border border-white/5 glass text-center">
          <p className="font-mono-custom text-[10px] tracking-widest text-white/30 uppercase">No comments yet</p>
          <p className="font-sans text-xs text-white/40 mt-1">Be the first creator to start the conversation.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {comments.map(c => renderSingleComment(c, false))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTargetId}
        onClose={() => setDeleteTargetId(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Comment?"
        message="This action cannot be undone. The comment will be removed from the project page."
        confirmLabel="Delete Comment"
        variant="danger"
        loading={deleting}
      />
    </section>
  );
};

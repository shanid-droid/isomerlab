import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from './supabase';
import type { ProjectCommentWithProfile } from './types';

// ─── useProjectLikes ──────────────────────────────────────────────────────────

interface LikeSnapshot {
  liked: boolean;
  count: number;
}

interface ToggleLikeRow {
  liked: boolean;
  like_count: number | string;
}

/** True when the `toggle_project_like` RPC has not been deployed to this database */
function isMissingRpc(error: { code?: string; message?: string }): boolean {
  return error.code === 'PGRST202' || error.code === '42883';
}

async function fetchLikeCount(projectId: string): Promise<number> {
  const { count, error } = await supabase
    .from('project_likes')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', projectId);

  if (error) throw error;
  return count ?? 0;
}

/**
 * Performs exactly ONE database write and returns the authoritative state.
 * Prefers the atomic `toggle_project_like` RPC; falls back to a single
 * INSERT/DELETE when the RPC is not deployed.
 */
async function writeLike(projectId: string, userId: string, nextLiked: boolean): Promise<LikeSnapshot> {
  const { data, error } = await supabase.rpc('toggle_project_like', { p_project_id: projectId });

  if (!error) {
    const row = (Array.isArray(data) ? data[0] : data) as ToggleLikeRow | undefined;
    if (!row) throw new Error('toggle_project_like returned no row');
    return { liked: !!row.liked, count: Number(row.like_count) || 0 };
  }

  if (!isMissingRpc(error)) throw error;

  if (nextLiked) {
    const { error: insertError } = await supabase
      .from('project_likes')
      .insert({ project_id: projectId, user_id: userId });
    // 23505 = row already there, which matches the desired end state
    if (insertError && insertError.code !== '23505') throw insertError;
  } else {
    const { error: deleteError } = await supabase
      .from('project_likes')
      .delete()
      .eq('project_id', projectId)
      .eq('user_id', userId);
    if (deleteError) throw deleteError;
  }

  return { liked: nextLiked, count: await fetchLikeCount(projectId) };
}

export function useProjectLikes(projectId: string) {
  const [likeCount, setLikeCount] = useState<number>(0);
  const [isLiked, setIsLiked] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [isPending, setIsPending] = useState<boolean>(false);
  const [animating, setAnimating] = useState<false | 'like' | 'unlike'>(false);

  // Mirrors of state that async callbacks read instead of closed-over state
  const likedRef = useRef<boolean>(false);
  const isProcessingRef = useRef<boolean>(false);
  const animTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Monotonic id: results carrying an outdated id are discarded
  const readIdRef = useRef<number>(0);
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (animTimeoutRef.current) clearTimeout(animTimeoutRef.current);
    };
  }, []);

  const applySnapshot = useCallback((snapshot: LikeSnapshot) => {
    likedRef.current = snapshot.liked;
    setIsLiked(snapshot.liked);
    setLikeCount(Math.max(0, snapshot.count));
  }, []);

  // ── Read authoritative count & like status from the database ──────────────
  const fetchLikeData = useCallback(async () => {
    if (!projectId) {
      setLoading(false);
      return;
    }

    const readId = ++readIdRef.current;
    try {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user ?? null;
      userIdRef.current = user?.id ?? null;

      const [count, likedRow] = await Promise.all([
        fetchLikeCount(projectId),
        user
          ? supabase
              .from('project_likes')
              .select('id')
              .eq('project_id', projectId)
              .eq('user_id', user.id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      // Never let a stale read overwrite a newer read or a completed toggle
      if (readId !== readIdRef.current || isProcessingRef.current) return;

      applySnapshot({ liked: !!likedRow.data, count });
    } catch (err) {
      console.error('[useProjectLikes] fetchLikeData error:', err);
    } finally {
      if (readId === readIdRef.current) setLoading(false);
    }
  }, [projectId, applySnapshot]);

  // ── Initial load + single realtime subscription ───────────────────────────
  useEffect(() => {
    if (!projectId) {
      setLoading(false);
      return;
    }

    let destroyed = false;
    fetchLikeData();

    // One channel per mounted hook, torn down in cleanup
    const channel = supabase
      .channel(`project_likes:${projectId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'project_likes', filter: `project_id=eq.${projectId}` },
        async () => {
          // Realtime only refreshes the count; it never toggles `liked`
          if (destroyed || isProcessingRef.current) return;
          const readId = ++readIdRef.current;
          try {
            const count = await fetchLikeCount(projectId);
            if (destroyed || readId !== readIdRef.current || isProcessingRef.current) return;
            setLikeCount(Math.max(0, count));
          } catch (err) {
            console.error('[useProjectLikes] Realtime count refresh error:', err);
          }
        }
      )
      .subscribe();

    // Re-read only when the signed-in user actually changes, so token
    // refreshes cannot clobber freshly toggled state
    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUserId = session?.user?.id ?? null;
      if (destroyed || nextUserId === userIdRef.current) return;
      userIdRef.current = nextUserId;
      fetchLikeData();
    });

    return () => {
      destroyed = true;
      authSub.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [projectId, fetchLikeData]);

  // ── Like / Unlike handler: one click = one database operation ─────────────
  const toggleLike = useCallback(async () => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;
    setIsPending(true);

    let needsResync = false;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert('Please log in to like this project.');
        return;
      }
      userIdRef.current = user.id;

      const nextLiked = !likedRef.current;
      const snapshot = await writeLike(projectId, user.id, nextLiked);

      // Invalidate reads started before this write so none of them can revert it
      readIdRef.current++;
      applySnapshot(snapshot);
      setLoading(false);

      setAnimating(snapshot.liked ? 'like' : 'unlike');
      if (animTimeoutRef.current) clearTimeout(animTimeoutRef.current);
      animTimeoutRef.current = setTimeout(() => setAnimating(false), 450);
    } catch (error) {
      console.error('[useProjectLikes] Like action failed:', error);
      needsResync = true;
    } finally {
      isProcessingRef.current = false;
      setIsPending(false);
    }

    if (needsResync) await fetchLikeData();
  }, [projectId, applySnapshot, fetchLikeData]);

  return { likeCount, isLiked, toggleLike, loading, isPending, animating };
}

// ─── useProjectComments ───────────────────────────────────────────────────────
export function useProjectComments(projectId: string) {
  const [comments, setComments] = useState<ProjectCommentWithProfile[]>([]);
  const [commentCount, setCommentCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const fetchComments = useCallback(async () => {
    if (!projectId) return;
    try {
      const { data, error } = await supabase
        .from('project_comments')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      const rawComments = data || [];

      // Active count (excluding deleted)
      const activeCount = rawComments.filter(c => !c.deleted_at).length;
      setCommentCount(activeCount);

      // Fetch author profiles for all unique user_ids
      const userIds = Array.from(new Set(rawComments.map(c => c.user_id)));
      let profileMap: Record<string, { full_name: string | null; avatar_url: string | null; role: string }> = {};

      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, role')
          .in('id', userIds);

        if (profiles) {
          profileMap = profiles.reduce((acc, p) => {
            acc[p.id] = { full_name: p.full_name, avatar_url: p.avatar_url, role: p.role };
            return acc;
          }, {} as typeof profileMap);
        }
      }

      // Attach profile info to each comment
      const enriched: ProjectCommentWithProfile[] = rawComments.map(c => ({
        ...c,
        author_name: profileMap[c.user_id]?.full_name ?? 'Creator',
        author_avatar_url: profileMap[c.user_id]?.avatar_url ?? null,
        author_role: (profileMap[c.user_id]?.role as any) ?? 'creator',
      }));

      // Separate top-level comments & replies
      const topLevel: ProjectCommentWithProfile[] = [];
      const replyMap: Record<string, ProjectCommentWithProfile[]> = {};

      enriched.forEach(c => {
        if (c.parent_comment_id) {
          if (!replyMap[c.parent_comment_id]) replyMap[c.parent_comment_id] = [];
          replyMap[c.parent_comment_id].push(c);
        } else {
          topLevel.push(c);
        }
      });

      // Attach replies to parents
      topLevel.forEach(c => {
        c.replies = replyMap[c.id] || [];
      });

      // Sort: pinned top-level comments first, then newest first
      topLevel.sort((a, b) => {
        if (a.is_pinned && !b.is_pinned) return -1;
        if (!a.is_pinned && b.is_pinned) return 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      setComments(topLevel);
    } catch (err) {
      console.error('[useProjectComments] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchComments();

    const channelTopic = `project_comments_${projectId}_${Math.random().toString(36).substring(2, 9)}`;
    const channel = supabase.channel(channelTopic);

    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'project_comments',
        filter: `project_id=eq.${projectId}`,
      },
      () => {
        fetchComments();
      }
    );

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, fetchComments]);

  const postComment = async (content: string, parentCommentId?: string | null) => {
    if (!content.trim()) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.rpc('create_project_comment', {
        p_content: content.trim(),
        p_parent_comment_id: parentCommentId || null,
        p_project_id: projectId,
      });

      if (error) throw error;
      await fetchComments();
    } catch (err: any) {
      console.error('[useProjectComments] Post error:', err);
      alert(err.message ?? 'Failed to post comment.');
      throw err;
    } finally {
      setSubmitting(false);
    }
  };

  const pinComment = async (commentId: string, pinState: boolean) => {
    try {
      const { error } = await supabase.rpc('pin_project_comment', {
        p_comment_id: commentId,
        p_pin: pinState,
      });

      if (error) throw error;
      await fetchComments();
    } catch (err: any) {
      console.error('[useProjectComments] Pin error:', err);
      alert(err.message ?? 'Failed to pin comment.');
    }
  };

  const softDeleteComment = async (commentId: string) => {
    if (!confirm('Are you sure you want to delete this comment?')) return;
    try {
      const { error } = await supabase.rpc('soft_delete_project_comment', {
        p_comment_id: commentId,
      });

      if (error) throw error;
      await fetchComments();
    } catch (err: any) {
      console.error('[useProjectComments] Delete error:', err);
      alert(err.message ?? 'Failed to delete comment.');
    }
  };

  const editComment = async (commentId: string, newContent: string) => {
    if (!newContent.trim()) return;
    try {
      const { error } = await supabase
        .from('project_comments')
        .update({
          content: newContent.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', commentId);

      if (error) throw error;
      await fetchComments();
    } catch (err: any) {
      console.error('[useProjectComments] Edit error:', err);
      alert(err.message ?? 'Failed to edit comment.');
    }
  };

  return {
    comments,
    commentCount,
    loading,
    submitting,
    postComment,
    pinComment,
    softDeleteComment,
    editComment,
    refreshComments: fetchComments,
  };
}

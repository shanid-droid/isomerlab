import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from './supabase';
import type { ProjectCommentWithProfile } from './types';

// ─── useProjectLikes ──────────────────────────────────────────────────────────
export function useProjectLikes(projectId: string) {
  const [likeCount, setLikeCount] = useState<number>(0);
  const [isLiked, setIsLiked] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [isPending, setIsPending] = useState<boolean>(false);
  const [animating, setAnimating] = useState<false | 'like' | 'unlike'>(false);

  // Keep a ref of isLiked and isPending for realtime guards and async safety
  const likedRef = useRef<boolean>(false);
  likedRef.current = isLiked;
  const isProcessingRef = useRef<boolean>(false);
  const animTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up animation timeout on unmount
  useEffect(() => {
    return () => {
      if (animTimeoutRef.current) {
        clearTimeout(animTimeoutRef.current);
      }
    };
  }, []);

  // ── Fetch authoritative count & like status from DB ───────────────────────
  const fetchLikeData = useCallback(async () => {
    if (!projectId) return;
    try {
      const [authResult, countResult] = await Promise.all([
        supabase.auth.getUser(),
        supabase
          .from('project_likes')
          .select('*', { count: 'exact', head: true })
          .eq('project_id', projectId),
      ]);

      const user = authResult.data?.user;
      setLikeCount(countResult.count ?? 0);

      if (user) {
        const { data: row } = await supabase
          .from('project_likes')
          .select('id')
          .eq('project_id', projectId)
          .eq('user_id', user.id)
          .maybeSingle();
        const userLiked = !!row;
        setIsLiked(userLiked);
        likedRef.current = userLiked;
      } else {
        setIsLiked(false);
        likedRef.current = false;
      }
    } catch (err) {
      console.error('[useProjectLikes] fetchLikeData error:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  // ── Initial load + Realtime subscription ──────────────────────────────────
  useEffect(() => {
    let destroyed = false;

    fetchLikeData();

    // Unique channel per mount — cleans up properly on unmount
    const channelTopic = `project_likes_${projectId}_${Math.random().toString(36).slice(2, 9)}`;
    const channel = supabase.channel(channelTopic);

    channel
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'project_likes', filter: `project_id=eq.${projectId}` },
        async () => {
          // Ignore realtime refetches while a local toggle operation is in flight
          if (destroyed || isProcessingRef.current) return;

          // Fetch only the count from DB
          try {
            const { count } = await supabase
              .from('project_likes')
              .select('*', { count: 'exact', head: true })
              .eq('project_id', projectId);

            if (!destroyed && count !== null && count !== undefined) {
              setLikeCount(count);
            }
          } catch (e) {
            console.error('[useProjectLikes] Realtime count refresh error:', e);
          }
        }
      )
      .subscribe();

    // Listen for auth changes to re-evaluate isLiked
    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange(() => {
      if (!destroyed) {
        fetchLikeData();
      }
    });

    return () => {
      destroyed = true;
      authSub.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [projectId, fetchLikeData]);

  // ── Like / Unlike handler ─────────────────────────────────────────────────
  const toggleLike = async () => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;
    setIsPending(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert('Please log in to like this project.');
        return;
      }

      // Capture the next desired state based on current isLiked
      const currentLiked = likedRef.current;
      const nextLiked = !currentLiked;

      if (nextLiked) {
        // INSERT user's like
        const { error } = await supabase
          .from('project_likes')
          .insert({
            project_id: projectId,
            user_id: user.id,
          });

        if (error) {
          // If already inserted (conflict), ignore error
          if (error.code !== '23505') {
            throw error;
          }
        }
      } else {
        // DELETE user's like
        const { error } = await supabase
          .from('project_likes')
          .delete()
          .eq('project_id', projectId)
          .eq('user_id', user.id);

        if (error) throw error;
      }

      // Update state after DB operation succeeds
      setIsLiked(nextLiked);
      likedRef.current = nextLiked;

      setLikeCount((prev) => Math.max(0, prev + (nextLiked ? 1 : -1)));

      // Trigger animation once
      setAnimating(nextLiked ? 'like' : 'unlike');
      if (animTimeoutRef.current) {
        clearTimeout(animTimeoutRef.current);
      }
      animTimeoutRef.current = setTimeout(() => {
        setAnimating(false);
      }, 450);

    } catch (error) {
      console.error('[useProjectLikes] Like action failed:', error);
      // Resync state with DB on failure
      await fetchLikeData();
    } finally {
      isProcessingRef.current = false;
      setIsPending(false);
    }
  };

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

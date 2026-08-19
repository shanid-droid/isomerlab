import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';
import type { ProjectWithCreator, ProjectComment } from './types';

export interface UserDashboardStats {
  likesCount: number;
  commentsCount: number;
  unreadNotifications: number;
}

export interface UserActivityItem {
  id: string;
  type: 'like' | 'comment';
  projectId: string;
  projectTitle: string;
  projectSlug: string;
  preview?: string;
  createdAt: string;
}

export interface UserCommentItem extends ProjectComment {
  project_title?: string;
  project_slug?: string;
}

export interface LikedProject extends ProjectWithCreator {
  liked_at: string;
  like_count?: number;
}

interface UseUserDashboardResult {
  stats: UserDashboardStats;
  likedProjects: LikedProject[];
  recentComments: UserCommentItem[];
  activity: UserActivityItem[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useUserDashboardData(): UseUserDashboardResult {
  const [stats, setStats] = useState<UserDashboardStats>({
    likesCount: 0,
    commentsCount: 0,
    unreadNotifications: 0,
  });
  const [likedProjects, setLikedProjects] = useState<LikedProject[]>([]);
  const [recentComments, setRecentComments] = useState<UserCommentItem[]>([]);
  const [activity, setActivity] = useState<UserActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const [likesRes, commentsRes] = await Promise.all([
        supabase
          .from('project_likes')
          .select('id, project_id, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('project_comments')
          .select('id, user_id, project_id, content, created_at, updated_at, deleted_at, parent_comment_id')
          .eq('user_id', user.id)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(10),
      ]);

      if (likesRes.error) throw likesRes.error;
      if (commentsRes.error) throw commentsRes.error;

      const likes = likesRes.data ?? [];
      const comments = (commentsRes.data ?? []).filter((c) => !c.deleted_at);

      setStats({
        likesCount: likes.length,
        commentsCount: comments.length,
        unreadNotifications: 0,
      });

      const projectIds = [
        ...new Set([
          ...likes.map((l) => l.project_id),
          ...comments.map((c) => c.project_id),
        ]),
      ];

      let projectMap: Record<
        string,
        { title: string; slug: string; description: string; thumbnail_url: string | null; views_count: number; created_by: string | null }
      > = {};

      if (projectIds.length > 0) {
        const { data: projects } = await supabase
          .from('projects')
          .select('id, title, slug, description, thumbnail_url, views_count, created_by, published')
          .in('id', projectIds);

        if (projects) {
          for (const p of projects) {
            if (p.published) {
              projectMap[p.id] = p;
            }
          }
        }
      }

      const creatorIds = [...new Set(Object.values(projectMap).map((p) => p.created_by).filter(Boolean) as string[])];
      let creatorMap: Record<string, { full_name: string | null; avatar_url: string | null }> = {};

      if (creatorIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', creatorIds);
        if (profiles) {
          for (const p of profiles) {
            creatorMap[p.id] = { full_name: p.full_name, avatar_url: p.avatar_url };
          }
        }
      }

      const likeCounts: Record<string, number> = {};
      if (projectIds.length > 0) {
        await Promise.all(
          projectIds.map(async (pid) => {
            const { count } = await supabase
              .from('project_likes')
              .select('*', { count: 'exact', head: true })
              .eq('project_id', pid);
            likeCounts[pid] = count ?? 0;
          })
        );
      }

      const enrichedLikes: LikedProject[] = likes
        .map((like) => {
          const proj = projectMap[like.project_id];
          if (!proj) return null;
          return {
            id: like.project_id,
            title: proj.title,
            slug: proj.slug,
            description: proj.description,
            thumbnail_url: proj.thumbnail_url,
            views_count: proj.views_count,
            created_by: proj.created_by,
            creator_name: proj.created_by ? creatorMap[proj.created_by]?.full_name ?? null : null,
            creator_avatar_url: proj.created_by ? creatorMap[proj.created_by]?.avatar_url ?? null : null,
            liked_at: like.created_at,
            like_count: likeCounts[like.project_id] ?? 0,
          } as LikedProject;
        })
        .filter(Boolean) as LikedProject[];

      setLikedProjects(enrichedLikes.slice(0, 6));

      const enrichedComments: UserCommentItem[] = comments.slice(0, 5).map((c) => ({
        ...c,
        project_title: projectMap[c.project_id]?.title,
        project_slug: projectMap[c.project_id]?.slug,
      }));
      setRecentComments(enrichedComments);

      const activityItems: UserActivityItem[] = [
        ...likes.map((l) => {
          const proj = projectMap[l.project_id];
          if (!proj) return null;
          return {
            id: `like-${l.id}`,
            type: 'like' as const,
            projectId: l.project_id,
            projectTitle: proj.title,
            projectSlug: proj.slug,
            createdAt: l.created_at,
          };
        }),
        ...comments.map((c) => {
          const proj = projectMap[c.project_id];
          if (!proj) return null;
          return {
            id: `comment-${c.id}`,
            type: 'comment' as const,
            projectId: c.project_id,
            projectTitle: proj.title,
            projectSlug: proj.slug,
            preview: c.content.slice(0, 80),
            createdAt: c.created_at,
          };
        }),
      ]
        .filter(Boolean) as UserActivityItem[];

      activityItems.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setActivity(activityItems.slice(0, 8));
    } catch (err: unknown) {
      console.error('[useUserDashboardData]', err);
      setError('Unable to load your activity. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    stats,
    likedProjects,
    recentComments,
    activity,
    loading,
    error,
    refresh: fetchData,
  };
}

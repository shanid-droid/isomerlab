import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { Project, ProjectGalleryItem, UserProfile, ProjectWithCreator } from './types';

interface UseProjectsResult {
  projects: ProjectWithCreator[];
  loading: boolean;
  error: string | null;
}

interface UseProjectBySlugResult {
  project: Project | null;
  gallery: ProjectGalleryItem[];
  loading: boolean;
  error: string | null;
}

interface UseUserProfileResult {
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
}

interface UsePublicProfileResult {
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
}

interface UseCreatorProjectsResult {
  projects: Project[];
  loading: boolean;
  error: string | null;
}

/**
 * Fetches all published projects, joined with creator profile info.
 * Optionally filtered by a specific creator UUID.
 */
export function useProjects(creatorId?: string): UseProjectsResult {
  const [projects, setProjects] = useState<ProjectWithCreator[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchProjects() {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('projects')
        .select('*')
        .eq('published', true)
        .order('created_at', { ascending: false });

      if (creatorId) {
        query = query.eq('created_by', creatorId);
      }

      const { data, error: sbError } = await query;

      if (cancelled) return;

      if (sbError) {
        setError(sbError.message);
        setLoading(false);
        return;
      }

      const projectRows = (data as Project[]) ?? [];

      // Fetch creator profiles for all unique created_by UUIDs
      const creatorIds = [
        ...new Set(
          projectRows
            .map((p) => p.created_by)
            .filter(Boolean) as string[]
        ),
      ];

      let creatorMap: Record<string, { full_name: string | null; avatar_url: string | null }> = {};

      if (creatorIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', creatorIds);

        if (profiles) {
          for (const p of profiles) {
            creatorMap[p.id] = {
              full_name: p.full_name,
              avatar_url: p.avatar_url,
            };
          }
        }
      }

      if (cancelled) return;

      const enriched: ProjectWithCreator[] = projectRows.map((p) => ({
        ...p,
        creator_name: p.created_by ? (creatorMap[p.created_by]?.full_name ?? null) : null,
        creator_avatar_url: p.created_by
          ? (creatorMap[p.created_by]?.avatar_url ?? null)
          : null,
      }));

      setProjects(enriched);
      setLoading(false);
    }

    fetchProjects();
    return () => { cancelled = true; };
  }, [creatorId]);

  return { projects, loading, error };
}

/**
 * Fetches a single published project by its slug along with gallery images.
 */
export function useProjectBySlug(slug: string | undefined): UseProjectBySlugResult {
  const [project, setProject] = useState<Project | null>(null);
  const [gallery, setGallery] = useState<ProjectGalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    async function fetchProjectData() {
      setLoading(true);
      setError(null);

      // 1. Fetch project details
      const { data: projData, error: projError } = await supabase
        .from('projects')
        .select('*')
        .eq('slug', slug)
        .eq('published', true)
        .maybeSingle();

      if (cancelled) return;

      if (projError) {
        setError(projError.message);
        setLoading(false);
        return;
      }

      if (!projData) {
        setProject(null);
        setGallery([]);
        setLoading(false);
        return;
      }

      setProject(projData as Project);

      // 2. Fetch project gallery images
      const { data: galleryData, error: galleryError } = await supabase
        .from('project_gallery')
        .select('*')
        .eq('project_id', projData.id)
        .order('sort_order', { ascending: true, nullsFirst: false });

      if (cancelled) return;

      if (galleryError) {
        console.warn('Failed to load gallery:', galleryError.message);
        setGallery([]);
      } else {
        setGallery((galleryData as ProjectGalleryItem[]) ?? []);
      }

      setLoading(false);
    }

    fetchProjectData();
    return () => { cancelled = true; };
  }, [slug]);

  return { project, gallery, loading, error };
}

/**
 * Fetches current authenticated user profile from `profiles` table.
 */
export function useUserProfile(): UseUserProfileResult {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      setLoading(true);
      setError(null);

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          if (!cancelled) {
            setProfile(null);
            setLoading(false);
          }
          return;
        }

        const { data, error: fetchErr } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle();

        if (cancelled) return;

        const fallbackProfile: UserProfile = {
          id: session.user.id,
          full_name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User',
          email: session.user.email || '',
          avatar_url: session.user.user_metadata?.avatar_url || null,
          role: 'user',
          bio: null,
          about: null,
          social_links: {},
          created_at: session.user.created_at,
        };

        if (fetchErr) {
          console.warn('[Profiles Notice]:', fetchErr.message);
          setProfile(fallbackProfile);
        } else if (data) {
          setProfile(data as UserProfile);
        } else {
          setProfile(fallbackProfile);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          console.warn('[Profiles Error]:', (err as Error)?.message || err);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadProfile();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      loadProfile();
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return { profile, loading, error };
}

/**
 * Fetches a public profile by user UUID.
 * Used on the public /profile/:id page.
 * Only reads safe public fields.
 */
export function usePublicProfile(userId: string | undefined): UsePublicProfileResult {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    async function fetchProfile() {
      setLoading(true);
      setError(null);

      const { data, error: fetchErr } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, bio, about, social_links, created_at')
        .eq('id', userId)
        .maybeSingle();

      if (cancelled) return;

      if (fetchErr) {
        setError(fetchErr.message);
        setLoading(false);
        return;
      }

      setProfile(data as UserProfile | null);
      setLoading(false);
    }

    fetchProfile();
    return () => { cancelled = true; };
  }, [userId]);

  return { profile, loading, error };
}

/**
 * Fetches all published projects by a given creator UUID.
 * Used on the public profile page to show their uploaded projects.
 */
export function useCreatorProjects(creatorId: string | undefined): UseCreatorProjectsResult {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  useEffect(() => {
    if (!creatorId) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    async function fetchProjects() {
      setLoading(true);
      setError(null);

      const { data, error: sbError } = await supabase
        .from('projects')
        .select('*')
        .eq('published', true)
        .eq('created_by', creatorId)
        .order('created_at', { ascending: false });

      if (cancelled) return;

      if (sbError) {
        setError(sbError.message);
        setLoading(false);
        return;
      }

      setProjects((data as Project[]) ?? []);
      setLoading(false);
    }

    fetchProjects();
    return () => { cancelled = true; };
  }, [creatorId]);

  return { projects, loading, error };
}

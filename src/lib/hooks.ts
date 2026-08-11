import { useEffect, useState, useCallback } from 'react';
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
  /** Call this after saving the profile to re-fetch the latest row from Supabase. */
  refreshProfile: () => Promise<void>;
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
        console.error('[useProjects] Supabase error fetching projects:', sbError);
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
        const { data: profiles, error: profilesErr } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', creatorIds);

        if (profilesErr) {
          console.error('[useProjects] Supabase error fetching creator profiles:', profilesErr);
        } else if (profiles) {
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
        console.error('[useProjectBySlug] Supabase error fetching project:', projError);
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
        console.warn('[useProjectBySlug] Failed to load gallery:', galleryError.message);
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
 * Returns a `refreshProfile` callback so callers can force a re-fetch
 * (e.g. immediately after saving profile changes).
 */
export function useUserProfile(): UseUserProfileResult {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  // Stable fetch function — does NOT depend on component lifecycle flags
  // so it can be called externally via refreshProfile.
  const fetchProfile = useCallback(async (): Promise<UserProfile | null> => {
    const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
    if (sessionErr) {
      console.error('[useUserProfile] Failed to get session:', sessionErr);
      return null;
    }

    const user = sessionData?.session?.user;
    if (!user) {
      return null;
    }

    const { data, error: fetchErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (fetchErr) {
      // Log the full error so we can diagnose RLS / column issues
      console.error(
        '[useUserProfile] Supabase SELECT failed. ' +
        'Check that "Public can read profiles" policy exists on public.profiles. ' +
        'Error details:',
        { code: fetchErr.code, message: fetchErr.message, details: fetchErr.details, hint: fetchErr.hint }
      );
      // Return a minimal fallback so the edit form can still function
      return {
        id: user.id,
        full_name: user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? 'User',
        email: user.email ?? '',
        avatar_url: user.user_metadata?.avatar_url ?? null,
        role: 'user',
        bio: null,
        about: null,
        social_links: {},
        created_at: user.created_at,
      };
    }

    if (!data) {
      // Row does not exist yet (e.g. trigger hasn't run). Log so we can diagnose.
      console.warn(
        '[useUserProfile] No profile row found for user:', user.id,
        '— The handle_new_user trigger may not have run, or the profile was not yet created.'
      );
      return {
        id: user.id,
        full_name: user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? 'User',
        email: user.email ?? '',
        avatar_url: user.user_metadata?.avatar_url ?? null,
        role: 'user',
        bio: null,
        about: null,
        social_links: {},
        created_at: user.created_at,
      };
    }

    // Successfully got the DB row — use it as the authoritative source
    return data as UserProfile;
  }, []);

  const loadProfile = useCallback(async (setLoadingState: boolean) => {
    if (setLoadingState) setLoading(true);
    setError(null);

    try {
      const result = await fetchProfile();
      setProfile(result);
    } catch (err: unknown) {
      console.error('[useUserProfile] Unexpected error:', err);
      setError((err as Error)?.message ?? 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [fetchProfile]);

  // Public refresh function — re-fetches and updates state without showing the loading spinner
  const refreshProfile = useCallback(async () => {
    await loadProfile(false);
  }, [loadProfile]);

  useEffect(() => {
    let cancelled = false;

    // Wrap loadProfile to respect cancellation
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchProfile();
        if (!cancelled) setProfile(result);
      } catch (err: unknown) {
        if (!cancelled) {
          console.error('[useUserProfile] Unexpected error in effect:', err);
          setError((err as Error)?.message ?? 'Unknown error');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    // Re-fetch on any auth state change (sign-in, sign-out, token refresh, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!cancelled) {
        if (session?.user) {
          // Re-fetch fresh DB row
          load();
        } else {
          // User signed out
          setProfile(null);
          setLoading(false);
        }
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  return { profile, loading, error, refreshProfile };
}

/**
 * Fetches a public profile by user UUID.
 * Used on the public /profile/:id page.
 * Only reads safe public fields — email and role are NOT included.
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
        // Full error details for diagnosis — most likely cause is missing
        // "Public can read profiles" SELECT policy on public.profiles.
        console.error(
          '[usePublicProfile] Supabase SELECT failed for userId:', userId,
          '\n→ If this is an RLS error, run the fix migration: 20260811_fix_profile_bugs.sql',
          '\n→ Error details:',
          { code: fetchErr.code, message: fetchErr.message, details: fetchErr.details, hint: fetchErr.hint }
        );
        setError(fetchErr.message);
        setLoading(false);
        return;
      }

      if (!data) {
        // RLS-filtered (policy blocked the row) or the profile genuinely doesn't exist.
        console.warn(
          '[usePublicProfile] No profile row returned for userId:', userId,
          '\n→ Possible causes: (1) No profile row exists, (2) RLS is blocking the read.',
          '\n→ Verify that the "Public can read profiles" policy exists in Supabase.'
        );
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
        console.error('[useCreatorProjects] Supabase error:', sbError);
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

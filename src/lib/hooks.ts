import { useEffect, useState, useCallback } from 'react';
import { supabase } from './supabase';
import type { Project, ProjectGalleryItem, UserProfile, ProjectWithCreator, SocialLinks, CreatorApplication } from './types';
import { resolveUserRole } from './roles';

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
  /** Re-fetch the profile from Supabase (call after saving changes). */
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

// ─── UUID validation helper ──────────────────────────────────────────────────
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUUID(value: string | undefined): boolean {
  return !!value && UUID_REGEX.test(value);
}

/**
 * Fetches all published projects, joined with creator profile info.
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
        console.error('[useProjects] Supabase query error:', sbError);
        setError(sbError.message);
        setLoading(false);
        return;
      }

      const projectRows = (data as Project[]) ?? [];
      const creatorIds = [...new Set(projectRows.map((p) => p.created_by).filter(Boolean) as string[])];

      let creatorMap: Record<string, { full_name: string | null; avatar_url: string | null }> = {};
      if (creatorIds.length > 0) {
        const { data: profiles, error: profErr } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', creatorIds);
        if (profErr) {
          console.error('[useProjects] Error fetching creator profiles:', profErr);
        } else if (profiles) {
          for (const p of profiles) {
            creatorMap[p.id] = { full_name: p.full_name, avatar_url: p.avatar_url };
          }
        }
      }

      if (cancelled) return;

      const enriched: ProjectWithCreator[] = projectRows.map((p) => ({
        ...p,
        creator_name: p.created_by ? (creatorMap[p.created_by]?.full_name ?? null) : null,
        creator_avatar_url: p.created_by ? (creatorMap[p.created_by]?.avatar_url ?? null) : null,
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
 * Fetches a single published project by slug, plus its gallery.
 */
export function useProjectBySlug(slug: string | undefined): UseProjectBySlugResult {
  const [project, setProject] = useState<Project | null>(null);
  const [gallery, setGallery] = useState<ProjectGalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    if (!slug) { setLoading(false); return; }
    let cancelled = false;

    async function fetchProjectData() {
      setLoading(true);
      setError(null);

      const { data: projData, error: projError } = await supabase
        .from('projects')
        .select(`
          id,
          title,
          slug,
          description,
          thumbnail_url,
          components,
          github_url,
          project_links,
          published,
          created_by,
          created_at
        `)
        .eq('slug', slug)
        .eq('published', true)
        .maybeSingle();

      if (cancelled) return;
      if (projError) {
        console.error('[useProjectBySlug] Error fetching project:', projError);
        setError(projError.message);
        setLoading(false);
        return;
      }
      if (!projData) { setProject(null); setGallery([]); setLoading(false); return; }

      setProject(projData as Project);

      const { data: galleryData, error: galleryError } = await supabase
        .from('project_gallery')
        .select('id, project_id, version_id, image_url, sort_order, created_at, media_type, mime_type, duration_seconds')
        .eq('project_id', projData.id)
        .order('sort_order', { ascending: true, nullsFirst: false });

      if (cancelled) return;
      if (galleryError) {
        console.warn('[useProjectBySlug] Gallery load failed:', galleryError.message);
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
 * Fetches the currently authenticated user's profile from public.profiles.
 *
 * Uses supabase.auth.getUser() (server-validated) instead of getSession()
 * to ensure the user ID is always authentic and not stale from local storage.
 *
 * Returns refreshProfile() so callers can force a re-fetch after saving.
 */
export function useUserProfile(): UseUserProfileResult {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  /**
   * Core fetch — always uses getUser() for a server-validated user ID.
   * Returns null if unauthenticated; returns DB row or a minimal fallback.
   */
  const fetchProfile = useCallback(async (): Promise<UserProfile | null> => {
    // getUser() contacts the Supabase auth server to validate the token.
    // This is intentional — stale sessions from getSession() would return a
    // user.id that doesn't match auth.uid() server-side, causing RLS failures.
    const { data: userData, error: userErr } = await supabase.auth.getUser();

    if (userErr || !userData?.user) {
      if (userErr) {
        console.error(
          '[useUserProfile] getUser() failed — user is not authenticated or token is invalid.',
          { code: userErr.code, message: userErr.message }
        );
      }
      return null;
    }

    const user = userData.user;
    console.debug('[useUserProfile] Authenticated user ID:', user.id);

    const { data, error: fetchErr } = await supabase
      .from('profiles')
      .select('id, full_name, email, avatar_url, role, bio, about, date_of_birth, social_links, creator_approved_at, first_project_uploaded_at, creator_requirement_status, created_at, updated_at')
      .eq('id', user.id)
      .single();

    // Check & trigger birthday notification for authenticated user
    try {
      await supabase.rpc('check_and_generate_birthday_notification', { p_user_id: user.id });
    } catch {
      // Non-fatal if birthday RPC fails or is missing
    }

    if (fetchErr) {
      console.error(
        '[useUserProfile] SELECT from profiles failed.',
        '\n→ Authenticated user ID:', user.id,
        '\n→ Check that the "Users can view own profile" policy allows auth.uid() = id.',
        '\n→ Full Supabase error:',
        { code: fetchErr.code, message: fetchErr.message, details: fetchErr.details, hint: fetchErr.hint }
      );
      // Return a minimal fallback so the edit page is not broken by a missing row.
      // The fallback intentionally has blank bio/about/social_links so the user
      // knows they need to fill in their profile.
      return {
        id: user.id,
        full_name: user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? null,
        email: user.email ?? null,
        avatar_url: user.user_metadata?.avatar_url ?? null,
        role: resolveUserRole(user.id, 'user'),
        bio: null,
        about: null,
        social_links: {} as SocialLinks,
        created_at: user.created_at,
      };
    }

    if (!data) {
      // No row found — trigger has not run or profile was manually deleted.
      console.warn(
        '[useUserProfile] No profile row found for authenticated user:', user.id,
        '\n→ The handle_new_user trigger may not have run.',
        '\n→ Try inserting a row manually or logging out and back in.'
      );
      return {
        id: user.id,
        full_name: user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? null,
        email: user.email ?? null,
        avatar_url: user.user_metadata?.avatar_url ?? null,
        role: resolveUserRole(user.id, 'user'),
        bio: null,
        about: null,
        social_links: {} as SocialLinks,
        created_at: user.created_at,
      };
    }

    // Parse social_links — Supabase returns JSONB as a JS object, but cast for safety.
    const row = data as UserProfile;
    row.role = resolveUserRole(row.id, row.role);
    if (row.social_links && typeof row.social_links !== 'object') {
      try {
        row.social_links = JSON.parse(row.social_links as unknown as string) as SocialLinks;
      } catch {
        console.warn('[useUserProfile] Failed to parse social_links JSON:', row.social_links);
        row.social_links = {};
      }
    }

    console.debug('[useUserProfile] Loaded profile from DB:', {
      id: row.id,
      full_name: row.full_name,
      bio: row.bio,
      about: row.about ? row.about.substring(0, 40) + '…' : null,
      social_links: row.social_links,
    });

    return row;
  }, []);

  const runLoad = useCallback(async (cancelled: { value: boolean }, showSpinner: boolean) => {
    if (showSpinner) setLoading(true);
    setError(null);
    try {
      const result = await fetchProfile();
      if (!cancelled.value) {
        setProfile(result);
      }
    } catch (err: unknown) {
      if (!cancelled.value) {
        console.error('[useUserProfile] Unexpected error during load:', err);
        setError((err as Error)?.message ?? 'Unknown error');
      }
    } finally {
      if (!cancelled.value) setLoading(false);
    }
  }, [fetchProfile]);

  // Exported refresh — re-fetches without showing the loading spinner.
  const refreshProfile = useCallback(async () => {
    const cancelled = { value: false };
    await runLoad(cancelled, false);
  }, [runLoad]);

  useEffect(() => {
    const cancelled = { value: false };

    runLoad(cancelled, true);

    // Re-fetch on auth state changes (sign-in, token refresh, sign-out).
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled.value) return;
      if (event === 'SIGNED_OUT' || !session) {
        setProfile(null);
        setLoading(false);
      } else {
        // SIGNED_IN, TOKEN_REFRESHED, INITIAL_SESSION, etc.
        runLoad(cancelled, false);
      }
    });

    return () => {
      cancelled.value = true;
      subscription.unsubscribe();
    };
  }, [runLoad]);

  return { profile, loading, error, refreshProfile };
}

/**
 * Fetches a public profile by UUID for the /profile/:id page.
 * Queries only safe public fields — email and role are excluded.
 * Uses getUser() to log the authenticated user ID for debugging.
 */
export function usePublicProfile(userId: string | undefined): UsePublicProfileResult {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    // Validate the UUID before querying — prevents querying with "undefined" string
    if (!userId || !isValidUUID(userId)) {
      console.error(
        '[usePublicProfile] Invalid or missing profile UUID from URL param:',
        JSON.stringify(userId),
        '\n→ Expected a valid UUID like "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx".',
        '\n→ The "View Public Profile" link may have been clicked before profile loaded,',
        '\n   or the ID was not set correctly in the navigation link.'
      );
      setProfile(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchPublicProfile() {
      setLoading(true);
      setError(null);

      console.debug('[usePublicProfile] Querying profiles.id =', userId);

      const { data, error: fetchErr } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, bio, about, social_links, role, creator_approved_at, created_at')
        .eq('id', userId)
        .single();

      if (cancelled) return;

      if (fetchErr) {
        // PGRST116 = "JSON object requested, multiple (or no) rows returned" from .single()
        // This means the row genuinely doesn't exist, OR RLS blocked it.
        if (fetchErr.code === 'PGRST116') {
          console.warn(
            '[usePublicProfile] No profile row found for UUID:', userId,
            '\n→ Either the profile does not exist in public.profiles,',
            '\n   OR the "Public can read profiles" SELECT policy is missing/inactive.',
            '\n→ Run this in Supabase SQL Editor to check:',
            '\n   SELECT policyname, cmd FROM pg_policies WHERE tablename = \'profiles\';'
          );
          setProfile(null);
        } else {
          console.error(
            '[usePublicProfile] Supabase SELECT error for userId:', userId,
            '\n→ Full error:',
            { code: fetchErr.code, message: fetchErr.message, details: fetchErr.details, hint: fetchErr.hint }
          );
          setError(fetchErr.message);
        }
        setLoading(false);
        return;
      }

      if (!data) {
        console.warn('[usePublicProfile] Query succeeded but returned null for UUID:', userId);
        setProfile(null);
        setLoading(false);
        return;
      }

      // Parse social_links JSONB safely
      const row = data as UserProfile;
      row.role = resolveUserRole(row.id, row.role);
      if (row.social_links && typeof row.social_links !== 'object') {
        try {
          row.social_links = JSON.parse(row.social_links as unknown as string) as SocialLinks;
        } catch {
          console.warn('[usePublicProfile] Failed to parse social_links JSON');
          row.social_links = {};
        }
      }

      console.debug('[usePublicProfile] Profile loaded:', {
        id: row.id,
        full_name: row.full_name,
        bio: row.bio,
      });

      setProfile(row);
      setLoading(false);
    }

    fetchPublicProfile();
    return () => { cancelled = true; };
  }, [userId]);

  return { profile, loading, error };
}

/**
 * Fetches all published projects by a creator UUID.
 */
export function useCreatorProjects(creatorId: string | undefined): UseCreatorProjectsResult {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  useEffect(() => {
    if (!creatorId || !isValidUUID(creatorId)) {
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

interface UseCreatorApplicationResult {
  application: CreatorApplication | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/** Fetches the current user's most recent creator application (if any). */
export function useCreatorApplication(): UseCreatorApplicationResult {
  const [application, setApplication] = useState<CreatorApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchApplication = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setApplication(null);
        setLoading(false);
        return;
      }

      const { data, error: sbError } = await supabase
        .from('creator_applications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (sbError) {
        setError(sbError.message);
        setApplication(null);
      } else {
        setApplication(data as CreatorApplication | null);
      }
    } catch (err: unknown) {
      setError((err as Error)?.message ?? 'Failed to load application');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApplication();
  }, [fetchApplication]);

  return { application, loading, error, refresh: fetchApplication };
}

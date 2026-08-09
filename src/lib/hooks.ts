import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { Project, ProjectGalleryItem, UserProfile } from './types';

interface UseProjectsResult {
  projects: Project[];
  loading: boolean;
  error: string | null;
}

interface UseProjectBySlugResult {
  project: Project | null;
  gallery: ProjectGalleryItem[];
  loading: boolean;
  error: string | null;
}

/**
 * Fetches all rows from the `projects` table where status = 'published'.
 * Ordered by created_at descending so newest projects appear first.
 */
export function useProjects(): UseProjectsResult {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchProjects() {
      setLoading(true);
      setError(null);

      const { data, error: sbError } = await supabase
        .from('projects')
        .select('*')
        .eq('published', true)
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
  }, []);

  return { projects, loading, error };
}

/**
 * Fetches a single published project by its slug along with gallery images from project_gallery.
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
        // Log gallery error non-fatally or set gallery to empty
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

interface UseUserProfileResult {
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
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
          created_at: session.user.created_at,
        };

        if (fetchErr) {
          console.warn('[Profiles Notice]:', fetchErr.message);
          // Return fallback profile gracefully if row missing or schema issue
          setProfile(fallbackProfile);
        } else if (data) {
          setProfile(data as UserProfile);
        } else {
          setProfile(fallbackProfile);
        }
      } catch (err: any) {
        if (!cancelled) {
          console.warn('[Profiles Error]:', err?.message || err);
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


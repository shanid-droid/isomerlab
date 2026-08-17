import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';
import type { ProjectVersion } from './types';

interface UseProjectVersionsResult {
  versions: ProjectVersion[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

interface UseProjectVersionResult {
  version: ProjectVersion | null;
  loading: boolean;
  error: string | null;
}

interface UseVersionMutationResult {
  loading: boolean;
  error: string | null;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUUID(value: string | undefined): boolean {
  return !!value && UUID_REGEX.test(value);
}

export function useProjectVersions(projectId: string | undefined): UseProjectVersionsResult {
  const [versions, setVersions] = useState<ProjectVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVersions = useCallback(async () => {
    if (!projectId || !isValidUUID(projectId)) {
      setVersions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('project_versions')
        .select('*')
        .eq('project_id', projectId)
        .order('sort_order', { ascending: true });

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      const rows = (data as ProjectVersion[]) ?? [];
      setVersions(rows);
    } catch (err: unknown) {
      setError((err as Error)?.message ?? 'Failed to load versions');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchVersions();
  }, [fetchVersions]);

  return { versions, loading, error, refresh: fetchVersions };
}

export function useProjectVersion(versionId: string | undefined): UseProjectVersionResult {
  const [version, setVersion] = useState<ProjectVersion | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!versionId || !isValidUUID(versionId)) {
      setVersion(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchVersion() {
      setLoading(true);
      setError(null);

      try {
        const { data, error: fetchError } = await supabase
          .from('project_versions')
          .select('*')
          .eq('id', versionId)
          .maybeSingle();

        if (fetchError) {
          throw new Error(fetchError.message);
        }

        if (!cancelled) {
          setVersion((data as ProjectVersion | null) ?? null);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError((err as Error)?.message ?? 'Failed to load version');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchVersion();
    return () => { cancelled = true; };
  }, [versionId]);

  return { version, loading, error };
}

export function useCreateProjectVersion(): UseVersionMutationResult & { create: (data: Partial<ProjectVersion>) => Promise<ProjectVersion | null> } {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = useCallback(async (data: Partial<ProjectVersion>): Promise<ProjectVersion | null> => {
    if (!data.project_id || !isValidUUID(data.project_id)) {
      setError('Invalid project ID');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('[DEBUG project_versions INSERT] Raw input data:', data);
      console.log('[DEBUG project_versions INSERT] Project ID:', data.project_id);

      const { data: userData } = await supabase.auth.getUser();
      console.log('[DEBUG project_versions INSERT] Auth user:', userData?.user);
      if (!userData?.user) {
        throw new Error('Authentication required');
      }

      const payload: Record<string, unknown> = {
        project_id: data.project_id,
        version_name: data.version_name?.trim() || 'New Version',
        version_number: data.version_number?.trim() || '1.0',
        description: data.description?.trim() || null,
        whats_new: data.whats_new?.trim() || null,
        thumbnail_url: data.thumbnail_url?.trim() || null,
        video_url: data.video_url?.trim() || null,
        project_links: data.project_links && data.project_links.length > 0 ? data.project_links : [],
        sort_order: typeof data.sort_order === 'number' ? data.sort_order : 0,
        is_default: data.is_default ?? false,
        created_by: userData.user.id,
      };

      console.log('[DEBUG project_versions INSERT] Final insert payload:', payload);

      const { data: inserted, error: insertError } = await supabase
        .from('project_versions')
        .insert([payload])
        .select()
        .single();

      console.log('[DEBUG project_versions INSERT] Supabase insert response - data:', inserted);
      console.log('[DEBUG project_versions INSERT] Supabase insert response - error:', insertError);

      if (insertError) {
        console.error('[DEBUG project_versions INSERT] Full error object:', JSON.stringify(insertError, null, 2));
        throw new Error(insertError.message);
      }

      return inserted as ProjectVersion;
    } catch (err: unknown) {
      console.error('[DEBUG project_versions INSERT] Caught error:', err);
      setError((err as Error)?.message ?? 'Failed to create version');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, error, create };
}

export function useUpdateProjectVersion(): UseVersionMutationResult & { update: (versionId: string, data: Partial<ProjectVersion>) => Promise<ProjectVersion | null> } {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = useCallback(async (versionId: string, data: Partial<ProjectVersion>): Promise<ProjectVersion | null> => {
    if (!versionId || !isValidUUID(versionId)) {
      setError('Invalid version ID');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const payload: Record<string, unknown> = {};
      if (data.version_name !== undefined) payload.version_name = data.version_name.trim() || 'New Version';
      if (data.version_number !== undefined) payload.version_number = data.version_number.trim() || '1.0';
      if (data.description !== undefined) payload.description = data.description?.trim() || null;
      if (data.whats_new !== undefined) payload.whats_new = data.whats_new?.trim() || null;
      if (data.thumbnail_url !== undefined) payload.thumbnail_url = data.thumbnail_url?.trim() || null;
      if (data.video_url !== undefined) payload.video_url = data.video_url?.trim() || null;
      if (data.project_links !== undefined) payload.project_links = data.project_links && data.project_links.length > 0 ? data.project_links : [];
      if (typeof data.sort_order === 'number') payload.sort_order = data.sort_order;
      if (data.is_default !== undefined) payload.is_default = data.is_default;
      payload.updated_at = new Date().toISOString();

      const { data: updated, error: updateError } = await supabase
        .from('project_versions')
        .update(payload)
        .eq('id', versionId)
        .select()
        .single();

      if (updateError) {
        throw new Error(updateError.message);
      }

      return updated as ProjectVersion;
    } catch (err: unknown) {
      setError((err as Error)?.message ?? 'Failed to update version');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, error, update };
}

export function useDeleteProjectVersion(): UseVersionMutationResult & { deleteVersion: (versionId: string) => Promise<boolean> } {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deleteVersion = useCallback(async (versionId: string): Promise<boolean> => {
    if (!versionId || !isValidUUID(versionId)) {
      setError('Invalid version ID');
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      const { error: deleteError } = await supabase
        .from('project_versions')
        .delete()
        .eq('id', versionId);

      if (deleteError) {
        throw new Error(deleteError.message);
      }

      return true;
    } catch (err: unknown) {
      setError((err as Error)?.message ?? 'Failed to delete version');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, error, deleteVersion };
}

export function useSetDefaultProjectVersion(): UseVersionMutationResult & { setDefault: (versionId: string) => Promise<boolean> } {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setDefault = useCallback(async (versionId: string): Promise<boolean> => {
    if (!versionId || !isValidUUID(versionId)) {
      setError('Invalid version ID');
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from('project_versions')
        .update({ is_default: true, updated_at: new Date().toISOString() })
        .eq('id', versionId);

      if (updateError) {
        throw new Error(updateError.message);
      }

      return true;
    } catch (err: unknown) {
      setError((err as Error)?.message ?? 'Failed to set default version');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, error, setDefault };
}

export function useReorderProjectVersions(): UseVersionMutationResult & { reorder: (projectId: string, orderedIds: string[]) => Promise<boolean> } {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reorder = useCallback(async (projectId: string, orderedIds: string[]): Promise<boolean> => {
    if (!projectId || !isValidUUID(projectId)) {
      setError('Invalid project ID');
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      const updates = orderedIds.map((id, index) => ({
        id,
        sort_order: index,
        updated_at: new Date().toISOString(),
      }));

      const { error: updateError } = await supabase
        .from('project_versions')
        .upsert(updates);

      if (updateError) {
        throw new Error(updateError.message);
      }

      return true;
    } catch (err: unknown) {
      setError((err as Error)?.message ?? 'Failed to reorder versions');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, error, reorder };
}

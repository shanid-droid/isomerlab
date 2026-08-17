-- ============================================================================
-- ISOMER: PROJECT VERSIONING SYSTEM — PHASE 2
-- Backfill existing projects with default versions
-- ============================================================================

-- Create default versions for existing projects that don't have any versions yet.
-- This migration is idempotent: running it multiple times will not create duplicates.

DO $$
DECLARE
  v_project RECORD;
  v_version_id UUID;
BEGIN
  FOR v_project IN
    SELECT p.id, p.title, p.description, p.thumbnail_url, p.project_links, p.created_by
    FROM public.projects p
    WHERE NOT EXISTS (
      SELECT 1 FROM public.project_versions pv WHERE pv.project_id = p.id
    )
  LOOP
    INSERT INTO public.project_versions (
      project_id,
      version_name,
      version_number,
      description,
      thumbnail_url,
      project_links,
      is_default,
      created_by,
      created_at,
      updated_at
    ) VALUES (
      v_project.id,
      v_project.title,
      '1.0',
      v_project.description,
      v_project.thumbnail_url,
      COALESCE(v_project.project_links, '[]'::jsonb),
      true,
      v_project.created_by,
      now(),
      now()
    )
    RETURNING id INTO v_version_id;

    RAISE NOTICE 'Created default version % for project %', v_version_id, v_project.id;
  END LOOP;
END;
$$;

-- Notify PostgREST schema cache to reload
NOTIFY pgrst, 'reload schema';

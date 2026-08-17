-- ============================================================================
-- ISOMER: PROJECT VERSIONING SYSTEM — PHASE 3
-- Add version_id to project_gallery and backfill existing images
-- ============================================================================

-- 1. Add version_id column (nullable for backward compatibility)
ALTER TABLE public.project_gallery
  ADD COLUMN IF NOT EXISTS version_id UUID REFERENCES public.project_versions(id) ON DELETE CASCADE;

-- 2. Index for version_id
CREATE INDEX IF NOT EXISTS idx_project_gallery_version_id
  ON public.project_gallery(version_id);

-- 3. Backfill existing gallery images to the default version of their project
-- This migration is idempotent.
DO $$
DECLARE
  v_gallery RECORD;
  v_default_version_id UUID;
BEGIN
  FOR v_gallery IN
    SELECT pg.id, pg.project_id
    FROM public.project_gallery pg
    WHERE pg.version_id IS NULL
  LOOP
    SELECT pv.id INTO v_default_version_id
    FROM public.project_versions pv
    WHERE pv.project_id = v_gallery.project_id AND pv.is_default = true
    LIMIT 1;

    IF v_default_version_id IS NOT NULL THEN
      UPDATE public.project_gallery
      SET version_id = v_default_version_id
      WHERE id = v_gallery.id;

      RAISE NOTICE 'Assigned gallery image % to default version %', v_gallery.id, v_default_version_id;
    ELSE
      RAISE WARNING 'No default version found for project % (gallery image %)', v_gallery.project_id, v_gallery.id;
    END IF;
  END LOOP;
END;
$$;

-- 4. Notify PostgREST schema cache to reload
NOTIFY pgrst, 'reload schema';

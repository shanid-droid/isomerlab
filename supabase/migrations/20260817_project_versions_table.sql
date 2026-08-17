-- ============================================================================
-- ISOMER: PROJECT VERSIONING SYSTEM — PHASE 1
-- ============================================================================

-- 1. Create project_versions table
CREATE TABLE IF NOT EXISTS public.project_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  version_name TEXT NOT NULL,
  version_number TEXT NOT NULL,
  description TEXT,
  whats_new TEXT,
  thumbnail_url TEXT,
  video_url TEXT,
  project_links JSONB NOT NULL DEFAULT '[]'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_project_versions_project_id
  ON public.project_versions(project_id);

CREATE INDEX IF NOT EXISTS idx_project_versions_project_sort
  ON public.project_versions(project_id, sort_order);

-- 3. Uniqueness: one version number per project
CREATE UNIQUE INDEX IF NOT EXISTS idx_project_versions_unique_number_per_project
  ON public.project_versions(project_id, version_number);

-- 4. Ensure only one default version per project
CREATE UNIQUE INDEX IF NOT EXISTS idx_project_versions_one_default_per_project
  ON public.project_versions(project_id)
  WHERE is_default = true;

-- 5. Helper function: ensure a project always has exactly one default version
CREATE OR REPLACE FUNCTION public.ensure_project_has_default_version(p_project_id UUID)
RETURNS VOID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.project_versions
    WHERE project_id = p_project_id AND is_default = true
  ) THEN
    UPDATE public.project_versions
    SET is_default = true, updated_at = now()
    WHERE id = (
      SELECT id FROM public.project_versions
      WHERE project_id = p_project_id
      ORDER BY sort_order ASC, created_at ASC
      LIMIT 1
    );
  END IF;
END;
$$;

-- 6. Trigger: maintain default version on INSERT/UPDATE
CREATE OR REPLACE FUNCTION public.trg_ensure_project_default_version()
RETURNS TRIGGER
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Prevent recursive trigger execution when the trigger itself performs an UPDATE
  IF pg_trigger_depth() > 0 THEN
    RETURN NEW;
  END IF;

  IF NEW.is_default = true THEN
    UPDATE public.project_versions
    SET is_default = false, updated_at = now()
    WHERE project_id = NEW.project_id AND is_default = true AND id <> NEW.id;
  END IF;

  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.is_default <> NEW.is_default) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.project_versions
      WHERE project_id = NEW.project_id AND is_default = true
    ) THEN
      UPDATE public.project_versions
      SET is_default = true, updated_at = now()
      WHERE project_id = NEW.project_id AND id = NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_project_versions_default ON public.project_versions;
CREATE TRIGGER trg_project_versions_default
  BEFORE INSERT OR UPDATE OF is_default ON public.project_versions
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_ensure_project_default_version();

-- 7. Enable RLS
ALTER TABLE public.project_versions ENABLE ROW LEVEL SECURITY;

-- 8. RLS Policies
DROP POLICY IF EXISTS "Public read versions of published projects" ON public.project_versions;
CREATE POLICY "Public read versions of published projects"
  ON public.project_versions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_versions.project_id AND p.published = true
    )
    OR public.is_owner()
    OR (
      public.is_admin() AND EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_versions.project_id AND p.created_by = auth.uid()
      )
    )
    OR (
      public.is_creator() AND EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_versions.project_id AND p.created_by = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Owner admin insert versions for own projects" ON public.project_versions;
CREATE POLICY "Owner admin insert versions for own projects"
  ON public.project_versions FOR INSERT
  WITH CHECK (
    public.is_owner()
    OR (
      public.is_admin() AND EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_versions.project_id AND p.created_by = auth.uid()
      )
    )
    OR (
      public.is_creator() AND EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_versions.project_id AND p.created_by = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Owner admin update versions for own projects" ON public.project_versions;
CREATE POLICY "Owner admin update versions for own projects"
  ON public.project_versions FOR UPDATE
  USING (
    public.is_owner()
    OR (
      public.is_admin() AND EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_versions.project_id AND p.created_by = auth.uid()
      )
    )
    OR (
      public.is_creator() AND EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_versions.project_id AND p.created_by = auth.uid()
      )
    )
  )
  WITH CHECK (
    public.is_owner()
    OR (
      public.is_admin() AND EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_versions.project_id AND p.created_by = auth.uid()
      )
    )
    OR (
      public.is_creator() AND EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_versions.project_id AND p.created_by = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Owner admin delete versions for own projects" ON public.project_versions;
CREATE POLICY "Owner admin delete versions for own projects"
  ON public.project_versions FOR DELETE
  USING (
    public.is_owner()
    OR (
      public.is_admin() AND EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_versions.project_id AND p.created_by = auth.uid()
      )
    )
    OR (
      public.is_creator() AND EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_versions.project_id AND p.created_by = auth.uid()
      )
    )
  );

-- 9. Notify PostgREST schema cache to reload
NOTIFY pgrst, 'reload schema';

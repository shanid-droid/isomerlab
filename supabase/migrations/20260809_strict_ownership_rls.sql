-- ============================================================================
-- ISOMER MIGRATION: STRICT PROJECT OWNERSHIP & GALLERY RLS ENFORCEMENT
-- ============================================================================

-- 1. Ensure created_by column exists and default is set to auth.uid()
ALTER TABLE public.projects 
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();

ALTER TABLE public.projects 
  ALTER COLUMN created_by SET DEFAULT auth.uid();

-- 2. Backfill unassigned projects to Owner UUID (9d5d6287-1843-4cd0-afee-fc1830411571)
UPDATE public.projects
SET created_by = '9d5d6287-1843-4cd0-afee-fc1830411571'::uuid
WHERE created_by IS NULL;

-- 3. Security Definer Helper Function to check Admin Role safely
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- 4. Enable RLS on public.projects & public.project_gallery
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_gallery ENABLE ROW LEVEL SECURITY;

-- 5. Clean up existing policies on public.projects
DROP POLICY IF EXISTS "Public users view published projects" ON public.projects;
DROP POLICY IF EXISTS "Admins view all projects" ON public.projects;
DROP POLICY IF EXISTS "Admins insert projects" ON public.projects;
DROP POLICY IF EXISTS "Admins update projects" ON public.projects;
DROP POLICY IF EXISTS "Admins delete projects" ON public.projects;
DROP POLICY IF EXISTS "Admins full management projects" ON public.projects;
DROP POLICY IF EXISTS "Public view published projects or admins view all" ON public.projects;
DROP POLICY IF EXISTS "Public view published projects, owner views all, admins view own" ON public.projects;
DROP POLICY IF EXISTS "Admins insert own projects" ON public.projects;
DROP POLICY IF EXISTS "Owner updates all, admins update own projects" ON public.projects;
DROP POLICY IF EXISTS "Owner deletes all, admins delete own projects" ON public.projects;

-- 6. Create RLS Policies for public.projects

-- SELECT: Public views published; Owner views all; Admins view own projects
CREATE POLICY "Public view published projects, owner views all, admins view own"
  ON public.projects FOR SELECT
  USING (
    published = true 
    OR public.is_owner() 
    OR (public.is_admin() AND created_by = auth.uid())
  );

-- INSERT: Admins/Owner insert projects, created_by MUST equal auth.uid()
CREATE POLICY "Admins insert own projects"
  ON public.projects FOR INSERT
  WITH CHECK (
    public.is_admin() AND COALESCE(created_by, auth.uid()) = auth.uid()
  );

-- UPDATE: Owner updates all projects; Admins update only own projects
CREATE POLICY "Owner updates all, admins update own projects"
  ON public.projects FOR UPDATE
  USING (
    public.is_owner() OR (public.is_admin() AND created_by = auth.uid())
  )
  WITH CHECK (
    public.is_owner() OR (public.is_admin() AND created_by = auth.uid())
  );

-- DELETE: Owner deletes all projects; Admins delete only own projects
CREATE POLICY "Owner deletes all, admins delete own projects"
  ON public.projects FOR DELETE
  USING (
    public.is_owner() OR (public.is_admin() AND created_by = auth.uid())
  );

-- 7. Clean up existing policies on public.project_gallery
DROP POLICY IF EXISTS "Public view project gallery" ON public.project_gallery;
DROP POLICY IF EXISTS "Admins view all project gallery" ON public.project_gallery;
DROP POLICY IF EXISTS "Admins insert project gallery" ON public.project_gallery;
DROP POLICY IF EXISTS "Admins update project gallery" ON public.project_gallery;
DROP POLICY IF EXISTS "Admins delete project gallery" ON public.project_gallery;
DROP POLICY IF EXISTS "Admins full management project gallery" ON public.project_gallery;
DROP POLICY IF EXISTS "Public view project gallery or admins view all" ON public.project_gallery;
DROP POLICY IF EXISTS "Public view gallery or owner view all or admins view own" ON public.project_gallery;
DROP POLICY IF EXISTS "Owner or admin inserts gallery for owned projects" ON public.project_gallery;
DROP POLICY IF EXISTS "Owner or admin updates gallery for owned projects" ON public.project_gallery;
DROP POLICY IF EXISTS "Owner or admin deletes gallery for owned projects" ON public.project_gallery;

-- 8. Create RLS Policies for public.project_gallery

CREATE POLICY "Public view gallery or owner view all or admins view own"
  ON public.project_gallery FOR SELECT
  USING (
    public.is_owner() 
    OR EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = project_gallery.project_id
        AND (projects.published = true OR (public.is_admin() AND projects.created_by = auth.uid()))
    )
  );

CREATE POLICY "Owner or admin inserts gallery for owned projects"
  ON public.project_gallery FOR INSERT
  WITH CHECK (
    public.is_owner() OR (
      public.is_admin() AND EXISTS (
        SELECT 1 FROM public.projects
        WHERE projects.id = project_gallery.project_id AND projects.created_by = auth.uid()
      )
    )
  );

CREATE POLICY "Owner or admin updates gallery for owned projects"
  ON public.project_gallery FOR UPDATE
  USING (
    public.is_owner() OR (
      public.is_admin() AND EXISTS (
        SELECT 1 FROM public.projects
        WHERE projects.id = project_gallery.project_id AND projects.created_by = auth.uid()
      )
    )
  )
  WITH CHECK (
    public.is_owner() OR (
      public.is_admin() AND EXISTS (
        SELECT 1 FROM public.projects
        WHERE projects.id = project_gallery.project_id AND projects.created_by = auth.uid()
      )
    )
  );

CREATE POLICY "Owner or admin deletes gallery for owned projects"
  ON public.project_gallery FOR DELETE
  USING (
    public.is_owner() OR (
      public.is_admin() AND EXISTS (
        SELECT 1 FROM public.projects
        WHERE projects.id = project_gallery.project_id AND projects.created_by = auth.uid()
      )
    )
  );

-- 9. Notify PostgREST schema cache to reload
NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- ISOMER MIGRATION: PROJECTS & PROJECT_GALLERY ADMIN RLS POLICIES
-- ============================================================================

-- 1. Security Definer Helper Function to check Admin Role safely
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

-- 2. Enable RLS on public.projects & public.project_gallery
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_gallery ENABLE ROW LEVEL SECURITY;

-- 3. Clean up legacy policies on public.projects
DROP POLICY IF EXISTS "Public users view published projects" ON public.projects;
DROP POLICY IF EXISTS "Admins view all projects" ON public.projects;
DROP POLICY IF EXISTS "Admins insert projects" ON public.projects;
DROP POLICY IF EXISTS "Admins update projects" ON public.projects;
DROP POLICY IF EXISTS "Admins delete projects" ON public.projects;
DROP POLICY IF EXISTS "Admins full management projects" ON public.projects;
DROP POLICY IF EXISTS "Public view published projects or admins view all" ON public.projects;

-- 4. Create RLS Policies for public.projects
CREATE POLICY "Public view published projects or admins view all"
  ON public.projects FOR SELECT
  USING (published = true OR public.is_admin());

CREATE POLICY "Admins insert projects"
  ON public.projects FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins update projects"
  ON public.projects FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins delete projects"
  ON public.projects FOR DELETE
  USING (public.is_admin());

-- 5. Clean up legacy policies on public.project_gallery
DROP POLICY IF EXISTS "Public view project gallery" ON public.project_gallery;
DROP POLICY IF EXISTS "Admins view all project gallery" ON public.project_gallery;
DROP POLICY IF EXISTS "Admins insert project gallery" ON public.project_gallery;
DROP POLICY IF EXISTS "Admins update project gallery" ON public.project_gallery;
DROP POLICY IF EXISTS "Admins delete project gallery" ON public.project_gallery;
DROP POLICY IF EXISTS "Admins full management project gallery" ON public.project_gallery;
DROP POLICY IF EXISTS "Public view project gallery or admins view all" ON public.project_gallery;

-- 6. Create RLS Policies for public.project_gallery
CREATE POLICY "Public view project gallery or admins view all"
  ON public.project_gallery FOR SELECT
  USING (
    public.is_admin() OR EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = project_gallery.project_id AND projects.published = true
    )
  );

CREATE POLICY "Admins insert project gallery"
  ON public.project_gallery FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins update project gallery"
  ON public.project_gallery FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins delete project gallery"
  ON public.project_gallery FOR DELETE
  USING (public.is_admin());

-- 7. Notify PostgREST schema cache to reload
NOTIFY pgrst, 'reload schema';

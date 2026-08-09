-- ============================================================================
-- ISOMER WEBSITE - USER PROFILES & ROLE-BASED ACCESS CONTROL (RBAC) SCHEMA
-- ============================================================================

-- 1. Create public.profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Security Definer Helper Functions for RLS
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

CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN auth.uid() = '9d5d6287-1843-4cd0-afee-fc1830411571'::uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- 4. Trigger Function: Auto-create profile on new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role, avatar_url, created_at, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)),
    NEW.email,
    'user',
    NEW.raw_user_meta_data->>'avatar_url',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. Backfill existing auth.users accounts into profiles table
INSERT INTO public.profiles (id, full_name, email, role, created_at, updated_at)
SELECT 
  id, 
  COALESCE(raw_user_meta_data->>'full_name', SPLIT_PART(email, '@', 1)), 
  email, 
  'admin', -- Grant existing auth accounts admin status
  created_at, 
  NOW()
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- Force set Owner account to admin role
UPDATE public.profiles
SET role = 'admin'
WHERE id = '9d5d6287-1843-4cd0-afee-fc1830411571'::uuid;

-- 6. Row Level Security Policies for public.profiles

DROP POLICY IF EXISTS "Users view own profile or admins view all" ON public.profiles;
DROP POLICY IF EXISTS "Users update own profile fields" ON public.profiles;
DROP POLICY IF EXISTS "Admins full management access" ON public.profiles;
DROP POLICY IF EXISTS "Users view own profile or owner views all" ON public.profiles;
DROP POLICY IF EXISTS "Users update own profile non-role fields" ON public.profiles;
DROP POLICY IF EXISTS "Owner full management access" ON public.profiles;

-- Policy 1: Users view ONLY their own profile OR Owner views all profiles
CREATE POLICY "Users view own profile or owner views all"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id OR public.is_owner());

-- Policy 2: Users update own profile fields, BUT CANNOT change their role unless Owner. Owner role cannot be changed.
CREATE POLICY "Users update own profile non-role fields"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id OR public.is_owner())
  WITH CHECK (
    (public.is_owner() AND (id != '9d5d6287-1843-4cd0-afee-fc1830411571'::uuid OR role = 'admin'))
    OR (
      auth.uid() = id AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
    )
  );

-- Policy 3: Owner full management access
CREATE POLICY "Owner full management access"
  ON public.profiles FOR ALL
  USING (public.is_owner());

-- 7. Row Level Security Policies for public.projects & public.project_gallery

-- Ensure created_by column exists on public.projects
ALTER TABLE public.projects 
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();

-- Assign any unowned projects to Owner UUID
UPDATE public.projects
SET created_by = '9d5d6287-1843-4cd0-afee-fc1830411571'::uuid
WHERE created_by IS NULL;

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_gallery ENABLE ROW LEVEL SECURITY;

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

-- SELECT Policy: Public views published projects; Owner views all; Admins view own projects
CREATE POLICY "Public view published projects, owner views all, admins view own"
  ON public.projects FOR SELECT
  USING (
    published = true 
    OR public.is_owner() 
    OR (public.is_admin() AND created_by = auth.uid())
  );

-- INSERT Policy: Admins/Owner insert projects, created_by must match auth.uid()
CREATE POLICY "Admins insert own projects"
  ON public.projects FOR INSERT
  WITH CHECK (
    public.is_admin() AND COALESCE(created_by, auth.uid()) = auth.uid()
  );

-- UPDATE Policy: Owner updates all projects; Admins update only own projects
CREATE POLICY "Owner updates all, admins update own projects"
  ON public.projects FOR UPDATE
  USING (
    public.is_owner() OR (public.is_admin() AND created_by = auth.uid())
  )
  WITH CHECK (
    public.is_owner() OR (public.is_admin() AND created_by = auth.uid())
  );

-- DELETE Policy: Owner deletes all projects; Admins delete only own projects
CREATE POLICY "Owner deletes all, admins delete own projects"
  ON public.projects FOR DELETE
  USING (
    public.is_owner() OR (public.is_admin() AND created_by = auth.uid())
  );

-- Gallery Policies
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

-- 8. Notify PostgREST schema cache to reload
NOTIFY pgrst, 'reload schema';

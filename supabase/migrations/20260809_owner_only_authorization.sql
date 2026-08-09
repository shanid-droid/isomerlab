-- ============================================================================
-- ISOMER MIGRATION: OWNER-ONLY USER MANAGEMENT AUTHORIZATION
-- ============================================================================

-- 1. Helper Function to verify Owner identity
CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN auth.uid() = '9d5d6287-1843-4cd0-afee-fc1830411571'::uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 2. Clean up legacy admin access policies on public.profiles
DROP POLICY IF EXISTS "Users view own profile or admins view all" ON public.profiles;
DROP POLICY IF EXISTS "Users update own profile fields" ON public.profiles;
DROP POLICY IF EXISTS "Admins full management access" ON public.profiles;
DROP POLICY IF EXISTS "Users view own profile or owner views all" ON public.profiles;
DROP POLICY IF EXISTS "Users update own profile non-role fields" ON public.profiles;
DROP POLICY IF EXISTS "Owner full management access" ON public.profiles;

-- 3. Policy 1: Users view ONLY their own profile OR Owner views all profiles
CREATE POLICY "Users view own profile or owner views all"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id OR public.is_owner());

-- 4. Policy 2: Users update own profile fields, BUT CANNOT change their role unless Owner. Owner role cannot be demoted.
CREATE POLICY "Users update own profile non-role fields"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id OR public.is_owner())
  WITH CHECK (
    (public.is_owner() AND (id != '9d5d6287-1843-4cd0-afee-fc1830411571'::uuid OR role = 'admin'))
    OR (
      auth.uid() = id AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
    )
  );

-- 5. Policy 3: Owner full management access
CREATE POLICY "Owner full management access"
  ON public.profiles FOR ALL
  USING (public.is_owner());

-- 6. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

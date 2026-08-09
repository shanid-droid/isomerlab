-- ============================================================================
-- ISOMER WEBSITE - USER PROFILES & ROLE-BASED ACCESS CONTROL (RBAC) SCHEMA
-- ============================================================================

-- 1. Create Profiles Table linked to auth.users
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

-- 3. Security Definer Helper Function to check Admin & Owner Roles
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN auth.uid() = '9d5d6287-1843-4cd0-afee-fc1830411571'::uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 4. Trigger Function: Automatically create profile on new user signup
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

-- 5. Backfill existing auth.users into profiles table
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

-- Policy 3: Owner full administrative access
CREATE POLICY "Owner full management access"
  ON public.profiles FOR ALL
  USING (public.is_owner());

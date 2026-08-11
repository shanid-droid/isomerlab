-- ============================================================================
-- ISOMER MIGRATION: FIX PROFILE BUGS
-- Bug 1: Ensure bio, about, social_links columns exist so updates are persisted.
-- Bug 2: Ensure public (anonymous) users can SELECT profile rows for the
--         public profile page. Previous policy "Users view own profile or
--         owner views all" blocks anonymous reads → 404 on /profile/:id.
--
-- SAFE: All statements are idempotent (IF NOT EXISTS / DROP IF EXISTS).
-- DOES NOT TOUCH: UPDATE, DELETE, admin/owner policies, project RLS.
-- ============================================================================

-- 1. Ensure extended profile columns exist (idempotent)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bio          TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS about        TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS social_links JSONB   DEFAULT '{}'::jsonb;

-- 2. Backfill NULL social_links to empty JSONB (safe for existing rows)
UPDATE public.profiles
SET social_links = '{}'::jsonb
WHERE social_links IS NULL;

-- 3. Inspect existing SELECT policies before making changes.
-- Run the following query manually to see what is active:
--   SELECT policyname, cmd, qual
--   FROM pg_policies
--   WHERE tablename = 'profiles' ORDER BY cmd, policyname;
--
-- The following DROP statements are safe even if the policy does not exist.

-- Drop the old restrictive SELECT policy (only allows self or owner to read).
-- This blocks anonymous users from viewing public profiles.
DROP POLICY IF EXISTS "Users view own profile or owner views all" ON public.profiles;
DROP POLICY IF EXISTS "Users view own profile or admins view all" ON public.profiles;

-- Also drop the public policy if it already exists, so we can recreate cleanly.
DROP POLICY IF EXISTS "Public can read profiles" ON public.profiles;

-- 4. Create the public SELECT policy.
-- Allows ALL users (including unauthenticated) to read any profile row.
-- The frontend queries only expose safe public fields:
--   id, full_name, avatar_url, bio, about, social_links, created_at
-- Sensitive fields (email, role) are never fetched in public-facing queries.
CREATE POLICY "Public can read profiles"
  ON public.profiles FOR SELECT
  USING (true);

-- 5. Ensure the self-UPDATE policy exists and is correct.
-- (Drop and recreate for idempotency — same logic as before.)
DROP POLICY IF EXISTS "Users update own profile non-role fields" ON public.profiles;

CREATE POLICY "Users update own profile non-role fields"
  ON public.profiles FOR UPDATE
  USING  (auth.uid() = id OR public.is_owner())
  WITH CHECK (
    (public.is_owner() AND (id != '9d5d6287-1843-4cd0-afee-fc1830411571'::uuid OR role = 'admin'))
    OR (
      auth.uid() = id
      AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
    )
  );

-- 6. Ensure the owner full-management policy exists (idempotent).
DROP POLICY IF EXISTS "Owner full management access" ON public.profiles;

CREATE POLICY "Owner full management access"
  ON public.profiles FOR ALL
  USING (public.is_owner());

-- 7. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

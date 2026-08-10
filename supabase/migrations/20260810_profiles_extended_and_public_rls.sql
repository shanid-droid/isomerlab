-- ============================================================================
-- ISOMER MIGRATION: PROFILES EXTENSION + PUBLIC RLS + AVATAR STORAGE
-- ============================================================================
-- Run this in Supabase SQL Editor or via supabase db push
-- Safe: uses ADD COLUMN IF NOT EXISTS, DROP IF EXISTS before recreating
-- ============================================================================

-- 1. Extend public.profiles with bio, about, social_links
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bio TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS about TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{}'::jsonb;

-- 2. Fix profiles SELECT RLS to allow public reads of safe fields
-- Drop existing SELECT policy first
DROP POLICY IF EXISTS "Users view own profile or owner views all" ON public.profiles;
DROP POLICY IF EXISTS "Users view own profile or admins view all" ON public.profiles;
DROP POLICY IF EXISTS "Users view own profile or owner views all" ON public.profiles;

-- Allow anyone (including unauthenticated) to read public profile fields
-- This is required for the public profile page and creator display on projects.
-- Sensitive fields (email, role internals) are not exposed in the frontend queries.
CREATE POLICY "Public can read profiles"
  ON public.profiles FOR SELECT
  USING (true);

-- Note: The existing UPDATE policy already prevents role changes:
-- "Users update own profile non-role fields" — untouched.
-- The "Owner full management access" policy — untouched.

-- 3. Storage: Create avatars bucket (idempotent via INSERT ... ON CONFLICT)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  false,  -- private; we use signed URLs
  2097152, -- 2 MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 4. Storage RLS for avatars bucket
-- Drop existing policies if any
DROP POLICY IF EXISTS "Users upload own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users update own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users delete own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Public read avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read avatars" ON storage.objects;

-- Anyone can read avatars (for public profiles display)
CREATE POLICY "Anyone can read avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- Only the owning user can upload their own avatar
-- Avatar files must be stored under: avatars/{auth.uid()}/...
CREATE POLICY "Authenticated users can upload their own avatar"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Only the owning user can update their own avatar
CREATE POLICY "Authenticated users can update their own avatar"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Only the owning user can delete their own avatar
CREATE POLICY "Authenticated users can delete their own avatar"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 5. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

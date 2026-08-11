-- ============================================================================
-- ISOMER MIGRATION: FIX MISSING PROFILE ROWS + HARDEN TRIGGER
-- ============================================================================
-- ROOT CAUSE:
--   The on_auth_user_created trigger fires AFTER INSERT on auth.users.
--   Google OAuth only inserts a user row ONCE (on first login). If the
--   trigger did not exist yet when cc4c7f2a-3238-4880-89a9-192dd1b6e33a
--   first signed in, no profile row was ever created. Subsequent Google
--   logins UPDATE (not INSERT) the auth.users row, so the trigger never
--   fires again for this user.
--
-- THIS MIGRATION:
--   1. Replaces handle_new_user() with the correct final version.
--   2. Re-attaches the trigger (idempotent).
--   3. Backfills ALL auth.users who are missing a profiles row.
--   4. Does NOT modify existing profiles rows.
--   5. Does NOT touch project RLS, admin/owner policies, or OAuth config.
-- ============================================================================

-- ── STEP 1: Replace the trigger function ─────────────────────────────────────
-- CREATE OR REPLACE is safe — it updates the existing function in-place.
-- The existing on_auth_user_created trigger will continue pointing to it.
--
-- Key changes vs previous versions:
--   • ON CONFLICT (id) DO NOTHING  — idempotent, never overwrites edits
--   • Reads Google metadata: full_name, name, avatar_url, picture
--   • NULLIF(TRIM(...), '') treats empty strings as NULL (Google quirk)
--   • Handles missing email safely with COALESCE
--   • NEVER sets role to anything other than 'user'
--   • SECURITY DEFINER so it can write to public.profiles from auth context
--   • SET search_path = public prevents search-path injection attacks

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_full_name  TEXT;
  v_avatar_url TEXT;
  v_email      TEXT;
BEGIN
  -- Google OAuth provides metadata in different keys depending on the provider:
  --   full_name  = set by Supabase for email/password signups
  --   name       = set by Google OAuth
  --   avatar_url = set by Supabase for email/password
  --   picture    = set by Google OAuth
  v_full_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''),
    NULLIF(SPLIT_PART(COALESCE(NEW.email, ''), '@', 1), ''),
    'User'
  );

  v_avatar_url := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'avatar_url'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'picture'), '')
  );

  v_email := COALESCE(
    NULLIF(TRIM(NEW.email), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'email'), ''),
    ''
  );

  INSERT INTO public.profiles (
    id,
    full_name,
    email,
    role,          -- Always 'user' — role promotion is owner-only
    avatar_url,
    bio,
    about,
    social_links,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    v_full_name,
    v_email,
    'user',
    v_avatar_url,
    NULL,
    NULL,
    '{}'::jsonb,
    NOW(),
    NOW()
  )
  -- Idempotent: if a profile row already exists for this user, do nothing.
  -- This prevents overwriting user-edited profile data on re-auth events.
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ── STEP 2: Re-attach trigger (idempotent) ───────────────────────────────────
-- DROP IF EXISTS + CREATE ensures the trigger is active and points to the
-- updated function definition above.

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();


-- ── STEP 3: Backfill ALL auth.users without a profiles row ───────────────────
-- Uses LEFT JOIN to find ONLY users with no matching profile row.
-- ON CONFLICT DO NOTHING makes this safe to run multiple times.
-- Role defaults to 'user' for all backfilled accounts.
-- The owner (9d5d6287-...) already has role='admin' and is untouched
-- because their row already exists (LEFT JOIN WHERE p.id IS NULL skips them).

INSERT INTO public.profiles (
  id,
  full_name,
  email,
  role,
  avatar_url,
  bio,
  about,
  social_links,
  created_at,
  updated_at
)
SELECT
  u.id,
  COALESCE(
    NULLIF(TRIM(u.raw_user_meta_data->>'full_name'), ''),
    NULLIF(TRIM(u.raw_user_meta_data->>'name'), ''),
    NULLIF(SPLIT_PART(COALESCE(u.email, ''), '@', 1), ''),
    'User'
  ),
  COALESCE(NULLIF(TRIM(u.email), ''), ''),
  'user',           -- all backfilled accounts default to 'user'
  COALESCE(
    NULLIF(TRIM(u.raw_user_meta_data->>'avatar_url'), ''),
    NULLIF(TRIM(u.raw_user_meta_data->>'picture'), '')
  ),
  NULL,             -- bio starts empty
  NULL,             -- about starts empty
  '{}'::jsonb,      -- social_links starts empty
  u.created_at,
  NOW()
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL            -- only users WITHOUT an existing profile row
ON CONFLICT (id) DO NOTHING;  -- safety net — never create duplicates


-- ── STEP 4: Verify cc4c7f2a specifically ─────────────────────────────────────
-- This SELECT must return EXACTLY ONE ROW after running the migration.
-- Confirm the values match the Google account before testing the app.

SELECT
  id,
  email,
  full_name,
  avatar_url,
  role,
  bio,
  about,
  social_links,
  created_at
FROM public.profiles
WHERE id = 'cc4c7f2a-3238-4880-89a9-192dd1b6e33a';


-- ── STEP 5: Count parity check ───────────────────────────────────────────────
-- auth_count and profile_count MUST be equal.
-- If auth_count > profile_count, users are still missing profiles.

SELECT
  (SELECT COUNT(*) FROM auth.users)      AS auth_count,
  (SELECT COUNT(*) FROM public.profiles) AS profile_count;


-- ── STEP 6: Reload PostgREST schema cache ────────────────────────────────────
NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- ISOMER MIGRATION: UPDATE handle_new_user TRIGGER FOR GOOGLE OAUTH
-- ============================================================================
-- Safely updates the trigger function to also populate bio, about, social_links
-- for new users (including Google OAuth users).
-- Existing user data and roles are NOT modified.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_full_name TEXT;
  v_avatar_url TEXT;
  v_email TEXT;
BEGIN
  -- Extract values; Google OAuth populates raw_user_meta_data with:
  --   full_name, avatar_url, email, picture, name
  v_full_name  := COALESCE(
                    NEW.raw_user_meta_data->>'full_name',
                    NEW.raw_user_meta_data->>'name',
                    SPLIT_PART(COALESCE(NEW.email, ''), '@', 1),
                    'User'
                  );

  v_avatar_url := COALESCE(
                    NEW.raw_user_meta_data->>'avatar_url',
                    NEW.raw_user_meta_data->>'picture'
                  );

  v_email      := COALESCE(NEW.email, NEW.raw_user_meta_data->>'email', '');

  INSERT INTO public.profiles (
    id, full_name, email, role, avatar_url, bio, about, social_links, created_at, updated_at
  )
  VALUES (
    NEW.id,
    v_full_name,
    v_email,
    'user',              -- ALL new users default to 'user'; only owner manually upgrades roles
    v_avatar_url,
    NULL,                -- bio starts empty
    NULL,                -- about starts empty
    '{}'::jsonb,         -- social_links starts empty
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    -- On re-login or token refresh, only update safe non-sensitive fields
    -- NEVER touch role — this preserves existing admin/owner upgrades
    email      = EXCLUDED.email,
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-attach trigger (DROP IF EXISTS + CREATE is idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

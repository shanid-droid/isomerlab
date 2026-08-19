-- ============================================================================
-- ISOMER MIGRATION: PUBLIC CREATOR PROFILE RPC & SYNC
-- ============================================================================
-- 1. Create public.get_public_creator_profile(p_user_id UUID)
-- Safe SECURITY DEFINER function that retrieves public profile + approved creator
-- professional info, skills, project types, and social links without exposing DOB or private notes.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_public_creator_profile(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_profile RECORD;
  v_app RECORD;
  v_social JSONB;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- 1. Fetch base profile
  SELECT id, full_name, avatar_url, bio, about, social_links, role, creator_approved_at, created_at
  INTO v_profile
  FROM public.profiles
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- 2. Fetch latest approved creator application if any
  SELECT profession, profession_other, applicant_role, applicant_role_other,
         education, education_details, experience_level, location, skills, project_types,
         github_url, portfolio_url, linkedin_url, other_url, bio as app_bio
  INTO v_app
  FROM public.creator_applications
  WHERE user_id = p_user_id AND status = 'approved'
  ORDER BY created_at DESC
  LIMIT 1;

  -- 3. Merge social links (prioritize profile social_links, fall back to application links)
  v_social := COALESCE(v_profile.social_links, '{}'::jsonb);
  IF v_app.github_url IS NOT NULL AND trim(v_app.github_url) <> '' AND NOT (v_social ? 'github') THEN
    v_social := jsonb_set(v_social, '{github}', to_jsonb(trim(v_app.github_url)));
  END IF;
  IF v_app.linkedin_url IS NOT NULL AND trim(v_app.linkedin_url) <> '' AND NOT (v_social ? 'linkedin') THEN
    v_social := jsonb_set(v_social, '{linkedin}', to_jsonb(trim(v_app.linkedin_url)));
  END IF;
  IF v_app.portfolio_url IS NOT NULL AND trim(v_app.portfolio_url) <> '' AND NOT (v_social ? 'website') AND NOT (v_social ? 'portfolio') THEN
    v_social := jsonb_set(v_social, '{website}', to_jsonb(trim(v_app.portfolio_url)));
  END IF;
  IF v_app.other_url IS NOT NULL AND trim(v_app.other_url) <> '' AND NOT (v_social ? 'other') THEN
    v_social := jsonb_set(v_social, '{other}', to_jsonb(trim(v_app.other_url)));
  END IF;

  -- 4. Construct safe public JSON payload
  v_result := jsonb_build_object(
    'id', v_profile.id,
    'full_name', v_profile.full_name,
    'avatar_url', v_profile.avatar_url,
    'bio', COALESCE(NULLIF(trim(v_profile.bio), ''), v_app.app_bio),
    'about', v_profile.about,
    'social_links', v_social,
    'role', v_profile.role,
    'creator_approved_at', v_profile.creator_approved_at,
    'created_at', v_profile.created_at,
    'profession', COALESCE(NULLIF(trim(v_app.profession_other), ''), NULLIF(trim(v_app.profession), '')),
    'current_role', COALESCE(NULLIF(trim(v_app.applicant_role_other), ''), NULLIF(trim(v_app.applicant_role), '')),
    'education', NULLIF(trim(v_app.education), ''),
    'education_details', NULLIF(trim(v_app.education_details), ''),
    'experience_level', NULLIF(trim(v_app.experience_level), ''),
    'location', NULLIF(trim(v_app.location), ''),
    'skills', NULLIF(trim(v_app.skills), ''),
    'project_types', NULLIF(trim(v_app.project_types), '')
  );

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_creator_profile(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_creator_profile(UUID) TO anon, authenticated;

-- ============================================================================
-- 2. Update review_creator_application RPC to also initialize social links and bio
-- ============================================================================
CREATE OR REPLACE FUNCTION public.review_creator_application(
  p_application_id UUID,
  p_action TEXT,
  p_rejection_reason TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_app public.creator_applications%ROWTYPE;
  v_soc JSONB;
BEGIN
  IF NOT (public.is_owner() OR public.is_admin()) THEN
    RAISE EXCEPTION 'Access denied: insufficient permissions';
  END IF;

  IF p_action NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'Invalid action: must be approve or reject';
  END IF;

  SELECT * INTO v_app
  FROM public.creator_applications
  WHERE id = p_application_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Application not found';
  END IF;

  IF v_app.status <> 'pending' THEN
    RAISE EXCEPTION 'Application has already been reviewed';
  END IF;

  IF p_action = 'approve' THEN
    -- Prepare initial social links if not already set on profile
    SELECT social_links INTO v_soc FROM public.profiles WHERE id = v_app.user_id;
    v_soc := COALESCE(v_soc, '{}'::jsonb);
    IF v_app.github_url IS NOT NULL AND trim(v_app.github_url) <> '' AND NOT (v_soc ? 'github') THEN
      v_soc := jsonb_set(v_soc, '{github}', to_jsonb(trim(v_app.github_url)));
    END IF;
    IF v_app.linkedin_url IS NOT NULL AND trim(v_app.linkedin_url) <> '' AND NOT (v_soc ? 'linkedin') THEN
      v_soc := jsonb_set(v_soc, '{linkedin}', to_jsonb(trim(v_app.linkedin_url)));
    END IF;
    IF v_app.portfolio_url IS NOT NULL AND trim(v_app.portfolio_url) <> '' AND NOT (v_soc ? 'website') AND NOT (v_soc ? 'portfolio') THEN
      v_soc := jsonb_set(v_soc, '{website}', to_jsonb(trim(v_app.portfolio_url)));
    END IF;
    IF v_app.other_url IS NOT NULL AND trim(v_app.other_url) <> '' AND NOT (v_soc ? 'other') THEN
      v_soc := jsonb_set(v_soc, '{other}', to_jsonb(trim(v_app.other_url)));
    END IF;

    UPDATE public.profiles
    SET
      role = 'creator',
      creator_approved_at = now(),
      creator_requirement_status = 'pending',
      first_project_uploaded_at = NULL,
      date_of_birth = COALESCE(v_app.date_of_birth, profiles.date_of_birth),
      bio = COALESCE(NULLIF(trim(profiles.bio), ''), NULLIF(trim(v_app.bio), ''), profiles.bio),
      social_links = v_soc,
      updated_at = now()
    WHERE id = v_app.user_id;

    UPDATE public.creator_applications
    SET
      status = 'approved',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      rejection_reason = NULL
    WHERE id = p_application_id;

    PERFORM public.insert_activity_log(
      auth.uid(),
      'creator_application_approved',
      'creator_application',
      p_application_id::text,
      jsonb_build_object('applicant_id', v_app.user_id, 'full_name', v_app.full_name)
    );
  ELSE
    UPDATE public.creator_applications
    SET
      status = 'rejected',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      rejection_reason = NULLIF(trim(p_rejection_reason), '')
    WHERE id = p_application_id;

    PERFORM public.insert_activity_log(
      auth.uid(),
      'creator_application_rejected',
      'creator_application',
      p_application_id::text,
      jsonb_build_object(
        'applicant_id', v_app.user_id,
        'full_name', v_app.full_name,
        'rejection_reason', NULLIF(trim(p_rejection_reason), '')
      )
    );
  END IF;
END;
$fn$;

-- ============================================================================
-- 3. Backfill existing approved creators' profile social_links and bio
-- ============================================================================
DO $$
DECLARE
  r RECORD;
  v_soc JSONB;
BEGIN
  FOR r IN 
    SELECT ca.user_id, ca.bio, ca.github_url, ca.portfolio_url, ca.linkedin_url, ca.other_url,
           p.social_links as curr_soc, p.bio as curr_bio
    FROM public.creator_applications ca
    JOIN public.profiles p ON p.id = ca.user_id
    WHERE ca.status = 'approved'
  LOOP
    v_soc := COALESCE(r.curr_soc, '{}'::jsonb);
    IF r.github_url IS NOT NULL AND trim(r.github_url) <> '' AND NOT (v_soc ? 'github') THEN
      v_soc := jsonb_set(v_soc, '{github}', to_jsonb(trim(r.github_url)));
    END IF;
    IF r.linkedin_url IS NOT NULL AND trim(r.linkedin_url) <> '' AND NOT (v_soc ? 'linkedin') THEN
      v_soc := jsonb_set(v_soc, '{linkedin}', to_jsonb(trim(r.linkedin_url)));
    END IF;
    IF r.portfolio_url IS NOT NULL AND trim(r.portfolio_url) <> '' AND NOT (v_soc ? 'website') AND NOT (v_soc ? 'portfolio') THEN
      v_soc := jsonb_set(v_soc, '{website}', to_jsonb(trim(r.portfolio_url)));
    END IF;
    IF r.other_url IS NOT NULL AND trim(r.other_url) <> '' AND NOT (v_soc ? 'other') THEN
      v_soc := jsonb_set(v_soc, '{other}', to_jsonb(trim(r.other_url)));
    END IF;

    UPDATE public.profiles
    SET
      bio = COALESCE(NULLIF(trim(r.curr_bio), ''), NULLIF(trim(r.bio), ''), profiles.bio),
      social_links = v_soc,
      updated_at = now()
    WHERE id = r.user_id;
  END LOOP;
END;
$$;

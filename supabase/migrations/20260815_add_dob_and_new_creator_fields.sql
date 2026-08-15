-- ============================================================================
-- ISOMER: CREATOR APPLICATION DOB & BIRTHDAY SYSTEM MIGRATION
-- ============================================================================

-- 1. Add date_of_birth & extra fields to creator_applications
ALTER TABLE public.creator_applications
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS profession_other TEXT,
  ADD COLUMN IF NOT EXISTS applicant_role_other TEXT,
  ADD COLUMN IF NOT EXISTS education_details TEXT,
  ADD COLUMN IF NOT EXISTS experience_level TEXT;

-- 2. Add date_of_birth to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS date_of_birth DATE;

-- 3. Update review_creator_application RPC to copy date_of_birth to profile
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
    UPDATE public.profiles
    SET
      role = 'creator',
      creator_approved_at = now(),
      creator_requirement_status = 'pending',
      first_project_uploaded_at = NULL,
      date_of_birth = COALESCE(v_app.date_of_birth, profiles.date_of_birth),
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

-- 4. Birthday Notification Generator RPC
CREATE OR REPLACE FUNCTION public.check_and_generate_birthday_notification(p_user_id UUID DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_target_user_id UUID;
  v_dob DATE;
  v_first_name TEXT;
  v_current_year INT;
  v_already_notified BOOLEAN;
BEGIN
  v_target_user_id := COALESCE(p_user_id, auth.uid());
  IF v_target_user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT date_of_birth, COALESCE(split_part(trim(full_name), ' ', 1), 'there')
  INTO v_dob, v_first_name
  FROM public.profiles
  WHERE id = v_target_user_id;

  IF v_dob IS NULL THEN
    -- Fallback: check creator application for DOB
    SELECT date_of_birth, COALESCE(split_part(trim(full_name), ' ', 1), 'there')
    INTO v_dob, v_first_name
    FROM public.creator_applications
    WHERE user_id = v_target_user_id AND date_of_birth IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  IF v_dob IS NULL THEN
    RETURN false;
  END IF;

  -- Check if today is the user's birthday (same month & day)
  IF EXTRACT(MONTH FROM v_dob) <> EXTRACT(MONTH FROM CURRENT_DATE) OR
     EXTRACT(DAY FROM v_dob) <> EXTRACT(DAY FROM CURRENT_DATE) THEN
    RETURN false;
  END IF;

  v_current_year := EXTRACT(YEAR FROM CURRENT_DATE)::INT;

  -- Check if a birthday notification for this year already exists for this user
  SELECT EXISTS (
    SELECT 1 FROM public.notifications
    WHERE recipient_id = v_target_user_id
      AND notification_type = 'birthday'
      AND (metadata->>'birthday_year')::INT = v_current_year
  ) INTO v_already_notified;

  IF v_already_notified THEN
    RETURN false;
  END IF;

  -- Insert Birthday notification
  INSERT INTO public.notifications (
    title,
    message,
    notification_type,
    recipient_id,
    created_by,
    is_active,
    metadata
  ) VALUES (
    '🎂 HAPPY BIRTHDAY!',
    'Happy Birthday, ' || v_first_name || '! 🎉' || E'\n\n' || 'The ISOMER LAB team wishes you an amazing year ahead filled with innovation and success.',
    'birthday',
    v_target_user_id,
    v_target_user_id,
    true,
    jsonb_build_object('birthday_year', v_current_year, 'birthday', true)
  );

  RETURN true;
END;
$fn$;

REVOKE ALL ON FUNCTION public.check_and_generate_birthday_notification(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_and_generate_birthday_notification(UUID) TO authenticated;

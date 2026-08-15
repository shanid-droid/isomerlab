-- ============================================================================
-- ISOMER: FIX RPC public.create_project_comment(p_content, p_parent_comment_id, p_project_id)
-- ============================================================================

-- Drop older overload if it existed
DROP FUNCTION IF EXISTS public.create_project_comment(UUID, TEXT, UUID);
DROP FUNCTION IF EXISTS public.create_project_comment(TEXT, UUID, UUID);

CREATE OR REPLACE FUNCTION public.create_project_comment(
  p_content TEXT,
  p_parent_comment_id UUID,
  p_project_id UUID
)
RETURNS public.project_comments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_user_id UUID;
  v_user_role TEXT;
  v_project_owner UUID;
  v_project_title TEXT;
  v_commenter_name TEXT;
  v_parent_author UUID;
  v_parent_project UUID;
  v_new_comment public.project_comments%ROWTYPE;
BEGIN
  -- 0. Authentication check
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- 1. Only authenticated users with profiles.role = 'creator' (or admin/owner) can create comments
  SELECT role INTO v_user_role FROM public.profiles WHERE id = v_user_id;

  IF NOT (v_user_role IN ('creator', 'admin') OR public.is_owner()) THEN
    RAISE EXCEPTION 'Only creators can comment on projects';
  END IF;

  -- 2. Verify project exists and is viewable
  SELECT created_by, title INTO v_project_owner, v_project_title
  FROM public.projects
  WHERE id = p_project_id;

  IF v_project_owner IS NULL THEN
    RAISE EXCEPTION 'Project not found';
  END IF;

  -- 3. If p_parent_comment_id is not NULL:
  --    - verify parent comment exists
  --    - verify parent belongs to the same project
  IF p_parent_comment_id IS NOT NULL THEN
    SELECT user_id, project_id INTO v_parent_author, v_parent_project
    FROM public.project_comments
    WHERE id = p_parent_comment_id;

    IF v_parent_author IS NULL THEN
      RAISE EXCEPTION 'Parent comment not found';
    END IF;

    IF v_parent_project <> p_project_id THEN
      RAISE EXCEPTION 'Parent comment does not belong to this project';
    END IF;
  END IF;

  IF trim(p_content) = '' THEN
    RAISE EXCEPTION 'Comment content cannot be empty';
  END IF;

  -- 4. Insert record
  INSERT INTO public.project_comments (
    project_id,
    user_id,
    content,
    parent_comment_id
  ) VALUES (
    p_project_id,
    v_user_id,
    trim(p_content),
    p_parent_comment_id
  )
  RETURNING * INTO v_new_comment;

  -- Get commenter's name for notification
  SELECT COALESCE(full_name, split_part(email, '@', 1), 'Someone')
  INTO v_commenter_name
  FROM public.profiles
  WHERE id = v_user_id;

  -- Send notification
  IF p_parent_comment_id IS NULL THEN
    -- Top-level comment: notify project owner if not self
    IF v_project_owner IS NOT NULL AND v_project_owner <> v_user_id THEN
      PERFORM public.create_notification(
        'New comment on your project',
        v_commenter_name || ' commented on "' || v_project_title || '".',
        'private',
        v_project_owner
      );
    END IF;
  ELSE
    -- Reply: notify parent comment author if not self
    IF v_parent_author IS NOT NULL AND v_parent_author <> v_user_id THEN
      PERFORM public.create_notification(
        'New reply to your comment',
        v_commenter_name || ' replied to your comment on "' || v_project_title || '".',
        'private',
        v_parent_author
      );
    END IF;
  END IF;

  -- 5. Return the newly created project_comments row
  RETURN v_new_comment;
END;
$fn$;

-- 9. Grant EXECUTE to authenticated
REVOKE ALL ON FUNCTION public.create_project_comment(TEXT, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_project_comment(TEXT, UUID, UUID) TO authenticated;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

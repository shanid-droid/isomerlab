-- ============================================================================
-- ISOMER: PROJECT LIKES & CREATOR COMMENTS MIGRATION
-- ============================================================================

-- 1. Create project_likes table
CREATE TABLE IF NOT EXISTS public.project_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_project_user_like UNIQUE (project_id, user_id)
);

ALTER TABLE public.project_likes ENABLE ROW LEVEL SECURITY;

-- Likes RLS Policies
DROP POLICY IF EXISTS "Public read project_likes" ON public.project_likes;
CREATE POLICY "Public read project_likes"
  ON public.project_likes FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Authenticated user insert own project_like" ON public.project_likes;
CREATE POLICY "Authenticated user insert own project_like"
  ON public.project_likes FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated user delete own project_like" ON public.project_likes;
CREATE POLICY "Authenticated user delete own project_like"
  ON public.project_likes FOR DELETE
  USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);


-- 2. Create project_comments table
CREATE TABLE IF NOT EXISTS public.project_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_comment_id UUID NULL REFERENCES public.project_comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_pinned BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_project_comments_project_id ON public.project_comments(project_id);
CREATE INDEX IF NOT EXISTS idx_project_comments_parent ON public.project_comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_project_comments_user ON public.project_comments(user_id);

ALTER TABLE public.project_comments ENABLE ROW LEVEL SECURITY;

-- Comments RLS Policies
DROP POLICY IF EXISTS "Public read project_comments" ON public.project_comments;
CREATE POLICY "Public read project_comments"
  ON public.project_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_comments.project_id
        AND p.published = true
    )
    OR public.is_admin()
    OR public.is_owner()
    OR auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_comments.project_id
        AND p.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Creators and project owner insert project_comments" ON public.project_comments;
CREATE POLICY "Creators and project owner insert project_comments"
  ON public.project_comments FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND auth.uid() = user_id
    AND (
      (parent_comment_id IS NULL AND (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('creator', 'admin'))
        OR public.is_owner()
      ))
      OR (parent_comment_id IS NOT NULL AND (
        EXISTS (SELECT 1 FROM public.projects WHERE id = project_comments.project_id AND created_by = auth.uid())
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('creator', 'admin'))
        OR public.is_owner()
      ))
    )
  );

DROP POLICY IF EXISTS "Author and project owner update project_comments" ON public.project_comments;
CREATE POLICY "Author and project owner update project_comments"
  ON public.project_comments FOR UPDATE
  USING (
    auth.uid() IS NOT NULL AND (
      user_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.projects WHERE id = project_comments.project_id AND created_by = auth.uid())
      OR public.is_admin()
      OR public.is_owner()
    )
  );

DROP POLICY IF EXISTS "Author and project owner delete project_comments" ON public.project_comments;
CREATE POLICY "Author and project owner delete project_comments"
  ON public.project_comments FOR DELETE
  USING (
    auth.uid() IS NOT NULL AND (
      user_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.projects WHERE id = project_comments.project_id AND created_by = auth.uid())
      OR public.is_admin()
      OR public.is_owner()
    )
  );


-- 3. RPC: create_project_comment
CREATE OR REPLACE FUNCTION public.create_project_comment(
  p_project_id UUID,
  p_content TEXT,
  p_parent_comment_id UUID DEFAULT NULL
)
RETURNS UUID
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
  v_new_comment_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT role INTO v_user_role FROM public.profiles WHERE id = v_user_id;

  SELECT created_by, title INTO v_project_owner, v_project_title
  FROM public.projects
  WHERE id = p_project_id;

  IF v_project_owner IS NULL THEN
    RAISE EXCEPTION 'Project not found';
  END IF;

  -- Validate permissions
  IF p_parent_comment_id IS NULL THEN
    -- Top-level comment: user must be creator, admin, or owner
    IF NOT (v_user_role IN ('creator', 'admin') OR public.is_owner()) THEN
      RAISE EXCEPTION 'Only creators can comment on projects';
    END IF;
  ELSE
    -- Reply: user must be project owner, creator, admin, or owner
    IF NOT (v_user_id = v_project_owner OR v_user_role IN ('creator', 'admin') OR public.is_owner()) THEN
      RAISE EXCEPTION 'Only the project creator or verified creators can reply';
    END IF;
  END IF;

  IF trim(p_content) = '' THEN
    RAISE EXCEPTION 'Comment content cannot be empty';
  END IF;

  INSERT INTO public.project_comments (
    project_id,
    user_id,
    parent_comment_id,
    content
  ) VALUES (
    p_project_id,
    v_user_id,
    p_parent_comment_id,
    trim(p_content)
  )
  RETURNING id INTO v_new_comment_id;

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
    SELECT user_id INTO v_parent_author
    FROM public.project_comments
    WHERE id = p_parent_comment_id;

    IF v_parent_author IS NOT NULL AND v_parent_author <> v_user_id THEN
      PERFORM public.create_notification(
        'New reply to your comment',
        v_commenter_name || ' replied to your comment on "' || v_project_title || '".',
        'private',
        v_parent_author
      );
    END IF;
  END IF;

  RETURN v_new_comment_id;
END;
$fn$;


-- 4. RPC: pin_project_comment
CREATE OR REPLACE FUNCTION public.pin_project_comment(
  p_comment_id UUID,
  p_pin BOOLEAN
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_proj_id UUID;
  v_proj_owner UUID;
  v_proj_title TEXT;
  v_comment_author UUID;
  v_pinner_name TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT project_id, user_id INTO v_proj_id, v_comment_author
  FROM public.project_comments
  WHERE id = p_comment_id;

  IF v_proj_id IS NULL THEN
    RAISE EXCEPTION 'Comment not found';
  END IF;

  SELECT created_by, title INTO v_proj_owner, v_proj_title
  FROM public.projects
  WHERE id = v_proj_id;

  -- Only project owner, admin, or owner can pin/unpin
  IF NOT (auth.uid() = v_proj_owner OR public.is_admin() OR public.is_owner()) THEN
    RAISE EXCEPTION 'Only the project creator can pin comments';
  END IF;

  IF p_pin THEN
    -- Unpin previous pinned comments for this project
    UPDATE public.project_comments
    SET is_pinned = false
    WHERE project_id = v_proj_id AND is_pinned = true;

    UPDATE public.project_comments
    SET is_pinned = true, updated_at = now()
    WHERE id = p_comment_id;

    -- Send notification to comment author if not self
    IF v_comment_author IS NOT NULL AND v_comment_author <> auth.uid() THEN
      SELECT COALESCE(full_name, 'Project Creator')
      INTO v_pinner_name
      FROM public.profiles
      WHERE id = auth.uid();

      PERFORM public.create_notification(
        'Your comment was pinned',
        v_pinner_name || ' pinned your comment on "' || v_proj_title || '".',
        'private',
        v_comment_author
      );
    END IF;
  ELSE
    UPDATE public.project_comments
    SET is_pinned = false, updated_at = now()
    WHERE id = p_comment_id;
  END IF;
END;
$fn$;


-- 5. RPC: soft_delete_project_comment
CREATE OR REPLACE FUNCTION public.soft_delete_project_comment(
  p_comment_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_proj_id UUID;
  v_proj_owner UUID;
  v_comment_author UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT project_id, user_id INTO v_proj_id, v_comment_author
  FROM public.project_comments
  WHERE id = p_comment_id;

  IF v_proj_id IS NULL THEN
    RAISE EXCEPTION 'Comment not found';
  END IF;

  SELECT created_by INTO v_proj_owner
  FROM public.projects
  WHERE id = v_proj_id;

  -- Comment author, project owner, admin, or owner can delete
  IF NOT (auth.uid() = v_comment_author OR auth.uid() = v_proj_owner OR public.is_admin() OR public.is_owner()) THEN
    RAISE EXCEPTION 'Permission denied to delete comment';
  END IF;

  UPDATE public.project_comments
  SET deleted_at = now(), is_pinned = false
  WHERE id = p_comment_id;
END;
$fn$;


-- 6. RPC permissions
GRANT EXECUTE ON FUNCTION public.create_project_comment(UUID, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pin_project_comment(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.soft_delete_project_comment(UUID) TO authenticated;

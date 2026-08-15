-- ============================================================================
-- ISOMER: Atomic toggle_project_like RPC
-- Fixes the "like immediately resets" bug by handling INSERT/DELETE and
-- returning authoritative liked + like_count in a single transaction.
-- ============================================================================

-- Drop any old version
DROP FUNCTION IF EXISTS public.toggle_project_like(UUID);

CREATE OR REPLACE FUNCTION public.toggle_project_like(p_project_id UUID)
RETURNS TABLE(liked BOOLEAN, like_count BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_existing_id UUID;
  v_liked BOOLEAN;
  v_count BIGINT;
BEGIN
  -- 1. Require authentication
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- 2. Check whether this user already liked this project
  SELECT id INTO v_existing_id
  FROM public.project_likes
  WHERE project_id = p_project_id
    AND user_id = v_user_id;

  IF v_existing_id IS NOT NULL THEN
    -- 3a. Already liked → DELETE (unlike)
    DELETE FROM public.project_likes
    WHERE id = v_existing_id;
    v_liked := FALSE;
  ELSE
    -- 3b. Not liked → INSERT (like)
    INSERT INTO public.project_likes (project_id, user_id)
    VALUES (p_project_id, v_user_id)
    ON CONFLICT (project_id, user_id) DO NOTHING;
    v_liked := TRUE;
  END IF;

  -- 4. Authoritative count (within the same transaction — no replication lag)
  SELECT COUNT(*) INTO v_count
  FROM public.project_likes
  WHERE project_id = p_project_id;

  -- 5. Return both values
  RETURN QUERY SELECT v_liked, v_count;
END;
$$;

-- Grant to authenticated only
REVOKE ALL ON FUNCTION public.toggle_project_like(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.toggle_project_like(UUID) TO authenticated;

-- Also ensure the UNIQUE constraint exists (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'project_likes'
      AND constraint_name = 'unique_project_user_like'
  ) THEN
    ALTER TABLE public.project_likes
      ADD CONSTRAINT unique_project_user_like UNIQUE (project_id, user_id);
  END IF;
END $$;

-- Reload PostgREST schema
NOTIFY pgrst, 'reload schema';

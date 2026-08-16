-- ============================================================================
-- ISOMER: FIX AMBIGUOUS COLUMN REFERENCE IN GET_PUBLIC_LEADERBOARD RPC
-- ============================================================================
-- Problem:
--   RETURNS TABLE (id UUID, ...) causes PL/pgSQL output parameter 'id'
--   to conflict with unaliased 'WHERE id = 1' on public.leaderboard_settings.
-- Solution:
--   1. Add '#variable_conflict use_column' directive
--   2. Fully qualify all columns with explicit table aliases (ls, s, le)
--   3. Maintain exact signature: public.get_public_leaderboard(p_period, p_type)
--   4. Preserve all visibility, security definer, COALESCE role checks & return columns
-- ============================================================================

-- 1. Drop existing functions to allow clean signature re-creation
DROP FUNCTION IF EXISTS public.get_public_leaderboard(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.get_public_leaderboard(TEXT);
DROP FUNCTION IF EXISTS public.get_public_leaderboard();

-- 2. Create RPC with exact signature: public.get_public_leaderboard(p_period, p_type)
CREATE OR REPLACE FUNCTION public.get_public_leaderboard(
  p_period TEXT DEFAULT 'all_time',
  p_type TEXT DEFAULT 'projects'
)
RETURNS TABLE (
  id UUID,
  snapshot_id UUID,
  entity_type TEXT,
  entity_id UUID,
  rank INTEGER,
  score NUMERIC,
  likes INTEGER,
  comments INTEGER,
  projects_count INTEGER,
  activity_score NUMERIC,
  metadata JSONB,
  is_overridden BOOLEAN,
  published_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_settings public.leaderboard_settings%ROWTYPE;
  v_snap_id UUID;
  v_published_at TIMESTAMPTZ;
  v_is_owner BOOLEAN;
  v_is_admin BOOLEAN;
  v_is_creator BOOLEAN;
BEGIN
  -- Safe role checks with COALESCE to prevent NULL comparisons
  v_is_owner := COALESCE(public.is_owner(), false);
  v_is_admin := COALESCE(public.is_admin(), false);
  v_is_creator := COALESCE(public.is_creator(), false);

  -- Fetch leaderboard settings with fully qualified table alias 'ls'
  SELECT ls.* INTO v_settings
  FROM public.leaderboard_settings ls
  WHERE ls.id = 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- If leaderboard is disabled globally, only owner & admins can view
  IF NOT v_settings.enabled AND NOT (v_is_owner OR v_is_admin) THEN
    RETURN;
  END IF;

  -- If specific leaderboard type is disabled in settings
  IF (p_type = 'projects' AND NOT v_settings.project_enabled AND NOT (v_is_owner OR v_is_admin)) OR
     (p_type = 'creators' AND NOT v_settings.creator_enabled AND NOT (v_is_owner OR v_is_admin)) THEN
    RETURN;
  END IF;

  -- Visibility access enforcement
  IF v_settings.visibility IN ('no_one', 'nobody') THEN
    IF NOT (v_is_owner OR v_is_admin) THEN
      RETURN;
    END IF;
  ELSIF v_settings.visibility IN ('admins_only', 'admins') THEN
    IF NOT (v_is_owner OR v_is_admin) THEN
      RETURN;
    END IF;
  ELSIF v_settings.visibility IN ('creators_only', 'creators') THEN
    IF NOT (v_is_creator OR v_is_admin OR v_is_owner) THEN
      RETURN;
    END IF;
  END IF;

  -- Retrieve latest published snapshot for the requested type and period with fully qualified table alias 's'
  SELECT s.id, s.published_at INTO v_snap_id, v_published_at
  FROM public.leaderboard_snapshots s
  WHERE s.leaderboard_type = p_type
    AND s.period = p_period
    AND s.status = 'published'
  ORDER BY s.published_at DESC
  LIMIT 1;

  -- Return entries from published snapshot in rank order with fully qualified table alias 'le'
  IF v_snap_id IS NOT NULL THEN
    RETURN QUERY
    SELECT
      le.id,
      le.snapshot_id,
      le.entity_type,
      le.entity_id,
      le.rank,
      le.score,
      le.likes,
      le.comments,
      le.projects_count,
      le.activity_score,
      le.metadata,
      le.is_overridden,
      v_published_at AS published_at
    FROM public.leaderboard_entries le
    WHERE le.snapshot_id = v_snap_id
    ORDER BY le.rank ASC;
  END IF;
END;
$$;

-- 3. Permissions
REVOKE ALL ON FUNCTION public.get_public_leaderboard(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_leaderboard(TEXT, TEXT) TO anon, authenticated;

-- 4. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

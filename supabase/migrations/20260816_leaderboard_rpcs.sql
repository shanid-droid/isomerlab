-- ============================================================================
-- ISOMER: LEADERBOARD RPCs
-- ============================================================================
-- Public reads, creator self-position, admin publishing, owner configuration
-- and view tracking. Every function re-derives the caller's role from
-- auth.uid(); no role information is ever taken from the client.
-- ============================================================================

-- ── Access descriptor used by the page and the navigation ───────────────────

CREATE OR REPLACE FUNCTION public.get_leaderboard_access()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $fn$
DECLARE
  s public.leaderboard_settings%ROWTYPE;
BEGIN
  SELECT * INTO s FROM public.leaderboard_settings WHERE id = 1;

  RETURN jsonb_build_object(
    'enabled',          COALESCE(s.enabled, false),
    'project_enabled',  COALESCE(s.project_enabled, false),
    'creator_enabled',  COALESCE(s.creator_enabled, false),
    'visibility',       COALESCE(s.visibility, 'none'),
    'can_view',         COALESCE(public.can_view_leaderboard(), false),
    'is_staff',         COALESCE(public.is_owner() OR public.is_admin(), false),
    'is_owner',         COALESCE(public.is_owner(), false),
    'periods',          jsonb_build_object(
      'all_time', COALESCE(s.all_time_enabled, false),
      'monthly',  COALESCE(s.monthly_enabled, false),
      'weekly',   COALESCE(s.weekly_enabled, false)
    )
  );
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.get_leaderboard_access() TO anon, authenticated;


-- ── Public read: published snapshot only ────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_published_leaderboard(
  p_type   TEXT,
  p_period TEXT DEFAULT 'all_time'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $fn$
DECLARE
  v_snapshot public.leaderboard_snapshots%ROWTYPE;
  v_entries  JSONB;
  s          public.leaderboard_settings%ROWTYPE;
BEGIN
  IF p_type NOT IN ('project', 'creator') THEN
    RAISE EXCEPTION 'Invalid leaderboard type: %', p_type;
  END IF;

  SELECT * INTO s FROM public.leaderboard_settings WHERE id = 1;

  IF NOT COALESCE(public.can_view_leaderboard(), false) THEN
    RETURN jsonb_build_object('status', 'forbidden', 'entries', '[]'::jsonb);
  END IF;

  IF (p_type = 'project' AND NOT COALESCE(s.project_enabled, false))
     OR (p_type = 'creator' AND NOT COALESCE(s.creator_enabled, false)) THEN
    RETURN jsonb_build_object('status', 'disabled', 'entries', '[]'::jsonb);
  END IF;

  SELECT * INTO v_snapshot
  FROM public.leaderboard_snapshots
  WHERE leaderboard_type = p_type AND period = p_period AND status = 'published'
  ORDER BY published_at DESC
  LIMIT 1;

  IF v_snapshot.id IS NULL THEN
    RETURN jsonb_build_object('status', 'unavailable', 'entries', '[]'::jsonb);
  END IF;

  SELECT COALESCE(jsonb_agg(e ORDER BY e.rank), '[]'::jsonb) INTO v_entries
  FROM (
    SELECT rank, entity_type, entity_id, score, likes, comments, views,
           projects, activity_score, metadata, is_manual_override
    FROM public.leaderboard_entries
    WHERE snapshot_id = v_snapshot.id
    ORDER BY rank
  ) e;

  RETURN jsonb_build_object(
    'status', 'published',
    'snapshot', jsonb_build_object(
      'id',           v_snapshot.id,
      'period',       v_snapshot.period,
      'type',         v_snapshot.leaderboard_type,
      'published_at', v_snapshot.published_at,
      'entry_count',  v_snapshot.entry_count
    ),
    'entries', v_entries
  );
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.get_published_leaderboard(TEXT, TEXT) TO anon, authenticated;


-- ── Current creator's position (published snapshot + movement) ──────────────

CREATE OR REPLACE FUNCTION public.get_my_leaderboard_position(p_period TEXT DEFAULT 'all_time')
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $fn$
DECLARE
  v_role      TEXT;
  v_current   RECORD;
  v_previous  INTEGER;
BEGIN
  IF auth.uid() IS NULL OR NOT COALESCE(public.can_view_leaderboard(), false) THEN
    RETURN NULL;
  END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role IS DISTINCT FROM 'creator' THEN
    RETURN NULL;
  END IF;

  SELECT e.rank, e.score, e.likes, e.projects, s.published_at
  INTO v_current
  FROM public.leaderboard_snapshots s
  JOIN public.leaderboard_entries e ON e.snapshot_id = s.id
  WHERE s.leaderboard_type = 'creator' AND s.period = p_period AND s.status = 'published'
    AND e.entity_type = 'creator' AND e.entity_id = auth.uid()
  ORDER BY s.published_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Movement against the previously published snapshot of the same period
  SELECT e.rank INTO v_previous
  FROM public.leaderboard_snapshots s
  JOIN public.leaderboard_entries e ON e.snapshot_id = s.id
  WHERE s.leaderboard_type = 'creator' AND s.period = p_period
    AND s.status = 'unpublished' AND s.published_at IS NOT NULL
    AND s.published_at < v_current.published_at
    AND e.entity_type = 'creator' AND e.entity_id = auth.uid()
  ORDER BY s.published_at DESC
  LIMIT 1;

  RETURN jsonb_build_object(
    'rank',          v_current.rank,
    'score',         v_current.score,
    'likes',         v_current.likes,
    'projects',      v_current.projects,
    'previous_rank', v_previous,
    'movement',      CASE WHEN v_previous IS NULL THEN NULL ELSE v_previous - v_current.rank END
  );
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.get_my_leaderboard_position(TEXT) TO authenticated;


-- ── Staff preview: live calculation, never public ───────────────────────────

CREATE OR REPLACE FUNCTION public.preview_leaderboard(
  p_type   TEXT,
  p_period TEXT DEFAULT 'all_time',
  p_limit  INTEGER DEFAULT 50
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $fn$
DECLARE
  v_rows JSONB;
BEGIN
  IF NOT COALESCE(public.is_owner() OR public.is_admin(), false) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF p_type NOT IN ('project', 'creator') THEN
    RAISE EXCEPTION 'Invalid leaderboard type: %', p_type;
  END IF;

  IF p_type = 'project' THEN
    SELECT COALESCE(jsonb_agg(x ORDER BY x.rank), '[]'::jsonb) INTO v_rows
    FROM (
      SELECT rank, project_id AS entity_id, 'project'::TEXT AS entity_type, score,
             likes, comments, views, 0 AS projects, 0::NUMERIC AS activity_score,
             is_manual_override, metadata
      FROM public.calculate_project_leaderboard(p_period)
      ORDER BY rank LIMIT GREATEST(p_limit, 1)
    ) x;
  ELSE
    SELECT COALESCE(jsonb_agg(x ORDER BY x.rank), '[]'::jsonb) INTO v_rows
    FROM (
      SELECT rank, creator_id AS entity_id, 'creator'::TEXT AS entity_type, score,
             likes, comments, 0 AS views, projects, activity_score,
             is_manual_override, metadata
      FROM public.calculate_creator_leaderboard(p_period)
      ORDER BY rank LIMIT GREATEST(p_limit, 1)
    ) x;
  END IF;

  RETURN jsonb_build_object('status', 'preview', 'entries', v_rows);
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.preview_leaderboard(TEXT, TEXT, INTEGER) TO authenticated;


-- ── Snapshot generation (owner + admins) ────────────────────────────────────

CREATE OR REPLACE FUNCTION public.generate_leaderboard_snapshot(
  p_type   TEXT,
  p_period TEXT DEFAULT 'all_time'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_snapshot_id UUID;
  v_count       INTEGER;
  s             public.leaderboard_settings%ROWTYPE;
BEGIN
  IF NOT COALESCE(public.is_owner() OR public.is_admin(), false) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF p_type NOT IN ('project', 'creator') THEN
    RAISE EXCEPTION 'Invalid leaderboard type: %', p_type;
  END IF;
  IF p_period NOT IN ('all_time', 'monthly', 'weekly') THEN
    RAISE EXCEPTION 'Invalid leaderboard period: %', p_period;
  END IF;

  SELECT * INTO s FROM public.leaderboard_settings WHERE id = 1;

  INSERT INTO public.leaderboard_snapshots (
    leaderboard_type, period, visibility, status, settings_used, created_by
  ) VALUES (
    p_type, p_period, s.visibility, 'draft', to_jsonb(s), auth.uid()
  )
  RETURNING id INTO v_snapshot_id;

  IF p_type = 'project' THEN
    INSERT INTO public.leaderboard_entries (
      snapshot_id, entity_type, entity_id, rank, score, likes, comments, views,
      projects, activity_score, metadata, is_manual_override
    )
    SELECT v_snapshot_id, 'project', c.project_id, c.rank, c.score, c.likes,
           c.comments, c.views, 0, 0, c.metadata, c.is_manual_override
    FROM public.calculate_project_leaderboard(p_period) c;
  ELSE
    INSERT INTO public.leaderboard_entries (
      snapshot_id, entity_type, entity_id, rank, score, likes, comments, views,
      projects, activity_score, metadata, is_manual_override
    )
    SELECT v_snapshot_id, 'creator', c.creator_id, c.rank, c.score, c.likes,
           c.comments, 0, c.projects, c.activity_score, c.metadata, c.is_manual_override
    FROM public.calculate_creator_leaderboard(p_period) c;
  END IF;

  SELECT COUNT(*)::INTEGER INTO v_count
  FROM public.leaderboard_entries WHERE snapshot_id = v_snapshot_id;

  UPDATE public.leaderboard_snapshots
  SET entry_count = v_count
  WHERE id = v_snapshot_id;

  PERFORM public.insert_activity_log(
    auth.uid(), 'leaderboard_snapshot_generated', 'leaderboard_snapshot',
    v_snapshot_id::TEXT,
    jsonb_build_object('type', p_type, 'period', p_period, 'entries', v_count)
  );

  RETURN v_snapshot_id;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.generate_leaderboard_snapshot(TEXT, TEXT) TO authenticated;


-- ── Publish / unpublish (owner + admins) ────────────────────────────────────

CREATE OR REPLACE FUNCTION public.publish_leaderboard_snapshot(p_snapshot_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_snapshot public.leaderboard_snapshots%ROWTYPE;
  v_visibility TEXT;
BEGIN
  IF NOT COALESCE(public.is_owner() OR public.is_admin(), false) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO v_snapshot FROM public.leaderboard_snapshots WHERE id = p_snapshot_id;
  IF v_snapshot.id IS NULL THEN
    RAISE EXCEPTION 'Snapshot not found';
  END IF;

  -- Visibility always comes from owner-controlled settings, never from the caller
  SELECT visibility INTO v_visibility FROM public.leaderboard_settings WHERE id = 1;

  UPDATE public.leaderboard_snapshots
  SET status = 'unpublished'
  WHERE leaderboard_type = v_snapshot.leaderboard_type
    AND period = v_snapshot.period
    AND status = 'published'
    AND id <> p_snapshot_id;

  UPDATE public.leaderboard_snapshots
  SET status = 'published', published_at = now(), published_by = auth.uid(),
      visibility = v_visibility
  WHERE id = p_snapshot_id;

  PERFORM public.insert_activity_log(
    auth.uid(), 'leaderboard_published', 'leaderboard_snapshot', p_snapshot_id::TEXT,
    jsonb_build_object('type', v_snapshot.leaderboard_type, 'period', v_snapshot.period)
  );
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.publish_leaderboard_snapshot(UUID) TO authenticated;


CREATE OR REPLACE FUNCTION public.unpublish_leaderboard(p_type TEXT, p_period TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NOT COALESCE(public.is_owner() OR public.is_admin(), false) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.leaderboard_snapshots
  SET status = 'unpublished'
  WHERE leaderboard_type = p_type AND period = p_period AND status = 'published';

  PERFORM public.insert_activity_log(
    auth.uid(), 'leaderboard_unpublished', 'leaderboard', p_type,
    jsonb_build_object('type', p_type, 'period', p_period)
  );
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.unpublish_leaderboard(TEXT, TEXT) TO authenticated;


-- Generate + publish in one step ("refresh rankings")
CREATE OR REPLACE FUNCTION public.refresh_leaderboard(p_type TEXT, p_period TEXT DEFAULT 'all_time')
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_id UUID;
BEGIN
  v_id := public.generate_leaderboard_snapshot(p_type, p_period);
  PERFORM public.publish_leaderboard_snapshot(v_id);
  RETURN v_id;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.refresh_leaderboard(TEXT, TEXT) TO authenticated;


-- ── Publication history (owner + admins) ────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_leaderboard_history(p_limit INTEGER DEFAULT 20)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $fn$
DECLARE
  v_rows JSONB;
BEGIN
  IF NOT COALESCE(public.is_owner() OR public.is_admin(), false) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT COALESCE(jsonb_agg(x ORDER BY x.created_at DESC), '[]'::jsonb) INTO v_rows
  FROM (
    SELECT s.id, s.leaderboard_type, s.period, s.status, s.entry_count,
           s.created_at, s.published_at,
           cp.full_name AS created_by_name,
           pp.full_name AS published_by_name
    FROM public.leaderboard_snapshots s
    LEFT JOIN public.profiles cp ON cp.id = s.created_by
    LEFT JOIN public.profiles pp ON pp.id = s.published_by
    ORDER BY s.created_at DESC
    LIMIT GREATEST(p_limit, 1)
  ) x;

  RETURN v_rows;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.get_leaderboard_history(INTEGER) TO authenticated;


-- ── Owner-only configuration ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_leaderboard_settings(p_settings JSONB)
RETURNS public.leaderboard_settings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_row public.leaderboard_settings%ROWTYPE;
BEGIN
  -- Admins are deliberately excluded: scoring rules are owner-only
  IF NOT COALESCE(public.is_owner(), false) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.leaderboard_settings SET
    enabled                         = COALESCE((p_settings->>'enabled')::BOOLEAN, enabled),
    project_enabled                 = COALESCE((p_settings->>'project_enabled')::BOOLEAN, project_enabled),
    creator_enabled                 = COALESCE((p_settings->>'creator_enabled')::BOOLEAN, creator_enabled),
    visibility                      = COALESCE(p_settings->>'visibility', visibility),
    project_like_weight             = COALESCE((p_settings->>'project_like_weight')::NUMERIC, project_like_weight),
    project_comment_weight          = COALESCE((p_settings->>'project_comment_weight')::NUMERIC, project_comment_weight),
    project_view_weight             = COALESCE((p_settings->>'project_view_weight')::NUMERIC, project_view_weight),
    github_bonus                    = COALESCE((p_settings->>'github_bonus')::NUMERIC, github_bonus),
    gallery_bonus                   = COALESCE((p_settings->>'gallery_bonus')::NUMERIC, gallery_bonus),
    description_bonus               = COALESCE((p_settings->>'description_bonus')::NUMERIC, description_bonus),
    tags_bonus                      = COALESCE((p_settings->>'tags_bonus')::NUMERIC, tags_bonus),
    recency_half_life_days          = COALESCE((p_settings->>'recency_half_life_days')::NUMERIC, recency_half_life_days),
    recency_floor                   = COALESCE((p_settings->>'recency_floor')::NUMERIC, recency_floor),
    creator_project_weight          = COALESCE((p_settings->>'creator_project_weight')::NUMERIC, creator_project_weight),
    creator_like_weight             = COALESCE((p_settings->>'creator_like_weight')::NUMERIC, creator_like_weight),
    creator_comment_weight          = COALESCE((p_settings->>'creator_comment_weight')::NUMERIC, creator_comment_weight),
    creator_activity_weight         = COALESCE((p_settings->>'creator_activity_weight')::NUMERIC, creator_activity_weight),
    creator_top10_bonus             = COALESCE((p_settings->>'creator_top10_bonus')::NUMERIC, creator_top10_bonus),
    creator_top3_bonus              = COALESCE((p_settings->>'creator_top3_bonus')::NUMERIC, creator_top3_bonus),
    creator_comment_activity_points = COALESCE((p_settings->>'creator_comment_activity_points')::NUMERIC, creator_comment_activity_points),
    creator_like_activity_points    = COALESCE((p_settings->>'creator_like_activity_points')::NUMERIC, creator_like_activity_points),
    max_scored_comments_per_project = COALESCE((p_settings->>'max_scored_comments_per_project')::INTEGER, max_scored_comments_per_project),
    min_projects_for_creator        = COALESCE((p_settings->>'min_projects_for_creator')::INTEGER, min_projects_for_creator),
    min_score_to_rank               = COALESCE((p_settings->>'min_score_to_rank')::NUMERIC, min_score_to_rank),
    all_time_enabled                = COALESCE((p_settings->>'all_time_enabled')::BOOLEAN, all_time_enabled),
    monthly_enabled                 = COALESCE((p_settings->>'monthly_enabled')::BOOLEAN, monthly_enabled),
    weekly_enabled                  = COALESCE((p_settings->>'weekly_enabled')::BOOLEAN, weekly_enabled),
    updated_at                      = now(),
    updated_by                      = auth.uid()
  WHERE id = 1
  RETURNING * INTO v_row;

  PERFORM public.insert_activity_log(
    auth.uid(), 'leaderboard_settings_updated', 'leaderboard_settings', '1', p_settings
  );

  RETURN v_row;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.update_leaderboard_settings(JSONB) TO authenticated;


CREATE OR REPLACE FUNCTION public.set_leaderboard_override(
  p_entity_type    TEXT,
  p_entity_id      UUID,
  p_score_override NUMERIC DEFAULT NULL,
  p_rank_override  INTEGER DEFAULT NULL,
  p_featured       BOOLEAN DEFAULT false,
  p_reason         TEXT    DEFAULT NULL
)
RETURNS public.leaderboard_overrides
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_row public.leaderboard_overrides%ROWTYPE;
BEGIN
  IF NOT COALESCE(public.is_owner(), false) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF p_entity_type NOT IN ('project', 'creator') THEN
    RAISE EXCEPTION 'Invalid entity type: %', p_entity_type;
  END IF;

  INSERT INTO public.leaderboard_overrides (
    entity_type, entity_id, score_override, rank_override, featured, reason, created_by
  ) VALUES (
    p_entity_type, p_entity_id, p_score_override, p_rank_override, p_featured, p_reason, auth.uid()
  )
  ON CONFLICT (entity_type, entity_id) DO UPDATE SET
    score_override = EXCLUDED.score_override,
    rank_override  = EXCLUDED.rank_override,
    featured       = EXCLUDED.featured,
    reason         = EXCLUDED.reason,
    updated_at     = now()
  RETURNING * INTO v_row;

  PERFORM public.insert_activity_log(
    auth.uid(), 'leaderboard_score_override', p_entity_type, p_entity_id::TEXT,
    jsonb_build_object('score_override', p_score_override, 'rank_override', p_rank_override,
                       'featured', p_featured, 'reason', p_reason)
  );

  RETURN v_row;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.set_leaderboard_override(TEXT, UUID, NUMERIC, INTEGER, BOOLEAN, TEXT) TO authenticated;


CREATE OR REPLACE FUNCTION public.clear_leaderboard_override(p_entity_type TEXT, p_entity_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NOT COALESCE(public.is_owner(), false) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  DELETE FROM public.leaderboard_overrides
  WHERE entity_type = p_entity_type AND entity_id = p_entity_id;

  PERFORM public.insert_activity_log(
    auth.uid(), 'leaderboard_score_override', p_entity_type, p_entity_id::TEXT,
    jsonb_build_object('cleared', true)
  );
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.clear_leaderboard_override(TEXT, UUID) TO authenticated;


CREATE OR REPLACE FUNCTION public.list_leaderboard_overrides()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $fn$
DECLARE
  v_rows JSONB;
BEGIN
  IF NOT COALESCE(public.is_owner(), false) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(o) ORDER BY o.updated_at DESC), '[]'::jsonb) INTO v_rows
  FROM public.leaderboard_overrides o;

  RETURN v_rows;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.list_leaderboard_overrides() TO authenticated;


-- ── View tracking: one counted view per viewer per project per day ──────────

CREATE OR REPLACE FUNCTION public.record_project_view(p_project_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_hash    TEXT;
  v_ip      TEXT;
  v_creator UUID;
BEGIN
  SELECT created_by INTO v_creator
  FROM public.projects
  WHERE id = p_project_id AND published = true;

  -- Unknown or unpublished project: nothing to record
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Viewers never supply their own identity
  IF auth.uid() IS NOT NULL THEN
    -- Self-views never count
    IF auth.uid() = v_creator THEN
      RETURN;
    END IF;
    v_hash := 'u:' || md5(auth.uid()::TEXT);
  ELSE
    BEGIN
      v_ip := COALESCE(
        split_part(current_setting('request.headers', true)::json->>'x-forwarded-for', ',', 1),
        ''
      );
    EXCEPTION WHEN OTHERS THEN
      v_ip := '';
    END;
    IF v_ip = '' THEN
      RETURN;   -- no reliable identity → do not inflate counts
    END IF;
    v_hash := 'a:' || md5(v_ip);
  END IF;

  INSERT INTO public.project_views (project_id, viewer_hash, viewed_on)
  VALUES (p_project_id, v_hash, CURRENT_DATE)
  ON CONFLICT (project_id, viewer_hash, viewed_on) DO NOTHING;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.record_project_view(UUID) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

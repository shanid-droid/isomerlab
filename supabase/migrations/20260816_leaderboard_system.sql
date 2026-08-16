-- ============================================================================
-- ISOMER: PRODUCTION LEADERBOARD SYSTEM MIGRATION
-- ============================================================================
-- Features:
--   1. Project views tracking (views_count column + record_project_view RPC)
--   2. leaderboard_settings table (Owner-controlled scoring weights & visibility)
--   3. leaderboard_snapshots & leaderboard_entries tables
--   4. Deterministic scoring engine for Projects & Creators (anti-gaming, tie-breakers)
--   5. Security Definer RPCs for Live calculation, Snapshots, Publishing, & Visibility
--   6. Full RLS & Activity Log integration
-- ============================================================================

-- ── 1. PROJECT VIEWS TRACKING ───────────────────────────────────────────────

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS views_count INTEGER NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.record_project_view(p_project_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.projects
  SET views_count = views_count + 1
  WHERE id = p_project_id AND published = true;
END;
$$;

REVOKE ALL ON FUNCTION public.record_project_view(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_project_view(UUID) TO anon, authenticated;


-- ── 2. LEADERBOARD SETTINGS TABLE ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.leaderboard_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled BOOLEAN NOT NULL DEFAULT true,
  project_enabled BOOLEAN NOT NULL DEFAULT true,
  creator_enabled BOOLEAN NOT NULL DEFAULT true,
  visibility TEXT NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('public', 'creators_only', 'admins_only', 'no_one')),
  
  -- Project Scoring Weights
  project_like_weight NUMERIC NOT NULL DEFAULT 1.0,
  project_comment_weight NUMERIC NOT NULL DEFAULT 3.0,
  project_view_weight NUMERIC NOT NULL DEFAULT 0.1,
  github_bonus NUMERIC NOT NULL DEFAULT 5.0,
  gallery_bonus NUMERIC NOT NULL DEFAULT 3.0,
  recency_decay_days NUMERIC NOT NULL DEFAULT 90.0,
  
  -- Creator Scoring Weights
  creator_project_weight NUMERIC NOT NULL DEFAULT 10.0,
  creator_like_weight NUMERIC NOT NULL DEFAULT 1.0,
  creator_comment_weight NUMERIC NOT NULL DEFAULT 3.0,
  creator_activity_weight NUMERIC NOT NULL DEFAULT 2.0,
  creator_top3_bonus NUMERIC NOT NULL DEFAULT 50.0,
  creator_top10_bonus NUMERIC NOT NULL DEFAULT 25.0,
  
  -- Periods Enabled
  weekly_enabled BOOLEAN NOT NULL DEFAULT true,
  monthly_enabled BOOLEAN NOT NULL DEFAULT true,
  all_time_enabled BOOLEAN NOT NULL DEFAULT true,
  
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Seed single row if not present
INSERT INTO public.leaderboard_settings (
  id, enabled, project_enabled, creator_enabled, visibility,
  project_like_weight, project_comment_weight, project_view_weight, github_bonus, gallery_bonus, recency_decay_days,
  creator_project_weight, creator_like_weight, creator_comment_weight, creator_activity_weight, creator_top3_bonus, creator_top10_bonus,
  weekly_enabled, monthly_enabled, all_time_enabled
) VALUES (
  1, true, true, true, 'public',
  1.0, 3.0, 0.1, 5.0, 3.0, 90.0,
  10.0, 1.0, 3.0, 2.0, 50.0, 25.0,
  true, true, true
) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.leaderboard_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read leaderboard settings" ON public.leaderboard_settings;
CREATE POLICY "Public read leaderboard settings"
  ON public.leaderboard_settings FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Owner update leaderboard settings" ON public.leaderboard_settings;
CREATE POLICY "Owner update leaderboard settings"
  ON public.leaderboard_settings FOR UPDATE
  USING (public.is_owner())
  WITH CHECK (public.is_owner());


-- ── 3. LEADERBOARD SNAPSHOTS & ENTRIES TABLES ────────────────────────────────

CREATE TABLE IF NOT EXISTS public.leaderboard_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leaderboard_type TEXT NOT NULL CHECK (leaderboard_type IN ('projects', 'creators')),
  period TEXT NOT NULL CHECK (period IN ('all_time', 'monthly', 'weekly')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'creators_only', 'admins_only', 'no_one')),
  published_at TIMESTAMPTZ,
  published_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leaderboard_snapshots_lookup
  ON public.leaderboard_snapshots (leaderboard_type, period, status, published_at DESC);

ALTER TABLE public.leaderboard_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone read published snapshots" ON public.leaderboard_snapshots;
CREATE POLICY "Anyone read published snapshots"
  ON public.leaderboard_snapshots FOR SELECT
  USING (
    status = 'published'
    OR public.is_owner()
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "Owner and admin manage snapshots" ON public.leaderboard_snapshots;
CREATE POLICY "Owner and admin manage snapshots"
  ON public.leaderboard_snapshots FOR ALL
  USING (public.is_owner() OR public.is_admin())
  WITH CHECK (public.is_owner() OR public.is_admin());


CREATE TABLE IF NOT EXISTS public.leaderboard_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id UUID NOT NULL REFERENCES public.leaderboard_snapshots(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('project', 'creator')),
  entity_id UUID NOT NULL,
  rank INTEGER NOT NULL,
  score NUMERIC NOT NULL,
  likes INTEGER NOT NULL DEFAULT 0,
  comments INTEGER NOT NULL DEFAULT 0,
  projects_count INTEGER NOT NULL DEFAULT 0,
  activity_score NUMERIC NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_overridden BOOLEAN NOT NULL DEFAULT false,
  override_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leaderboard_entries_snapshot
  ON public.leaderboard_entries (snapshot_id, rank ASC);

CREATE INDEX IF NOT EXISTS idx_leaderboard_entries_entity
  ON public.leaderboard_entries (entity_type, entity_id);

ALTER TABLE public.leaderboard_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone read entries of viewable snapshots" ON public.leaderboard_entries;
CREATE POLICY "Anyone read entries of viewable snapshots"
  ON public.leaderboard_entries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.leaderboard_snapshots s
      WHERE s.id = leaderboard_entries.snapshot_id
        AND (s.status = 'published' OR public.is_owner() OR public.is_admin())
    )
  );

DROP POLICY IF EXISTS "Owner and admin manage entries" ON public.leaderboard_entries;
CREATE POLICY "Owner and admin manage entries"
  ON public.leaderboard_entries FOR ALL
  USING (public.is_owner() OR public.is_admin())
  WITH CHECK (public.is_owner() OR public.is_admin());


-- ── 4. DETERMINISTIC SCORING ENGINE FUNCTIONS ────────────────────────────────

-- 4a. Project Leaderboard Calculation Function
CREATE OR REPLACE FUNCTION public.calculate_project_leaderboard(p_period TEXT DEFAULT 'all_time')
RETURNS TABLE (
  rank INTEGER,
  project_id UUID,
  title TEXT,
  slug TEXT,
  thumbnail_url TEXT,
  created_by UUID,
  creator_name TEXT,
  creator_avatar TEXT,
  score NUMERIC,
  likes_count BIGINT,
  comments_count BIGINT,
  views_count INTEGER,
  github_bonus_applied BOOLEAN,
  gallery_bonus_applied BOOLEAN,
  created_at TIMESTAMPTZ,
  is_overridden BOOLEAN,
  override_notes TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings public.leaderboard_settings%ROWTYPE;
  v_cutoff TIMESTAMPTZ;
BEGIN
  SELECT * INTO v_settings FROM public.leaderboard_settings WHERE id = 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Leaderboard settings not found';
  END IF;

  IF p_period = 'weekly' THEN
    v_cutoff := now() - INTERVAL '7 days';
  ELSIF p_period = 'monthly' THEN
    v_cutoff := now() - INTERVAL '30 days';
  ELSE
    v_cutoff := '1970-01-01'::timestamptz;
  END IF;

  RETURN QUERY
  WITH project_stats AS (
    SELECT
      p.id AS p_id,
      p.title AS p_title,
      p.slug AS p_slug,
      p.thumbnail_url AS p_thumb,
      p.created_by AS p_creator,
      p.created_at AS p_created,
      p.github_url AS p_github,
      COALESCE(p.views_count, 0) AS p_views,
      
      -- Filter likes by period if specified
      COALESCE((
        SELECT COUNT(*)
        FROM public.project_likes pl
        WHERE pl.project_id = p.id
          AND pl.created_at >= v_cutoff
      ), 0) AS p_likes,

      -- Non-deleted comments from legitimate users in period
      COALESCE((
        SELECT COUNT(*)
        FROM public.project_comments pc
        WHERE pc.project_id = p.id
          AND pc.deleted_at IS NULL
          AND pc.created_at >= v_cutoff
      ), 0) AS p_comments,

      -- Check if project has gallery images
      EXISTS (
        SELECT 1 FROM public.project_gallery pg WHERE pg.project_id = p.id
      ) AS p_has_gallery
    FROM public.projects p
    WHERE p.published = true
  ),
  scored_projects AS (
    SELECT
      ps.p_id,
      ps.p_title,
      ps.p_slug,
      ps.p_thumb,
      ps.p_creator,
      COALESCE(prof.full_name, SPLIT_PART(prof.email, '@', 1), 'ISOMER Creator') AS c_name,
      prof.avatar_url AS c_avatar,
      ps.p_likes,
      ps.p_comments,
      ps.p_views,
      (ps.p_github IS NOT NULL AND trim(ps.p_github) <> '') AS has_gh,
      ps.p_has_gallery,
      ps.p_created,

      -- Scoring Formula:
      ROUND(
        (ps.p_likes * v_settings.project_like_weight) +
        (ps.p_comments * v_settings.project_comment_weight) +
        (ps.p_views * v_settings.project_view_weight) +
        (CASE WHEN ps.p_github IS NOT NULL AND trim(ps.p_github) <> '' THEN v_settings.github_bonus ELSE 0.0 END) +
        (CASE WHEN ps.p_has_gallery THEN v_settings.gallery_bonus ELSE 0.0 END) +
        -- Recency factor: gentle decay curve for older projects
        GREATEST(0.0, ROUND(10.0 * EXP(-EXTRACT(EPOCH FROM (now() - ps.p_created)) / (v_settings.recency_decay_days * 86400)), 2))
      , 1) AS raw_score
    FROM project_stats ps
    LEFT JOIN public.profiles prof ON prof.id = ps.p_creator
  )
  SELECT
    ROW_NUMBER() OVER (
      ORDER BY
        sp.raw_score DESC,
        sp.p_likes DESC,
        sp.p_comments DESC,
        sp.p_created ASC,
        sp.p_id ASC
    )::INTEGER AS rank,
    sp.p_id AS project_id,
    sp.p_title AS title,
    sp.p_slug AS slug,
    sp.p_thumb AS thumbnail_url,
    sp.p_creator AS created_by,
    sp.c_name AS creator_name,
    sp.c_avatar AS creator_avatar,
    sp.raw_score AS score,
    sp.p_likes AS likes_count,
    sp.p_comments AS comments_count,
    sp.p_views AS views_count,
    sp.has_gh AS github_bonus_applied,
    sp.p_has_gallery AS gallery_bonus_applied,
    sp.p_created AS created_at,
    false AS is_overridden,
    NULL::TEXT AS override_notes
  FROM scored_projects sp;
END;
$$;


-- 4b. Creator Leaderboard Calculation Function
CREATE OR REPLACE FUNCTION public.calculate_creator_leaderboard(p_period TEXT DEFAULT 'all_time')
RETURNS TABLE (
  rank INTEGER,
  creator_id UUID,
  creator_name TEXT,
  creator_avatar TEXT,
  creator_bio TEXT,
  score NUMERIC,
  projects_count BIGINT,
  total_likes_received BIGINT,
  total_comments_received BIGINT,
  top_project_id UUID,
  top_project_title TEXT,
  top_project_slug TEXT,
  activity_score NUMERIC,
  created_at TIMESTAMPTZ,
  is_overridden BOOLEAN,
  override_notes TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings public.leaderboard_settings%ROWTYPE;
  v_cutoff TIMESTAMPTZ;
BEGIN
  SELECT * INTO v_settings FROM public.leaderboard_settings WHERE id = 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Leaderboard settings not found';
  END IF;

  IF p_period = 'weekly' THEN
    v_cutoff := now() - INTERVAL '7 days';
  ELSIF p_period = 'monthly' THEN
    v_cutoff := now() - INTERVAL '30 days';
  ELSE
    v_cutoff := '1970-01-01'::timestamptz;
  END IF;

  RETURN QUERY
  WITH creator_list AS (
    -- Approved creators (and owner/admins if they have created published projects)
    SELECT
      prof.id AS u_id,
      COALESCE(prof.full_name, SPLIT_PART(prof.email, '@', 1), 'Creator') AS u_name,
      prof.avatar_url AS u_avatar,
      prof.bio AS u_bio,
      prof.created_at AS u_created
    FROM public.profiles prof
    WHERE prof.role = 'creator'
       OR prof.id = '9d5d6287-1843-4cd0-afee-fc1830411571'::uuid
  ),
  creator_projects AS (
    SELECT
      cl.u_id,
      p.id AS p_id,
      p.title AS p_title,
      p.slug AS p_slug,
      p.created_at AS p_created,
      COALESCE((
        SELECT COUNT(*) FROM public.project_likes pl
        WHERE pl.project_id = p.id AND pl.created_at >= v_cutoff
      ), 0) AS p_likes,
      COALESCE((
        SELECT COUNT(*) FROM public.project_comments pc
        WHERE pc.project_id = p.id AND pc.deleted_at IS NULL AND pc.created_at >= v_cutoff
      ), 0) AS p_comments
    FROM creator_list cl
    LEFT JOIN public.projects p ON p.created_by = cl.u_id AND p.published = true
  ),
  creator_project_aggregates AS (
    SELECT
      cp.u_id,
      COUNT(cp.p_id) FILTER (WHERE cp.p_id IS NOT NULL) AS num_projects,
      COALESCE(SUM(cp.p_likes), 0) AS total_likes,
      COALESCE(SUM(cp.p_comments), 0) AS total_comments,
      -- Best performing project
      (ARRAY_AGG(cp.p_id ORDER BY (cp.p_likes * 2 + cp.p_comments * 3) DESC, cp.p_created DESC) FILTER (WHERE cp.p_id IS NOT NULL))[1] AS top_pid,
      (ARRAY_AGG(cp.p_title ORDER BY (cp.p_likes * 2 + cp.p_comments * 3) DESC, cp.p_created DESC) FILTER (WHERE cp.p_id IS NOT NULL))[1] AS top_ptitle,
      (ARRAY_AGG(cp.p_slug ORDER BY (cp.p_likes * 2 + cp.p_comments * 3) DESC, cp.p_created DESC) FILTER (WHERE cp.p_id IS NOT NULL))[1] AS top_pslug
    FROM creator_projects cp
    GROUP BY cp.u_id
  ),
  creator_activity AS (
    -- Outgoing interactions on OTHER creators' projects (Anti-gaming: strictly exclude self-interactions)
    SELECT
      cl.u_id,
      -- Likes given to other projects
      COALESCE((
        SELECT COUNT(DISTINCT pl.project_id)
        FROM public.project_likes pl
        JOIN public.projects p ON p.id = pl.project_id
        WHERE pl.user_id = cl.u_id
          AND p.created_by <> cl.u_id
          AND p.published = true
          AND pl.created_at >= v_cutoff
      ), 0) AS likes_given,

      -- Non-deleted comments posted on other projects (capped to distinct projects to avoid spamming)
      COALESCE((
        SELECT COUNT(DISTINCT pc.project_id)
        FROM public.project_comments pc
        JOIN public.projects p ON p.id = pc.project_id
        WHERE pc.user_id = cl.u_id
          AND p.created_by <> cl.u_id
          AND p.published = true
          AND pc.deleted_at IS NULL
          AND pc.created_at >= v_cutoff
      ), 0) AS comments_given
    FROM creator_list cl
  ),
  creator_top_project_bonuses AS (
    -- Check if creator has top 3 or top 10 projects in the project leaderboard
    SELECT
      cpa.u_id,
      CASE
        WHEN EXISTS (
          SELECT 1 FROM public.calculate_project_leaderboard(p_period) cpl
          WHERE cpl.created_by = cpa.u_id AND cpl.rank <= 3
        ) THEN v_settings.creator_top3_bonus
        WHEN EXISTS (
          SELECT 1 FROM public.calculate_project_leaderboard(p_period) cpl
          WHERE cpl.created_by = cpa.u_id AND cpl.rank <= 10
        ) THEN v_settings.creator_top10_bonus
        ELSE 0.0
      END AS proj_rank_bonus
    FROM creator_project_aggregates cpa
  ),
  scored_creators AS (
    SELECT
      cl.u_id,
      cl.u_name,
      cl.u_avatar,
      cl.u_bio,
      cl.u_created,
      cpa.num_projects,
      cpa.total_likes,
      cpa.total_comments,
      cpa.top_pid,
      cpa.top_ptitle,
      cpa.top_pslug,
      ROUND(
        (ca.likes_given * (v_settings.creator_activity_weight * 0.5)) +
        (ca.comments_given * v_settings.creator_activity_weight)
      , 1) AS act_score,
      ROUND(
        (cpa.num_projects * v_settings.creator_project_weight) +
        (cpa.total_likes * v_settings.creator_like_weight) +
        (cpa.total_comments * v_settings.creator_comment_weight) +
        (ca.likes_given * (v_settings.creator_activity_weight * 0.5)) +
        (ca.comments_given * v_settings.creator_activity_weight) +
        ctb.proj_rank_bonus
      , 1) AS final_score
    FROM creator_list cl
    JOIN creator_project_aggregates cpa ON cpa.u_id = cl.u_id
    JOIN creator_activity ca ON ca.u_id = cl.u_id
    JOIN creator_top_project_bonuses ctb ON ctb.u_id = cl.u_id
  )
  SELECT
    ROW_NUMBER() OVER (
      ORDER BY
        sc.final_score DESC,
        sc.total_likes DESC,
        sc.total_comments DESC,
        sc.num_projects DESC,
        sc.u_created ASC,
        sc.u_id ASC
    )::INTEGER AS rank,
    sc.u_id AS creator_id,
    sc.u_name AS creator_name,
    sc.u_avatar AS creator_avatar,
    sc.u_bio AS creator_bio,
    sc.final_score AS score,
    sc.num_projects AS projects_count,
    sc.total_likes AS total_likes_received,
    sc.total_comments AS total_comments_received,
    sc.top_pid AS top_project_id,
    sc.top_ptitle AS top_project_title,
    sc.top_pslug AS top_project_slug,
    sc.act_score AS activity_score,
    sc.u_created AS created_at,
    false AS is_overridden,
    NULL::TEXT AS override_notes
  FROM scored_creators sc;
END;
$$;


-- ── 5. SNAPSHOT GENERATION & PUBLISHING RPCS ────────────────────────────────

-- 5a. Generate Snapshot
CREATE OR REPLACE FUNCTION public.generate_leaderboard_snapshot(
  p_type TEXT,
  p_period TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_snapshot_id UUID;
  v_settings public.leaderboard_settings%ROWTYPE;
BEGIN
  IF NOT (public.is_owner() OR public.is_admin()) THEN
    RAISE EXCEPTION 'Access denied: only owner or admins can generate snapshots';
  END IF;

  IF p_type NOT IN ('projects', 'creators') THEN
    RAISE EXCEPTION 'Invalid leaderboard type';
  END IF;

  IF p_period NOT IN ('all_time', 'monthly', 'weekly') THEN
    RAISE EXCEPTION 'Invalid period';
  END IF;

  SELECT * INTO v_settings FROM public.leaderboard_settings WHERE id = 1;

  INSERT INTO public.leaderboard_snapshots (
    leaderboard_type,
    period,
    status,
    visibility,
    published_by
  ) VALUES (
    p_type,
    p_period,
    'draft',
    v_settings.visibility,
    auth.uid()
  )
  RETURNING id INTO v_snapshot_id;

  IF p_type = 'projects' THEN
    INSERT INTO public.leaderboard_entries (
      snapshot_id, entity_type, entity_id, rank, score, likes, comments, projects_count, activity_score, metadata
    )
    SELECT
      v_snapshot_id,
      'project',
      cpl.project_id,
      cpl.rank,
      cpl.score,
      cpl.likes_count::INTEGER,
      cpl.comments_count::INTEGER,
      1,
      0.0,
      jsonb_build_object(
        'title', cpl.title,
        'slug', cpl.slug,
        'thumbnail_url', cpl.thumbnail_url,
        'created_by', cpl.created_by,
        'creator_name', cpl.creator_name,
        'creator_avatar', cpl.creator_avatar,
        'views_count', cpl.views_count,
        'github_bonus', cpl.github_bonus_applied,
        'gallery_bonus', cpl.gallery_bonus_applied
      )
    FROM public.calculate_project_leaderboard(p_period) cpl;
  ELSE
    INSERT INTO public.leaderboard_entries (
      snapshot_id, entity_type, entity_id, rank, score, likes, comments, projects_count, activity_score, metadata
    )
    SELECT
      v_snapshot_id,
      'creator',
      ccl.creator_id,
      ccl.rank,
      ccl.score,
      ccl.total_likes_received::INTEGER,
      ccl.total_comments_received::INTEGER,
      ccl.projects_count::INTEGER,
      ccl.activity_score,
      jsonb_build_object(
        'creator_name', ccl.creator_name,
        'creator_avatar', ccl.creator_avatar,
        'creator_bio', ccl.creator_bio,
        'top_project_id', ccl.top_project_id,
        'top_project_title', ccl.top_project_title,
        'top_project_slug', ccl.top_project_slug
      )
    FROM public.calculate_creator_leaderboard(p_period) ccl;
  END IF;

  PERFORM public.insert_activity_log(
    auth.uid(),
    'leaderboard_snapshot_generated',
    'leaderboard_snapshot',
    v_snapshot_id::text,
    jsonb_build_object('type', p_type, 'period', p_period)
  );

  RETURN v_snapshot_id;
END;
$$;


-- 5b. Publish Snapshot
CREATE OR REPLACE FUNCTION public.publish_leaderboard_snapshot(p_snapshot_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_snap public.leaderboard_snapshots%ROWTYPE;
BEGIN
  IF NOT (public.is_owner() OR public.is_admin()) THEN
    RAISE EXCEPTION 'Access denied: only owner or admins can publish snapshots';
  END IF;

  SELECT * INTO v_snap FROM public.leaderboard_snapshots WHERE id = p_snapshot_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Snapshot not found';
  END IF;

  -- Archive currently published snapshots of same type and period
  UPDATE public.leaderboard_snapshots
  SET status = 'archived'
  WHERE leaderboard_type = v_snap.leaderboard_type
    AND period = v_snap.period
    AND status = 'published'
    AND id <> p_snapshot_id;

  -- Set target snapshot to published
  UPDATE public.leaderboard_snapshots
  SET
    status = 'published',
    published_at = now(),
    published_by = auth.uid()
  WHERE id = p_snapshot_id;

  PERFORM public.insert_activity_log(
    auth.uid(),
    'leaderboard_published',
    'leaderboard_snapshot',
    p_snapshot_id::text,
    jsonb_build_object('type', v_snap.leaderboard_type, 'period', v_snap.period)
  );
END;
$$;


-- 5c. Unpublish Snapshot
CREATE OR REPLACE FUNCTION public.unpublish_leaderboard_snapshot(p_snapshot_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_snap public.leaderboard_snapshots%ROWTYPE;
BEGIN
  IF NOT (public.is_owner() OR public.is_admin()) THEN
    RAISE EXCEPTION 'Access denied: only owner or admins can unpublish snapshots';
  END IF;

  SELECT * INTO v_snap FROM public.leaderboard_snapshots WHERE id = p_snapshot_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Snapshot not found';
  END IF;

  UPDATE public.leaderboard_snapshots
  SET status = 'draft', published_at = NULL
  WHERE id = p_snapshot_id;

  PERFORM public.insert_activity_log(
    auth.uid(),
    'leaderboard_unpublished',
    'leaderboard_snapshot',
    p_snapshot_id::text,
    jsonb_build_object('type', v_snap.leaderboard_type, 'period', v_snap.period)
  );
END;
$$;


-- 5d. Owner Only: Update Leaderboard Settings
CREATE OR REPLACE FUNCTION public.update_leaderboard_settings(
  p_enabled BOOLEAN,
  p_project_enabled BOOLEAN,
  p_creator_enabled BOOLEAN,
  p_visibility TEXT,
  p_project_like_weight NUMERIC,
  p_project_comment_weight NUMERIC,
  p_project_view_weight NUMERIC,
  p_github_bonus NUMERIC,
  p_gallery_bonus NUMERIC,
  p_recency_decay_days NUMERIC,
  p_creator_project_weight NUMERIC,
  p_creator_like_weight NUMERIC,
  p_creator_comment_weight NUMERIC,
  p_creator_activity_weight NUMERIC,
  p_creator_top3_bonus NUMERIC,
  p_creator_top10_bonus NUMERIC,
  p_weekly_enabled BOOLEAN,
  p_monthly_enabled BOOLEAN,
  p_all_time_enabled BOOLEAN
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_owner() THEN
    RAISE EXCEPTION 'Access denied: only the system owner can modify leaderboard scoring settings';
  END IF;

  IF p_visibility NOT IN ('public', 'creators_only', 'admins_only', 'no_one') THEN
    RAISE EXCEPTION 'Invalid visibility setting';
  END IF;

  UPDATE public.leaderboard_settings
  SET
    enabled = p_enabled,
    project_enabled = p_project_enabled,
    creator_enabled = p_creator_enabled,
    visibility = p_visibility,
    project_like_weight = p_project_like_weight,
    project_comment_weight = p_project_comment_weight,
    project_view_weight = p_project_view_weight,
    github_bonus = p_github_bonus,
    gallery_bonus = p_gallery_bonus,
    recency_decay_days = p_recency_decay_days,
    creator_project_weight = p_creator_project_weight,
    creator_like_weight = p_creator_like_weight,
    creator_comment_weight = p_creator_comment_weight,
    creator_activity_weight = p_creator_activity_weight,
    creator_top3_bonus = p_creator_top3_bonus,
    creator_top10_bonus = p_creator_top10_bonus,
    weekly_enabled = p_weekly_enabled,
    monthly_enabled = p_monthly_enabled,
    all_time_enabled = p_all_time_enabled,
    updated_at = now(),
    updated_by = auth.uid()
  WHERE id = 1;

  PERFORM public.insert_activity_log(
    auth.uid(),
    'leaderboard_settings_updated',
    'leaderboard_settings',
    '1',
    jsonb_build_object(
      'enabled', p_enabled,
      'visibility', p_visibility,
      'project_like_weight', p_project_like_weight
    )
  );
END;
$$;


-- 5e. Owner Only: Override Entry Score / Rank
CREATE OR REPLACE FUNCTION public.override_leaderboard_entry_score(
  p_entry_id UUID,
  p_new_score NUMERIC,
  p_new_rank INTEGER,
  p_override_notes TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_owner() THEN
    RAISE EXCEPTION 'Access denied: only the system owner can override leaderboard scores';
  END IF;

  UPDATE public.leaderboard_entries
  SET
    score = p_new_score,
    rank = p_new_rank,
    is_overridden = true,
    override_notes = trim(p_override_notes)
  WHERE id = p_entry_id;

  PERFORM public.insert_activity_log(
    auth.uid(),
    'leaderboard_score_override',
    'leaderboard_entry',
    p_entry_id::text,
    jsonb_build_object('score', p_new_score, 'rank', p_new_rank, 'notes', p_override_notes)
  );
END;
$$;


-- ── 6. CLIENT CONSUMPTION RPCS (VISIBILITY PROTECTED) ───────────────────────

-- 6a. Get Public Leaderboard
CREATE OR REPLACE FUNCTION public.get_public_leaderboard(
  p_type TEXT,
  p_period TEXT DEFAULT 'all_time'
)
RETURNS TABLE (
  rank INTEGER,
  entity_id UUID,
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
DECLARE
  v_settings public.leaderboard_settings%ROWTYPE;
  v_user_role TEXT;
  v_snap_id UUID;
  v_published_at TIMESTAMPTZ;
BEGIN
  SELECT * INTO v_settings FROM public.leaderboard_settings WHERE id = 1;
  IF NOT FOUND OR NOT v_settings.enabled THEN
    RETURN;
  END IF;

  IF (p_type = 'projects' AND NOT v_settings.project_enabled) OR
     (p_type = 'creators' AND NOT v_settings.creator_enabled) THEN
    RETURN;
  END IF;

  -- Verify visibility permissions
  IF v_settings.visibility = 'no_one' THEN
    IF NOT (public.is_owner() OR public.is_admin()) THEN
      RETURN;
    END IF;
  ELSIF v_settings.visibility = 'admins_only' THEN
    IF NOT (public.is_owner() OR public.is_admin()) THEN
      RETURN;
    END IF;
  ELSIF v_settings.visibility = 'creators_only' THEN
    IF auth.uid() IS NULL THEN
      RETURN;
    END IF;
    SELECT role INTO v_user_role FROM public.profiles WHERE id = auth.uid();
    IF NOT (v_user_role IN ('creator', 'admin') OR public.is_owner()) THEN
      RETURN;
    END IF;
  END IF;

  -- Find the latest published snapshot
  SELECT id, s.published_at INTO v_snap_id, v_published_at
  FROM public.leaderboard_snapshots s
  WHERE s.leaderboard_type = p_type
    AND s.period = p_period
    AND s.status = 'published'
  ORDER BY s.published_at DESC
  LIMIT 1;

  IF v_snap_id IS NOT NULL THEN
    RETURN QUERY
    SELECT
      le.rank,
      le.entity_id,
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
  ELSE
    -- If no published snapshot exists, return empty (clean unpublished state)
    RETURN;
  END IF;
END;
$$;


-- 6b. Get Logged-in Creator Position & Rank Change
CREATE OR REPLACE FUNCTION public.get_creator_my_rank(p_period TEXT DEFAULT 'all_time')
RETURNS TABLE (
  rank INTEGER,
  score NUMERIC,
  total_creators BIGINT,
  rank_delta INTEGER,
  is_creator BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_user_role TEXT;
  v_curr_rank INTEGER;
  v_curr_score NUMERIC;
  v_total BIGINT;
  v_prev_rank INTEGER;
  v_latest_snap UUID;
  v_prev_snap UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT NULL::INTEGER, NULL::NUMERIC, 0::BIGINT, 0::INTEGER, false;
    RETURN;
  END IF;

  SELECT role INTO v_user_role FROM public.profiles WHERE id = v_user_id;
  IF v_user_role <> 'creator' AND NOT public.is_owner() THEN
    RETURN QUERY SELECT NULL::INTEGER, NULL::NUMERIC, 0::BIGINT, 0::INTEGER, false;
    RETURN;
  END IF;

  -- Find the latest published snapshot for creators
  SELECT id INTO v_latest_snap
  FROM public.leaderboard_snapshots
  WHERE leaderboard_type = 'creators' AND period = p_period AND status = 'published'
  ORDER BY published_at DESC
  LIMIT 1;

  IF v_latest_snap IS NOT NULL THEN
    SELECT le.rank, le.score INTO v_curr_rank, v_curr_score
    FROM public.leaderboard_entries le
    WHERE le.snapshot_id = v_latest_snap AND le.entity_id = v_user_id;

    SELECT COUNT(*) INTO v_total
    FROM public.leaderboard_entries le
    WHERE le.snapshot_id = v_latest_snap;

    -- Find the previous snapshot to calculate delta
    SELECT id INTO v_prev_snap
    FROM public.leaderboard_snapshots
    WHERE leaderboard_type = 'creators' AND period = p_period AND status IN ('published', 'archived') AND id <> v_latest_snap
    ORDER BY published_at DESC
    LIMIT 1;

    IF v_prev_snap IS NOT NULL THEN
      SELECT le.rank INTO v_prev_rank
      FROM public.leaderboard_entries le
      WHERE le.snapshot_id = v_prev_snap AND le.entity_id = v_user_id;
    END IF;

    -- Positive delta = moved up in ranking (e.g., from rank 5 to rank 2 = +3 positions)
    RETURN QUERY
    SELECT
      v_curr_rank,
      v_curr_score,
      COALESCE(v_total, 0),
      CASE WHEN v_prev_rank IS NOT NULL AND v_curr_rank IS NOT NULL THEN (v_prev_rank - v_curr_rank) ELSE 0 END,
      true;
  ELSE
    -- Live calculation fallback if creator wants to see live ranking
    SELECT ccl.rank, ccl.score INTO v_curr_rank, v_curr_score
    FROM public.calculate_creator_leaderboard(p_period) ccl
    WHERE ccl.creator_id = v_user_id;

    SELECT COUNT(*) INTO v_total
    FROM public.calculate_creator_leaderboard(p_period);

    RETURN QUERY
    SELECT v_curr_rank, v_curr_score, COALESCE(v_total, 0), 0, true;
  END IF;
END;
$$;


-- ── 7. GRANTS ───────────────────────────────────────────────────────────────

REVOKE ALL ON FUNCTION public.calculate_project_leaderboard(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.calculate_creator_leaderboard(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.generate_leaderboard_snapshot(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.publish_leaderboard_snapshot(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.unpublish_leaderboard_snapshot(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_leaderboard_settings(BOOLEAN, BOOLEAN, BOOLEAN, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, BOOLEAN, BOOLEAN, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.override_leaderboard_entry_score(UUID, NUMERIC, INTEGER, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_leaderboard(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_creator_my_rank(TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.calculate_project_leaderboard(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_creator_leaderboard(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_leaderboard_snapshot(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.publish_leaderboard_snapshot(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unpublish_leaderboard_snapshot(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_leaderboard_settings(BOOLEAN, BOOLEAN, BOOLEAN, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, BOOLEAN, BOOLEAN, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.override_leaderboard_entry_score(UUID, NUMERIC, INTEGER, TEXT) TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_public_leaderboard(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_creator_my_rank(TEXT) TO authenticated;

GRANT SELECT ON public.leaderboard_settings TO anon, authenticated;
GRANT SELECT ON public.leaderboard_snapshots TO anon, authenticated;
GRANT SELECT ON public.leaderboard_entries TO anon, authenticated;

-- Reload schema
NOTIFY pgrst, 'reload schema';

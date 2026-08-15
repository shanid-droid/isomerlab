-- ============================================================================
-- ISOMER: LEADERBOARD SCORING ENGINE
-- ============================================================================
-- Authoritative score calculation lives here, never in the client.
--
-- Rules enforced by every calculation:
--   • only published projects, only non-deleted comments
--   • self-likes / self-comments never earn points (received or activity)
--   • a like counts only while its row exists → unlike removes the point
--   • comments per (author, project, period) are capped → no comment farming
--   • deterministic ordering: score, likes, comments, earliest event, id
-- ============================================================================

-- ── Period helper ───────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.leaderboard_period_start(p_period TEXT)
RETURNS TIMESTAMPTZ
LANGUAGE sql
IMMUTABLE
AS $fn$
  SELECT CASE p_period
    WHEN 'weekly'  THEN now() - INTERVAL '7 days'
    WHEN 'monthly' THEN now() - INTERVAL '30 days'
    ELSE '-infinity'::TIMESTAMPTZ
  END;
$fn$;


-- ── Project leaderboard ─────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.calculate_project_leaderboard(TEXT);

CREATE OR REPLACE FUNCTION public.calculate_project_leaderboard(p_period TEXT DEFAULT 'all_time')
RETURNS TABLE (
  rank               INTEGER,
  project_id         UUID,
  score              NUMERIC,
  likes              INTEGER,
  comments           INTEGER,
  views              INTEGER,
  is_manual_override BOOLEAN,
  metadata           JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $fn$
#variable_conflict use_column
DECLARE
  v_since TIMESTAMPTZ := public.leaderboard_period_start(p_period);
BEGIN
  IF p_period NOT IN ('all_time', 'monthly', 'weekly') THEN
    RAISE EXCEPTION 'Invalid leaderboard period: %', p_period;
  END IF;

  RETURN QUERY
  WITH s AS (
    SELECT * FROM public.leaderboard_settings WHERE id = 1
  ),
  base AS (
    SELECT p.id, p.title, p.slug, p.description, p.thumbnail_url, p.github_url,
           p.components, p.created_by, p.created_at
    FROM public.projects p
    WHERE p.published = true
  ),
  like_stats AS (
    SELECT l.project_id,
           COUNT(*)::INTEGER      AS like_count,
           MIN(l.created_at)      AS first_like_at
    FROM public.project_likes l
    JOIN base b ON b.id = l.project_id
    WHERE l.created_at >= v_since
      AND l.user_id IS DISTINCT FROM b.created_by   -- self-likes never score
    GROUP BY l.project_id
  ),
  -- Cap each author's comments per project so repeat commenting cannot farm points
  comment_capped AS (
    SELECT c.project_id,
           LEAST(COUNT(*), (SELECT max_scored_comments_per_project FROM s))::INTEGER AS scored,
           MIN(c.created_at) AS first_comment_at
    FROM public.project_comments c
    JOIN base b ON b.id = c.project_id
    WHERE c.deleted_at IS NULL
      AND c.created_at >= v_since
      AND c.user_id IS DISTINCT FROM b.created_by   -- self-comments never score
    GROUP BY c.project_id, c.user_id
  ),
  comment_stats AS (
    SELECT project_id,
           SUM(scored)::INTEGER AS comment_count,
           MIN(first_comment_at) AS first_comment_at
    FROM comment_capped
    GROUP BY project_id
  ),
  view_stats AS (
    SELECT v.project_id, COUNT(*)::INTEGER AS view_count
    FROM public.project_views v
    WHERE v.created_at >= v_since
    GROUP BY v.project_id
  ),
  gallery_stats AS (
    SELECT g.project_id, COUNT(*)::INTEGER AS image_count
    FROM public.project_gallery g
    GROUP BY g.project_id
  ),
  scored AS (
    SELECT
      b.id,
      COALESCE(ls.like_count, 0)    AS like_count,
      COALESCE(cs.comment_count, 0) AS comment_count,
      COALESCE(vs.view_count, 0)    AS view_count,
      LEAST(COALESCE(ls.first_like_at, 'infinity'::TIMESTAMPTZ),
            COALESCE(cs.first_comment_at, 'infinity'::TIMESTAMPTZ),
            COALESCE(b.created_at, now()))                       AS first_event_at,
      ROUND(
        (
            COALESCE(ls.like_count, 0)    * (SELECT project_like_weight    FROM s)
          + COALESCE(cs.comment_count, 0) * (SELECT project_comment_weight FROM s)
          + COALESCE(vs.view_count, 0)    * (SELECT project_view_weight    FROM s)
          + CASE WHEN NULLIF(TRIM(COALESCE(b.github_url, '')), '') IS NOT NULL
                 THEN (SELECT github_bonus FROM s) ELSE 0 END
          + CASE WHEN COALESCE(gy.image_count, 0) > 0
                 THEN (SELECT gallery_bonus FROM s) ELSE 0 END
          + CASE WHEN LENGTH(COALESCE(b.description, '')) > 80
                 THEN (SELECT description_bonus FROM s) ELSE 0 END
          + CASE WHEN COALESCE(b.components::TEXT, '') NOT IN ('', '[]', '{}')
                 THEN (SELECT tags_bonus FROM s) ELSE 0 END
        )
        * CASE
            WHEN (SELECT recency_half_life_days FROM s) = 0 THEN 1
            ELSE GREATEST(
              (SELECT recency_floor FROM s),
              POWER(0.5, EXTRACT(EPOCH FROM (now() - COALESCE(b.created_at, now())))
                         / 86400.0 / (SELECT recency_half_life_days FROM s))
            )
          END
      , 2) AS raw_score,
      b.title, b.slug, b.thumbnail_url, b.created_by
    FROM base b
    LEFT JOIN like_stats    ls ON ls.project_id = b.id
    LEFT JOIN comment_stats cs ON cs.project_id = b.id
    LEFT JOIN view_stats    vs ON vs.project_id = b.id
    LEFT JOIN gallery_stats gy ON gy.project_id = b.id
  ),
  with_overrides AS (
    SELECT
      sc.*,
      COALESCE(o.score_override, sc.raw_score) AS final_score,
      o.rank_override,
      COALESCE(o.featured, false)              AS featured,
      (o.id IS NOT NULL)                       AS overridden
    FROM scored sc
    LEFT JOIN public.leaderboard_overrides o
      ON o.entity_type = 'project' AND o.entity_id = sc.id
  ),
  ranked AS (
    SELECT
      wo.*,
      pr.full_name AS creator_name,
      ROW_NUMBER() OVER (
        ORDER BY
          (wo.rank_override IS NULL),   -- pinned ranks first, in their given order
          wo.rank_override ASC,
          wo.final_score DESC,
          wo.like_count DESC,
          wo.comment_count DESC,
          wo.first_event_at ASC,
          wo.id ASC
      )::INTEGER AS position
    FROM with_overrides wo
    LEFT JOIN public.profiles pr ON pr.id = wo.created_by
    WHERE wo.final_score >= (SELECT min_score_to_rank FROM s)
  )
  SELECT
    r.position,
    r.id,
    r.final_score,
    r.like_count,
    r.comment_count,
    r.view_count,
    r.overridden,
    jsonb_build_object(
      'title',         r.title,
      'slug',          r.slug,
      'thumbnail_url', r.thumbnail_url,
      'creator_id',    r.created_by,
      'creator_name',  r.creator_name,
      'featured',      r.featured
    )
  FROM ranked r
  ORDER BY r.position;
END;
$fn$;


-- ── Creator leaderboard ─────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.calculate_creator_leaderboard(TEXT);

CREATE OR REPLACE FUNCTION public.calculate_creator_leaderboard(p_period TEXT DEFAULT 'all_time')
RETURNS TABLE (
  rank               INTEGER,
  creator_id         UUID,
  score              NUMERIC,
  likes              INTEGER,
  comments           INTEGER,
  projects           INTEGER,
  activity_score     NUMERIC,
  is_manual_override BOOLEAN,
  metadata           JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $fn$
#variable_conflict use_column
DECLARE
  v_since TIMESTAMPTZ := public.leaderboard_period_start(p_period);
BEGIN
  IF p_period NOT IN ('all_time', 'monthly', 'weekly') THEN
    RAISE EXCEPTION 'Invalid leaderboard period: %', p_period;
  END IF;

  RETURN QUERY
  WITH s AS (
    SELECT * FROM public.leaderboard_settings WHERE id = 1
  ),
  creators AS (
    SELECT pr.id, pr.full_name, pr.avatar_url, pr.created_at
    FROM public.profiles pr
    WHERE pr.role = 'creator'
  ),
  owned AS (
    SELECT p.id, p.title, p.slug, p.created_by, p.created_at
    FROM public.projects p
    JOIN creators c ON c.id = p.created_by
    WHERE p.published = true
  ),
  project_counts AS (
    SELECT created_by AS creator_id, COUNT(*)::INTEGER AS project_count
    FROM owned
    WHERE created_at >= v_since
    GROUP BY created_by
  ),
  likes_received AS (
    SELECT o.created_by AS creator_id, COUNT(*)::INTEGER AS like_count
    FROM public.project_likes l
    JOIN owned o ON o.id = l.project_id
    WHERE l.created_at >= v_since
      AND l.user_id IS DISTINCT FROM o.created_by
    GROUP BY o.created_by
  ),
  comments_received_capped AS (
    SELECT o.created_by AS creator_id,
           LEAST(COUNT(*), (SELECT max_scored_comments_per_project FROM s))::INTEGER AS scored
    FROM public.project_comments c
    JOIN owned o ON o.id = c.project_id
    WHERE c.deleted_at IS NULL
      AND c.created_at >= v_since
      AND c.user_id IS DISTINCT FROM o.created_by
    GROUP BY o.created_by, c.project_id, c.user_id
  ),
  comments_received AS (
    SELECT creator_id, SUM(scored)::INTEGER AS comment_count
    FROM comments_received_capped
    GROUP BY creator_id
  ),
  -- Activity: only interactions with OTHER creators' published projects
  likes_given AS (
    SELECT l.user_id AS creator_id, COUNT(*)::INTEGER AS given
    FROM public.project_likes l
    JOIN public.projects p ON p.id = l.project_id AND p.published = true
    JOIN creators c ON c.id = l.user_id
    WHERE l.created_at >= v_since
      AND p.created_by IS DISTINCT FROM l.user_id
    GROUP BY l.user_id
  ),
  comments_given_capped AS (
    SELECT c.user_id AS creator_id,
           LEAST(COUNT(*), (SELECT max_scored_comments_per_project FROM s))::INTEGER AS scored
    FROM public.project_comments c
    JOIN public.projects p ON p.id = c.project_id AND p.published = true
    JOIN creators cr ON cr.id = c.user_id
    WHERE c.deleted_at IS NULL
      AND c.created_at >= v_since
      AND p.created_by IS DISTINCT FROM c.user_id
    GROUP BY c.user_id, c.project_id
  ),
  comments_given AS (
    SELECT creator_id, SUM(scored)::INTEGER AS given
    FROM comments_given_capped
    GROUP BY creator_id
  ),
  project_ranking AS (
    SELECT * FROM public.calculate_project_leaderboard(p_period)
  ),
  placement_bonus AS (
    SELECT
      (pl.metadata->>'creator_id')::UUID AS creator_id,
      SUM(
        CASE
          WHEN pl.rank <= 3  THEN (SELECT creator_top3_bonus  FROM s)
          WHEN pl.rank <= 10 THEN (SELECT creator_top10_bonus FROM s)
          ELSE 0
        END
      ) AS bonus
    FROM project_ranking pl
    WHERE pl.metadata->>'creator_id' IS NOT NULL
    GROUP BY (pl.metadata->>'creator_id')::UUID
  ),
  top_project AS (
    SELECT DISTINCT ON ((pl.metadata->>'creator_id')::UUID)
      (pl.metadata->>'creator_id')::UUID AS creator_id,
      pl.metadata->>'title' AS title,
      pl.metadata->>'slug'  AS slug,
      pl.rank               AS project_rank
    FROM project_ranking pl
    WHERE pl.metadata->>'creator_id' IS NOT NULL
    ORDER BY (pl.metadata->>'creator_id')::UUID, pl.rank ASC
  ),
  scored AS (
    SELECT
      c.id,
      c.full_name,
      c.avatar_url,
      c.created_at,
      COALESCE(pc.project_count, 0)  AS project_count,
      COALESCE(lr.like_count, 0)     AS like_count,
      COALESCE(cr.comment_count, 0)  AS comment_count,
      ROUND(
        (
            COALESCE(lg.given, 0) * (SELECT creator_like_activity_points    FROM s)
          + COALESCE(cg.given, 0) * (SELECT creator_comment_activity_points FROM s)
        ) * (SELECT creator_activity_weight FROM s)
      , 2) AS activity,
      COALESCE(pb.bonus, 0) AS placement,
      tp.title AS top_title,
      tp.slug  AS top_slug,
      tp.project_rank AS top_rank
    FROM creators c
    LEFT JOIN project_counts   pc ON pc.creator_id = c.id
    LEFT JOIN likes_received   lr ON lr.creator_id = c.id
    LEFT JOIN comments_received cr ON cr.creator_id = c.id
    LEFT JOIN likes_given      lg ON lg.creator_id = c.id
    LEFT JOIN comments_given   cg ON cg.creator_id = c.id
    LEFT JOIN placement_bonus  pb ON pb.creator_id = c.id
    LEFT JOIN top_project      tp ON tp.creator_id = c.id
  ),
  totals AS (
    SELECT
      sc.*,
      ROUND(
          sc.project_count * (SELECT creator_project_weight FROM s)
        + sc.like_count    * (SELECT creator_like_weight    FROM s)
        + sc.comment_count * (SELECT creator_comment_weight FROM s)
        + sc.activity
        + sc.placement
      , 2) AS raw_score
    FROM scored sc
  ),
  with_overrides AS (
    SELECT
      t.*,
      COALESCE(o.score_override, t.raw_score) AS final_score,
      o.rank_override,
      COALESCE(o.featured, false)             AS featured,
      (o.id IS NOT NULL)                      AS overridden
    FROM totals t
    LEFT JOIN public.leaderboard_overrides o
      ON o.entity_type = 'creator' AND o.entity_id = t.id
  ),
  ranked AS (
    SELECT
      wo.*,
      ROW_NUMBER() OVER (
        ORDER BY
          (wo.rank_override IS NULL),
          wo.rank_override ASC,
          wo.final_score DESC,
          wo.like_count DESC,
          wo.comment_count DESC,
          wo.created_at ASC,
          wo.id ASC
      )::INTEGER AS position
    FROM with_overrides wo
    WHERE wo.project_count >= (SELECT min_projects_for_creator FROM s)
      AND wo.final_score   >= (SELECT min_score_to_rank        FROM s)
  )
  SELECT
    r.position,
    r.id,
    r.final_score,
    r.like_count,
    r.comment_count,
    r.project_count,
    r.activity,
    r.overridden,
    jsonb_build_object(
      'name',         r.full_name,
      'avatar_url',   r.avatar_url,
      'top_project',  r.top_title,
      'top_slug',     r.top_slug,
      'top_rank',     r.top_rank,
      'featured',     r.featured
    )
  FROM ranked r
  ORDER BY r.position;
END;
$fn$;

-- Calculations are internal: only the SECURITY DEFINER RPCs in the next
-- migration expose them, and those enforce visibility / role checks.
REVOKE ALL ON FUNCTION public.calculate_project_leaderboard(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.calculate_creator_leaderboard(TEXT) FROM PUBLIC;

NOTIFY pgrst, 'reload schema';

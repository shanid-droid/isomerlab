-- ============================================================================
-- ISOMER: LEADERBOARD SCHEMA
-- ============================================================================
-- Creates:
--   • public.leaderboard_settings   — singleton owner-controlled configuration
--   • public.leaderboard_snapshots  — generated / published ranking versions
--   • public.leaderboard_entries    — rows of a snapshot
--   • public.leaderboard_overrides  — owner-only manual score/rank adjustments
--   • public.project_views          — rate limited view tracking (1/viewer/day)
--
-- Security:
--   • Reuses existing public.is_owner() / public.is_admin()
--   • Visibility is enforced in RLS via public.can_view_leaderboard()
--   • Writes happen only through SECURITY DEFINER RPCs (see later migrations)
--   • Does NOT modify existing tables, policies or functions
-- ============================================================================

-- ── 1. SETTINGS (singleton, mirrors the site_settings pattern) ──────────────

CREATE TABLE IF NOT EXISTS public.leaderboard_settings (
  id                              INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),

  enabled                         BOOLEAN NOT NULL DEFAULT true,
  project_enabled                 BOOLEAN NOT NULL DEFAULT true,
  creator_enabled                 BOOLEAN NOT NULL DEFAULT true,
  visibility                      TEXT    NOT NULL DEFAULT 'public'
                                          CHECK (visibility IN ('public', 'creators', 'admins', 'none')),

  -- Project scoring weights
  project_like_weight             NUMERIC NOT NULL DEFAULT 1,
  project_comment_weight          NUMERIC NOT NULL DEFAULT 3,
  project_view_weight             NUMERIC NOT NULL DEFAULT 0.1,
  github_bonus                    NUMERIC NOT NULL DEFAULT 5,
  gallery_bonus                   NUMERIC NOT NULL DEFAULT 3,
  description_bonus               NUMERIC NOT NULL DEFAULT 2,
  tags_bonus                      NUMERIC NOT NULL DEFAULT 2,
  -- 0 disables recency decay entirely
  recency_half_life_days          NUMERIC NOT NULL DEFAULT 180 CHECK (recency_half_life_days >= 0),
  recency_floor                   NUMERIC NOT NULL DEFAULT 0.25
                                          CHECK (recency_floor > 0 AND recency_floor <= 1),

  -- Creator scoring weights
  creator_project_weight          NUMERIC NOT NULL DEFAULT 10,
  creator_like_weight             NUMERIC NOT NULL DEFAULT 1,
  creator_comment_weight          NUMERIC NOT NULL DEFAULT 3,
  creator_activity_weight         NUMERIC NOT NULL DEFAULT 1,
  creator_top10_bonus             NUMERIC NOT NULL DEFAULT 25,
  creator_top3_bonus              NUMERIC NOT NULL DEFAULT 50,
  creator_comment_activity_points NUMERIC NOT NULL DEFAULT 2,
  creator_like_activity_points    NUMERIC NOT NULL DEFAULT 1,

  -- Anti-gaming / eligibility
  max_scored_comments_per_project INTEGER NOT NULL DEFAULT 3 CHECK (max_scored_comments_per_project > 0),
  min_projects_for_creator        INTEGER NOT NULL DEFAULT 1 CHECK (min_projects_for_creator >= 0),
  min_score_to_rank               NUMERIC NOT NULL DEFAULT 0,

  -- Periods
  all_time_enabled                BOOLEAN NOT NULL DEFAULT true,
  monthly_enabled                 BOOLEAN NOT NULL DEFAULT true,
  weekly_enabled                  BOOLEAN NOT NULL DEFAULT true,

  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by                      UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

INSERT INTO public.leaderboard_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;


-- ── 2. VISIBILITY GATE ──────────────────────────────────────────────────────
-- Single source of truth for "may the current request read the leaderboard".

CREATE OR REPLACE FUNCTION public.can_view_leaderboard()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $fn$
DECLARE
  v_enabled    BOOLEAN;
  v_visibility TEXT;
  v_role       TEXT;
BEGIN
  SELECT enabled, visibility INTO v_enabled, v_visibility
  FROM public.leaderboard_settings WHERE id = 1;

  IF v_enabled IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Owner and admins always retain access so they can manage a hidden board
  IF COALESCE(public.is_owner() OR public.is_admin(), false) THEN
    RETURN TRUE;
  END IF;

  IF NOT v_enabled OR v_visibility = 'none' OR v_visibility = 'admins' THEN
    RETURN FALSE;
  END IF;

  IF v_visibility = 'public' THEN
    RETURN TRUE;
  END IF;

  -- 'creators'
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  RETURN v_role = 'creator';
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.can_view_leaderboard() TO anon, authenticated;


-- ── 3. SNAPSHOTS ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.leaderboard_snapshots (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leaderboard_type TEXT NOT NULL CHECK (leaderboard_type IN ('project', 'creator')),
  period           TEXT NOT NULL CHECK (period IN ('all_time', 'monthly', 'weekly')),
  visibility       TEXT NOT NULL DEFAULT 'public'
                        CHECK (visibility IN ('public', 'creators', 'admins', 'none')),
  status           TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'published', 'unpublished')),
  -- Weights frozen at generation time, so a published board stays reproducible
  settings_used    JSONB NOT NULL DEFAULT '{}'::jsonb,
  entry_count      INTEGER NOT NULL DEFAULT 0,
  published_at     TIMESTAMPTZ,
  published_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_leaderboard_snapshots_lookup
  ON public.leaderboard_snapshots (leaderboard_type, period, status, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_leaderboard_snapshots_created_at
  ON public.leaderboard_snapshots (created_at DESC);

-- At most one published snapshot per (type, period)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_leaderboard_published
  ON public.leaderboard_snapshots (leaderboard_type, period)
  WHERE status = 'published';


-- ── 4. ENTRIES ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.leaderboard_entries (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id        UUID NOT NULL REFERENCES public.leaderboard_snapshots(id) ON DELETE CASCADE,
  entity_type        TEXT NOT NULL CHECK (entity_type IN ('project', 'creator')),
  entity_id          UUID NOT NULL,
  rank               INTEGER NOT NULL,
  score              NUMERIC NOT NULL DEFAULT 0,
  likes              INTEGER NOT NULL DEFAULT 0,
  comments           INTEGER NOT NULL DEFAULT 0,
  views              INTEGER NOT NULL DEFAULT 0,
  projects           INTEGER NOT NULL DEFAULT 0,
  activity_score     NUMERIC NOT NULL DEFAULT 0,
  -- Display data (title, slug, thumbnail, creator name, top project…) so a
  -- leaderboard read is a single query with no joins and no N+1
  metadata           JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_manual_override BOOLEAN NOT NULL DEFAULT false,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uniq_leaderboard_entry UNIQUE (snapshot_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_leaderboard_entries_snapshot_rank
  ON public.leaderboard_entries (snapshot_id, rank);

CREATE INDEX IF NOT EXISTS idx_leaderboard_entries_entity
  ON public.leaderboard_entries (entity_type, entity_id);


-- ── 5. OWNER-ONLY MANUAL OVERRIDES ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.leaderboard_overrides (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type    TEXT NOT NULL CHECK (entity_type IN ('project', 'creator')),
  entity_id      UUID NOT NULL,
  score_override NUMERIC,
  rank_override  INTEGER CHECK (rank_override IS NULL OR rank_override > 0),
  featured       BOOLEAN NOT NULL DEFAULT false,
  reason         TEXT,
  created_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uniq_leaderboard_override UNIQUE (entity_type, entity_id)
);


-- ── 6. PROJECT VIEWS (rate limited: one counted view per viewer per day) ────

CREATE TABLE IF NOT EXISTS public.project_views (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  viewer_hash TEXT NOT NULL,
  viewed_on   DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uniq_project_view_per_day UNIQUE (project_id, viewer_hash, viewed_on)
);

CREATE INDEX IF NOT EXISTS idx_project_views_project
  ON public.project_views (project_id, created_at DESC);


-- ── 7. SUPPORTING INDEXES ON EXISTING TABLES (additive only) ────────────────

CREATE INDEX IF NOT EXISTS idx_project_likes_project_user
  ON public.project_likes (project_id, user_id);

CREATE INDEX IF NOT EXISTS idx_project_likes_user
  ON public.project_likes (user_id);

CREATE INDEX IF NOT EXISTS idx_project_likes_created_at
  ON public.project_likes (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_project_comments_active
  ON public.project_comments (project_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_project_comments_created_at
  ON public.project_comments (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_projects_created_by
  ON public.projects (created_by);

CREATE INDEX IF NOT EXISTS idx_projects_published
  ON public.projects (published);


-- ── 8. ROW LEVEL SECURITY ───────────────────────────────────────────────────

ALTER TABLE public.leaderboard_settings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboard_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboard_entries   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboard_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_views         ENABLE ROW LEVEL SECURITY;

-- Settings: readable by everyone (nav needs enabled/visibility), writable by owner only
DROP POLICY IF EXISTS "Anyone reads leaderboard settings" ON public.leaderboard_settings;
CREATE POLICY "Anyone reads leaderboard settings"
  ON public.leaderboard_settings FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Owner updates leaderboard settings" ON public.leaderboard_settings;
CREATE POLICY "Owner updates leaderboard settings"
  ON public.leaderboard_settings FOR UPDATE
  USING (public.is_owner())
  WITH CHECK (public.is_owner());

-- Snapshots: published ones follow the visibility gate; staff see everything
DROP POLICY IF EXISTS "Read published leaderboard snapshots" ON public.leaderboard_snapshots;
CREATE POLICY "Read published leaderboard snapshots"
  ON public.leaderboard_snapshots FOR SELECT
  USING (
    public.is_owner()
    OR public.is_admin()
    OR (status = 'published' AND public.can_view_leaderboard())
  );

-- Entries: inherit the parent snapshot's readability
DROP POLICY IF EXISTS "Read published leaderboard entries" ON public.leaderboard_entries;
CREATE POLICY "Read published leaderboard entries"
  ON public.leaderboard_entries FOR SELECT
  USING (
    public.is_owner()
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.leaderboard_snapshots s
      WHERE s.id = leaderboard_entries.snapshot_id
        AND s.status = 'published'
        AND public.can_view_leaderboard()
    )
  );

-- Overrides: owner only, in every direction
DROP POLICY IF EXISTS "Owner manages leaderboard overrides" ON public.leaderboard_overrides;
CREATE POLICY "Owner manages leaderboard overrides"
  ON public.leaderboard_overrides FOR ALL
  USING (public.is_owner())
  WITH CHECK (public.is_owner());

-- Views: nobody reads raw rows (aggregates come from SECURITY DEFINER functions),
-- inserts happen only through record_project_view()
DROP POLICY IF EXISTS "Staff read project views" ON public.project_views;
CREATE POLICY "Staff read project views"
  ON public.project_views FOR SELECT
  USING (public.is_owner() OR public.is_admin());

-- No INSERT/UPDATE/DELETE policies anywhere above: all writes go through
-- SECURITY DEFINER RPCs that re-derive the caller's role from auth.uid().

NOTIFY pgrst, 'reload schema';

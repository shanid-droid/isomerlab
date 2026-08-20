-- ============================================================================
-- ISOMER LAB: CAMPAIGN + REWARDS + BADGE SYSTEM MIGRATION
-- Migration: 20260820_campaigns_and_badges_system.sql
-- ============================================================================

-- ── 1. BADGES TABLE ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon_url TEXT,
  category TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('general', 'community', 'creator', 'campaign', 'special_event', 'achievement')),
  rarity TEXT NOT NULL DEFAULT 'common' CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')),
  color_theme TEXT DEFAULT 'emerald',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_badges_category ON public.badges(category);
CREATE INDEX IF NOT EXISTS idx_badges_rarity ON public.badges(rarity);
CREATE INDEX IF NOT EXISTS idx_badges_active ON public.badges(is_active);

-- ── 2. USER BADGES TABLE ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id UUID NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL DEFAULT 'admin' CHECK (source_type IN ('admin', 'campaign', 'campaign_drop', 'achievement')),
  source_id UUID NULL,
  source_title TEXT NULL,
  awarded_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  awarded_at TIMESTAMPTZ DEFAULT now(),
  notes TEXT NULL,
  CONSTRAINT unique_user_badge UNIQUE (user_id, badge_id)
);

CREATE INDEX IF NOT EXISTS idx_user_badges_user_id ON public.user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_badge_id ON public.user_badges(badge_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_awarded_at ON public.user_badges(awarded_at DESC);

-- ── 3. CAMPAIGNS TABLE ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  short_description TEXT NOT NULL,
  description TEXT,
  banner_url TEXT,
  thumbnail_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'active', 'upcoming', 'ended', 'archived')),
  start_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_date TIMESTAMPTZ NULL,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  featured_order INT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_status ON public.campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_dates ON public.campaigns(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_campaigns_slug ON public.campaigns(slug);

-- ── 4. CAMPAIGN REQUIREMENTS TABLE ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.campaign_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  requirement_type TEXT NOT NULL CHECK (requirement_type IN (
    'like_project',
    'comment_project',
    'publish_project',
    'profile_complete',
    'apply_creator',
    'link_social',
    'community_action',
    'custom_check'
  )),
  target_count INT NOT NULL DEFAULT 1,
  target_entity_id TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_order INT NOT NULL DEFAULT 0,
  is_required BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaign_reqs_campaign ON public.campaign_requirements(campaign_id, sort_order);

-- ── 5. CAMPAIGN REWARDS TABLE ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.campaign_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  reward_type TEXT NOT NULL DEFAULT 'badge' CHECK (reward_type IN ('badge', 'drop', 'role', 'custom')),
  badge_id UUID NULL REFERENCES public.badges(id) ON DELETE SET NULL,
  drop_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  max_claims INT NULL,
  claimed_count INT NOT NULL DEFAULT 0,
  eligibility_type TEXT NOT NULL DEFAULT 'all_requirements' CHECK (eligibility_type IN ('all_requirements', 'min_requirements_count', 'manual')),
  min_requirements_count INT NOT NULL DEFAULT 0,
  is_claimable BOOLEAN NOT NULL DEFAULT true,
  is_automatic BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaign_rewards_campaign ON public.campaign_rewards(campaign_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_campaign_rewards_badge ON public.campaign_rewards(badge_id);

-- ── 6. CAMPAIGN PARTICIPANTS TABLE ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.campaign_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ NULL,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'disqualified')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT unique_campaign_participant UNIQUE (campaign_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_campaign_part_camp_user ON public.campaign_participants(campaign_id, user_id);
CREATE INDEX IF NOT EXISTS idx_campaign_part_user ON public.campaign_participants(user_id);

-- ── 7. CAMPAIGN CLAIMS TABLE ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.campaign_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  campaign_reward_id UUID NOT NULL REFERENCES public.campaign_rewards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id UUID NULL REFERENCES public.badges(id) ON DELETE SET NULL,
  claimed_at TIMESTAMPTZ DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'claimed' CHECK (status IN ('claimed', 'revoked')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT unique_user_campaign_reward_claim UNIQUE (user_id, campaign_reward_id)
);

CREATE INDEX IF NOT EXISTS idx_campaign_claims_user ON public.campaign_claims(user_id);
CREATE INDEX IF NOT EXISTS idx_campaign_claims_reward ON public.campaign_claims(campaign_reward_id);
CREATE INDEX IF NOT EXISTS idx_campaign_claims_campaign ON public.campaign_claims(campaign_id);

-- ── 8. ENABLE ROW LEVEL SECURITY ─────────────────────────────────────────────
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_claims ENABLE ROW LEVEL SECURITY;

-- ── 9. ROW LEVEL SECURITY POLICIES ───────────────────────────────────────────

-- 9.1 BADGES POLICIES
DROP POLICY IF EXISTS "Public can view active badges" ON public.badges;
CREATE POLICY "Public can view active badges"
  ON public.badges FOR SELECT
  USING (is_active = true OR public.is_owner() OR public.is_admin());

DROP POLICY IF EXISTS "Admins manage badges" ON public.badges;
CREATE POLICY "Admins manage badges"
  ON public.badges FOR ALL
  USING (public.is_owner() OR public.is_admin())
  WITH CHECK (public.is_owner() OR public.is_admin());

-- 9.2 USER BADGES POLICIES
DROP POLICY IF EXISTS "Public can view user badges" ON public.user_badges;
CREATE POLICY "Public can view user badges"
  ON public.user_badges FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins manage user badges" ON public.user_badges;
CREATE POLICY "Admins manage user badges"
  ON public.user_badges FOR ALL
  USING (public.is_owner() OR public.is_admin())
  WITH CHECK (public.is_owner() OR public.is_admin());

-- 9.3 CAMPAIGNS POLICIES
DROP POLICY IF EXISTS "Public can view published campaigns" ON public.campaigns;
CREATE POLICY "Public can view published campaigns"
  ON public.campaigns FOR SELECT
  USING (
    status IN ('published', 'active', 'upcoming', 'ended')
    OR public.is_owner()
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "Admins manage campaigns" ON public.campaigns;
CREATE POLICY "Admins manage campaigns"
  ON public.campaigns FOR ALL
  USING (public.is_owner() OR public.is_admin())
  WITH CHECK (public.is_owner() OR public.is_admin());

-- 9.4 CAMPAIGN REQUIREMENTS POLICIES
DROP POLICY IF EXISTS "Public can view requirements of visible campaigns" ON public.campaign_requirements;
CREATE POLICY "Public can view requirements of visible campaigns"
  ON public.campaign_requirements FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = campaign_requirements.campaign_id
        AND (c.status IN ('published', 'active', 'upcoming', 'ended') OR public.is_owner() OR public.is_admin())
    )
  );

DROP POLICY IF EXISTS "Admins manage requirements" ON public.campaign_requirements;
CREATE POLICY "Admins manage requirements"
  ON public.campaign_requirements FOR ALL
  USING (public.is_owner() OR public.is_admin())
  WITH CHECK (public.is_owner() OR public.is_admin());

-- 9.5 CAMPAIGN REWARDS POLICIES
DROP POLICY IF EXISTS "Public can view rewards of visible campaigns" ON public.campaign_rewards;
CREATE POLICY "Public can view rewards of visible campaigns"
  ON public.campaign_rewards FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = campaign_rewards.campaign_id
        AND (c.status IN ('published', 'active', 'upcoming', 'ended') OR public.is_owner() OR public.is_admin())
    )
  );

DROP POLICY IF EXISTS "Admins manage rewards" ON public.campaign_rewards;
CREATE POLICY "Admins manage rewards"
  ON public.campaign_rewards FOR ALL
  USING (public.is_owner() OR public.is_admin())
  WITH CHECK (public.is_owner() OR public.is_admin());

-- 9.6 CAMPAIGN PARTICIPANTS POLICIES
DROP POLICY IF EXISTS "Users can view own participation and admins view all" ON public.campaign_participants;
CREATE POLICY "Users can view own participation and admins view all"
  ON public.campaign_participants FOR SELECT
  USING (
    auth.uid() = user_id
    OR public.is_owner()
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "Authenticated users join campaigns" ON public.campaign_participants;
CREATE POLICY "Authenticated users join campaigns"
  ON public.campaign_participants FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND auth.uid() = user_id
  );

DROP POLICY IF EXISTS "Admins manage participants" ON public.campaign_participants;
CREATE POLICY "Admins manage participants"
  ON public.campaign_participants FOR ALL
  USING (public.is_owner() OR public.is_admin())
  WITH CHECK (public.is_owner() OR public.is_admin());

-- 9.7 CAMPAIGN CLAIMS POLICIES
DROP POLICY IF EXISTS "Users can view own claims and admins view all" ON public.campaign_claims;
CREATE POLICY "Users can view own claims and admins view all"
  ON public.campaign_claims FOR SELECT
  USING (
    auth.uid() = user_id
    OR public.is_owner()
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "Admins manage claims" ON public.campaign_claims;
CREATE POLICY "Admins manage claims"
  ON public.campaign_claims FOR ALL
  USING (public.is_owner() OR public.is_admin())
  WITH CHECK (public.is_owner() OR public.is_admin());

-- ── 10. DATABASE FUNCTIONS & RPCS ────────────────────────────────────────────

-- 10.1 DIRECT BADGE AWARD (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.award_user_badge(
  p_user_id     UUID,
  p_badge_id    UUID,
  p_source_type TEXT DEFAULT 'admin',
  p_source_id   UUID DEFAULT NULL,
  p_source_title TEXT DEFAULT NULL,
  p_notes       TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_badge public.badges;
  v_user_badge public.user_badges;
  v_source_title TEXT;
BEGIN
  -- 1. Must be owner or admin if called directly by user
  IF p_source_type = 'admin' AND NOT (public.is_owner() OR public.is_admin()) THEN
    RAISE EXCEPTION 'Access denied: only Owner or Admin can directly award badges';
  END IF;

  -- 2. Verify badge exists and is active
  SELECT * INTO v_badge FROM public.badges WHERE id = p_badge_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Badge not found';
  END IF;

  IF NOT v_badge.is_active THEN
    RAISE EXCEPTION 'Cannot award inactive badge';
  END IF;

  -- 3. Resolve source title
  v_source_title := COALESCE(p_source_title, CASE WHEN p_source_type = 'admin' THEN 'Direct Admin Award' ELSE 'ISOMER Campaign' END);

  -- 4. Insert or ignore if duplicate
  INSERT INTO public.user_badges (
    user_id,
    badge_id,
    source_type,
    source_id,
    source_title,
    awarded_by,
    awarded_at,
    notes
  )
  VALUES (
    p_user_id,
    p_badge_id,
    p_source_type,
    p_source_id,
    v_source_title,
    auth.uid(),
    now(),
    p_notes
  )
  ON CONFLICT (user_id, badge_id) DO NOTHING
  RETURNING * INTO v_user_badge;

  IF v_user_badge.id IS NULL THEN
    -- Already awarded
    RETURN jsonb_build_object(
      'success', true,
      'already_awarded', true,
      'message', 'User already holds this badge'
    );
  END IF;

  -- 5. Send private in-app notification to the recipient
  BEGIN
    INSERT INTO public.notifications (
      title,
      message,
      notification_type,
      recipient_id,
      recipient_user_id,
      created_by,
      is_active,
      metadata
    ) VALUES (
      'Badge Unlocked: ' || v_badge.name,
      'You earned the ' || v_badge.name || ' badge! (' || v_source_title || ')',
      'private',
      p_user_id,
      p_user_id,
      COALESCE(auth.uid(), '9d5d6287-1843-4cd0-afee-fc1830411571'::uuid),
      true,
      jsonb_build_object(
        'type', 'badge_unlocked',
        'badge_id', v_badge.id,
        'badge_name', v_badge.name,
        'rarity', v_badge.rarity,
        'icon_url', v_badge.icon_url,
        'source_title', v_source_title
      )
    );
  EXCEPTION WHEN OTHERS THEN
    -- Non-fatal notification failure
  END;

  -- 6. Log activity event
  BEGIN
    INSERT INTO public.activity_logs (
      actor_user_id,
      action,
      target_type,
      target_id,
      details
    ) VALUES (
      auth.uid(),
      'badge_awarded',
      'badge',
      v_badge.id::text,
      jsonb_build_object(
        'recipient_user_id', p_user_id,
        'badge_name', v_badge.name,
        'source_type', p_source_type,
        'source_title', v_source_title
      )
    );
  EXCEPTION WHEN OTHERS THEN
    -- Non-fatal
  END;

  RETURN jsonb_build_object(
    'success', true,
    'already_awarded', false,
    'badge_id', v_badge.id,
    'badge_name', v_badge.name,
    'user_badge_id', v_user_badge.id
  );
END;
$$;

-- 10.2 REVOKE BADGE
CREATE OR REPLACE FUNCTION public.revoke_user_badge(p_user_badge_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ub public.user_badges;
BEGIN
  IF NOT (public.is_owner() OR public.is_admin()) THEN
    RAISE EXCEPTION 'Access denied: only Owner or Admin can revoke badges';
  END IF;

  SELECT * INTO v_ub FROM public.user_badges WHERE id = p_user_badge_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User badge record not found';
  END IF;

  DELETE FROM public.user_badges WHERE id = p_user_badge_id;

  BEGIN
    INSERT INTO public.activity_logs (
      actor_user_id,
      action,
      target_type,
      target_id,
      details
    ) VALUES (
      auth.uid(),
      'badge_revoked',
      'user_badge',
      p_user_badge_id::text,
      jsonb_build_object('user_id', v_ub.user_id, 'badge_id', v_ub.badge_id)
    );
  EXCEPTION WHEN OTHERS THEN
  END;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 10.3 JOIN CAMPAIGN
CREATE OR REPLACE FUNCTION public.join_campaign(p_campaign_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_campaign public.campaigns;
  v_participant public.campaign_participants;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to join campaign';
  END IF;

  SELECT * INTO v_campaign FROM public.campaigns WHERE id = p_campaign_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Campaign not found';
  END IF;

  IF v_campaign.status NOT IN ('published', 'active') THEN
    RAISE EXCEPTION 'Campaign is not currently accepting participants';
  END IF;

  INSERT INTO public.campaign_participants (campaign_id, user_id, joined_at, status)
  VALUES (p_campaign_id, v_user_id, now(), 'in_progress')
  ON CONFLICT (campaign_id, user_id) DO UPDATE SET status = EXCLUDED.status
  RETURNING * INTO v_participant;

  RETURN jsonb_build_object(
    'success', true,
    'participant_id', v_participant.id,
    'joined_at', v_participant.joined_at
  );
END;
$$;

-- 10.4 CHECK USER CAMPAIGN PROGRESS
CREATE OR REPLACE FUNCTION public.check_user_campaign_progress(
  p_campaign_id UUID,
  p_user_id     UUID DEFAULT auth.uid()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.campaign_requirements;
  v_req_results JSONB := '[]'::jsonb;
  v_current_count INT;
  v_is_completed BOOLEAN;
  v_total_reqs INT := 0;
  v_completed_reqs INT := 0;
  v_profile public.profiles;
  v_participant public.campaign_participants;
  v_community_verified BOOLEAN;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'is_participant', false,
      'total_requirements', 0,
      'completed_requirements', 0,
      'progress_percent', 0,
      'requirements', '[]'::jsonb
    );
  END IF;

  -- Load profile for profile checks
  SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id;

  -- Load participant record for metadata / manual checks
  SELECT * INTO v_participant FROM public.campaign_participants
  WHERE campaign_id = p_campaign_id AND user_id = p_user_id;

  FOR v_req IN
    SELECT * FROM public.campaign_requirements
    WHERE campaign_id = p_campaign_id
    ORDER BY sort_order ASC, created_at ASC
  LOOP
    v_total_reqs := v_total_reqs + 1;
    v_current_count := 0;
    v_is_completed := false;

    CASE v_req.requirement_type
      WHEN 'like_project' THEN
        IF v_req.target_entity_id IS NOT NULL AND v_req.target_entity_id != '' THEN
          -- Specific project like
          SELECT COUNT(*) INTO v_current_count
          FROM public.project_likes
          WHERE user_id = p_user_id AND project_id = v_req.target_entity_id::uuid;
        ELSE
          -- General project likes count
          SELECT COUNT(*) INTO v_current_count
          FROM public.project_likes
          WHERE user_id = p_user_id;
        END IF;

      WHEN 'comment_project' THEN
        IF v_req.target_entity_id IS NOT NULL AND v_req.target_entity_id != '' THEN
          -- Specific project comment
          SELECT COUNT(*) INTO v_current_count
          FROM public.project_comments
          WHERE user_id = p_user_id AND project_id = v_req.target_entity_id::uuid AND deleted_at IS NULL;
        ELSE
          -- General comments count
          SELECT COUNT(*) INTO v_current_count
          FROM public.project_comments
          WHERE user_id = p_user_id AND deleted_at IS NULL;
        END IF;

      WHEN 'publish_project' THEN
        SELECT COUNT(*) INTO v_current_count
        FROM public.projects
        WHERE created_by = p_user_id AND published = true;

      WHEN 'profile_complete' THEN
        v_current_count := 0;
        IF v_profile.full_name IS NOT NULL AND v_profile.full_name != '' THEN
          v_current_count := v_current_count + 1;
        END IF;
        IF v_profile.bio IS NOT NULL AND v_profile.bio != '' THEN
          v_current_count := v_current_count + 1;
        END IF;
        IF v_profile.avatar_url IS NOT NULL AND v_profile.avatar_url != '' THEN
          v_current_count := v_current_count + 1;
        END IF;
        IF v_profile.social_links IS NOT NULL AND v_profile.social_links != '{}'::jsonb THEN
          v_current_count := v_current_count + 1;
        END IF;

      WHEN 'apply_creator' THEN
        SELECT COUNT(*) INTO v_current_count
        FROM public.creator_applications
        WHERE user_id = p_user_id;
        IF v_profile.role IN ('creator', 'admin', 'owner') THEN
          v_current_count := GREATEST(v_current_count, 1);
        END IF;

      WHEN 'link_social' THEN
        v_current_count := 0;
        IF v_profile.social_links IS NOT NULL THEN
          IF v_req.target_entity_id IS NOT NULL AND v_req.target_entity_id != '' THEN
            IF (v_profile.social_links ? v_req.target_entity_id) AND (v_profile.social_links->>v_req.target_entity_id != '') THEN
              v_current_count := 1;
            END IF;
          ELSE
            -- Any social link
            IF (SELECT COUNT(*) FROM jsonb_object_keys(v_profile.social_links)) > 0 THEN
              v_current_count := 1;
            END IF;
          END IF;
        END IF;

      WHEN 'community_action', 'custom_check' THEN
        -- Check participant metadata for custom/community completion key
        v_community_verified := false;
        IF v_participant.metadata IS NOT NULL THEN
          v_community_verified := COALESCE((v_participant.metadata->'completed_requirements'->>v_req.id::text)::boolean, false);
        END IF;
        IF v_community_verified THEN
          v_current_count := v_req.target_count;
        ELSE
          v_current_count := 0;
        END IF;

      ELSE
        v_current_count := 0;
    END CASE;

    v_is_completed := (v_current_count >= v_req.target_count);
    IF v_is_completed THEN
      v_completed_reqs := v_completed_reqs + 1;
    END IF;

    v_req_results := v_req_results || jsonb_build_object(
      'id', v_req.id,
      'title', v_req.title,
      'description', v_req.description,
      'requirement_type', v_req.requirement_type,
      'target_count', v_req.target_count,
      'target_entity_id', v_req.target_entity_id,
      'current_count', v_current_count,
      'is_completed', v_is_completed,
      'is_required', v_req.is_required,
      'metadata', v_req.metadata
    );
  END LOOP;

  RETURN jsonb_build_object(
    'is_participant', (v_participant.id IS NOT NULL),
    'participant_status', COALESCE(v_participant.status, 'not_joined'),
    'total_requirements', v_total_reqs,
    'completed_requirements', v_completed_reqs,
    'progress_percent', CASE WHEN v_total_reqs > 0 THEN ROUND((v_completed_reqs::numeric / v_total_reqs::numeric) * 100) ELSE 100 END,
    'requirements', v_req_results
  );
END;
$$;

-- 10.5 ATOMIC CLAIM CAMPAIGN REWARD (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.claim_campaign_reward(p_campaign_reward_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_reward public.campaign_rewards;
  v_campaign public.campaigns;
  v_claim public.campaign_claims;
  v_progress JSONB;
  v_total_reqs INT;
  v_completed_reqs INT;
  v_eligible BOOLEAN := false;
  v_badge_award_res JSONB;
  v_source_title TEXT;
BEGIN
  -- 1. Must be authenticated
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to claim reward';
  END IF;

  -- 2. Lock and retrieve the reward row
  SELECT * INTO v_reward
  FROM public.campaign_rewards
  WHERE id = p_campaign_reward_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Campaign reward not found';
  END IF;

  -- 3. Retrieve campaign
  SELECT * INTO v_campaign
  FROM public.campaigns
  WHERE id = v_reward.campaign_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Associated campaign not found';
  END IF;

  -- 4. Check campaign status & dates
  IF v_campaign.status NOT IN ('published', 'active') THEN
    RAISE EXCEPTION 'Campaign is not currently active';
  END IF;

  IF v_campaign.start_date > now() THEN
    RAISE EXCEPTION 'Campaign has not started yet';
  END IF;

  IF v_campaign.end_date IS NOT NULL AND v_campaign.end_date < now() THEN
    RAISE EXCEPTION 'Campaign has ended';
  END IF;

  -- 5. Check duplicate claim
  SELECT * INTO v_claim
  FROM public.campaign_claims
  WHERE user_id = v_user_id AND campaign_reward_id = p_campaign_reward_id;

  IF FOUND THEN
    RAISE EXCEPTION 'Reward already claimed by user';
  END IF;

  -- 6. Check drop / reward claim cap
  IF v_reward.max_claims IS NOT NULL AND v_reward.claimed_count >= v_reward.max_claims THEN
    RAISE EXCEPTION 'Reward claim limit reached';
  END IF;

  -- 7. Check user eligibility
  v_progress := public.check_user_campaign_progress(v_campaign.id, v_user_id);
  v_total_reqs := (v_progress->>'total_requirements')::int;
  v_completed_reqs := (v_progress->>'completed_requirements')::int;

  IF v_reward.eligibility_type = 'all_requirements' THEN
    v_eligible := (v_completed_reqs >= v_total_reqs);
  ELSIF v_reward.eligibility_type = 'min_requirements_count' THEN
    v_eligible := (v_completed_reqs >= v_reward.min_requirements_count);
  ELSIF v_reward.eligibility_type = 'manual' THEN
    v_eligible := true; -- Managed via admin approval / participation
  END IF;

  IF NOT v_eligible THEN
    RAISE EXCEPTION 'Requirements not satisfied to claim this reward';
  END IF;

  -- 8. Auto-join campaign if not already joined
  INSERT INTO public.campaign_participants (campaign_id, user_id, joined_at, status)
  VALUES (v_campaign.id, v_user_id, now(), 'in_progress')
  ON CONFLICT (campaign_id, user_id) DO NOTHING;

  -- 9. Insert claim record
  INSERT INTO public.campaign_claims (
    campaign_id,
    campaign_reward_id,
    user_id,
    badge_id,
    claimed_at,
    status
  )
  VALUES (
    v_campaign.id,
    p_campaign_reward_id,
    v_user_id,
    v_reward.badge_id,
    now(),
    'claimed'
  )
  RETURNING * INTO v_claim;

  -- 10. Increment claimed count
  UPDATE public.campaign_rewards
  SET claimed_count = claimed_count + 1
  WHERE id = p_campaign_reward_id;

  -- 11. If reward is a badge, award badge to user
  v_source_title := v_campaign.title;
  IF v_reward.reward_type = 'badge' AND v_reward.badge_id IS NOT NULL THEN
    v_badge_award_res := public.award_user_badge(
      v_user_id,
      v_reward.badge_id,
      'campaign',
      v_campaign.id,
      v_source_title,
      'Claimed from ' || v_campaign.title
    );
  ELSIF v_reward.reward_type = 'drop' AND v_reward.badge_id IS NOT NULL THEN
    v_badge_award_res := public.award_user_badge(
      v_user_id,
      v_reward.badge_id,
      'campaign_drop',
      v_campaign.id,
      v_source_title || ' Drop',
      'Claimed limited drop from ' || v_campaign.title
    );
  END IF;

  -- 12. Send notification to user
  BEGIN
    INSERT INTO public.notifications (
      title,
      message,
      notification_type,
      recipient_id,
      recipient_user_id,
      created_by,
      is_active,
      metadata
    ) VALUES (
      'Reward Claimed: ' || v_reward.title,
      'You successfully claimed the ' || v_reward.title || ' from ' || v_campaign.title || '!',
      'private',
      v_user_id,
      v_user_id,
      COALESCE(auth.uid(), '9d5d6287-1843-4cd0-afee-fc1830411571'::uuid),
      true,
      jsonb_build_object(
        'type', 'reward_claimed',
        'campaign_id', v_campaign.id,
        'reward_id', v_reward.id,
        'reward_title', v_reward.title,
        'reward_type', v_reward.reward_type
      )
    );
  EXCEPTION WHEN OTHERS THEN
  END;

  -- 13. Audit log
  BEGIN
    INSERT INTO public.activity_logs (
      actor_user_id,
      action,
      target_type,
      target_id,
      details
    ) VALUES (
      v_user_id,
      'campaign_reward_claimed',
      'campaign_reward',
      p_campaign_reward_id::text,
      jsonb_build_object(
        'campaign_id', v_campaign.id,
        'campaign_title', v_campaign.title,
        'reward_title', v_reward.title,
        'reward_type', v_reward.reward_type
      )
    );
  EXCEPTION WHEN OTHERS THEN
  END;

  RETURN jsonb_build_object(
    'success', true,
    'claim_id', v_claim.id,
    'reward_id', v_reward.id,
    'reward_title', v_reward.title,
    'reward_type', v_reward.reward_type,
    'badge_awarded', (v_reward.badge_id IS NOT NULL),
    'badge_id', v_reward.badge_id
  );
END;
$$;

-- 10.6 RECORD COMMUNITY ACTION VERIFICATION
CREATE OR REPLACE FUNCTION public.verify_user_campaign_requirement(
  p_campaign_id      UUID,
  p_requirement_id   UUID,
  p_user_id          UUID DEFAULT auth.uid()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_participant public.campaign_participants;
  v_metadata JSONB;
  v_completed_map JSONB;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Auto-join if not joined
  INSERT INTO public.campaign_participants (campaign_id, user_id, joined_at, status, metadata)
  VALUES (p_campaign_id, p_user_id, now(), 'in_progress', '{}'::jsonb)
  ON CONFLICT (campaign_id, user_id) DO NOTHING;

  SELECT * INTO v_participant
  FROM public.campaign_participants
  WHERE campaign_id = p_campaign_id AND user_id = p_user_id;

  v_metadata := COALESCE(v_participant.metadata, '{}'::jsonb);
  v_completed_map := COALESCE(v_metadata->'completed_requirements', '{}'::jsonb);
  v_completed_map := jsonb_set(v_completed_map, ARRAY[p_requirement_id::text], 'true'::jsonb, true);
  v_metadata := jsonb_set(v_metadata, '{completed_requirements}', v_completed_map, true);

  UPDATE public.campaign_participants
  SET metadata = v_metadata
  WHERE campaign_id = p_campaign_id AND user_id = p_user_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 10.7 CAMPAIGN ANALYTICS (ADMIN)
CREATE OR REPLACE FUNCTION public.get_campaign_analytics(p_campaign_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_participants_count INT;
  v_completed_count INT;
  v_claims_count INT;
  v_total_drops_claimed INT;
  v_badges_awarded INT;
BEGIN
  IF NOT (public.is_owner() OR public.is_admin()) THEN
    RAISE EXCEPTION 'Access denied: only Owner or Admin can view campaign analytics';
  END IF;

  SELECT COUNT(*) INTO v_participants_count
  FROM public.campaign_participants
  WHERE campaign_id = p_campaign_id;

  SELECT COUNT(*) INTO v_completed_count
  FROM public.campaign_participants
  WHERE campaign_id = p_campaign_id AND status = 'completed';

  SELECT COUNT(*) INTO v_claims_count
  FROM public.campaign_claims
  WHERE campaign_id = p_campaign_id;

  SELECT COALESCE(SUM(claimed_count), 0) INTO v_total_drops_claimed
  FROM public.campaign_rewards
  WHERE campaign_id = p_campaign_id AND reward_type = 'drop';

  SELECT COUNT(*) INTO v_badges_awarded
  FROM public.campaign_claims
  WHERE campaign_id = p_campaign_id AND badge_id IS NOT NULL;

  RETURN jsonb_build_object(
    'participants_count', v_participants_count,
    'completed_count', v_completed_count,
    'claims_count', v_claims_count,
    'drops_claimed', v_total_drops_claimed,
    'badges_awarded', v_badges_awarded,
    'completion_rate', CASE WHEN v_participants_count > 0 THEN ROUND((v_completed_count::numeric / v_participants_count::numeric) * 100, 1) ELSE 0 END
  );
END;
$$;

-- 10.8 ADMIN MANUAL GRANT REWARD
CREATE OR REPLACE FUNCTION public.admin_manual_grant_reward(
  p_campaign_reward_id UUID,
  p_user_id            UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reward public.campaign_rewards;
  v_campaign public.campaigns;
  v_claim public.campaign_claims;
  v_badge_award_res JSONB;
BEGIN
  IF NOT (public.is_owner() OR public.is_admin()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT * INTO v_reward FROM public.campaign_rewards WHERE id = p_campaign_reward_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reward not found'; END IF;

  SELECT * INTO v_campaign FROM public.campaigns WHERE id = v_reward.campaign_id;

  -- Ensure participant
  INSERT INTO public.campaign_participants (campaign_id, user_id, joined_at, status)
  VALUES (v_campaign.id, p_user_id, now(), 'in_progress')
  ON CONFLICT (campaign_id, user_id) DO NOTHING;

  -- Insert claim
  INSERT INTO public.campaign_claims (
    campaign_id,
    campaign_reward_id,
    user_id,
    badge_id,
    claimed_at,
    status,
    metadata
  )
  VALUES (
    v_campaign.id,
    p_campaign_reward_id,
    p_user_id,
    v_reward.badge_id,
    now(),
    'claimed',
    jsonb_build_object('granted_by', auth.uid(), 'manual', true)
  )
  ON CONFLICT (user_id, campaign_reward_id) DO UPDATE SET status = 'claimed'
  RETURNING * INTO v_claim;

  -- Update count
  UPDATE public.campaign_rewards SET claimed_count = claimed_count + 1 WHERE id = p_campaign_reward_id;

  -- Award badge if applicable
  IF v_reward.badge_id IS NOT NULL THEN
    v_badge_award_res := public.award_user_badge(
      p_user_id,
      v_reward.badge_id,
      'campaign',
      v_campaign.id,
      v_campaign.title,
      'Manually granted by admin'
    );
  END IF;

  RETURN jsonb_build_object('success', true, 'claim_id', v_claim.id);
END;
$$;

-- 10.9 ADMIN REVOKE CLAIM
CREATE OR REPLACE FUNCTION public.admin_revoke_claim(p_claim_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_claim public.campaign_claims;
BEGIN
  IF NOT (public.is_owner() OR public.is_admin()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT * INTO v_claim FROM public.campaign_claims WHERE id = p_claim_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Claim not found'; END IF;

  DELETE FROM public.campaign_claims WHERE id = p_claim_id;

  -- Decrement count
  UPDATE public.campaign_rewards
  SET claimed_count = GREATEST(claimed_count - 1, 0)
  WHERE id = v_claim.campaign_reward_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ── 11. SEED DEFAULT ISOMER BADGES ──────────────────────────────────────────
INSERT INTO public.badges (name, slug, description, icon_url, category, rarity, color_theme, is_active)
VALUES
  ('Explorer', 'explorer', 'Awarded for active exploration and engagement across ISOMER projects and community discoveries.', 'compass', 'community', 'common', 'emerald', true),
  ('Early Supporter', 'early-supporter', 'Pioneered the early stages of ISOMER LAB development and provided foundational support.', 'zap', 'special_event', 'rare', 'purple', true),
  ('Master Creator', 'master-creator', 'Demonstrated exceptional craftsmanship, publishing innovative projects that push technical boundaries.', 'sparkles', 'creator', 'epic', 'amber', true),
  ('Genesis Pioneer', 'genesis-pioneer', 'Elite participant in inaugural ISOMER ecosystem campaigns and community drops.', 'crown', 'achievement', 'legendary', 'cyan', true)
ON CONFLICT (slug) DO NOTHING;

-- ── 12. NOTIFY SCHEMA CACHE RELOAD ───────────────────────────────────────────
NOTIFY pgrst, 'reload schema';

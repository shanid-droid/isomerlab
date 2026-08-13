-- ============================================================================
-- ISOMER MIGRATION: CREATOR ROLE, APPLICATIONS, MAINTENANCE MODE
-- ============================================================================
-- Prerequisites (from prior migrations — NOT recreated here):
--   public.profiles, public.projects, public.project_gallery
--   public.activity_logs, public.insert_activity_log()
--   public.is_owner(), public.is_admin()
--   projects.created_by UUID, projects.published BOOLEAN
-- Owner UUID: 9d5d6287-1843-4cd0-afee-fc1830411571 (role remains 'admin')
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. PROFILES: creator tracking columns + extended role CHECK
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS creator_approved_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_project_uploaded_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS creator_requirement_status TEXT DEFAULT NULL;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('user', 'admin', 'creator'));

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_creator_requirement_status_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_creator_requirement_status_check
  CHECK (
    creator_requirement_status IS NULL
    OR creator_requirement_status IN ('pending', 'completed', 'review_required')
  );

-- ---------------------------------------------------------------------------
-- 2. HELPER: is_creator()  (does NOT replace is_owner / is_admin)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_creator()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'creator'
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. CREATOR APPLICATIONS TABLE
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.creator_applications (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name        TEXT        NOT NULL,
  age              INTEGER     NOT NULL,
  profession       TEXT        NOT NULL,
  applicant_role   TEXT        NOT NULL,
  bio              TEXT        NOT NULL,
  skills           TEXT        NOT NULL,
  education        TEXT,
  location         TEXT,
  github_url       TEXT,
  portfolio_url    TEXT,
  linkedin_url     TEXT,
  other_url        TEXT,
  motivation       TEXT        NOT NULL,
  project_types    TEXT        NOT NULL,
  status           TEXT        NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at      TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_creator_applications_user_id
  ON public.creator_applications (user_id);

CREATE INDEX IF NOT EXISTS idx_creator_applications_status
  ON public.creator_applications (status);

CREATE INDEX IF NOT EXISTS idx_creator_applications_created_at
  ON public.creator_applications (created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_creator_applications_one_pending_per_user
  ON public.creator_applications (user_id)
  WHERE status = 'pending';

CREATE OR REPLACE FUNCTION public.set_creator_application_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_creator_applications_updated_at ON public.creator_applications;

CREATE TRIGGER trg_creator_applications_updated_at
  BEFORE UPDATE ON public.creator_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.set_creator_application_updated_at();

-- ---------------------------------------------------------------------------
-- 4. SITE SETTINGS TABLE (maintenance mode)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.site_settings (
  id                  INTEGER     PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  maintenance_mode    BOOLEAN     NOT NULL DEFAULT false,
  maintenance_message TEXT        DEFAULT 'ISOMER LAB is currently under maintenance.',
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by          UUID        REFERENCES auth.users(id) ON DELETE SET NULL
);

INSERT INTO public.site_settings (id, maintenance_mode, maintenance_message)
VALUES (1, false, 'ISOMER LAB is currently under maintenance.')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 5. RLS: creator_applications
-- ---------------------------------------------------------------------------

ALTER TABLE public.creator_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users insert own creator application" ON public.creator_applications;
DROP POLICY IF EXISTS "Users view own creator applications" ON public.creator_applications;
DROP POLICY IF EXISTS "Owner admin view all creator applications" ON public.creator_applications;

CREATE POLICY "Users insert own creator application"
  ON public.creator_applications
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND status = 'pending'
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'creator')
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.creator_applications ca
      WHERE ca.user_id = auth.uid()
        AND ca.status = 'pending'
    )
  );

CREATE POLICY "Users view own creator applications"
  ON public.creator_applications
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR public.is_owner()
    OR public.is_admin()
  );

-- No client UPDATE/DELETE policies — review handled by review_creator_application RPC

-- ---------------------------------------------------------------------------
-- 6. RLS: site_settings (read-only for clients; writes via RPC)
-- ---------------------------------------------------------------------------

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read site settings" ON public.site_settings;
DROP POLICY IF EXISTS "Owner updates site settings" ON public.site_settings;

CREATE POLICY "Anyone can read site settings"
  ON public.site_settings
  FOR SELECT
  USING (true);

-- ---------------------------------------------------------------------------
-- 7. RLS: projects (extend existing Owner/Admin rules with Creator ownership)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Public view published projects, owner views all, admins view own" ON public.projects;
DROP POLICY IF EXISTS "Admins insert own projects" ON public.projects;
DROP POLICY IF EXISTS "Owner updates all, admins update own projects" ON public.projects;
DROP POLICY IF EXISTS "Owner deletes all, admins delete own projects" ON public.projects;

CREATE POLICY "Public view published projects, owner views all, admins view own"
  ON public.projects
  FOR SELECT
  USING (
    published = true
    OR public.is_owner()
    OR (public.is_admin() AND created_by = auth.uid())
    OR (public.is_creator() AND created_by = auth.uid())
  );

CREATE POLICY "Admins insert own projects"
  ON public.projects
  FOR INSERT
  WITH CHECK (
    (public.is_admin() OR public.is_creator())
    AND COALESCE(created_by, auth.uid()) = auth.uid()
  );

CREATE POLICY "Owner updates all, admins update own projects"
  ON public.projects
  FOR UPDATE
  USING (
    public.is_owner()
    OR (public.is_admin() AND created_by = auth.uid())
    OR (public.is_creator() AND created_by = auth.uid())
  )
  WITH CHECK (
    public.is_owner()
    OR (public.is_admin() AND created_by = auth.uid())
    OR (public.is_creator() AND created_by = auth.uid())
  );

CREATE POLICY "Owner deletes all, admins delete own projects"
  ON public.projects
  FOR DELETE
  USING (
    public.is_owner()
    OR (public.is_admin() AND created_by = auth.uid())
    OR (public.is_creator() AND created_by = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 8. RLS: project_gallery (extend existing Owner/Admin rules with Creator)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Public view gallery or owner view all or admins view own" ON public.project_gallery;
DROP POLICY IF EXISTS "Owner or admin inserts gallery for owned projects" ON public.project_gallery;
DROP POLICY IF EXISTS "Owner or admin updates gallery for owned projects" ON public.project_gallery;
DROP POLICY IF EXISTS "Owner or admin deletes gallery for owned projects" ON public.project_gallery;

CREATE POLICY "Public view gallery or owner view all or admins view own"
  ON public.project_gallery
  FOR SELECT
  USING (
    public.is_owner()
    OR EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = project_gallery.project_id
        AND (
          projects.published = true
          OR (public.is_admin() AND projects.created_by = auth.uid())
          OR (public.is_creator() AND projects.created_by = auth.uid())
        )
    )
  );

CREATE POLICY "Owner or admin inserts gallery for owned projects"
  ON public.project_gallery
  FOR INSERT
  WITH CHECK (
    public.is_owner()
    OR (
      (public.is_admin() OR public.is_creator())
      AND EXISTS (
        SELECT 1 FROM public.projects
        WHERE projects.id = project_gallery.project_id
          AND projects.created_by = auth.uid()
      )
    )
  );

CREATE POLICY "Owner or admin updates gallery for owned projects"
  ON public.project_gallery
  FOR UPDATE
  USING (
    public.is_owner()
    OR (
      (public.is_admin() OR public.is_creator())
      AND EXISTS (
        SELECT 1 FROM public.projects
        WHERE projects.id = project_gallery.project_id
          AND projects.created_by = auth.uid()
      )
    )
  )
  WITH CHECK (
    public.is_owner()
    OR (
      (public.is_admin() OR public.is_creator())
      AND EXISTS (
        SELECT 1 FROM public.projects
        WHERE projects.id = project_gallery.project_id
          AND projects.created_by = auth.uid()
      )
    )
  );

CREATE POLICY "Owner or admin deletes gallery for owned projects"
  ON public.project_gallery
  FOR DELETE
  USING (
    public.is_owner()
    OR (
      (public.is_admin() OR public.is_creator())
      AND EXISTS (
        SELECT 1 FROM public.projects
        WHERE projects.id = project_gallery.project_id
          AND projects.created_by = auth.uid()
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 9. ACTIVITY LOG TRIGGERS
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.trg_log_creator_application_submitted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.insert_activity_log(
    NEW.user_id,
    'creator_application_submitted',
    'creator_application',
    NEW.id::text,
    jsonb_build_object(
      'full_name', NEW.full_name,
      'profession', NEW.profession
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_creator_application_submitted ON public.creator_applications;

CREATE TRIGGER trg_creator_application_submitted
  AFTER INSERT ON public.creator_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_log_creator_application_submitted();

CREATE OR REPLACE FUNCTION public.trg_handle_creator_first_project()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = NEW.created_by
      AND role = 'creator'
  ) THEN
    RETURN NEW;
  END IF;

  PERFORM public.insert_activity_log(
    NEW.created_by,
    'creator_project_uploaded',
    'project',
    NEW.id::text,
    jsonb_build_object('title', NEW.title)
  );

  UPDATE public.profiles
  SET
    first_project_uploaded_at = COALESCE(first_project_uploaded_at, now()),
    creator_requirement_status = 'completed',
    updated_at = now()
  WHERE id = NEW.created_by
    AND first_project_uploaded_at IS NULL;

  IF FOUND THEN
    PERFORM public.insert_activity_log(
      NEW.created_by,
      'creator_requirement_completed',
      'profile',
      NEW.created_by::text,
      jsonb_build_object(
        'project_id', NEW.id,
        'title', NEW.title
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_creator_first_project ON public.projects;

CREATE TRIGGER trg_creator_first_project
  AFTER INSERT ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_handle_creator_first_project();

-- ---------------------------------------------------------------------------
-- 10. RPC: review_creator_application (Owner / Admin only)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.review_creator_application(
  p_application_id   UUID,
  p_action           TEXT,
  p_rejection_reason TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_app public.creator_applications%ROWTYPE;
BEGIN
  IF NOT (public.is_owner() OR public.is_admin()) THEN
    RAISE EXCEPTION 'Access denied: insufficient permissions';
  END IF;

  IF p_action NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'Invalid action: must be approve or reject';
  END IF;

  SELECT *
  INTO v_app
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
      updated_at = now()
    WHERE id = v_app.user_id
      AND id <> '9d5d6287-1843-4cd0-afee-fc1830411571'::uuid;

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
      jsonb_build_object(
        'applicant_id', v_app.user_id,
        'full_name', v_app.full_name
      )
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
$$;

REVOKE ALL ON FUNCTION public.review_creator_application(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_creator_application(UUID, TEXT, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- 11. RPC: set_maintenance_mode (Owner only)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_maintenance_mode(
  p_enabled BOOLEAN,
  p_message   TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_owner() THEN
    RAISE EXCEPTION 'Access denied: only the system owner can change maintenance mode';
  END IF;

  UPDATE public.site_settings
  SET
    maintenance_mode = p_enabled,
    maintenance_message = COALESCE(
      NULLIF(trim(p_message), ''),
      maintenance_message,
      'ISOMER LAB is currently under maintenance.'
    ),
    updated_at = now(),
    updated_by = auth.uid()
  WHERE id = 1;

  IF NOT FOUND THEN
    INSERT INTO public.site_settings (id, maintenance_mode, maintenance_message, updated_by)
    VALUES (
      1,
      p_enabled,
      COALESCE(NULLIF(trim(p_message), ''), 'ISOMER LAB is currently under maintenance.'),
      auth.uid()
    );
  END IF;

  PERFORM public.insert_activity_log(
    auth.uid(),
    CASE WHEN p_enabled THEN 'maintenance_mode_enabled' ELSE 'maintenance_mode_disabled' END,
    'site_settings',
    '1',
    jsonb_build_object(
      'maintenance_mode', p_enabled,
      'maintenance_message', COALESCE(NULLIF(trim(p_message), ''), 'unchanged')
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_maintenance_mode(BOOLEAN, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_maintenance_mode(BOOLEAN, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- 12. RPC: sync_creator_requirement_status (marks review_required after 2 days)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.sync_creator_requirement_status()
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
BEGIN
  SELECT *
  INTO v_profile
  FROM public.profiles
  WHERE id = auth.uid();

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_profile.role <> 'creator' THEN
    RETURN v_profile;
  END IF;

  IF v_profile.first_project_uploaded_at IS NOT NULL THEN
    IF v_profile.creator_requirement_status IS DISTINCT FROM 'completed' THEN
      UPDATE public.profiles
      SET creator_requirement_status = 'completed', updated_at = now()
      WHERE id = auth.uid()
      RETURNING * INTO v_profile;
    END IF;
    RETURN v_profile;
  END IF;

  IF v_profile.creator_approved_at IS NOT NULL
     AND v_profile.creator_approved_at + interval '2 days' < now()
     AND v_profile.creator_requirement_status = 'pending'
  THEN
    UPDATE public.profiles
    SET creator_requirement_status = 'review_required', updated_at = now()
    WHERE id = auth.uid()
    RETURNING * INTO v_profile;
  END IF;

  RETURN v_profile;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_creator_requirement_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_creator_requirement_status() TO authenticated;

-- ---------------------------------------------------------------------------
-- 13. GRANTS
-- ---------------------------------------------------------------------------

GRANT SELECT, INSERT ON public.creator_applications TO authenticated;
GRANT SELECT ON public.site_settings TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- ISOMER MIGRATION: CONTACT INBOX + OWNER-ONLY ACTIVITY LOGS
-- ============================================================================
-- Creates:
--   • public.contact_messages  — visitor contact form submissions
--   • public.activity_logs     — owner-only security & application audit trail
--
-- Security:
--   • Reuses existing public.is_owner() — no new owner UUID
--   • Anonymous INSERT on contact_messages only
--   • Owner-only SELECT/UPDATE/DELETE on both tables
--   • Activity log INSERT via SECURITY DEFINER functions/triggers only
--   • Does NOT modify existing profiles/projects RLS policies
-- ============================================================================

-- ── 1. CONTACT MESSAGES TABLE ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.contact_messages (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL,
  email      TEXT        NOT NULL,
  subject    TEXT,
  message    TEXT        NOT NULL,
  status     TEXT        NOT NULL DEFAULT 'unread'
                         CHECK (status IN ('unread', 'read', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contact_messages_status
  ON public.contact_messages (status);

CREATE INDEX IF NOT EXISTS idx_contact_messages_created_at
  ON public.contact_messages (created_at DESC);

-- Auto-update updated_at on row changes
CREATE OR REPLACE FUNCTION public.set_contact_message_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_contact_messages_updated_at ON public.contact_messages;
CREATE TRIGGER trg_contact_messages_updated_at
  BEFORE UPDATE ON public.contact_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.set_contact_message_updated_at();


-- ── 2. ACTIVITY LOGS TABLE ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.activity_logs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID        NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  action        TEXT        NOT NULL,
  target_type   TEXT,
  target_id     TEXT,
  details       JSONB       DEFAULT '{}'::jsonb,
  ip_address    INET        NULL,
  user_agent    TEXT        NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at
  ON public.activity_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_logs_action
  ON public.activity_logs (action);

CREATE INDEX IF NOT EXISTS idx_activity_logs_target
  ON public.activity_logs (target_type, target_id);


-- ── 3. SECURE ACTIVITY LOG INSERT HELPER (trigger-only) ─────────────────────

CREATE OR REPLACE FUNCTION public.insert_activity_log(
  p_actor_user_id UUID,
  p_action        TEXT,
  p_target_type   TEXT    DEFAULT NULL,
  p_target_id     TEXT    DEFAULT NULL,
  p_details       JSONB   DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.activity_logs (actor_user_id, action, target_type, target_id, details)
  VALUES (p_actor_user_id, p_action, p_target_type, p_target_id, p_details);
END;
$$;

REVOKE ALL ON FUNCTION public.insert_activity_log FROM PUBLIC;


-- ── 4. CLIENT AUTH EVENT LOGGER (whitelisted actions only) ──────────────────
-- Allows authenticated/anon clients to log auth events safely.
-- Never trusts client-provided actor_user_id — uses auth.uid() only.
-- Strips sensitive fields from details.

CREATE OR REPLACE FUNCTION public.log_client_auth_event(
  p_action  TEXT,
  p_details JSONB DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sanitized JSONB := '{}'::jsonb;
BEGIN
  IF p_action NOT IN (
    'user_login',
    'user_logout',
    'user_registered',
    'google_oauth_registration',
    'google_oauth_login',
    'failed_login'
  ) THEN
    RETURN;
  END IF;

  IF p_details ? 'email' THEN
    v_sanitized := v_sanitized || jsonb_build_object(
      'email', left(p_details->>'email', 255)
    );
  END IF;
  IF p_details ? 'provider' THEN
    v_sanitized := v_sanitized || jsonb_build_object(
      'provider', left(p_details->>'provider', 50)
    );
  END IF;
  IF p_details ? 'method' THEN
    v_sanitized := v_sanitized || jsonb_build_object(
      'method', left(p_details->>'method', 50)
    );
  END IF;

  INSERT INTO public.activity_logs (actor_user_id, action, target_type, details)
  VALUES (auth.uid(), p_action, 'auth', v_sanitized);
END;
$$;

REVOKE ALL ON FUNCTION public.log_client_auth_event FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_client_auth_event TO anon, authenticated;


-- ── 5. DATABASE TRIGGERS FOR AUTOMATIC AUDIT LOGGING ─────────────────────────

-- 5a. Profile created
CREATE OR REPLACE FUNCTION public.log_profile_created()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.insert_activity_log(
    NEW.id,
    'profile_created',
    'profile',
    NEW.id::text,
    jsonb_build_object('email', NEW.email, 'full_name', NEW.full_name)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_log_profile_created ON public.profiles;
CREATE TRIGGER trg_log_profile_created
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.log_profile_created();


-- 5b. Profile updated (role changes, avatar, general updates)
CREATE OR REPLACE FUNCTION public.log_profile_updated()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    PERFORM public.insert_activity_log(
      auth.uid(),
      CASE
        WHEN NEW.role = 'admin' THEN 'user_promoted_to_admin'
        WHEN OLD.role = 'admin' THEN 'user_demoted'
        ELSE 'user_role_changed'
      END,
      'profile',
      NEW.id::text,
      jsonb_build_object(
        'email',       NEW.email,
        'full_name',   NEW.full_name,
        'old_role',    OLD.role,
        'new_role',    NEW.role
      )
    );
  END IF;

  IF OLD.avatar_url IS DISTINCT FROM NEW.avatar_url THEN
    PERFORM public.insert_activity_log(
      auth.uid(),
      'avatar_updated',
      'profile',
      NEW.id::text,
      jsonb_build_object('email', NEW.email, 'full_name', NEW.full_name)
    );
  END IF;

  IF (OLD.full_name  IS DISTINCT FROM NEW.full_name  OR
      OLD.bio        IS DISTINCT FROM NEW.bio        OR
      OLD.about      IS DISTINCT FROM NEW.about      OR
      OLD.social_links IS DISTINCT FROM NEW.social_links OR
      OLD.email      IS DISTINCT FROM NEW.email)     AND
     (OLD.role = NEW.role AND OLD.avatar_url IS NOT DISTINCT FROM NEW.avatar_url)
  THEN
    PERFORM public.insert_activity_log(
      auth.uid(),
      'profile_updated',
      'profile',
      NEW.id::text,
      jsonb_build_object('email', NEW.email, 'full_name', NEW.full_name)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_log_profile_updated ON public.profiles;
CREATE TRIGGER trg_log_profile_updated
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.log_profile_updated();


-- 5c. Project events
CREATE OR REPLACE FUNCTION public.log_project_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.insert_activity_log(
      auth.uid(),
      'project_created',
      'project',
      NEW.id::text,
      jsonb_build_object(
        'title',     NEW.title,
        'slug',      NEW.slug,
        'published', NEW.published
      )
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.published IS DISTINCT FROM NEW.published THEN
      PERFORM public.insert_activity_log(
        auth.uid(),
        CASE WHEN NEW.published THEN 'project_published' ELSE 'project_unpublished' END,
        'project',
        NEW.id::text,
        jsonb_build_object('title', NEW.title, 'slug', NEW.slug)
      );
    END IF;

    IF (OLD.title       IS DISTINCT FROM NEW.title       OR
        OLD.description IS DISTINCT FROM NEW.description OR
        OLD.slug        IS DISTINCT FROM NEW.slug        OR
        OLD.thumbnail_url IS DISTINCT FROM NEW.thumbnail_url OR
        OLD.components  IS DISTINCT FROM NEW.components  OR
        OLD.github_url  IS DISTINCT FROM NEW.github_url) AND
       OLD.published IS NOT DISTINCT FROM NEW.published
    THEN
      PERFORM public.insert_activity_log(
        auth.uid(),
        'project_updated',
        'project',
        NEW.id::text,
        jsonb_build_object('title', NEW.title, 'slug', NEW.slug)
      );
    END IF;

    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    PERFORM public.insert_activity_log(
      auth.uid(),
      'project_deleted',
      'project',
      OLD.id::text,
      jsonb_build_object('title', OLD.title, 'slug', OLD.slug)
    );
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_log_project_changes ON public.projects;
CREATE TRIGGER trg_log_project_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.log_project_changes();


-- 5d. Contact message events
CREATE OR REPLACE FUNCTION public.log_contact_message_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.insert_activity_log(
      NULL,
      'contact_form_submitted',
      'contact_message',
      NEW.id::text,
      jsonb_build_object(
        'name',    NEW.name,
        'email',   NEW.email,
        'subject', NEW.subject
      )
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      PERFORM public.insert_activity_log(
        auth.uid(),
        CASE NEW.status
          WHEN 'read'     THEN 'contact_message_read'
          WHEN 'archived' THEN 'contact_message_archived'
          WHEN 'unread'   THEN 'contact_message_unread'
          ELSE 'contact_message_status_changed'
        END,
        'contact_message',
        NEW.id::text,
        jsonb_build_object(
          'name',       NEW.name,
          'email',      NEW.email,
          'subject',    NEW.subject,
          'old_status', OLD.status,
          'new_status', NEW.status
        )
      );
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    PERFORM public.insert_activity_log(
      auth.uid(),
      'contact_message_deleted',
      'contact_message',
      OLD.id::text,
      jsonb_build_object(
        'name',    OLD.name,
        'email',   OLD.email,
        'subject', OLD.subject
      )
    );
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_log_contact_message_changes ON public.contact_messages;
CREATE TRIGGER trg_log_contact_message_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.contact_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.log_contact_message_changes();


-- ── 6. ROW LEVEL SECURITY ───────────────────────────────────────────────────

ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs   ENABLE ROW LEVEL SECURITY;

-- contact_messages policies
DROP POLICY IF EXISTS "Anyone can submit contact messages"  ON public.contact_messages;
DROP POLICY IF EXISTS "Owner can view contact messages"       ON public.contact_messages;
DROP POLICY IF EXISTS "Owner can update contact messages"     ON public.contact_messages;
DROP POLICY IF EXISTS "Owner can delete contact messages"     ON public.contact_messages;

CREATE POLICY "Anyone can submit contact messages"
  ON public.contact_messages FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Owner can view contact messages"
  ON public.contact_messages FOR SELECT
  USING (public.is_owner());

CREATE POLICY "Owner can update contact messages"
  ON public.contact_messages FOR UPDATE
  USING (public.is_owner())
  WITH CHECK (public.is_owner());

CREATE POLICY "Owner can delete contact messages"
  ON public.contact_messages FOR DELETE
  USING (public.is_owner());

-- activity_logs policies — owner-only read/write, no public INSERT
DROP POLICY IF EXISTS "Owner can view activity logs"   ON public.activity_logs;
DROP POLICY IF EXISTS "Owner can update activity logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Owner can delete activity logs" ON public.activity_logs;

CREATE POLICY "Owner can view activity logs"
  ON public.activity_logs FOR SELECT
  USING (public.is_owner());

CREATE POLICY "Owner can update activity logs"
  ON public.activity_logs FOR UPDATE
  USING (public.is_owner())
  WITH CHECK (public.is_owner());

CREATE POLICY "Owner can delete activity logs"
  ON public.activity_logs FOR DELETE
  USING (public.is_owner());


-- ── 7. Reload PostgREST schema cache ─────────────────────────────────────────
NOTIFY pgrst, 'reload schema';

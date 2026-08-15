-- ============================================================================
-- ISOMER: NOTIFICATION SYSTEM
-- ============================================================================
-- Prerequisites:
--   public.profiles, auth.users,
--   public.is_owner(), public.is_admin(), public.is_creator(),
--   public.insert_activity_log()
-- Owner UUID: 9d5d6287-1843-4cd0-afee-fc1830411571
--
-- Creates:
--   • public.notifications        — notification records (3 audience types)
--   • public.notification_reads   — per-user read tracking
--   • 5 SECURITY DEFINER RPCs
--
-- Safe / idempotent: uses CREATE TABLE IF NOT EXISTS, DROP POLICY IF EXISTS,
-- CREATE OR REPLACE FUNCTION, CREATE INDEX IF NOT EXISTS.
-- ============================================================================

-- ── 1. NOTIFICATIONS TABLE ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.notifications (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title             TEXT        NOT NULL,
  message           TEXT        NOT NULL,
  notification_type TEXT        NOT NULL
                                CHECK (notification_type IN ('public', 'private', 'all_creators')),
  recipient_user_id UUID        NULL
                                REFERENCES auth.users(id)
                                ON DELETE CASCADE,
  created_by        UUID        NOT NULL
                                REFERENCES auth.users(id)
                                ON DELETE SET NULL
                                DEFERRABLE INITIALLY DEFERRED,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at        TIMESTAMPTZ NULL,
  is_active         BOOLEAN     NOT NULL DEFAULT true,
  metadata          JSONB       NOT NULL DEFAULT '{}'::jsonb,

  -- recipient_user_id must be set iff notification_type = 'private'
  CONSTRAINT chk_notification_recipient CHECK (
    (notification_type = 'private'      AND recipient_user_id IS NOT NULL)
    OR
    (notification_type <> 'private'     AND recipient_user_id IS NULL)
  )
);

-- Useful indexes
CREATE INDEX IF NOT EXISTS idx_notifications_created_at
  ON public.notifications (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_type
  ON public.notifications (notification_type);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient
  ON public.notifications (recipient_user_id)
  WHERE recipient_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_is_active
  ON public.notifications (is_active);

CREATE INDEX IF NOT EXISTS idx_notifications_expires_at
  ON public.notifications (expires_at)
  WHERE expires_at IS NOT NULL;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_notification_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $fn$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_notifications_updated_at ON public.notifications;
CREATE TRIGGER trg_notifications_updated_at
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.set_notification_updated_at();


-- ── 2. NOTIFICATION_READS TABLE ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.notification_reads (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID        NOT NULL
                              REFERENCES public.notifications(id)
                              ON DELETE CASCADE,
  user_id         UUID        NOT NULL
                              REFERENCES auth.users(id)
                              ON DELETE CASCADE,
  read_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (notification_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_notification_reads_user_id
  ON public.notification_reads (user_id);

CREATE INDEX IF NOT EXISTS idx_notification_reads_notification_id
  ON public.notification_reads (notification_id);


-- ── 3. RLS — NOTIFICATIONS ──────────────────────────────────────────────────

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Drop any stale policies
DROP POLICY IF EXISTS "Anon can read active public notifications"    ON public.notifications;
DROP POLICY IF EXISTS "Auth users read their visible notifications"  ON public.notifications;
DROP POLICY IF EXISTS "Owner admin insert notifications"             ON public.notifications;
DROP POLICY IF EXISTS "Owner admin update notifications"             ON public.notifications;
DROP POLICY IF EXISTS "Owner admin delete notifications"             ON public.notifications;

-- Anonymous: only active, non-expired public notifications
CREATE POLICY "Anon can read active public notifications"
  ON public.notifications
  FOR SELECT
  TO anon
  USING (
    notification_type = 'public'
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now())
  );

-- Authenticated: own visibility rules
CREATE POLICY "Auth users read their visible notifications"
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (
    -- Owner and Admin see all
    public.is_owner()
    OR public.is_admin()
    -- Active + not expired guard for everyone else
    OR (
      is_active = true
      AND (expires_at IS NULL OR expires_at > now())
      AND (
        notification_type = 'public'
        OR (
          notification_type = 'private'
          AND recipient_user_id = auth.uid()
        )
        OR (
          notification_type = 'all_creators'
          AND public.is_creator()
        )
      )
    )
  );

-- Only owner/admin can insert (belt-and-suspenders; main enforcement is via RPC)
CREATE POLICY "Owner admin insert notifications"
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_owner() OR public.is_admin()
  );

-- Only owner/admin can update
CREATE POLICY "Owner admin update notifications"
  ON public.notifications
  FOR UPDATE
  TO authenticated
  USING (
    public.is_owner() OR public.is_admin()
  )
  WITH CHECK (
    public.is_owner() OR public.is_admin()
  );

-- Only owner/admin can delete
CREATE POLICY "Owner admin delete notifications"
  ON public.notifications
  FOR DELETE
  TO authenticated
  USING (
    public.is_owner() OR public.is_admin()
  );


-- ── 4. RLS — NOTIFICATION_READS ─────────────────────────────────────────────

ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own notification reads"   ON public.notification_reads;
DROP POLICY IF EXISTS "Users insert own notification reads" ON public.notification_reads;
DROP POLICY IF EXISTS "Owner admin read all notification reads" ON public.notification_reads;

-- Users can see their own read records
CREATE POLICY "Users read own notification reads"
  ON public.notification_reads
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_owner()
    OR public.is_admin()
  );

-- Users can only insert reads for themselves
CREATE POLICY "Users insert own notification reads"
  ON public.notification_reads
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
  );

-- No UPDATE/DELETE on reads (immutable)


-- ── 5. SECURITY DEFINER RPC: create_notification ────────────────────────────

CREATE OR REPLACE FUNCTION public.create_notification(
  p_title             TEXT,
  p_message           TEXT,
  p_notification_type TEXT,
  p_recipient_user_id UUID        DEFAULT NULL,
  p_expires_at        TIMESTAMPTZ DEFAULT NULL,
  p_metadata          JSONB       DEFAULT '{}'::jsonb
)
RETURNS public.notifications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_notification public.notifications;
BEGIN
  -- 1. Must be authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- 2. Must be owner or admin
  IF NOT (public.is_owner() OR public.is_admin()) THEN
    RAISE EXCEPTION 'Access denied: only Owner or Admin can send notifications';
  END IF;

  -- 3. Validate notification type
  IF p_notification_type NOT IN ('public', 'private', 'all_creators') THEN
    RAISE EXCEPTION 'Invalid notification_type: must be public, private, or all_creators';
  END IF;

  -- 4. Validate recipient requirements
  IF p_notification_type = 'private' AND p_recipient_user_id IS NULL THEN
    RAISE EXCEPTION 'Private notifications require a recipient_user_id';
  END IF;

  IF p_notification_type <> 'private' AND p_recipient_user_id IS NOT NULL THEN
    RAISE EXCEPTION 'Only private notifications can have a recipient_user_id';
  END IF;

  -- 5. Validate title and message
  IF trim(p_title) = '' THEN
    RAISE EXCEPTION 'Notification title cannot be empty';
  END IF;

  IF trim(p_message) = '' THEN
    RAISE EXCEPTION 'Notification message cannot be empty';
  END IF;

  -- 6. Insert the notification (created_by = caller's uid)
  INSERT INTO public.notifications (
    title,
    message,
    notification_type,
    recipient_user_id,
    created_by,
    expires_at,
    metadata
  ) VALUES (
    trim(p_title),
    trim(p_message),
    p_notification_type,
    p_recipient_user_id,
    auth.uid(),
    p_expires_at,
    COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING * INTO v_notification;

  -- 7. Activity log (no message content — avoid logging private info)
  PERFORM public.insert_activity_log(
    auth.uid(),
    'notification_created',
    'notification',
    v_notification.id::text,
    jsonb_build_object(
      'notification_type', p_notification_type,
      'title',             trim(p_title),
      'recipient_user_id', p_recipient_user_id
    )
  );

  RETURN v_notification;
END;
$fn$;

REVOKE ALL ON FUNCTION public.create_notification(TEXT, TEXT, TEXT, UUID, TIMESTAMPTZ, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_notification(TEXT, TEXT, TEXT, UUID, TIMESTAMPTZ, JSONB) TO authenticated;


-- ── 6. SECURITY DEFINER RPC: update_notification ────────────────────────────

CREATE OR REPLACE FUNCTION public.update_notification(
  p_id        UUID,
  p_title     TEXT        DEFAULT NULL,
  p_message   TEXT        DEFAULT NULL,
  p_expires_at TIMESTAMPTZ DEFAULT NULL,
  p_is_active BOOLEAN     DEFAULT NULL,
  p_metadata  JSONB       DEFAULT NULL
)
RETURNS public.notifications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_notification public.notifications;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT (public.is_owner() OR public.is_admin()) THEN
    RAISE EXCEPTION 'Access denied: only Owner or Admin can update notifications';
  END IF;

  UPDATE public.notifications
  SET
    title     = COALESCE(NULLIF(trim(p_title), ''),     title),
    message   = COALESCE(NULLIF(trim(p_message), ''),   message),
    expires_at = CASE WHEN p_expires_at IS NOT NULL THEN p_expires_at ELSE expires_at END,
    is_active  = COALESCE(p_is_active,                  is_active),
    metadata   = COALESCE(p_metadata,                   metadata),
    updated_at = now()
  WHERE id = p_id
  RETURNING * INTO v_notification;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Notification not found';
  END IF;

  PERFORM public.insert_activity_log(
    auth.uid(),
    'notification_updated',
    'notification',
    p_id::text,
    jsonb_build_object('title', v_notification.title)
  );

  RETURN v_notification;
END;
$fn$;

REVOKE ALL ON FUNCTION public.update_notification(UUID, TEXT, TEXT, TIMESTAMPTZ, BOOLEAN, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_notification(UUID, TEXT, TEXT, TIMESTAMPTZ, BOOLEAN, JSONB) TO authenticated;


-- ── 7. SECURITY DEFINER RPC: delete_notification ────────────────────────────

CREATE OR REPLACE FUNCTION public.delete_notification(p_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_title TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT (public.is_owner() OR public.is_admin()) THEN
    RAISE EXCEPTION 'Access denied: only Owner or Admin can delete notifications';
  END IF;

  SELECT title INTO v_title FROM public.notifications WHERE id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Notification not found';
  END IF;

  DELETE FROM public.notifications WHERE id = p_id;

  PERFORM public.insert_activity_log(
    auth.uid(),
    'notification_deleted',
    'notification',
    p_id::text,
    jsonb_build_object('title', v_title)
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.delete_notification(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_notification(UUID) TO authenticated;


-- ── 8. SECURITY DEFINER RPC: mark_notification_read ─────────────────────────

CREATE OR REPLACE FUNCTION public.mark_notification_read(p_notification_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_notification public.notifications;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Verify the notification exists and the user can see it
  SELECT * INTO v_notification
  FROM public.notifications
  WHERE id = p_notification_id
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Notification not found or not accessible';
  END IF;

  -- Verify visibility based on type and user role
  IF NOT (
    public.is_owner()
    OR public.is_admin()
    OR v_notification.notification_type = 'public'
    OR (v_notification.notification_type = 'private' AND v_notification.recipient_user_id = auth.uid())
    OR (v_notification.notification_type = 'all_creators' AND public.is_creator())
  ) THEN
    RAISE EXCEPTION 'Access denied: cannot mark this notification as read';
  END IF;

  -- Insert read record; ignore if already read
  INSERT INTO public.notification_reads (notification_id, user_id)
  VALUES (p_notification_id, auth.uid())
  ON CONFLICT (notification_id, user_id) DO NOTHING;

  -- Light activity log (no message content)
  PERFORM public.insert_activity_log(
    auth.uid(),
    'notification_read',
    'notification',
    p_notification_id::text,
    jsonb_build_object('notification_type', v_notification.notification_type)
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.mark_notification_read(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_notification_read(UUID) TO authenticated;


-- ── 9. SECURITY DEFINER RPC: mark_all_notifications_read ────────────────────

CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_count INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Insert read records for all currently visible, unread notifications in one statement
  INSERT INTO public.notification_reads (notification_id, user_id)
  SELECT n.id, auth.uid()
  FROM public.notifications n
  WHERE n.is_active = true
    AND (n.expires_at IS NULL OR n.expires_at > now())
    AND (
      public.is_owner()
      OR public.is_admin()
      OR n.notification_type = 'public'
      OR (n.notification_type = 'private' AND n.recipient_user_id = auth.uid())
      OR (n.notification_type = 'all_creators' AND public.is_creator())
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.notification_reads nr
      WHERE nr.notification_id = n.id
        AND nr.user_id = auth.uid()
    )
  ON CONFLICT (notification_id, user_id) DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$fn$;

REVOKE ALL ON FUNCTION public.mark_all_notifications_read() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read() TO authenticated;


-- ── 10. GRANTS ───────────────────────────────────────────────────────────────

GRANT SELECT ON public.notifications      TO anon, authenticated;
GRANT SELECT, INSERT ON public.notification_reads TO authenticated;

NOTIFY pgrst, 'reload schema';

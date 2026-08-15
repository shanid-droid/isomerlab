-- ============================================================================
-- ISOMER: NOTIFICATIONS - AUDIENCE & RECIPIENT_ID UPDATE
-- ============================================================================
-- Supports 'audience' parameter ('public', 'private', 'creators') in RPC.
-- Database table public.notifications uses column recipient_id (NOT recipient_user_id).
-- For 'creators', recipient_id must be NULL and visible only to profiles with role 'creator'.
-- ============================================================================

-- ── 1. UPDATE CHECK CONSTRAINT ON PUBLIC.NOTIFICATIONS ──────────────────────

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS chk_notification_recipient;

ALTER TABLE public.notifications ADD CONSTRAINT chk_notification_recipient CHECK (
  (notification_type = 'private' AND recipient_id IS NOT NULL)
  OR
  (notification_type IN ('public', 'creators', 'all_creators') AND recipient_id IS NULL)
);

-- ── 2. UPDATE RLS POLICY FOR SELECT ─────────────────────────────────────────

DROP POLICY IF EXISTS "Auth users read their visible notifications" ON public.notifications;

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
          AND recipient_id = auth.uid()
        )
        OR (
          notification_type IN ('creators', 'all_creators')
          AND public.is_creator()
        )
      )
    )
  );

-- ── 3. UPDATE SECURITY DEFINER RPC: create_notification ─────────────────────

CREATE OR REPLACE FUNCTION public.create_notification(
  p_title             TEXT        DEFAULT NULL,
  p_message           TEXT        DEFAULT NULL,
  p_audience          TEXT        DEFAULT NULL,
  p_recipient_id      UUID        DEFAULT NULL,
  p_expires_at        TIMESTAMPTZ DEFAULT NULL,
  p_metadata          JSONB       DEFAULT '{}'::jsonb,
  -- Backwards-compatibility aliases
  p_notification_type TEXT        DEFAULT NULL,
  p_recipient_user_id UUID        DEFAULT NULL,
  title               TEXT        DEFAULT NULL,
  message             TEXT        DEFAULT NULL,
  audience            TEXT        DEFAULT NULL,
  recipient_id        UUID        DEFAULT NULL,
  expires_at          TIMESTAMPTZ DEFAULT NULL,
  metadata            JSONB       DEFAULT NULL
)
RETURNS public.notifications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_title            TEXT;
  v_message          TEXT;
  v_audience         TEXT;
  v_recipient_id     UUID;
  v_expires_at       TIMESTAMPTZ;
  v_metadata         JSONB;
  v_notification     public.notifications;
BEGIN
  -- 1. Must be authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- 2. Must be owner or admin
  IF NOT (public.is_owner() OR public.is_admin()) THEN
    RAISE EXCEPTION 'Access denied: only Owner or Admin can send notifications';
  END IF;

  -- 3. Resolve parameters
  v_title        := COALESCE(p_title, title);
  v_message      := COALESCE(p_message, message);
  v_audience     := COALESCE(p_audience, audience, p_notification_type, 'public');
  v_recipient_id := COALESCE(p_recipient_id, recipient_id, p_recipient_user_id);
  v_expires_at   := COALESCE(p_expires_at, expires_at);
  v_metadata     := COALESCE(p_metadata, metadata, '{}'::jsonb);

  -- Map 'all_creators' to 'creators'
  IF v_audience = 'all_creators' THEN
    v_audience := 'creators';
  END IF;

  -- 4. Validate notification type / audience
  IF v_audience NOT IN ('public', 'private', 'creators') THEN
    RAISE EXCEPTION 'Invalid audience: must be public, private, or creators';
  END IF;

  -- 5. Validate recipient requirements
  IF v_audience = 'private' AND v_recipient_id IS NULL THEN
    RAISE EXCEPTION 'Private notifications require a recipient_id';
  END IF;

  IF v_audience IN ('public', 'creators') THEN
    v_recipient_id := NULL;
  END IF;

  -- 6. Validate title and message
  IF v_title IS NULL OR trim(v_title) = '' THEN
    RAISE EXCEPTION 'Notification title cannot be empty';
  END IF;

  IF v_message IS NULL OR trim(v_message) = '' THEN
    RAISE EXCEPTION 'Notification message cannot be empty';
  END IF;

  -- 7. Insert into notifications table (uses recipient_id)
  INSERT INTO public.notifications (
    title,
    message,
    notification_type,
    recipient_id,
    created_by,
    expires_at,
    metadata
  ) VALUES (
    trim(v_title),
    trim(v_message),
    v_audience,
    v_recipient_id,
    auth.uid(),
    v_expires_at,
    v_metadata
  )
  RETURNING * INTO v_notification;

  -- 8. Activity log
  PERFORM public.insert_activity_log(
    auth.uid(),
    'notification_created',
    'notification',
    v_notification.id::text,
    jsonb_build_object(
      'audience',     v_audience,
      'title',        trim(v_title),
      'recipient_id', v_recipient_id
    )
  );

  RETURN v_notification;
END;
$fn$;

-- ── 4. UPDATE SECURITY DEFINER RPC: mark_notification_read ─────────────────

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

  SELECT * INTO v_notification
  FROM public.notifications
  WHERE id = p_notification_id
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Notification not found or not accessible';
  END IF;

  IF NOT (
    public.is_owner()
    OR public.is_admin()
    OR v_notification.notification_type = 'public'
    OR (v_notification.notification_type = 'private' AND v_notification.recipient_id = auth.uid())
    OR (v_notification.notification_type IN ('creators', 'all_creators') AND public.is_creator())
  ) THEN
    RAISE EXCEPTION 'Access denied: cannot mark this notification as read';
  END IF;

  INSERT INTO public.notification_reads (notification_id, user_id)
  VALUES (p_notification_id, auth.uid())
  ON CONFLICT (notification_id, user_id) DO NOTHING;

  PERFORM public.insert_activity_log(
    auth.uid(),
    'notification_read',
    'notification',
    p_notification_id::text,
    jsonb_build_object('notification_type', v_notification.notification_type)
  );
END;
$fn$;

-- ── 5. UPDATE SECURITY DEFINER RPC: mark_all_notifications_read ────────────

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

  INSERT INTO public.notification_reads (notification_id, user_id)
  SELECT n.id, auth.uid()
  FROM public.notifications n
  WHERE n.is_active = true
    AND (n.expires_at IS NULL OR n.expires_at > now())
    AND (
      public.is_owner()
      OR public.is_admin()
      OR n.notification_type = 'public'
      OR (n.notification_type = 'private' AND n.recipient_id = auth.uid())
      OR (n.notification_type IN ('creators', 'all_creators') AND public.is_creator())
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

NOTIFY pgrst, 'reload schema';

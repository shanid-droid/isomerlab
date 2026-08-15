-- ============================================================================
-- ISOMER: NOTIFICATION READS RLS POLICIES FIX
-- ============================================================================
-- Ensures authenticated users can SELECT, INSERT, and UPDATE their own read records in public.notification_reads.
-- Ensures unique constraint ON CONFLICT (notification_id, user_id) works safely.
-- ============================================================================

ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own notification reads"   ON public.notification_reads;
DROP POLICY IF EXISTS "Users insert own notification reads" ON public.notification_reads;
DROP POLICY IF EXISTS "Users update own notification reads" ON public.notification_reads;

-- Users can see their own read records (owners/admins can see all)
CREATE POLICY "Users read own notification reads"
  ON public.notification_reads
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_owner()
    OR public.is_admin()
  );

-- Users can insert read records for themselves
CREATE POLICY "Users insert own notification reads"
  ON public.notification_reads
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
  );

-- Users can update read records for themselves (required for upsert / ON CONFLICT)
CREATE POLICY "Users update own notification reads"
  ON public.notification_reads
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
  )
  WITH CHECK (
    user_id = auth.uid()
  );

NOTIFY pgrst, 'reload schema';

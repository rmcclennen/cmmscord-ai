-- Helper: can the user approve deletions?
CREATE OR REPLACE FUNCTION public.can_approve_deletions(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin'::app_role, 'manager'::app_role, 'supervisor'::app_role)
  );
$$;

REVOKE ALL ON FUNCTION public.can_approve_deletions(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_approve_deletions(uuid) TO authenticated, service_role;

-- Deletion requests
CREATE TABLE public.deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('asset','pm_schedule','work_order')),
  entity_id uuid NOT NULL,
  entity_label text NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','denied')),
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.deletion_requests TO authenticated;
GRANT ALL ON public.deletion_requests TO service_role;
ALTER TABLE public.deletion_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team views deletion requests" ON public.deletion_requests
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Team requests deletions" ON public.deletion_requests
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = requested_by AND status = 'pending');

CREATE TRIGGER deletion_requests_updated
  BEFORE UPDATE ON public.deletion_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX deletion_requests_status_idx ON public.deletion_requests (status, created_at DESC);

-- Notify approvers when a request is filed
CREATE OR REPLACE FUNCTION public.notify_deletion_requested()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor text;
BEGIN
  SELECT COALESCE(full_name, email, 'A teammate') INTO actor FROM public.profiles WHERE id = NEW.requested_by;

  INSERT INTO public.notifications (user_id, title, body, kind, link)
  SELECT DISTINCT ur.user_id,
         'Deletion approval needed',
         COALESCE(actor, 'A teammate') || ' requested deletion of "' || NEW.entity_label || '"',
         'deletion_request',
         '/approvals'
  FROM public.user_roles ur
  WHERE ur.role IN ('admin'::app_role, 'manager'::app_role, 'supervisor'::app_role)
    AND ur.user_id <> NEW.requested_by;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_deletion_requested() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER deletion_requested_notify
  AFTER INSERT ON public.deletion_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_deletion_requested();

-- Decide a request (approve => perform the delete)
CREATE OR REPLACE FUNCTION public.decide_deletion_request(_request_id uuid, _approve boolean, _note text DEFAULT NULL)
RETURNS public.deletion_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req public.deletion_requests;
  actor text;
BEGIN
  IF NOT public.can_approve_deletions(auth.uid()) THEN
    RAISE EXCEPTION 'Only managers or supervisors can decide deletion requests';
  END IF;

  SELECT * INTO req FROM public.deletion_requests WHERE id = _request_id FOR UPDATE;
  IF req.id IS NULL THEN
    RAISE EXCEPTION 'Deletion request not found';
  END IF;
  IF req.status <> 'pending' THEN
    RAISE EXCEPTION 'Deletion request already %', req.status;
  END IF;

  IF _approve THEN
    IF req.entity_type = 'asset' THEN
      DELETE FROM public.assets WHERE id = req.entity_id;
    ELSIF req.entity_type = 'pm_schedule' THEN
      DELETE FROM public.pm_schedules WHERE id = req.entity_id;
    ELSIF req.entity_type = 'work_order' THEN
      DELETE FROM public.work_orders WHERE id = req.entity_id;
    END IF;
  END IF;

  UPDATE public.deletion_requests
     SET status = CASE WHEN _approve THEN 'approved' ELSE 'denied' END,
         decided_by = auth.uid(),
         decided_at = now(),
         decision_note = _note
   WHERE id = _request_id
  RETURNING * INTO req;

  SELECT COALESCE(full_name, email, 'A manager') INTO actor FROM public.profiles WHERE id = auth.uid();

  IF req.requested_by IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, body, kind, link)
    VALUES (req.requested_by,
            CASE WHEN _approve THEN 'Deletion approved' ELSE 'Deletion denied' END,
            COALESCE(actor, 'A manager') || ' ' || CASE WHEN _approve THEN 'approved' ELSE 'denied' END
              || ' deletion of "' || req.entity_label || '"'
              || COALESCE(' — ' || _note, ''),
            'deletion_decision',
            '/approvals');
  END IF;

  RETURN req;
END;
$$;

REVOKE ALL ON FUNCTION public.decide_deletion_request(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decide_deletion_request(uuid, boolean, text) TO authenticated;

-- Restrict direct deletes to approvers
DROP POLICY IF EXISTS "Admins delete assets" ON public.assets;
CREATE POLICY "Approvers delete assets" ON public.assets
  FOR DELETE TO authenticated USING (public.can_approve_deletions(auth.uid()));

DROP POLICY IF EXISTS "Admins delete PMs" ON public.pm_schedules;
CREATE POLICY "Approvers delete PMs" ON public.pm_schedules
  FOR DELETE TO authenticated USING (public.can_approve_deletions(auth.uid()));

DROP POLICY IF EXISTS "Team manages work orders" ON public.work_orders;
CREATE POLICY "Team views work orders" ON public.work_orders
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Team adds work orders" ON public.work_orders
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Team edits work orders" ON public.work_orders
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Approvers delete work orders" ON public.work_orders
  FOR DELETE TO authenticated USING (public.can_approve_deletions(auth.uid()));
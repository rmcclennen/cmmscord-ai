-- Preventive-maintenance completion loop.
--
--   * pm_completions: history of every time a PM was done (who, when, hours, parts, notes).
--   * complete_pm(): logs the completion, reschedules the PM, and closes the PM's open
--     work order, in one transaction. Idempotent on _client_id so an offline device
--     can safely replay it.
--   * generate_due_pm_work_orders(): opens a work order for every PM that is due and
--     has none open. Safe to call repeatedly (button, or a daily cron).

CREATE TABLE public.pm_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid UNIQUE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  pm_schedule_id uuid NOT NULL REFERENCES public.pm_schedules(id) ON DELETE CASCADE,
  asset_id uuid REFERENCES public.assets(id) ON DELETE SET NULL,
  work_order_id uuid REFERENCES public.work_orders(id) ON DELETE SET NULL,
  completed_on date NOT NULL,
  completed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  labor_hours numeric CHECK (labor_hours IS NULL OR labor_hours >= 0),
  parts_used text,
  notes text,
  next_due date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pm_completions_pm_idx ON public.pm_completions (pm_schedule_id, completed_on DESC);
CREATE INDEX pm_completions_company_idx ON public.pm_completions (company_id);

ALTER TABLE public.pm_completions ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.pm_completions TO authenticated;
GRANT ALL ON public.pm_completions TO service_role;

CREATE POLICY "Team views PM history" ON public.pm_completions
  FOR SELECT TO authenticated USING (public.is_team_member(auth.uid()));
CREATE POLICY "Crew logs PM completions" ON public.pm_completions
  FOR INSERT TO authenticated
  WITH CHECK (public.can_write_operational(auth.uid()) AND completed_by = auth.uid());
CREATE POLICY company_isolation ON public.pm_completions AS RESTRICTIVE FOR ALL
  TO authenticated
  USING (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));

CREATE TRIGGER aa_set_company_id BEFORE INSERT ON public.pm_completions
  FOR EACH ROW EXECUTE FUNCTION public.set_company_id();
CREATE TRIGGER zz_audit AFTER INSERT OR UPDATE OR DELETE ON public.pm_completions
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

-- Runs as the caller (SECURITY INVOKER), so row-level security still applies.
CREATE FUNCTION public.complete_pm(
  _pm_id uuid,
  _completed_on date,
  _next_due date,
  _labor_hours numeric DEFAULT NULL,
  _parts_used text DEFAULT NULL,
  _notes text DEFAULT NULL,
  _client_id uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE
  pm public.pm_schedules%ROWTYPE;
  completion_id uuid;
  wo_id uuid;
BEGIN
  -- Replay of an already-recorded offline completion: nothing to do.
  IF _client_id IS NOT NULL THEN
    SELECT id INTO completion_id FROM public.pm_completions WHERE client_id = _client_id;
    IF FOUND THEN
      RETURN completion_id;
    END IF;
  END IF;

  SELECT * INTO pm FROM public.pm_schedules WHERE id = _pm_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PM schedule not found' USING ERRCODE = 'P0002';
  END IF;
  IF _next_due < _completed_on THEN
    RAISE EXCEPTION 'Next due date cannot be before the completion date' USING ERRCODE = '22023';
  END IF;

  -- Close the PM's most recent open work order, carrying over the shop-floor details.
  UPDATE public.work_orders w
     SET status = 'completed',
         completed_at = now(),
         labor_hours = coalesce(_labor_hours, w.labor_hours),
         parts_used = coalesce(_parts_used, w.parts_used),
         completion_notes = coalesce(_notes, w.completion_notes)
   WHERE w.id = (
     SELECT id FROM public.work_orders
      WHERE pm_schedule_id = _pm_id AND status IN ('open', 'in_progress', 'on_hold')
      ORDER BY created_at DESC LIMIT 1
   )
  RETURNING w.id INTO wo_id;

  INSERT INTO public.pm_completions
    (client_id, pm_schedule_id, asset_id, work_order_id, completed_on, completed_by,
     labor_hours, parts_used, notes, next_due)
  VALUES
    (_client_id, _pm_id, pm.asset_id, wo_id, _completed_on, auth.uid(),
     _labor_hours, nullif(btrim(_parts_used), ''), nullif(btrim(_notes), ''), _next_due)
  RETURNING id INTO completion_id;

  -- Only move the schedule forward; an older replayed completion must not rewind it.
  IF pm.last_completed IS NULL OR _completed_on >= pm.last_completed THEN
    UPDATE public.pm_schedules
       SET last_completed = _completed_on, next_due = _next_due
     WHERE id = _pm_id;
  END IF;

  RETURN completion_id;
END; $$;
REVOKE ALL ON FUNCTION public.complete_pm(uuid, date, date, numeric, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_pm(uuid, date, date, numeric, text, text, uuid)
  TO authenticated, service_role;

CREATE FUNCTION public.generate_due_pm_work_orders(_horizon_days integer DEFAULT 0)
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE
  n integer := 0;
  r record;
  new_id uuid;
BEGIN
  -- Serialize concurrent runs so two people tapping the button can't double-create.
  PERFORM pg_advisory_xact_lock(hashtext('generate_due_pm_work_orders'));

  FOR r IN
    SELECT p.*
      FROM public.pm_schedules p
     WHERE p.active
       AND p.next_due <= current_date + greatest(_horizon_days, 0)
       AND NOT EXISTS (
         SELECT 1 FROM public.work_orders w
          WHERE w.pm_schedule_id = p.id AND w.status IN ('open', 'in_progress', 'on_hold')
       )
  LOOP
    INSERT INTO public.work_orders
      (asset_id, pm_schedule_id, title, description, wo_type, status, priority, created_by,
       assigned_to, due_date)
    VALUES
      (r.asset_id, r.id, r.title, r.tasks, 'preventive', 'open', r.priority, auth.uid(),
       r.assigned_to, r.next_due)
    RETURNING id INTO new_id;

    IF r.assigned_to IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, body, link, kind)
      VALUES (r.assigned_to, 'PM work order assigned: ' || r.title,
              'Due ' || r.next_due::text, '/work-orders', 'assignment');
    END IF;
    n := n + 1;
  END LOOP;

  RETURN n;
END; $$;
REVOKE ALL ON FUNCTION public.generate_due_pm_work_orders(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_due_pm_work_orders(integer) TO authenticated, service_role;

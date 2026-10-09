-- Audit log: who changed what, and when.
--
-- Written only by database triggers (security definer), so the app cannot forge
-- or skip entries. Readable by approvers (admin / manager / supervisor) of the
-- company the change belongs to. Nobody can edit or delete entries through the API.

CREATE TABLE public.audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  user_id uuid,
  company_id uuid,
  -- Set for people-related tables so approvers can see role changes for their staff.
  subject_user_id uuid,
  table_name text NOT NULL,
  row_id text,
  action text NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  -- INSERT: the new row. DELETE: the old row. UPDATE: { column: { old, new } } for changed columns only.
  changes jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX audit_log_company_at_idx ON public.audit_log (company_id, at DESC);
CREATE INDEX audit_log_row_idx ON public.audit_log (table_name, row_id, at DESC);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.audit_log FROM anon, authenticated;
GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;

CREATE POLICY "Approvers read their company audit log" ON public.audit_log
  FOR SELECT TO authenticated
  USING (
    public.can_approve_deletions(auth.uid())
    AND (public.is_company_member(company_id) OR public.shares_company_with(subject_user_id))
  );

CREATE FUNCTION public.audit_row_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_j jsonb;
  old_j jsonb;
  rec jsonb;
  diff jsonb := '{}'::jsonb;
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') THEN new_j := to_jsonb(NEW); END IF;
  IF TG_OP IN ('UPDATE', 'DELETE') THEN old_j := to_jsonb(OLD); END IF;
  rec := coalesce(new_j, old_j);

  IF TG_OP = 'UPDATE' THEN
    SELECT coalesce(jsonb_object_agg(k, jsonb_build_object('old', old_j -> k, 'new', new_j -> k)), '{}'::jsonb)
      INTO diff
      FROM jsonb_object_keys(new_j) AS k
     WHERE k <> 'updated_at' AND (old_j -> k) IS DISTINCT FROM (new_j -> k);
    IF diff = '{}'::jsonb THEN
      RETURN NULL; -- nothing meaningful changed
    END IF;
  END IF;

  INSERT INTO public.audit_log (user_id, company_id, subject_user_id, table_name, row_id, action, changes)
  VALUES (
    auth.uid(),
    (rec ->> 'company_id')::uuid,
    CASE WHEN TG_TABLE_NAME IN ('user_roles', 'company_members') THEN (rec ->> 'user_id')::uuid END,
    TG_TABLE_NAME,
    coalesce(rec ->> 'id', (rec ->> 'company_id') || ':' || (rec ->> 'user_id')),
    TG_OP,
    CASE TG_OP WHEN 'UPDATE' THEN diff WHEN 'INSERT' THEN new_j ELSE old_j END
  );
  RETURN NULL;
END; $$;
REVOKE ALL ON FUNCTION public.audit_row_change() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'assets', 'pm_schedules', 'work_orders', 'parts', 'part_requests', 'manuals',
    'deletion_requests', 'user_roles', 'company_members'
  ]
  LOOP
    EXECUTE format(
      'CREATE TRIGGER zz_audit AFTER INSERT OR UPDATE OR DELETE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.audit_row_change()', t);
  END LOOP;
END $$;

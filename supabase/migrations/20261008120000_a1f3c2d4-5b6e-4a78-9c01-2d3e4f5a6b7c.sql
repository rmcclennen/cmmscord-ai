-- Company (tenant) isolation, enforced in the database.
--
-- Before this migration every signed-in team member could read every row. That is
-- fine for a single plant but unsafe the moment a second organization is added.
--
-- Design:
--   * companies / company_members describe who belongs where.
--   * every business table gets a company_id.
--   * ONE restrictive policy per table ANDs a membership check onto the existing
--     permissive role-based policies, so the role rules keep working unchanged.
--   * a BEFORE INSERT trigger fills company_id (from the parent asset/part/etc.,
--     else the caller's company), so existing inserts keep working.
--
-- Nobody loses access: every existing user and every existing row is placed in
-- the default company below.

CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 2 AND 120),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX companies_name_key ON public.companies (lower(btrim(name)));

CREATE TABLE public.company_members (
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, user_id)
);
CREATE INDEX company_members_user_idx ON public.company_members (user_id);

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;

-- Default company that adopts all pre-existing data.
INSERT INTO public.companies (id, name)
VALUES ('00000000-0000-4000-8000-000000000001', 'Sioux City Plant Operations');

INSERT INTO public.company_members (company_id, user_id)
SELECT '00000000-0000-4000-8000-000000000001', u.id FROM auth.users u;

-- ---------------------------------------------------------------- helpers
CREATE FUNCTION public.is_company_member(_company_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_members m
    WHERE m.company_id = _company_id AND m.user_id = auth.uid()
  );
$$;

-- True for the caller themself or anyone who shares a company with the caller.
CREATE FUNCTION public.shares_company_with(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user_id IS NOT NULL AND (
    _user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.company_members a
      JOIN public.company_members b ON b.company_id = a.company_id
      WHERE a.user_id = auth.uid() AND b.user_id = _user_id
    )
  );
$$;

-- The caller's primary company (the one they joined first).
CREATE FUNCTION public.my_default_company_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT company_id FROM public.company_members
  WHERE user_id = auth.uid()
  ORDER BY created_at, company_id
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.is_company_member(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.shares_company_with(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.my_default_company_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_company_member(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.shares_company_with(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.my_default_company_id() TO authenticated, service_role;

-- ------------------------------------------- policies on the new tables
GRANT SELECT ON public.companies TO authenticated;
GRANT UPDATE (name) ON public.companies TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.company_members TO authenticated;
GRANT ALL ON public.companies, public.company_members TO service_role;

CREATE POLICY "Members view their companies" ON public.companies
  FOR SELECT TO authenticated USING (public.is_company_member(id));
CREATE POLICY "Admins rename their companies" ON public.companies
  FOR UPDATE TO authenticated
  USING (public.is_company_member(id) AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.is_company_member(id) AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Members view co-members" ON public.company_members
  FOR SELECT TO authenticated USING (public.is_company_member(company_id));
CREATE POLICY "Admins and managers add members" ON public.company_members
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_company_member(company_id)
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  );
CREATE POLICY "Admins and managers remove members" ON public.company_members
  FOR DELETE TO authenticated
  USING (
    public.is_company_member(company_id)
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  );

-- Admins and managers can open an additional company workspace.
CREATE FUNCTION public.create_company(_name text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to create a company workspace' USING ERRCODE = '42501';
  END IF;
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')) THEN
    RAISE EXCEPTION 'Only admins or managers can create a company workspace' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.companies (name, created_by) VALUES (btrim(_name), auth.uid())
  RETURNING id INTO new_id;
  INSERT INTO public.company_members (company_id, user_id) VALUES (new_id, auth.uid());
  RETURN new_id;
END; $$;
REVOKE ALL ON FUNCTION public.create_company(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_company(text) TO authenticated, service_role;

-- --------------------------------------- company_id on every business table
-- A constant default adopts existing rows without rewriting them through the
-- UPDATE triggers (which would bump every updated_at). The default is dropped
-- right after, and the trigger below supplies the value for new rows.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'assets', 'pm_schedules', 'work_orders', 'parts', 'part_requests', 'manuals',
    'deletion_requests', 'asset_maintenance_info', 'asset_photos', 'part_assets',
    'part_transactions', 'part_request_bids'
  ]
  LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN company_id uuid NOT NULL
         DEFAULT %L REFERENCES public.companies(id) ON DELETE RESTRICT',
      t, '00000000-0000-4000-8000-000000000001');
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN company_id DROP DEFAULT', t);
    EXECUTE format('CREATE INDEX %I ON public.%I (company_id)', t || '_company_idx', t);
  END LOOP;
END $$;

-- Fill company_id on insert from the closest parent, else the caller's company.
CREATE FUNCTION public.set_company_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  j jsonb := to_jsonb(NEW);
  c uuid := NULL;
BEGIN
  IF NEW.company_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF (j->>'asset_id') IS NOT NULL THEN
    SELECT company_id INTO c FROM public.assets WHERE id = (j->>'asset_id')::uuid;
  END IF;
  IF c IS NULL AND (j->>'pm_schedule_id') IS NOT NULL THEN
    SELECT company_id INTO c FROM public.pm_schedules WHERE id = (j->>'pm_schedule_id')::uuid;
  END IF;
  IF c IS NULL AND (j->>'work_order_id') IS NOT NULL THEN
    SELECT company_id INTO c FROM public.work_orders WHERE id = (j->>'work_order_id')::uuid;
  END IF;
  IF c IS NULL AND (j->>'part_id') IS NOT NULL THEN
    SELECT company_id INTO c FROM public.parts WHERE id = (j->>'part_id')::uuid;
  END IF;
  IF c IS NULL AND (j->>'request_id') IS NOT NULL THEN
    SELECT company_id INTO c FROM public.part_requests WHERE id = (j->>'request_id')::uuid;
  END IF;
  IF c IS NULL AND TG_TABLE_NAME = 'deletion_requests' THEN
    c := CASE j->>'entity_type'
      WHEN 'asset' THEN (SELECT company_id FROM public.assets WHERE id = (j->>'entity_id')::uuid)
      WHEN 'pm_schedule' THEN (SELECT company_id FROM public.pm_schedules WHERE id = (j->>'entity_id')::uuid)
      WHEN 'work_order' THEN (SELECT company_id FROM public.work_orders WHERE id = (j->>'entity_id')::uuid)
    END;
  END IF;
  IF c IS NULL THEN
    c := public.my_default_company_id();
  END IF;
  IF c IS NULL THEN
    RAISE EXCEPTION 'You are not a member of any company workspace' USING ERRCODE = '42501';
  END IF;

  NEW.company_id := c;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.set_company_id() FROM PUBLIC, anon, authenticated;

-- A row never changes company once created (service-role maintenance excepted).
CREATE FUNCTION public.lock_company_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.company_id IS DISTINCT FROM OLD.company_id AND auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'company_id cannot be changed' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.lock_company_id() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'assets', 'pm_schedules', 'work_orders', 'parts', 'part_requests', 'manuals',
    'deletion_requests', 'asset_maintenance_info', 'asset_photos', 'part_assets',
    'part_transactions', 'part_request_bids'
  ]
  LOOP
    EXECUTE format(
      'CREATE TRIGGER aa_set_company_id BEFORE INSERT ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.set_company_id()', t);
    EXECUTE format(
      'CREATE TRIGGER aa_lock_company_id BEFORE UPDATE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.lock_company_id()', t);
    -- RESTRICTIVE: ANDed with every existing permissive policy on the table.
    EXECUTE format(
      'CREATE POLICY company_isolation ON public.%I AS RESTRICTIVE FOR ALL TO authenticated
         USING (public.is_company_member(company_id))
         WITH CHECK (public.is_company_member(company_id))', t);
  END LOOP;
END $$;

-- ---------------------------------------- people tables: same-company only
-- Fix: the original directory policy selected from team_directory inside its own
-- USING clause, which Postgres rejects ("infinite recursion detected in policy"),
-- so every direct read by a signed-in user failed. Use the security-definer
-- helper instead.
DROP POLICY IF EXISTS "Team members view team directory" ON public.team_directory;
CREATE POLICY "Team members view team directory" ON public.team_directory
  FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.is_team_member(auth.uid()));

-- Roles stay global, but people are only visible / manageable within a shared
-- company, so an admin of one company cannot see or edit another company's staff.
CREATE POLICY company_isolation ON public.team_directory AS RESTRICTIVE FOR SELECT
  TO authenticated USING (public.shares_company_with(id));
CREATE POLICY company_isolation ON public.profiles AS RESTRICTIVE FOR SELECT
  TO authenticated USING (public.shares_company_with(id));
CREATE POLICY company_isolation ON public.user_roles AS RESTRICTIVE FOR ALL
  TO authenticated
  USING (public.shares_company_with(user_id))
  WITH CHECK (public.shares_company_with(user_id));
-- Notifications may only be sent to people you share a company with.
CREATE POLICY company_isolation ON public.notifications AS RESTRICTIVE FOR INSERT
  TO authenticated WITH CHECK (public.shares_company_with(user_id));

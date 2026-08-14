CREATE OR REPLACE FUNCTION public.can_write_operational(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role <> 'viewer'::app_role
  );
$$;

REVOKE ALL ON FUNCTION public.can_write_operational(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_write_operational(uuid) TO authenticated, service_role;

-- assets
DROP POLICY IF EXISTS "Team can add assets" ON public.assets;
DROP POLICY IF EXISTS "Team can edit assets" ON public.assets;
CREATE POLICY "Crew can add assets" ON public.assets FOR INSERT TO authenticated
  WITH CHECK (public.can_write_operational(auth.uid()));
CREATE POLICY "Crew can edit assets" ON public.assets FOR UPDATE TO authenticated
  USING (public.can_write_operational(auth.uid()))
  WITH CHECK (public.can_write_operational(auth.uid()));

-- manuals
DROP POLICY IF EXISTS "Team can add manuals" ON public.manuals;
DROP POLICY IF EXISTS "Team can edit manuals" ON public.manuals;
CREATE POLICY "Crew can add manuals" ON public.manuals FOR INSERT TO authenticated
  WITH CHECK (public.can_write_operational(auth.uid()));
CREATE POLICY "Crew can edit manuals" ON public.manuals FOR UPDATE TO authenticated
  USING (public.can_write_operational(auth.uid()))
  WITH CHECK (public.can_write_operational(auth.uid()));

-- pm_schedules
DROP POLICY IF EXISTS "Team can add PMs" ON public.pm_schedules;
DROP POLICY IF EXISTS "Team can edit PMs" ON public.pm_schedules;
CREATE POLICY "Crew can add PMs" ON public.pm_schedules FOR INSERT TO authenticated
  WITH CHECK (public.can_write_operational(auth.uid()));
CREATE POLICY "Crew can edit PMs" ON public.pm_schedules FOR UPDATE TO authenticated
  USING (public.can_write_operational(auth.uid()))
  WITH CHECK (public.can_write_operational(auth.uid()));

-- work_orders
DROP POLICY IF EXISTS "Team adds work orders" ON public.work_orders;
DROP POLICY IF EXISTS "Team edits work orders" ON public.work_orders;
CREATE POLICY "Crew adds work orders" ON public.work_orders FOR INSERT TO authenticated
  WITH CHECK (public.can_write_operational(auth.uid()));
CREATE POLICY "Crew edits work orders" ON public.work_orders FOR UPDATE TO authenticated
  USING (public.can_write_operational(auth.uid()))
  WITH CHECK (public.can_write_operational(auth.uid()));

-- parts
DROP POLICY IF EXISTS "Team adds parts" ON public.parts;
DROP POLICY IF EXISTS "Team edits parts" ON public.parts;
CREATE POLICY "Crew adds parts" ON public.parts FOR INSERT TO authenticated
  WITH CHECK (public.can_write_operational(auth.uid()));
CREATE POLICY "Crew edits parts" ON public.parts FOR UPDATE TO authenticated
  USING (public.can_write_operational(auth.uid()))
  WITH CHECK (public.can_write_operational(auth.uid()));

-- part_assets
DROP POLICY IF EXISTS "Team adds part links" ON public.part_assets;
DROP POLICY IF EXISTS "Team edits part links" ON public.part_assets;
DROP POLICY IF EXISTS "Team removes part links" ON public.part_assets;
CREATE POLICY "Crew adds part links" ON public.part_assets FOR INSERT TO authenticated
  WITH CHECK (public.can_write_operational(auth.uid()));
CREATE POLICY "Crew edits part links" ON public.part_assets FOR UPDATE TO authenticated
  USING (public.can_write_operational(auth.uid()))
  WITH CHECK (public.can_write_operational(auth.uid()));
CREATE POLICY "Crew removes part links" ON public.part_assets FOR DELETE TO authenticated
  USING (public.can_write_operational(auth.uid()));

-- asset_maintenance_info
DROP POLICY IF EXISTS "Team manages maintenance info" ON public.asset_maintenance_info;
CREATE POLICY "Crew views maintenance info" ON public.asset_maintenance_info FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Crew adds maintenance info" ON public.asset_maintenance_info FOR INSERT TO authenticated
  WITH CHECK (public.can_write_operational(auth.uid()));
CREATE POLICY "Crew edits maintenance info" ON public.asset_maintenance_info FOR UPDATE TO authenticated
  USING (public.can_write_operational(auth.uid()))
  WITH CHECK (public.can_write_operational(auth.uid()));
CREATE POLICY "Crew removes maintenance info" ON public.asset_maintenance_info FOR DELETE TO authenticated
  USING (public.can_write_operational(auth.uid()));

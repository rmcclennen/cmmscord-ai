INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'viewer'::app_role FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id);

CREATE OR REPLACE FUNCTION public.is_team_member(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id);
$$;
REVOKE EXECUTE ON FUNCTION public.is_team_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_team_member(uuid) TO authenticated;

ALTER POLICY "Crew views maintenance info" ON public.asset_maintenance_info USING (public.is_team_member(auth.uid()));
ALTER POLICY "Team can view asset photos" ON public.asset_photos USING (public.is_team_member(auth.uid()));
ALTER POLICY "Team can view assets" ON public.assets USING (public.is_team_member(auth.uid()));
ALTER POLICY "Team views deletion requests" ON public.deletion_requests USING (public.is_team_member(auth.uid()));
ALTER POLICY "Team can view manuals" ON public.manuals USING (public.is_team_member(auth.uid()));
ALTER POLICY "Team views part links" ON public.part_assets USING (public.is_team_member(auth.uid()));
ALTER POLICY "Team views parts" ON public.parts USING (public.is_team_member(auth.uid()));
ALTER POLICY "Team views part movements" ON public.part_transactions USING (public.is_team_member(auth.uid()));
ALTER POLICY "Team views part requests" ON public.part_requests USING (public.is_team_member(auth.uid()));
ALTER POLICY "Team can view PMs" ON public.pm_schedules USING (public.is_team_member(auth.uid()));
ALTER POLICY "Team views work orders" ON public.work_orders USING (public.is_team_member(auth.uid()));

ALTER POLICY "Team can notify teammates" ON public.notifications
  WITH CHECK (public.is_team_member(auth.uid()) AND public.is_team_member(user_id));

ALTER POLICY "Team can read asset photo files" ON storage.objects
  USING (bucket_id = 'asset-photos' AND public.is_team_member(auth.uid()));

DROP POLICY "manual files read" ON storage.objects;
CREATE POLICY "manual files read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'manual-files' AND public.is_team_member(auth.uid()));

DROP POLICY "manual files upload" ON storage.objects;
CREATE POLICY "manual files upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'manual-files' AND owner = auth.uid() AND public.can_write_operational(auth.uid()));
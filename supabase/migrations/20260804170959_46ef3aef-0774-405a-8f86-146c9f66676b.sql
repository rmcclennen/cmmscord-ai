DROP POLICY IF EXISTS "Team manages PMs" ON public.pm_schedules;

CREATE POLICY "Team can view PMs" ON public.pm_schedules
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Team can add PMs" ON public.pm_schedules
FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Team can edit PMs" ON public.pm_schedules
FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Admins delete PMs" ON public.pm_schedules
FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.notify_pm_deleted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor text;
BEGIN
  SELECT COALESCE(full_name, email, 'A teammate') INTO actor FROM public.profiles WHERE id = auth.uid();

  INSERT INTO public.notifications (user_id, title, body, kind)
  SELECT DISTINCT u.user_id,
         'PM schedule deleted',
         COALESCE(actor, 'A teammate') || ' deleted the PM "' || OLD.title || '"',
         'pm_deleted'
  FROM (
    SELECT user_id FROM public.user_roles WHERE role = 'admin'::app_role
    UNION
    SELECT OLD.assigned_to WHERE OLD.assigned_to IS NOT NULL
  ) AS u(user_id)
  WHERE u.user_id IS NOT NULL;

  RETURN OLD;
END; $$;

CREATE TRIGGER pm_deleted_notify
AFTER DELETE ON public.pm_schedules
FOR EACH ROW EXECUTE FUNCTION public.notify_pm_deleted();
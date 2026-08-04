CREATE POLICY "Managers manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'manager'::app_role));
GRANT INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
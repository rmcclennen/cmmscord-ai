DROP POLICY IF EXISTS "Managers manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view roles" ON public.user_roles;

CREATE POLICY "Managers manage non-admin roles"
ON public.user_roles FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'manager') AND role <> 'admin')
WITH CHECK (public.has_role(auth.uid(), 'manager') AND role <> 'admin');

CREATE POLICY "View own or privileged roles"
ON public.user_roles FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'manager')
);
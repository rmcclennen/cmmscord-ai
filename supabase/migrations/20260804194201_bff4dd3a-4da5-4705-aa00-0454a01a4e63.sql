DROP POLICY IF EXISTS "Managers manage non-admin roles" ON public.user_roles;

CREATE POLICY "Managers manage non-admin non-supervisor roles"
ON public.user_roles FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR (
    public.has_role(auth.uid(), 'manager')
    AND role NOT IN ('admin', 'supervisor')
    AND user_id <> auth.uid()
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR (
    public.has_role(auth.uid(), 'manager')
    AND role NOT IN ('admin', 'supervisor')
    AND user_id <> auth.uid()
  )
);
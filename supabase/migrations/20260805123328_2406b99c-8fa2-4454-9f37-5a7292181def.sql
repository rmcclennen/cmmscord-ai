CREATE TABLE public.part_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid REFERENCES public.work_orders(id) ON DELETE SET NULL,
  asset_id uuid REFERENCES public.assets(id) ON DELETE SET NULL,
  part_id uuid REFERENCES public.parts(id) ON DELETE SET NULL,
  title text NOT NULL,
  part_lines text NOT NULL,
  note text,
  priority text NOT NULL DEFAULT 'medium',
  needed_by date,
  status text NOT NULL DEFAULT 'requested',
  route_to text NOT NULL DEFAULT 'supervisors',
  requested_by uuid REFERENCES auth.users(id),
  sent_to uuid REFERENCES auth.users(id),
  photo_paths text[] NOT NULL DEFAULT '{}',
  vendor text,
  quoted_cost numeric,
  decision_note text,
  handled_by uuid REFERENCES auth.users(id),
  handled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.part_requests TO authenticated;
GRANT ALL ON public.part_requests TO service_role;

ALTER TABLE public.part_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team views part requests" ON public.part_requests
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Team creates part requests" ON public.part_requests
  FOR INSERT TO authenticated
  WITH CHECK (requested_by = auth.uid() AND status = 'requested');

CREATE POLICY "Requester or approvers update part requests" ON public.part_requests
  FOR UPDATE TO authenticated
  USING (requested_by = auth.uid() OR public.can_approve_deletions(auth.uid()))
  WITH CHECK (requested_by = auth.uid() OR public.can_approve_deletions(auth.uid()));

CREATE POLICY "Approvers delete part requests" ON public.part_requests
  FOR DELETE TO authenticated USING (public.can_approve_deletions(auth.uid()));

CREATE TRIGGER part_requests_updated BEFORE UPDATE ON public.part_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX part_requests_status_idx ON public.part_requests(status, created_at DESC);

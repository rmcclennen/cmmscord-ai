ALTER TABLE public.part_requests
  ADD COLUMN IF NOT EXISTS awarded_vendor text,
  ADD COLUMN IF NOT EXISTS awarded_cost numeric,
  ADD COLUMN IF NOT EXISTS lead_time_days integer,
  ADD COLUMN IF NOT EXISTS po_number text,
  ADD COLUMN IF NOT EXISTS expected_date date,
  ADD COLUMN IF NOT EXISTS ordered_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS received_at timestamp with time zone;

CREATE TABLE public.part_request_bids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.part_requests(id) ON DELETE CASCADE,
  vendor text NOT NULL,
  amount numeric,
  lead_time_days integer,
  contact text,
  note text,
  is_winner boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.part_request_bids TO authenticated;
GRANT ALL ON public.part_request_bids TO service_role;

ALTER TABLE public.part_request_bids ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view bids"
  ON public.part_request_bids FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can add bids"
  ON public.part_request_bids FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Approvers can update bids"
  ON public.part_request_bids FOR UPDATE TO authenticated
  USING (public.can_approve_deletions(auth.uid()) OR auth.uid() = created_by);

CREATE POLICY "Approvers can delete bids"
  ON public.part_request_bids FOR DELETE TO authenticated
  USING (public.can_approve_deletions(auth.uid()) OR auth.uid() = created_by);

CREATE TRIGGER part_request_bids_updated
  BEFORE UPDATE ON public.part_request_bids
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX part_request_bids_request_idx ON public.part_request_bids(request_id);
CREATE TABLE public.parts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  part_number text,
  manufacturer text,
  description text,
  unit text NOT NULL DEFAULT 'ea',
  where_to_buy text,
  unit_cost numeric,
  qty_on_hand numeric NOT NULL DEFAULT 0,
  min_qty numeric NOT NULL DEFAULT 0,
  location text,
  bin text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parts TO authenticated;
GRANT ALL ON public.parts TO service_role;
ALTER TABLE public.parts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team views parts" ON public.parts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Team adds parts" ON public.parts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Team edits parts" ON public.parts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Approvers delete parts" ON public.parts FOR DELETE TO authenticated USING (public.can_approve_deletions(auth.uid()));
CREATE TRIGGER parts_updated BEFORE UPDATE ON public.parts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.part_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  part_id uuid NOT NULL REFERENCES public.parts(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (part_id, asset_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.part_assets TO authenticated;
GRANT ALL ON public.part_assets TO service_role;
ALTER TABLE public.part_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team views part links" ON public.part_assets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Team adds part links" ON public.part_assets FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Team edits part links" ON public.part_assets FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Team removes part links" ON public.part_assets FOR DELETE TO authenticated USING (true);

CREATE TABLE public.part_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  part_id uuid NOT NULL REFERENCES public.parts(id) ON DELETE CASCADE,
  asset_id uuid REFERENCES public.assets(id) ON DELETE SET NULL,
  work_order_id uuid REFERENCES public.work_orders(id) ON DELETE SET NULL,
  kind text NOT NULL DEFAULT 'issue',
  qty numeric NOT NULL,
  note text,
  performed_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.part_transactions TO authenticated;
GRANT ALL ON public.part_transactions TO service_role;
ALTER TABLE public.part_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team views part movements" ON public.part_transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Team records part movements" ON public.part_transactions FOR INSERT TO authenticated WITH CHECK (performed_by = auth.uid());

CREATE OR REPLACE FUNCTION public.apply_part_transaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.kind NOT IN ('receive','issue','adjust','return') THEN
    RAISE EXCEPTION 'Invalid movement type %', NEW.kind;
  END IF;

  IF NEW.kind = 'adjust' THEN
    UPDATE public.parts SET qty_on_hand = NEW.qty, updated_at = now() WHERE id = NEW.part_id;
  ELSIF NEW.kind = 'issue' THEN
    UPDATE public.parts SET qty_on_hand = GREATEST(qty_on_hand - abs(NEW.qty), 0), updated_at = now() WHERE id = NEW.part_id;
  ELSE
    UPDATE public.parts SET qty_on_hand = qty_on_hand + abs(NEW.qty), updated_at = now() WHERE id = NEW.part_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER part_transactions_apply AFTER INSERT ON public.part_transactions
FOR EACH ROW EXECUTE FUNCTION public.apply_part_transaction();

REVOKE ALL ON FUNCTION public.apply_part_transaction() FROM PUBLIC, anon, authenticated;

CREATE INDEX part_assets_asset_idx ON public.part_assets(asset_id);
CREATE INDEX part_transactions_part_idx ON public.part_transactions(part_id, created_at DESC);
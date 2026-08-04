CREATE TABLE public.manuals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  file_url text NOT NULL,
  kind text NOT NULL DEFAULT 'link',
  asset_id uuid REFERENCES public.assets(id) ON DELETE SET NULL,
  manufacturer text,
  notes text,
  added_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.manuals TO authenticated;
GRANT ALL ON public.manuals TO service_role;

ALTER TABLE public.manuals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team can view manuals" ON public.manuals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Team can add manuals" ON public.manuals FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Team can edit manuals" ON public.manuals FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admins delete manuals" ON public.manuals FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX manuals_asset_id_idx ON public.manuals(asset_id);

CREATE TRIGGER manuals_updated BEFORE UPDATE ON public.manuals
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TABLE public.asset_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  kind text NOT NULL DEFAULT 'equipment',
  caption text,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX asset_photos_asset_idx ON public.asset_photos(asset_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.asset_photos TO authenticated;
GRANT ALL ON public.asset_photos TO service_role;

ALTER TABLE public.asset_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team can view asset photos" ON public.asset_photos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Team can add asset photos" ON public.asset_photos
  FOR INSERT TO authenticated WITH CHECK (uploaded_by = auth.uid());

CREATE POLICY "Uploaders can update their asset photos" ON public.asset_photos
  FOR UPDATE TO authenticated USING (uploaded_by = auth.uid()) WITH CHECK (uploaded_by = auth.uid());

CREATE POLICY "Uploaders or approvers can delete asset photos" ON public.asset_photos
  FOR DELETE TO authenticated
  USING (uploaded_by = auth.uid() OR public.can_approve_deletions(auth.uid()));

CREATE TRIGGER asset_photos_updated BEFORE UPDATE ON public.asset_photos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Team can read asset photo files" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'asset-photos');

CREATE POLICY "Team can upload asset photo files" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'asset-photos' AND owner = auth.uid());

CREATE POLICY "Owners can update asset photo files" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'asset-photos' AND owner = auth.uid());

CREATE POLICY "Owners or approvers can delete asset photo files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'asset-photos' AND (owner = auth.uid() OR public.can_approve_deletions(auth.uid())));
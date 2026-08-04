DROP VIEW IF EXISTS public.team_directory;

CREATE TABLE public.team_directory (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.team_directory TO authenticated;
GRANT ALL ON public.team_directory TO service_role;
ALTER TABLE public.team_directory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users view team directory" ON public.team_directory
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users update own directory entry" ON public.team_directory
FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

INSERT INTO public.team_directory (id, full_name)
SELECT id, full_name FROM public.profiles
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.sync_team_directory()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.team_directory (id, full_name, updated_at)
  VALUES (NEW.id, NEW.full_name, now())
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, updated_at = now();
  RETURN NEW;
END; $$;

REVOKE ALL ON FUNCTION public.sync_team_directory() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER profiles_sync_directory
AFTER INSERT OR UPDATE OF full_name ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_team_directory();
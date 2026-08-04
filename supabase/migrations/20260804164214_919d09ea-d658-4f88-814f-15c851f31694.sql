ALTER TABLE public.pm_schedules
  ADD COLUMN IF NOT EXISTS season_start_md text,
  ADD COLUMN IF NOT EXISTS season_end_md text;

UPDATE public.pm_schedules p
SET season_start_md = '03-15', season_end_md = '11-15'
WHERE p.title ILIKE '%uv%'
   OR p.asset_id IN (SELECT id FROM public.assets WHERE name ILIKE '%uv%');
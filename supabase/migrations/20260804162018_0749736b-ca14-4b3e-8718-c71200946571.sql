ALTER TABLE public.pm_schedules
  ADD COLUMN IF NOT EXISTS limble_task_id integer,
  ADD COLUMN IF NOT EXISTS assigned_label text,
  ADD COLUMN IF NOT EXISTS estimated_hours numeric;

CREATE UNIQUE INDEX IF NOT EXISTS pm_schedules_limble_task_id_key ON public.pm_schedules (limble_task_id) WHERE limble_task_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS pm_schedules_next_due_idx ON public.pm_schedules (next_due);
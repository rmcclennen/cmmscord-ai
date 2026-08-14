ALTER TABLE public.pm_schedules DISABLE TRIGGER pm_deleted_notify;

WITH ranked AS (
  SELECT id, asset_id, title,
         row_number() OVER (
           PARTITION BY asset_id, title
           ORDER BY (next_due >= current_date) DESC,
                    CASE WHEN next_due >= current_date THEN next_due END ASC,
                    next_due DESC,
                    created_at ASC
         ) AS rn
  FROM public.pm_schedules
),
dupes AS (SELECT id FROM ranked WHERE rn > 1)
UPDATE public.work_orders wo SET pm_schedule_id = NULL
WHERE wo.pm_schedule_id IN (SELECT id FROM dupes);

WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY asset_id, title
           ORDER BY (next_due >= current_date) DESC,
                    CASE WHEN next_due >= current_date THEN next_due END ASC,
                    next_due DESC,
                    created_at ASC
         ) AS rn
  FROM public.pm_schedules
)
DELETE FROM public.pm_schedules p
USING ranked r
WHERE p.id = r.id AND r.rn > 1;

ALTER TABLE public.pm_schedules ENABLE TRIGGER pm_deleted_notify;
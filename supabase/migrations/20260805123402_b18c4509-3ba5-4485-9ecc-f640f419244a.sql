CREATE OR REPLACE FUNCTION public.notify_part_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  actor text;
  photo_note text := '';
BEGIN
  SELECT COALESCE(full_name, email, 'A teammate') INTO actor FROM public.profiles WHERE id = NEW.requested_by;
  IF array_length(NEW.photo_paths, 1) > 0 THEN
    photo_note := ' — ' || array_length(NEW.photo_paths, 1) || ' photo(s) attached';
  END IF;

  IF NEW.sent_to IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, body, kind, link)
    VALUES (NEW.sent_to,
            'Parts needed: ' || NEW.title,
            COALESCE(actor, 'A teammate') || ' requested parts' || photo_note || E'\n' || NEW.part_lines,
            'part_request',
            '/part-requests');
  ELSE
    INSERT INTO public.notifications (user_id, title, body, kind, link)
    SELECT DISTINCT ur.user_id,
           'Parts needed: ' || NEW.title,
           COALESCE(actor, 'A teammate') || ' requested parts' || photo_note || E'\n' || NEW.part_lines,
           'part_request',
           '/part-requests'
    FROM public.user_roles ur
    WHERE ur.role IN ('admin'::app_role, 'manager'::app_role, 'supervisor'::app_role)
      AND ur.user_id <> COALESCE(NEW.requested_by, '00000000-0000-0000-0000-000000000000'::uuid);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER part_request_created_notify AFTER INSERT ON public.part_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_part_request();

CREATE OR REPLACE FUNCTION public.notify_part_request_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  actor text;
BEGIN
  IF NEW.status = OLD.status OR NEW.requested_by IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(full_name, email, 'A teammate') INTO actor FROM public.profiles WHERE id = auth.uid();

  INSERT INTO public.notifications (user_id, title, body, kind, link)
  VALUES (NEW.requested_by,
          'Parts request ' || NEW.status || ': ' || NEW.title,
          COALESCE(actor, 'A teammate') || ' marked your parts request as ' || NEW.status
            || COALESCE(' — ' || NEW.vendor, '') || COALESCE(' — ' || NEW.decision_note, ''),
          'part_request_status',
          '/part-requests');

  RETURN NEW;
END;
$$;

CREATE TRIGGER part_request_status_notify AFTER UPDATE ON public.part_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_part_request_status();

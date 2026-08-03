-- roles
CREATE TYPE public.app_role AS ENUM ('admin','technician','viewer');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users can view profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users manage own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'technician',
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE POLICY "Users can view roles" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'technician') ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- assets
CREATE TABLE public.assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  limble_asset_id integer UNIQUE,
  parent_limble_id integer,
  name text NOT NULL,
  location_name text,
  make text,
  model text,
  category text,
  class text,
  commission_date text,
  manufacturer text,
  serial_number text,
  supplier text,
  tag_number text,
  enclosure text,
  frame text,
  hp text,
  hertz text,
  phase text,
  rpm text,
  volts text,
  type text,
  manuals text,
  manufacturer_url text,
  criticality text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'operational',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX assets_parent_idx ON public.assets(parent_limble_id);
CREATE INDEX assets_class_idx ON public.assets(class);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assets TO authenticated;
GRANT ALL ON public.assets TO service_role;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team can view assets" ON public.assets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Team can add assets" ON public.assets FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Team can edit assets" ON public.assets FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admins delete assets" ON public.assets FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER assets_updated BEFORE UPDATE ON public.assets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- pm schedules
CREATE TABLE public.pm_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid REFERENCES public.assets(id) ON DELETE CASCADE,
  title text NOT NULL,
  tasks text,
  interval_days integer NOT NULL DEFAULT 30,
  priority text NOT NULL DEFAULT 'medium',
  last_completed date,
  next_due date NOT NULL DEFAULT CURRENT_DATE,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pm_asset_idx ON public.pm_schedules(asset_id);
CREATE INDEX pm_due_idx ON public.pm_schedules(next_due);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pm_schedules TO authenticated;
GRANT ALL ON public.pm_schedules TO service_role;
ALTER TABLE public.pm_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team manages PMs" ON public.pm_schedules FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER pm_updated BEFORE UPDATE ON public.pm_schedules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- work orders
CREATE SEQUENCE public.work_order_number_seq START 1000;
CREATE TABLE public.work_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wo_number integer NOT NULL DEFAULT nextval('public.work_order_number_seq'),
  asset_id uuid REFERENCES public.assets(id) ON DELETE SET NULL,
  pm_schedule_id uuid REFERENCES public.pm_schedules(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  wo_type text NOT NULL DEFAULT 'corrective',
  status text NOT NULL DEFAULT 'open',
  priority text NOT NULL DEFAULT 'medium',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  due_date date,
  completed_at timestamptz,
  labor_hours numeric,
  parts_used text,
  completion_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX wo_asset_idx ON public.work_orders(asset_id);
CREATE INDEX wo_status_idx ON public.work_orders(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_orders TO authenticated;
GRANT ALL ON public.work_orders TO service_role;
ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team manages work orders" ON public.work_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER wo_updated BEFORE UPDATE ON public.work_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- AI maintenance research
CREATE TABLE public.asset_maintenance_info (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  summary text,
  intervals jsonb NOT NULL DEFAULT '[]'::jsonb,
  parts jsonb NOT NULL DEFAULT '[]'::jsonb,
  sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ami_asset_idx ON public.asset_maintenance_info(asset_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.asset_maintenance_info TO authenticated;
GRANT ALL ON public.asset_maintenance_info TO service_role;
ALTER TABLE public.asset_maintenance_info ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team manages maintenance info" ON public.asset_maintenance_info FOR ALL TO authenticated USING (true) WITH CHECK (true);
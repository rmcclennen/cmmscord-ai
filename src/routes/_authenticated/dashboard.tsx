import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WorkOrderDialog } from "@/components/work-order-dialog";
import { dueTone, prettyLabel } from "@/lib/cmms";
import { AlertTriangle, Boxes, CalendarClock, ClipboardList, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Maintenance Dashboard | Plant Maintenance" },
      { name: "description", content: "Overdue PMs, upcoming preventive maintenance, and open work orders." },
      { property: "og:title", content: "Maintenance Dashboard" },
      { property: "og:description", content: "Plant maintenance status at a glance." },
    ],
  }),
  component: Dashboard,
});

const today = () => new Date().toISOString().slice(0, 10);
const inDays = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

function Dashboard() {
  const stats = useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: async () => {
      const [assets, pms, overdue, upcoming, openWo] = await Promise.all([
        supabase.from("assets").select("id", { count: "exact", head: true }),
        supabase.from("pm_schedules").select("id", { count: "exact", head: true }).eq("active", true),
        supabase
          .from("pm_schedules")
          .select("id", { count: "exact", head: true })
          .eq("active", true)
          .lt("next_due", today()),
        supabase
          .from("pm_schedules")
          .select("id", { count: "exact", head: true })
          .eq("active", true)
          .gte("next_due", today())
          .lte("next_due", inDays(30)),
        supabase
          .from("work_orders")
          .select("id", { count: "exact", head: true })
          .in("status", ["open", "in_progress", "on_hold"]),
      ]);
      return {
        assets: assets.count ?? 0,
        pms: pms.count ?? 0,
        overdue: overdue.count ?? 0,
        upcoming: upcoming.count ?? 0,
        openWo: openWo.count ?? 0,
      };
    },
  });

  const duePms = useQuery({
    queryKey: ["dashboard", "due-pms"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pm_schedules")
        .select("id, title, next_due, priority, interval_days, assets(id, name)")
        .eq("active", true)
        .order("next_due")
        .limit(12);
      if (error) throw error;
      return data;
    },
  });

  const workOrders = useQuery({
    queryKey: ["dashboard", "work-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_orders")
        .select("id, wo_number, title, status, priority, due_date, assets(name)")
        .in("status", ["open", "in_progress", "on_hold"])
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data;
    },
  });

  const cards = [
    { label: "Assets tracked", value: stats.data?.assets, icon: Boxes, to: "/assets" as const },
    { label: "Active PMs", value: stats.data?.pms, icon: CalendarClock, to: "/pm-schedule" as const },
    { label: "Overdue PMs", value: stats.data?.overdue, icon: AlertTriangle, to: "/pm-schedule" as const, alert: true },
    { label: "Open work orders", value: stats.data?.openWo, icon: ClipboardList, to: "/work-orders" as const },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-caps">Control room</p>
          <h1 className="text-2xl font-bold">Maintenance dashboard</h1>
        </div>
        <WorkOrderDialog
          trigger={
            <Button>
              <Plus className="size-4" /> New work order
            </Button>
          }
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <Link key={c.label} to={c.to} className="panel p-4 transition-colors hover:border-primary/50">
            <div className="flex items-center justify-between">
              <span className="label-caps">{c.label}</span>
              <c.icon className={`size-4 ${c.alert ? "text-destructive" : "text-primary"}`} />
            </div>
            <p
              className={`mt-2 font-mono text-3xl font-bold ${
                c.alert && (c.value ?? 0) > 0 ? "text-destructive" : "text-foreground"
              }`}
            >
              {c.value ?? "—"}
            </p>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="panel p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide">Next preventive maintenance</h2>
          <ul className="mt-3 divide-y divide-border">
            {(duePms.data ?? []).map((pm) => {
              const tone = dueTone(pm.next_due);
              return (
                <li key={pm.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{pm.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {pm.assets?.name ?? "Unassigned asset"} · every {pm.interval_days} days
                    </p>
                  </div>
                  <Badge
                    variant={tone === "overdue" ? "destructive" : tone === "due" ? "secondary" : "outline"}
                    className="font-mono"
                  >
                    {pm.next_due}
                  </Badge>
                  <WorkOrderDialog
                    assetId={pm.assets?.id ?? null}
                    pmScheduleId={pm.id}
                    defaultTitle={pm.title}
                    lockAsset
                    trigger={
                      <Button size="sm" variant="ghost">
                        Issue WO
                      </Button>
                    }
                  />
                </li>
              );
            })}
            {duePms.isLoading && <li className="py-3 text-sm text-muted-foreground">Loading…</li>}
          </ul>
        </section>

        <section className="panel p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide">Active work orders</h2>
          <ul className="mt-3 divide-y divide-border">
            {(workOrders.data ?? []).map((wo) => (
              <li key={wo.id} className="flex items-center gap-3 py-2.5">
                <span className="font-mono text-xs text-muted-foreground">WO-{wo.wo_number}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{wo.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{wo.assets?.name ?? "No asset"}</p>
                </div>
                <Badge variant="outline">{prettyLabel(wo.status)}</Badge>
              </li>
            ))}
            {!workOrders.isLoading && (workOrders.data ?? []).length === 0 && (
              <li className="py-3 text-sm text-muted-foreground">No active work orders.</li>
            )}
          </ul>
          <Link to="/work-orders" className="mt-3 inline-block text-sm text-primary underline">
            View all work orders
          </Link>
        </section>
      </div>
    </div>
  );
}

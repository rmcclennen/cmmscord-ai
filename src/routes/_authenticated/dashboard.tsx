import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { WorkOrderDialog } from "@/components/work-order-dialog";
import { dueTone, prettyLabel } from "@/lib/cmms";
import {
  AlertTriangle,
  Boxes,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Plus,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Maintenance Calendar | AssetCareConnect" },
      {
        name: "description",
        content: "Monthly calendar of preventive maintenance and work orders due dates.",
      },
      { property: "og:title", content: "Maintenance Calendar" },
      { property: "og:description", content: "Plant maintenance schedule at a glance." },
    ],
  }),
  component: Dashboard,
});

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const today = () => iso(new Date());
const inDays = (n: number) => iso(new Date(Date.now() + n * 86400000));
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type CalItem = {
  kind: "pm" | "wo";
  id: string;
  title: string;
  date: string;
  assetId: string | null;
  assetName: string | null;
  meta: string;
};

function Dashboard() {
  const now = new Date();
  const [month, setMonth] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [selected, setSelected] = useState<string | null>(null);

  const rangeStart = iso(new Date(month.y, month.m, 1));
  const rangeEnd = iso(new Date(month.y, month.m + 1, 0));

  const stats = useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: async () => {
      const [assets, pms, overdue, openWo] = await Promise.all([
        supabase.from("assets").select("id", { count: "exact", head: true }),
        supabase
          .from("pm_schedules")
          .select("id", { count: "exact", head: true })
          .eq("active", true),
        supabase
          .from("pm_schedules")
          .select("id", { count: "exact", head: true })
          .eq("active", true)
          .lt("next_due", today()),
        supabase
          .from("work_orders")
          .select("id", { count: "exact", head: true })
          .in("status", ["open", "in_progress", "on_hold"]),
      ]);
      return {
        assets: assets.count ?? 0,
        pms: pms.count ?? 0,
        overdue: overdue.count ?? 0,
        openWo: openWo.count ?? 0,
      };
    },
  });

  const calendar = useQuery({
    queryKey: ["dashboard", "calendar", rangeStart],
    queryFn: async (): Promise<CalItem[]> => {
      const [pms, wos] = await Promise.all([
        supabase
          .from("pm_schedules")
          .select("id, title, next_due, interval_days, assets(id, name)")
          .eq("active", true)
          .gte("next_due", rangeStart)
          .lte("next_due", rangeEnd)
          .order("next_due"),
        supabase
          .from("work_orders")
          .select("id, wo_number, title, status, due_date, asset_id, assets(name)")
          .not("due_date", "is", null)
          .gte("due_date", rangeStart)
          .lte("due_date", rangeEnd)
          .order("due_date"),
      ]);
      if (pms.error) throw pms.error;
      if (wos.error) throw wos.error;
      const items: CalItem[] = [];
      for (const pm of pms.data ?? []) {
        items.push({
          kind: "pm",
          id: pm.id,
          title: pm.title,
          date: pm.next_due as string,
          assetId: pm.assets?.id ?? null,
          assetName: pm.assets?.name ?? null,
          meta: `every ${pm.interval_days} days`,
        });
      }
      for (const wo of wos.data ?? []) {
        items.push({
          kind: "wo",
          id: wo.id,
          title: wo.title,
          date: wo.due_date as string,
          assetId: wo.asset_id ?? null,
          assetName: wo.assets?.name ?? null,
          meta: `WO-${wo.wo_number} · ${prettyLabel(wo.status)}`,
        });
      }
      return items;
    },
  });

  const byDate = useMemo(() => {
    const map = new Map<string, CalItem[]>();
    for (const it of calendar.data ?? []) {
      const list = map.get(it.date) ?? [];
      list.push(it);
      map.set(it.date, list);
    }
    return map;
  }, [calendar.data]);

  const days = useMemo(() => {
    const first = new Date(month.y, month.m, 1);
    const lead = first.getDay();
    const total = new Date(month.y, month.m + 1, 0).getDate();
    const cells: (string | null)[] = Array.from({ length: lead }, () => null);
    for (let d = 1; d <= total; d++) cells.push(iso(new Date(month.y, month.m, d)));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [month]);

  const shift = (delta: number) => {
    const d = new Date(month.y, month.m + delta, 1);
    setMonth({ y: d.getFullYear(), m: d.getMonth() });
  };

  const cards = [
    {
      label: "Active PMs",
      value: stats.data?.pms,
      icon: CalendarClock,
      to: "/pm-schedule" as const,
    },
    {
      label: "Overdue PMs",
      value: stats.data?.overdue,
      icon: AlertTriangle,
      to: "/pm-schedule" as const,
      alert: true,
    },
    {
      label: "Open work orders",
      value: stats.data?.openWo,
      icon: ClipboardList,
      to: "/work-orders" as const,
    },
    { label: "Assets tracked", value: stats.data?.assets, icon: Boxes, to: "/assets" as const },
  ];

  const selectedItems = selected ? (byDate.get(selected) ?? []) : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-caps">Control room</p>
          <h1 className="text-2xl font-bold">Maintenance calendar</h1>
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
          <Link
            key={c.label}
            to={c.to}
            className="panel p-4 transition-colors hover:border-primary/50"
          >
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

      <section className="panel p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide">
            {MONTHS[month.m]} {month.y}
          </h2>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => shift(-1)}
              aria-label="Previous month"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setMonth({ y: new Date().getFullYear(), m: new Date().getMonth() })}
            >
              Today
            </Button>
            <Button size="sm" variant="outline" onClick={() => shift(1)} aria-label="Next month">
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-7 gap-px text-center">
          {DOW.map((d) => (
            <div key={d} className="pb-2 text-xs font-medium uppercase text-muted-foreground">
              {d}
            </div>
          ))}
          {days.map((date, i) => {
            if (!date) return <div key={`e${i}`} className="min-h-24 rounded-md bg-muted/20" />;
            const items = byDate.get(date) ?? [];
            const isToday = date === today();
            return (
              <button
                key={date}
                type="button"
                onClick={() => setSelected(date)}
                className={`min-h-24 rounded-md border p-1.5 text-left transition-colors hover:border-primary/60 ${
                  isToday ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`font-mono text-xs ${isToday ? "text-primary" : "text-muted-foreground"}`}
                  >
                    {Number(date.slice(8))}
                  </span>
                  {items.length > 0 && (
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {items.length}
                    </span>
                  )}
                </div>
                <div className="mt-1 space-y-1">
                  {items.slice(0, 3).map((it) => (
                    <span
                      key={it.kind + it.id}
                      className={`block truncate rounded px-1 py-0.5 text-[10px] ${
                        it.kind === "wo"
                          ? "bg-secondary text-secondary-foreground"
                          : dueTone(it.date) === "overdue"
                            ? "bg-destructive/15 text-destructive"
                            : "bg-primary/15 text-primary"
                      }`}
                    >
                      {it.title}
                    </span>
                  ))}
                  {items.length > 3 && (
                    <span className="block px-1 text-[10px] text-muted-foreground">
                      +{items.length - 3} more
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-primary/40" /> Preventive maintenance
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-secondary" /> Work orders
          </span>
          {calendar.isLoading && <span>Loading…</span>}
        </div>
      </section>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selected}</DialogTitle>
          </DialogHeader>
          <ul className="max-h-[60vh] divide-y divide-border overflow-y-auto">
            {selectedItems.map((it) => (
              <li key={it.kind + it.id} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{it.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {it.assetName ?? "No asset"} · {it.meta}
                  </p>
                </div>
                <Badge variant={it.kind === "wo" ? "secondary" : "outline"}>
                  {it.kind === "wo" ? "WO" : "PM"}
                </Badge>
                {it.kind === "pm" ? (
                  <WorkOrderDialog
                    assetId={it.assetId}
                    pmScheduleId={it.id}
                    defaultTitle={it.title}
                    lockAsset
                    trigger={
                      <Button size="sm" variant="ghost">
                        Issue WO
                      </Button>
                    }
                  />
                ) : (
                  <Link to="/work-orders" className="text-xs text-primary underline">
                    Open
                  </Link>
                )}
              </li>
            ))}
            {selectedItems.length === 0 && (
              <li className="py-3 text-sm text-muted-foreground">Nothing scheduled this day.</li>
            )}
          </ul>
          <div className="flex gap-3 text-sm">
            <Link to="/pm-schedule" className="text-primary underline">
              PM schedule
            </Link>
            <Link to="/work-orders" className="text-primary underline">
              Work orders
            </Link>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WorkOrderDialog } from "@/components/work-order-dialog";
import { EditPmScheduleDialog } from "@/components/edit-pm-schedule-dialog";
import { clampToSeason, daysUntil, prettyLabel, seasonLabel } from "@/lib/cmms";
import { toast } from "sonner";
import { AlertTriangle, CalendarClock, CheckCircle2, RefreshCw } from "lucide-react";

const isoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const Route = createFileRoute("/_authenticated/pm-due")({
  head: () => ({
    meta: [
      { title: "PMs Due & Overdue | AssetCareConnect" },
      {
        name: "description",
        content:
          "Daily list of preventive maintenance tasks that are overdue, due today, or due this week.",
      },
      { property: "og:title", content: "PMs Due & Overdue" },
      {
        property: "og:description",
        content: "Today's preventive maintenance worklist, refreshed automatically every day.",
      },
    ],
  }),
  component: PmDuePage,
});

function PmDuePage() {
  const queryClient = useQueryClient();
  const [day, setDay] = useState(() => isoDay(new Date()));

  // Roll the worklist over automatically at midnight (and whenever the tab
  // regains focus on a new calendar day).
  useEffect(() => {
    const tick = () => {
      const current = isoDay(new Date());
      setDay((prev) => (prev === current ? prev : current));
    };
    const interval = window.setInterval(tick, 60_000);
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", tick);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);

  const horizon = isoDay(new Date(new Date(day + "T00:00:00").getTime() + 7 * 86400000));

  const pms = useQuery({
    queryKey: ["pms", "due", day],
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pm_schedules")
        .select(
          "*, assets(id, name, location_name, building, tag_number, class, manufacturer, model)",
        )
        .eq("active", true)
        .lte("next_due", horizon)
        .order("next_due");
      if (error) throw error;
      return data;
    },
  });

  const complete = useMutation({
    mutationFn: async (pm: {
      id: string;
      interval_days: number;
      season_start_md: string | null;
      season_end_md: string | null;
    }) => {
      const raw = isoDay(new Date(Date.now() + pm.interval_days * 86400000));
      const next = clampToSeason(raw, pm.season_start_md, pm.season_end_md);
      const { error } = await supabase
        .from("pm_schedules")
        .update({ last_completed: day, next_due: next })
        .eq("id", pm.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("PM marked complete and rescheduled");
      queryClient.invalidateQueries({ queryKey: ["pms"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  type Row = NonNullable<typeof pms.data>[number];
  const rows = pms.data ?? [];
  const overdue = rows.filter((p) => p.next_due < day);
  const dueToday = rows.filter((p) => p.next_due === day);
  const dueSoon = rows.filter((p) => p.next_due > day);

  const renderRow = (pm: Row) => {
    const d = daysUntil(pm.next_due);
    return (
      <div key={pm.id} className="flex flex-wrap items-center gap-3 p-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{pm.title}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            {pm.assets ? (
              <Link
                to="/assets/$assetId"
                params={{ assetId: pm.assets.id }}
                className="font-medium text-foreground hover:underline"
              >
                {pm.assets.name}
              </Link>
            ) : (
              <span className="italic">Unassigned equipment asset</span>
            )}
            <span>·</span>
            <span>every {pm.interval_days} days</span>
            <span>·</span>
            <span>{prettyLabel(pm.priority)}</span>
            {pm.last_completed && <span>· last done {pm.last_completed}</span>}
          </div>
          {pm.tasks && <p className="mt-1 text-xs text-muted-foreground">{pm.tasks}</p>}
        </div>
        {seasonLabel(pm.season_start_md, pm.season_end_md) && (
          <Badge variant="outline" className="border-primary/40 text-primary">
            Seasonal · {seasonLabel(pm.season_start_md, pm.season_end_md)}
          </Badge>
        )}
        <Badge
          variant={d !== null && d < 0 ? "destructive" : "secondary"}
          className="font-mono"
          title={pm.next_due}
        >
          {d === null
            ? pm.next_due
            : d < 0
              ? `${Math.abs(d)}d overdue`
              : d === 0
                ? "Due today"
                : `in ${d}d`}
        </Badge>
        <EditPmScheduleDialog pm={pm} />
        <WorkOrderDialog
          assetId={pm.asset_id}
          pmScheduleId={pm.id}
          defaultTitle={pm.title}
          lockAsset
          trigger={
            <Button size="sm" variant="outline">
              Issue WO
            </Button>
          }
        />
        <Button
          size="sm"
          variant="ghost"
          disabled={complete.isPending}
          onClick={() =>
            complete.mutate({
              id: pm.id,
              interval_days: pm.interval_days,
              season_start_md: pm.season_start_md,
              season_end_md: pm.season_end_md,
            })
          }
        >
          <CheckCircle2 className="size-4" /> Complete
        </Button>
      </div>
    );
  };

  const section = (
    title: string,
    icon: typeof AlertTriangle,
    list: Row[],
    tone: "danger" | "warn" | "muted",
  ) => {
    const Icon = icon;
    return (
      <section className="panel overflow-hidden">
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide">
            <Icon
              className={`size-4 ${tone === "danger" ? "text-destructive" : tone === "warn" ? "text-primary" : "text-muted-foreground"}`}
            />
            {title}
          </h2>
          <Badge variant={tone === "danger" ? "destructive" : "secondary"} className="font-mono">
            {list.length}
          </Badge>
        </div>
        {list.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Nothing here — all clear.</p>
        ) : (
          <div className="divide-y divide-border">{list.map(renderRow)}</div>
        )}
      </section>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-caps">Daily worklist · {day}</p>
          <h1 className="text-2xl font-bold">PMs due &amp; overdue</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => pms.refetch()}
            disabled={pms.isFetching}
            className="gap-1.5 text-xs font-semibold"
          >
            <RefreshCw className={`size-3.5 ${pms.isFetching ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Link to="/pm-schedule">
            <Button variant="outline" size="sm" className="text-xs font-semibold">
              Full PM schedule
            </Button>
          </Link>
        </div>
      </div>

      {pms.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading today's worklist…</p>
      ) : pms.error ? (
        <p className="text-sm text-destructive">{(pms.error as Error).message}</p>
      ) : (
        <div className="space-y-4">
          {section("Overdue", AlertTriangle, overdue, "danger")}
          {section("Due today", CalendarClock, dueToday, "warn")}
          {section("Due within 7 days", CalendarClock, dueSoon, "muted")}
        </div>
      )}
    </div>
  );
}

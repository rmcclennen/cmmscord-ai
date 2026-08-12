import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WorkOrderDialog } from "@/components/work-order-dialog";
import { DeleteRequestDialog } from "@/components/delete-request-dialog";
import { RelabelAssetDialog } from "@/components/relabel-asset-dialog";
import { EditPmScheduleDialog } from "@/components/edit-pm-schedule-dialog";
import { CreatePmScheduleDialog } from "@/components/create-pm-schedule-dialog";
import { MatchPmAssetDialog } from "@/components/match-pm-asset-dialog";
import { buildingOf, clampToSeason, dueTone, prettyLabel, seasonLabel } from "@/lib/cmms";
import { useTeamMembers } from "@/hooks/use-team-members";
import { memberLabel, notifyUser } from "@/lib/notify";
import { toast } from "sonner";
import { CalendarPlus, CheckCircle2, Layers, Pencil, Search, Sparkles, Tag } from "lucide-react";

const PAGE_SIZE = 40;
const today = () => new Date().toISOString().slice(0, 10);
const inDays = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

export const Route = createFileRoute("/_authenticated/pm-schedule")({
  head: () => ({
    meta: [
      { title: "PM Schedule | AssetCareConnect" },
      {
        name: "description",
        content: "Preventive maintenance schedule with overdue, due-soon, and upcoming tasks.",
      },
      { property: "og:title", content: "PM Schedule" },
      {
        property: "og:description",
        content: "Track and complete preventive maintenance across the plant.",
      },
    ],
  }),
  component: PmSchedulePage,
});

function PmSchedulePage() {
  const [search, setSearch] = useState("");
  const [window, setWindow] = useState("all");
  const [page, setPage] = useState(0);
  const [grouped, setGrouped] = useState(true);
  const [tab, setTab] = useState("all");
  const queryClient = useQueryClient();
  const team = useTeamMembers();

  const assign = useMutation({
    mutationFn: async (pm: {
      id: string;
      title: string;
      next_due: string;
      userId: string | null;
    }) => {
      const { error } = await supabase
        .from("pm_schedules")
        .update({ assigned_to: pm.userId })
        .eq("id", pm.id);
      if (error) throw error;
      if (pm.userId) {
        await notifyUser({
          userId: pm.userId,
          title: "PM task assigned to you",
          body: `${pm.title} · next due ${pm.next_due}`,
          link: "/pm-schedule",
        });
      }
    },
    onSuccess: () => {
      toast.success("PM assignment updated");
      queryClient.invalidateQueries({ queryKey: ["pms"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const pms = useQuery({
    queryKey: ["pms", search, window, page, grouped],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const history = window === "history";
      const from = grouped ? 0 : page * PAGE_SIZE;
      const to = grouped ? 999 : page * PAGE_SIZE + PAGE_SIZE - 1;
      let query = supabase
        .from("pm_schedules")
        .select(
          "*, assets(id, name, location_name, building, tag_number, class, manufacturer, model)",
          { count: "exact" },
        )
        .eq("active", !history)
        .order("next_due", { ascending: !history })
        .range(from, to);
      if (search.trim()) query = query.ilike("title", `%${search.trim()}%`);
      if (window === "overdue") query = query.lt("next_due", today());
      if (window === "week") query = query.gte("next_due", today()).lte("next_due", inDays(7));
      if (window === "month") query = query.gte("next_due", today()).lte("next_due", inDays(30));
      const { data, error, count } = await query;
      if (error) throw error;
      return { rows: data, count: count ?? 0 };
    },
  });

  const complete = useMutation({
    mutationFn: async (pm: {
      id: string;
      interval_days: number;
      season_start_md: string | null;
      season_end_md: string | null;
    }) => {
      const raw = new Date(Date.now() + pm.interval_days * 86400000).toISOString().slice(0, 10);
      const next = clampToSeason(raw, pm.season_start_md, pm.season_end_md);
      const { error } = await supabase
        .from("pm_schedules")
        .update({ last_completed: today(), next_due: next })
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

  const total = pms.data?.count ?? 0;
  const maxPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);
  type Row = NonNullable<typeof pms.data>["rows"][number];

  const unassignedCount = (pms.data?.rows ?? []).filter((p) => !p.asset_id).length;

  const renderRow = (pm: Row) => {
    const tone = dueTone(pm.next_due);
    return (
      <div key={pm.id} className="flex flex-wrap items-center gap-3 p-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{pm.title}</p>
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
            {pm.assets ? (
              <span className="inline-flex items-center gap-1">
                <Link
                  to="/assets/$assetId"
                  params={{ assetId: pm.assets.id }}
                  className="font-medium text-foreground hover:underline"
                >
                  {pm.assets.name}
                </Link>
                {pm.assets.tag_number && (
                  <span className="font-mono text-[11px] text-primary">
                    [{pm.assets.tag_number}]
                  </span>
                )}
                <RelabelAssetDialog
                  assetId={pm.assets.id}
                  initialAsset={pm.assets}
                  trigger={
                    <button
                      type="button"
                      className="inline-flex items-center text-primary/80 hover:text-primary ml-0.5 p-0.5 rounded hover:bg-primary/10 transition-colors"
                      title="Relabel asset and sync across all PMs and views"
                    >
                      <Pencil className="size-3" />
                    </button>
                  }
                />
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-medium">
                <span className="italic">Unassigned equipment asset</span>
                <EditPmScheduleDialog
                  pm={pm}
                  trigger={
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-5 px-1.5 text-[10px] gap-1 border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                    >
                      <Sparkles className="size-2.5" /> Match Asset
                    </Button>
                  }
                />
              </span>
            )}
            <span>·</span>
            <span>every {pm.interval_days} days</span>
            <span>·</span>
            <span>{prettyLabel(pm.priority)}</span>
            {pm.estimated_hours != null && <span>· {pm.estimated_hours} hrs</span>}
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
          variant={tone === "overdue" ? "destructive" : tone === "due" ? "secondary" : "outline"}
          className="font-mono"
        >
          {pm.next_due}
        </Badge>
        <Select
          value={pm.assigned_to ?? "unassigned"}
          onValueChange={(v) =>
            assign.mutate({
              id: pm.id,
              title: pm.title,
              next_due: pm.next_due,
              userId: v === "unassigned" ? null : v,
            })
          }
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Send to…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {(team.data ?? []).map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {memberLabel(m)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

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
        <DeleteRequestDialog entityType="pm_schedule" entityId={pm.id} entityLabel={pm.title} />
      </div>
    );
  };

  const groups = (() => {
    const map = new Map<string, Row[]>();
    for (const pm of pms.data?.rows ?? []) {
      const key = buildingOf(
        pm.assets?.name,
        pm.title,
        pm.assets?.location_name,
        pm.assets?.building,
      );
      const list = map.get(key);
      if (list) list.push(pm);
      else map.set(key, [pm]);
    }
    return [...map.entries()].sort((a, b) =>
      a[0] === "Other / Unassigned"
        ? 1
        : b[0] === "Other / Unassigned"
          ? -1
          : a[0].localeCompare(b[0]),
    );
  })();

  const activeTab = tab === "all" || groups.some(([b]) => b === tab) ? tab : "all";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="label-caps">Preventive maintenance</p>
          <h1 className="text-2xl font-bold">PM schedule</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/assets">
            <Button variant="outline" className="gap-1.5 text-xs font-semibold">
              <Layers className="size-3.5" /> Plant Assets Register
            </Button>
          </Link>
          <MatchPmAssetDialog
            trigger={
              <Button
                variant="outline"
                className="gap-1.5 font-semibold text-xs border-primary/40 text-primary hover:bg-primary/10"
              >
                <Sparkles className="size-3.5" /> Match PMs to Assets
              </Button>
            }
          />
          <CreatePmScheduleDialog
            trigger={
              <Button className="gap-1.5 font-semibold">
                <CalendarPlus className="size-4" /> Schedule New PM
              </Button>
            }
          />
        </div>
      </div>

      {unassignedCount > 0 && (
        <div className="panel p-3.5 bg-amber-500/10 border-amber-500/30 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300">
              <Sparkles className="size-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {unassignedCount} PM schedule{unassignedCount > 1 ? "s" : ""} need equipment
                matching
              </p>
              <p className="text-xs text-muted-foreground">
                Link maintenance routines to registered plant assets to enable automated asset
                tracking, history, and O&amp;M correlation.
              </p>
            </div>
          </div>
          <MatchPmAssetDialog
            trigger={
              <Button
                size="sm"
                className="gap-1.5 font-semibold text-xs bg-amber-600 hover:bg-amber-700 text-white"
              >
                <Sparkles className="size-3.5" /> Run Smart Asset Matcher
              </Button>
            }
          />
        </div>
      )}

      <div className="panel flex flex-wrap items-center gap-3 p-3">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search PM tasks…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
          />
        </div>
        <Select
          value={window}
          onValueChange={(v) => {
            setWindow(v);
            setPage(0);
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All active</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
            <SelectItem value="week">Next 7 days</SelectItem>
            <SelectItem value="month">Next 30 days</SelectItem>
            <SelectItem value="history">Completed history</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant={grouped ? "default" : "outline"}
          size="sm"
          onClick={() => {
            setGrouped((g) => !g);
            setPage(0);
          }}
        >
          {grouped ? "Grouped by building" : "Group by building"}
        </Button>
        <span className="font-mono text-xs text-muted-foreground">{total} schedules</span>
      </div>

      {grouped ? (
        <Tabs value={activeTab} onValueChange={setTab}>
          <TabsList className="flex h-auto flex-wrap justify-start gap-1">
            <TabsTrigger value="all">All ({pms.data?.rows?.length ?? 0})</TabsTrigger>
            {groups.map(([building, rows]) => (
              <TabsTrigger key={building} value={building}>
                {building} ({rows.length})
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="all" className="mt-4">
            <div className="space-y-4">
              {groups.map(([building, rows]) => (
                <div key={building} className="panel">
                  <div className="flex items-center justify-between border-b border-border px-3 py-2">
                    <h2 className="text-sm font-semibold">{building}</h2>
                    <span className="font-mono text-xs text-muted-foreground">
                      {rows.length} PMs
                    </span>
                  </div>
                  <div className="divide-y divide-border">{rows.map(renderRow)}</div>
                </div>
              ))}
              {pms.isLoading && (
                <p className="panel p-3 text-sm text-muted-foreground">Loading PM schedule…</p>
              )}
              {!pms.isLoading && groups.length === 0 && (
                <p className="panel p-3 text-sm text-muted-foreground">
                  No PM schedules match this filter.
                </p>
              )}
            </div>
          </TabsContent>

          {groups.map(([building, rows]) => (
            <TabsContent key={building} value={building} className="mt-4">
              <div className="panel divide-y divide-border">{rows.map(renderRow)}</div>
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        <>
          <div className="panel divide-y divide-border">
            {(pms.data?.rows ?? []).map(renderRow)}
            {pms.isLoading && (
              <p className="p-3 text-sm text-muted-foreground">Loading PM schedule…</p>
            )}
            {!pms.isLoading && (pms.data?.rows ?? []).length === 0 && (
              <p className="p-3 text-sm text-muted-foreground">
                No PM schedules match this filter.
              </p>
            )}
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Page {page + 1} of {maxPage + 1}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= maxPage}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

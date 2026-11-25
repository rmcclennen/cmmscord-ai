import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
import { ShowMoreList } from "@/components/show-more-list";
import { AssetBuildingTree } from "@/components/asset-building-tree";
import { fetchAllRows } from "@/lib/paged";
import type { TreeAsset } from "@/lib/asset-tree";
import { WorkOrderDialog } from "@/components/work-order-dialog";
import { DeleteRequestDialog } from "@/components/delete-request-dialog";
import { RelabelAssetDialog } from "@/components/relabel-asset-dialog";
import { EditPmScheduleDialog } from "@/components/edit-pm-schedule-dialog";
import { CreatePmScheduleDialog } from "@/components/create-pm-schedule-dialog";
import { MatchPmAssetDialog } from "@/components/match-pm-asset-dialog";
import { buildingOf, clampToSeason, dueTone, prettyLabel, seasonLabel, systemOf } from "@/lib/cmms";
import { useTeamMembers } from "@/hooks/use-team-members";
import { memberLabel, notifyUser } from "@/lib/notify";
import { toast } from "sonner";
import {
  CalendarPlus,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Layers,
  Pencil,
  Search,
  Sparkles,
  Tag,
  Printer,
} from "lucide-react";
import { openMorningPrintDialog } from "@/lib/auto-morning-print";

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
      { property: "og:title", content: "PM Schedule | AssetCareConnect" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      {
        property: "og:description",
        content: "Track and complete preventive maintenance across the plant.",
      },
    ],
  }),
  component: PmSchedulePage,
});

function PmSchedulePage() {
  const [selectionMade, setSelectionMade] = useState(false);
  const [search, setSearch] = useState("");
  const [window, setWindow] = useState("all");
  const [page, setPage] = useState(0);
  const [grouped, setGrouped] = useState(true);
  const [building, setBuilding] = useState("all");
  const [system, setSystem] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string> | null>(null);
  const [equipmentName, setEquipmentName] = useState<string | null>(null);
  const [selectedPmId, setSelectedPmId] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
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

  const navigation = useQuery({
    queryKey: ["pm-navigation", search, window],
    queryFn: async () => {
      const rows = await fetchAllRows((from, to) => supabase.from("pm_schedules")
        .select("id, asset_id, title, next_due, assets(id, name, location_name, building, type, category, limble_asset_id, parent_limble_id)")
        .eq("active", window !== "history").order("next_due").order("id").range(from, to));
      return rows.filter((pm) => (!search.trim() || pm.title.toLowerCase().includes(search.trim().toLowerCase())) &&
        (window !== "overdue" || pm.next_due < today()) &&
        (window !== "week" || (pm.next_due >= today() && pm.next_due <= inDays(7))) &&
        (window !== "month" || (pm.next_due >= today() && pm.next_due <= inDays(30))));
    },
  });
  const requestedPmIds = useMemo(() => (navigation.data ?? []).filter((pm) =>
    (building === "all" || buildingOf(pm.assets?.name, pm.title, pm.assets?.location_name, pm.assets?.building) === building) &&
    (!selectedIds || selectedIds.has(pm.asset_id ?? `pm:${pm.id}`)) && (!selectedPmId || selectedPmId === pm.id)
  ).map((pm) => pm.id), [navigation.data, building, selectedIds, selectedPmId]);

  const pms = useQuery({
    queryKey: ["pms", search, window, requestedPmIds],
    enabled: selectionMade && requestedPmIds.length > 0,
    queryFn: async () => {
      const history = window === "history";
      const build = (from: number, to: number) => {
        let query = supabase
          .from("pm_schedules")
          .select(
            "*, assets(id, name, location_name, building, tag_number, class, manufacturer, model, type, category, limble_asset_id, parent_limble_id)",
            { count: "exact" },
          )
          .in("id", requestedPmIds)
          .eq("active", !history)
          .order("next_due", { ascending: !history })
          .order("id")
          .range(from, to);
        if (search.trim()) query = query.ilike("title", `%${search.trim()}%`);
        if (window === "overdue") query = query.lt("next_due", today());
        if (window === "week") query = query.gte("next_due", today()).lte("next_due", inDays(7));
        if (window === "month") query = query.gte("next_due", today()).lte("next_due", inDays(30));
        return query;
      };
      // Grouped view shows everything, so walk every page (the server caps each at 1,000).
      const first = await build(0, 999);
      if (first.error) throw first.error;
      const total = first.count ?? first.data.length;
      const rows = [...first.data];
      for (let from = 1000; from < total && from < 20_000; from += 1000) {
        const next = await build(from, from + 999);
        if (next.error) throw next.error;
        rows.push(...next.data);
      }
      return { rows, count: total };
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

  const pmBuilding = (pm: Row) => buildingOf(pm.assets?.name, pm.title, pm.assets?.location_name, pm.assets?.building);
  const pmEquipmentId = (pm: Row) => pm.asset_id ?? `pm:${pm.id}`;
  const tasksByEquipment = useMemo(() => {
    const map = new Map<string, NonNullable<typeof navigation.data>>();
    for (const pm of navigation.data ?? []) {
      const id = pm.asset_id ?? `pm:${pm.id}`;
      const tasks = map.get(id) ?? [];
      tasks.push(pm);
      map.set(id, tasks);
    }
    return map;
  }, [navigation.data]);
  const treeAssets = useMemo(() => {
    const members = new Map<string, TreeAsset>();
    for (const pm of navigation.data ?? []) {
      const resolvedBuilding = buildingOf(pm.assets?.name, pm.title, pm.assets?.location_name, pm.assets?.building);
      const id = pm.asset_id ?? `pm:${pm.id}`;
      const asset = pm.assets;
      members.set(id, {
        id,
        name: asset?.name ?? pm.title,
        building: resolvedBuilding,
        system: systemOf(asset?.name ?? pm.title, resolvedBuilding, asset?.location_name, asset?.type, asset?.category),
        limble_asset_id: asset?.limble_asset_id ?? null,
        parent_limble_id: asset?.parent_limble_id ?? null,
      });
    }
    return [...members.values()];
  }, [navigation.data]);
  const visibleRows = (pms.data?.rows ?? []).filter((pm) =>
    (building === "all" || pmBuilding(pm) === building) &&
    (!selectedIds || selectedIds.has(pmEquipmentId(pm))) &&
    (!selectedPmId || selectedPmId === pm.id)
  );
  const total = visibleRows.length;
  const maxPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);
  const groups = (() => {
    const map = new Map<string, Row[]>();
    for (const pm of visibleRows) {
      const key = building === "all" ? pmBuilding(pm) : systemOf(pm.assets?.name ?? pm.title, pmBuilding(pm), pm.assets?.location_name, pm.assets?.type, pm.assets?.category);
      const list = map.get(key) ?? [];
      list.push(pm);
      map.set(key, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  })();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="label-caps">Preventive maintenance</p>
          <h1 className="text-2xl font-bold">PM schedule</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => openMorningPrintDialog()}
            className="gap-1.5 text-xs font-semibold"
            title="Batch print today's PMs and work orders"
          >
            <Printer className="size-3.5 text-primary" /> Morning Print
          </Button>
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
          {grouped ? "Grouped view" : "Flat list"}
        </Button>
        <span className="font-mono text-xs text-muted-foreground">{total} schedules</span>
      </div>

      <div className="grid min-w-0 gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <AssetBuildingTree
          assets={treeAssets}
          building={building}
          system={system}
          loading={navigation.isLoading}
          onSelect={(nextBuilding, nextSystem, ids, level) => {
            setSelectionMade(true);
            setBuilding(nextBuilding);
            setSystem(nextSystem);
            setSelectedIds(ids ? new Set(ids) : null);
            setEquipmentName(null);
            setSelectedPmId(null);
            // A building click lists the parent systems only: every group starts closed.
            if (level === "building") {
              const names = new Set((navigation.data ?? [])
                .filter((pm) => buildingOf(pm.assets?.name, pm.title, pm.assets?.location_name, pm.assets?.building) === nextBuilding)
                .map((pm) => systemOf(pm.assets?.name ?? pm.title, nextBuilding, pm.assets?.location_name, pm.assets?.type, pm.assets?.category)));
              setCollapsedGroups(Object.fromEntries([...names].map((n) => [n, true])));
            } else if (level === "system") {
              setCollapsedGroups((prev) => ({ ...prev, [nextSystem]: false }));
            } else {
              setCollapsedGroups({});
            }
            setPage(0);
          }}
          onEquipmentSelect={(ids, name) => {
            setSelectionMade(true);
            setSelectedIds(new Set(ids));
            setEquipmentName(name);
            setSelectedPmId(null);
            setCollapsedGroups({});
            setPage(0);
          }}
          renderEquipmentTasks={(assetId) => (
            <ShowMoreList items={tasksByEquipment.get(assetId) ?? []} step={10} render={(pm) => (
              <Button key={pm.id} variant={selectedPmId === pm.id ? "secondary" : "ghost"}
                aria-label={`Open PM: ${pm.title}`}
                className="my-1 h-auto w-full items-start justify-start gap-1.5 whitespace-normal px-1.5 py-2 text-left text-xs"
                onClick={() => {
                  setSelectionMade(true);
                  setSelectedIds(new Set([assetId]));
                  setSelectedPmId(pm.id);
                  setEquipmentName(pm.title);
                  setCollapsedGroups({});
                  setPage(0);
                }}>
                <CalendarPlus className="mt-0.5 size-3.5 shrink-0 text-primary" />
                <span className="min-w-0 break-words"><span className="block">{pm.title}</span>
                  <span className="mt-1 block font-mono text-muted-foreground">{pm.next_due}</span>
                </span>
              </Button>
            )} />
          )}
        />
        <div className="min-w-0 space-y-3">
        {selectionMade && <>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="min-w-0 break-words text-lg font-semibold">{equipmentName ?? (building === "all" ? "All PM schedules" : building)}</h2>
            <span className="text-xs text-muted-foreground">{total} PMs</span>
          </div>
      {grouped ? (
        <div className="space-y-4">
          {groups.map(([name, rows]) => {
            const isCollapsed = !!collapsedGroups[name];
            return (
            <section key={name} className="border-b border-border pb-3">
              <div
                role="button"
                tabIndex={0}
                aria-expanded={!isCollapsed}
                onClick={() => setCollapsedGroups((prev) => ({ ...prev, [name]: !isCollapsed }))}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setCollapsedGroups((prev) => ({ ...prev, [name]: !isCollapsed })); } }}
                className="flex cursor-pointer items-center justify-between gap-2 border-b border-border px-3 py-2 select-none hover:bg-muted/40"
              >
                <h3 className="text-sm font-semibold">{name}</h3>
                <span className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
                  {rows.length} PMs
                  {isCollapsed ? <ChevronRight className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                </span>
              </div>
              {!isCollapsed && <div className="divide-y divide-border"><ShowMoreList key={`${building}:${system}:${equipmentName}:${name}`} items={rows} render={renderRow} step={15} /></div>}
            </section>
            );
          })}
          {pms.isLoading && <p className="p-3 text-sm text-muted-foreground">Loading PM schedule…</p>}
          {!pms.isLoading && groups.length === 0 && <p className="p-3 text-sm text-muted-foreground">No PM schedules match this filter.</p>}
        </div>
      ) : (
        <>
          <div className="panel divide-y divide-border">
            <ShowMoreList key={`${page}:${building}:${system}:${equipmentName}`} items={visibleRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)} render={renderRow} />
            {pms.isLoading && (
              <p className="p-3 text-sm text-muted-foreground">Loading PM schedule…</p>
            )}
            {!pms.isLoading && visibleRows.length === 0 && (
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
        </>}
        {!selectionMade && (
          <div className="panel p-10 text-center text-muted-foreground">
            <Layers className="mx-auto size-9 opacity-50" />
            <p className="mt-3 text-sm font-semibold text-foreground">
              {building === "all" ? "Pick a building on the left" : building}
            </p>
            <p className="mx-auto mt-1 max-w-sm text-xs">
              Choose a system or a piece of equipment to see its PMs here.
            </p>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

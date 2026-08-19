import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  classLabel,
  CLASS_LABELS,
  BUILDING_NAMES,
  buildingOf,
  dueTone,
  systemOf,
  systemMeta,
  SYSTEM_NAMES,
} from "@/lib/cmms";
import { BulkAssetUploader } from "@/components/bulk-asset-uploader";
import { RelabelAssetDialog } from "@/components/relabel-asset-dialog";
import { CreatePmScheduleDialog } from "@/components/create-pm-schedule-dialog";
import { MatchPmAssetDialog } from "@/components/match-pm-asset-dialog";
import { SystemBadge, getSystemIcon, getSystemColor } from "@/components/system-badge";
import {
  AlertTriangle,
  Calendar,
  CalendarPlus,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  Clock,
  Cpu,
  Eye,
  Filter,
  Layers,
  LayoutGrid,
  List,
  Pencil,
  Search,
  Sparkles,
  Tag,
  UploadCloud,
  Wrench,
} from "lucide-react";

const PAGE_SIZE = 50;

export const Route = createFileRoute("/_authenticated/assets/")({
  head: () => ({
    meta: [
      { title: "Plant Assets | AssetCareConnect" },
      {
        name: "description",
        content:
          "Searchable register of every wastewater plant asset organized by operational system with nameplate data and scheduled PMs.",
      },
      { property: "og:title", content: "Plant Assets by System" },
      {
        property: "og:description",
        content:
          "Search and manage plant assets grouped by wastewater system (Polymer, Grit, RDT, UV, Clarifiers, etc.) with preventive maintenance tracking.",
      },
    ],
  }),
  component: AssetsPage,
});

function AssetsPage() {
  const [search, setSearch] = useState("");
  const [cls, setCls] = useState("all");
  const [building, setBuilding] = useState("all");
  const [systemFilter, setSystemFilter] = useState("all");
  const [pmFilter, setPmFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"grouped" | "flat">("grouped");
  const [collapsedSystems, setCollapsedSystems] = useState<Record<string, boolean>>({});
  const [page, setPage] = useState(0);
  const [importOpen, setImportOpen] = useState(false);

  const assets = useQuery({
    queryKey: ["assets-all"],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assets")
        .select(
          "id, name, tag_number, class, type, make, model, location_name, criticality, status, manufacturer, serial_number, supplier, building, category",
        )
        .order("name")
        .limit(5000);
      if (error) throw error;
      return (data ?? []).map((a) => {
        const resolvedBuilding = buildingOf(a.name, null, a.location_name, a.building);
        const resolvedSystem = systemOf(
          a.name,
          resolvedBuilding,
          a.location_name,
          a.type,
          a.category,
        );
        return {
          ...a,
          building: resolvedBuilding,
          system: resolvedSystem,
        };
      });
    },
  });

  const pmsQuery = useQuery({
    queryKey: ["assets-pms-summary"],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pm_schedules")
        .select("id, asset_id, title, next_due, interval_days, priority, assigned_to, active")
        .eq("active", true)
        .order("next_due", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const pmsData = pmsQuery.data;
  const pmMap = useMemo(() => {
    const map = new Map<
      string,
      {
        count: number;
        pms: NonNullable<typeof pmsData>;
        nextDue: string | null;
        nextPmTitle: string | null;
        hasOverdue: boolean;
        hasDueSoon: boolean;
      }
    >();

    for (const pm of pmsData ?? []) {
      if (!pm.asset_id) continue;
      const tone = dueTone(pm.next_due);
      const existing = map.get(pm.asset_id);
      if (!existing) {
        map.set(pm.asset_id, {
          count: 1,
          pms: [pm],
          nextDue: pm.next_due,
          nextPmTitle: pm.title,
          hasOverdue: tone === "overdue",
          hasDueSoon: tone === "due",
        });
      } else {
        existing.count += 1;
        existing.pms.push(pm);
        if (tone === "overdue") existing.hasOverdue = true;
        if (tone === "due") existing.hasDueSoon = true;
      }
    }
    return map;
  }, [pmsData]);

  const all = useMemo(() => assets.data ?? [], [assets.data]);

  // System counts across all assets
  const systemCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of all) {
      counts.set(a.system, (counts.get(a.system) ?? 0) + 1);
    }
    return counts;
  }, [all]);

  // Available systems for tabs / filter (systems with at least 1 asset or common standard systems)
  const systemOptions = useMemo(() => {
    const active = Array.from(systemCounts.keys()).sort((a, b) => {
      const idxA = SYSTEM_NAMES.indexOf(a);
      const idxB = SYSTEM_NAMES.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });
    return active;
  }, [systemCounts]);

  const buildingCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of all) counts.set(a.building, (counts.get(a.building) ?? 0) + 1);
    return counts;
  }, [all]);

  const buildingTabs = useMemo(
    () =>
      [...BUILDING_NAMES, "Lift Stations", "Other / Unassigned"].filter(
        (b) => (buildingCounts.get(b) ?? 0) > 0,
      ),
    [buildingCounts],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return all.filter((a) => {
      if (building !== "all" && a.building !== building) return false;
      if (systemFilter !== "all" && a.system !== systemFilter) return false;
      if (cls !== "all" && a.class !== cls) return false;

      const pmInfo = pmMap.get(a.id);
      if (pmFilter === "has_pms" && (!pmInfo || pmInfo.count === 0)) return false;
      if (pmFilter === "overdue" && (!pmInfo || !pmInfo.hasOverdue)) return false;
      if (pmFilter === "due_soon" && (!pmInfo || !pmInfo.hasDueSoon)) return false;
      if (pmFilter === "no_pms" && pmInfo && pmInfo.count > 0) return false;

      if (!term) return true;
      return [
        a.name,
        a.tag_number,
        a.system,
        a.building,
        a.make,
        a.model,
        a.serial_number,
        a.manufacturer,
        a.location_name,
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term));
    });
  }, [all, search, cls, building, systemFilter, pmFilter, pmMap]);

  // Group filtered assets by system
  const groupedBySystem = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const a of filtered) {
      const list = map.get(a.system) ?? [];
      list.push(a);
      map.set(a.system, list);
    }

    // Sort system groups by standard wastewater process flow
    const sortedEntries = Array.from(map.entries()).sort(([sysA], [sysB]) => {
      const idxA = SYSTEM_NAMES.indexOf(sysA);
      const idxB = SYSTEM_NAMES.indexOf(sysB);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return sysA.localeCompare(sysB);
    });

    return sortedEntries;
  }, [filtered]);

  const total = filtered.length;
  const maxPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);
  const flatRows = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const toggleSystemCollapse = (systemName: string) => {
    setCollapsedSystems((prev) => ({
      ...prev,
      [systemName]: !prev[systemName],
    }));
  };

  const collapseAll = () => {
    const allCollapsed: Record<string, boolean> = {};
    for (const [sys] of groupedBySystem) {
      allCollapsed[sys] = true;
    }
    setCollapsedSystems(allCollapsed);
  };

  const expandAll = () => {
    setCollapsedSystems({});
  };

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="label-caps">Plant assets</p>
            <Badge variant="outline" className="font-mono text-xs text-primary border-primary/30">
              System grouped
            </Badge>
          </div>
          <h1 className="text-2xl font-bold">Plant asset register</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Assets categorized by process systems (Polymer, Grit, RDT, Screening, Aeration, etc.)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <MatchPmAssetDialog
            trigger={
              <Button
                variant="outline"
                className="flex items-center gap-2 font-semibold border-primary/40 text-primary hover:bg-primary/10"
              >
                <Sparkles className="size-4" /> Match PMs
              </Button>
            }
          />
          <CreatePmScheduleDialog
            trigger={
              <Button variant="outline" className="flex items-center gap-2 font-semibold">
                <CalendarPlus className="size-4 text-primary" /> Schedule PM
              </Button>
            }
          />
          <Button
            variant="outline"
            onClick={() => setImportOpen(true)}
            className="flex items-center gap-2 font-bold"
          >
            <UploadCloud className="size-4 text-primary" /> Bulk Import Spreadsheet
          </Button>
          <Button asChild>
            <Link to="/assets/capture">
              <Camera className="size-4" /> Add by photo
            </Link>
          </Button>
        </div>
      </div>

      <BulkAssetUploader open={importOpen} onOpenChange={setImportOpen} />

      {/* Main Filter & Search Toolbar */}
      <div className="panel p-3 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-56 flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search name, tag, system, make, model, serial…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
            />
          </div>

          {/* System Filter Select */}
          <Select
            value={systemFilter}
            onValueChange={(v) => {
              setSystemFilter(v);
              setPage(0);
            }}
          >
            <SelectTrigger className="w-56">
              <div className="flex items-center gap-2 truncate">
                <Layers className="size-3.5 text-primary shrink-0" />
                <SelectValue placeholder="All systems" />
              </div>
            </SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="all">
                <span className="font-semibold">All Systems</span> ({all.length})
              </SelectItem>
              {systemOptions.map((sys) => (
                <SelectItem key={sys} value={sys}>
                  {sys} ({systemCounts.get(sys) ?? 0})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Class Select */}
          <Select
            value={cls}
            onValueChange={(v) => {
              setCls(v);
              setPage(0);
            }}
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All classes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All classes</SelectItem>
              {Object.keys(CLASS_LABELS).map((c) => (
                <SelectItem key={c} value={c}>
                  {CLASS_LABELS[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* PM Status Filter */}
          <Select
            value={pmFilter}
            onValueChange={(v) => {
              setPmFilter(v);
              setPage(0);
            }}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All PM statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All PM statuses</SelectItem>
              <SelectItem value="overdue">Overdue PMs</SelectItem>
              <SelectItem value="due_soon">Due soon (≤7 days)</SelectItem>
              <SelectItem value="has_pms">Has scheduled PMs</SelectItem>
              <SelectItem value="no_pms">No PM scheduled</SelectItem>
            </SelectContent>
          </Select>

          {/* View Mode Toggle */}
          <div className="flex items-center rounded-lg border border-input p-0.5 bg-muted/40">
            <Button
              size="sm"
              variant={viewMode === "grouped" ? "secondary" : "ghost"}
              className={`h-7 px-2.5 text-xs font-semibold gap-1.5 ${
                viewMode === "grouped"
                  ? "shadow-xs bg-background text-foreground"
                  : "text-muted-foreground"
              }`}
              onClick={() => setViewMode("grouped")}
              title="Group assets by operational system"
            >
              <LayoutGrid className="size-3.5" /> Group by System
            </Button>
            <Button
              size="sm"
              variant={viewMode === "flat" ? "secondary" : "ghost"}
              className={`h-7 px-2.5 text-xs font-semibold gap-1.5 ${
                viewMode === "flat"
                  ? "shadow-xs bg-background text-foreground"
                  : "text-muted-foreground"
              }`}
              onClick={() => setViewMode("flat")}
              title="View all assets in flat table"
            >
              <List className="size-3.5" /> Flat Table
            </Button>
          </div>

          <span className="font-mono text-xs text-muted-foreground whitespace-nowrap">
            {total} asset{total === 1 ? "" : "s"}
          </span>
        </div>

        {/* Quick System Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 no-scrollbar">
          <button
            type="button"
            onClick={() => {
              setSystemFilter("all");
              setPage(0);
            }}
            className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors shrink-0 ${
              systemFilter === "all"
                ? "bg-primary text-primary-foreground font-semibold"
                : "bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground"
            }`}
          >
            All Systems ({all.length})
          </button>
          {systemOptions.map((sys) => {
            const isSelected = systemFilter === sys;
            const count = systemCounts.get(sys) ?? 0;
            return (
              <button
                key={sys}
                type="button"
                onClick={() => {
                  setSystemFilter(isSelected ? "all" : sys);
                  setPage(0);
                }}
                className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors shrink-0 flex items-center gap-1.5 ${
                  isSelected
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "bg-muted/70 hover:bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                <span>{sys}</span>
                <span
                  className={`text-[10px] px-1 rounded-full ${
                    isSelected
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-background/80 text-muted-foreground font-mono"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Building Filter Tabs */}
      <Tabs
        value={building}
        onValueChange={(v) => {
          setBuilding(v);
          setPage(0);
        }}
      >
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="all">All Buildings ({all.length})</TabsTrigger>
          {buildingTabs.map((b) => (
            <TabsTrigger key={b} value={b}>
              {b} ({buildingCounts.get(b)})
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Grouped by System View */}
      {viewMode === "grouped" ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-medium text-muted-foreground">
              Showing {groupedBySystem.length} process system
              {groupedBySystem.length === 1 ? "" : "s"} ({total} total assets)
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground hover:text-foreground"
                onClick={expandAll}
              >
                Expand all
              </Button>
              <span className="text-muted-foreground text-xs">·</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground hover:text-foreground"
                onClick={collapseAll}
              >
                Collapse all
              </Button>
            </div>
          </div>

          {groupedBySystem.length === 0 && !assets.isLoading && (
            <div className="panel p-12 text-center text-muted-foreground space-y-3">
              <Layers className="size-10 mx-auto text-muted-foreground/50" />
              <p className="text-base font-semibold">No assets found matching filters</p>
              <p className="text-xs max-w-md mx-auto">
                Try clearing your search terms or resetting the system/building/class filters.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setCls("all");
                  setBuilding("all");
                  setSystemFilter("all");
                  setPmFilter("all");
                }}
              >
                Reset All Filters
              </Button>
            </div>
          )}

          {groupedBySystem.map(([systemName, systemAssets]) => {
            const isCollapsed = !!collapsedSystems[systemName];
            const meta = systemMeta(systemName);
            const IconComponent = getSystemIcon(meta.icon);
            const color = getSystemColor(meta.color);

            // Compute PM metrics for this system group
            let systemPmCount = 0;
            let systemOverdueCount = 0;
            let systemDueSoonCount = 0;

            for (const asset of systemAssets) {
              const pmInfo = pmMap.get(asset.id);
              if (pmInfo) {
                systemPmCount += pmInfo.count;
                if (pmInfo.hasOverdue) systemOverdueCount += 1;
                if (pmInfo.hasDueSoon) systemDueSoonCount += 1;
              }
            }

            return (
              <div
                key={systemName}
                className="panel overflow-hidden border border-border/80 shadow-xs"
              >
                {/* System Section Header */}
                <div
                  onClick={() => toggleSystemCollapse(systemName)}
                  className={`flex flex-wrap items-center justify-between gap-3 p-3.5 cursor-pointer select-none transition-colors ${
                    isCollapsed
                      ? "bg-card hover:bg-muted/40"
                      : "bg-muted/30 hover:bg-muted/50 border-b border-border/60"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`size-9 rounded-lg flex items-center justify-center shrink-0 border ${color.border} ${color.bg}`}
                    >
                      <IconComponent className={`size-5 ${color.text}`} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-base font-bold text-foreground truncate">
                          {systemName}
                        </h2>
                        <Badge
                          variant="outline"
                          className="text-[11px] font-medium border-muted-foreground/30 text-muted-foreground"
                        >
                          {meta.category}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                        <span className="font-semibold text-foreground">
                          {systemAssets.length} asset{systemAssets.length === 1 ? "" : "s"}
                        </span>
                        <span>·</span>
                        {systemPmCount > 0 ? (
                          <span className="flex items-center gap-1.5 font-medium">
                            <Clock className="size-3 text-primary" />
                            {systemPmCount} PM{systemPmCount === 1 ? "" : "s"} scheduled
                            {systemOverdueCount > 0 && (
                              <span className="text-destructive font-bold">
                                ({systemOverdueCount} overdue)
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="italic">No PMs scheduled</span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <CreatePmScheduleDialog
                      trigger={
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2.5 text-xs font-semibold border-primary/30 text-primary hover:bg-primary/10 gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                          title={`Schedule a preventive maintenance task for an asset in ${systemName}`}
                        >
                          <CalendarPlus className="size-3.5" /> + Schedule PM
                        </Button>
                      }
                    />
                    <div className="text-muted-foreground p-1">
                      {isCollapsed ? (
                        <ChevronRight className="size-4" />
                      ) : (
                        <ChevronDown className="size-4" />
                      )}
                    </div>
                  </div>
                </div>

                {/* System Assets Table */}
                {!isCollapsed && (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-muted/10">
                        <TableRow>
                          <TableHead className="w-1/3">Asset Name & Tag</TableHead>
                          <TableHead>Building / Area</TableHead>
                          <TableHead>Class</TableHead>
                          <TableHead>PM Schedule</TableHead>
                          <TableHead>Make / Model</TableHead>
                          <TableHead>Serial</TableHead>
                          <TableHead>Location</TableHead>
                          <TableHead>Criticality</TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {systemAssets.map((a) => {
                          const pmInfo = pmMap.get(a.id);
                          return (
                            <TableRow key={a.id} className="hover:bg-muted/30">
                              <TableCell>
                                <div className="flex flex-col">
                                  <Link
                                    to="/assets/$assetId"
                                    params={{ assetId: a.id }}
                                    className="font-medium text-foreground hover:text-primary hover:underline transition-colors"
                                  >
                                    {a.name}
                                  </Link>
                                  {a.tag_number && (
                                    <span className="font-mono text-xs text-muted-foreground">
                                      Tag: {a.tag_number}
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                                {a.building}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                                {classLabel(a.class)}
                              </TableCell>
                              <TableCell>
                                {pmInfo && pmInfo.count > 0 ? (
                                  <Link
                                    to="/assets/$assetId"
                                    params={{ assetId: a.id }}
                                    className="inline-flex flex-col gap-0.5 group"
                                    title={pmInfo.pms
                                      .map((p) => `• ${p.title} (due ${p.next_due})`)
                                      .join("\n")}
                                  >
                                    <div className="flex items-center gap-1.5">
                                      <Badge
                                        variant={
                                          pmInfo.hasOverdue
                                            ? "destructive"
                                            : pmInfo.hasDueSoon
                                              ? "secondary"
                                              : "outline"
                                        }
                                        className="font-mono text-[11px] gap-1 group-hover:border-primary transition-colors"
                                      >
                                        {pmInfo.hasOverdue ? (
                                          <AlertTriangle className="size-3" />
                                        ) : (
                                          <Clock className="size-3 text-primary" />
                                        )}
                                        {pmInfo.count} PM{pmInfo.count > 1 ? "s" : ""} ·{" "}
                                        {pmInfo.nextDue}
                                      </Badge>
                                    </div>
                                    {pmInfo.nextPmTitle && (
                                      <span className="text-[11px] text-muted-foreground truncate max-w-44 group-hover:text-primary transition-colors">
                                        {pmInfo.nextPmTitle}
                                      </span>
                                    )}
                                  </Link>
                                ) : (
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs text-muted-foreground italic">
                                      No PMs
                                    </span>
                                    <CreatePmScheduleDialog
                                      assetId={a.id}
                                      assetName={a.name}
                                      lockAsset
                                      trigger={
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-6 px-1.5 text-[11px] text-primary hover:bg-primary/10"
                                          title="Schedule PM for this asset"
                                        >
                                          + Add PM
                                        </Button>
                                      }
                                    />
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {[a.make, a.model].filter(Boolean).join(" · ") || "—"}
                              </TableCell>
                              <TableCell className="font-mono text-xs text-muted-foreground">
                                {a.serial_number ?? "—"}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {a.location_name ?? "—"}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={a.criticality === "high" ? "destructive" : "outline"}
                                  className="text-[11px]"
                                >
                                  {a.criticality}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <CreatePmScheduleDialog
                                    assetId={a.id}
                                    assetName={a.name}
                                    lockAsset
                                    trigger={
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 px-2 text-xs font-semibold text-primary hover:bg-primary/10 gap-1"
                                        title="Schedule PM for this asset"
                                      >
                                        <CalendarPlus className="size-3" /> PM
                                      </Button>
                                    }
                                  />
                                  <RelabelAssetDialog
                                    assetId={a.id}
                                    initialAsset={a}
                                    trigger={
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 px-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted gap-1"
                                        title="Relabel asset across the whole program"
                                      >
                                        <Tag className="size-3" /> Relabel
                                      </Button>
                                    }
                                  />
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* Flat Table View */
        <div className="space-y-4">
          <div className="panel overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset</TableHead>
                  <TableHead>System</TableHead>
                  <TableHead>Building / Area</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>PM Schedule</TableHead>
                  <TableHead>Make / Model</TableHead>
                  <TableHead>Serial</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Criticality</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {flatRows.map((a) => {
                  const pmInfo = pmMap.get(a.id);
                  return (
                    <TableRow key={a.id}>
                      <TableCell>
                        <Link
                          to="/assets/$assetId"
                          params={{ assetId: a.id }}
                          className="font-medium hover:underline"
                        >
                          {a.name}
                        </Link>
                        {a.tag_number && (
                          <span className="ml-2 font-mono text-xs text-muted-foreground">
                            {a.tag_number}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <SystemBadge
                          system={a.system}
                          size="sm"
                          onClick={() => setSystemFilter(a.system)}
                        />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{a.building}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {classLabel(a.class)}
                      </TableCell>
                      <TableCell>
                        {pmInfo && pmInfo.count > 0 ? (
                          <Link
                            to="/assets/$assetId"
                            params={{ assetId: a.id }}
                            className="inline-flex flex-col gap-0.5 group"
                            title={pmInfo.pms
                              .map((p) => `• ${p.title} (due ${p.next_due})`)
                              .join("\n")}
                          >
                            <div className="flex items-center gap-1.5">
                              <Badge
                                variant={
                                  pmInfo.hasOverdue
                                    ? "destructive"
                                    : pmInfo.hasDueSoon
                                      ? "secondary"
                                      : "outline"
                                }
                                className="font-mono text-[11px] gap-1 group-hover:border-primary transition-colors"
                              >
                                {pmInfo.hasOverdue ? (
                                  <AlertTriangle className="size-3" />
                                ) : (
                                  <Clock className="size-3 text-primary" />
                                )}
                                {pmInfo.count} PM{pmInfo.count > 1 ? "s" : ""} · {pmInfo.nextDue}
                              </Badge>
                            </div>
                            {pmInfo.nextPmTitle && (
                              <span className="text-[11px] text-muted-foreground truncate max-w-44 group-hover:text-primary transition-colors">
                                {pmInfo.nextPmTitle}
                              </span>
                            )}
                          </Link>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-muted-foreground italic">No PMs</span>
                            <CreatePmScheduleDialog
                              assetId={a.id}
                              assetName={a.name}
                              lockAsset
                              trigger={
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 px-1.5 text-[11px] text-primary hover:bg-primary/10"
                                  title="Schedule PM for this asset"
                                >
                                  + Add PM
                                </Button>
                              }
                            />
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {[a.make, a.model].filter(Boolean).join(" · ") || "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {a.serial_number ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {a.location_name ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={a.criticality === "high" ? "destructive" : "outline"}>
                          {a.criticality}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <CreatePmScheduleDialog
                            assetId={a.id}
                            assetName={a.name}
                            lockAsset
                            trigger={
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs font-semibold text-primary hover:bg-primary/10 gap-1"
                                title="Schedule PM for this asset"
                              >
                                <CalendarPlus className="size-3" /> PM
                              </Button>
                            }
                          />
                          <RelabelAssetDialog
                            assetId={a.id}
                            initialAsset={a}
                            trigger={
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted gap-1"
                                title="Relabel asset across the whole program"
                              >
                                <Tag className="size-3" /> Relabel
                              </Button>
                            }
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {assets.isLoading && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-sm text-muted-foreground">
                      Loading assets…
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Page {page + 1} of {maxPage + 1} ({total} assets)
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
        </div>
      )}
    </div>
  );
}

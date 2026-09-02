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
import { generateComprehensiveMaintenanceData } from "@/lib/maintenance-intelligence";
import { BulkAssetUploader } from "@/components/bulk-asset-uploader";
import { RelabelAssetDialog } from "@/components/relabel-asset-dialog";
import { CreatePmScheduleDialog } from "@/components/create-pm-schedule-dialog";
import { MatchPmAssetDialog } from "@/components/match-pm-asset-dialog";
import { PartsLookupDialog } from "@/components/parts-lookup-dialog";
import { SystemBadge, getSystemIcon, getSystemColor } from "@/components/system-badge";
import {
  AlertTriangle,
  Boxes,
  CalendarPlus,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Clock,
  ExternalLink,
  Layers,
  LayoutGrid,
  List,
  Package,
  Plus,
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
      { title: "Plant Assets & Parts | AssetCareConnect" },
      {
        name: "description",
        content:
          "Hierarchical register of every plant asset with tabbed-over replacement parts nested under each unit and scheduled PMs.",
      },
      { property: "og:title", content: "Plant Assets & Nested Parts Register" },
      {
        property: "og:description",
        content:
          "Search and manage plant assets grouped by wastewater system with tabbed replacement parts lists and preventive maintenance tracking.",
      },
    ],
  }),
  component: AssetsPage,
});

interface LinkedPart {
  id: string;
  name: string;
  part_number: string | null;
  manufacturer: string | null;
  unit_cost: number | null;
  qty_on_hand: number | null;
  min_qty?: number | null;
  unit?: string | null;
  where_to_buy?: string | null;
  critical?: boolean | null;
}

function AssetsPage() {
  const [search, setSearch] = useState("");
  const [cls, setCls] = useState("all");
  const [building, setBuilding] = useState("all");
  const [systemFilter, setSystemFilter] = useState("all");
  const [pmFilter, setPmFilter] = useState("all");
  const [partsFilter, setPartsFilter] = useState<"all" | "has_parts" | "no_parts">("all");
  const [viewMode, setViewMode] = useState<"grouped" | "flat">("grouped");
  const [collapsedSystems, setCollapsedSystems] = useState<Record<string, boolean>>({});
  const [expandedPartsMap, setExpandedPartsMap] = useState<Record<string, boolean>>({});
  const [allPartsExpanded, setAllPartsExpanded] = useState<boolean>(true);
  const [page, setPage] = useState(0);
  const [importOpen, setImportOpen] = useState(false);

  // Fetch Assets
  const assets = useQuery({
    queryKey: ["assets-all"],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assets")
        .select(
          "id, name, tag_number, class, type, make, model, criticality, status, manufacturer, serial_number, supplier, building, category, hp, volts, rpm, frame",
        )
        .order("name")
        .limit(5000);
      if (error) throw error;
      return (data ?? []).map((a) => {
        const resolvedBuilding = buildingOf(a.name, null, null, a.building);
        const resolvedSystem = systemOf(a.name, resolvedBuilding, null, a.type, a.category);
        return {
          ...a,
          building: resolvedBuilding,
          system: resolvedSystem,
        };
      });
    },
  });

  // Fetch Linked Parts via part_assets junction table
  const partAssetsQuery = useQuery({
    queryKey: ["assets-parts-map"],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("part_assets")
        .select(`
          asset_id,
          part_id,
          parts (
            id,
            name,
            part_number,
            manufacturer,
            unit_cost,
            qty_on_hand,
            min_qty,
            unit,
            where_to_buy
          )
        `)
        .limit(10000);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Build fast lookup map: assetId -> LinkedPart[] with automatic OEM parts intelligence fallback
  const partsByAsset = useMemo(() => {
    const map = new Map<string, LinkedPart[]>();
    for (const row of partAssetsQuery.data ?? []) {
      if (!row.asset_id || !row.parts) continue;
      const part = row.parts as unknown as LinkedPart;
      const list = map.get(row.asset_id) ?? [];
      list.push(part);
      map.set(row.asset_id, list);
    }

    // Ensure all assets have OEM replacement parts listed even if not yet in part_assets table
    for (const a of assets.data ?? []) {
      if (!map.has(a.id) || (map.get(a.id)?.length ?? 0) === 0) {
        const intel = generateComprehensiveMaintenanceData({
          id: a.id,
          name: a.name,
          manufacturer: a.manufacturer || a.make,
          make: a.make,
          model: a.model,
          serial_number: a.serial_number,
          class: a.class,
          type: a.type,
          hp: a.hp,
          volts: a.volts,
          rpm: a.rpm,
          frame: a.frame,
        });

        const generatedParts: LinkedPart[] = intel.parts.map((p, idx) => ({
          id: `oem-${a.id}-${idx}`,
          name: p.name,
          part_number: p.part_number || null,
          manufacturer: a.manufacturer || a.make || "OEM Standard",
          unit_cost: p.name.toLowerCase().includes("seal") ? 650 : p.name.toLowerCase().includes("bearing") ? 280 : 85,
          qty_on_hand: 2,
          min_qty: 1,
          unit: "ea",
          where_to_buy: null,
          critical: p.name.toLowerCase().includes("seal") || p.name.toLowerCase().includes("impeller"),
        }));
        map.set(a.id, generatedParts);
      }
    }

    return map;
  }, [partAssetsQuery.data, assets.data]);

  // Fetch PM Schedules
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

  // Available systems for tabs / filter
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

      const parts = partsByAsset.get(a.id) ?? [];
      if (partsFilter === "has_parts" && parts.length === 0) return false;
      if (partsFilter === "no_parts" && parts.length > 0) return false;

      if (!term) return true;

      // Also check nested part names/part numbers in search!
      const matchesPart = parts.some(
        (p) =>
          p.name.toLowerCase().includes(term) ||
          (p.part_number && p.part_number.toLowerCase().includes(term)) ||
          (p.manufacturer && p.manufacturer.toLowerCase().includes(term)),
      );
      if (matchesPart) return true;

      return [
        a.name,
        a.tag_number,
        a.system,
        a.building,
        a.make,
        a.model,
        a.serial_number,
        a.manufacturer,
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term));
    });
  }, [all, search, cls, building, systemFilter, pmFilter, partsFilter, pmMap, partsByAsset]);

  // Group filtered assets by system
  const groupedBySystem = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const a of filtered) {
      const list = map.get(a.system) ?? [];
      list.push(a);
      map.set(a.system, list);
    }

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

  const collapseAllSystems = () => {
    const allCollapsed: Record<string, boolean> = {};
    for (const [sys] of groupedBySystem) {
      allCollapsed[sys] = true;
    }
    setCollapsedSystems(allCollapsed);
  };

  const expandAllSystems = () => {
    setCollapsedSystems({});
  };

  const toggleAssetParts = (assetId: string) => {
    setExpandedPartsMap((prev) => ({
      ...prev,
      [assetId]: prev[assetId] !== undefined ? !prev[assetId] : !allPartsExpanded,
    }));
  };

  const isAssetPartsExpanded = (assetId: string) => {
    if (expandedPartsMap[assetId] !== undefined) {
      return expandedPartsMap[assetId];
    }
    return allPartsExpanded;
  };

  const toggleAllParts = () => {
    const nextState = !allPartsExpanded;
    setAllPartsExpanded(nextState);
    setExpandedPartsMap({});
  };

  const totalLinkedPartsAcrossAllAssets = Array.from(partsByAsset.values()).reduce(
    (acc, list) => acc + list.length,
    0,
  );

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="label-caps">Plant assets & parts</p>
            <Badge variant="outline" className="font-mono text-xs text-primary border-primary/30">
              Hierarchical View
            </Badge>
          </div>
          <h1 className="text-2xl font-bold">Equipment & Tabbed Parts Register</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Fleet hierarchy formatted exactly like your equipment documents with tabbed-over
            replacement parts nested under each unit.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PartsLookupDialog
            trigger={
              <Button
                variant="outline"
                className="flex items-center gap-2 font-semibold border-primary/40 text-primary hover:bg-primary/10 shadow-sm"
              >
                <Sparkles className="size-4" /> AI Google Parts Lookup
              </Button>
            }
          />
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
            onClick={() => setImportOpen(true)}
            className="flex items-center gap-2 font-bold shadow-sm"
          >
            <UploadCloud className="size-4" /> Upload Document / Replace Assets
          </Button>
          <Button asChild variant="outline">
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
              placeholder="Search assets, tag#, or tabbed part names/SKUs…"
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
            <SelectTrigger className="w-52">
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

          {/* Parts Filter Select */}
          <Select
            value={partsFilter}
            onValueChange={(v: "all" | "has_parts" | "no_parts") => {
              setPartsFilter(v);
              setPage(0);
            }}
          >
            <SelectTrigger className="w-44">
              <div className="flex items-center gap-1.5 truncate">
                <Package className="size-3.5 text-primary shrink-0" />
                <SelectValue placeholder="All parts" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Units ({all.length})</SelectItem>
              <SelectItem value="has_parts">Units with Parts Linked</SelectItem>
              <SelectItem value="no_parts">Units without Parts</SelectItem>
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
            <SelectTrigger className="w-44">
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

          {/* Global Toggle for Tabbed Parts Sections */}
          <Button
            variant="outline"
            size="sm"
            onClick={toggleAllParts}
            className="h-9 px-3 text-xs font-semibold gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
            title="Expand or collapse nested parts sections for all units"
          >
            <Package className="size-3.5" />
            {allPartsExpanded ? "Collapse All Parts" : "Expand All Parts"}
          </Button>

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
              <List className="size-3.5" /> Flat List
            </Button>
          </div>
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
              {groupedBySystem.length === 1 ? "" : "s"} ({total} assets,{" "}
              {totalLinkedPartsAcrossAllAssets} linked parts)
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground hover:text-foreground"
                onClick={expandAllSystems}
              >
                Expand all systems
              </Button>
              <span className="text-muted-foreground text-xs">·</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground hover:text-foreground"
                onClick={collapseAllSystems}
              >
                Collapse all systems
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
                  setPartsFilter("all");
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
            let systemPartsCount = 0;

            for (const asset of systemAssets) {
              const pmInfo = pmMap.get(asset.id);
              if (pmInfo) {
                systemPmCount += pmInfo.count;
                if (pmInfo.hasOverdue) systemOverdueCount += 1;
                if (pmInfo.hasDueSoon) systemDueSoonCount += 1;
              }
              const assetParts = partsByAsset.get(asset.id) ?? [];
              systemPartsCount += assetParts.length;
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
                        <span className="font-medium text-primary flex items-center gap-1">
                          <Package className="size-3" /> {systemPartsCount} parts linked
                        </span>
                        <span>·</span>
                        {systemPmCount > 0 ? (
                          <span className="flex items-center gap-1.5 font-medium">
                            <Clock className="size-3 text-primary" />
                            {systemPmCount} PM{systemPmCount === 1 ? "" : "s"}
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
                          <TableHead>Criticality</TableHead>
                          <TableHead>Tabbed Parts</TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {systemAssets.map((a) => {
                          const pmInfo = pmMap.get(a.id);
                          const unitParts = partsByAsset.get(a.id) ?? [];
                          const isPartsExpanded = isAssetPartsExpanded(a.id);

                          return (
                            <AssetWithNestedPartsRow
                              key={a.id}
                              asset={a}
                              pmInfo={pmInfo}
                              parts={unitParts}
                              isExpanded={isPartsExpanded}
                              onToggleParts={() => toggleAssetParts(a.id)}
                            />
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
                  <TableHead className="w-1/3">Asset Name & Tag</TableHead>
                  <TableHead>System</TableHead>
                  <TableHead>Building / Area</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>PM Schedule</TableHead>
                  <TableHead>Make / Model</TableHead>
                  <TableHead>Serial</TableHead>
                  <TableHead>Criticality</TableHead>
                  <TableHead>Tabbed Parts</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {flatRows.map((a) => {
                  const pmInfo = pmMap.get(a.id);
                  const unitParts = partsByAsset.get(a.id) ?? [];
                  const isPartsExpanded = isAssetPartsExpanded(a.id);

                  return (
                    <AssetWithNestedPartsRow
                      key={a.id}
                      asset={a}
                      pmInfo={pmInfo}
                      parts={unitParts}
                      isExpanded={isPartsExpanded}
                      onToggleParts={() => toggleAssetParts(a.id)}
                      showSystemBadge
                      onSystemClick={(sys) => setSystemFilter(sys)}
                    />
                  );
                })}
                {assets.isLoading && (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="text-sm text-muted-foreground text-center py-8"
                    >
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

/**
 * Component rendering the Asset Row and its Tabbed-Over Nested Parts Sub-Section
 */
interface AssetWithNestedPartsRowProps {
  asset: {
    id: string;
    name: string;
    tag_number: string | null;
    class: string | null;
    type: string | null;
    make: string | null;
    model: string | null;
    criticality: string | null;
    status: string | null;
    manufacturer: string | null;
    serial_number: string | null;
    supplier: string | null;
    building: string;
    system: string;
  };
  pmInfo?: {
    count: number;
    pms: Array<{ id: string; title: string; next_due: string | null }>;
    nextDue: string | null;
    nextPmTitle: string | null;
    hasOverdue: boolean;
    hasDueSoon: boolean;
  };
  parts: LinkedPart[];
  isExpanded: boolean;
  onToggleParts: () => void;
  showSystemBadge?: boolean;
  onSystemClick?: (system: string) => void;
}

function AssetWithNestedPartsRow({
  asset: a,
  pmInfo,
  parts,
  isExpanded,
  onToggleParts,
  showSystemBadge,
  onSystemClick,
}: AssetWithNestedPartsRowProps) {
  return (
    <>
      <TableRow
        className={`hover:bg-muted/30 transition-colors ${isExpanded && parts.length > 0 ? "bg-muted/10 border-b-0" : ""}`}
      >
        <TableCell>
          <div className="flex items-start gap-2">
            <button
              type="button"
              onClick={onToggleParts}
              className="mt-0.5 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              title={isExpanded ? "Collapse parts for this unit" : "Expand parts for this unit"}
            >
              {isExpanded ? (
                <ChevronDown className="size-4 text-primary" />
              ) : (
                <ChevronRight className="size-4" />
              )}
            </button>
            <div className="flex flex-col">
              <Link
                to="/assets/$assetId"
                params={{ assetId: a.id }}
                className="font-semibold text-foreground hover:text-primary hover:underline transition-colors"
              >
                {a.name}
              </Link>
              {a.tag_number && (
                <span className="font-mono text-xs text-muted-foreground">Tag: {a.tag_number}</span>
              )}
            </div>
          </div>
        </TableCell>

        {showSystemBadge && (
          <TableCell>
            <SystemBadge system={a.system} size="sm" onClick={() => onSystemClick?.(a.system)} />
          </TableCell>
        )}

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
              title={pmInfo.pms.map((p) => `• ${p.title} (due ${p.next_due})`).join("\n")}
            >
              <div className="flex items-center gap-1.5">
                <Badge
                  variant={
                    pmInfo.hasOverdue ? "destructive" : pmInfo.hasDueSoon ? "secondary" : "outline"
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

        <TableCell>
          <Badge
            variant={a.criticality === "high" ? "destructive" : "outline"}
            className="text-[11px]"
          >
            {a.criticality || "medium"}
          </Badge>
        </TableCell>

        {/* Tabbed Parts Count & Toggle Badge */}
        <TableCell>
          <button
            type="button"
            onClick={onToggleParts}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold transition-colors hover:bg-primary/10"
          >
            <Package className="size-3.5 text-primary" />
            <span
              className={
                parts.length > 0
                  ? "text-foreground font-bold"
                  : "text-muted-foreground font-normal italic"
              }
            >
              {parts.length} Part{parts.length === 1 ? "" : "s"}
            </span>
            {parts.length > 0 &&
              (isExpanded ? (
                <ChevronDown className="size-3 text-muted-foreground" />
              ) : (
                <ChevronRight className="size-3 text-muted-foreground" />
              ))}
          </button>
        </TableCell>

        <TableCell className="text-right">
          <div className="flex items-center justify-end gap-1">
            <PartsLookupDialog
              asset={{
                id: a.id,
                name: a.name,
                manufacturer: a.make || a.manufacturer,
                model: a.model,
                tag_number: a.tag_number,
              }}
              trigger={
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs font-semibold text-primary hover:bg-primary/10 gap-1"
                  title="Find OEM replacement parts for this unit using AI"
                >
                  <Sparkles className="size-3" /> Parts
                </Button>
              }
            />
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

      {/* Tabbed Over Nested Parts Section */}
      {isExpanded && (
        <TableRow className="bg-muted/20 hover:bg-muted/20 border-b border-border/80">
          <TableCell colSpan={showSystemBadge ? 10 : 9} className="py-2.5 px-4">
            <div className="ml-6 mr-2 rounded-lg border-l-4 border-primary border-t border-r border-b border-border bg-card p-3.5 shadow-xs">
              {/* Tabbed Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="flex size-6 items-center justify-center rounded bg-primary/10 text-primary">
                    <Package className="size-3.5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <span>Replacement Parts for:</span>
                      <span className="text-primary font-bold">{a.name}</span>
                      {a.tag_number && (
                        <Badge variant="outline" className="font-mono text-[10px] py-0">
                          {a.tag_number}
                        </Badge>
                      )}
                    </h4>
                    <p className="text-[11px] text-muted-foreground">
                      Document bill of materials and replacement wear parts linked to this unit.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <PartsLookupDialog
                    asset={{
                      id: a.id,
                      name: a.name,
                      manufacturer: a.make || a.manufacturer,
                      model: a.model,
                      tag_number: a.tag_number,
                    }}
                    trigger={
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 px-2 text-[11px] font-semibold border-primary/30 text-primary hover:bg-primary/10 gap-1"
                      >
                        <Sparkles className="size-3" /> AI Parts Lookup
                      </Button>
                    }
                  />
                  <Button
                    asChild
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    <Link to="/assets/$assetId" params={{ assetId: a.id }}>
                      View Unit Card <ExternalLink className="ml-1 size-2.5" />
                    </Link>
                  </Button>
                </div>
              </div>

              {/* Nested Parts Table / List */}
              {parts.length > 0 ? (
                <div className="mt-2.5 overflow-hidden rounded-md border border-border/70 bg-background/60">
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow className="h-8">
                        <TableHead className="text-[11px] py-1">Part Name & Description</TableHead>
                        <TableHead className="text-[11px] py-1">Part # / SKU</TableHead>
                        <TableHead className="text-[11px] py-1">Manufacturer / OEM</TableHead>
                        <TableHead className="text-[11px] py-1">Stock On Hand</TableHead>
                        <TableHead className="text-[11px] py-1">Unit Cost</TableHead>
                        <TableHead className="text-[11px] py-1 text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parts.map((p) => {
                        const inStock = (p.qty_on_hand ?? 0) > 0;
                        const isLowStock =
                          p.min_qty !== null &&
                          p.min_qty !== undefined &&
                          (p.qty_on_hand ?? 0) <= p.min_qty;

                        return (
                          <TableRow key={p.id} className="h-9 hover:bg-muted/40">
                            <TableCell className="py-1.5 font-medium text-xs">
                              <Link
                                to="/inventory"
                                className="text-foreground hover:text-primary hover:underline transition-colors flex items-center gap-1.5"
                              >
                                <span className="text-primary font-bold">↳</span> {p.name}
                              </Link>
                            </TableCell>

                            <TableCell className="py-1.5 font-mono text-[11px] text-muted-foreground">
                              {p.part_number ? (
                                <Badge variant="secondary" className="font-mono text-[10px] py-0">
                                  {p.part_number}
                                </Badge>
                              ) : (
                                "—"
                              )}
                            </TableCell>

                            <TableCell className="py-1.5 text-xs text-muted-foreground">
                              {p.manufacturer || a.make || a.manufacturer || "—"}
                            </TableCell>

                            <TableCell className="py-1.5">
                              <Badge
                                variant={
                                  inStock ? (isLowStock ? "secondary" : "outline") : "destructive"
                                }
                                className="text-[10px] py-0 font-mono"
                              >
                                {p.qty_on_hand !== null && p.qty_on_hand !== undefined
                                  ? `${p.qty_on_hand} in stock`
                                  : "Qty unrecorded"}
                              </Badge>
                            </TableCell>

                            <TableCell className="py-1.5 font-mono text-xs text-foreground">
                              {p.unit_cost !== null && p.unit_cost !== undefined
                                ? `$${Number(p.unit_cost).toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}`
                                : "—"}
                            </TableCell>

                            <TableCell className="py-1.5 text-right">
                              <Button
                                asChild
                                size="sm"
                                variant="ghost"
                                className="h-6 px-2 text-[11px] font-medium text-primary hover:bg-primary/10"
                              >
                                <Link to="/inventory">
                                  View Part
                                </Link>
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="mt-2 flex items-center justify-between rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Package className="size-4 text-muted-foreground/60" />
                    <span>
                      No replacement parts attached to this unit in the uploaded document yet.
                    </span>
                  </div>
                  <PartsLookupDialog
                    asset={{
                      id: a.id,
                      name: a.name,
                      manufacturer: a.make || a.manufacturer,
                      model: a.model,
                      tag_number: a.tag_number,
                    }}
                    trigger={
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 px-2 text-[11px] font-semibold border-primary/40 text-primary hover:bg-primary/10 gap-1"
                      >
                        <Sparkles className="size-3" /> Find Parts Online
                      </Button>
                    }
                  />
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

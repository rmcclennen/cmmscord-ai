import { useState, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getManufacturerPortalInfo } from "@/lib/manufacturer-links";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  AlertOctagon,
  Wrench,
  DollarSign,
  ShoppingCart,
  Truck,
  ExternalLink,
  BookOpen,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Building2,
  FileText,
  AlertTriangle,
  RotateCcw,
  MoreVertical,
  Plus,
  Printer,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { ReportDownAssetDialog } from "@/components/report-down-asset-dialog";
import { RepairCostDialog } from "@/components/repair-cost-dialog";
import { PartOrderUpdateDialog } from "@/components/part-order-update-dialog";
import { WorkOrderDialog } from "@/components/work-order-dialog";
import type { PartRequestRow } from "@/lib/part-requests";

export const Route = createFileRoute("/_authenticated/equipment-down")({
  component: EquipmentDownPage,
});

interface DownEquipmentItem {
  asset: {
    id: string;
    name: string;
    tag_number: string | null;
    status: string;
    criticality: string;
    building: string | null;
    manufacturer: string | null;
    model: string | null;
    serial_number: string | null;
    notes: string | null;
    manufacturer_url: string | null;
  };
  partRequests: PartRequestRow[];
  workOrders: {
    id: string;
    wo_number: number;
    title: string;
    status: string;
    priority: string;
    labor_hours: number | null;
  }[];
}

function EquipmentDownPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [partsFilter, setPartsFilter] = useState<string>("all");
  const [criticalityFilter, setCriticalityFilter] = useState<string>("all");
  const [buildingFilter, setBuildingFilter] = useState<string>("all");

  // Query all assets that are down, need repair, or have active parts bidding/ordered
  const { data: downEquipment = [], isLoading } = useQuery({
    queryKey: ["equipment-down"],
    queryFn: async () => {
      // 1. Fetch assets with status 'down', 'needs_repair', 'offline', or 'maintenance'
      const { data: assetsData, error: assetErr } = await supabase
        .from("assets")
        .select(
          "id, name, tag_number, status, criticality, building, manufacturer, model, serial_number, notes, manufacturer_url",
        )
        .or("status.eq.down,status.eq.needs_repair,status.eq.maintenance,status.eq.offline")
        .order("criticality", { ascending: false });

      if (assetErr) throw assetErr;

      const assets = assetsData || [];
      const assetIds = assets.map((a) => a.id);

      // Also get any active part requests that are 'bidding' or 'ordered'
      const { data: activePartReqsData } = await supabase
        .from("part_requests")
        .select("*")
        .or("status.eq.bidding,status.eq.ordered,status.eq.requested")
        .order("created_at", { ascending: false });

      const allPartReqs = (activePartReqsData || []) as PartRequestRow[];

      // If an asset has active bidding/ordered parts but status wasn't 'down', fetch that asset too
      const extraAssetIds = allPartReqs
        .map((r) => r.asset_id)
        .filter((id): id is string => Boolean(id) && !assetIds.includes(id));

      if (extraAssetIds.length > 0) {
        const { data: extraAssets } = await supabase
          .from("assets")
          .select(
            "id, name, tag_number, status, criticality, building, manufacturer, model, serial_number, notes, manufacturer_url",
          )
          .in("id", extraAssetIds);

        if (extraAssets) {
          assets.push(...extraAssets);
          extraAssets.forEach((ea) => assetIds.push(ea.id));
        }
      }

      // Fetch open work orders for these assets
      let wos: WorkOrderRow[] = [];
      if (assetIds.length > 0) {
        const { data: woData } = await supabase
          .from("work_orders")
          .select("id, wo_number, title, status, priority, labor_hours, asset_id")
          .in("asset_id", assetIds)
          .neq("status", "completed")
          .neq("status", "cancelled");
        wos = woData || [];
      }

      // Merge into DownEquipmentItem records
      const results: DownEquipmentItem[] = assets.map((a) => ({
        asset: a,
        partRequests: allPartReqs.filter((p) => p.asset_id === a.id),
        workOrders: wos.filter((w) => w.asset_id === a.id),
      }));

      return results;
    },
  });

  // Mutation to quickly toggle equipment status (e.g. Return to Operational)
  const setStatusMutation = useMutation({
    mutationFn: async ({ assetId, newStatus }: { assetId: string; newStatus: string }) => {
      const { error } = await supabase
        .from("assets")
        .update({ status: newStatus })
        .eq("id", assetId);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      toast.success(`Equipment status changed to ${variables.newStatus.toUpperCase()}`);
      queryClient.invalidateQueries({ queryKey: ["equipment-down"] });
      queryClient.invalidateQueries({ queryKey: ["assets"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Filtered list
  const filteredList = useMemo(() => {
    return downEquipment.filter((item) => {
      const a = item.asset;
      const q = search.toLowerCase().trim();

      // Search filter
      if (q) {
        const matchName = a.name.toLowerCase().includes(q);
        const matchTag = a.tag_number ? a.tag_number.toLowerCase().includes(q) : false;
        const matchModel = a.model ? a.model.toLowerCase().includes(q) : false;
        const matchMfg = a.manufacturer ? a.manufacturer.toLowerCase().includes(q) : false;
        const matchPo = item.partRequests.some(
          (p) => p.po_number && p.po_number.toLowerCase().includes(q),
        );
        const matchVendor = item.partRequests.some(
          (p) =>
            (p.vendor && p.vendor.toLowerCase().includes(q)) ||
            (p.awarded_vendor && p.awarded_vendor.toLowerCase().includes(q)),
        );

        if (!matchName && !matchTag && !matchModel && !matchMfg && !matchPo && !matchVendor) {
          return false;
        }
      }

      // Status filter
      if (statusFilter !== "all") {
        if (statusFilter === "down" && a.status !== "down") return false;
        if (statusFilter === "needs_repair" && a.status !== "needs_repair") return false;
        if (statusFilter === "maintenance" && a.status !== "maintenance") return false;
      }

      // Criticality filter
      if (criticalityFilter !== "all" && a.criticality !== criticalityFilter) {
        return false;
      }

      // Building filter
      if (buildingFilter !== "all" && a.building !== buildingFilter) {
        return false;
      }

      // Parts procurement filter
      if (partsFilter !== "all") {
        const hasBidding = item.partRequests.some((p) => p.status === "bidding");
        const hasOrdered = item.partRequests.some((p) => p.status === "ordered");
        const hasRequested = item.partRequests.some((p) => p.status === "requested");

        if (partsFilter === "bidding" && !hasBidding) return false;
        if (partsFilter === "ordered" && !hasOrdered) return false;
        if (partsFilter === "requested" && !hasRequested) return false;
        if (partsFilter === "no_parts" && (hasBidding || hasOrdered || hasRequested)) return false;
      }

      return true;
    });
  }, [downEquipment, search, statusFilter, partsFilter, criticalityFilter, buildingFilter]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    let downCount = 0;
    let needsRepairCount = 0;
    let biddingCount = 0;
    let orderedCount = 0;
    let totalEstimatedPartsCost = 0;
    let totalCommittedPartsCost = 0;
    let totalLaborHours = 0;

    downEquipment.forEach((item) => {
      if (item.asset.status === "down") downCount++;
      if (item.asset.status === "needs_repair") needsRepairCount++;

      item.partRequests.forEach((p) => {
        if (p.status === "bidding") {
          biddingCount++;
          if (p.quoted_cost) totalEstimatedPartsCost += Number(p.quoted_cost);
        } else if (p.status === "ordered") {
          orderedCount++;
          if (p.awarded_cost) totalCommittedPartsCost += Number(p.awarded_cost);
          else if (p.quoted_cost) totalCommittedPartsCost += Number(p.quoted_cost);
        } else if (p.status === "requested" && p.quoted_cost) {
          totalEstimatedPartsCost += Number(p.quoted_cost);
        }
      });

      item.workOrders.forEach((w) => {
        if (w.labor_hours) totalLaborHours += Number(w.labor_hours);
      });
    });

    const laborCostTotal = totalLaborHours * 85;
    const totalRepairBurden = totalEstimatedPartsCost + totalCommittedPartsCost + laborCostTotal;

    return {
      downCount,
      needsRepairCount,
      biddingCount,
      orderedCount,
      totalEstimatedPartsCost,
      totalCommittedPartsCost,
      totalLaborHours,
      laborCostTotal,
      totalRepairBurden,
    };
  }, [downEquipment]);

  // Unique buildings
  const buildings = useMemo(() => {
    const set = new Set<string>();
    downEquipment.forEach((item) => {
      if (item.asset.building) set.add(item.asset.building);
    });
    return Array.from(set).sort();
  }, [downEquipment]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/80 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
              <AlertOctagon className="size-5" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
                Equipment Down &amp; Outage Tracker
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Track out-of-service assets, log repair costs, and monitor replacement parts out for
                bid or ordered with purchase orders.
              </p>
            </div>
          </div>
        </div>

        {/* Top Header Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handlePrint}
            className="h-8 gap-1.5 text-xs font-semibold"
          >
            <Printer className="size-3.5 text-muted-foreground" />
            Print Outage Report
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["equipment-down"] })}
            className="h-8 gap-1.5 text-xs font-semibold"
          >
            <RotateCcw className="size-3.5 text-muted-foreground" />
            Refresh
          </Button>

          <ReportDownAssetDialog
            trigger={
              <Button
                size="sm"
                className="h-8 gap-1.5 text-xs font-bold bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm"
              >
                <AlertOctagon className="size-3.5" />
                Report Equipment Outage
              </Button>
            }
          />
        </div>
      </div>

      {/* KPI Metric Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {/* Down Equipment */}
        <div className="panel p-3.5 border-l-4 border-l-destructive bg-card flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Down / Offline
            </span>
            <AlertOctagon className="size-4 text-destructive" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-destructive font-mono">
              {metrics.downCount}
            </span>
            <span className="text-xs text-muted-foreground ml-1.5">units</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">High priority plant outages</p>
        </div>

        {/* Needs Repair */}
        <div className="panel p-3.5 border-l-4 border-l-amber-500 bg-card flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Needs Repair
            </span>
            <Wrench className="size-4 text-amber-500" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono">
              {metrics.needsRepairCount}
            </span>
            <span className="text-xs text-muted-foreground ml-1.5">units</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">Degraded or vibrating units</p>
        </div>

        {/* Parts Out for Bid */}
        <div className="panel p-3.5 border-l-4 border-l-blue-500 bg-card flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Parts Out for Bid
            </span>
            <ShoppingCart className="size-4 text-blue-500" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-blue-600 dark:text-blue-400 font-mono">
              {metrics.biddingCount}
            </span>
            <span className="text-xs text-muted-foreground ml-1.5">RFQ packages</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1 font-mono">
            Est: $
            {metrics.totalEstimatedPartsCost.toLocaleString("en-US", {
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            })}
          </p>
        </div>

        {/* Parts Ordered */}
        <div className="panel p-3.5 border-l-4 border-l-emerald-500 bg-card flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Parts Ordered
            </span>
            <Truck className="size-4 text-emerald-500" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
              {metrics.orderedCount}
            </span>
            <span className="text-xs text-muted-foreground ml-1.5">POs issued</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1 font-mono">
            Committed: $
            {metrics.totalCommittedPartsCost.toLocaleString("en-US", {
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            })}
          </p>
        </div>

        {/* Total Cost Impact */}
        <div className="panel p-3.5 border-l-4 border-l-primary bg-card col-span-2 md:col-span-1 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Total Repair Cost
            </span>
            <DollarSign className="size-4 text-primary" />
          </div>
          <div className="mt-2">
            <span className="text-xl font-black text-primary font-mono">
              $
              {metrics.totalRepairBurden.toLocaleString("en-US", {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1 font-mono">
            Parts + {metrics.totalLaborHours} hrs labor
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="panel p-3.5 bg-muted/20 space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by equipment name, tag, model, PO#, vendor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 text-xs h-9 bg-background"
            />
          </div>

          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-40 text-xs bg-background">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Outage Statuses</SelectItem>
              <SelectItem value="down">🔴 Down Only</SelectItem>
              <SelectItem value="needs_repair">🟡 Needs Repair Only</SelectItem>
              <SelectItem value="maintenance">🔵 In Maintenance</SelectItem>
            </SelectContent>
          </Select>

          {/* Parts Filter */}
          <Select value={partsFilter} onValueChange={setPartsFilter}>
            <SelectTrigger className="h-9 w-44 text-xs bg-background">
              <SelectValue placeholder="All Parts Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Parts Statuses</SelectItem>
              <SelectItem value="bidding">🏷️ Out for Bid Only</SelectItem>
              <SelectItem value="ordered">📦 Parts Ordered Only</SelectItem>
              <SelectItem value="requested">⏳ Requisition Needed</SelectItem>
              <SelectItem value="no_parts">🚫 No Parts Required</SelectItem>
            </SelectContent>
          </Select>

          {/* Building Filter */}
          {buildings.length > 0 && (
            <Select value={buildingFilter} onValueChange={setBuildingFilter}>
              <SelectTrigger className="h-9 w-44 text-xs bg-background">
                <SelectValue placeholder="All Buildings" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Plant Buildings</SelectItem>
                {buildings.map((b) => (
                  <SelectItem key={b} value={b} className="text-xs">
                    {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Quick Filter Tag Badges */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs border-t border-border/50">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-muted-foreground text-[11px] font-medium">Quick Views:</span>
            <Button
              size="sm"
              variant={partsFilter === "bidding" ? "secondary" : "ghost"}
              onClick={() => setPartsFilter(partsFilter === "bidding" ? "all" : "bidding")}
              className="h-6 text-[11px] px-2 gap-1 rounded-full"
            >
              🏷️ Out for Bid ({metrics.biddingCount})
            </Button>
            <Button
              size="sm"
              variant={partsFilter === "ordered" ? "secondary" : "ghost"}
              onClick={() => setPartsFilter(partsFilter === "ordered" ? "all" : "ordered")}
              className="h-6 text-[11px] px-2 gap-1 rounded-full"
            >
              📦 Ordered ({metrics.orderedCount})
            </Button>
            <Button
              size="sm"
              variant={statusFilter === "down" ? "secondary" : "ghost"}
              onClick={() => setStatusFilter(statusFilter === "down" ? "all" : "down")}
              className="h-6 text-[11px] px-2 gap-1 rounded-full"
            >
              🔴 Critical Down ({metrics.downCount})
            </Button>
          </div>

          <span className="text-[11px] text-muted-foreground font-mono">
            Showing {filteredList.length} of {downEquipment.length} equipment items
          </span>
        </div>
      </div>

      {/* Main Outages List */}
      {isLoading ? (
        <div className="panel p-12 text-center text-xs text-muted-foreground space-y-2">
          <RotateCcw className="size-5 animate-spin mx-auto text-primary" />
          <p>Loading down equipment and procurement data…</p>
        </div>
      ) : filteredList.length === 0 ? (
        <div className="panel p-12 text-center space-y-3">
          <div className="flex size-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 mx-auto">
            <CheckCircle2 className="size-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">No Equipment Currently Down</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
              All active units match operational status or your selected search filters are
              filtering out all results.
            </p>
          </div>
          <div className="pt-2">
            <ReportDownAssetDialog
              trigger={
                <Button size="sm" className="h-8 gap-1.5 text-xs font-semibold">
                  <AlertOctagon className="size-3.5" />
                  Report an Outage
                </Button>
              }
            />
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredList.map(({ asset, partRequests, workOrders }) => {
            const mfg = asset.manufacturer || "";
            const model = asset.model || "";
            const portalInfo = getManufacturerPortalInfo(
              mfg,
              model,
              asset.manufacturer_url,
              asset.name,
            );

            // Calculate costs for this asset
            let assetPartsQuoted = 0;
            let assetPartsAwarded = 0;
            let totalWoHours = 0;

            partRequests.forEach((pr) => {
              if (pr.quoted_cost) assetPartsQuoted += Number(pr.quoted_cost);
              if (pr.awarded_cost) assetPartsAwarded += Number(pr.awarded_cost);
            });

            workOrders.forEach((wo) => {
              if (wo.labor_hours) totalWoHours += Number(wo.labor_hours);
            });

            const assetPartsEffective =
              assetPartsAwarded > 0 ? assetPartsAwarded : assetPartsQuoted;
            const assetLaborCost = totalWoHours * 85;
            const assetTotalCost = assetPartsEffective + assetLaborCost;

            const isDown = asset.status === "down";
            const isNeedsRepair = asset.status === "needs_repair";

            // Determine primary procurement state
            const biddingReqs = partRequests.filter((pr) => pr.status === "bidding");
            const orderedReqs = partRequests.filter((pr) => pr.status === "ordered");
            const requestedReqs = partRequests.filter((pr) => pr.status === "requested");

            return (
              <div
                key={asset.id}
                className={`panel p-4 space-y-4 transition-all border-l-4 ${
                  isDown
                    ? "border-l-destructive shadow-xs"
                    : isNeedsRepair
                      ? "border-l-amber-500"
                      : "border-l-blue-500"
                }`}
              >
                {/* Item Header */}
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-3 border-b border-border/60 pb-3">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to="/assets/$assetId"
                        params={{ assetId: asset.id }}
                        className="text-base font-bold text-foreground hover:text-primary hover:underline flex items-center gap-1.5"
                      >
                        {asset.name}
                        <ChevronRight className="size-4 text-muted-foreground opacity-60" />
                      </Link>

                      {/* Status Dropdown */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            className={`h-6 text-[11px] font-extrabold px-2.5 rounded-full cursor-pointer gap-1.5 ${
                              isDown
                                ? "bg-destructive/10 text-destructive border-destructive/40 hover:bg-destructive/20"
                                : isNeedsRepair
                                  ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/40 hover:bg-amber-500/20"
                                  : "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/40"
                            }`}
                          >
                            <span
                              className={`size-2 rounded-full ${isDown ? "bg-destructive animate-pulse" : isNeedsRepair ? "bg-amber-500" : "bg-blue-500"}`}
                            />
                            {asset.status.toUpperCase().replace("_", " ")}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-48 text-xs">
                          <DropdownMenuLabel>Change Equipment Status</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() =>
                              setStatusMutation.mutate({ assetId: asset.id, newStatus: "down" })
                            }
                            className="text-destructive font-semibold"
                          >
                            🔴 Mark Down (Offline)
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              setStatusMutation.mutate({
                                assetId: asset.id,
                                newStatus: "needs_repair",
                              })
                            }
                            className="text-amber-600 font-semibold"
                          >
                            🟡 Mark Needs Repair
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              setStatusMutation.mutate({
                                assetId: asset.id,
                                newStatus: "maintenance",
                              })
                            }
                          >
                            🔵 Mark In Maintenance
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() =>
                              setStatusMutation.mutate({
                                assetId: asset.id,
                                newStatus: "operational",
                              })
                            }
                            className="text-emerald-600 font-semibold"
                          >
                            🟢 Clear &amp; Restore Operational
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>

                      <Badge
                        variant={asset.criticality === "high" ? "destructive" : "secondary"}
                        className="text-[10px] uppercase font-bold"
                      >
                        {asset.criticality} criticality
                      </Badge>

                      {asset.tag_number && (
                        <span className="text-[11px] font-mono text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded">
                          Tag: {asset.tag_number}
                        </span>
                      )}

                      {asset.building && (
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Building2 className="size-3 text-muted-foreground" />
                          {asset.building}
                        </span>
                      )}
                    </div>

                    {/* Manufacturer & Model Links Bar */}
                    <div className="flex flex-wrap items-center gap-2 pt-0.5 text-xs text-muted-foreground">
                      <span>
                        OEM: <strong className="text-foreground">{mfg || "Unspecified"}</strong>
                      </span>
                      {model && (
                        <span>
                          · Model: <strong className="font-mono text-foreground">{model}</strong>
                        </span>
                      )}
                      {asset.serial_number && (
                        <span>
                          · S/N:{" "}
                          <span className="font-mono text-foreground">{asset.serial_number}</span>
                        </span>
                      )}

                      {/* Direct Manufacturer Website & On-Site Search Links */}
                      <div className="flex items-center gap-1.5 ml-1 flex-wrap">
                        <Button
                          size="sm"
                          variant="outline"
                          asChild
                          className="h-6 text-[11px] px-2 gap-1 border-primary/30 text-primary hover:bg-primary/10"
                        >
                          <a
                            href={portalInfo.companySearchUrl || portalInfo.modelUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={`Search ${portalInfo.name} official website for model ${model || asset.name}`}
                          >
                            <Search className="size-2.5" />
                            Search {portalInfo.name} Site
                          </a>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          asChild
                          className="h-6 text-[11px] px-2 gap-1 text-muted-foreground hover:text-foreground"
                        >
                          <a
                            href={portalInfo.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={`Open ${portalInfo.name} Official Website`}
                          >
                            <Globe className="size-2.5" />
                            Official Site
                          </a>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          asChild
                          className="h-6 text-[11px] px-2 gap-1 border-border hover:bg-muted text-foreground"
                        >
                          <a
                            href={portalInfo.manualsSearchUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Find O&M manual on manufacturer site"
                          >
                            <BookOpen className="size-2.5 text-rose-500" />
                            O&amp;M Manual
                          </a>
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Top Right Quick Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <RepairCostDialog
                      assetId={asset.id}
                      assetName={asset.name}
                      partRequestId={partRequests[0]?.id}
                      workOrderId={workOrders[0]?.id}
                      currentQuotedCost={assetPartsQuoted || null}
                      currentAwardedCost={assetPartsAwarded || null}
                      currentLaborHours={totalWoHours || 4}
                      currentNotes={asset.notes}
                      trigger={
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1.5 text-xs font-semibold"
                        >
                          <DollarSign className="size-3.5 text-emerald-600" />
                          Update Repair Cost
                        </Button>
                      }
                    />

                    <WorkOrderDialog
                      assetId={asset.id}
                      trigger={
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1 text-xs font-semibold"
                        >
                          <Plus className="size-3.5" /> Create WO
                        </Button>
                      }
                    />

                    <Button size="sm" variant="ghost" asChild className="h-8 text-xs font-semibold">
                      <Link to="/assets/$assetId" params={{ assetId: asset.id }}>
                        Asset Specs
                      </Link>
                    </Button>
                  </div>
                </div>

                {/* Outage Issue & Failure Description */}
                {asset.notes && (
                  <div className="rounded-md bg-muted/40 p-3 text-xs border border-border/60">
                    <p className="font-semibold text-foreground flex items-center gap-1.5 mb-1">
                      <AlertTriangle className="size-3.5 text-amber-500" /> Failure Issue &amp;
                      Repair Scope:
                    </p>
                    <p className="text-muted-foreground whitespace-pre-line">{asset.notes}</p>
                  </div>
                )}

                {/* Two-Column Grid: 1) Repair Costs 2) Parts Procurement Status */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  {/* Column 1: Repair Cost Breakdown */}
                  <div className="rounded-lg border border-border bg-card/60 p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between border-b border-border/50 pb-2">
                      <span className="font-bold text-foreground flex items-center gap-1.5">
                        <DollarSign className="size-4 text-emerald-600" /> Repair Cost Accounting
                      </span>
                      <span className="text-xs font-mono font-black text-primary">
                        Total: $
                        {assetTotalCost.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground text-[11px]">
                          Parts Quoted / Est:
                        </span>
                        <p className="font-mono font-semibold text-foreground">
                          {assetPartsQuoted > 0 ? `$${assetPartsQuoted.toFixed(2)}` : "—"}
                        </p>
                      </div>

                      <div>
                        <span className="text-muted-foreground text-[11px]">
                          Parts Committed (PO):
                        </span>
                        <p className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {assetPartsAwarded > 0 ? `$${assetPartsAwarded.toFixed(2)}` : "—"}
                        </p>
                      </div>

                      <div>
                        <span className="text-muted-foreground text-[11px]">Labor Hours:</span>
                        <p className="font-mono font-semibold text-foreground">
                          {totalWoHours > 0 ? `${totalWoHours} hrs` : "Pending est."}
                        </p>
                      </div>

                      <div>
                        <span className="text-muted-foreground text-[11px]">
                          Labor Cost (@$85/hr):
                        </span>
                        <p className="font-mono font-semibold text-foreground">
                          ${assetLaborCost.toFixed(2)}
                        </p>
                      </div>
                    </div>

                    <div className="pt-1 flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground">
                        {workOrders.length} active work order{workOrders.length !== 1 ? "s" : ""}
                      </span>
                      <RepairCostDialog
                        assetId={asset.id}
                        assetName={asset.name}
                        partRequestId={partRequests[0]?.id}
                        workOrderId={workOrders[0]?.id}
                        currentQuotedCost={assetPartsQuoted || null}
                        currentAwardedCost={assetPartsAwarded || null}
                        currentLaborHours={totalWoHours || 4}
                        currentNotes={asset.notes}
                        trigger={
                          <button
                            type="button"
                            className="text-[11px] font-semibold text-primary hover:underline inline-flex items-center gap-1"
                          >
                            Edit Cost Elements &gt;
                          </button>
                        }
                      />
                    </div>
                  </div>

                  {/* Column 2: Parts Out for Bid / Ordered Procurement */}
                  <div className="rounded-lg border border-border bg-card/60 p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between border-b border-border/50 pb-2">
                      <span className="font-bold text-foreground flex items-center gap-1.5">
                        <Wrench className="size-4 text-primary" /> Replacement Parts Status
                      </span>
                      <div className="flex items-center gap-1.5">
                        {orderedReqs.length > 0 && (
                          <Badge className="bg-emerald-500 text-white font-bold text-[10px] gap-1 py-0.5">
                            <Truck className="size-3" /> PARTS ORDERED
                          </Badge>
                        )}
                        {biddingReqs.length > 0 && (
                          <Badge className="bg-blue-600 text-white font-bold text-[10px] gap-1 py-0.5">
                            <ShoppingCart className="size-3" /> OUT FOR BID
                          </Badge>
                        )}
                        {orderedReqs.length === 0 &&
                          biddingReqs.length === 0 &&
                          requestedReqs.length > 0 && (
                            <Badge
                              variant="outline"
                              className="text-amber-600 border-amber-500/40 text-[10px] gap-1 py-0.5 font-bold"
                            >
                              <Clock className="size-3" /> RFQ REQUESTED
                            </Badge>
                          )}
                        {partRequests.length === 0 && (
                          <Badge variant="secondary" className="text-[10px] text-muted-foreground">
                            NO PARTS LINKED
                          </Badge>
                        )}
                      </div>
                    </div>

                    {partRequests.length > 0 ? (
                      <div className="space-y-2">
                        {partRequests.map((pr) => {
                          const isBidding = pr.status === "bidding";
                          const isOrdered = pr.status === "ordered";
                          const isReceived = pr.status === "received";

                          return (
                            <div
                              key={pr.id}
                              className="rounded-md border border-border/70 bg-background/80 p-2.5 space-y-1.5"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="font-semibold text-foreground text-xs">
                                    {pr.title}
                                  </p>
                                  {pr.vendor && (
                                    <p className="text-[11px] text-muted-foreground">
                                      Vendor / RFQ:{" "}
                                      <strong className="text-foreground">{pr.vendor}</strong>
                                    </p>
                                  )}
                                  {pr.po_number && (
                                    <p className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                                      PO: {pr.po_number}
                                    </p>
                                  )}
                                </div>

                                <div className="text-right shrink-0">
                                  <span className="font-mono font-bold text-xs text-foreground block">
                                    {pr.awarded_cost != null
                                      ? `$${Number(pr.awarded_cost).toFixed(2)}`
                                      : pr.quoted_cost != null
                                        ? `Est: $${Number(pr.quoted_cost).toFixed(2)}`
                                        : "Quote pend."}
                                  </span>
                                  {pr.expected_date && (
                                    <span className="text-[10px] text-muted-foreground font-mono block">
                                      ETA: {pr.expected_date}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center justify-between pt-1 border-t border-border/40">
                                <span className="text-[10px] text-muted-foreground capitalize font-medium">
                                  Status:{" "}
                                  <strong className="text-foreground">
                                    {pr.status === "bidding" ? "Out for Bid" : pr.status}
                                  </strong>
                                </span>
                                <PartOrderUpdateDialog
                                  request={pr}
                                  trigger={
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 text-[11px] font-semibold text-primary hover:underline px-1.5"
                                    >
                                      Update Order / Bid &gt;
                                    </Button>
                                  }
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-3 rounded-md border border-dashed border-border text-center space-y-1">
                        <p className="text-[11px] text-muted-foreground">
                          No replacement parts request has been logged for this repair yet.
                        </p>
                        <RepairCostDialog
                          assetId={asset.id}
                          assetName={asset.name}
                          trigger={
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs font-semibold gap-1"
                            >
                              <Plus className="size-3" /> Log Parts / Put Out for Bid
                            </Button>
                          }
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Work Orders List / Emergency Response */}
                {workOrders.length > 0 && (
                  <div className="pt-1 flex flex-wrap items-center gap-2 text-xs border-t border-border/40">
                    <span className="text-muted-foreground font-medium text-[11px]">
                      Active Work Orders:
                    </span>
                    {workOrders.map((wo) => (
                      <Badge
                        key={wo.id}
                        variant="outline"
                        className="gap-1 font-mono text-[11px] bg-background text-foreground"
                      >
                        <FileText className="size-3 text-primary" />
                        WO-{wo.wo_number}: {wo.title.slice(0, 35)}
                        {wo.title.length > 35 ? "…" : ""}
                        <span className="text-muted-foreground">({wo.status})</span>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

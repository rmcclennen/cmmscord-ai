import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WorkOrderDialog } from "@/components/work-order-dialog";
import { DeleteRequestDialog } from "@/components/delete-request-dialog";
import { RelabelAssetDialog } from "@/components/relabel-asset-dialog";
import { QrLabelDialog } from "@/components/qr-label-dialog";
import { CreatePmScheduleDialog } from "@/components/create-pm-schedule-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ALL_BUILDING_OPTIONS, buildingOf, classLabel, prettyLabel } from "@/lib/cmms";
import { SystemBadge } from "@/components/system-badge";
import { SendPartsDialog } from "@/components/send-parts-dialog";
import { PartsLookupDialog } from "@/components/parts-lookup-dialog";
import { RepairCostDialog } from "@/components/repair-cost-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertOctagon,
  ArrowLeft,
  BookOpen,
  CalendarPlus,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Globe,
  PackagePlus,
  Pencil,
  Plus,
  QrCode,
  Search,
  ShoppingCart,
  Sparkles,
  Tag,
  Trash2,
} from "lucide-react";
import type { AssetCtx } from "./use-asset-detail";

export function AssetHeader({ ctx }: { ctx: AssetCtx }) {
  const {
    a,
    activePartRequestsCount,
    allAssets,
    assetId,
    currentAssetData,
    currentIndex,
    lookup,
    mfgPortalInfo,
    moveBuilding,
    navigate,
    nextAsset,
    nextUpcomingPm,
    openGoogleManualSearch,
    overduePmsCount,
    partRequestsList,
    pmList,
    prevAsset,
    resolvedSystem,
    setTab,
    updateAssetStatusMutation,
  } = ctx;
  return (
    <>
      {/* Top Asset Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
        <div className="flex items-center gap-2.5">
          <Link
            to="/assets"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors hover:underline"
          >
            <ArrowLeft className="size-4" /> All assets
          </Link>
          {allAssets.length > 0 && currentIndex >= 0 && (
            <Badge
              variant="outline"
              className="text-xs font-mono font-normal text-muted-foreground bg-muted/40"
            >
              #{currentIndex + 1} of {allAssets.length}
            </Badge>
          )}
        </div>

        {/* Quick Asset Switcher & Prev / Next Controls */}
        <div className="flex items-center gap-1.5">
          {prevAsset ? (
            <Link
              to="/assets/$assetId"
              params={{ assetId: prevAsset.id }}
              className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md border border-input bg-background hover:bg-muted text-xs font-medium text-foreground transition-colors shadow-xs"
              title={`Previous: ${prevAsset.name} ${prevAsset.tag_number ? `[${prevAsset.tag_number}]` : ""} (Alt + ←)`}
            >
              <ChevronLeft className="size-3.5" />
              <span className="hidden sm:inline">Prev</span>
            </Link>
          ) : (
            <Button
              disabled
              variant="outline"
              size="sm"
              className="h-8 px-2.5 text-xs text-muted-foreground gap-1 opacity-40 cursor-not-allowed"
            >
              <ChevronLeft className="size-3.5" />
              <span className="hidden sm:inline">Prev</span>
            </Button>
          )}

          {allAssets.length > 0 && (
            <Select
              value={assetId}
              onValueChange={(selectedId) => {
                if (selectedId && selectedId !== assetId) {
                  navigate({ to: "/assets/$assetId", params: { assetId: selectedId } });
                }
              }}
            >
              <SelectTrigger className="h-8 w-44 sm:w-60 text-xs bg-background font-medium">
                <SelectValue placeholder={`Asset ${currentIndex + 1} of ${allAssets.length}`} />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {allAssets.map((item, idx) => (
                  <SelectItem key={item.id} value={item.id} className="text-xs">
                    <span className="font-mono text-muted-foreground mr-1.5">{idx + 1}.</span>
                    <span className="font-medium">{item.name}</span>{" "}
                    {item.tag_number && (
                      <span className="text-muted-foreground font-mono">[{item.tag_number}]</span>
                    )}
                    {item.resolvedBuilding && (
                      <span className="text-[11px] text-muted-foreground ml-1">
                        · {item.resolvedBuilding}
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {nextAsset ? (
            <Link
              to="/assets/$assetId"
              params={{ assetId: nextAsset.id }}
              className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md border border-primary/40 bg-primary/10 hover:bg-primary/20 text-xs font-semibold text-primary transition-colors shadow-xs"
              title={`Next: ${nextAsset.name} ${nextAsset.tag_number ? `[${nextAsset.tag_number}]` : ""} (Alt + →)`}
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRight className="size-3.5" />
            </Link>
          ) : (
            <Button
              disabled
              variant="outline"
              size="sm"
              className="h-8 px-2.5 text-xs text-muted-foreground gap-1 opacity-40 cursor-not-allowed"
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRight className="size-3.5" />
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="label-caps">{classLabel(a.class)}</p>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold">{a.name}</h1>
            <RelabelAssetDialog
              assetId={a.id}
              initialAsset={a}
              trigger={
                <Button
                  size="sm"
                  variant="ghost"
                  className="size-7 p-0 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                  title="Relabel asset and update entire program"
                >
                  <Pencil className="size-3.5" />
                </Button>
              }
            />
            <QrLabelDialog
              assets={[
                {
                  id: a.id,
                  name: a.name,
                  tag_number: a.tag_number,
                  building: currentAssetData?.building,
                  location_name: currentAssetData?.location_name,
                },
              ]}
              trigger={
                <Button
                  size="sm"
                  variant="ghost"
                  className="size-7 p-0 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                  title="Print a QR label for this equipment"
                >
                  <QrCode className="size-3.5" />
                </Button>
              }
            />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <SystemBadge system={resolvedSystem} size="md" />

            {/* Interactive Status Switcher */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className={`h-6 text-xs font-semibold px-2.5 gap-1.5 rounded-full cursor-pointer ${
                    a.status === "down"
                      ? "bg-destructive/15 text-destructive border-destructive/40 hover:bg-destructive/25"
                      : a.status === "needs_repair"
                        ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40 hover:bg-amber-500/25"
                        : "text-foreground"
                  }`}
                >
                  <span
                    className={`size-2 rounded-full ${
                      a.status === "down"
                        ? "bg-destructive animate-pulse"
                        : a.status === "needs_repair"
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                    }`}
                  />
                  {prettyLabel(a.status)}
                  <ChevronDown className="size-3 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52 text-xs">
                <DropdownMenuLabel>Equipment Operational Status</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => updateAssetStatusMutation.mutate("down")}
                  className="text-destructive font-semibold"
                >
                  🔴 Mark Down (Offline)
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => updateAssetStatusMutation.mutate("needs_repair")}
                  className="text-amber-600 font-semibold"
                >
                  🟡 Mark Needs Repair
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => updateAssetStatusMutation.mutate("maintenance")}>
                  🔵 Mark In Maintenance
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => updateAssetStatusMutation.mutate("operational")}
                  className="text-emerald-600 font-semibold"
                >
                  🟢 Clear to Operational
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Direct Manufacturer Website & On-Site Search Links */}
            {(a.manufacturer || a.make || a.manufacturer_url || mfgPortalInfo.hasDirectPortal) && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  asChild
                  className="h-6 text-xs gap-1 border-primary/30 text-primary hover:bg-primary/10"
                >
                  <a
                    href={mfgPortalInfo.companySearchUrl || mfgPortalInfo.modelUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`Search ${mfgPortalInfo.name}'s official website for ${a.model || a.name || "equipment"}`}
                  >
                    <Search className="size-3" />
                    Search {mfgPortalInfo.name} {a.model ? `("${a.model}")` : "Site"}
                    <ExternalLink className="size-2.5 opacity-70" />
                  </a>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  asChild
                  className="h-6 text-xs gap-1 text-muted-foreground hover:text-foreground hidden sm:inline-flex"
                >
                  <a
                    href={mfgPortalInfo.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`Open ${mfgPortalInfo.name} Official Website`}
                  >
                    <Globe className="size-3" />
                    Official Site
                  </a>
                </Button>
                {mfgPortalInfo.directDocsUrl &&
                  mfgPortalInfo.directDocsUrl !== mfgPortalInfo.website && (
                    <Button
                      size="sm"
                      variant="ghost"
                      asChild
                      className="h-6 text-xs gap-1 text-muted-foreground hover:text-foreground hidden md:inline-flex"
                    >
                      <a
                        href={mfgPortalInfo.directDocsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`Open ${mfgPortalInfo.name} Documentation Library`}
                      >
                        <BookOpen className="size-3" />
                        Tech Library
                      </a>
                    </Button>
                  )}
              </>
            )}

            {/* Google manual search button */}
            <Button
              size="sm"
              variant="outline"
              onClick={openGoogleManualSearch}
              className="h-6 text-xs gap-1 border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
              title="Open a Google search for this equipment's manual"
            >
              <Search className="size-3 text-amber-500" />
              Scan for manual
            </Button>

            {/* AI Maintenance / PMs Research button */}
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setTab("specs");
                lookup.mutate();
              }}
              disabled={lookup.isPending}
              className="h-6 text-xs gap-1 border-primary/40 text-primary hover:bg-primary/10"
              title="Generate PM schedule, lubrication intervals, and wear parts with AI"
            >
              <Sparkles className="size-3 text-primary" />
              {lookup.isPending ? "AI Researching…" : "AI PM Research"}
            </Button>

            {/* Quick Search Manuals tab switcher */}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setTab("manuals")}
              className="h-6 text-xs gap-1 border-border hover:bg-muted text-foreground"
            >
              <BookOpen className="size-3 text-rose-500" />
              Manuals &amp; Diagrams
            </Button>

            <Badge variant={a.criticality === "high" ? "destructive" : "secondary"}>
              {prettyLabel(a.criticality)} criticality
            </Badge>
            {a.tag_number && (
              <span className="font-mono text-xs text-muted-foreground">Tag: {a.tag_number}</span>
            )}
            {pmList.length > 0 && (
              <Badge
                variant={overduePmsCount > 0 ? "destructive" : "outline"}
                className="font-mono text-xs cursor-pointer gap-1"
                onClick={() => setTab("pms")}
                title="View PM schedules for this asset"
              >
                <Clock className="size-3" />
                {pmList.length} PM{pmList.length > 1 ? "s" : ""}
                {overduePmsCount > 0
                  ? ` · ${overduePmsCount} Overdue`
                  : ` · Next ${nextUpcomingPm?.next_due}`}
              </Badge>
            )}
            {partRequestsList.length > 0 && (
              <Badge
                variant="outline"
                className={`font-mono text-xs cursor-pointer gap-1 ${
                  activePartRequestsCount > 0
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 font-semibold"
                    : "text-muted-foreground"
                }`}
                onClick={() => setTab("parts")}
                title="View parts requisitions and orders for this asset"
              >
                <ShoppingCart className="size-3 text-amber-600 dark:text-amber-400" />
                {partRequestsList.length} Part Order{partRequestsList.length > 1 ? "s" : ""}
                {activePartRequestsCount > 0
                  ? ` · ${activePartRequestsCount} Active`
                  : ` · All Received`}
              </Badge>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="label-caps">Building / area</span>
            <Select
              value={a.building ?? "auto"}
              onValueChange={(v) => moveBuilding.mutate(v)}
              disabled={moveBuilding.isPending}
            >
              <SelectTrigger className="h-8 w-56 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">
                  Auto — {buildingOf(a.name, null, a.location_name)}
                </SelectItem>
                {ALL_BUILDING_OPTIONS.map((b) => (
                  <SelectItem key={b} value={b}>
                    {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(a.status === "down" || a.status === "needs_repair") && (
            <RepairCostDialog
              assetId={a.id}
              assetName={a.name}
              partRequestId={partRequestsList[0]?.id}
              currentQuotedCost={partRequestsList[0]?.quoted_cost}
              currentAwardedCost={partRequestsList[0]?.awarded_cost}
              currentNotes={a.notes}
              trigger={
                <Button variant="destructive" className="gap-1.5 font-bold shadow-xs text-xs h-9">
                  <AlertOctagon className="size-3.5" />
                  {a.status === "down" ? "DOWN — Track Repair Cost" : "REPAIR — Track Cost"}
                </Button>
              }
            />
          )}
          <PartsLookupDialog
            asset={{
              id: a.id,
              name: a.name,
              manufacturer: a.manufacturer,
              model: a.model,
              tag_number: a.tag_number,
              manufacturer_url: a.manufacturer_url,
            }}
            trigger={
              <Button
                variant="outline"
                className="gap-1.5 font-semibold text-primary border-primary/40 hover:bg-primary/10"
              >
                <Sparkles className="size-3.5 text-primary" /> AI Google Parts Lookup
              </Button>
            }
          />
          <SendPartsDialog
            asset={{ id: a.id, name: a.name, manufacturer: a.manufacturer }}
            lockAsset
            trigger={
              <Button
                variant="outline"
                className="gap-1.5 font-semibold text-foreground border-border hover:bg-muted"
              >
                <PackagePlus className="size-3.5 text-primary" /> Order / Requisition Parts
              </Button>
            }
          />
          <CreatePmScheduleDialog
            assetId={a.id}
            assetName={a.name}
            lockAsset
            trigger={
              <Button
                variant="outline"
                className="gap-1.5 font-semibold text-foreground border-border hover:bg-muted"
              >
                <CalendarPlus className="size-3.5 text-primary" /> Schedule PM
              </Button>
            }
          />
          <RelabelAssetDialog
            assetId={a.id}
            initialAsset={a}
            trigger={
              <Button
                variant="outline"
                className="gap-1.5 font-semibold text-foreground border-border hover:bg-muted"
              >
                <Tag className="size-3.5 text-primary" /> Relabel asset
              </Button>
            }
          />
          <WorkOrderDialog
            assetId={a.id}
            lockAsset
            defaultTitle=""
            trigger={
              <Button>
                <Plus className="size-4" /> Work order
              </Button>
            }
          />
          <DeleteRequestDialog
            entityType="asset"
            entityId={a.id}
            entityLabel={a.name}
            trigger={
              <Button variant="outline">
                <Trash2 className="size-4" /> Delete
              </Button>
            }
          />
        </div>
      </div>
    </>
  );
}

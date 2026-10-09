import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TabsContent } from "@/components/ui/tabs";
import { EditAssetPartsDialog } from "@/components/edit-asset-parts-dialog";
import { AddAssetPartDialog } from "@/components/add-asset-part-dialog";
import { SendPartsDialog } from "@/components/send-parts-dialog";
import { PartsLookupDialog } from "@/components/parts-lookup-dialog";
import { PartOrderUpdateDialog } from "@/components/part-order-update-dialog";
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
  Boxes,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  Droplet,
  ExternalLink,
  Globe,
  PackagePlus,
  Plus,
  Search,
  Send,
  ShoppingCart,
  Sparkles,
  Trash2,
  Truck,
} from "lucide-react";
import { PART_STATUS_BADGE, getVendorLinks } from "./helpers";
import type { AssetCtx } from "./use-asset-detail";

export function PartsTab({ ctx }: { ctx: AssetCtx }) {
  const {
    a,
    addPartToInventory,
    assetPartRequests,
    consumables,
    dbPartMatch,
    deletePartMutation,
    lookup,
    markRequestReceived,
    partRequestsList,
    parts,
  } = ctx;
  return (
    <TabsContent value="parts" className="mt-4 space-y-4">
      {/* Main Top Actions & Overview */}
      <div className="panel p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold flex items-center gap-2 text-foreground">
                <ShoppingCart className="size-4 text-primary" /> Spare Parts Sourcing &amp;
                Procurement Orders
              </h2>
              <Badge variant="outline" className="text-xs font-mono">
                {partRequestsList.length} Requisition{partRequestsList.length === 1 ? "" : "s"} ·{" "}
                {parts.length} Catalog Parts
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Active parts requisitions, quote bidding, PO tracking, and 1-click vendor order links
              for <span className="font-semibold text-foreground">{a.name}</span>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
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
                  size="sm"
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
                <Button className="gap-1.5 font-bold shadow-sm" size="sm">
                  <PackagePlus className="size-4" /> Requisition / Order Parts
                </Button>
              }
            />
            <EditAssetPartsDialog
              assetId={a.id}
              assetName={a.name}
              manufacturer={a.manufacturer}
              model={a.model}
              currentParts={parts}
              trigger={
                <Button variant="outline" size="sm" className="gap-1.5 text-xs font-medium">
                  <Plus className="size-3.5 text-primary" /> Add Custom Part
                </Button>
              }
            />
            <Button variant="outline" size="sm" asChild className="gap-1.5 text-xs font-medium">
              <Link to="/part-requests">
                <ExternalLink className="size-3.5 text-muted-foreground" /> Procurement Hub
              </Link>
            </Button>
          </div>
        </div>

        {/* Quick Metrics Bar if there are requests */}
        {partRequestsList.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            <div className="rounded-lg border border-border bg-muted/30 p-2.5">
              <p className="text-[11px] font-medium text-muted-foreground">Total Requisitions</p>
              <p className="text-lg font-bold text-foreground">{partRequestsList.length}</p>
            </div>
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5">
              <p className="text-[11px] font-medium text-amber-800 dark:text-amber-300">
                Pending / In Review
              </p>
              <p className="text-lg font-bold text-amber-900 dark:text-amber-200">
                {
                  partRequestsList.filter((r) => r.status === "requested" || r.status === "bidding")
                    .length
                }
              </p>
            </div>
            <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-2.5">
              <p className="text-[11px] font-medium text-blue-800 dark:text-blue-300">
                PO Issued / Ordered
              </p>
              <p className="text-lg font-bold text-blue-900 dark:text-blue-200">
                {partRequestsList.filter((r) => r.status === "ordered").length}
              </p>
            </div>
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2.5">
              <p className="text-[11px] font-medium text-emerald-800 dark:text-emerald-300">
                Received &amp; Stocked
              </p>
              <p className="text-lg font-bold text-emerald-900 dark:text-emerald-200">
                {partRequestsList.filter((r) => r.status === "received").length}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Section: Requisitions and POs Table / List */}
      <div className="panel p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 pb-3">
          <div>
            <h3 className="text-sm font-bold flex items-center gap-2 text-foreground">
              <Truck className="size-4 text-primary" /> Active &amp; Historical Parts Orders for
              this Asset
            </h3>
            <p className="text-xs text-muted-foreground">
              All parts sent to CMMS coordinators and supervisors to be ordered, bid out, or
              stocked.
            </p>
          </div>
          <Button size="sm" variant="ghost" asChild className="text-xs text-primary font-medium">
            <Link to="/part-requests">View All Plant Requisitions →</Link>
          </Button>
        </div>

        {assetPartRequests.isLoading ? (
          <p className="text-xs text-muted-foreground py-4">Loading requisitions...</p>
        ) : partRequestsList.length > 0 ? (
          <div className="space-y-3">
            {partRequestsList.map((req) => {
              const statusInfo = PART_STATUS_BADGE[req.status] || {
                label: req.status,
                className: "bg-muted text-muted-foreground border-border",
              };
              return (
                <div
                  key={req.id}
                  className="rounded-lg border border-border bg-card p-4 space-y-3 shadow-xs hover:border-primary/30 transition-colors"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-sm font-bold text-foreground">{req.title}</h4>
                        <Badge
                          variant="outline"
                          className={`text-[11px] font-semibold ${statusInfo.className}`}
                        >
                          {statusInfo.label}
                        </Badge>
                        {req.priority && req.priority !== "medium" && (
                          <Badge
                            variant={
                              req.priority === "urgent" || req.priority === "high"
                                ? "destructive"
                                : "secondary"
                            }
                            className="text-[10px] uppercase font-bold"
                          >
                            {req.priority}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {[
                          req.route_to === "coordinator"
                            ? "Sent to CMMS Coordinator"
                            : req.route_to === "supervisor"
                              ? "Sent to Supervisor"
                              : req.route_to === "supervisors"
                                ? "Sent to Supervisors & Coordinators"
                                : "Sent to Teammate",
                          req.needed_by ? `Needed by: ${req.needed_by}` : null,
                          `Logged: ${new Date(req.created_at).toLocaleDateString()}`,
                          req.work_orders ? `WO-${req.work_orders.wo_number}` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <PartOrderUpdateDialog request={req} />
                      {req.status !== "received" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1 text-xs font-semibold text-emerald-700 border-emerald-500/40 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
                          disabled={markRequestReceived.isPending}
                          onClick={() => markRequestReceived.mutate(req.id)}
                          title="Mark as received and verified on-site"
                        >
                          <CheckCircle2 className="size-3.5 text-emerald-600" />
                          Mark Received
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="rounded bg-muted/40 p-2.5 text-xs font-mono text-foreground whitespace-pre-wrap border border-border/50">
                    {req.part_lines}
                  </div>

                  {/* PO & Fulfillment details */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground pt-1 border-t border-border/50">
                    <span className="flex items-center gap-1 font-mono">
                      <span className="font-semibold text-foreground">PO#:</span>{" "}
                      {req.po_number ? (
                        <span className="font-bold text-primary">{req.po_number}</span>
                      ) : (
                        <span className="italic text-muted-foreground">Pending</span>
                      )}
                    </span>

                    {(req.awarded_vendor || req.vendor) && (
                      <span className="flex items-center gap-1">
                        <span className="font-semibold text-foreground">Vendor:</span>{" "}
                        {req.awarded_vendor || req.vendor}
                      </span>
                    )}

                    {(req.awarded_cost != null || req.quoted_cost != null) && (
                      <span className="flex items-center gap-1">
                        <span className="font-semibold text-foreground">Cost:</span> $
                        {req.awarded_cost ?? req.quoted_cost}
                      </span>
                    )}

                    {req.expected_date && (
                      <span className="flex items-center gap-1">
                        <span className="font-semibold text-foreground">ETA:</span>{" "}
                        {req.expected_date}
                      </span>
                    )}

                    {req.lead_time_days != null && (
                      <span className="flex items-center gap-1">
                        <span className="font-semibold text-foreground">Lead Time:</span>{" "}
                        {req.lead_time_days} days
                      </span>
                    )}

                    {req.received_at && (
                      <span className="flex items-center gap-1 text-emerald-600 font-medium">
                        <Check className="size-3.5" /> Received{" "}
                        {new Date(req.received_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground space-y-2">
            <ShoppingCart className="mx-auto size-6 text-muted-foreground/60" />
            <p className="font-medium text-foreground">
              No active or historical parts orders logged for this asset yet.
            </p>
            <p>
              Click "Requisition / Order Parts" above or select any part below to send a requisition
              to the CMMS coordinator or maintenance supervisors.
            </p>
            <div className="pt-2">
              <SendPartsDialog
                asset={{ id: a.id, name: a.name, manufacturer: a.manufacturer }}
                lockAsset
                trigger={
                  <Button size="sm" className="gap-1.5 font-semibold">
                    <PackagePlus className="size-3.5" /> Requisition Parts for {a.name}
                  </Button>
                }
              />
            </div>
          </div>
        )}
      </div>

      {/* Section: Wear & Spare Parts Catalog with 1-Click Buy Links */}
      <div className="panel p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold flex items-center gap-2 text-foreground">
                <Boxes className="size-4 text-primary" /> Asset Wear &amp; Spare Parts Catalog
              </h3>
              <Badge variant="secondary" className="text-xs">
                {parts.length} Part{parts.length === 1 ? "" : "s"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              OEM part numbers, specifications, and instant 1-click vendor buying links (McMaster,
              Grainger, Motion, Fastenal).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <AddAssetPartDialog
              assetId={a.id}
              assetName={a.name}
              manufacturer={a.manufacturer}
              trigger={
                <Button size="sm" className="gap-1 text-xs font-medium">
                  <Plus className="size-3.5" /> Add part for this equipment
                </Button>
              }
            />
            <EditAssetPartsDialog
              assetId={a.id}
              assetName={a.name}
              manufacturer={a.manufacturer}
              model={a.model}
              currentParts={parts}
              trigger={
                <Button variant="outline" size="sm" className="gap-1 text-xs font-medium">
                  <Plus className="size-3.5 text-primary" /> Edit / Add Parts
                </Button>
              }
            />
            <Button
              size="sm"
              variant="outline"
              className="gap-1 text-xs font-medium"
              onClick={() => lookup.mutate()}
              disabled={lookup.isPending}
            >
              <Sparkles className="size-3.5 text-primary" />
              {lookup.isPending ? "Researching..." : "Research OEM Parts"}
            </Button>
          </div>
        </div>

        {parts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {parts.map((p, idx) => {
              const links = getVendorLinks(p.name, p.part_number, a.manufacturer, a.name);
              const matchedInv = p.part_number
                ? dbPartMatch.get(p.part_number.toLowerCase().trim()) ||
                  dbPartMatch.get(p.name.toLowerCase().trim())
                : dbPartMatch.get(p.name.toLowerCase().trim());
              return (
                <div
                  key={idx}
                  className="rounded-lg border border-border bg-card p-4 space-y-3 shadow-xs flex flex-col justify-between hover:border-primary/30 transition-colors"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-sm font-bold text-foreground leading-snug">{p.name}</h4>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-6 text-muted-foreground hover:text-destructive"
                        onClick={() => deletePartMutation.mutate(idx)}
                        disabled={deletePartMutation.isPending}
                        title="Remove from asset catalog"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {p.part_number ? (
                        <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 font-mono text-xs font-bold text-primary">
                          P/N: {p.part_number}
                          <button
                            type="button"
                            className="ml-1 text-primary/70 hover:text-primary"
                            onClick={() => {
                              navigator.clipboard.writeText(p.part_number!);
                              toast.success(`Copied P/N ${p.part_number} to clipboard`);
                            }}
                            title="Copy Part Number"
                          >
                            <Copy className="size-3" />
                          </button>
                        </span>
                      ) : (
                        <span className="text-xs italic text-muted-foreground">No OEM P/N</span>
                      )}

                      {a.manufacturer && (
                        <span className="text-xs text-muted-foreground font-medium">
                          OEM: {a.manufacturer}
                        </span>
                      )}

                      {matchedInv?.qty_on_hand != null && (
                        <Badge
                          variant="outline"
                          className={`text-[11px] font-semibold ${
                            matchedInv.qty_on_hand > (matchedInv.min_qty ?? 1)
                              ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800"
                              : "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800"
                          }`}
                        >
                          Stock: {matchedInv.qty_on_hand} {matchedInv.unit || "ea"}
                        </Badge>
                      )}

                      {matchedInv?.unit_cost != null && (
                        <Badge
                          variant="outline"
                          className="text-[11px] font-mono text-muted-foreground bg-muted/40"
                        >
                          ${matchedInv.unit_cost.toFixed(2)}
                        </Badge>
                      )}
                    </div>

                    {p.notes && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{p.notes}</p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-border/50">
                    {/* 1. Send / Requisition Button */}
                    <SendPartsDialog
                      asset={{ id: a.id, name: a.name, manufacturer: a.manufacturer }}
                      lockAsset
                      initialPart={{
                        name: p.name,
                        part_number: p.part_number,
                        manufacturer: a.manufacturer,
                        qty: 1,
                      }}
                      trigger={
                        <Button size="sm" className="h-8 gap-1 text-xs font-bold shadow-xs">
                          <Send className="size-3" /> Requisition / Order
                        </Button>
                      }
                    />

                    {/* 2. Direct Buy / Search Vendor Dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1 text-xs font-semibold"
                        >
                          <Globe className="size-3 text-primary" /> Buy Online{" "}
                          <ChevronDown className="size-3 opacity-60" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56 text-xs">
                        <DropdownMenuLabel className="text-[11px] text-muted-foreground">
                          1-Click Vendor Sourcing
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                          <a
                            href={links.google}
                            target="_blank"
                            rel="noreferrer"
                            className="cursor-pointer gap-2"
                          >
                            <Search className="size-3.5 text-primary" /> Google Industrial Search
                          </a>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <a
                            href={links.grainger}
                            target="_blank"
                            rel="noreferrer"
                            className="cursor-pointer gap-2"
                          >
                            <ExternalLink className="size-3.5 text-orange-600" /> Grainger Catalog
                          </a>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <a
                            href={links.mcmaster}
                            target="_blank"
                            rel="noreferrer"
                            className="cursor-pointer gap-2"
                          >
                            <ExternalLink className="size-3.5 text-emerald-600" /> McMaster-Carr
                            Supply
                          </a>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <a
                            href={links.motion}
                            target="_blank"
                            rel="noreferrer"
                            className="cursor-pointer gap-2"
                          >
                            <ExternalLink className="size-3.5 text-blue-600" /> Motion Industries
                          </a>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <a
                            href={links.fastenal}
                            target="_blank"
                            rel="noreferrer"
                            className="cursor-pointer gap-2"
                          >
                            <ExternalLink className="size-3.5 text-blue-800" /> Fastenal Industrial
                          </a>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <a
                            href={links.amazon}
                            target="_blank"
                            rel="noreferrer"
                            className="cursor-pointer gap-2"
                          >
                            <ExternalLink className="size-3.5 text-amber-600" /> Amazon Business
                          </a>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {/* 3. Add to Stockroom Inventory */}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => addPartToInventory.mutate(p)}
                      disabled={addPartToInventory.isPending}
                      title="Stock this part in plant MRO inventory"
                    >
                      <Boxes className="size-3.5 text-primary" /> Stock
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground space-y-2">
            <Boxes className="mx-auto size-6 text-muted-foreground/60" />
            <p className="font-medium text-foreground">
              No spare parts cataloged for this asset yet.
            </p>
            <p>
              Run manufacturer research or manually add OEM parts to enable 1-click ordering and
              sourcing.
            </p>
            <div className="pt-2 flex items-center justify-center gap-2">
              <Button
                size="sm"
                onClick={() => lookup.mutate()}
                disabled={lookup.isPending}
                className="gap-1.5 font-semibold"
              >
                <Sparkles className="size-3.5" /> Research OEM Parts
              </Button>
              <EditAssetPartsDialog
                assetId={a.id}
                assetName={a.name}
                manufacturer={a.manufacturer}
                model={a.model}
                currentParts={parts}
                trigger={
                  <Button variant="outline" size="sm" className="gap-1.5 font-medium">
                    <Plus className="size-3.5 text-primary" /> Add Custom Part
                  </Button>
                }
              />
            </div>
          </div>
        )}
      </div>

      {/* Section: Consumables, Lubricants & Belts Pack */}
      {consumables && (
        <div className="panel p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 pb-3">
            <div>
              <h3 className="text-sm font-bold flex items-center gap-2 text-foreground">
                <Droplet className="size-4 text-blue-600" /> Lubricants, Greases &amp; Consumables
                Sourcing
              </h3>
              <p className="text-xs text-muted-foreground">
                Recommended factory lubrication, greases, filter, and drive belt specifications for{" "}
                {a.name}.
              </p>
            </div>
            <SendPartsDialog
              asset={{ id: a.id, name: a.name, manufacturer: a.manufacturer }}
              lockAsset
              initialPart={{
                name: `Lube / Filter Kit for ${a.name}`,
                manufacturer: a.manufacturer,
                qty: 1,
              }}
              trigger={
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs font-semibold text-primary"
                >
                  <Send className="size-3" /> Requisition Consumables
                </Button>
              }
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
            {consumables.oilGrade && (
              <div className="rounded-lg border border-border bg-card p-3 space-y-1">
                <p className="text-[11px] font-semibold uppercase text-muted-foreground">
                  Lube / Oil Spec
                </p>
                <p className="text-xs font-bold text-foreground">{consumables.oilGrade}</p>
              </div>
            )}
            {consumables.greaseType && (
              <div className="rounded-lg border border-border bg-card p-3 space-y-1">
                <p className="text-[11px] font-semibold uppercase text-muted-foreground">
                  Bearing Grease Spec
                </p>
                <p className="text-xs font-bold text-foreground">{consumables.greaseType}</p>
              </div>
            )}
            {consumables.beltSize && (
              <div className="rounded-lg border border-border bg-card p-3 space-y-1">
                <p className="text-[11px] font-semibold uppercase text-muted-foreground">
                  Drive Belt Spec
                </p>
                <p className="text-xs font-bold text-foreground">{consumables.beltSize}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </TabsContent>
  );
}

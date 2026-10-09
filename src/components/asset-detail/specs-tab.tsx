import { Button } from "@/components/ui/button";
import { TabsContent } from "@/components/ui/tabs";
import { EditAssetPartsDialog } from "@/components/edit-asset-parts-dialog";
import { RelabelAssetDialog } from "@/components/relabel-asset-dialog";
import { CreatePmScheduleDialog } from "@/components/create-pm-schedule-dialog";
import { SendPartsDialog } from "@/components/send-parts-dialog";
import {
  AlertTriangle,
  Calendar,
  CalendarPlus,
  Clock,
  Disc,
  Droplet,
  Filter,
  Layers,
  Pencil,
  Send,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import type { AssetCtx } from "./use-asset-detail";

export function SpecsTab({ ctx }: { ctx: AssetCtx }) {
  const { a, consumables, manuals, nextUpcomingPm, overduePmsCount, parts, pmList, setTab, specs } =
    ctx;
  return (
    <TabsContent value="specs" className="mt-4 space-y-4">
      {/* Active PM Program Overview Banner */}
      <div className="panel p-4 border-l-4 border-l-primary flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Calendar className="size-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">
              Preventive Maintenance (PM) Program
            </h3>
            <p className="text-xs text-muted-foreground">
              {pmList.length === 0 ? (
                "No routine PM schedules attached to this asset."
              ) : (
                <>
                  <span className="font-semibold text-foreground">
                    {pmList.length} PM Schedule{pmList.length > 1 ? "s" : ""}
                  </span>
                  {" · "}
                  {overduePmsCount > 0 ? (
                    <span className="text-destructive font-semibold">
                      {overduePmsCount} Overdue
                    </span>
                  ) : (
                    <span>
                      Next due: {nextUpcomingPm?.next_due} ({nextUpcomingPm?.title})
                    </span>
                  )}
                </>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <CreatePmScheduleDialog
            assetId={a.id}
            assetName={a.name}
            lockAsset
            trigger={
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs font-semibold text-primary border-primary/40"
              >
                <CalendarPlus className="size-3.5" /> Add PM
              </Button>
            }
          />
          <Button size="sm" variant="ghost" className="text-xs" onClick={() => setTab("pms")}>
            View all PMs ({pmList.length}) →
          </Button>
        </div>
      </div>

      <div className="panel p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-border">
          <div>
            <p className="label-caps">Equipment Specifications</p>
            <p className="text-xs text-muted-foreground">
              Master nameplate, electrical ratings, and operational parameters for {a.name}.
            </p>
          </div>
          <RelabelAssetDialog
            assetId={a.id}
            initialAsset={a}
            defaultTab="specs"
            trigger={
              <Button
                size="sm"
                variant="outline"
                className="gap-1 text-xs font-semibold text-primary border-primary/40 hover:bg-primary/10"
              >
                <Pencil className="size-3" /> Relabel / Edit Specs
              </Button>
            }
          />
        </div>
        <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          {specs.map(([label, value]) => (
            <div key={label}>
              <dt className="label-caps">{label}</dt>
              <dd className="font-mono text-sm">{value || "—"}</dd>
            </div>
          ))}
        </dl>

        {(manuals.data ?? []).length > 0 && (
          <div className="mt-5 border-t border-border pt-4">
            <p className="label-caps">Manuals</p>
            <ul className="mt-2 space-y-1 text-sm">
              {(manuals.data ?? []).map((m) => (
                <li key={m.id}>
                  <a
                    href={m.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline"
                  >
                    {m.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
        {a.notes && (
          <div className="mt-5 border-t border-border pt-4">
            <p className="label-caps">Notes</p>
            <p className="mt-1 text-sm text-muted-foreground">{a.notes}</p>
          </div>
        )}
      </div>

      {/* OEM Consumables, Lubrication & Belt Sizing Specs */}
      <div className="panel p-5 border-l-4 border-l-primary space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Droplet className="size-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">
                Manufacturer Lube, Grease, Belt &amp; Seal Specifications
              </h3>
              <p className="text-xs text-muted-foreground">
                OEM-recommended fluids, belt sizing, mechanical seals, and filter elements for{" "}
                {a.name}.
              </p>
            </div>
          </div>
          <SendPartsDialog
            asset={{ id: a.id, name: a.name, manufacturer: a.manufacturer }}
            lockAsset
            initialPart={{
              name: `Oil & Grease Consumables Pack for ${a.name}`,
              part_number: consumables.oilGrade.split(" ")[0] || "LUBE-SPEC",
              manufacturer: a.manufacturer,
              qty: 1,
            }}
            trigger={
              <Button size="sm" variant="outline" className="gap-1.5 font-semibold text-xs">
                <Send className="size-3.5 text-primary" /> Requisition Lube / Belts
              </Button>
            }
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 pt-2">
          <div className="rounded-lg border border-border bg-card/60 p-3.5 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400">
              <Droplet className="size-4" /> Suggested Oil &amp; Viscosity
            </div>
            <p className="text-sm font-semibold text-foreground">{consumables.oilGrade}</p>
            {consumables.oilCapacity && (
              <p className="text-xs text-muted-foreground">
                Sump Capacity:{" "}
                <span className="font-mono font-medium text-foreground">
                  {consumables.oilCapacity}
                </span>
              </p>
            )}
          </div>

          <div className="rounded-lg border border-border bg-card/60 p-3.5 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-sky-600 dark:text-sky-400">
              <Disc className="size-4" /> Recommended Grease Type
            </div>
            <p className="text-sm font-semibold text-foreground">{consumables.greaseType}</p>
            <p className="text-xs text-muted-foreground">
              Grease Bearing Schedule:{" "}
              <span className="font-medium text-foreground">Clean relief plug first</span>
            </p>
          </div>

          <div className="rounded-lg border border-border bg-card/60 p-3.5 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400">
              <Layers className="size-4" /> Drive Belt / Coupling Sizing
            </div>
            <p className="text-sm font-semibold text-foreground">{consumables.beltSize}</p>
            <p className="text-xs text-muted-foreground">
              Always replace drive belts in matched sets.
            </p>
          </div>

          <div className="rounded-lg border border-border bg-card/60 p-3.5 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="size-4" /> Mechanical Seal / Packing
            </div>
            <p className="text-sm font-semibold text-foreground">{consumables.sealType}</p>
            <p className="text-xs text-muted-foreground">
              Check barrier fluid flush lines and seal drops/min.
            </p>
          </div>

          {consumables.filterSpec && (
            <div className="rounded-lg border border-border bg-card/60 p-3.5 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-violet-600 dark:text-violet-400">
                <Filter className="size-4" /> Filter / Strainer Spec
              </div>
              <p className="text-sm font-semibold text-foreground">{consumables.filterSpec}</p>
              <p className="text-xs text-muted-foreground">
                Replace cartridge elements during routine PM interval.
              </p>
            </div>
          )}

          <div className="rounded-lg border border-border bg-card/60 p-3.5 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-rose-600 dark:text-rose-400">
              <Clock className="size-4" /> Lubrication Interval
            </div>
            <p className="text-xs font-medium text-foreground">{consumables.lubeInterval}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground border border-border/70">
          <div className="flex items-start gap-2.5 min-w-0 flex-1">
            <Wrench className="size-4 text-primary shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-foreground">
                Operator &amp; Mechanic Inspection Note:{" "}
              </span>
              {consumables.inspectionNotes}
            </div>
          </div>
          <EditAssetPartsDialog
            assetId={a.id}
            assetName={a.name}
            manufacturer={a.manufacturer}
            model={a.model}
            currentParts={parts}
            defaultTab="feedback"
            trigger={
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1 text-xs text-amber-600 hover:bg-amber-500/10 dark:text-amber-400 shrink-0"
              >
                <AlertTriangle className="size-3.5" />
                Not the right parts/specs?
              </Button>
            }
          />
        </div>
      </div>
    </TabsContent>
  );
}

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TabsContent } from "@/components/ui/tabs";
import { WorkOrderDialog } from "@/components/work-order-dialog";
import { DeleteRequestDialog } from "@/components/delete-request-dialog";
import { CreatePmScheduleDialog } from "@/components/create-pm-schedule-dialog";
import { EditPmScheduleDialog } from "@/components/edit-pm-schedule-dialog";
import { MatchPmAssetDialog } from "@/components/match-pm-asset-dialog";
import { memberLabel } from "@/lib/notify";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { dueTone, frequencyToDays, prettyLabel, seasonLabel } from "@/lib/cmms";
import {
  Calendar,
  CalendarPlus,
  CheckCircle2,
  Pencil,
  Plus,
  Search,
  Sparkles,
  User,
} from "lucide-react";
import type { AssetCtx } from "./use-asset-detail";

export function PmsTab({ ctx }: { ctx: AssetCtx }) {
  const {
    a,
    addPms,
    assignPm,
    completePm,
    dueSoonPmsCount,
    intervals,
    lookup,
    nextUpcomingPm,
    openGoogleManualSearch,
    overduePmsCount,
    pmList,
    setTab,
    team,
  } = ctx;
  return (
    <TabsContent value="pms" className="mt-4 space-y-5">
      {/* PM Management Header & Metrics */}
      <div className="panel p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="label-caps">Preventive Maintenance Schedules</p>
            <p className="text-xs text-muted-foreground">
              Recurring inspection, lubrication, and overhaul routines for {a.name}.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 font-semibold text-xs border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
              onClick={openGoogleManualSearch}
              title="Open a Google search for this equipment's manual"
            >
              <Search className="size-3.5 text-amber-500" />
              Scan for manual
            </Button>

            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 font-semibold text-xs border-primary/40 text-primary hover:bg-primary/10"
              onClick={() => {
                setTab("specs");
                lookup.mutate();
              }}
              disabled={lookup.isPending}
              title="Generate PM schedules automatically with AI from equipment make and model"
            >
              <Sparkles className="size-3.5 text-primary" />
              {lookup.isPending ? "Generating PMs…" : "AI Generate PMs"}
            </Button>
            <MatchPmAssetDialog
              targetAsset={a}
              trigger={
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 font-semibold text-xs border-primary/40 text-primary hover:bg-primary/10"
                >
                  <Sparkles className="size-3.5" /> Match &amp; Link PM
                </Button>
              }
            />
            <CreatePmScheduleDialog
              assetId={a.id}
              assetName={a.name}
              lockAsset
              trigger={
                <Button size="sm" className="gap-1.5 font-semibold">
                  <CalendarPlus className="size-4" /> Schedule New PM
                </Button>
              }
            />
          </div>
        </div>

        {/* Quick Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-border">
          <div className="rounded-lg bg-card border border-border p-3">
            <p className="text-xs text-muted-foreground font-medium">Total PMs</p>
            <p className="text-xl font-bold font-mono text-foreground mt-0.5">{pmList.length}</p>
          </div>
          <div className="rounded-lg bg-card border border-border p-3">
            <p className="text-xs text-muted-foreground font-medium">Overdue</p>
            <p
              className={`text-xl font-bold font-mono mt-0.5 ${overduePmsCount > 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"}`}
            >
              {overduePmsCount}
            </p>
          </div>
          <div className="rounded-lg bg-card border border-border p-3">
            <p className="text-xs text-muted-foreground font-medium">Due in ≤7 Days</p>
            <p className="text-xl font-bold font-mono text-foreground mt-0.5">{dueSoonPmsCount}</p>
          </div>
          <div className="rounded-lg bg-card border border-border p-3">
            <p className="text-xs text-muted-foreground font-medium">Next Due Date</p>
            <p className="text-sm font-semibold font-mono text-primary mt-1 truncate">
              {nextUpcomingPm?.next_due || "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Active PM Schedules List */}
      <div className="panel divide-y divide-border">
        {pmList.map((pm) => {
          const tone = dueTone(pm.next_due);
          return (
            <div key={pm.id} className="p-4 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-base font-bold text-foreground">{pm.title}</h4>
                    <Badge
                      variant={
                        pm.priority === "critical" || pm.priority === "high"
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {prettyLabel(pm.priority)} priority
                    </Badge>
                    {seasonLabel(pm.season_start_md, pm.season_end_md) && (
                      <Badge variant="outline" className="border-primary/40 text-primary text-xs">
                        Seasonal · {seasonLabel(pm.season_start_md, pm.season_end_md)}
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-1">
                    <span className="font-medium text-foreground">
                      Every {pm.interval_days} days
                    </span>
                    <span>·</span>
                    <span>
                      Next due: <strong className="font-mono text-foreground">{pm.next_due}</strong>
                    </span>
                    {pm.estimated_hours != null && (
                      <>
                        <span>·</span>
                        <span>{pm.estimated_hours} hrs est.</span>
                      </>
                    )}
                    {pm.last_completed && (
                      <>
                        <span>·</span>
                        <span>Last completed on {pm.last_completed}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Badge
                    variant={
                      tone === "overdue" ? "destructive" : tone === "due" ? "secondary" : "outline"
                    }
                    className="font-mono text-xs px-2.5 py-1"
                  >
                    {tone === "overdue" ? "OVERDUE · " : tone === "due" ? "DUE SOON · " : "DUE · "}
                    {pm.next_due}
                  </Badge>
                </div>
              </div>

              {pm.tasks && (
                <div className="rounded-md bg-muted/40 border border-border/70 p-2.5 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground block mb-0.5">
                    Instructions &amp; Checklist:
                  </span>
                  <p className="whitespace-pre-wrap">{pm.tasks}</p>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                    <User className="size-3.5" /> Assigned Tech:
                  </span>
                  <Select
                    value={pm.assigned_to ?? "unassigned"}
                    onValueChange={(v) =>
                      assignPm.mutate({
                        id: pm.id,
                        title: pm.title,
                        next_due: pm.next_due,
                        userId: v === "unassigned" ? null : v,
                      })
                    }
                    disabled={assignPm.isPending}
                  >
                    <SelectTrigger className="h-8 w-48 text-xs">
                      <SelectValue placeholder="Assign technician…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned (Open Pool)</SelectItem>
                      {(team.data ?? []).map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {memberLabel(m)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <WorkOrderDialog
                    assetId={a.id}
                    pmScheduleId={pm.id}
                    defaultTitle={pm.title}
                    lockAsset
                    trigger={
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1.5 text-xs font-semibold"
                      >
                        <Plus className="size-3.5 text-primary" /> Issue WO
                      </Button>
                    }
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-8 gap-1.5 text-xs font-semibold"
                    disabled={completePm.isPending}
                    onClick={() =>
                      completePm.mutate({
                        id: pm.id,
                        interval_days: pm.interval_days,
                        season_start_md: pm.season_start_md,
                        season_end_md: pm.season_end_md,
                      })
                    }
                  >
                    <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                    Complete &amp; Advance
                  </Button>
                  <EditPmScheduleDialog
                    pm={pm}
                    trigger={
                      <Button size="sm" variant="ghost" className="h-8 px-2 text-xs">
                        <Pencil className="size-3.5 mr-1" /> Edit
                      </Button>
                    }
                  />
                  <DeleteRequestDialog
                    entityType="pm_schedule"
                    entityId={pm.id}
                    entityLabel={pm.title}
                  />
                </div>
              </div>
            </div>
          );
        })}

        {pmList.length === 0 && (
          <div className="p-8 text-center space-y-3">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Calendar className="size-6" />
            </div>
            <div>
              <h4 className="text-base font-bold text-foreground">
                No PM schedules for this asset
              </h4>
              <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1">
                Set up recurring preventive maintenance routines to prevent unexpected plant
                downtime and extend equipment life.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <MatchPmAssetDialog
                targetAsset={a}
                trigger={
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 font-semibold text-xs border-primary/40 text-primary hover:bg-primary/10"
                  >
                    <Sparkles className="size-3.5" /> Match Existing PM Routine
                  </Button>
                }
              />
              <CreatePmScheduleDialog
                assetId={a.id}
                assetName={a.name}
                lockAsset
                trigger={
                  <Button size="sm" className="gap-1.5 font-semibold">
                    <CalendarPlus className="size-4" /> Schedule First PM
                  </Button>
                }
              />
            </div>
          </div>
        )}
      </div>

      {/* OEM Recommended Intervals section on the PM tab */}
      {intervals.length > 0 && (
        <div className="panel p-4 space-y-3 border-l-4 border-l-primary/60">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="label-caps">Recommended Manufacturer Intervals</p>
              <p className="text-xs text-muted-foreground">
                O&amp;M manual suggestions ready to be imported directly into active PM schedules.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={addPms.isPending}
              onClick={() => addPms.mutate(intervals)}
              className="gap-1.5 font-semibold text-primary border-primary/40 hover:bg-primary/10"
            >
              <CalendarPlus className="size-4" />
              Add all to PM schedule
            </Button>
          </div>
          <ul className="mt-2 divide-y divide-border">
            {intervals.map((i, idx) => (
              <li key={idx} className="py-2.5 flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{i.task}</span>
                    <span className="font-mono text-xs text-primary bg-primary/10 px-2 py-0.5 rounded">
                      {i.frequency} (Every {frequencyToDays(i.frequency)} days)
                    </span>
                  </div>
                  {i.notes && <p className="mt-0.5 text-xs text-muted-foreground">{i.notes}</p>}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={addPms.isPending}
                  onClick={() => addPms.mutate([i])}
                  className="text-xs font-medium text-primary hover:bg-primary/10"
                >
                  <CalendarPlus className="size-3.5 mr-1" />
                  Add to schedule
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </TabsContent>
  );
}

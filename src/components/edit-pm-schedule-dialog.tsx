import { useState, useEffect, useId } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useTeamMembers } from "@/hooks/use-team-members";
import { memberLabel } from "@/lib/notify";
import { PRIORITIES, prettyLabel } from "@/lib/cmms";
import { RelabelAssetDialog } from "@/components/relabel-asset-dialog";
import { toast } from "sonner";
import { Calendar, CheckCircle2, Clock, Pencil, RefreshCw, Tag, User, Wrench } from "lucide-react";

export interface EditPmScheduleDialogProps {
  pm: {
    id: string;
    title: string;
    interval_days: number;
    priority: string;
    next_due: string;
    asset_id: string | null;
    assigned_to: string | null;
    estimated_hours?: number | null;
    season_start_md?: string | null;
    season_end_md?: string | null;
    tasks?: string | null;
    assets?: {
      id: string;
      name: string;
      tag_number?: string | null;
      location_name?: string | null;
      building?: string | null;
    } | null;
  };
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function EditPmScheduleDialog({
  pm,
  trigger,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
}: EditPmScheduleDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;
  const setIsOpen = (val: boolean) => {
    if (isControlled) {
      setControlledOpen?.(val);
    } else {
      setInternalOpen(val);
    }
  };

  const idPrefix = useId();
  const queryClient = useQueryClient();
  const team = useTeamMembers();

  // PM Form fields
  const [title, setTitle] = useState(pm.title);
  const [intervalDays, setIntervalDays] = useState(String(pm.interval_days || 90));
  const [priority, setPriority] = useState(pm.priority || "medium");
  const [nextDue, setNextDue] = useState(pm.next_due || "");
  const [assignedTo, setAssignedTo] = useState(pm.assigned_to || "unassigned");
  const [estimatedHours, setEstimatedHours] = useState(
    pm.estimated_hours != null ? String(pm.estimated_hours) : "",
  );
  const [tasks, setTasks] = useState(pm.tasks || "");
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(pm.asset_id || null);

  // Asset search & selection
  const [assetSearch, setAssetSearch] = useState("");
  const assetOptions = useQuery({
    queryKey: ["asset-options-pm-edit", assetSearch],
    enabled: isOpen,
    queryFn: async () => {
      let query = supabase
        .from("assets")
        .select("id, name, tag_number, location_name, building")
        .order("name")
        .limit(20);
      if (assetSearch.trim()) {
        query = query.ilike("name", `%${assetSearch.trim()}%`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  // Current linked asset details
  const linkedAsset = useQuery({
    queryKey: ["asset", selectedAssetId],
    enabled: isOpen && !!selectedAssetId,
    queryFn: async () => {
      if (!selectedAssetId) return null;
      const { data, error } = await supabase
        .from("assets")
        .select("id, name, tag_number, class, building, location_name, manufacturer, model")
        .eq("id", selectedAssetId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    initialData: pm.assets && pm.assets.id === selectedAssetId ? pm.assets : undefined,
  });

  useEffect(() => {
    if (isOpen) {
      setTitle(pm.title);
      setIntervalDays(String(pm.interval_days || 90));
      setPriority(pm.priority || "medium");
      setNextDue(pm.next_due || "");
      setAssignedTo(pm.assigned_to || "unassigned");
      setEstimatedHours(pm.estimated_hours != null ? String(pm.estimated_hours) : "");
      setTasks(pm.tasks || "");
      setSelectedAssetId(pm.asset_id || null);
    }
  }, [isOpen, pm]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const days = parseInt(intervalDays, 10);
      if (isNaN(days) || days < 1) {
        throw new Error("Interval days must be at least 1.");
      }
      if (!title.trim()) {
        throw new Error("PM schedule title is required.");
      }

      const { error } = await supabase
        .from("pm_schedules")
        .update({
          title: title.trim(),
          interval_days: days,
          priority,
          next_due: nextDue || pm.next_due,
          assigned_to: assignedTo === "unassigned" ? null : assignedTo,
          estimated_hours: estimatedHours.trim() ? parseFloat(estimatedHours) : null,
          tasks: tasks.trim() || null,
          asset_id: selectedAssetId || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", pm.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pms"] });
      queryClient.invalidateQueries({ queryKey: ["pm-schedules"] });
      queryClient.invalidateQueries({ queryKey: ["asset-pms"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("PM schedule updated and synchronized across the program.");
      setIsOpen(false);
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to update PM schedule.");
    },
  });

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {trigger ? (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : (
        <DialogTrigger asChild>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs">
            <Pencil className="size-3.5 mr-1" /> Edit PM
          </Button>
        </DialogTrigger>
      )}

      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Wrench className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">
                Edit Preventive Maintenance (PM)
              </DialogTitle>
              <DialogDescription className="text-xs">
                Update PM parameters, tasks, or relabel/reassign the associated plant asset.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* PM Title */}
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-title`} className="text-xs font-semibold">
              PM Task Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id={`${idPrefix}-title`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Monthly Oil &amp; Filter Inspection"
              className="font-medium"
            />
          </div>

          {/* Linked Asset & Relabel Action Card */}
          <div className="rounded-lg border border-border p-3.5 bg-muted/20 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                <Tag className="size-3.5 text-primary" /> Attached Plant Asset
              </span>
              {selectedAssetId && (
                <RelabelAssetDialog
                  assetId={selectedAssetId}
                  initialAsset={linkedAsset.data || pm.assets || undefined}
                  trigger={
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1 text-xs font-medium border-primary/40 text-primary hover:bg-primary/10"
                    >
                      <Pencil className="size-3" /> Relabel Asset
                    </Button>
                  }
                />
              )}
            </div>

            {linkedAsset.data || pm.assets ? (
              <div className="rounded-md border border-border/70 bg-card p-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-foreground">
                      {linkedAsset.data?.name || pm.assets?.name}
                    </span>
                    {(linkedAsset.data?.tag_number || pm.assets?.tag_number) && (
                      <span className="font-mono text-xs text-primary font-medium">
                        [{linkedAsset.data?.tag_number || pm.assets?.tag_number}]
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {linkedAsset.data?.building || pm.assets?.building || "Plant Equipment"}
                    {(linkedAsset.data?.location_name || pm.assets?.location_name) &&
                      ` · ${linkedAsset.data?.location_name || pm.assets?.location_name}`}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-muted-foreground hover:text-destructive"
                  onClick={() => setSelectedAssetId(null)}
                >
                  Change
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                  No asset currently linked. Select an asset from the register:
                </p>
                <Input
                  placeholder="Type to filter plant assets..."
                  value={assetSearch}
                  onChange={(e) => setAssetSearch(e.target.value)}
                  className="h-8 text-xs"
                />
                <div className="max-h-32 overflow-y-auto rounded-md border border-border divide-y divide-border text-xs bg-card">
                  {(assetOptions.data ?? []).map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setSelectedAssetId(a.id)}
                      className="w-full text-left p-2 hover:bg-accent transition-colors flex items-center justify-between"
                    >
                      <span className="font-medium">{a.name}</span>
                      {a.tag_number && (
                        <span className="font-mono text-muted-foreground text-[11px]">
                          {a.tag_number}
                        </span>
                      )}
                    </button>
                  ))}
                  {(assetOptions.data ?? []).length === 0 && (
                    <p className="p-2 text-center text-muted-foreground">No assets found</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Schedule Parameters Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor={`${idPrefix}-interval`} className="text-xs font-semibold">
                Frequency (Days)
              </Label>
              <Input
                id={`${idPrefix}-interval`}
                type="number"
                min="1"
                value={intervalDays}
                onChange={(e) => setIntervalDays(e.target.value)}
                className="font-mono text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`${idPrefix}-priority`} className="text-xs font-semibold">
                Priority
              </Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger id={`${idPrefix}-priority`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {prettyLabel(p)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`${idPrefix}-next-due`} className="text-xs font-semibold">
                Next Due Date
              </Label>
              <Input
                id={`${idPrefix}-next-due`}
                type="date"
                value={nextDue}
                onChange={(e) => setNextDue(e.target.value)}
                className="text-xs font-mono"
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor={`${idPrefix}-assigned`} className="text-xs font-semibold">
                Assigned Technician
              </Label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger id={`${idPrefix}-assigned`}>
                  <SelectValue placeholder="Assign technician..." />
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
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`${idPrefix}-hours`} className="text-xs font-semibold">
                Est. Hours
              </Label>
              <Input
                id={`${idPrefix}-hours`}
                type="number"
                step="0.25"
                placeholder="e.g. 1.5"
                value={estimatedHours}
                onChange={(e) => setEstimatedHours(e.target.value)}
              />
            </div>
          </div>

          {/* Procedure / Task Notes */}
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-tasks`} className="text-xs font-semibold">
              Procedure Checklist &amp; Tasks
            </Label>
            <Textarea
              id={`${idPrefix}-tasks`}
              value={tasks}
              onChange={(e) => setTasks(e.target.value)}
              placeholder="1. Lockout/tagout equipment&#10;2. Check oil level and clarity&#10;3. Inspect belt deflection..."
              rows={3}
              className="text-xs font-mono"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border">
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsOpen(false)}
            disabled={saveMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !title.trim()}
            className="gap-1.5"
          >
            {saveMutation.isPending ? (
              <>
                <RefreshCw className="size-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <CheckCircle2 className="size-4" />
                Save PM Schedule
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

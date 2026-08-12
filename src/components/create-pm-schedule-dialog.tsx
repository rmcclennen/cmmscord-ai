import { useState, useId, useEffect } from "react";
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
import { memberLabel, notifyUser } from "@/lib/notify";
import { PRIORITIES, prettyLabel } from "@/lib/cmms";
import { toast } from "sonner";
import { Calendar, CalendarPlus, Clock, Plus, Search, Tag, User, Wrench } from "lucide-react";

export interface CreatePmScheduleDialogProps {
  assetId?: string | null;
  assetName?: string | null;
  initialTitle?: string;
  initialIntervalDays?: number;
  initialPriority?: string;
  initialTasks?: string;
  lockAsset?: boolean;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onCreated?: (createdId: string) => void;
}

const INTERVAL_PRESETS = [
  { label: "Weekly (7d)", days: 7 },
  { label: "Bi-Weekly (14d)", days: 14 },
  { label: "Monthly (30d)", days: 30 },
  { label: "Quarterly (90d)", days: 90 },
  { label: "Semi-Annual (180d)", days: 180 },
  { label: "Annual (365d)", days: 365 },
];

export function CreatePmScheduleDialog({
  assetId: initialAssetId,
  assetName: initialAssetName,
  initialTitle = "",
  initialIntervalDays = 30,
  initialPriority = "medium",
  initialTasks = "",
  lockAsset = false,
  trigger,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
  onCreated,
}: CreatePmScheduleDialogProps) {
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

  const [title, setTitle] = useState(initialTitle);
  const [intervalDays, setIntervalDays] = useState(String(initialIntervalDays));
  const [priority, setPriority] = useState(initialPriority);
  const [nextDue, setNextDue] = useState("");
  const [assignedTo, setAssignedTo] = useState("unassigned");
  const [estimatedHours, setEstimatedHours] = useState("");
  const [tasks, setTasks] = useState(initialTasks);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(initialAssetId || null);
  const [assetSearch, setAssetSearch] = useState("");

  // Calculate default next due date whenever intervalDays changes and user hasn't typed a custom one
  useEffect(() => {
    if (isOpen) {
      setTitle(initialTitle);
      setIntervalDays(String(initialIntervalDays));
      setPriority(initialPriority);
      setTasks(initialTasks);
      setSelectedAssetId(initialAssetId || null);

      const days = Number(initialIntervalDays) || 30;
      const targetDate = new Date(Date.now() + days * 86400000);
      setNextDue(targetDate.toISOString().slice(0, 10));
    }
  }, [isOpen, initialTitle, initialIntervalDays, initialPriority, initialTasks, initialAssetId]);

  const handleIntervalChange = (daysStr: string) => {
    setIntervalDays(daysStr);
    const num = parseInt(daysStr, 10);
    if (!isNaN(num) && num > 0) {
      const targetDate = new Date(Date.now() + num * 86400000);
      setNextDue(targetDate.toISOString().slice(0, 10));
    }
  };

  // Asset search & selection for unlinked or non-locked mode
  const assetOptions = useQuery({
    queryKey: ["asset-options-pm-create", assetSearch],
    enabled: isOpen && !lockAsset,
    queryFn: async () => {
      let query = supabase
        .from("assets")
        .select("id, name, tag_number, location_name, building, class")
        .order("name")
        .limit(30);
      if (assetSearch.trim()) {
        query = query.ilike("name", `%${assetSearch.trim()}%`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  // Linked asset details
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
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const days = parseInt(intervalDays, 10);
      if (isNaN(days) || days < 1) {
        throw new Error("Interval days must be at least 1.");
      }
      if (!title.trim()) {
        throw new Error("PM schedule title is required.");
      }

      const assignedUserId = assignedTo === "unassigned" ? null : assignedTo;
      const targetDue =
        nextDue || new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

      const { data, error } = await supabase
        .from("pm_schedules")
        .insert({
          title: title.trim(),
          asset_id: selectedAssetId || null,
          interval_days: days,
          priority,
          next_due: targetDue,
          assigned_to: assignedUserId,
          estimated_hours: estimatedHours.trim() ? parseFloat(estimatedHours) : null,
          tasks: tasks.trim() || null,
          active: true,
        })
        .select()
        .single();

      if (error) throw error;

      if (assignedUserId && data) {
        notifyUser({
          userId: assignedUserId,
          title: "New PM schedule assigned to you",
          body: `${title.trim()} · Next due ${targetDue}`,
          link: "/pm-schedule",
        }).catch(() => {});
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["pms"] });
      queryClient.invalidateQueries({ queryKey: ["pm-schedules"] });
      queryClient.invalidateQueries({ queryKey: ["asset-pms"] });
      queryClient.invalidateQueries({ queryKey: ["assets-all"] });
      queryClient.invalidateQueries({ queryKey: ["assets-pms-summary"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });

      toast.success(`PM schedule "${title.trim()}" created successfully`);
      if (data?.id) onCreated?.(data.id);
      setIsOpen(false);
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to create PM schedule.");
    },
  });

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {trigger ? (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : (
        <DialogTrigger asChild>
          <Button size="sm" className="gap-1.5 font-semibold">
            <CalendarPlus className="size-4" /> Add PM Schedule
          </Button>
        </DialogTrigger>
      )}

      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <CalendarPlus className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">
                Schedule Preventive Maintenance (PM)
              </DialogTitle>
              <DialogDescription className="text-xs">
                Configure routine PM intervals, task checklists, and technician assignments.
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
              placeholder="e.g. Monthly Lubrication & Belt Tension Check"
              className="font-medium"
            />
          </div>

          {/* Attached Plant Asset */}
          <div className="rounded-lg border border-border p-3.5 bg-muted/20 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                <Tag className="size-3.5 text-primary" /> Target Plant Asset
              </span>
              {selectedAssetId && !lockAsset && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setSelectedAssetId(null)}
                >
                  Change asset
                </Button>
              )}
            </div>

            {selectedAssetId && (linkedAsset.data || initialAssetName) ? (
              <div className="rounded-md border border-border/70 bg-card p-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {linkedAsset.data?.name || initialAssetName}
                  </p>
                  <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-1.5 mt-0.5">
                    {linkedAsset.data?.tag_number && (
                      <span className="font-mono text-[11px] text-primary">
                        Tag: {linkedAsset.data.tag_number}
                      </span>
                    )}
                    {linkedAsset.data?.building && <span>· {linkedAsset.data.building}</span>}
                    {linkedAsset.data?.location_name && (
                      <span>· {linkedAsset.data.location_name}</span>
                    )}
                  </p>
                </div>
                <Badge variant="outline" className="text-[11px] shrink-0 font-medium">
                  {linkedAsset.data?.class || "Equipment"}
                </Badge>
              </div>
            ) : lockAsset ? (
              <p className="text-xs text-muted-foreground italic">
                {initialAssetName || "Attached to current asset"}
              </p>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search plant asset name or tag…"
                    value={assetSearch}
                    onChange={(e) => setAssetSearch(e.target.value)}
                    className="h-8 pl-8 text-xs bg-background"
                  />
                </div>
                <div className="max-h-36 overflow-y-auto rounded-md border border-border bg-card divide-y divide-border/60">
                  {(assetOptions.data ?? []).map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => {
                        setSelectedAssetId(a.id);
                        setAssetSearch("");
                      }}
                      className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-primary/10 flex items-center justify-between transition-colors"
                    >
                      <span className="font-medium text-foreground truncate">{a.name}</span>
                      {a.tag_number && (
                        <span className="font-mono text-[11px] text-muted-foreground ml-2">
                          {a.tag_number}
                        </span>
                      )}
                    </button>
                  ))}
                  {(assetOptions.data ?? []).length === 0 && (
                    <p className="p-2 text-center text-xs text-muted-foreground">
                      {assetSearch ? "No assets match search" : "Type to find asset"}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Interval & Presets */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor={`${idPrefix}-interval`} className="text-xs font-semibold">
                Frequency (Days) <span className="text-destructive">*</span>
              </Label>
              <div className="flex flex-wrap items-center gap-1">
                {INTERVAL_PRESETS.map((p) => (
                  <Button
                    key={p.days}
                    type="button"
                    size="sm"
                    variant={intervalDays === String(p.days) ? "default" : "outline"}
                    className="h-6 px-1.5 text-[10px] font-medium"
                    onClick={() => handleIntervalChange(String(p.days))}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Input
                  id={`${idPrefix}-interval`}
                  type="number"
                  min="1"
                  value={intervalDays}
                  onChange={(e) => handleIntervalChange(e.target.value)}
                  placeholder="e.g. 30"
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-1">
                <Input
                  type="date"
                  value={nextDue}
                  onChange={(e) => setNextDue(e.target.value)}
                  className="font-mono text-sm"
                />
                <span className="text-[10px] text-muted-foreground block">First Due Date</span>
              </div>
            </div>
          </div>

          {/* Priority & Assigned Tech */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Priority Level</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {prettyLabel(p)} Priority
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Assign Technician</Label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Select technician…" />
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
          </div>

          {/* Estimated Hours */}
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-hours`} className="text-xs font-semibold">
              Estimated Duration (Hours)
            </Label>
            <Input
              id={`${idPrefix}-hours`}
              type="number"
              step="0.25"
              min="0.1"
              value={estimatedHours}
              onChange={(e) => setEstimatedHours(e.target.value)}
              placeholder="e.g. 1.5"
              className="font-mono text-sm max-w-xs"
            />
          </div>

          {/* Tasks & Instructions */}
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-tasks`} className="text-xs font-semibold">
              Maintenance Checklist &amp; Instructions
            </Label>
            <Textarea
              id={`${idPrefix}-tasks`}
              value={tasks}
              onChange={(e) => setTasks(e.target.value)}
              rows={3}
              placeholder="List specific steps: 1. Lock out/tag out 2. Check oil sight glass 3. Grease motor bearings with 2 pumps Polyrex EM..."
              className="text-xs"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 pt-2 sm:pt-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsOpen(false)}
            disabled={createMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending || !title.trim()}
            className="gap-1.5 font-semibold"
          >
            <CalendarPlus className="size-4" />
            {createMutation.isPending ? "Scheduling PM…" : "Create PM Schedule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

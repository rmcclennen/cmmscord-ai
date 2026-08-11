import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { PRIORITIES, WO_TYPES, prettyLabel } from "@/lib/cmms";
import { useTeamMembers } from "@/hooks/use-team-members";
import { memberLabel, notifyUser } from "@/lib/notify";
import { toast } from "sonner";
import type { ReactNode } from "react";

type Props = {
  trigger: ReactNode;
  assetId?: string | null;
  pmScheduleId?: string | null;
  defaultTitle?: string;
  lockAsset?: boolean;
};

export function WorkOrderDialog({
  trigger,
  assetId,
  pmScheduleId,
  defaultTitle,
  lockAsset,
}: Props) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(defaultTitle ?? "");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [woType, setWoType] = useState(pmScheduleId ? "preventive" : "corrective");
  const [dueDate, setDueDate] = useState("");
  const [asset, setAsset] = useState<string | null>(assetId ?? null);
  const [assetSearch, setAssetSearch] = useState("");
  const [assignee, setAssignee] = useState("unassigned");
  const queryClient = useQueryClient();
  const team = useTeamMembers(open);

  const assetOptions = useQuery({
    queryKey: ["asset-options", assetSearch],
    enabled: open && !lockAsset,
    queryFn: async () => {
      let query = supabase.from("assets").select("id, name, tag_number").order("name").limit(25);
      if (assetSearch.trim()) query = query.ilike("name", `%${assetSearch.trim()}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const assignedTo = assignee === "unassigned" ? null : assignee;
      const { data, error } = await supabase
        .from("work_orders")
        .insert({
          title: title.trim(),
          description: description.trim() || null,
          priority,
          wo_type: woType,
          due_date: dueDate || null,
          asset_id: asset,
          pm_schedule_id: pmScheduleId ?? null,
          created_by: userData.user?.id ?? null,
          assigned_to: assignedTo,
        })
        .select("wo_number")
        .single();
      if (error) throw error;
      if (assignedTo) {
        await notifyUser({
          userId: assignedTo,
          title: `WO-${data.wo_number} assigned to you`,
          body: `${title.trim()}${dueDate ? ` · due ${dueDate}` : ""} · ${prettyLabel(priority)} priority`,
          link: "/work-orders",
        });
      }
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Work order WO-${data.wo_number} created`);
      queryClient.invalidateQueries({ queryKey: ["work-orders"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      setOpen(false);
      setTitle(defaultTitle ?? "");
      setDescription("");
      setDueDate("");
      setAssignee("unassigned");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <span onClick={() => setOpen(true)}>{trigger}</span>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New work order</DialogTitle>
          <DialogDescription>
            Log corrective, preventive, or emergency work for the plant.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="wo-title">Title</Label>
            <Input
              id="wo-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Replace mechanical seal on RAS Pump 2"
            />
          </div>
          {!lockAsset && (
            <div className="space-y-1.5">
              <Label htmlFor="wo-asset">Asset</Label>
              <Input
                id="wo-asset"
                value={assetSearch}
                onChange={(e) => setAssetSearch(e.target.value)}
                placeholder="Search assets…"
              />
              <Select value={asset ?? ""} onValueChange={setAsset}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an asset (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {(assetOptions.data ?? []).map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={woType} onValueChange={setWoType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WO_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {prettyLabel(t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
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
              <Label htmlFor="wo-due">Due date</Label>
              <Input
                id="wo-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Send to / assign</Label>
            <Select value={assignee} onValueChange={setAssignee}>
              <SelectTrigger>
                <SelectValue placeholder="Nobody (unassigned)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Nobody (unassigned)</SelectItem>
                {(team.data ?? []).map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {memberLabel(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              The person you pick gets an in-app notification on their account email.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="wo-desc">Scope / notes</Label>
            <Textarea
              id="wo-desc"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Findings, parts needed, lockout requirements…"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button disabled={!title.trim() || create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? "Creating…" : "Create work order"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

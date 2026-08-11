import { useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSessionUser } from "@/hooks/use-session-user";
import { useMyRoles } from "@/hooks/use-my-roles";
import { ENTITY_LABELS, type DeletableEntity } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ShieldAlert, Trash2 } from "lucide-react";

const TABLES: Record<DeletableEntity, "assets" | "pm_schedules" | "work_orders"> = {
  asset: "assets",
  pm_schedule: "pm_schedules",
  work_order: "work_orders",
};

/**
 * Deletion is gated by role: managers/supervisors/admins delete immediately,
 * everyone else files a request that an approver has to sign off on.
 */
export function DeleteRequestDialog({
  entityType,
  entityId,
  entityLabel,
  trigger,
  onDeleted,
}: {
  entityType: DeletableEntity;
  entityId: string;
  entityLabel: string;
  trigger?: ReactNode;
  onDeleted?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const { user } = useSessionUser();
  const { isApprover } = useMyRoles();
  const queryClient = useQueryClient();

  const submit = useMutation({
    mutationFn: async () => {
      if (isApprover) {
        const { error } = await supabase.from(TABLES[entityType]).delete().eq("id", entityId);
        if (error) throw error;
        return "deleted" as const;
      }
      const { error } = await supabase.from("deletion_requests").insert({
        entity_type: entityType,
        entity_id: entityId,
        entity_label: entityLabel,
        reason: reason.trim() || null,
        requested_by: user?.id ?? null,
      });
      if (error) throw error;
      return "requested" as const;
    },
    onSuccess: (result) => {
      setOpen(false);
      setReason("");
      if (result === "deleted") {
        toast.success(`${ENTITY_LABELS[entityType]} deleted`);
      } else {
        toast.success("Deletion request sent for approval");
      }
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      queryClient.invalidateQueries({ queryKey: ["pm-schedules"] });
      queryClient.invalidateQueries({ queryKey: ["work-orders"] });
      queryClient.invalidateQueries({ queryKey: ["deletion-requests"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      onDeleted?.();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="icon" variant="ghost" aria-label={`Delete ${entityLabel}`}>
            <Trash2 className="size-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isApprover ? `Delete ${ENTITY_LABELS[entityType].toLowerCase()}` : "Request deletion"}
          </DialogTitle>
          <DialogDescription>
            {isApprover
              ? `“${entityLabel}” will be removed permanently.`
              : `Only a manager or supervisor can delete records. Your request for “${entityLabel}” goes to them for approval.`}
          </DialogDescription>
        </DialogHeader>

        {!isApprover && (
          <div className="space-y-2">
            <Label htmlFor="deletion-reason">Reason (optional)</Label>
            <Textarea
              id="deletion-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why should this be removed?"
              rows={3}
            />
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldAlert className="size-3.5" /> Managers and supervisors are notified
              immediately.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant={isApprover ? "destructive" : "default"}
            disabled={submit.isPending}
            onClick={() => submit.mutate()}
          >
            {isApprover ? "Delete now" : "Send request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

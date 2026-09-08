import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { DollarSign, Calculator, CheckCircle2 } from "lucide-react";

interface RepairCostDialogProps {
  assetId: string;
  assetName: string;
  partRequestId?: string | null | undefined;
  workOrderId?: string | null | undefined;
  currentQuotedCost?: number | null | undefined;
  currentAwardedCost?: number | null | undefined;
  currentLaborHours?: number | null | undefined;
  currentNotes?: string | null | undefined;
  trigger?: React.ReactNode | undefined;
  onSaved?: (() => void) | undefined;
}

export function RepairCostDialog({
  assetId,
  assetName,
  partRequestId,
  workOrderId,
  currentQuotedCost,
  currentAwardedCost,
  currentLaborHours,
  currentNotes,
  trigger,
  onSaved,
}: RepairCostDialogProps) {
  const [open, setOpen] = useState(false);
  const [quotedCost, setQuotedCost] = useState(
    currentQuotedCost != null ? String(currentQuotedCost) : "",
  );
  const [awardedCost, setAwardedCost] = useState(
    currentAwardedCost != null ? String(currentAwardedCost) : "",
  );
  const [laborHours, setLaborHours] = useState(
    currentLaborHours != null ? String(currentLaborHours) : "4",
  );
  const [laborRate, setLaborRate] = useState("85"); // default plant internal labor rate
  const [notes, setNotes] = useState(currentNotes ?? "");

  const queryClient = useQueryClient();

  const numQuoted = parseFloat(quotedCost) || 0;
  const numAwarded = parseFloat(awardedCost) || 0;
  const numHours = parseFloat(laborHours) || 0;
  const numRate = parseFloat(laborRate) || 0;
  const totalLaborCost = numHours * numRate;
  const totalPartsCost = numAwarded > 0 ? numAwarded : numQuoted;
  const totalEstimatedCost = totalPartsCost + totalLaborCost;

  const saveMutation = useMutation({
    mutationFn: async () => {
      // 1. If partRequestId exists, update costs in part_requests
      if (partRequestId) {
        const { error: partErr } = await supabase
          .from("part_requests")
          .update({
            quoted_cost: numQuoted > 0 ? numQuoted : null,
            awarded_cost: numAwarded > 0 ? numAwarded : null,
            decision_note: notes.trim() || null,
          })
          .eq("id", partRequestId);
        if (partErr) throw partErr;
      }

      // 2. If workOrderId exists, update labor_hours in work_orders
      if (workOrderId) {
        const { error: woErr } = await supabase
          .from("work_orders")
          .update({
            labor_hours: numHours > 0 ? numHours : null,
          })
          .eq("id", workOrderId);
        if (woErr) throw woErr;
      }

      // 3. Update notes on the asset if provided
      if (notes.trim()) {
        await supabase.from("assets").update({ notes: notes.trim() }).eq("id", assetId);
      }
    },
    onSuccess: () => {
      toast.success(`Repair costs updated for ${assetName}`);
      queryClient.invalidateQueries({ queryKey: ["equipment-down"] });
      queryClient.invalidateQueries({ queryKey: ["part-requests"] });
      queryClient.invalidateQueries({ queryKey: ["work-orders"] });
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      setOpen(false);
      onSaved?.();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : (
        <DialogTrigger asChild>
          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs font-semibold">
            <DollarSign className="size-3.5 text-emerald-600 dark:text-emerald-400" />
            Manage Repair Cost
          </Button>
        </DialogTrigger>
      )}

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="size-5 text-primary" /> Repair &amp; Parts Cost Tracking
          </DialogTitle>
          <DialogDescription>
            Record estimated or awarded repair costs, replacement parts pricing, and technician
            labor for <strong className="text-foreground">{assetName}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {/* Parts Cost Section */}
          <div className="rounded-lg border border-border bg-muted/30 p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-foreground flex items-center gap-1.5">
                <DollarSign className="size-4 text-emerald-600" /> Replacement Parts Cost
              </span>
              <span className="text-[11px] text-muted-foreground">PO or Bid Quotation</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="quoted-cost" className="text-[11px]">
                  Estimated / Quoted Cost ($)
                </Label>
                <Input
                  id="quoted-cost"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={quotedCost}
                  onChange={(e) => setQuotedCost(e.target.value)}
                  className="h-8 text-xs font-mono"
                />
                <span className="text-[10px] text-muted-foreground">Used during Out for Bid</span>
              </div>

              <div className="space-y-1">
                <Label htmlFor="awarded-cost" className="text-[11px]">
                  Actual / Awarded Cost ($)
                </Label>
                <Input
                  id="awarded-cost"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={awardedCost}
                  onChange={(e) => setAwardedCost(e.target.value)}
                  className="h-8 text-xs font-mono font-semibold text-emerald-600 dark:text-emerald-400"
                />
                <span className="text-[10px] text-muted-foreground">Final PO committed cost</span>
              </div>
            </div>
          </div>

          {/* Labor Cost Section */}
          <div className="rounded-lg border border-border bg-muted/30 p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-foreground flex items-center gap-1.5">
                <Calculator className="size-4 text-blue-600" /> Maintenance Labor Cost
              </span>
              <span className="text-[11px] text-muted-foreground font-mono">
                Subtotal: ${totalLaborCost.toFixed(2)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="labor-hours" className="text-[11px]">
                  Estimated Labor Hours
                </Label>
                <Input
                  id="labor-hours"
                  type="number"
                  step="0.5"
                  min="0"
                  placeholder="0"
                  value={laborHours}
                  onChange={(e) => setLaborHours(e.target.value)}
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="labor-rate" className="text-[11px]">
                  Plant Labor Rate ($/hr)
                </Label>
                <Input
                  id="labor-rate"
                  type="number"
                  step="1"
                  min="0"
                  placeholder="85"
                  value={laborRate}
                  onChange={(e) => setLaborRate(e.target.value)}
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>
          </div>

          {/* Total Cost Calculation Banner */}
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-foreground">Total Repair Impact</p>
              <p className="text-[11px] text-muted-foreground">
                Parts (${totalPartsCost.toFixed(2)}) + Labor (${totalLaborCost.toFixed(2)})
              </p>
            </div>
            <div className="text-right">
              <p className="text-lg font-black font-mono text-primary">
                $
                {totalEstimatedCost.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <Label htmlFor="cost-notes" className="text-[11px]">
              Repair &amp; Cost Justification Notes
            </Label>
            <Textarea
              id="cost-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Includes expedited freight, crane rental, or seal kit discount"
              className="text-xs resize-none"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)} className="h-8 text-xs">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="h-8 gap-1.5 text-xs font-semibold"
          >
            <CheckCircle2 className="size-3.5" />
            {saveMutation.isPending ? "Saving…" : "Save Costs"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

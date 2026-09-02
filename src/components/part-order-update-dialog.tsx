import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  REQUEST_STATUSES,
  STATUS_LABEL,
  updateRequestOrder,
  updateRequestStatus,
  type PartRequestRow,
  type RequestStatus,
} from "@/lib/part-requests";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { CheckCircle2, Edit3, PackageCheck, Truck } from "lucide-react";

export function PartOrderUpdateDialog({
  request,
  trigger,
}: {
  request: PartRequestRow;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<RequestStatus>(
    (request.status as RequestStatus) || "requested",
  );
  const [vendor, setVendor] = useState(request.vendor ?? request.awarded_vendor ?? "");
  const [cost, setCost] = useState(
    request.awarded_cost != null
      ? String(request.awarded_cost)
      : request.quoted_cost != null
        ? String(request.quoted_cost)
        : "",
  );
  const [lead, setLead] = useState(
    request.lead_time_days != null ? String(request.lead_time_days) : "",
  );
  const [po, setPo] = useState(request.po_number ?? "");
  const [expected, setExpected] = useState(request.expected_date ?? "");
  const [note, setNote] = useState(request.decision_note ?? request.note ?? "");

  const queryClient = useQueryClient();

  const saveMutation = useMutation({
    mutationFn: async () => {
      await updateRequestStatus({
        id: request.id,
        status,
        vendor: vendor.trim() || null,
        quotedCost: cost.trim() || null,
        note: note.trim() || null,
      });

      await updateRequestOrder({
        id: request.id,
        awardedVendor: vendor.trim() || null,
        awardedCost: cost.trim() || null,
        leadTimeDays: lead.trim() || null,
        poNumber: po.trim() || null,
        expectedDate: expected.trim() || null,
        status,
      });
    },
    onSuccess: () => {
      toast.success(`Parts order updated: ${STATUS_LABEL[status]}`);
      queryClient.invalidateQueries({ queryKey: ["part-requests"] });
      queryClient.invalidateQueries({ queryKey: ["asset-part-requests"] });
      queryClient.invalidateQueries({ queryKey: ["work-orders"] });
      setOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : (
        <DialogTrigger asChild>
          <Button size="sm" variant="outline" className="h-8 gap-1 text-xs">
            <Edit3 className="size-3.5" /> Manage Order
          </Button>
        </DialogTrigger>
      )}

      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto p-6">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary">
            <PackageCheck className="size-5" />
            <DialogTitle className="text-base font-bold">Update Parts Requisition</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            {request.title}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveMutation.mutate();
          }}
          className="space-y-4 pt-2"
        >
          {/* Status Selector */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Procurement Lifecycle Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as RequestStatus)}>
              <SelectTrigger className="text-xs font-medium">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REQUEST_STATUSES.map((s) => (
                  <SelectItem key={s} value={s} className="text-xs font-medium">
                    {STATUS_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="po-number" className="text-xs font-semibold">
                PO / Tracking #
              </Label>
              <Input
                id="po-number"
                value={po}
                onChange={(e) => setPo(e.target.value)}
                placeholder="e.g. PO-84920"
                className="text-xs font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="vendor-supplier" className="text-xs font-semibold">
                Vendor / Supplier
              </Label>
              <Input
                id="vendor-supplier"
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                placeholder="e.g. Grainger, McMaster-Carr, OEM"
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="order-cost" className="text-xs font-semibold">
                Total Cost ($ USD)
              </Label>
              <Input
                id="order-cost"
                type="number"
                step="0.01"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                placeholder="0.00"
                className="text-xs font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="lead-time" className="text-xs font-semibold">
                Lead Time (Days)
              </Label>
              <Input
                id="lead-time"
                type="number"
                value={lead}
                onChange={(e) => setLead(e.target.value)}
                placeholder="e.g. 3"
                className="text-xs font-mono"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="expected-date" className="text-xs font-semibold">
              Expected Delivery Date
            </Label>
            <Input
              id="expected-date"
              type="date"
              value={expected}
              onChange={(e) => setExpected(e.target.value)}
              className="text-xs font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="decision-note" className="text-xs font-semibold">
              Procurement &amp; Receiving Notes
            </Label>
            <Textarea
              id="decision-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="e.g. Ordered with expedited freight; tracking with carrier."
              className="text-xs"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={saveMutation.isPending}
              className="gap-1.5 text-xs font-semibold"
            >
              <CheckCircle2 className="size-3.5" />
              {saveMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

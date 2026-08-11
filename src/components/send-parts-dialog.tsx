import { useState, useId } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { createPartRequest, type RouteOptionValue } from "@/lib/part-requests";
import { sendAssignmentAlert } from "@/lib/alerts.functions";
import { useTeamMembers } from "@/hooks/use-team-members";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import {
  AlertTriangle,
  Boxes,
  Camera,
  CheckCircle2,
  PackagePlus,
  Send,
  ShieldCheck,
  Sparkles,
  User,
  Users,
  Wrench,
} from "lucide-react";

export interface SendPartsDialogProps {
  asset?: { id: string; name: string; manufacturer?: string | null } | null;
  workOrder?: { id: string; wo_number: number; title: string } | null;
  initialPart?: {
    name: string;
    part_number?: string | null;
    manufacturer?: string | null;
    qty?: string | number;
    where_to_buy?: string | null;
    unit_cost?: number | null;
  } | null;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  lockAsset?: boolean;
}

export function SendPartsDialog({
  asset: initialAsset,
  workOrder: initialWorkOrder,
  initialPart,
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  lockAsset = false,
}: SendPartsDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? controlledOnOpenChange! : setInternalOpen;

  const idPrefix = useId();
  const queryClient = useQueryClient();
  const team = useTeamMembers();
  const sendAlert = useServerFn(sendAssignmentAlert);

  // Form State
  const [title, setTitle] = useState(
    initialPart?.name
      ? `Part Request: ${initialPart.name}${initialPart.part_number ? ` (P/N ${initialPart.part_number})` : ""}`
      : initialAsset?.name
        ? `Parts needed for ${initialAsset.name}`
        : "",
  );
  const [partLines, setPartLines] = useState(
    initialPart
      ? [
          `• ${initialPart.qty || 1}x ${initialPart.name}`,
          initialPart.part_number ? `  Part #: ${initialPart.part_number}` : null,
          initialPart.manufacturer ? `  Manufacturer: ${initialPart.manufacturer}` : null,
          initialPart.where_to_buy ? `  Vendor/Source: ${initialPart.where_to_buy}` : null,
          initialPart.unit_cost != null ? `  Est. Unit Cost: $${initialPart.unit_cost}` : null,
        ]
          .filter(Boolean)
          .join("\n")
      : "",
  );
  const [targetRecipient, setTargetRecipient] = useState<string>("coordinator");
  const [specificPersonId, setSpecificPersonId] = useState<string>("");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [neededBy, setNeededBy] = useState("");
  const [note, setNote] = useState("");
  const [selectedAssetId, setSelectedAssetId] = useState<string>(initialAsset?.id ?? "none");
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState<string>(
    initialWorkOrder?.id ?? "none",
  );
  const [photos, setPhotos] = useState<File[]>([]);

  // Query assets for dropdown if not locked
  const assetsQuery = useQuery({
    queryKey: ["assets-brief-list"],
    enabled: open && !lockAsset && !initialAsset,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assets")
        .select("id, name, asset_number, location_name")
        .order("name")
        .limit(300);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Query open work orders for dropdown
  const wosQuery = useQuery({
    queryKey: ["open-wos-brief-list"],
    enabled: open && !initialWorkOrder,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_orders")
        .select("id, wo_number, title")
        .in("status", ["open", "in_progress", "pending_parts"])
        .order("wo_number", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error("Please provide a title for the parts request.");
      if (!partLines.trim()) throw new Error("Please specify the parts needed.");

      let routeTo: "supervisors" | "coordinator" | "supervisor" | "person" = "coordinator";
      let sentTo: string | null = null;

      if (targetRecipient === "supervisors") {
        routeTo = "supervisors";
      } else if (targetRecipient === "coordinator") {
        routeTo = "coordinator";
      } else if (targetRecipient === "supervisor") {
        routeTo = "supervisor";
      } else if (targetRecipient === "person") {
        routeTo = "person";
        sentTo = specificPersonId || null;
        if (!sentTo)
          throw new Error("Please choose a specific team member to receive this request.");
      }

      const assetId = initialAsset?.id ?? (selectedAssetId !== "none" ? selectedAssetId : null);
      const workOrderId =
        initialWorkOrder?.id ?? (selectedWorkOrderId !== "none" ? selectedWorkOrderId : null);

      const requestId = await createPartRequest({
        title: title.trim(),
        partLines: partLines.trim(),
        note: note.trim() || null,
        priority,
        neededBy: neededBy || null,
        routeTo: routeTo === "coordinator" || routeTo === "supervisor" ? "supervisors" : routeTo,
        sentTo,
        workOrderId,
        assetId,
        photos,
      });

      // If sent to a specific person, trigger notification email/SMS
      if (sentTo) {
        try {
          await sendAlert({
            data: {
              recipientUserId: sentTo,
              title: `Parts Request: ${title.trim()}`,
              body: `Needed by ${neededBy || "soon"} (Priority: ${priority.toUpperCase()}):\n${partLines.trim().slice(0, 200)}`,
              link: `/part-requests`,
              eventKey: `part-req-${requestId}`,
            },
          });
        } catch {
          // Non-blocking notification dispatch
        }
      }

      return { requestId, routeTo };
    },
    onSuccess: (res) => {
      const recipientLabel =
        targetRecipient === "coordinator"
          ? "CMMS Coordinator / Procurement Lead"
          : targetRecipient === "supervisor"
            ? "Maintenance Supervisor"
            : targetRecipient === "supervisors"
              ? "All Plant Supervisors & Coordinators"
              : "Assigned Teammate";

      toast.success(`Parts requisition sent to ${recipientLabel}!`, {
        description: `Your request is logged and ready for quote bidding or immediate PO issuance.`,
      });

      queryClient.invalidateQueries({ queryKey: ["part-requests"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["work-orders"] });
      queryClient.invalidateQueries({ queryKey: ["parts"] });

      setOpen(false);
      // Reset form if reopened
      if (!initialPart) {
        setTitle("");
        setPartLines("");
        setNote("");
        setPhotos([]);
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : (
        <DialogTrigger asChild>
          <Button className="gap-1.5 font-bold shadow-sm" size="sm">
            <Send className="size-4" /> Send Parts to Supervisor / Coordinator
          </Button>
        </DialogTrigger>
      )}

      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto p-6">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <PackagePlus className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">
                Send Parts to Supervisor / CMMS Coordinator
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Request replacement parts, emergency spares, or inventory restocks with photos and
                specs for immediate approval and bidding.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Target Recipient Selector */}
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <Label
                htmlFor={`${idPrefix}-recipient`}
                className="text-xs font-bold text-foreground flex items-center gap-1.5"
              >
                <Users className="size-4 text-primary" /> Route Request To:
              </Label>
              <Badge variant="outline" className="text-[10px] bg-background font-semibold">
                Instant Notification
              </Badge>
            </div>

            <Select value={targetRecipient} onValueChange={setTargetRecipient}>
              <SelectTrigger
                id={`${idPrefix}-recipient`}
                className="bg-background font-medium text-xs"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="coordinator" className="text-xs font-medium">
                  🎯 CMMS Coordinator / Procurement Lead (Quotes, Bids &amp; POs)
                </SelectItem>
                <SelectItem value="supervisor" className="text-xs font-medium">
                  👷 Maintenance / Shift Supervisor (Sign-Off &amp; Approval)
                </SelectItem>
                <SelectItem value="supervisors" className="text-xs font-medium">
                  📢 All Supervisors &amp; CMMS Coordinators (Broadcast Requisition)
                </SelectItem>
                <SelectItem value="person" className="text-xs font-medium">
                  👤 Specific Teammate / Buyer
                </SelectItem>
              </SelectContent>
            </Select>

            {targetRecipient === "person" && (
              <div className="pt-1">
                <Label
                  htmlFor={`${idPrefix}-person`}
                  className="text-[11px] font-semibold text-muted-foreground"
                >
                  Select Teammate:
                </Label>
                <Select value={specificPersonId} onValueChange={setSpecificPersonId}>
                  <SelectTrigger id={`${idPrefix}-person`} className="bg-background mt-1 text-xs">
                    <SelectValue placeholder="Choose a team member…" />
                  </SelectTrigger>
                  <SelectContent>
                    {(team.data ?? []).map((m) => (
                      <SelectItem key={m.id} value={m.id} className="text-xs">
                        {m.full_name || "Plant Teammate"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Request Title */}
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-title`} className="text-xs font-bold text-foreground">
              Request Subject / Summary <span className="text-destructive">*</span>
            </Label>
            <Input
              id={`${idPrefix}-title`}
              required
              placeholder="e.g. 2x Mechanical Shaft Seals for Influent Pump #2"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-xs"
            />
          </div>

          {/* Part Lines / Specification */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor={`${idPrefix}-lines`} className="text-xs font-bold text-foreground">
                Parts Needed &amp; OEM Part Numbers <span className="text-destructive">*</span>
              </Label>
              <span className="text-[10px] text-muted-foreground">
                Include quantities, part #, make, and dimensions
              </span>
            </div>
            <Textarea
              id={`${idPrefix}-lines`}
              required
              rows={4}
              placeholder={`• 2x Mechanical Seal (P/N: 5410-B, Flygt / Xylem)\n• 1x O-Ring Viton Repair Kit\n• 1x Mobilgrease FM 222 (14 oz cartridge)`}
              value={partLines}
              onChange={(e) => setPartLines(e.target.value)}
              className="text-xs font-mono"
            />
          </div>

          {/* Asset & Work Order Linking */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label
                htmlFor={`${idPrefix}-asset`}
                className="text-xs font-bold text-foreground flex items-center gap-1"
              >
                <Boxes className="size-3.5 text-primary" /> Associated Equipment / Asset
              </Label>
              {initialAsset || lockAsset ? (
                <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs font-semibold">
                  <Wrench className="size-3.5 text-muted-foreground" />
                  <span className="truncate">{initialAsset?.name || "Locked Asset"}</span>
                </div>
              ) : (
                <Select value={selectedAssetId} onValueChange={setSelectedAssetId}>
                  <SelectTrigger id={`${idPrefix}-asset`} className="text-xs">
                    <SelectValue placeholder="No asset attached (General stock)" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    <SelectItem value="none" className="text-xs font-medium">
                      No asset (General plant storeroom)
                    </SelectItem>
                    {(assetsQuery.data ?? []).map((a) => (
                      <SelectItem key={a.id} value={a.id} className="text-xs">
                        {a.name} {a.location_name ? `(${a.location_name})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`${idPrefix}-wo`} className="text-xs font-bold text-foreground">
                Link to Work Order (Optional)
              </Label>
              {initialWorkOrder ? (
                <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs font-semibold">
                  <span className="font-mono text-primary">WO-{initialWorkOrder.wo_number}</span>
                  <span className="truncate">{initialWorkOrder.title}</span>
                </div>
              ) : (
                <Select value={selectedWorkOrderId} onValueChange={setSelectedWorkOrderId}>
                  <SelectTrigger id={`${idPrefix}-wo`} className="text-xs">
                    <SelectValue placeholder="No work order attached" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    <SelectItem value="none" className="text-xs font-medium">
                      None (Independent Requisition)
                    </SelectItem>
                    {(wosQuery.data ?? []).map((w) => (
                      <SelectItem key={w.id} value={w.id} className="text-xs">
                        WO-{w.wo_number} — {w.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          {/* Priority & Needed-by Date */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`${idPrefix}-priority`} className="text-xs font-bold text-foreground">
                Requisition Urgency / Priority
              </Label>
              <Select
                value={priority}
                onValueChange={(v) => setPriority(v as "low" | "medium" | "high" | "urgent")}
              >
                <SelectTrigger id={`${idPrefix}-priority`} className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low" className="text-xs">
                    🟢 Low — Routine Replenishment
                  </SelectItem>
                  <SelectItem value="medium" className="text-xs font-medium">
                    🔵 Normal — Next Maintenance Interval
                  </SelectItem>
                  <SelectItem value="high" className="text-xs font-bold text-amber-600">
                    🟡 High — Degradation / Imminent Work
                  </SelectItem>
                  <SelectItem value="urgent" className="text-xs font-extrabold text-destructive">
                    🔴 Critical — Equipment Offline / Plant Stoppage
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`${idPrefix}-needed`} className="text-xs font-bold text-foreground">
                Needed By Date (Optional)
              </Label>
              <Input
                id={`${idPrefix}-needed`}
                type="date"
                value={neededBy}
                onChange={(e) => setNeededBy(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>

          {/* Justification Note */}
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-note`} className="text-xs font-bold text-foreground">
              Notes / Justification for Supervisor or Coordinator
            </Label>
            <Textarea
              id={`${idPrefix}-note`}
              rows={2}
              placeholder="e.g. Pump showed heavy shaft leakage during shift inspection. Recommending OEM Flygt mechanical seal kit with expedited 3-day freight."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="text-xs"
            />
          </div>

          {/* Photo Upload */}
          <div className="space-y-1.5">
            <Label
              htmlFor={`${idPrefix}-photos`}
              className="text-xs font-bold text-foreground flex items-center gap-1.5"
            >
              <Camera className="size-3.5 text-primary" /> Attach Photos (Nameplate, Damaged Parts,
              Spec Sheets)
            </Label>
            <Input
              id={`${idPrefix}-photos`}
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => {
                if (e.target.files?.length) {
                  setPhotos(Array.from(e.target.files));
                }
              }}
              className="text-xs file:mr-2 file:rounded-md file:border-0 file:bg-primary/10 file:px-2 file:py-1 file:text-xs file:font-semibold file:text-primary hover:file:bg-primary/20"
            />
            {photos.length > 0 && (
              <p className="text-[11px] text-success font-medium">
                ✓ {photos.length} photo{photos.length === 1 ? "" : "s"} selected for upload.
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="mt-4 border-t border-border pt-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setOpen(false)}
            disabled={sendMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => sendMutation.mutate()}
            disabled={sendMutation.isPending}
            className="gap-1.5 font-bold"
          >
            <Send className="size-4" />
            {sendMutation.isPending ? "Routing Requisition…" : "Send to Supervisor / Coordinator"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

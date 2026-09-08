import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { AlertOctagon, Wrench, Plus, CheckCircle2, Search } from "lucide-react";

interface ReportDownAssetDialogProps {
  preselectedAssetId?: string;
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

export function ReportDownAssetDialog({
  preselectedAssetId,
  trigger,
  onSuccess,
}: ReportDownAssetDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState(preselectedAssetId ?? "");
  const [status, setStatus] = useState<"down" | "needs_repair">("down");
  const [issue, setIssue] = useState("");
  const [criticality, setCriticality] = useState<"high" | "medium" | "low">("high");
  const [partsMode, setPartsMode] = useState<"none" | "bidding" | "ordered" | "requested">(
    "bidding",
  );
  const [partsDescription, setPartsDescription] = useState("");
  const [estimatedCost, setEstimatedCost] = useState("");
  const [vendor, setVendor] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [laborHours, setLaborHours] = useState("4");
  const [assetSearch, setAssetSearch] = useState("");

  const queryClient = useQueryClient();

  // Load all assets for search dropdown
  const { data: assets = [] } = useQuery({
    queryKey: ["all-assets-for-report"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assets")
        .select("id, name, tag_number, building, manufacturer, model, status")
        .order("name")
        .limit(2000);
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  const filteredAssets = assets
    .filter((a) => {
      if (!assetSearch.trim()) return true;
      const q = assetSearch.toLowerCase();
      return (
        a.name.toLowerCase().includes(q) ||
        (a.tag_number && a.tag_number.toLowerCase().includes(q)) ||
        (a.building && a.building.toLowerCase().includes(q)) ||
        (a.manufacturer && a.manufacturer.toLowerCase().includes(q)) ||
        (a.model && a.model.toLowerCase().includes(q))
      );
    })
    .slice(0, 100);

  const selectedAsset = assets.find((a) => a.id === selectedAssetId);

  const reportMutation = useMutation({
    mutationFn: async () => {
      if (!selectedAssetId) throw new Error("Please select an asset.");
      if (!issue.trim()) throw new Error("Please describe the failure symptoms or repair issue.");

      const { data: authData } = await supabase.auth.getUser();
      const currentUserId = authData?.user?.id ?? null;

      // 1. Update Asset Status and Criticality
      const { error: assetErr } = await supabase
        .from("assets")
        .update({
          status,
          notes: issue.trim(),
          criticality,
        })
        .eq("id", selectedAssetId);
      if (assetErr) throw assetErr;

      // 2. Create emergency/corrective work order
      const { data: woData, error: woErr } = await supabase
        .from("work_orders")
        .insert({
          asset_id: selectedAssetId,
          title: `[${status === "down" ? "OUTAGE" : "REPAIR"}] ${selectedAsset?.name ?? "Equipment"} — ${issue.slice(0, 60)}`,
          description: issue.trim(),
          wo_type: status === "down" ? "emergency" : "corrective",
          priority: status === "down" ? "critical" : "high",
          status: "open",
          labor_hours: parseFloat(laborHours) || 4,
          created_by: currentUserId,
        })
        .select("id")
        .single();
      if (woErr) console.warn("Could not create work order:", woErr);

      // 3. Create part request if parts needed
      if (partsMode !== "none") {
        const estCostNum = parseFloat(estimatedCost) || null;
        const { error: partErr } = await supabase.from("part_requests").insert({
          asset_id: selectedAssetId,
          work_order_id: woData?.id ?? null,
          title: partsDescription.trim() || `Replacement Parts for ${selectedAsset?.name}`,
          part_lines: partsDescription.trim() || "See outage description",
          status: partsMode,
          quoted_cost: partsMode === "bidding" ? estCostNum : null,
          awarded_cost: partsMode === "ordered" ? estCostNum : null,
          vendor: vendor.trim() || null,
          awarded_vendor: partsMode === "ordered" ? vendor.trim() || null : null,
          po_number: partsMode === "ordered" ? poNumber.trim() || null : null,
          expected_date: expectedDate || null,
          priority: status === "down" ? "critical" : "high",
          route_to: "supervisors",
          requested_by: currentUserId,
          note: `Logged during outage report. Issue: ${issue.trim()}`,
        });
        if (partErr) console.warn("Could not create part request:", partErr);
      }
    },
    onSuccess: () => {
      toast.success(
        `Reported ${selectedAsset?.name ?? "Equipment"} as ${status === "down" ? "DOWN" : "NEEDS REPAIR"}!`,
      );
      queryClient.invalidateQueries({ queryKey: ["equipment-down"] });
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      queryClient.invalidateQueries({ queryKey: ["work-orders"] });
      queryClient.invalidateQueries({ queryKey: ["part-requests"] });
      setOpen(false);
      onSuccess?.();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : (
        <DialogTrigger asChild>
          <Button
            size="sm"
            className="h-8 gap-1.5 text-xs font-semibold bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            <AlertOctagon className="size-3.5" />
            Report Down Equipment
          </Button>
        </DialogTrigger>
      )}

      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            <AlertOctagon className="size-5 text-destructive" /> Report Equipment Down or Needs
            Repair
          </DialogTitle>
          <DialogDescription className="text-xs">
            Log an active equipment outage, trigger repair cost tracking, and immediately flag parts
            as Out for Bid or Ordered.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {/* Asset Selection */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-foreground">Select Equipment / Asset *</Label>
            {!preselectedAssetId && (
              <div className="relative mb-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <Input
                  placeholder="Type to filter plant assets by name, tag, model..."
                  value={assetSearch}
                  onChange={(e) => setAssetSearch(e.target.value)}
                  className="pl-8 text-xs h-8"
                />
              </div>
            )}
            <Select value={selectedAssetId} onValueChange={setSelectedAssetId}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Choose an asset from registry..." />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {filteredAssets.map((a) => (
                  <SelectItem key={a.id} value={a.id} className="text-xs">
                    <span className="font-semibold">{a.name}</span>
                    {a.tag_number && (
                      <span className="ml-2 font-mono text-muted-foreground">({a.tag_number})</span>
                    )}
                    {a.building && (
                      <span className="ml-2 text-muted-foreground">· {a.building}</span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedAsset && (
              <p className="text-[11px] text-muted-foreground font-mono">
                Current status:{" "}
                <span className="font-semibold text-foreground uppercase">
                  {selectedAsset.status}
                </span>
                {selectedAsset.manufacturer && ` · OEM: ${selectedAsset.manufacturer}`}
                {selectedAsset.model && ` · Model: ${selectedAsset.model}`}
              </p>
            )}
          </div>

          {/* Outage Status & Criticality */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold">Equipment Status *</Label>
              <Select value={status} onValueChange={(v: "down" | "needs_repair") => setStatus(v)}>
                <SelectTrigger className="h-8 text-xs font-semibold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="down" className="text-destructive font-bold text-xs">
                    🔴 DOWN (Offline / Emergency)
                  </SelectItem>
                  <SelectItem value="needs_repair" className="text-amber-600 font-bold text-xs">
                    🟡 NEEDS REPAIR (Operating degraded)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] font-semibold">Plant Criticality</Label>
              <Select
                value={criticality}
                onValueChange={(v: "high" | "medium" | "low") => setCriticality(v)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high" className="text-xs font-semibold">
                    High Criticality
                  </SelectItem>
                  <SelectItem value="medium" className="text-xs">
                    Medium Criticality
                  </SelectItem>
                  <SelectItem value="low" className="text-xs">
                    Low Criticality
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Issue Symptoms Description */}
          <div className="space-y-1">
            <Label className="text-[11px] font-semibold">Failure Issue / Repair Symptoms *</Label>
            <Textarea
              rows={3}
              placeholder="e.g., Mechanical seal blowout with heavy slurry leak; abnormal 4.8 mm/s vibration at drive-end bearing; motor tripped on thermal overload..."
              value={issue}
              onChange={(e) => setIssue(e.target.value)}
              className="text-xs resize-none"
            />
          </div>

          {/* Parts Requisition & Procurement Status */}
          <div className="rounded-lg border border-border bg-muted/30 p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-foreground flex items-center gap-1.5">
                <Wrench className="size-4 text-primary" /> Parts Requisition &amp; Bidding Status
              </span>
              <span className="text-[11px] text-muted-foreground">Procurement tracking</span>
            </div>

            <div className="space-y-1">
              <Label className="text-[11px]">Parts Status</Label>
              <Select
                value={partsMode}
                onValueChange={(v: "none" | "bidding" | "ordered" | "requested") => setPartsMode(v)}
              >
                <SelectTrigger className="h-8 text-xs font-semibold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bidding" className="text-xs font-semibold text-blue-600">
                    🏷️ Parts Out for Bid (Awaiting vendor quotes)
                  </SelectItem>
                  <SelectItem value="ordered" className="text-xs font-semibold text-emerald-600">
                    📦 Parts Ordered (PO placed with vendor)
                  </SelectItem>
                  <SelectItem value="requested" className="text-xs">
                    ⏳ Parts Requested (RFQ needed)
                  </SelectItem>
                  <SelectItem value="none" className="text-xs text-muted-foreground">
                    🚫 No New Parts Needed (Adjustment / In-house labor only)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {partsMode !== "none" && (
              <div className="space-y-3 pt-1">
                <div className="space-y-1">
                  <Label className="text-[11px]">Required Parts Description / Part Numbers</Label>
                  <Input
                    placeholder="e.g., 1x Mechanical Seal P/N 8402-TC, 1x Suction Wear Ring"
                    value={partsDescription}
                    onChange={(e) => setPartsDescription(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[11px]">
                      {partsMode === "ordered"
                        ? "Awarded / PO Cost ($)"
                        : "Estimated / Quoted Cost ($)"}
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={estimatedCost}
                      onChange={(e) => setEstimatedCost(e.target.value)}
                      className="h-8 text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px]">Vendor / Suppliers</Label>
                    <Input
                      placeholder={
                        partsMode === "ordered"
                          ? "e.g., Motion Industries"
                          : "e.g., Motion / Grainger RFQ"
                      }
                      value={vendor}
                      onChange={(e) => setVendor(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                {partsMode === "ordered" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[11px]">Purchase Order (PO #)</Label>
                      <Input
                        placeholder="e.g., PO-2026-0842"
                        value={poNumber}
                        onChange={(e) => setPoNumber(e.target.value)}
                        className="h-8 text-xs font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[11px]">Expected Delivery Date</Label>
                      <Input
                        type="date"
                        value={expectedDate}
                        onChange={(e) => setExpectedDate(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Labor Estimation */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[11px]">Estimated Repair Labor (Hours)</Label>
              <Input
                type="number"
                step="0.5"
                min="0"
                value={laborHours}
                onChange={(e) => setLaborHours(e.target.value)}
                className="h-8 text-xs font-mono"
              />
            </div>
            <div className="flex flex-col justify-end text-[11px] text-muted-foreground pb-1">
              Estimated labor cost at standard plant rate ($85/hr):{" "}
              <strong className="text-foreground font-mono">
                ${((parseFloat(laborHours) || 0) * 85).toFixed(2)}
              </strong>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)} className="h-8 text-xs">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => reportMutation.mutate()}
            disabled={reportMutation.isPending || !selectedAssetId || !issue.trim()}
            className="h-8 gap-1.5 text-xs font-semibold bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            <CheckCircle2 className="size-3.5" />
            {reportMutation.isPending ? "Logging Outage…" : "Submit Outage & Create WO"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

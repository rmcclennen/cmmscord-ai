import { useState, useId } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { lookupAssetParts, type PartsLookupResult } from "@/lib/parts.functions";
import { useTeamMembers } from "@/hooks/use-team-members";
import { upsertPartAndLink } from "@/lib/inventory";
import { memberLabel } from "@/lib/notify";
import { createPartRequest } from "@/lib/part-requests";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  AlertTriangle,
  Boxes,
  Check,
  ChevronDown,
  Copy,
  Database,
  Edit2,
  ExternalLink,
  Globe,
  PackagePlus,
  PackageSearch,
  Plus,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Trash2,
  Warehouse,
  Wrench,
} from "lucide-react";

export type PartItem = PartsLookupResult["parts"][number];

export interface PartsLookupDialogProps {
  workOrder?: {
    id: string;
    wo_number: number;
    title: string;
    parts_used?: string | null;
    assigned_to?: string | null;
    asset?: {
      id: string;
      name: string;
      manufacturer?: string | null;
      model?: string | null;
      manufacturer_url?: string | null;
      tag_number?: string | null;
    } | null;
  } | null;
  asset?: {
    id: string;
    name: string;
    manufacturer?: string | null;
    model?: string | null;
    manufacturer_url?: string | null;
    tag_number?: string | null;
  } | null;
  assetId?: string | null;
  initialNeed?: string;
  onSelectParts?: (parts: PartItem[], summaryText: string) => void;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

function getVendorSourcingLinks(
  partName: string,
  partNumber?: string | null,
  manufacturer?: string | null,
  assetName?: string | null,
) {
  const query = [manufacturer, partNumber, partName, assetName].filter(Boolean).join(" ");
  const encodedQuery = encodeURIComponent(query);
  const partNumberOrQuery = encodeURIComponent(partNumber || query);

  return {
    google: `https://www.google.com/search?q=${encodeURIComponent(`buy ${query}`)}`,
    grainger: `https://www.grainger.com/search?searchQuery=${partNumberOrQuery}`,
    mcmaster: `https://www.mcmaster.com/${encodeURIComponent(partNumber || partName)}`,
    motion: `https://www.motion.com/search?q=${partNumberOrQuery}`,
    fastenal: `https://www.fastenal.com/product/all?searchKeyword=${partNumberOrQuery}`,
    amazon: `https://www.amazon.com/s?k=${encodedQuery}`,
  };
}

function formatPartLine(part: PartItem) {
  return [
    part.qty ? `${part.qty} ×` : "1 ×",
    part.name,
    part.part_number ? `(P/N ${part.part_number})` : null,
    part.manufacturer ? `[${part.manufacturer}]` : null,
    part.where_to_buy ? `• Source: ${part.where_to_buy}` : null,
  ]
    .filter(Boolean)
    .join(" ");
}

export function PartsLookupDialog({
  workOrder,
  asset: directAsset,
  assetId,
  initialNeed,
  onSelectParts,
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: PartsLookupDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? controlledOnOpenChange! : setInternalOpen;

  const idPrefix = useId();
  const queryClient = useQueryClient();
  const team = useTeamMembers(open);
  const runLookup = useServerFn(lookupAssetParts);

  // Selected asset state (from prop or standalone picker)
  const [activeAssetId, setActiveAssetId] = useState<string>(
    workOrder?.asset?.id || directAsset?.id || assetId || "none",
  );
  const [customEquipmentName, setCustomEquipmentName] = useState("");
  const [customEquipmentMfr, setCustomEquipmentMfr] = useState("");

  const [need, setNeed] = useState(initialNeed || workOrder?.title || "");
  const [feedback, setFeedback] = useState("");
  const [showCorrectionTools, setShowCorrectionTools] = useState(false);
  const [correctionTab, setCorrectionTab] = useState<"ai_refine" | "db_search" | "custom_add">(
    "ai_refine",
  );

  // Inventory Database Search State
  const [dbSearchQuery, setDbSearchQuery] = useState("");

  // Add custom part inline state
  const [customName, setCustomName] = useState("");
  const [customPartNumber, setCustomPartNumber] = useState("");
  const [customMfr, setCustomMfr] = useState("");
  const [customQty, setCustomQty] = useState("1");
  const [customNotes, setCustomNotes] = useState("");

  // In-place edit state for a row
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editPartNumber, setEditPartNumber] = useState("");
  const [editMfr, setEditMfr] = useState("");
  const [editQty, setEditQty] = useState("1");
  const [editWhereToBuy, setEditWhereToBuy] = useState("");

  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [recipient, setRecipient] = useState<string>("coordinator");
  const [neededBy, setNeededBy] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [result, setResult] = useState<PartsLookupResult | null>(null);

  // Query assets for dropdown selector
  const plantAssetsQuery = useQuery({
    queryKey: ["plant-assets-picker-list"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assets")
        .select("id, name, manufacturer, model, tag_number, location_name")
        .order("name")
        .limit(300);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Query plant stockroom inventory database (parts table)
  const stockroomDbQuery = useQuery({
    queryKey: ["stockroom-db-search", dbSearchQuery],
    enabled: open && showCorrectionTools && correctionTab === "db_search",
    queryFn: async () => {
      let query = supabase
        .from("parts")
        .select(
          "id, name, part_number, manufacturer, qty_on_hand, location, bin, unit_cost, where_to_buy",
        )
        .order("name")
        .limit(40);

      if (dbSearchQuery.trim()) {
        const term = `%${dbSearchQuery.trim()}%`;
        query = query.or(`name.ilike.${term},part_number.ilike.${term},manufacturer.ilike.${term}`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  // Determine current effective asset info
  const matchedAsset = (plantAssetsQuery.data ?? []).find((a) => a.id === activeAssetId);
  const effectiveAsset = workOrder?.asset || directAsset || matchedAsset || null;
  const effectiveAssetName = effectiveAsset?.name || customEquipmentName.trim() || "Equipment";
  const effectiveAssetMfr = effectiveAsset?.manufacturer || customEquipmentMfr.trim() || "OEM";

  const lookup = useMutation({
    mutationFn: async (correctionNotes?: string) => {
      return runLookup({
        data: {
          assetId: activeAssetId !== "none" ? activeAssetId : undefined,
          equipmentName: effectiveAssetName,
          manufacturer: effectiveAssetMfr,
          model: effectiveAsset?.model || undefined,
          need: need.trim() || workOrder?.title || "Routine replacement wear parts and consumables",
          feedback: correctionNotes || feedback || undefined,
        },
      });
    },
    onSuccess: (data) => {
      setResult(data);
      setSelected(Object.fromEntries(data.parts.map((_, i) => [String(i), true])));
      setShowCorrectionTools(false);
      if (feedback.trim()) {
        toast.success("Google AI parts list refined with your custom specifications!");
      } else {
        toast.success(`Found ${data.parts.length} replacement parts for ${effectiveAssetName}`);
      }
    },
    onError: (error: Error) => toast.error(error.message || "Failed to look up parts"),
  });

  const handleDeletePart = (index: number) => {
    if (!result) return;
    const removedPart = result.parts[index];
    const newParts = result.parts.filter((_, i) => i !== index);
    setResult({
      ...result,
      parts: newParts,
    });
    const newSelected: Record<string, boolean> = {};
    newParts.forEach((_, i) => {
      newSelected[String(i)] = true;
    });
    setSelected(newSelected);
    toast.info(`Removed "${removedPart?.name || "Part"}" from list`);
  };

  const startEditingPart = (index: number, part: PartItem) => {
    setEditingIndex(index);
    setEditName(part.name);
    setEditPartNumber(part.part_number || "");
    setEditMfr(part.manufacturer || effectiveAssetMfr || "OEM");
    setEditQty(part.qty || "1");
    setEditWhereToBuy(part.where_to_buy || "");
  };

  const saveEditingPart = (index: number) => {
    if (!result) return;
    if (!editName.trim()) {
      toast.error("Part name cannot be empty");
      return;
    }
    const updated = [...result.parts];
    updated[index] = {
      ...updated[index],
      name: editName.trim(),
      part_number: editPartNumber.trim() || undefined,
      manufacturer: editMfr.trim() || undefined,
      qty: editQty.trim() || "1",
      where_to_buy: editWhereToBuy.trim() || undefined,
    };
    setResult({ ...result, parts: updated });
    setEditingIndex(null);
    toast.success("Part updated");
  };

  const handleAddCustomPart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) {
      toast.error("Part name is required");
      return;
    }
    const newPart: PartItem = {
      name: customName.trim(),
      part_number: customPartNumber.trim() || undefined,
      manufacturer: customMfr.trim() || effectiveAssetMfr || "OEM",
      qty: customQty.trim() || "1",
      where_to_buy: customNotes.trim() || "Plant Sourced / MRO",
      search_terms: `${effectiveAssetMfr} ${customPartNumber.trim() || customName.trim()}`,
    };
    const currentParts = result?.parts || [];
    const newParts = [...currentParts, newPart];
    setResult({
      notes: result?.notes || `Parts list for ${effectiveAssetName}`,
      parts: newParts,
      sources: result?.sources || [],
    });
    setSelected((prev) => ({ ...prev, [String(newParts.length - 1)]: true }));
    setCustomName("");
    setCustomPartNumber("");
    setCustomMfr("");
    setCustomNotes("");
    setShowCorrectionTools(false);
    toast.success(`Added "${newPart.name}" to parts list`);
  };

  const handleAddFromStockroom = (dbPart: {
    name: string;
    part_number: string | null;
    manufacturer: string | null;
    where_to_buy: string | null;
    qty_on_hand: number;
    location: string | null;
    bin: string | null;
  }) => {
    const locText = [
      dbPart.location ? `Loc: ${dbPart.location}` : null,
      dbPart.bin ? `Bin: ${dbPart.bin}` : null,
    ]
      .filter(Boolean)
      .join(", ");

    const newPart: PartItem = {
      name: dbPart.name,
      part_number: dbPart.part_number || undefined,
      manufacturer: dbPart.manufacturer || "OEM",
      qty: "1",
      where_to_buy: dbPart.where_to_buy || (locText ? `Stockroom (${locText})` : "In Stock"),
      search_terms: `${dbPart.manufacturer || ""} ${dbPart.part_number || dbPart.name}`.trim(),
    };

    const currentParts = result?.parts || [];
    const newParts = [...currentParts, newPart];
    setResult({
      notes: result?.notes || `Parts list for ${effectiveAssetName}`,
      parts: newParts,
      sources: result?.sources || [],
    });
    setSelected((prev) => ({ ...prev, [String(newParts.length - 1)]: true }));
    toast.success(`Added stockroom item "${dbPart.name}" (${dbPart.qty_on_hand} on hand)`);
  };

  const chosenParts = (result?.parts ?? []).filter((_, i) => selected[String(i)]);

  const handleApplyToParent = () => {
    if (chosenParts.length === 0) {
      toast.error("Please select at least one part");
      return;
    }
    const lines = chosenParts.map((p) => `• ${formatPartLine(p)}`).join("\n");
    if (onSelectParts) {
      onSelectParts(chosenParts, lines);
      setOpen(false);
      toast.success(`Attached ${chosenParts.length} parts to requisition form`);
    }
  };

  const addToInventory = useMutation({
    mutationFn: async () => {
      if (chosenParts.length === 0) throw new Error("Select at least one part.");
      for (const p of chosenParts) {
        await upsertPartAndLink({
          name: p.name,
          part_number: p.part_number ?? null,
          manufacturer: p.manufacturer ?? null,
          where_to_buy: p.where_to_buy ?? null,
          assetId: activeAssetId !== "none" ? activeAssetId : null,
        });
      }
    },
    onSuccess: () => {
      toast.success(
        effectiveAsset
          ? `${chosenParts.length} part${chosenParts.length === 1 ? "" : "s"} added to plant inventory and linked to ${effectiveAssetName}`
          : `${chosenParts.length} parts added to plant inventory`,
      );
      queryClient.invalidateQueries({ queryKey: ["parts"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const submitToWorkOrderOrRequisition = useMutation({
    mutationFn: async () => {
      if (chosenParts.length === 0) throw new Error("Select at least one part.");
      const lines = chosenParts.map((p) => `• ${formatPartLine(p)}`).join("\n");

      // 1. If attached to an existing work order
      if (workOrder?.id) {
        const next = [workOrder.parts_used?.trim(), `Parts needed:\n${lines}`]
          .filter(Boolean)
          .join("\n\n");
        const { error } = await supabase
          .from("work_orders")
          .update({ parts_used: next })
          .eq("id", workOrder.id);
        if (error) throw error;
      }

      // 2. If sending requisition / parts request
      if (recipient !== "none") {
        const routeTo =
          recipient === "supervisors" || recipient === "coordinator" || recipient === "supervisor"
            ? "supervisors"
            : "person";
        const sentTo =
          recipient === "supervisors" || recipient === "coordinator" || recipient === "supervisor"
            ? null
            : recipient;

        await createPartRequest({
          title: workOrder
            ? `WO-${workOrder.wo_number} — ${workOrder.title} [Parts Needed]`
            : `Parts Requisition: ${effectiveAssetName}`,
          partLines: lines,
          note: effectiveAsset
            ? `Equipment: ${effectiveAssetName} (${effectiveAssetMfr})${recipient === "coordinator" ? " [Routed to CMMS Coordinator]" : recipient === "supervisor" ? " [Routed to Supervisor]" : ""}`
            : null,
          neededBy: neededBy || null,
          routeTo,
          sentTo,
          workOrderId: workOrder?.id ?? null,
          assetId: activeAssetId !== "none" ? activeAssetId : null,
          photos,
        });
      }
    },
    onSuccess: () => {
      const msg =
        recipient === "coordinator"
          ? "Parts requisition sent to CMMS Coordinator / Procurement Lead!"
          : recipient === "supervisor"
            ? "Parts requisition sent to Maintenance Supervisor!"
            : recipient === "supervisors"
              ? "Requisition broadcasted to all supervisors & buyers!"
              : workOrder
                ? "Parts attached to work order!"
                : "Parts requisition logged successfully!";

      toast.success(msg);
      queryClient.invalidateQueries({ queryKey: ["work-orders"] });
      queryClient.invalidateQueries({ queryKey: ["part-requests"] });
      queryClient.invalidateQueries({ queryKey: ["asset-part-requests"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      setOpen(false);
      setResult(null);
      setPhotos([]);
      setNeededBy("");
      setFeedback("");
      setShowCorrectionTools(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : (
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 font-semibold text-primary border-primary/40 hover:bg-primary/10"
          >
            <Sparkles className="size-3.5 text-primary" /> AI Google Parts Lookup
          </Button>
        </DialogTrigger>
      )}

      <DialogContent className="max-h-[90vh] overflow-y-auto max-w-3xl p-6">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <PackageSearch className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                AI Google Industrial Parts Lookup &amp; Sourcing
                <Badge
                  variant="outline"
                  className="text-[10px] bg-primary/5 text-primary border-primary/30"
                >
                  Google Search Grounded
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Look up OEM part numbers, wear parts, bearings, seals, filters, and vendor links
                (Grainger, McMaster, Motion) with Google Search AI grounding.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Equipment Selector / Context Card */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Wrench className="size-3.5 text-primary" /> Equipment Target
              </Label>
              {effectiveAsset?.tag_number && (
                <Badge variant="outline" className="font-mono text-xs">
                  Tag: {effectiveAsset.tag_number}
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium">Select Plant Asset / Equipment</Label>
                <Select
                  value={activeAssetId}
                  onValueChange={(val) => {
                    setActiveAssetId(val);
                    const selected = (plantAssetsQuery.data ?? []).find((a) => a.id === val);
                    if (selected) {
                      setCustomEquipmentName(selected.name);
                      setCustomEquipmentMfr(selected.manufacturer || "");
                    }
                  }}
                >
                  <SelectTrigger className="mt-1 bg-background text-xs">
                    <SelectValue placeholder="Pick equipment from plant database..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    <SelectItem value="none" className="text-xs text-muted-foreground">
                      -- Or type custom equipment name below --
                    </SelectItem>
                    {(plantAssetsQuery.data ?? []).map((a) => (
                      <SelectItem key={a.id} value={a.id} className="text-xs">
                        {a.name} {a.manufacturer ? `(${a.manufacturer})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-medium">Equipment Name / Spec</Label>
                <Input
                  placeholder="e.g. Goulds 3196 Centrifugal Pump, Baldor 15HP Motor"
                  value={customEquipmentName || effectiveAssetName}
                  onChange={(e) => setCustomEquipmentName(e.target.value)}
                  className="mt-1 bg-background text-xs font-medium"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div className="sm:col-span-2">
                <Label htmlFor={`${idPrefix}-need`} className="text-xs font-medium">
                  What parts or maintenance are needed?
                </Label>
                <Input
                  id={`${idPrefix}-need`}
                  placeholder="e.g. Mechanical seal kit, bearing replacement, drive belt, impeller, gaskets"
                  value={need}
                  onChange={(e) => setNeed(e.target.value)}
                  className="mt-1 bg-background text-xs"
                />
              </div>

              <div className="flex items-end">
                <Button
                  onClick={() => lookup.mutate(undefined)}
                  disabled={lookup.isPending || (!activeAssetId && !customEquipmentName.trim())}
                  className="w-full gap-1.5 font-bold shadow-xs text-xs h-9"
                >
                  {lookup.isPending ? (
                    <>
                      <RefreshCw className="size-3.5 animate-spin" />
                      Searching Google AI...
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-3.5" />
                      Run AI Parts Lookup
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Results Display */}
          {result && (
            <div className="space-y-4">
              {/* Header summary & Correction trigger */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/40 p-3 border border-border">
                <div className="space-y-0.5 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Sparkles className="size-3.5 text-primary" /> Sourcing Results (
                      {result.parts.length} items)
                    </span>
                    <Badge variant="outline" className="text-[10px] font-mono">
                      {chosenParts.length} Selected
                    </Badge>
                  </div>
                  {result.notes && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{result.notes}</p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1.5 font-semibold text-amber-700 dark:text-amber-300 border-amber-500/40 hover:bg-amber-500/10"
                    onClick={() => setShowCorrectionTools(!showCorrectionTools)}
                  >
                    <AlertTriangle className="size-3.5 text-amber-600" />
                    {showCorrectionTools ? "Hide Refinement Tools" : "Not the right parts / specs?"}
                  </Button>
                </div>
              </div>

              {/* CORRECTION / REFINEMENT & DATABASE SEARCH PANEL */}
              {showCorrectionTools && (
                <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 space-y-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-500/20 pb-2.5">
                    <div>
                      <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                        <Wrench className="size-4 text-amber-600" /> Refine Specs, Search Plant
                        Inventory, or Add Custom Parts
                      </h4>
                      <p className="text-[11px] text-muted-foreground">
                        Fix incorrect sizes or materials, search existing plant stockroom parts, or
                        manually insert parts.
                      </p>
                    </div>

                    {/* Sub-tab pills */}
                    <div className="flex items-center gap-1 bg-background/80 p-0.5 rounded-lg border border-border">
                      <button
                        type="button"
                        onClick={() => setCorrectionTab("ai_refine")}
                        className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                          correctionTab === "ai_refine"
                            ? "bg-primary text-primary-foreground shadow-xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        AI Re-Search Spec
                      </button>
                      <button
                        type="button"
                        onClick={() => setCorrectionTab("db_search")}
                        className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors flex items-center gap-1 ${
                          correctionTab === "db_search"
                            ? "bg-primary text-primary-foreground shadow-xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <Database className="size-3" /> Plant Stockroom Search
                      </button>
                      <button
                        type="button"
                        onClick={() => setCorrectionTab("custom_add")}
                        className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors flex items-center gap-1 ${
                          correctionTab === "custom_add"
                            ? "bg-primary text-primary-foreground shadow-xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <Plus className="size-3" /> Custom Part
                      </button>
                    </div>
                  </div>

                  {/* Tab 1: AI Prompt Refinement */}
                  {correctionTab === "ai_refine" && (
                    <div className="space-y-2.5">
                      <Label className="text-xs font-bold text-foreground">
                        Tell Google AI what is different or what exact specifications are needed:
                      </Label>
                      <Input
                        placeholder="e.g. 2.5 inch keyed shaft, silicon carbide mechanical seal, 460V 3-phase motor, viton o-rings, 15 HP"
                        value={feedback}
                        onChange={(e) => setFeedback(e.target.value)}
                        className="text-xs bg-background"
                      />
                      <div className="flex justify-end gap-2 pt-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs"
                          onClick={() => setShowCorrectionTools(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          className="h-8 text-xs gap-1.5 font-bold"
                          disabled={lookup.isPending || !feedback.trim()}
                          onClick={() => lookup.mutate(feedback)}
                        >
                          <RefreshCw
                            className={`size-3.5 ${lookup.isPending ? "animate-spin" : ""}`}
                          />
                          {lookup.isPending
                            ? "Re-searching Google AI..."
                            : "Re-search with Exact Specs"}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Tab 2: Plant Inventory Database Search */}
                  {correctionTab === "db_search" && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
                          <Input
                            placeholder="Search plant stockroom by part name, OEM part number, or manufacturer..."
                            value={dbSearchQuery}
                            onChange={(e) => setDbSearchQuery(e.target.value)}
                            className="pl-8 text-xs bg-background"
                          />
                        </div>
                      </div>

                      <div className="rounded-lg border border-border bg-card max-h-56 overflow-y-auto divide-y divide-border">
                        {stockroomDbQuery.isLoading ? (
                          <p className="p-3 text-xs text-muted-foreground">
                            Searching plant inventory database...
                          </p>
                        ) : (stockroomDbQuery.data ?? []).length > 0 ? (
                          (stockroomDbQuery.data ?? []).map((dbPart) => (
                            <div
                              key={dbPart.id}
                              className="flex items-center justify-between gap-3 p-2.5 hover:bg-muted/40 transition-colors"
                            >
                              <div className="min-w-0 flex-1 space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <p className="text-xs font-bold text-foreground truncate">
                                    {dbPart.name}
                                  </p>
                                  {dbPart.part_number && (
                                    <span className="rounded bg-muted px-1.5 py-0.2 font-mono text-[10px] font-semibold text-primary">
                                      P/N: {dbPart.part_number}
                                    </span>
                                  )}
                                  <Badge
                                    variant={dbPart.qty_on_hand > 0 ? "secondary" : "outline"}
                                    className="text-[10px]"
                                  >
                                    {dbPart.qty_on_hand} in stock
                                  </Badge>
                                </div>
                                <p className="text-[11px] text-muted-foreground">
                                  {[
                                    dbPart.manufacturer ? `OEM: ${dbPart.manufacturer}` : null,
                                    dbPart.location ? `Loc: ${dbPart.location}` : null,
                                    dbPart.bin ? `Bin: ${dbPart.bin}` : null,
                                    dbPart.unit_cost != null ? `$${dbPart.unit_cost}/ea` : null,
                                  ]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </p>
                              </div>

                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs font-semibold gap-1 text-primary shrink-0"
                                onClick={() => handleAddFromStockroom(dbPart)}
                              >
                                <Plus className="size-3" /> Add to List
                              </Button>
                            </div>
                          ))
                        ) : (
                          <div className="p-4 text-center text-xs text-muted-foreground">
                            No matching items found in plant stockroom inventory. You can add it as
                            a custom part below.
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Tab 3: Custom Part Manual Entry */}
                  {correctionTab === "custom_add" && (
                    <form onSubmit={handleAddCustomPart} className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <Label className="text-xs">Part Name *</Label>
                          <Input
                            placeholder="e.g. Silicon Carbide Mechanical Seal"
                            value={customName}
                            onChange={(e) => setCustomName(e.target.value)}
                            className="mt-1 h-8 text-xs bg-background"
                            required
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Part Number / OEM Spec</Label>
                          <Input
                            placeholder="e.g. 56C-SEAL-250"
                            value={customPartNumber}
                            onChange={(e) => setCustomPartNumber(e.target.value)}
                            className="mt-1 h-8 text-xs font-mono bg-background"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <div>
                          <Label className="text-xs">Manufacturer</Label>
                          <Input
                            placeholder="e.g. John Crane, SKF, Baldor"
                            value={customMfr}
                            onChange={(e) => setCustomMfr(e.target.value)}
                            className="mt-1 h-8 text-xs bg-background"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Quantity</Label>
                          <Input
                            placeholder="1"
                            value={customQty}
                            onChange={(e) => setCustomQty(e.target.value)}
                            className="mt-1 h-8 text-xs bg-background"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Supplier / Specs (Optional)</Label>
                          <Input
                            placeholder="e.g. Grainger / Motion / 316SS"
                            value={customNotes}
                            onChange={(e) => setCustomNotes(e.target.value)}
                            className="mt-1 h-8 text-xs bg-background"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => setShowCorrectionTools(false)}
                        >
                          Cancel
                        </Button>
                        <Button type="submit" size="sm" className="h-8 text-xs font-bold">
                          <Plus className="size-3.5 mr-1" /> Add Custom Part to List
                        </Button>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {/* Parts Items Table / Cards */}
              <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
                {result.parts.map((part, i) => {
                  const links = getVendorSourcingLinks(
                    part.name,
                    part.part_number,
                    part.manufacturer || effectiveAssetMfr,
                    effectiveAssetName,
                  );
                  const isEditing = editingIndex === i;

                  if (isEditing) {
                    return (
                      <div key={i} className="p-3 bg-muted/30 space-y-2 text-xs">
                        <p className="font-bold text-primary">Edit Part #{i + 1}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <Label className="text-[11px]">Part Name</Label>
                            <Input
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="h-7 text-xs bg-background mt-0.5"
                            />
                          </div>
                          <div>
                            <Label className="text-[11px]">Part Number / Spec</Label>
                            <Input
                              value={editPartNumber}
                              onChange={(e) => setEditPartNumber(e.target.value)}
                              className="h-7 text-xs font-mono bg-background mt-0.5"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div>
                            <Label className="text-[11px]">Manufacturer</Label>
                            <Input
                              value={editMfr}
                              onChange={(e) => setEditMfr(e.target.value)}
                              className="h-7 text-xs bg-background mt-0.5"
                            />
                          </div>
                          <div>
                            <Label className="text-[11px]">Qty</Label>
                            <Input
                              value={editQty}
                              onChange={(e) => setEditQty(e.target.value)}
                              className="h-7 text-xs bg-background mt-0.5"
                            />
                          </div>
                          <div>
                            <Label className="text-[11px]">Source / Supplier</Label>
                            <Input
                              value={editWhereToBuy}
                              onChange={(e) => setEditWhereToBuy(e.target.value)}
                              className="h-7 text-xs bg-background mt-0.5"
                            />
                          </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs"
                            onClick={() => setEditingIndex(null)}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            className="h-7 text-xs font-bold"
                            onClick={() => saveEditingPart(i)}
                          >
                            Save Changes
                          </Button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={i}
                      className={`flex items-start gap-3 p-3.5 transition-colors ${
                        selected[String(i)] ? "bg-primary/[0.02]" : "opacity-60"
                      }`}
                    >
                      <Checkbox
                        checked={!!selected[String(i)]}
                        onCheckedChange={(v) =>
                          setSelected((s) => ({ ...s, [String(i)]: v === true }))
                        }
                        className="mt-1"
                      />

                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-bold text-foreground">{part.name}</p>
                          {part.part_number ? (
                            <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 font-mono text-xs font-bold text-primary">
                              P/N: {part.part_number}
                              <button
                                type="button"
                                className="text-primary/70 hover:text-primary ml-0.5"
                                onClick={() => {
                                  navigator.clipboard.writeText(part.part_number!);
                                  toast.success(`Copied P/N ${part.part_number} to clipboard`);
                                }}
                                title="Copy part number"
                              >
                                <Copy className="size-3" />
                              </button>
                            </span>
                          ) : (
                            <span className="text-xs italic text-muted-foreground">
                              Standard OEM item
                            </span>
                          )}

                          {part.qty && (
                            <Badge variant="outline" className="text-[11px] font-mono">
                              Qty: {part.qty}
                            </Badge>
                          )}
                        </div>

                        <p className="text-xs text-muted-foreground">
                          {[
                            part.manufacturer ? `OEM: ${part.manufacturer}` : null,
                            part.where_to_buy ? `Source: ${part.where_to_buy}` : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>

                        {/* Sourcing Links Bar */}
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 gap-1 px-2 text-[11px] font-semibold text-foreground hover:text-primary"
                              >
                                <Globe className="size-3 text-primary" />
                                1-Click Buy / Quote Links
                                <ChevronDown className="size-2.5 opacity-60" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-56 text-xs">
                              <DropdownMenuLabel className="text-[11px] text-muted-foreground">
                                Industrial Suppliers &amp; Search
                              </DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem asChild>
                                <a
                                  href={links.google}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="cursor-pointer gap-2"
                                >
                                  <Search className="size-3.5 text-primary" /> Google Sourcing
                                  Search
                                </a>
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <a
                                  href={links.grainger}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="cursor-pointer gap-2"
                                >
                                  <ExternalLink className="size-3.5 text-orange-600" /> Grainger
                                  Industrial
                                </a>
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <a
                                  href={links.mcmaster}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="cursor-pointer gap-2"
                                >
                                  <ExternalLink className="size-3.5 text-emerald-600" />{" "}
                                  McMaster-Carr
                                </a>
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <a
                                  href={links.motion}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="cursor-pointer gap-2"
                                >
                                  <ExternalLink className="size-3.5 text-blue-600" /> Motion
                                  Industries
                                </a>
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <a
                                  href={links.fastenal}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="cursor-pointer gap-2"
                                >
                                  <ExternalLink className="size-3.5 text-blue-800" /> Fastenal
                                  Supply
                                </a>
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <a
                                  href={links.amazon}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="cursor-pointer gap-2"
                                >
                                  <ExternalLink className="size-3.5 text-amber-600" /> Amazon
                                  Business
                                </a>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>

                          <a
                            href={links.google}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline font-medium"
                          >
                            Google Search <ExternalLink className="size-2.5" />
                          </a>
                        </div>
                      </div>

                      {/* Row action buttons */}
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-muted-foreground hover:text-foreground"
                          onClick={() => startEditingPart(i, part)}
                          title="Edit part details"
                        >
                          <Edit2 className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => handleDeletePart(i)}
                          title="Remove from list"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}

                {result.parts.length === 0 && (
                  <div className="p-6 text-center text-xs text-muted-foreground space-y-2">
                    <p className="font-medium">No parts in the list.</p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowCorrectionTools(true)}
                      className="gap-1.5"
                    >
                      <Plus className="size-3.5" /> Add custom or stockroom part
                    </Button>
                  </div>
                )}
              </div>

              {/* Sourcing Reference Links */}
              {result.sources.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-[11px] font-semibold text-muted-foreground">
                    AI Search References:
                  </span>
                  {result.sources.map((s, i) => (
                    <a key={i} href={s.url} target="_blank" rel="noopener noreferrer">
                      <Badge variant="outline" className="gap-1 text-[10px] hover:border-primary">
                        {s.title} <ExternalLink className="size-2.5" />
                      </Badge>
                    </a>
                  ))}
                </div>
              )}

              {/* Routing & Order Destination */}
              {!onSelectParts && (
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Send className="size-3.5 text-primary" /> Requisition Routing &amp;
                      Procurement Actions
                    </Label>
                    <Badge variant="outline" className="text-[10px] bg-background font-semibold">
                      Instant Notification
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs font-medium">Route / Send Request To:</Label>
                      <Select value={recipient} onValueChange={setRecipient}>
                        <SelectTrigger className="mt-1 bg-background text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="coordinator" className="text-xs font-medium">
                            🎯 CMMS Coordinator / Procurement Lead
                          </SelectItem>
                          <SelectItem value="supervisor" className="text-xs font-medium">
                            👷 Maintenance / Shift Supervisor
                          </SelectItem>
                          <SelectItem value="supervisors" className="text-xs font-medium">
                            📢 All Supervisors &amp; Buyers
                          </SelectItem>
                          {workOrder && (
                            <SelectItem value="none" className="text-xs font-medium">
                              📝 Just save to Work Order WO-{workOrder.wo_number}
                            </SelectItem>
                          )}
                          {(team.data ?? []).map((m) => (
                            <SelectItem key={m.id} value={m.id} className="text-xs font-medium">
                              👤 {memberLabel(m)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor={`${idPrefix}-needed`} className="text-xs font-medium">
                        Needed By Date
                      </Label>
                      <Input
                        id={`${idPrefix}-needed`}
                        type="date"
                        value={neededBy}
                        onChange={(e) => setNeededBy(e.target.value)}
                        className="mt-1 bg-background text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Bottom Actions Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs gap-1.5"
                    onClick={() => addToInventory.mutate()}
                    disabled={addToInventory.isPending || chosenParts.length === 0}
                    title="Stock these parts in plant inventory database"
                  >
                    <Warehouse className="size-3.5 text-primary" />
                    {addToInventory.isPending ? "Adding…" : "Add to Plant Stockroom"}
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs gap-1.5"
                    onClick={() => {
                      const lines = chosenParts.map((p) => formatPartLine(p)).join("\n");
                      navigator.clipboard.writeText(lines);
                      toast.success(`Copied ${chosenParts.length} parts to clipboard`);
                    }}
                    disabled={chosenParts.length === 0}
                  >
                    <Copy className="size-3.5" /> Copy List
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  {onSelectParts ? (
                    <Button
                      size="sm"
                      onClick={handleApplyToParent}
                      disabled={chosenParts.length === 0}
                      className="font-bold text-xs gap-1.5 shadow-xs"
                    >
                      <Check className="size-3.5" />
                      Attach {chosenParts.length} Part{chosenParts.length === 1 ? "" : "s"} to
                      Requisition Form
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => submitToWorkOrderOrRequisition.mutate()}
                      disabled={
                        submitToWorkOrderOrRequisition.isPending || chosenParts.length === 0
                      }
                      className="font-bold text-xs gap-1.5 shadow-xs"
                    >
                      <Send className="size-3.5" />
                      {submitToWorkOrderOrRequisition.isPending
                        ? "Sending Requisition..."
                        : recipient === "none"
                          ? `Attach ${chosenParts.length} Part${chosenParts.length === 1 ? "" : "s"} to WO`
                          : `Send ${chosenParts.length} Part Requisition`}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

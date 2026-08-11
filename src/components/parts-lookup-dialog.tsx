import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { toast } from "sonner";
import {
  AlertTriangle,
  Boxes,
  ExternalLink,
  PackageSearch,
  Plus,
  RefreshCw,
  Send,
  Trash2,
} from "lucide-react";

type Part = PartsLookupResult["parts"][number];

function googleUrl(part: Part, assetName: string) {
  const q =
    part.search_terms?.trim() ||
    [part.manufacturer, part.part_number, part.name, assetName].filter(Boolean).join(" ");
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}

function vendorUrl(part: Part, manufacturerUrl: string | null) {
  if (!manufacturerUrl) return null;
  try {
    const host = new URL(
      manufacturerUrl.startsWith("http") ? manufacturerUrl : `https://${manufacturerUrl}`,
    ).hostname;
    const q = [part.part_number, part.name].filter(Boolean).join(" ");
    return `https://www.google.com/search?q=${encodeURIComponent(`site:${host} ${q}`)}`;
  } catch {
    return null;
  }
}

function partLine(part: Part) {
  return [
    part.qty ? `${part.qty} ×` : null,
    part.name,
    part.part_number ? `(P/N ${part.part_number})` : null,
    part.manufacturer,
  ]
    .filter(Boolean)
    .join(" ");
}

export function PartsLookupDialog({
  workOrder,
  trigger,
}: {
  workOrder: {
    id: string;
    wo_number: number;
    title: string;
    parts_used: string | null;
    assigned_to: string | null;
    asset: {
      id: string;
      name: string;
      manufacturer: string | null;
      manufacturer_url: string | null;
    } | null;
  };
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [need, setNeed] = useState("");
  const [feedback, setFeedback] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [recipient, setRecipient] = useState<string>("none");
  const [neededBy, setNeededBy] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);

  // Add custom part inline state
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customPartNumber, setCustomPartNumber] = useState("");
  const [customNotes, setCustomNotes] = useState("");

  const [result, setResult] = useState<PartsLookupResult | null>(null);
  const queryClient = useQueryClient();
  const team = useTeamMembers();
  const runLookup = useServerFn(lookupAssetParts);

  const asset = workOrder.asset;

  const lookup = useMutation({
    mutationFn: async (correctionNotes?: string) => {
      if (!asset) throw new Error("Attach an asset to this work order first.");
      return runLookup({
        data: {
          assetId: asset.id,
          need: need.trim() || workOrder.title,
          feedback: correctionNotes || feedback || undefined,
        },
      });
    },
    onSuccess: (data) => {
      setResult(data);
      setSelected(Object.fromEntries(data.parts.map((_, i) => [String(i), true])));
      setShowFeedback(false);
      if (feedback.trim()) {
        toast.success("Parts list updated with your corrections");
      }
    },
    onError: (error: Error) => toast.error(error.message),
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
    toast.success(`Removed "${removedPart?.name || "Part"}" from list`);
  };

  const handleAddCustomPart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) {
      toast.error("Part name is required");
      return;
    }
    const newPart: Part = {
      name: customName.trim(),
      part_number: customPartNumber.trim() || undefined,
      manufacturer: asset?.manufacturer || "OEM",
      qty: "1",
      where_to_buy: customNotes.trim() || undefined,
    };
    const currentParts = result?.parts || [];
    const newParts = [...currentParts, newPart];
    const newResult: PartsLookupResult = {
      notes: result?.notes || `Parts list for ${asset?.name || "equipment"}`,
      parts: newParts,
      sources: result?.sources || [],
    };
    setResult(newResult);
    setSelected((prev) => ({ ...prev, [String(newParts.length - 1)]: true }));
    setIsAddingCustom(false);
    setCustomName("");
    setCustomPartNumber("");
    setCustomNotes("");
    toast.success(`Added "${newPart.name}"`);
  };

  const chosen = (result?.parts ?? []).filter((_, i) => selected[String(i)]);

  const addToInventory = useMutation({
    mutationFn: async () => {
      if (chosen.length === 0) throw new Error("Select at least one part.");
      for (const p of chosen) {
        await upsertPartAndLink({
          name: p.name,
          part_number: p.part_number ?? null,
          manufacturer: p.manufacturer ?? null,
          where_to_buy: p.where_to_buy ?? null,
          assetId: asset?.id ?? null,
        });
      }
    },
    onSuccess: () => {
      toast.success(
        asset
          ? `${chosen.length} part${chosen.length === 1 ? "" : "s"} in inventory, linked to ${asset.name}`
          : "Parts added to inventory",
      );
      queryClient.invalidateQueries({ queryKey: ["parts"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const submit = useMutation({
    mutationFn: async () => {
      if (chosen.length === 0) throw new Error("Select at least one part.");
      const lines = chosen.map((p) => `• ${partLine(p)}`).join("\n");
      const next = [workOrder.parts_used?.trim(), `Parts needed:\n${lines}`]
        .filter(Boolean)
        .join("\n\n");
      const { error } = await supabase
        .from("work_orders")
        .update({ parts_used: next })
        .eq("id", workOrder.id);
      if (error) throw error;

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
          title: `WO-${workOrder.wo_number} — ${workOrder.title}`,
          partLines: lines,
          note: asset
            ? `Asset: ${asset.name}${recipient === "coordinator" ? " [Routed to CMMS Coordinator]" : recipient === "supervisor" ? " [Routed to Supervisor]" : ""}`
            : null,
          neededBy: neededBy || null,
          routeTo,
          sentTo,
          workOrderId: workOrder.id,
          assetId: asset?.id ?? null,
          photos,
        });
      }
    },
    onSuccess: () => {
      toast.success(
        recipient === "none"
          ? "Parts attached to the work order"
          : recipient === "coordinator"
            ? "Parts request sent to CMMS Coordinator / Procurement Lead"
            : recipient === "supervisor"
              ? "Parts request sent to Maintenance Supervisor"
              : recipient === "supervisors"
                ? "Sent to all supervisors and CMMS buyers to order or bid out"
                : "Parts attached and request sent to teammate",
      );
      queryClient.invalidateQueries({ queryKey: ["work-orders"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["part-requests"] });
      setOpen(false);
      setResult(null);
      setPhotos([]);
      setNeededBy("");
      setFeedback("");
      setShowFeedback(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm">
            <PackageSearch className="size-4" /> Parts
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Parts lookup — WO-{workOrder.wo_number}</DialogTitle>
          <DialogDescription>
            {asset
              ? `Find replacement parts for ${asset.name}, remove incorrect items, or send the list to whoever orders parts.`
              : "This work order has no asset attached, so parts can't be looked up."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="need">What's needed?</Label>
          <div className="flex gap-2">
            <Input
              id="need"
              placeholder={workOrder.title}
              value={need}
              onChange={(e) => setNeed(e.target.value)}
            />
            <Button onClick={() => lookup.mutate(undefined)} disabled={!asset || lookup.isPending}>
              {lookup.isPending ? "Searching…" : "Look up parts"}
            </Button>
          </div>
        </div>

        {result && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              {result.notes && (
                <p className="text-xs text-muted-foreground flex-1">{result.notes}</p>
              )}
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => setIsAddingCustom(!isAddingCustom)}
                >
                  <Plus className="size-3" /> Add part
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                  onClick={() => setShowFeedback(!showFeedback)}
                >
                  <AlertTriangle className="size-3" />
                  {showFeedback ? "Hide correction" : "Not the right parts?"}
                </Button>
              </div>
            </div>

            {showFeedback && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 space-y-2 text-xs">
                <p className="font-semibold text-amber-900 dark:text-amber-200">
                  Tell the program what parts are needed or what's different:
                </p>
                <Input
                  placeholder="e.g. This is the 2.5 inch shaft variant with mechanical packing, not mechanical seal"
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  className="h-8 text-xs bg-background"
                />
                <div className="flex justify-end gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => setShowFeedback(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 text-xs gap-1"
                    disabled={lookup.isPending || !feedback.trim()}
                    onClick={() => lookup.mutate(feedback)}
                  >
                    <RefreshCw className={`size-3 ${lookup.isPending ? "animate-spin" : ""}`} />
                    {lookup.isPending ? "Searching…" : "Re-search with corrections"}
                  </Button>
                </div>
              </div>
            )}

            {isAddingCustom && (
              <form
                onSubmit={handleAddCustomPart}
                className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2 text-xs"
              >
                <p className="font-bold text-primary">Add Custom Part</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <Label className="text-xs">Part Name *</Label>
                    <Input
                      placeholder="e.g. Replacement Impeller"
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      className="h-8 text-xs mt-1"
                      required
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Part Number / OEM Spec</Label>
                    <Input
                      placeholder="e.g. IMP-4890-SS"
                      value={customPartNumber}
                      onChange={(e) => setCustomPartNumber(e.target.value)}
                      className="h-8 text-xs font-mono mt-1"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Supplier / Specs (Optional)</Label>
                  <Input
                    placeholder="e.g. Grainger / Motion Industries / 316 Stainless"
                    value={customNotes}
                    onChange={(e) => setCustomNotes(e.target.value)}
                    className="h-8 text-xs mt-1"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setIsAddingCustom(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" className="h-7 text-xs">
                    Add Part to List
                  </Button>
                </div>
              </form>
            )}

            <div className="panel divide-y divide-border">
              {result.parts.map((part, i) => {
                const vendor = vendorUrl(part, asset?.manufacturer_url ?? null);
                return (
                  <div key={i} className="flex items-start gap-3 p-3">
                    <Checkbox
                      checked={!!selected[String(i)]}
                      onCheckedChange={(v) =>
                        setSelected((s) => ({ ...s, [String(i)]: v === true }))
                      }
                      className="mt-1"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{part.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {[
                          part.part_number ? `P/N ${part.part_number}` : null,
                          part.manufacturer,
                          part.qty,
                          part.where_to_buy,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-3 text-xs">
                        <a
                          href={googleUrl(part, asset?.name ?? "")}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          Google <ExternalLink className="size-3" />
                        </a>
                        {vendor && (
                          <a
                            href={vendor}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                          >
                            Manufacturer site <ExternalLink className="size-3" />
                          </a>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive shrink-0"
                      onClick={() => handleDeletePart(i)}
                      title="Delete / remove this part (not right for this asset)"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                );
              })}
              {result.parts.length === 0 && (
                <p className="p-3 text-sm text-muted-foreground">
                  No parts in this list. Click "Add part" or refine your search above.
                </p>
              )}
            </div>

            {result.sources.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {result.sources.map((s, i) => (
                  <a key={i} href={s.url} target="_blank" rel="noopener noreferrer">
                    <Badge variant="outline" className="gap-1">
                      {s.title} <ExternalLink className="size-3" />
                    </Badge>
                  </a>
                ))}
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Send request to</Label>
                <Select value={recipient} onValueChange={setRecipient}>
                  <SelectTrigger>
                    <SelectValue placeholder="Nobody — just save to WO" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Just save to work order</SelectItem>
                    <SelectItem value="coordinator">
                      🎯 CMMS Coordinator / Procurement Lead
                    </SelectItem>
                    <SelectItem value="supervisor">👷 Maintenance / Shift Supervisor</SelectItem>
                    <SelectItem value="supervisors">
                      📢 All Supervisors &amp; CMMS Buyers
                    </SelectItem>
                    {(team.data ?? []).map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        👤 {memberLabel(m)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="needed-by">Needed by</Label>
                <Input
                  id="needed-by"
                  type="date"
                  value={neededBy}
                  onChange={(e) => setNeededBy(e.target.value)}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="request-photos">Photos to send with the request</Label>
                <Input
                  id="request-photos"
                  type="file"
                  accept="image/*"
                  multiple
                  capture="environment"
                  onChange={(e) => setPhotos(Array.from(e.target.files ?? []))}
                />
                {photos.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {photos.length} photo{photos.length === 1 ? "" : "s"} will be attached to the
                    notification.
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-end justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => addToInventory.mutate()}
                disabled={addToInventory.isPending || chosen.length === 0}
              >
                <Boxes className="size-4" />
                {addToInventory.isPending ? "Adding…" : "Add to inventory"}
              </Button>
              <Button
                onClick={() => submit.mutate()}
                disabled={submit.isPending || chosen.length === 0}
              >
                <Send className="size-4" />
                {submit.isPending
                  ? "Sending…"
                  : recipient === "none"
                    ? `Attach ${chosen.length} part${chosen.length === 1 ? "" : "s"} to WO`
                    : `Attach & send ${chosen.length} part${chosen.length === 1 ? "" : "s"}`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

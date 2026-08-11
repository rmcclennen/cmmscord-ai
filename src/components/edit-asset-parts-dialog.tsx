import type { Json } from "@/integrations/supabase/types";
import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { researchAssetMaintenance, updateAssetMaintenanceParts } from "@/lib/maintenance.functions";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  AlertTriangle,
  Check,
  Edit2,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

export interface StoredPart {
  name: string;
  part_number?: string | undefined;
  notes?: string | undefined;
  manufacturer?: string | undefined;
  qty?: string | undefined;
  where_to_buy?: string | undefined;
}

interface EditAssetPartsDialogProps {
  assetId: string;
  assetName: string;
  manufacturer?: string | null | undefined;
  model?: string | null | undefined;
  currentParts: StoredPart[];
  trigger?: React.ReactNode | undefined;
  defaultTab?: "manage" | "feedback" | undefined;
}

const COMMON_FEEDBACK_PRESETS = [
  "Uses mechanical packing instead of mechanical seal",
  "Different shaft diameter / frame size",
  "Motor was upgraded / replaced with different HP",
  "Different model year / generation",
  "Requires VFD / Inverter-duty parts",
  "Stainless steel / abrasive slurry trim needed",
];

export function EditAssetPartsDialog({
  assetId,
  assetName,
  manufacturer,
  model,
  currentParts = [],
  trigger,
  defaultTab = "manage",
}: EditAssetPartsDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<"manage" | "feedback">(defaultTab);
  const [partsList, setPartsList] = React.useState<StoredPart[]>(currentParts);
  const [editingIndex, setEditingIndex] = React.useState<number | null>(null);
  const [editName, setEditName] = React.useState("");
  const [editPartNumber, setEditPartNumber] = React.useState("");
  const [editNotes, setEditNotes] = React.useState("");

  // New part state
  const [isAddingPart, setIsAddingPart] = React.useState(false);
  const [newName, setNewName] = React.useState("");
  const [newPartNumber, setNewPartNumber] = React.useState("");
  const [newNotes, setNewNotes] = React.useState("");

  // Feedback state
  const [feedbackText, setFeedbackText] = React.useState("");
  const [confirmClearOpen, setConfirmClearOpen] = React.useState(false);

  const queryClient = useQueryClient();
  const runResearch = useServerFn(researchAssetMaintenance);
  const savePartsFn = useServerFn(updateAssetMaintenanceParts);

  React.useEffect(() => {
    setPartsList(currentParts || []);
  }, [currentParts, open]);

  // Mutation to persist parts list
  const savePartsMutation = useMutation({
    mutationFn: async (updated: StoredPart[]) => {
      try {
        await savePartsFn({ data: { assetId, parts: updated } });
      } catch (e) {
        console.warn("Server update failed, saving directly via Supabase client:", e);
        const { data: existing } = await supabase
          .from("asset_maintenance_info")
          .select("id")
          .eq("asset_id", assetId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existing) {
          const { error } = await supabase
            .from("asset_maintenance_info")
            .update({ parts: updated as unknown as Json })
            .eq("id", existing.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("asset_maintenance_info").insert({
            asset_id: assetId,
            summary: "Parts list customized by operator.",
            intervals: [],
            parts: updated as unknown as Json,
            sources: [],
          });
          if (error) throw error;
        }
      }
      return updated;
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["asset-info", assetId] });
      setPartsList(updated);
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to update parts");
    },
  });

  // Mutation to re-research parts with feedback
  const researchMutation = useMutation({
    mutationFn: async (feedback: string) => {
      return await runResearch({ data: { assetId, feedback } });
    },
    onSuccess: () => {
      toast.success("New parts & maintenance program generated from your corrections");
      queryClient.invalidateQueries({ queryKey: ["asset-info", assetId] });
      setOpen(false);
      setFeedbackText("");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to re-research parts");
    },
  });

  const handleDeletePart = (index: number) => {
    const partToDelete = partsList[index];
    const updated = partsList.filter((_, idx) => idx !== index);
    setPartsList(updated);
    savePartsMutation.mutate(updated, {
      onSuccess: () => {
        toast.success(`Removed "${partToDelete?.name || "Part"}" from asset records`);
      },
    });
  };

  const handleStartEdit = (index: number) => {
    const p = partsList[index];
    if (!p) return;
    setEditingIndex(index);
    setEditName(p.name);
    setEditPartNumber(p.part_number || "");
    setEditNotes(p.notes || "");
  };

  const handleSaveEdit = (index: number) => {
    if (!editName.trim()) {
      toast.error("Part name is required");
      return;
    }
    const updated = [...partsList];
    updated[index] = {
      ...updated[index],
      name: editName.trim(),
      part_number: editPartNumber.trim() || undefined,
      notes: editNotes.trim() || undefined,
    };
    setEditingIndex(null);
    setPartsList(updated);
    savePartsMutation.mutate(updated, {
      onSuccess: () => {
        toast.success("Part details updated");
      },
    });
  };

  const handleAddCustomPart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      toast.error("Please enter a part name");
      return;
    }
    const newPart: StoredPart = {
      name: newName.trim(),
      part_number: newPartNumber.trim() || undefined,
      notes: newNotes.trim() || undefined,
      manufacturer: manufacturer || "OEM",
      qty: "1",
    };
    const updated = [...partsList, newPart];
    setPartsList(updated);
    setIsAddingPart(false);
    setNewName("");
    setNewPartNumber("");
    setNewNotes("");
    savePartsMutation.mutate(updated, {
      onSuccess: () => {
        toast.success(`Added "${newPart.name}" to asset parts`);
      },
    });
  };

  const handleClearAllParts = () => {
    setConfirmClearOpen(false);
    savePartsMutation.mutate([], {
      onSuccess: () => {
        toast.success("Cleared all parts for this asset");
      },
    });
  };

  const handlePresetClick = (preset: string) => {
    setFeedbackText((prev) => (prev ? `${prev}. ${preset}` : preset));
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (v) {
            setActiveTab(defaultTab);
            setPartsList(currentParts || []);
          }
        }}
      >
        <DialogTrigger asChild>
          {trigger ?? (
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <AlertTriangle className="size-3.5 text-amber-600" />
              Not the right parts?
            </Button>
          )}
        </DialogTrigger>

        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="size-4" />
              </div>
              <div>
                <DialogTitle>Correct or Remove Asset Parts</DialogTitle>
                <DialogDescription>
                  {assetName} {manufacturer ? `· ${manufacturer}` : ""} {model ? `(${model})` : ""}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as "manage" | "feedback")}
            className="mt-2"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="manage" className="text-xs sm:text-sm">
                Delete &amp; Edit Parts ({partsList.length})
              </TabsTrigger>
              <TabsTrigger value="feedback" className="gap-1 text-xs sm:text-sm">
                <Sparkles className="size-3.5 text-amber-500" />
                Tell Program &amp; Re-lookup
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: MANAGE, EDIT, DELETE, ADD PARTS */}
            <TabsContent value="manage" className="space-y-4 pt-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                <p>
                  Remove parts that do not apply to this equipment, edit part numbers, or add custom
                  replacement parts directly.
                </p>
              </div>

              {/* Current parts list */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Current Wear &amp; Spare Parts
                  </span>
                  <div className="flex items-center gap-2">
                    {partsList.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-destructive hover:bg-destructive/10"
                        onClick={() => setConfirmClearOpen(true)}
                        disabled={savePartsMutation.isPending}
                      >
                        <Trash2 className="size-3 mr-1" /> Clear all
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={() => setIsAddingPart(!isAddingPart)}
                    >
                      <Plus className="size-3" /> Add part
                    </Button>
                  </div>
                </div>

                {isAddingPart && (
                  <form
                    onSubmit={handleAddCustomPart}
                    className="rounded-lg border border-primary/40 bg-primary/5 p-3 space-y-3"
                  >
                    <div className="text-xs font-bold text-primary flex items-center gap-1.5">
                      <Plus className="size-3.5" /> Add Correct Replacement Part
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label htmlFor="new-part-name" className="text-xs">
                          Part Name *
                        </Label>
                        <Input
                          id="new-part-name"
                          placeholder="e.g. 2.5 inch Mechanical Seal Kit"
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          className="h-8 text-xs"
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="new-part-no" className="text-xs">
                          Part Number / OEM Spec
                        </Label>
                        <Input
                          id="new-part-no"
                          placeholder="e.g. 105-3498-A"
                          value={newPartNumber}
                          onChange={(e) => setNewPartNumber(e.target.value)}
                          className="h-8 text-xs font-mono"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="new-notes" className="text-xs">
                        Specs / Notes (Optional)
                      </Label>
                      <Input
                        id="new-notes"
                        placeholder="e.g. Silicon carbide faces, Viton elastomers"
                        value={newNotes}
                        onChange={(e) => setNewNotes(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setIsAddingPart(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        size="sm"
                        className="h-7 text-xs"
                        disabled={savePartsMutation.isPending}
                      >
                        Save Part
                      </Button>
                    </div>
                  </form>
                )}

                {partsList.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    <p>No parts stored for this asset.</p>
                    <p className="mt-1 text-xs">
                      Add custom parts manually or use the "Tell Program &amp; Re-lookup" tab to
                      research correct parts.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-border rounded-lg border border-border bg-card">
                    {partsList.map((part, index) => {
                      const isEditing = editingIndex === index;
                      return (
                        <div key={index} className="p-3">
                          {isEditing ? (
                            <div className="space-y-2">
                              <div className="grid gap-2 sm:grid-cols-2">
                                <div>
                                  <Label className="text-xs">Part Name</Label>
                                  <Input
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    className="h-8 text-xs mt-1"
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs">Part Number</Label>
                                  <Input
                                    value={editPartNumber}
                                    onChange={(e) => setEditPartNumber(e.target.value)}
                                    className="h-8 text-xs font-mono mt-1"
                                  />
                                </div>
                              </div>
                              <div>
                                <Label className="text-xs">Notes / Specs</Label>
                                <Input
                                  value={editNotes}
                                  onChange={(e) => setEditNotes(e.target.value)}
                                  className="h-8 text-xs mt-1"
                                />
                              </div>
                              <div className="flex justify-end gap-2 pt-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() => setEditingIndex(null)}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() => handleSaveEdit(index)}
                                  disabled={savePartsMutation.isPending}
                                >
                                  <Check className="size-3 mr-1" /> Save
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-foreground">{part.name}</p>
                                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                  {part.part_number ? (
                                    <span className="font-mono text-primary font-medium">
                                      P/N: {part.part_number}
                                    </span>
                                  ) : (
                                    <span className="italic">No part number specified</span>
                                  )}
                                  {part.notes && <span>· {part.notes}</span>}
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-7 text-muted-foreground hover:text-foreground"
                                  onClick={() => handleStartEdit(index)}
                                  title="Edit part details"
                                >
                                  <Pencil className="size-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                  onClick={() => handleDeletePart(index)}
                                  title="Delete part (not right for this asset)"
                                  disabled={savePartsMutation.isPending}
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* TAB 2: TELL PROGRAM WHAT'S WRONG & RE-LOOKUP */}
            <TabsContent value="feedback" className="space-y-4 pt-3">
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200 space-y-1">
                <p className="font-semibold flex items-center gap-1.5">
                  <Sparkles className="size-4 text-amber-600 dark:text-amber-400" />
                  Teach the program about this specific asset
                </p>
                <p className="text-muted-foreground">
                  Provide field details (e.g. modified specs, exact sub-model, shaft size,
                  electrical ratings, or seal types). The research engine will update the asset's
                  wear parts and intervals according to your field specifications.
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold">
                  Common Plant Modifications &amp; Specs
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {COMMON_FEEDBACK_PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handlePresetClick(preset)}
                      className="rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs text-foreground transition-colors hover:bg-primary/10 hover:border-primary/50 text-left"
                    >
                      + {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="feedback-text" className="text-xs font-semibold">
                  What is incorrect or what are the exact specs?
                </Label>
                <Textarea
                  id="feedback-text"
                  placeholder="e.g. This pump was retrofitted with John Crane Type 21 seal instead of packing. Frame is 256T, 20 HP 460V."
                  rows={4}
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setOpen(false)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => researchMutation.mutate(feedbackText)}
                  disabled={researchMutation.isPending || !feedbackText.trim()}
                  className="gap-1.5 text-xs font-semibold"
                >
                  <RefreshCw
                    className={`size-3.5 ${researchMutation.isPending ? "animate-spin" : ""}`}
                  />
                  {researchMutation.isPending ? "Re-researching…" : "Re-research with My Notes"}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Confirmation to clear all parts */}
      <AlertDialog open={confirmClearOpen} onOpenChange={setConfirmClearOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete all parts for this asset?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove all {partsList.length} wear and spare parts from {assetName}'s
              records. You can add new parts or run a re-lookup at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearAllParts}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete All Parts
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

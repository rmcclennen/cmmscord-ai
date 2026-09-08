import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  scanManualForPms,
  addScannedPmsToSchedule,
  type ScannedPmTask,
} from "@/lib/manuals.functions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Sparkles,
  Zap,
  CheckCircle2,
  Calendar,
  Clock,
  ShieldAlert,
  Loader2,
  BookOpen,
  FileText,
  CheckSquare,
  Square,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

export interface ScanManualDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assetId?: string | undefined;
  assetName?: string | undefined;
  manualId?: string | undefined;
  manualTitle?: string | undefined;
  manualUrl?: string | undefined;
}

export function ScanManualDialog({
  open,
  onOpenChange,
  assetId,
  assetName = "Equipment Asset",
  manualId,
  manualTitle = "",
  manualUrl = "",
}: ScanManualDialogProps) {
  const queryClient = useQueryClient();
  const scanFn = useServerFn(scanManualForPms);
  const addScheduleFn = useServerFn(addScannedPmsToSchedule);

  const [pastedText, setPastedText] = useState("");
  const [showPasteText, setShowPasteText] = useState(false);
  const [results, setResults] = useState<ScannedPmTask[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const effectiveTitle = manualTitle || `${assetName} O&M Manual`;

  const scanMutation = useMutation({
    mutationFn: async () => {
      if (!assetId) throw new Error("Please select an asset to scan manuals for.");
      return await scanFn({
        data: {
          assetId,
          manualId,
          manualTitle: effectiveTitle,
          manualUrl,
          manualText: pastedText.trim() || undefined,
        },
      });
    },
    onSuccess: (data) => {
      setResults(data.pms);
      setSelectedIds(new Set(data.pms.map((p) => p.id)));
      toast.success(
        `AI generated ${data.pms.length} manufacturer PM schedules from ${data.manualTitle}!`,
      );
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to scan manual for PMs");
    },
  });

  const addToScheduleMutation = useMutation({
    mutationFn: async () => {
      if (!assetId) throw new Error("No asset selected");
      const selectedPms = results.filter((p) => selectedIds.has(p.id));
      if (selectedPms.length === 0) {
        throw new Error("Select at least one PM task to add to the schedule.");
      }

      return await addScheduleFn({
        data: {
          assetId,
          pms: selectedPms.map((p) => ({
            task: p.task,
            frequency: p.frequency,
            interval_days: p.interval_days,
            priority: p.priority,
            instructions: p.instructions,
            estimated_hours: p.estimated_hours,
            category: p.category,
          })),
        },
      });
    },
    onSuccess: (res) => {
      toast.success(`Successfully added ${res.count} PM schedules to ${assetName}!`);
      queryClient.invalidateQueries({ queryKey: ["asset", assetId] });
      queryClient.invalidateQueries({ queryKey: ["pms"] });
      queryClient.invalidateQueries({ queryKey: ["pm_schedules"] });
      queryClient.invalidateQueries({ queryKey: ["active-pm-schedules"] });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to add PMs to schedule");
    },
  });

  // Auto-scan on open if no results yet
  useEffect(() => {
    if (open && results.length === 0 && assetId && !scanMutation.isPending) {
      scanMutation.mutate();
    }
  }, [open, assetId]);

  // Reset state when closed
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setPastedText("");
      setShowPasteText(false);
      setResults([]);
      setSelectedIds(new Set());
    }
    onOpenChange(newOpen);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === results.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(results.map((r) => r.id)));
    }
  };

  const categoryColor = (cat: string) => {
    switch (cat.toLowerCase()) {
      case "lubrication":
        return "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30";
      case "mechanical seal":
        return "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30";
      case "electrical / motor":
        return "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30";
      case "vibration / alignment":
        return "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30";
      default:
        return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        id="scan-manual-pms-dialog"
        className="max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden"
      >
        {/* Header */}
        <div className="p-5 border-b bg-gradient-to-r from-amber-500/10 via-card to-primary/10">
          <DialogHeader className="space-y-1 text-left">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                <Zap className="size-4" />
              </span>
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                Scan Manual for PM Schedules
                <Badge
                  variant="outline"
                  className="text-xs bg-amber-500/10 border-amber-500/30 text-amber-600"
                >
                  <Sparkles className="size-3 mr-1" />
                  AI Powered
                </Badge>
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              Extract manufacturer-recommended maintenance schedules, lubrication specs, and
              inspection intervals for <strong className="text-foreground">{assetName}</strong>.
            </DialogDescription>
          </DialogHeader>

          {/* Target Reference Info */}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs bg-card/80 border rounded-lg p-2.5">
            <div className="flex items-center gap-1.5 font-medium truncate max-w-md">
              <BookOpen className="size-3.5 text-primary shrink-0" />
              <span className="truncate">{effectiveTitle}</span>
            </div>
            {manualUrl && (
              <a
                href={manualUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline ml-auto"
              >
                <ExternalLink className="size-3" />
                View Manual
              </a>
            )}
          </div>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Optional: Manual Text Paste toggle */}
          <div className="border rounded-lg p-3 bg-muted/20 space-y-2">
            <div className="flex items-center justify-between">
              <Label
                className="text-xs font-medium flex items-center gap-1.5 cursor-pointer"
                onClick={() => setShowPasteText(!showPasteText)}
              >
                <FileText className="size-3.5 text-muted-foreground" />
                {showPasteText
                  ? "Hide Manual Text Excerpt"
                  : "Paste Manual Excerpt or Lubrication Table (Optional)"}
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 text-xs px-2"
                onClick={() => setShowPasteText(!showPasteText)}
              >
                {showPasteText ? "Close" : "Expand"}
              </Button>
            </div>

            {showPasteText && (
              <div className="space-y-2 pt-1">
                <Textarea
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  placeholder="Paste relevant pages, maintenance checklists, or lubrication tables from the O&M manual PDF here..."
                  className="min-h-[100px] text-xs font-mono resize-y"
                />
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    onClick={() => scanMutation.mutate()}
                    disabled={scanMutation.isPending}
                    className="gap-1.5 text-xs h-7"
                  >
                    <Sparkles className="size-3" />
                    Re-scan with Excerpt
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Loading State */}
          {scanMutation.isPending && (
            <div className="py-12 text-center space-y-3">
              <div className="relative mx-auto size-12 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-ping" />
                <Loader2 className="size-8 text-primary animate-spin" />
              </div>
              <div>
                <p className="font-semibold text-sm">
                  AI Scanning Manual & Manufacturer PM Intervals…
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Analyzing lubrication schedules, mechanical seal inspections, and motor checks for{" "}
                  {assetName}.
                </p>
              </div>
            </div>
          )}

          {/* Empty / Initial State */}
          {!scanMutation.isPending && results.length === 0 && (
            <div className="py-8 text-center space-y-3 border border-dashed rounded-lg">
              <AlertCircle className="size-8 text-muted-foreground mx-auto" />
              <div className="space-y-1">
                <p className="text-sm font-medium">Ready to Scan Manual</p>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Click below to generate preventive maintenance tasks, frequencies, and tolerances
                  using AI.
                </p>
              </div>
              <Button size="sm" onClick={() => scanMutation.mutate()} className="gap-1.5">
                <Sparkles className="size-3.5" />
                Run AI PM Scan
              </Button>
            </div>
          )}

          {/* Results List */}
          {!scanMutation.isPending && results.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-1">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={toggleAll}
                    className="h-7 text-xs px-2 gap-1.5 font-medium"
                  >
                    {selectedIds.size === results.length ? (
                      <>
                        <Square className="size-3.5" />
                        Deselect All
                      </>
                    ) : (
                      <>
                        <CheckSquare className="size-3.5" />
                        Select All ({results.length})
                      </>
                    )}
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    • {selectedIds.size} of {results.length} tasks selected
                  </span>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => scanMutation.mutate()}
                  className="h-7 text-xs gap-1"
                >
                  <Sparkles className="size-3 text-primary" />
                  Re-Scan
                </Button>
              </div>

              <div className="space-y-2.5">
                {results.map((pm) => {
                  const isSelected = selectedIds.has(pm.id);
                  return (
                    <div
                      key={pm.id}
                      onClick={() => toggleSelect(pm.id)}
                      className={`p-3 rounded-lg border transition-all cursor-pointer ${
                        isSelected
                          ? "bg-primary/5 border-primary/40 shadow-xs"
                          : "bg-card/60 border-border opacity-70 hover:opacity-100"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelect(pm.id)}
                          className="mt-0.5"
                          id={`pm-check-${pm.id}`}
                        />
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2 justify-between">
                            <h4 className="text-xs font-semibold text-foreground leading-snug">
                              {pm.task}
                            </h4>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <Badge
                                variant="outline"
                                className={`text-[10px] px-1.5 py-0 ${categoryColor(pm.category)}`}
                              >
                                {pm.category}
                              </Badge>
                              <Badge
                                variant="secondary"
                                className="text-[10px] px-1.5 py-0 gap-1 font-mono"
                              >
                                <Calendar className="size-2.5" />
                                {pm.frequency} ({pm.interval_days}d)
                              </Badge>
                              {pm.estimated_hours && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] px-1.5 py-0 gap-1 text-muted-foreground"
                                >
                                  <Clock className="size-2.5" />
                                  {pm.estimated_hours}h
                                </Badge>
                              )}
                            </div>
                          </div>

                          {pm.instructions && (
                            <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
                              {pm.instructions}
                            </p>
                          )}

                          {pm.safety_notes && (
                            <div className="flex items-start gap-1.5 text-[11px] text-amber-600 dark:text-amber-400 bg-amber-500/10 p-1.5 rounded border border-amber-500/20">
                              <ShieldAlert className="size-3.5 shrink-0 mt-0.5" />
                              <span>{pm.safety_notes}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <DialogFooter className="p-4 border-t bg-muted/10 flex items-center justify-between sm:justify-between">
          <Button type="button" variant="ghost" size="sm" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>

          <Button
            type="button"
            size="sm"
            disabled={selectedIds.size === 0 || addToScheduleMutation.isPending}
            onClick={() => addToScheduleMutation.mutate()}
            className="gap-1.5 font-semibold bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {addToScheduleMutation.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Adding to Schedule…
              </>
            ) : (
              <>
                <CheckCircle2 className="size-4" />
                Add {selectedIds.size} PM{selectedIds.size === 1 ? "" : "s"} to Schedule
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

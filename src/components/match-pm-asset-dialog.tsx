import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  batchMatchPmsToAssets,
  findMatchingPmsForAsset,
  MatchableAsset,
  MatchablePm,
  PmAssetMatch,
} from "@/lib/pm-matcher";
import { toast } from "sonner";
import {
  ArrowRight,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  HelpCircle,
  Layers,
  Link as LinkIcon,
  RefreshCw,
  Search,
  Sparkles,
  Tag,
  Wrench,
  Zap,
} from "lucide-react";

export interface MatchPmAssetDialogProps {
  /** If provided, runs in Asset-focused mode for this specific asset */
  targetAsset?: MatchableAsset | null;
  /** Custom trigger button or element */
  trigger?: React.ReactNode;
  /** Controlled open state */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Callback after PMs are successfully linked */
  onMatched?: () => void;
}

export function MatchPmAssetDialog({
  targetAsset,
  trigger,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
  onMatched,
}: MatchPmAssetDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;
  const setIsOpen = (val: boolean) => {
    if (isControlled) {
      setControlledOpen?.(val);
    } else {
      setInternalOpen(val);
    }
  };

  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<string>(
    targetAsset ? "asset-matches" : "smart-matches",
  );
  const [searchFilter, setSearchFilter] = useState("");
  const [confidenceFilter, setConfidenceFilter] = useState<string>("all");
  const [selectedMatchIds, setSelectedMatchIds] = useState<Set<string>>(new Set());
  const [assetOverrides, setAssetOverrides] = useState<Record<string, string>>({});

  // Fetch all active PM schedules
  const pmsQuery = useQuery({
    queryKey: ["all-pms-for-matching"],
    enabled: isOpen,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pm_schedules")
        .select(
          "id, title, tasks, asset_id, interval_days, priority, next_due, active, assets(id, name, tag_number, building, class, location_name)",
        )
        .order("title");
      if (error) throw error;
      return (data ?? []) as MatchablePm[];
    },
  });

  // Fetch all Assets
  const assetsQuery = useQuery({
    queryKey: ["all-assets-for-matching"],
    enabled: isOpen,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assets")
        .select(
          "id, name, tag_number, building, class, location_name, manufacturer, model, serial_number",
        )
        .order("name");
      if (error) throw error;
      return (data ?? []) as MatchableAsset[];
    },
  });

  const pms = useMemo(() => pmsQuery.data ?? [], [pmsQuery.data]);
  const assets = useMemo(() => assetsQuery.data ?? [], [assetsQuery.data]);

  // Asset lookup map
  const assetMap = useMemo(() => {
    const map = new Map<string, MatchableAsset>();
    for (const a of assets) {
      map.set(a.id, a);
    }
    return map;
  }, [assets]);

  // Compute Smart Batch Matches for all PMs
  const allSmartMatches = useMemo(() => {
    if (!isOpen || pms.length === 0 || assets.length === 0) return [];
    return batchMatchPmsToAssets(pms, assets, { unlinkedOnly: false, minConfidence: "low" });
  }, [isOpen, pms, assets]);

  // Filter smart matches
  const filteredSmartMatches = useMemo(() => {
    return allSmartMatches.filter((m) => {
      if (confidenceFilter !== "all" && m.confidence !== confidenceFilter) return false;
      if (searchFilter.trim()) {
        const q = searchFilter.toLowerCase();
        const titleMatch = m.pmTitle.toLowerCase().includes(q);
        const assetMatch = m.suggestedAssetName.toLowerCase().includes(q);
        const tagMatch = m.suggestedAssetTag?.toLowerCase().includes(q);
        const reasonMatch = m.reason.toLowerCase().includes(q);
        if (!titleMatch && !assetMatch && !tagMatch && !reasonMatch) return false;
      }
      return true;
    });
  }, [allSmartMatches, confidenceFilter, searchFilter]);

  // Unlinked PMs
  const unlinkedPms = useMemo(() => {
    return pms.filter((p) => !p.asset_id);
  }, [pms]);

  // Filtered Unlinked PMs
  const filteredUnlinkedPms = useMemo(() => {
    if (!searchFilter.trim()) return unlinkedPms;
    const q = searchFilter.toLowerCase();
    return unlinkedPms.filter(
      (p) => p.title.toLowerCase().includes(q) || (p.tasks && p.tasks.toLowerCase().includes(q)),
    );
  }, [unlinkedPms, searchFilter]);

  // Matches for specific target asset (if in targetAsset mode)
  const targetAssetMatches = useMemo(() => {
    if (!targetAsset || pms.length === 0) return [];
    return findMatchingPmsForAsset(targetAsset, pms);
  }, [targetAsset, pms]);

  // Mutation to link PMs to Assets
  const linkMutation = useMutation({
    mutationFn: async (links: Array<{ pmId: string; assetId: string }>) => {
      if (links.length === 0) return;

      const promises = links.map(({ pmId, assetId }) =>
        supabase
          .from("pm_schedules")
          .update({
            asset_id: assetId,
            updated_at: new Date().toISOString(),
          })
          .eq("id", pmId),
      );

      const results = await Promise.all(promises);
      const errors = results.filter((r) => r.error);
      if (errors.length > 0) {
        throw new Error(errors[0].error?.message || "Failed to link some PM schedules.");
      }
    },
    onSuccess: (_, variables) => {
      toast.success(
        `Successfully linked ${variables.length} PM schedule${variables.length > 1 ? "s" : ""} to asset${variables.length > 1 ? "s" : ""}!`,
      );
      queryClient.invalidateQueries({ queryKey: ["pms"] });
      queryClient.invalidateQueries({ queryKey: ["all-pms-for-matching"] });
      queryClient.invalidateQueries({ queryKey: ["pm-schedules"] });
      queryClient.invalidateQueries({ queryKey: ["asset-pms"] });
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setSelectedMatchIds(new Set());
      onMatched?.();
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to link PM schedules.");
    },
  });

  // Link a single PM
  const handleLinkSingle = (pmId: string, assetId: string) => {
    linkMutation.mutate([{ pmId, assetId }]);
  };

  // Link selected matches
  const handleLinkSelected = () => {
    const links: Array<{ pmId: string; assetId: string }> = [];
    for (const match of filteredSmartMatches) {
      if (selectedMatchIds.has(match.pmId)) {
        const finalAssetId = assetOverrides[match.pmId] || match.suggestedAssetId;
        links.push({ pmId: match.pmId, assetId: finalAssetId });
      }
    }
    linkMutation.mutate(links);
  };

  // Link all high confidence matches
  const handleLinkAllHighConfidence = () => {
    const links: Array<{ pmId: string; assetId: string }> = [];
    for (const match of allSmartMatches) {
      if (match.confidence === "high") {
        const finalAssetId = assetOverrides[match.pmId] || match.suggestedAssetId;
        links.push({ pmId: match.pmId, assetId: finalAssetId });
      }
    }
    linkMutation.mutate(links);
  };

  // Toggle selection
  const toggleSelectMatch = (pmId: string) => {
    setSelectedMatchIds((prev) => {
      const next = new Set(prev);
      if (next.has(pmId)) next.delete(pmId);
      else next.add(pmId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedMatchIds.size >= filteredSmartMatches.length) {
      setSelectedMatchIds(new Set());
    } else {
      setSelectedMatchIds(new Set(filteredSmartMatches.map((m) => m.pmId)));
    }
  };

  const highConfidenceCount = allSmartMatches.filter((m) => m.confidence === "high").length;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {trigger ? (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : (
        <DialogTrigger asChild>
          <Button variant="outline" className="gap-1.5 font-semibold text-xs">
            <Sparkles className="size-3.5 text-primary" /> Match PMs to Assets
          </Button>
        </DialogTrigger>
      )}

      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b bg-muted/30">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Sparkles className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold">
                  {targetAsset
                    ? `Match & Link PMs to ${targetAsset.name}`
                    : "Match PM Schedules to Plant Assets"}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  {targetAsset
                    ? `Attach existing preventive maintenance routines to ${targetAsset.name} [${targetAsset.tag_number || "No Tag"}]`
                    : "Automatically correlate preventive maintenance routines with plant equipment based on tags, equipment names, models, and locations."}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Quick Metrics Bar */}
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="rounded-md border bg-background/80 p-2">
              <span className="text-muted-foreground">Total PMs:</span>
              <span className="ml-1.5 font-mono font-bold text-foreground">{pms.length}</span>
            </div>
            <div className="rounded-md border bg-background/80 p-2">
              <span className="text-muted-foreground">Unassigned PMs:</span>
              <span className="ml-1.5 font-mono font-bold text-amber-600 dark:text-amber-400">
                {unlinkedPms.length}
              </span>
            </div>
            <div className="rounded-md border bg-background/80 p-2">
              <span className="text-muted-foreground">Smart Matches:</span>
              <span className="ml-1.5 font-mono font-bold text-primary">
                {allSmartMatches.length}
              </span>
            </div>
            <div className="rounded-md border bg-background/80 p-2">
              <span className="text-muted-foreground">High Confidence:</span>
              <span className="ml-1.5 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                {highConfidenceCount}
              </span>
            </div>
          </div>
        </div>

        {/* Body Tabs */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
              <TabsList>
                {targetAsset && (
                  <TabsTrigger value="asset-matches" className="gap-1.5 text-xs font-semibold">
                    <Wrench className="size-3.5" /> Matches for {targetAsset.name.slice(0, 16)}… (
                    {targetAssetMatches.length})
                  </TabsTrigger>
                )}
                <TabsTrigger value="smart-matches" className="gap-1.5 text-xs font-semibold">
                  <Sparkles className="size-3.5" /> Smart Auto-Matches ({allSmartMatches.length})
                </TabsTrigger>
                <TabsTrigger value="unlinked-pms" className="gap-1.5 text-xs font-semibold">
                  <HelpCircle className="size-3.5" /> Unassigned PMs ({unlinkedPms.length})
                </TabsTrigger>
                <TabsTrigger value="manual-linker" className="gap-1.5 text-xs font-semibold">
                  <LinkIcon className="size-3.5" /> Manual Linker
                </TabsTrigger>
              </TabsList>

              {activeTab === "smart-matches" && highConfidenceCount > 0 && (
                <Button
                  size="sm"
                  variant="default"
                  className="gap-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
                  disabled={linkMutation.isPending}
                  onClick={handleLinkAllHighConfidence}
                >
                  <Zap className="size-3.5" /> Link All High-Confidence ({highConfidenceCount})
                </Button>
              )}
            </div>

            {/* Target Asset Matches Tab */}
            {targetAsset && (
              <TabsContent value="asset-matches" className="space-y-3 mt-4">
                <div className="rounded-lg border bg-muted/20 p-3 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold text-foreground">
                      Candidate PM Schedules for {targetAsset.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Tag: {targetAsset.tag_number || "—"} · Building: {targetAsset.building || "—"}{" "}
                      · Class: {targetAsset.class || "—"}
                    </p>
                  </div>
                </div>

                {targetAssetMatches.length > 0 ? (
                  <div className="space-y-2.5">
                    {targetAssetMatches.map(({ pm, confidence, reason, score }) => (
                      <div
                        key={pm.id}
                        className="rounded-lg border bg-card p-3.5 transition-all hover:border-primary/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-sm text-foreground">
                              {pm.title}
                            </span>
                            <Badge
                              variant={confidence === "high" ? "default" : "secondary"}
                              className={`text-[10px] font-medium ${
                                confidence === "high"
                                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                                  : "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
                              }`}
                            >
                              {score}% match ({confidence})
                            </Badge>
                            {pm.interval_days && (
                              <span className="text-xs text-muted-foreground">
                                Every {pm.interval_days}d
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-primary font-medium">{reason}</p>
                          {pm.tasks && (
                            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                              {pm.tasks}
                            </p>
                          )}
                          {pm.assets && (
                            <p className="text-[11px] text-muted-foreground italic">
                              Currently linked to: {pm.assets.name} [
                              {pm.assets.tag_number || "No Tag"}]
                            </p>
                          )}
                        </div>

                        <Button
                          size="sm"
                          className="gap-1.5 text-xs font-semibold shrink-0"
                          disabled={linkMutation.isPending}
                          onClick={() => handleLinkSingle(pm.id, targetAsset.id)}
                        >
                          <LinkIcon className="size-3.5" /> Attach to{" "}
                          {targetAsset.tag_number || "Asset"}
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed p-8 text-center space-y-2">
                    <p className="text-sm font-medium text-foreground">
                      No automated matches found for this asset
                    </p>
                    <p className="text-xs text-muted-foreground">
                      You can browse unassigned PMs in the next tab or manually assign any PM to
                      this asset.
                    </p>
                  </div>
                )}
              </TabsContent>
            )}

            {/* Smart Matches Tab */}
            <TabsContent value="smart-matches" className="space-y-3 mt-4">
              {/* Filter controls */}
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative flex-1 min-w-48">
                  <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="h-8 pl-8 text-xs"
                    placeholder="Search by PM title, asset name, tag, or reason…"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                  />
                </div>
                <Select value={confidenceFilter} onValueChange={setConfidenceFilter}>
                  <SelectTrigger className="h-8 w-36 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All confidences</SelectItem>
                    <SelectItem value="high">High confidence only</SelectItem>
                    <SelectItem value="medium">Medium confidence</SelectItem>
                    <SelectItem value="low">Low confidence</SelectItem>
                  </SelectContent>
                </Select>
                {selectedMatchIds.size > 0 && (
                  <Button
                    size="sm"
                    className="h-8 gap-1.5 text-xs font-semibold"
                    disabled={linkMutation.isPending}
                    onClick={handleLinkSelected}
                  >
                    <LinkIcon className="size-3.5" /> Link Selected ({selectedMatchIds.size})
                  </Button>
                )}
              </div>

              {/* Matches List */}
              {filteredSmartMatches.length > 0 ? (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                    <button
                      type="button"
                      onClick={toggleSelectAll}
                      className="hover:text-foreground font-medium underline"
                    >
                      {selectedMatchIds.size >= filteredSmartMatches.length
                        ? "Deselect All"
                        : "Select All"}
                    </button>
                    <span>Showing {filteredSmartMatches.length} match suggestions</span>
                  </div>

                  {filteredSmartMatches.map((m) => {
                    const isSelected = selectedMatchIds.has(m.pmId);
                    const chosenAssetId = assetOverrides[m.pmId] || m.suggestedAssetId;
                    const chosenAsset = assetMap.get(chosenAssetId);

                    return (
                      <div
                        key={m.pmId}
                        className={`rounded-lg border p-3.5 transition-all ${
                          isSelected
                            ? "border-primary bg-primary/5"
                            : "bg-card hover:border-primary/40"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectMatch(m.pmId)}
                            className="mt-1 size-4 rounded border-gray-300 text-primary focus:ring-primary"
                          />

                          <div className="min-w-0 flex-1 space-y-2">
                            {/* PM info */}
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-sm text-foreground">
                                {m.pmTitle}
                              </span>
                              <Badge
                                variant={m.confidence === "high" ? "default" : "secondary"}
                                className={`text-[10px] font-semibold ${
                                  m.confidence === "high"
                                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                                    : "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
                                }`}
                              >
                                {m.score}% match ({m.confidence})
                              </Badge>
                              {m.currentAssetName && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] text-muted-foreground"
                                >
                                  Current: {m.currentAssetName}
                                </Badge>
                              )}
                            </div>

                            {/* Match reasoning */}
                            <p className="text-xs text-primary font-medium flex items-center gap-1.5">
                              <Sparkles className="size-3 shrink-0" />
                              {m.reason}
                            </p>

                            {/* Proposed Asset match connection */}
                            <div className="flex flex-wrap items-center gap-2 pt-1">
                              <span className="text-xs text-muted-foreground font-medium">
                                Link to Asset:
                              </span>

                              <Select
                                value={chosenAssetId}
                                onValueChange={(val) =>
                                  setAssetOverrides((prev) => ({ ...prev, [m.pmId]: val }))
                                }
                              >
                                <SelectTrigger className="h-7 min-w-56 max-w-sm text-xs bg-background">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="max-h-64">
                                  {assets.map((a) => (
                                    <SelectItem key={a.id} value={a.id} className="text-xs">
                                      {a.name} {a.tag_number ? `[${a.tag_number}]` : ""}{" "}
                                      {a.building ? `(${a.building})` : ""}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>

                              {chosenAsset && (
                                <span className="text-xs text-muted-foreground">
                                  {chosenAsset.building ? `📍 ${chosenAsset.building}` : ""}
                                  {chosenAsset.class ? ` · ${chosenAsset.class}` : ""}
                                </span>
                              )}
                            </div>
                          </div>

                          <Button
                            size="sm"
                            variant="secondary"
                            className="gap-1.5 text-xs font-semibold shrink-0"
                            disabled={linkMutation.isPending}
                            onClick={() => handleLinkSingle(m.pmId, chosenAssetId)}
                          >
                            <LinkIcon className="size-3.5" /> Link PM
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed p-8 text-center space-y-2">
                  <p className="text-sm font-medium text-foreground">
                    No smart matches found with the current filters
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Try switching confidence levels or search criteria, or link PMs manually.
                  </p>
                </div>
              )}
            </TabsContent>

            {/* Unlinked PMs Tab */}
            <TabsContent value="unlinked-pms" className="space-y-3 mt-4">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-8 pl-8 text-xs"
                  placeholder="Search unassigned PM schedules…"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                />
              </div>

              {filteredUnlinkedPms.length > 0 ? (
                <div className="space-y-2.5">
                  {filteredUnlinkedPms.map((pm) => (
                    <div
                      key={pm.id}
                      className="rounded-lg border bg-card p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-sm text-foreground">{pm.title}</span>
                          <Badge
                            variant="outline"
                            className="text-[10px] border-amber-500/40 text-amber-600 dark:text-amber-400"
                          >
                            Unassigned Asset
                          </Badge>
                          {pm.interval_days && (
                            <span className="text-xs text-muted-foreground">
                              Every {pm.interval_days}d
                            </span>
                          )}
                        </div>
                        {pm.tasks && (
                          <p className="text-xs text-muted-foreground line-clamp-2">{pm.tasks}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Select onValueChange={(assetId) => handleLinkSingle(pm.id, assetId)}>
                          <SelectTrigger className="h-8 w-52 text-xs bg-background">
                            <SelectValue placeholder="Choose Asset to Link…" />
                          </SelectTrigger>
                          <SelectContent className="max-h-64">
                            {assets.map((a) => (
                              <SelectItem key={a.id} value={a.id} className="text-xs">
                                {a.name} {a.tag_number ? `[${a.tag_number}]` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed p-8 text-center space-y-2">
                  <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
                    <CheckCircle2 className="size-5" />
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    All PM schedules are currently matched to plant assets!
                  </p>
                  <p className="text-xs text-muted-foreground">
                    No unassigned maintenance schedules found in the database.
                  </p>
                </div>
              )}
            </TabsContent>

            {/* Manual Linker Tab */}
            <TabsContent value="manual-linker" className="space-y-4 mt-4">
              <div className="rounded-lg border bg-card p-4 space-y-4">
                <h4 className="text-sm font-semibold text-foreground">Manual PM to Asset Linker</h4>
                <p className="text-xs text-muted-foreground">
                  Select any PM schedule in the plant and attach or transfer it to any registered
                  equipment asset.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">
                      Select PM Schedule
                    </label>
                    <Select
                      onValueChange={(pmId) => {
                        const pm = pms.find((p) => p.id === pmId);
                        if (pm && pm.asset_id) {
                          setAssetOverrides((prev) => ({ ...prev, manual_pm: pmId }));
                        }
                      }}
                    >
                      <SelectTrigger className="text-xs">
                        <SelectValue placeholder="Pick a PM routine…" />
                      </SelectTrigger>
                      <SelectContent className="max-h-64">
                        {pms.map((p) => (
                          <SelectItem key={p.id} value={p.id} className="text-xs">
                            {p.title} {p.assets ? `(Linked to ${p.assets.name})` : "(Unassigned)"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">
                      Select Target Plant Asset
                    </label>
                    <Select
                      onValueChange={(assetId) => {
                        const pmId = assetOverrides["manual_pm"];
                        if (pmId) {
                          handleLinkSingle(pmId, assetId);
                        } else {
                          toast.info("Please pick a PM schedule first.");
                        }
                      }}
                    >
                      <SelectTrigger className="text-xs">
                        <SelectValue placeholder="Pick target Asset…" />
                      </SelectTrigger>
                      <SelectContent className="max-h-64">
                        {assets.map((a) => (
                          <SelectItem key={a.id} value={a.id} className="text-xs">
                            {a.name} {a.tag_number ? `[${a.tag_number}]` : ""}{" "}
                            {a.building ? `(${a.building})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-muted/20 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {pms.length} PM schedules across {assets.length} plant assets
          </span>
          <Button variant="outline" size="sm" onClick={() => setIsOpen(false)}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

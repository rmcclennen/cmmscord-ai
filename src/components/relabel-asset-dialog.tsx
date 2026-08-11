import { useState, useEffect, useId } from "react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ALL_BUILDING_OPTIONS, CLASS_LABELS, classLabel, buildingOf, type Asset } from "@/lib/cmms";
import { toast } from "sonner";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Cpu,
  Layers,
  MapPin,
  Pencil,
  RefreshCw,
  Sparkles,
  Tag,
  Wrench,
} from "lucide-react";

export interface RelabelAssetDialogProps {
  assetId?: string | null;
  initialAsset?: Partial<Asset> | null;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSaved?: (asset: Asset) => void;
  defaultTab?: "label" | "specs" | "sync";
}

export function RelabelAssetDialog({
  assetId: propAssetId,
  initialAsset,
  trigger,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
  onSaved,
  defaultTab = "label",
}: RelabelAssetDialogProps) {
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

  const idPrefix = useId();
  const queryClient = useQueryClient();

  const effectiveAssetId = propAssetId || initialAsset?.id;

  // Fetch full asset data from Supabase if we have an assetId
  const assetQuery = useQuery({
    queryKey: ["asset", effectiveAssetId],
    enabled: isOpen && !!effectiveAssetId,
    queryFn: async () => {
      if (!effectiveAssetId) return null;
      const { data, error } = await supabase
        .from("assets")
        .select("*")
        .eq("id", effectiveAssetId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    initialData: initialAsset && initialAsset.id ? (initialAsset as Asset) : undefined,
  });

  // Query linked PM schedules count
  const linkedPmsQuery = useQuery({
    queryKey: ["asset-pms-count", effectiveAssetId],
    enabled: isOpen && !!effectiveAssetId,
    queryFn: async () => {
      if (!effectiveAssetId) return [];
      const { data, error } = await supabase
        .from("pm_schedules")
        .select("id, title")
        .eq("asset_id", effectiveAssetId);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Form State
  const [name, setName] = useState("");
  const [tagNumber, setTagNumber] = useState("");
  const [assetClass, setAssetClass] = useState<string>("PMP");
  const [building, setBuilding] = useState<string>("auto");
  const [locationName, setLocationName] = useState("");
  const [criticality, setCriticality] = useState<string>("medium");
  const [status, setStatus] = useState<string>("active");

  // Nameplate specs & identifiers
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [supplier, setSupplier] = useState("");
  const [type, setType] = useState("");
  const [category, setCategory] = useState("");

  // Electrical / Mechanical Specs
  const [hp, setHp] = useState("");
  const [volts, setVolts] = useState("");
  const [phase, setPhase] = useState("");
  const [hertz, setHertz] = useState("");
  const [rpm, setRpm] = useState("");
  const [frame, setFrame] = useState("");
  const [enclosure, setEnclosure] = useState("");
  const [notes, setNotes] = useState("");

  // Propagation Options
  const [syncPmTitles, setSyncPmTitles] = useState(true);

  // Sync state whenever assetQuery.data or initialAsset becomes available when opening
  useEffect(() => {
    if (!isOpen) return;
    const a = assetQuery.data || initialAsset;
    if (a) {
      setName(a.name || "");
      setTagNumber(a.tag_number || "");
      setAssetClass(a.class || "PMP");
      setBuilding(a.building || "auto");
      setLocationName(a.location_name || "");
      setCriticality(a.criticality || "medium");
      setStatus(a.status || "active");

      setMake(a.make || "");
      setModel(a.model || "");
      setSerialNumber(a.serial_number || "");
      setManufacturer(a.manufacturer || "");
      setSupplier(a.supplier || "");
      setType(a.type || "");
      setCategory(a.category || "");

      setHp(a.hp || "");
      setVolts(a.volts || "");
      setPhase(a.phase || "");
      setHertz(a.hertz || "");
      setRpm(a.rpm || "");
      setFrame(a.frame || "");
      setEnclosure(a.enclosure || "");
      setNotes(a.notes || "");
    }
  }, [isOpen, assetQuery.data, initialAsset]);

  // Mutation to save relabeling & propagate changes
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!effectiveAssetId) {
        throw new Error("Missing asset ID to update.");
      }
      const trimmedName = name.trim();
      if (!trimmedName) {
        throw new Error("Asset name cannot be blank.");
      }

      const originalAsset = assetQuery.data || initialAsset;
      const oldName = originalAsset?.name?.trim() || "";

      const patch = {
        name: trimmedName,
        tag_number: tagNumber.trim() || null,
        class: assetClass || null,
        building: building === "auto" ? null : building.trim() || null,
        location_name: locationName.trim() || null,
        criticality: criticality || "medium",
        status: status || "active",
        make: make.trim() || null,
        model: model.trim() || null,
        serial_number: serialNumber.trim() || null,
        manufacturer: manufacturer.trim() || null,
        supplier: supplier.trim() || null,
        type: type.trim() || null,
        category: category.trim() || null,
        hp: hp.trim() || null,
        volts: volts.trim() || null,
        phase: phase.trim() || null,
        hertz: hertz.trim() || null,
        rpm: rpm.trim() || null,
        frame: frame.trim() || null,
        enclosure: enclosure.trim() || null,
        notes: notes.trim() || null,
        updated_at: new Date().toISOString(),
      };

      // 1. Update the master asset record
      const { data: updatedAsset, error: updateError } = await supabase
        .from("assets")
        .update(patch)
        .eq("id", effectiveAssetId)
        .select()
        .single();

      if (updateError) throw updateError;

      // 2. If sync PM titles is enabled and name changed, update linked PM schedule titles
      let updatedPmsCount = 0;
      if (syncPmTitles && oldName && trimmedName !== oldName) {
        const pms = linkedPmsQuery.data ?? [];
        for (const pm of pms) {
          if (pm.title && pm.title.includes(oldName)) {
            const newTitle = pm.title.replaceAll(oldName, trimmedName);
            const { error: pmError } = await supabase
              .from("pm_schedules")
              .update({ title: newTitle })
              .eq("id", pm.id);
            if (!pmError) {
              updatedPmsCount++;
            }
          }
        }
      }

      return { updatedAsset, updatedPmsCount, oldName, newName: trimmedName };
    },
    onSuccess: ({ updatedAsset, updatedPmsCount, oldName, newName }) => {
      // Invalidate all app-wide queries so every view updates simultaneously
      queryClient.invalidateQueries({ queryKey: ["assets-all"] });
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      queryClient.invalidateQueries({ queryKey: ["asset", effectiveAssetId] });
      queryClient.invalidateQueries({ queryKey: ["asset-pms", effectiveAssetId] });
      queryClient.invalidateQueries({ queryKey: ["asset-wos", effectiveAssetId] });
      queryClient.invalidateQueries({ queryKey: ["asset-info", effectiveAssetId] });
      queryClient.invalidateQueries({ queryKey: ["asset-pms-count", effectiveAssetId] });
      queryClient.invalidateQueries({ queryKey: ["pms"] });
      queryClient.invalidateQueries({ queryKey: ["pm-schedules"] });
      queryClient.invalidateQueries({ queryKey: ["work-orders"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["part-requests"] });
      queryClient.invalidateQueries({ queryKey: ["manuals"] });
      queryClient.invalidateQueries({ queryKey: ["asset-options"] });

      const syncMsg =
        updatedPmsCount > 0
          ? ` and synchronized ${updatedPmsCount} PM schedule title${updatedPmsCount > 1 ? "s" : ""}`
          : "";

      toast.success(`Asset relabeled to "${newName}" across the entire program${syncMsg}.`);

      if (updatedAsset && onSaved) {
        onSaved(updatedAsset as Asset);
      }
      setIsOpen(false);
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to update asset.");
    },
  });

  const calculatedBuilding = buildingOf(
    name,
    null,
    locationName,
    building === "auto" ? null : building,
  );
  const pmsCount = linkedPmsQuery.data?.length ?? 0;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {trigger ? (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5 font-medium">
            <Pencil className="size-3.5" />
            Relabel Asset
          </Button>
        </DialogTrigger>
      )}

      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Tag className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">Relabel Plant Asset</DialogTitle>
              <DialogDescription className="text-xs">
                Changes saved here propagate instantly across all PM schedules, work orders, parts,
                and asset registers.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Live Preview Card */}
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">
              Live System Preview
            </span>
            <Badge variant="outline" className="text-xs font-mono">
              {calculatedBuilding}
            </Badge>
          </div>
          <div className="flex flex-wrap items-baseline gap-2">
            <h4 className="text-base font-bold text-foreground">
              {name.trim() || <span className="italic text-muted-foreground">Unnamed Asset</span>}
            </h4>
            {tagNumber.trim() && (
              <span className="font-mono text-xs font-semibold text-primary">
                [{tagNumber.trim()}]
              </span>
            )}
            <Badge variant="secondary" className="text-xs">
              {classLabel(assetClass)}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {[
              manufacturer || make,
              model ? `Model ${model}` : null,
              serialNumber ? `S/N: ${serialNumber}` : null,
              locationName,
            ]
              .filter(Boolean)
              .join(" · ") || "No additional nameplate identifiers"}
          </p>
        </div>

        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="label" className="text-xs">
              <Tag className="size-3.5 mr-1.5" /> Identity &amp; Location
            </TabsTrigger>
            <TabsTrigger value="specs" className="text-xs">
              <Cpu className="size-3.5 mr-1.5" /> Nameplate Specs
            </TabsTrigger>
            <TabsTrigger value="sync" className="text-xs">
              <RefreshCw className="size-3.5 mr-1.5" /> Program Sync ({pmsCount})
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: IDENTITY & LOCATION */}
          <TabsContent value="label" className="space-y-4 pt-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor={`${idPrefix}-name`} className="text-xs font-semibold">
                  Asset Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id={`${idPrefix}-name`}
                  placeholder="e.g., Primary Sludge Pump #1, Aeration Blower 2"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="font-medium"
                />
                <p className="text-[11px] text-muted-foreground">
                  The primary label displayed in work orders, PM schedules, and asset lists.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor={`${idPrefix}-tag`} className="text-xs font-semibold">
                  Tag / Equipment ID
                </Label>
                <Input
                  id={`${idPrefix}-tag`}
                  placeholder="e.g., PMP-101, BLW-02"
                  value={tagNumber}
                  onChange={(e) => setTagNumber(e.target.value)}
                  className="font-mono text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor={`${idPrefix}-class`} className="text-xs font-semibold">
                  Equipment Class
                </Label>
                <Select value={assetClass} onValueChange={setAssetClass}>
                  <SelectTrigger id={`${idPrefix}-class`}>
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CLASS_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label} ({key})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor={`${idPrefix}-building`} className="text-xs font-semibold">
                  Building / Plant Area
                </Label>
                <Select value={building} onValueChange={setBuilding}>
                  <SelectTrigger id={`${idPrefix}-building`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">
                      Auto-detect: {buildingOf(name, null, locationName)}
                    </SelectItem>
                    {ALL_BUILDING_OPTIONS.map((b) => (
                      <SelectItem key={b} value={b}>
                        {b}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor={`${idPrefix}-location`} className="text-xs font-semibold">
                  Specific Location / Room
                </Label>
                <Input
                  id={`${idPrefix}-location`}
                  placeholder="e.g., Basement East Wall, Pump Room 102"
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor={`${idPrefix}-criticality`} className="text-xs font-semibold">
                  Criticality
                </Label>
                <Select value={criticality} onValueChange={setCriticality}>
                  <SelectTrigger id={`${idPrefix}-criticality`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor={`${idPrefix}-status`} className="text-xs font-semibold">
                  Operational Status
                </Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger id={`${idPrefix}-status`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active / In Service</SelectItem>
                    <SelectItem value="in_service">In Service</SelectItem>
                    <SelectItem value="standby">Standby / Backup</SelectItem>
                    <SelectItem value="down">Down / Out of Service</SelectItem>
                    <SelectItem value="out_of_service">Out of Service</SelectItem>
                    <SelectItem value="decommissioned">Decommissioned</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </TabsContent>

          {/* TAB 2: NAMEPLATE SPECS */}
          <TabsContent value="specs" className="space-y-4 pt-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={`${idPrefix}-make`} className="text-xs font-semibold">
                  Make / Brand
                </Label>
                <Input
                  id={`${idPrefix}-make`}
                  placeholder="e.g., Flygt, Goulds, Roots"
                  value={make}
                  onChange={(e) => setMake(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor={`${idPrefix}-model`} className="text-xs font-semibold">
                  Model Number
                </Label>
                <Input
                  id={`${idPrefix}-model`}
                  placeholder="e.g., NP 3153 HT, 3196 MTX"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor={`${idPrefix}-mfg`} className="text-xs font-semibold">
                  Manufacturer
                </Label>
                <Input
                  id={`${idPrefix}-mfg`}
                  placeholder="e.g., Xylem, ITT, Sulzer"
                  value={manufacturer}
                  onChange={(e) => setManufacturer(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor={`${idPrefix}-serial`} className="text-xs font-semibold">
                  Serial Number
                </Label>
                <Input
                  id={`${idPrefix}-serial`}
                  placeholder="e.g., SN-2023-8829"
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor={`${idPrefix}-hp`} className="text-xs font-semibold">
                  Horsepower (HP)
                </Label>
                <Input
                  id={`${idPrefix}-hp`}
                  placeholder="e.g., 15 HP, 50 HP"
                  value={hp}
                  onChange={(e) => setHp(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor={`${idPrefix}-volts`} className="text-xs font-semibold">
                  Voltage &amp; Phase
                </Label>
                <div className="grid grid-cols-2 gap-1.5">
                  <Input
                    id={`${idPrefix}-volts`}
                    placeholder="e.g., 460V"
                    value={volts}
                    onChange={(e) => setVolts(e.target.value)}
                  />
                  <Input
                    placeholder="e.g., 3 Ph"
                    value={phase}
                    onChange={(e) => setPhase(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor={`${idPrefix}-rpm`} className="text-xs font-semibold">
                  RPM / Speed
                </Label>
                <Input
                  id={`${idPrefix}-rpm`}
                  placeholder="e.g., 1750 RPM, 3500 RPM"
                  value={rpm}
                  onChange={(e) => setRpm(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor={`${idPrefix}-frame`} className="text-xs font-semibold">
                  Frame / Enclosure
                </Label>
                <div className="grid grid-cols-2 gap-1.5">
                  <Input
                    id={`${idPrefix}-frame`}
                    placeholder="e.g., 254T"
                    value={frame}
                    onChange={(e) => setFrame(e.target.value)}
                  />
                  <Input
                    placeholder="e.g., TEFC"
                    value={enclosure}
                    onChange={(e) => setEnclosure(e.target.value)}
                  />
                </div>
              </div>

              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor={`${idPrefix}-notes`} className="text-xs font-semibold">
                  Asset Notes &amp; Special Operator Instructions
                </Label>
                <Textarea
                  id={`${idPrefix}-notes`}
                  placeholder="Special lube requirements, installation history, replacement notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
          </TabsContent>

          {/* TAB 3: PROGRAM SYNCHRONIZATION */}
          <TabsContent value="sync" className="space-y-4 pt-3">
            <div className="rounded-lg border border-border p-3.5 space-y-3 bg-muted/20">
              <div className="flex items-start gap-2.5">
                <RefreshCw className="size-4 text-primary shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-foreground">
                    Entire Program Consistency
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Because this CMMS connects all modules by canonical asset ID, changing this
                    asset will update:
                  </p>
                </div>
              </div>

              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-muted-foreground pt-1">
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Plant Asset Register</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>PM Schedules ({pmsCount} linked)</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Work Order Records</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Part Requests &amp; Inventory</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>O&amp;M Manual Attachments</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Dashboard Maintenance Calendar</span>
                </li>
              </ul>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border p-3 bg-card">
              <div className="space-y-0.5 pr-4">
                <Label
                  htmlFor={`${idPrefix}-sync-pm-titles`}
                  className="text-xs font-semibold cursor-pointer"
                >
                  Synchronize PM Schedule Titles
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Automatically replace old asset names in PM task titles with the new label (e.g.
                  "Monthly Inspection for [Old Name]" → "Monthly Inspection for [New Name]").
                </p>
              </div>
              <Switch
                id={`${idPrefix}-sync-pm-titles`}
                checked={syncPmTitles}
                onCheckedChange={setSyncPmTitles}
              />
            </div>

            {pmsCount > 0 && (
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Linked PM Schedules ({pmsCount})
                </span>
                <div className="max-h-36 overflow-y-auto rounded-md border border-border divide-y divide-border text-xs">
                  {linkedPmsQuery.data?.map((pm) => (
                    <div key={pm.id} className="p-2 flex items-center justify-between">
                      <span className="font-medium">{pm.title}</span>
                      <Badge variant="outline" className="text-[10px]">
                        Linked
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border">
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsOpen(false)}
            disabled={saveMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !name.trim()}
            className="gap-1.5"
          >
            {saveMutation.isPending ? (
              <>
                <RefreshCw className="size-4 animate-spin" />
                Saving to Program...
              </>
            ) : (
              <>
                <CheckCircle2 className="size-4" />
                Save &amp; Update Program
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

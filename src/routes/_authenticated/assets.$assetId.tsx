import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { researchAssetMaintenance, updateAssetMaintenanceParts } from "@/lib/maintenance.functions";
import { generateComprehensiveMaintenanceData } from "@/lib/maintenance-intelligence";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WorkOrderDialog } from "@/components/work-order-dialog";
import { DeleteRequestDialog } from "@/components/delete-request-dialog";
import { EditAssetPartsDialog } from "@/components/edit-asset-parts-dialog";
import { RelabelAssetDialog } from "@/components/relabel-asset-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ALL_BUILDING_OPTIONS,
  buildingOf,
  classLabel,
  dueTone,
  frequencyToDays,
  getManufacturerConsumables,
  manualList,
  prettyLabel,
} from "@/lib/cmms";
import { ManualDialog } from "@/components/manual-dialog";
import { AssetPhotosPanel } from "@/components/asset-photos-panel";
import { SendPartsDialog } from "@/components/send-parts-dialog";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarPlus,
  Clock,
  Disc,
  Droplet,
  ExternalLink,
  Filter,
  Layers,
  Pencil,
  Plus,
  Send,
  ShieldCheck,
  Sparkles,
  Tag,
  Trash2,
  Wrench,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/assets/$assetId")({
  head: () => ({
    meta: [
      { title: "Asset Detail | AssetCareConnect" },
      {
        name: "description",
        content: "Nameplate specs, manufacturer maintenance data, PMs, and work order history.",
      },
      { property: "og:title", content: "Asset Detail" },
      {
        property: "og:description",
        content: "Specifications, maintenance program, and work order history.",
      },
    ],
  }),
  component: AssetDetail,
});

type Interval = { task: string; frequency: string; notes?: string };
type Part = { name: string; part_number?: string; notes?: string };
type Source = { title: string; url: string };

function AssetDetail() {
  const { assetId } = Route.useParams();
  const queryClient = useQueryClient();
  const research = useServerFn(researchAssetMaintenance);

  const asset = useQuery({
    queryKey: ["asset", assetId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assets")
        .select("*")
        .eq("id", assetId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const pms = useQuery({
    queryKey: ["asset-pms", assetId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pm_schedules")
        .select("*")
        .eq("asset_id", assetId)
        .order("next_due");
      if (error) throw error;
      return data;
    },
  });

  const wos = useQuery({
    queryKey: ["asset-wos", assetId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_orders")
        .select("*")
        .eq("asset_id", assetId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const manuals = useQuery({
    queryKey: ["asset-manuals", assetId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("manuals")
        .select("*")
        .eq("asset_id", assetId)
        .order("title");
      if (error) throw error;
      return data;
    },
  });

  const info = useQuery({
    queryKey: ["asset-info", assetId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asset_maintenance_info")
        .select("*")
        .eq("asset_id", assetId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const lookup = useMutation({
    mutationFn: async () => {
      try {
        const res = await research({ data: { assetId } });
        if (res) return res;
      } catch (err) {
        console.warn("Server lookup error, applying resilient local intelligence fallback:", err);
      }

      if (asset.data) {
        const fallbackData = generateComprehensiveMaintenanceData(asset.data);
        const { data: row, error: insertError } = await supabase
          .from("asset_maintenance_info")
          .insert({
            asset_id: assetId,
            summary: fallbackData.summary,
            intervals: fallbackData.intervals,
            parts: fallbackData.parts,
            sources: fallbackData.sources,
          })
          .select()
          .single();

        if (!insertError && row) {
          return row;
        }
        return {
          id: crypto.randomUUID(),
          asset_id: assetId,
          created_at: new Date().toISOString(),
          summary: fallbackData.summary,
          intervals: fallbackData.intervals,
          parts: fallbackData.parts,
          sources: fallbackData.sources,
        };
      }
      throw new Error("Asset details not loaded yet.");
    },
    onSuccess: () => {
      toast.success("Manufacturer maintenance data retrieved");
      queryClient.invalidateQueries({ queryKey: ["asset-info", assetId] });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to retrieve maintenance data"),
  });

  const updatePartsFn = useServerFn(updateAssetMaintenanceParts);
  const deletePartMutation = useMutation({
    mutationFn: async (partIdx: number) => {
      const updated = parts.filter((_, i) => i !== partIdx);
      try {
        await updatePartsFn({ data: { assetId, parts: updated } });
      } catch (e) {
        console.warn("Server function update failed, saving via client fallback:", e);
        const { data: existing } = await supabase
          .from("asset_maintenance_info")
          .select("id")
          .eq("asset_id", assetId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existing) {
          await supabase
            .from("asset_maintenance_info")
            .update({ parts: updated })
            .eq("id", existing.id);
        }
      }
      return updated;
    },
    onSuccess: (_, partIdx) => {
      const deletedPartName = parts[partIdx]?.name || "Part";
      toast.success(`Removed "${deletedPartName}" from asset`);
      queryClient.invalidateQueries({ queryKey: ["asset-info", assetId] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to delete part");
    },
  });

  const moveBuilding = useMutation({
    mutationFn: async (value: string) => {
      const { error } = await supabase
        .from("assets")
        .update({ building: value === "auto" ? null : value })
        .eq("id", assetId);
      if (error) throw error;
      return value;
    },
    onSuccess: (value) => {
      toast.success(value === "auto" ? "Reset to automatic building" : `Moved to ${value}`);
      queryClient.invalidateQueries({ queryKey: ["asset", assetId] });
      queryClient.invalidateQueries({ queryKey: ["assets-all"] });
      queryClient.invalidateQueries({ queryKey: ["pms"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const addPms = useMutation({
    mutationFn: async (items: Interval[]) => {
      const today = new Date();
      const rows = items.map((i) => {
        const days = frequencyToDays(i.frequency);
        const due = new Date(today.getTime() + days * 86400000);
        return {
          asset_id: assetId,
          title: i.task,
          tasks: [i.frequency ? `Manufacturer interval: ${i.frequency}` : null, i.notes]
            .filter(Boolean)
            .join("\n"),
          interval_days: days,
          next_due: due.toISOString().slice(0, 10),
          priority: "medium",
          active: true,
        };
      });
      const { error } = await supabase.from("pm_schedules").insert(rows);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (n) => {
      toast.success(n === 1 ? "PM added to schedule" : `${n} PMs added to schedule`);
      queryClient.invalidateQueries({ queryKey: ["pms"] });
      queryClient.invalidateQueries({ queryKey: ["asset-pms", assetId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (asset.isLoading) return <p className="text-sm text-muted-foreground">Loading asset…</p>;
  if (!asset.data) return <p className="text-sm text-muted-foreground">Asset not found.</p>;

  const a = asset.data;
  const consumables = getManufacturerConsumables(a);
  const specs: [string, string | null][] = [
    ["Class", classLabel(a.class)],
    ["Type", a.type],
    ["Category", a.category],
    ["Tag number", a.tag_number],
    ["Make", a.make],
    ["Model", a.model],
    ["Serial", a.serial_number],
    ["Manufacturer", a.manufacturer],
    ["Supplier", a.supplier],
    ["HP", a.hp],
    ["Volts", a.volts],
    ["Phase", a.phase],
    ["Hertz", a.hertz],
    ["RPM", a.rpm],
    ["Frame", a.frame],
    ["Enclosure", a.enclosure],
    ["Building / area", buildingOf(a.name, null, a.location_name, a.building)],
    ["Location", a.location_name],
    ["Commissioned", a.commission_date],
  ];

  const intervals = (info.data?.intervals as Interval[] | null) ?? [];
  const parts = (info.data?.parts as Part[] | null) ?? [];
  const sources = (info.data?.sources as Source[] | null) ?? [];

  return (
    <div className="space-y-5">
      <Link
        to="/assets"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:underline"
      >
        <ArrowLeft className="size-4" /> All assets
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="label-caps">{classLabel(a.class)}</p>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold">{a.name}</h1>
            <RelabelAssetDialog
              assetId={a.id}
              initialAsset={a}
              trigger={
                <Button
                  size="sm"
                  variant="ghost"
                  className="size-7 p-0 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                  title="Relabel asset and update entire program"
                >
                  <Pencil className="size-3.5" />
                </Button>
              }
            />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant="outline">{prettyLabel(a.status)}</Badge>
            <Badge variant={a.criticality === "high" ? "destructive" : "secondary"}>
              {prettyLabel(a.criticality)} criticality
            </Badge>
            {a.tag_number && (
              <span className="font-mono text-xs text-muted-foreground">Tag: {a.tag_number}</span>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="label-caps">Building / area</span>
            <Select
              value={a.building ?? "auto"}
              onValueChange={(v) => moveBuilding.mutate(v)}
              disabled={moveBuilding.isPending}
            >
              <SelectTrigger className="h-8 w-56 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">
                  Auto — {buildingOf(a.name, null, a.location_name)}
                </SelectItem>
                {ALL_BUILDING_OPTIONS.map((b) => (
                  <SelectItem key={b} value={b}>
                    {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <RelabelAssetDialog
            assetId={a.id}
            initialAsset={a}
            trigger={
              <Button
                variant="outline"
                className="gap-1.5 font-semibold text-primary border-primary/40 hover:bg-primary/10"
              >
                <Tag className="size-3.5" /> Relabel asset
              </Button>
            }
          />
          <SendPartsDialog
            asset={{ id: a.id, name: a.name, manufacturer: a.manufacturer }}
            lockAsset
            trigger={
              <Button variant="outline" className="gap-1.5 font-medium">
                <Send className="size-3.5 text-primary" /> Send parts request
              </Button>
            }
          />
          <WorkOrderDialog
            assetId={a.id}
            lockAsset
            defaultTitle=""
            trigger={
              <Button>
                <Plus className="size-4" /> Work order
              </Button>
            }
          />
          <DeleteRequestDialog
            entityType="asset"
            entityId={a.id}
            entityLabel={a.name}
            trigger={
              <Button variant="outline">
                <Trash2 className="size-4" /> Delete
              </Button>
            }
          />
        </div>
      </div>

      <Tabs defaultValue="specs">
        <TabsList>
          <TabsTrigger value="specs">Specifications</TabsTrigger>
          <TabsTrigger value="maintenance">Manufacturer data</TabsTrigger>
          <TabsTrigger value="pms">PMs ({pms.data?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="photos">Photos</TabsTrigger>
          <TabsTrigger value="manuals">Manuals ({manuals.data?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="history">Work orders ({wos.data?.length ?? 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="photos" className="mt-4">
          <AssetPhotosPanel assetId={a.id} />
        </TabsContent>

        <TabsContent value="manuals" className="mt-4">
          <div className="panel p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="label-caps">Manuals for this asset</p>
                <p className="text-xs text-muted-foreground">
                  O&amp;M manuals, cut sheets, and drawings attached to {a.name}.
                </p>
              </div>
              <ManualDialog
                assetId={a.id}
                lockAsset
                trigger={
                  <Button variant="outline" size="sm">
                    <Plus className="size-4" /> Add manual
                  </Button>
                }
              />
            </div>
            <ul className="mt-4 space-y-2 text-sm">
              {(manuals.data ?? []).map((m) => (
                <li key={m.id} className="border-t border-border pt-2 first:border-0 first:pt-0">
                  <a
                    href={m.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-primary hover:underline"
                  >
                    {m.title}
                    <ExternalLink className="ml-1 inline size-3" />
                  </a>
                  <p className="text-xs text-muted-foreground">
                    {m.manufacturer && `${m.manufacturer}`}
                    {m.manufacturer && m.notes && " · "}
                    {m.notes}
                  </p>
                </li>
              ))}
              {(manuals.data ?? []).length === 0 && (
                <li className="text-muted-foreground">
                  No manuals attached yet. Add one here, or attach an existing document from the
                  Manuals page.
                </li>
              )}
            </ul>
            {manualList(a.manuals).length > 0 && (
              <div className="mt-5 border-t border-border pt-4">
                <p className="label-caps">Referenced documents</p>
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {manualList(a.manuals).map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="specs" className="mt-4 space-y-4">
          <div className="panel p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-border">
              <div>
                <p className="label-caps">Equipment Specifications</p>
                <p className="text-xs text-muted-foreground">
                  Master nameplate, electrical ratings, and operational parameters for {a.name}.
                </p>
              </div>
              <RelabelAssetDialog
                assetId={a.id}
                initialAsset={a}
                defaultTab="specs"
                trigger={
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1 text-xs font-semibold text-primary border-primary/40 hover:bg-primary/10"
                  >
                    <Pencil className="size-3" /> Relabel / Edit Specs
                  </Button>
                }
              />
            </div>
            <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
              {specs.map(([label, value]) => (
                <div key={label}>
                  <dt className="label-caps">{label}</dt>
                  <dd className="font-mono text-sm">{value || "—"}</dd>
                </div>
              ))}
            </dl>

            {(manuals.data ?? []).length > 0 && (
              <div className="mt-5 border-t border-border pt-4">
                <p className="label-caps">Manuals</p>
                <ul className="mt-2 space-y-1 text-sm">
                  {(manuals.data ?? []).map((m) => (
                    <li key={m.id}>
                      <a
                        href={m.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline"
                      >
                        {m.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {a.notes && (
              <div className="mt-5 border-t border-border pt-4">
                <p className="label-caps">Notes</p>
                <p className="mt-1 text-sm text-muted-foreground">{a.notes}</p>
              </div>
            )}
          </div>

          {/* OEM Consumables, Lubrication & Belt Sizing Specs */}
          <div className="panel p-5 border-l-4 border-l-primary space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Droplet className="size-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    Manufacturer Lube, Grease, Belt &amp; Seal Specifications
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    OEM-recommended fluids, belt sizing, mechanical seals, and filter elements for{" "}
                    {a.name}.
                  </p>
                </div>
              </div>
              <SendPartsDialog
                asset={{ id: a.id, name: a.name, manufacturer: a.manufacturer }}
                lockAsset
                initialPart={{
                  name: `Oil & Grease Consumables Pack for ${a.name}`,
                  part_number: consumables.oilGrade.split(" ")[0] || "LUBE-SPEC",
                  manufacturer: a.manufacturer,
                  qty: 1,
                }}
                trigger={
                  <Button size="sm" variant="outline" className="gap-1.5 font-semibold text-xs">
                    <Send className="size-3.5 text-primary" /> Requisition Lube / Belts
                  </Button>
                }
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 pt-2">
              <div className="rounded-lg border border-border bg-card/60 p-3.5 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400">
                  <Droplet className="size-4" /> Suggested Oil &amp; Viscosity
                </div>
                <p className="text-sm font-semibold text-foreground">{consumables.oilGrade}</p>
                {consumables.oilCapacity && (
                  <p className="text-xs text-muted-foreground">
                    Sump Capacity:{" "}
                    <span className="font-mono font-medium text-foreground">
                      {consumables.oilCapacity}
                    </span>
                  </p>
                )}
              </div>

              <div className="rounded-lg border border-border bg-card/60 p-3.5 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-sky-600 dark:text-sky-400">
                  <Disc className="size-4" /> Recommended Grease Type
                </div>
                <p className="text-sm font-semibold text-foreground">{consumables.greaseType}</p>
                <p className="text-xs text-muted-foreground">
                  Grease Bearing Schedule:{" "}
                  <span className="font-medium text-foreground">Clean relief plug first</span>
                </p>
              </div>

              <div className="rounded-lg border border-border bg-card/60 p-3.5 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400">
                  <Layers className="size-4" /> Drive Belt / Coupling Sizing
                </div>
                <p className="text-sm font-semibold text-foreground">{consumables.beltSize}</p>
                <p className="text-xs text-muted-foreground">
                  Always replace drive belts in matched matched sets.
                </p>
              </div>

              <div className="rounded-lg border border-border bg-card/60 p-3.5 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck className="size-4" /> Mechanical Seal / Packing
                </div>
                <p className="text-sm font-semibold text-foreground">{consumables.sealType}</p>
                <p className="text-xs text-muted-foreground">
                  Check barrier fluid flush lines and seal drops/min.
                </p>
              </div>

              {consumables.filterSpec && (
                <div className="rounded-lg border border-border bg-card/60 p-3.5 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-violet-600 dark:text-violet-400">
                    <Filter className="size-4" /> Filter / Strainer Spec
                  </div>
                  <p className="text-sm font-semibold text-foreground">{consumables.filterSpec}</p>
                  <p className="text-xs text-muted-foreground">
                    Replace cartridge elements during routine PM interval.
                  </p>
                </div>
              )}

              <div className="rounded-lg border border-border bg-card/60 p-3.5 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-rose-600 dark:text-rose-400">
                  <Clock className="size-4" /> Lubrication Interval
                </div>
                <p className="text-xs font-medium text-foreground">{consumables.lubeInterval}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground border border-border/70">
              <div className="flex items-start gap-2.5 min-w-0 flex-1">
                <Wrench className="size-4 text-primary shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-foreground">
                    Operator &amp; Mechanic Inspection Note:{" "}
                  </span>
                  {consumables.inspectionNotes}
                </div>
              </div>
              <EditAssetPartsDialog
                assetId={a.id}
                assetName={a.name}
                manufacturer={a.manufacturer}
                model={a.model}
                currentParts={parts}
                defaultTab="feedback"
                trigger={
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 gap-1 text-xs text-amber-600 hover:bg-amber-500/10 dark:text-amber-400 shrink-0"
                  >
                    <AlertTriangle className="size-3.5" />
                    Not the right parts/specs?
                  </Button>
                }
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="maintenance" className="mt-4 space-y-4">
          <div className="panel flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="text-sm font-medium">Manufacturer maintenance lookup</p>
              <p className="text-xs text-muted-foreground">
                Pulls published O&amp;M intervals, wear parts, and manual links for this make/model.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {a.manufacturer_url && (
                <a
                  href={a.manufacturer_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-primary underline"
                >
                  Manufacturer site <ExternalLink className="size-3.5" />
                </a>
              )}
              <Button onClick={() => lookup.mutate()} disabled={lookup.isPending}>
                <Sparkles className="size-4" />
                {lookup.isPending
                  ? "Researching…"
                  : info.data
                    ? "Refresh data"
                    : "Look up maintenance info"}
              </Button>
            </div>
          </div>

          {info.data ? (
            <div className="space-y-4">
              <div className="panel p-4">
                <p className="label-caps">Summary</p>
                <p className="mt-1 text-sm">{info.data.summary}</p>
              </div>

              {intervals.length > 0 && (
                <div className="panel p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="label-caps">Recommended intervals</p>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={addPms.isPending}
                      onClick={() => addPms.mutate(intervals)}
                    >
                      <CalendarPlus className="size-4" />
                      Add all to PM schedule
                    </Button>
                  </div>
                  <ul className="mt-2 divide-y divide-border">
                    {intervals.map((i, idx) => (
                      <li key={idx} className="py-2">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <span className="text-sm font-medium">{i.task}</span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-primary">{i.frequency}</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={addPms.isPending}
                              onClick={() => addPms.mutate([i])}
                            >
                              <CalendarPlus className="size-4" />
                              Add PM
                            </Button>
                          </div>
                        </div>
                        {i.notes && (
                          <p className="mt-0.5 text-xs text-muted-foreground">{i.notes}</p>
                        )}
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Every {frequencyToDays(i.frequency)} days
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="panel p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <p className="label-caps">Wear &amp; spare parts</p>
                    <Badge variant="secondary" className="text-xs">
                      {parts.length}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <EditAssetPartsDialog
                      assetId={a.id}
                      assetName={a.name}
                      manufacturer={a.manufacturer}
                      model={a.model}
                      currentParts={parts}
                      defaultTab="feedback"
                      trigger={
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-1 text-xs text-amber-600 hover:bg-amber-500/10 dark:text-amber-400"
                        >
                          <AlertTriangle className="size-3.5" />
                          Not the right parts?
                        </Button>
                      }
                    />
                    <EditAssetPartsDialog
                      assetId={a.id}
                      assetName={a.name}
                      manufacturer={a.manufacturer}
                      model={a.model}
                      currentParts={parts}
                      defaultTab="manage"
                      trigger={
                        <Button size="sm" variant="outline" className="gap-1 text-xs">
                          <Plus className="size-3" /> Edit / Add parts
                        </Button>
                      }
                    />
                    {parts.length > 0 && (
                      <SendPartsDialog
                        asset={{ id: a.id, name: a.name, manufacturer: a.manufacturer }}
                        lockAsset
                        trigger={
                          <Button size="sm" variant="outline" className="gap-1 text-xs">
                            <Send className="size-3 text-primary" /> Request all parts
                          </Button>
                        }
                      />
                    )}
                  </div>
                </div>

                {parts.length > 0 ? (
                  <ul className="mt-3 divide-y divide-border">
                    {parts.map((p, idx) => (
                      <li
                        key={idx}
                        className="flex flex-wrap items-center justify-between gap-3 py-2.5"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-foreground">{p.name}</span>
                            {p.part_number ? (
                              <span className="font-mono text-xs text-primary font-medium">
                                P/N: {p.part_number}
                              </span>
                            ) : (
                              <span className="text-xs italic text-muted-foreground">
                                No OEM P/N
                              </span>
                            )}
                          </div>
                          {p.notes && (
                            <p className="mt-0.5 text-xs text-muted-foreground">{p.notes}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <SendPartsDialog
                            asset={{ id: a.id, name: a.name, manufacturer: a.manufacturer }}
                            lockAsset
                            initialPart={{
                              name: p.name,
                              part_number: p.part_number,
                              manufacturer: a.manufacturer,
                              qty: 1,
                            }}
                            trigger={
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs font-semibold text-primary hover:bg-primary/10"
                              >
                                <Send className="size-3 mr-1" /> Send to coordinator
                              </Button>
                            }
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => deletePartMutation.mutate(idx)}
                            disabled={deletePartMutation.isPending}
                            title="Delete part (not right for this asset)"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="mt-3 rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                    <p>No parts stored for this asset.</p>
                    <p className="mt-1">
                      Click "Edit / Add parts" to add custom items or "Not the right parts?" to
                      research with custom equipment specs.
                    </p>
                  </div>
                )}
              </div>

              {sources.length > 0 && (
                <div className="panel p-4">
                  <p className="label-caps">Sources</p>
                  <ul className="mt-2 space-y-1">
                    {sources.map((s, idx) => (
                      <li key={idx}>
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-sm text-primary underline"
                        >
                          {s.title} <ExternalLink className="size-3.5" />
                        </a>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-xs text-muted-foreground">
                    AI-assisted research — verify against the manufacturer manual before performing
                    work.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No manufacturer data stored yet for this asset. Run a lookup to pull it in.
            </p>
          )}
        </TabsContent>

        <TabsContent value="pms" className="mt-4">
          <div className="panel divide-y divide-border">
            {(pms.data ?? []).map((pm) => {
              const tone = dueTone(pm.next_due);
              return (
                <div key={pm.id} className="flex flex-wrap items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{pm.title}</p>
                    <p className="text-xs text-muted-foreground">
                      Every {pm.interval_days} days · {prettyLabel(pm.priority)} priority
                    </p>
                    {pm.tasks && <p className="mt-1 text-xs text-muted-foreground">{pm.tasks}</p>}
                  </div>
                  <Badge
                    variant={
                      tone === "overdue" ? "destructive" : tone === "due" ? "secondary" : "outline"
                    }
                    className="font-mono"
                  >
                    {pm.next_due}
                  </Badge>
                  <WorkOrderDialog
                    assetId={a.id}
                    pmScheduleId={pm.id}
                    defaultTitle={pm.title}
                    lockAsset
                    trigger={
                      <Button size="sm" variant="outline">
                        Issue WO
                      </Button>
                    }
                  />
                </div>
              );
            })}
            {(pms.data ?? []).length === 0 && (
              <p className="p-3 text-sm text-muted-foreground">No PM schedules for this asset.</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <div className="panel divide-y divide-border">
            {(wos.data ?? []).map((wo) => (
              <div key={wo.id} className="flex flex-wrap items-center gap-3 p-3">
                <span className="font-mono text-xs text-muted-foreground">WO-{wo.wo_number}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{wo.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {prettyLabel(wo.wo_type)} · {wo.due_date ? `due ${wo.due_date}` : "no due date"}
                  </p>
                </div>
                <Badge variant="outline">{prettyLabel(wo.status)}</Badge>
              </div>
            ))}
            {(wos.data ?? []).length === 0 && (
              <p className="p-3 text-sm text-muted-foreground">
                No work orders logged for this asset.
              </p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { researchAssetMaintenance } from "@/lib/maintenance.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WorkOrderDialog } from "@/components/work-order-dialog";
import { classLabel, dueTone, manualList, prettyLabel } from "@/lib/cmms";
import { assetDocuments } from "@/lib/asset-documents";
import { toast } from "sonner";
import { ArrowLeft, ExternalLink, Plus, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/assets/$assetId")({
  head: () => ({
    meta: [
      { title: "Asset Detail | CMMSCord AI" },
      { name: "description", content: "Nameplate specs, manufacturer maintenance data, PMs, and work order history." },
      { property: "og:title", content: "Asset Detail" },
      { property: "og:description", content: "Specifications, maintenance program, and work order history." },
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
      const { data, error } = await supabase.from("assets").select("*").eq("id", assetId).maybeSingle();
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
    mutationFn: () => research({ data: { assetId } }),
    onSuccess: () => {
      toast.success("Manufacturer maintenance data retrieved");
      queryClient.invalidateQueries({ queryKey: ["asset-info", assetId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (asset.isLoading) return <p className="text-sm text-muted-foreground">Loading asset…</p>;
  if (!asset.data) return <p className="text-sm text-muted-foreground">Asset not found.</p>;

  const a = asset.data;
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
    ["Location", a.location_name],
    ["Commissioned", a.commission_date],
    ["Limble ID", a.limble_asset_id ? String(a.limble_asset_id) : null],
  ];

  const intervals = (info.data?.intervals as Interval[] | null) ?? [];
  const parts = (info.data?.parts as Part[] | null) ?? [];
  const sources = (info.data?.sources as Source[] | null) ?? [];

  return (
    <div className="space-y-5">
      <Link to="/assets" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:underline">
        <ArrowLeft className="size-4" /> All assets
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="label-caps">{classLabel(a.class)}</p>
          <h1 className="text-2xl font-bold">{a.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant="outline">{prettyLabel(a.status)}</Badge>
            <Badge variant={a.criticality === "high" ? "destructive" : "secondary"}>
              {prettyLabel(a.criticality)} criticality
            </Badge>
            {a.tag_number && <span className="font-mono text-xs text-muted-foreground">{a.tag_number}</span>}
          </div>
        </div>
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
      </div>

      <Tabs defaultValue="specs">
        <TabsList>
          <TabsTrigger value="specs">Specifications</TabsTrigger>
          <TabsTrigger value="maintenance">Manufacturer data</TabsTrigger>
          <TabsTrigger value="pms">PMs ({pms.data?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="manuals">Manuals ({manuals.data?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="history">Work orders ({wos.data?.length ?? 0})</TabsTrigger>
        </TabsList>

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
                  <a href={m.file_url} target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">
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
                  No manuals attached yet. Add one here, or attach an existing document from the Manuals page.
                </li>
              )}
            </ul>
            {manualList(a.manuals).length > 0 && (
              <div className="mt-5 border-t border-border pt-4">
                <p className="label-caps">Referenced in Limble</p>
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {manualList(a.manuals).map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </TabsContent>


        <TabsContent value="specs" className="mt-4">
          <div className="panel p-4">
            <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
              {specs.map(([label, value]) => (
                <div key={label}>
                  <dt className="label-caps">{label}</dt>
                  <dd className="font-mono text-sm">{value || "—"}</dd>
                </div>
              ))}
            </dl>


            {manualList(a.manuals).length > 0 && (
              <div className="mt-5 border-t border-border pt-4">
                <p className="label-caps">Manuals on file</p>
                <ul className="mt-2 space-y-1 text-sm">
                  {manualList(a.manuals).map((m) => (
                    <li key={m} className="text-muted-foreground">
                      {m}
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
                {lookup.isPending ? "Researching…" : info.data ? "Refresh data" : "Look up maintenance info"}
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
                  <p className="label-caps">Recommended intervals</p>
                  <ul className="mt-2 divide-y divide-border">
                    {intervals.map((i, idx) => (
                      <li key={idx} className="py-2">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <span className="text-sm font-medium">{i.task}</span>
                          <span className="font-mono text-xs text-primary">{i.frequency}</span>
                        </div>
                        {i.notes && <p className="mt-0.5 text-xs text-muted-foreground">{i.notes}</p>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {parts.length > 0 && (
                <div className="panel p-4">
                  <p className="label-caps">Wear &amp; spare parts</p>
                  <ul className="mt-2 divide-y divide-border">
                    {parts.map((p, idx) => (
                      <li key={idx} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                        <span className="text-sm">{p.name}</span>
                        <span className="font-mono text-xs text-muted-foreground">{p.part_number ?? "—"}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

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
                    AI-assisted research — verify against the manufacturer manual before performing work.
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
                    variant={tone === "overdue" ? "destructive" : tone === "due" ? "secondary" : "outline"}
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
              <p className="p-3 text-sm text-muted-foreground">No work orders logged for this asset.</p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

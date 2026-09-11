import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { BarChart3, Download } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Cost & Uptime Reports | AssetCareConnect" },
      {
        name: "description",
        content:
          "Repair costs, downtime, and PM completion rates across the plant — useful for budgeting and repair-vs-replace decisions.",
      },
      { property: "og:title", content: "Cost & Uptime Reports" },
      {
        property: "og:description",
        content: "Repair spend, downtime, and PM performance per asset.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReportsPage,
});

type AssetRow = {
  id: string;
  name: string;
  building: string | null;
  status: string;
};

type WoRow = {
  asset_id: string | null;
  status: string;
  labor_hours: number | null;
};

type PrRow = {
  asset_id: string | null;
  status: string;
  quoted_cost: number | null;
  awarded_cost: number | null;
};

type PmRow = {
  id: string;
  asset_id: string | null;
  active: boolean;
  next_due: string;
  last_completed: string | null;
};

const DOWN_STATUSES = new Set(["down", "needs_repair", "offline", "maintenance"]);
const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function ReportsPage() {
  const [laborRate, setLaborRate] = useState("85");

  const assets = useQuery({
    queryKey: ["report-assets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assets")
        .select("id, name, building, status")
        .order("name");
      if (error) throw error;
      return data as AssetRow[];
    },
  });

  const wos = useQuery({
    queryKey: ["report-wos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_orders")
        .select("asset_id, status, labor_hours");
      if (error) throw error;
      return data as WoRow[];
    },
  });

  const prs = useQuery({
    queryKey: ["report-part-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("part_requests")
        .select("asset_id, status, quoted_cost, awarded_cost");
      if (error) throw error;
      return data as PrRow[];
    },
  });

  const pms = useQuery({
    queryKey: ["report-pms"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pm_schedules")
        .select("id, asset_id, active, next_due, last_completed");
      if (error) throw error;
      return data as PmRow[];
    },
  });

  const rate = Number(laborRate) || 85;
  const today = new Date().toISOString().slice(0, 10);

  const model = useMemo(() => {
    const assetRows = assets.data ?? [];
    const assetById = new Map(assetRows.map((a) => [a.id, a]));

    const stats = new Map<
      string,
      {
        asset: AssetRow;
        workOrders: number;
        laborCost: number;
        partsCost: number;
        total: number;
      }
    >();
    const ensure = (asset: AssetRow) => {
      let s = stats.get(asset.id);
      if (!s) {
        s = { asset, workOrders: 0, laborCost: 0, partsCost: 0, total: 0 };
        stats.set(asset.id, s);
      }
      return s;
    };

    for (const wo of wos.data ?? []) {
      if (!wo.asset_id) continue;
      const asset = assetById.get(wo.asset_id);
      if (!asset) continue;
      const s = ensure(asset);
      s.workOrders += 1;
      s.laborCost += (wo.labor_hours ?? 0) * rate;
    }
    for (const pr of prs.data ?? []) {
      if (pr.status === "cancelled" || !pr.asset_id) continue;
      const asset = assetById.get(pr.asset_id);
      if (!asset) continue;
      const s = ensure(asset);
      s.partsCost += pr.awarded_cost ?? pr.quoted_cost ?? 0;
    }
    for (const s of stats.values()) s.total = s.laborCost + s.partsCost;

    const rows = [...stats.values()].sort((a, b) => b.total - a.total);
    const totalSpend = rows.reduce((sum, r) => sum + r.total, 0);
    const totalLabor = rows.reduce((sum, r) => sum + r.laborCost, 0);
    const totalParts = rows.reduce((sum, r) => sum + r.partsCost, 0);

    const downCount = assetRows.filter((a) => DOWN_STATUSES.has(a.status)).length;
    const upPct =
      assetRows.length > 0
        ? Math.round(((assetRows.length - downCount) / assetRows.length) * 100)
        : 100;

    const activePms = (pms.data ?? []).filter((p) => p.active);
    const overduePms = activePms.filter((p) => p.next_due < today);
    const compliance =
      activePms.length > 0
        ? Math.round(((activePms.length - overduePms.length) / activePms.length) * 100)
        : 100;

    const openWos = (wos.data ?? []).filter(
      (w) => w.status !== "completed" && w.status !== "cancelled",
    ).length;

    return {
      rows,
      totalSpend,
      totalLabor,
      totalParts,
      downCount,
      upPct,
      overduePms: overduePms.length,
      activePms: activePms.length,
      compliance,
      openWos,
      unassignedSpend:
        (prs.data ?? [])
          .filter((p) => p.status !== "cancelled" && !p.asset_id)
          .reduce((sum, p) => sum + (p.awarded_cost ?? p.quoted_cost ?? 0), 0) +
        (wos.data ?? [])
          .filter((w) => !w.asset_id)
          .reduce((sum, w) => sum + (w.labor_hours ?? 0) * rate, 0),
    };
  }, [assets.data, wos.data, prs.data, pms.data, rate, today]);

  const exportCsv = () => {
    const header = "Asset,Building,Status,Work orders,Labor cost,Parts cost,Total cost";
    const lines = model.rows.map((r) =>
      [
        `"${r.asset.name.replace(/"/g, '""')}"`,
        `"${r.asset.building ?? ""}"`,
        r.asset.status,
        r.workOrders,
        r.laborCost.toFixed(2),
        r.partsCost.toFixed(2),
        r.total.toFixed(2),
      ].join(","),
    );
    const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `repair-cost-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const loading = assets.isLoading || wos.isLoading || prs.isLoading || pms.isLoading;
  const maxTotal = model.rows[0]?.total ?? 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-caps">Plant performance</p>
          <h1 className="text-2xl font-bold">Cost &amp; uptime reports</h1>
        </div>
        <div className="flex items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="labor-rate" className="text-xs">
              Labor rate ($/hr)
            </Label>
            <Input
              id="labor-rate"
              type="number"
              className="h-9 w-24"
              value={laborRate}
              onChange={(e) => setLaborRate(e.target.value)}
            />
          </div>
          <Button variant="outline" onClick={exportCsv} disabled={model.rows.length === 0}>
            <Download className="size-4" /> Export CSV
          </Button>
        </div>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Crunching the numbers…</p>}

      {!loading && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="panel p-4">
              <p className="label-caps">Total repair spend</p>
              <p className="text-2xl font-bold">{usd(model.totalSpend)}</p>
              <p className="text-xs text-muted-foreground">
                Parts {usd(model.totalParts)} · Labor {usd(model.totalLabor)}
              </p>
            </div>
            <div className="panel p-4">
              <p className="label-caps">Equipment uptime</p>
              <p className="text-2xl font-bold">{model.upPct}%</p>
              <p className="text-xs text-muted-foreground">
                {model.downCount} of {assets.data?.length ?? 0} assets down / under repair
              </p>
            </div>
            <div className="panel p-4">
              <p className="label-caps">PM compliance</p>
              <p className="text-2xl font-bold">{model.compliance}%</p>
              <p className="text-xs text-muted-foreground">
                {model.overduePms} overdue of {model.activePms} active schedules
              </p>
            </div>
            <div className="panel p-4">
              <p className="label-caps">Open work orders</p>
              <p className="text-2xl font-bold">{model.openWos}</p>
              <p className="text-xs text-muted-foreground">
                {model.unassignedSpend > 0 && (
                  <>
                    {usd(model.unassignedSpend)} of costs not tied to an asset
                  </>
                )}
                {model.unassignedSpend === 0 && "All costs tied to equipment"}
              </p>
            </div>
          </div>

          <div className="panel">
            <div className="flex items-center gap-2 border-b border-border p-3">
              <BarChart3 className="size-4 text-primary" />
              <h2 className="text-sm font-semibold">Repair cost by asset</h2>
              <span className="ml-auto text-xs text-muted-foreground">
                {model.rows.length} assets with tracked work
              </span>
            </div>
            <div className="divide-y divide-border">
              {model.rows.map((r) => (
                <div key={r.asset.id} className="flex flex-wrap items-center gap-3 p-3">
                  <div className="min-w-48 flex-1">
                    <Link
                      to="/assets/$assetId"
                      params={{ assetId: r.asset.id }}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      {r.asset.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {[r.asset.building, r.asset.status, `${r.workOrders} work orders`]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <div className="hidden h-2 w-40 overflow-hidden rounded-full bg-muted sm:block">
                    <div
                      className="h-full rounded-full bg-primary/70"
                      style={{ width: maxTotal > 0 ? `${(r.total / maxTotal) * 100}%` : "0%" }}
                    />
                  </div>
                  <div className="w-52 text-right font-mono text-xs text-muted-foreground">
                    <p>
                      Parts {usd(r.partsCost)} · Labor {usd(r.laborCost)}
                    </p>
                    <p className="text-sm font-bold text-foreground">{usd(r.total)}</p>
                  </div>
                </div>
              ))}
              {model.rows.length === 0 && (
                <p className="p-4 text-sm text-muted-foreground">
                  No costs logged yet — repair costs build up here as work orders are completed and
                  parts requests are quoted.
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

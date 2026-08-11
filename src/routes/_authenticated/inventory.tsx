import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
import { isLowStock, MOVEMENT_KINDS, recordMovement, type MovementKind } from "@/lib/inventory";
import { prettyLabel } from "@/lib/cmms";
import { SendPartsDialog } from "@/components/send-parts-dialog";
import { toast } from "sonner";
import { Boxes, ExternalLink, PackagePlus, Plus, Search, Send, TriangleAlert } from "lucide-react";

export const Route = createFileRoute("/_authenticated/inventory")({
  head: () => ({
    meta: [
      { title: "Parts Inventory | AssetCareConnect" },
      {
        name: "description",
        content:
          "Track spare part stock levels, storage locations, and which equipment each part fits.",
      },
      { property: "og:title", content: "Parts Inventory" },
      {
        property: "og:description",
        content: "Stock on hand, low-stock alerts, and part-to-equipment links.",
      },
    ],
  }),
  component: InventoryPage,
});

type PartWithLinks = {
  id: string;
  name: string;
  part_number: string | null;
  manufacturer: string | null;
  description: string | null;
  unit: string;
  where_to_buy: string | null;
  unit_cost: number | null;
  qty_on_hand: number;
  min_qty: number;
  location: string | null;
  bin: string | null;
  part_assets: { id: string; asset_id: string; assets: { id: string; name: string } | null }[];
};

function NewPartDialog() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    part_number: "",
    manufacturer: "",
    unit: "ea",
    qty_on_hand: "0",
    min_qty: "0",
    location: "",
    bin: "",
    unit_cost: "",
    where_to_buy: "",
    description: "",
  });
  const queryClient = useQueryClient();

  const save = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Give the part a name.");
      const userId = (await supabase.auth.getUser()).data.user?.id ?? null;
      const { error } = await supabase.from("parts").insert({
        name: form.name.trim(),
        part_number: form.part_number.trim() || null,
        manufacturer: form.manufacturer.trim() || null,
        unit: form.unit.trim() || "ea",
        qty_on_hand: Number(form.qty_on_hand) || 0,
        min_qty: Number(form.min_qty) || 0,
        location: form.location.trim() || null,
        bin: form.bin.trim() || null,
        unit_cost: form.unit_cost.trim() ? Number(form.unit_cost) : null,
        where_to_buy: form.where_to_buy.trim() || null,
        description: form.description.trim() || null,
        created_by: userId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Part added to inventory");
      queryClient.invalidateQueries({ queryKey: ["parts"] });
      setOpen(false);
      setForm({ ...form, name: "", part_number: "", description: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const field = (key: keyof typeof form, label: string, props: Record<string, unknown> = {}) => (
    <div className="space-y-1.5">
      <Label htmlFor={key}>{label}</Label>
      <Input
        id={key}
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        {...props}
      />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" /> New part
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New part</DialogTitle>
          <DialogDescription>Add a spare part to the storeroom.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">{field("name", "Part name")}</div>
          {field("part_number", "Part number")}
          {field("manufacturer", "Manufacturer")}
          {field("qty_on_hand", "Qty on hand", { type: "number", inputMode: "decimal" })}
          {field("min_qty", "Minimum level", { type: "number", inputMode: "decimal" })}
          {field("unit", "Unit")}
          {field("unit_cost", "Unit cost", { type: "number", inputMode: "decimal" })}
          {field("location", "Storage location")}
          {field("bin", "Bin / shelf")}
          {field("where_to_buy", "Where to buy")}
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="description">Notes</Label>
            <Textarea
              id="description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
        </div>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Add part"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function MovementDialog({ part }: { part: PartWithLinks }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<MovementKind>("issue");
  const [qty, setQty] = useState("1");
  const [assetId, setAssetId] = useState("none");
  const [woId, setWoId] = useState("none");
  const [note, setNote] = useState("");
  const queryClient = useQueryClient();

  const history = useQuery({
    queryKey: ["part-history", part.id],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("part_transactions")
        .select("id, kind, qty, note, created_at, assets(name), work_orders(wo_number)")
        .eq("part_id", part.id)
        .order("created_at", { ascending: false })
        .limit(25);
      if (error) throw error;
      return data;
    },
  });

  const openWos = useQuery({
    queryKey: ["open-work-orders"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_orders")
        .select("id, wo_number, title")
        .in("status", ["open", "in_progress", "on_hold"])
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const value = Number(qty);
      if (!Number.isFinite(value)) throw new Error("Enter a quantity.");
      await recordMovement({
        partId: part.id,
        kind,
        qty: value,
        assetId: assetId === "none" ? null : assetId,
        workOrderId: woId === "none" ? null : woId,
        note,
      });
    },
    onSuccess: () => {
      toast.success("Stock updated");
      queryClient.invalidateQueries({ queryKey: ["parts"] });
      queryClient.invalidateQueries({ queryKey: ["part-history", part.id] });
      setNote("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Stock
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{part.name}</DialogTitle>
          <DialogDescription>
            {part.qty_on_hand} {part.unit} on hand · minimum {part.min_qty}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Movement</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as MovementKind)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MOVEMENT_KINDS.map((k) => (
                  <SelectItem key={k} value={k}>
                    {k === "adjust" ? "Adjust (set count)" : prettyLabel(k)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qty">{kind === "adjust" ? "Counted quantity" : "Quantity"}</Label>
            <Input
              id="qty"
              type="number"
              inputMode="decimal"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Equipment</Label>
            <Select value={assetId} onValueChange={setAssetId}>
              <SelectTrigger>
                <SelectValue placeholder="No equipment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No equipment</SelectItem>
                {part.part_assets
                  .filter((l) => l.assets)
                  .map((l) => (
                    <SelectItem key={l.asset_id} value={l.asset_id}>
                      {l.assets!.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Work order</Label>
            <Select value={woId} onValueChange={setWoId}>
              <SelectTrigger>
                <SelectValue placeholder="No work order" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No work order</SelectItem>
                {(openWos.data ?? []).map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    WO-{w.wo_number} {w.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="note">Note</Label>
            <Input id="note" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Record movement"}
        </Button>

        <div>
          <p className="label-caps mb-2">History</p>
          <div className="panel divide-y divide-border">
            {(history.data ?? []).map((h) => (
              <div key={h.id} className="flex flex-wrap items-center gap-2 p-2 text-xs">
                <Badge variant="outline">{prettyLabel(h.kind)}</Badge>
                <span className="font-medium">{h.qty}</span>
                <span className="text-muted-foreground">
                  {[h.assets?.name, h.work_orders ? `WO-${h.work_orders.wo_number}` : null, h.note]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                <span className="ml-auto text-muted-foreground">{h.created_at.slice(0, 10)}</span>
              </div>
            ))}
            {(history.data ?? []).length === 0 && (
              <p className="p-2 text-xs text-muted-foreground">No movements recorded yet.</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InventoryPage() {
  const [search, setSearch] = useState("");
  const [lowOnly, setLowOnly] = useState(false);

  const parts = useQuery({
    queryKey: ["parts", search],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let query = supabase
        .from("parts")
        .select(
          "id, name, part_number, manufacturer, description, unit, where_to_buy, unit_cost, qty_on_hand, min_qty, location, bin, part_assets(id, asset_id, assets(id, name))",
        )
        .order("name")
        .limit(300);
      if (search.trim()) {
        const term = `%${search.trim()}%`;
        query = query.or(`name.ilike.${term},part_number.ilike.${term},manufacturer.ilike.${term}`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as PartWithLinks[];
    },
  });

  const rows = (parts.data ?? []).filter((p) => !lowOnly || isLowStock(p));
  const lowCount = (parts.data ?? []).filter(isLowStock).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-caps">Storeroom</p>
          <h1 className="text-2xl font-bold">Parts inventory</h1>
        </div>
        <div className="flex items-center gap-2">
          <SendPartsDialog
            trigger={
              <Button variant="outline" className="gap-1.5 font-semibold text-xs shadow-sm">
                <Send className="size-3.5 text-primary" /> Send to coordinator / supervisor
              </Button>
            }
          />
          <NewPartDialog />
        </div>
      </div>

      <div className="panel flex flex-wrap items-center gap-3 p-3">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search parts, part numbers, manufacturers…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button variant={lowOnly ? "default" : "outline"} onClick={() => setLowOnly((v) => !v)}>
          <TriangleAlert className="size-4" /> Low stock ({lowCount})
        </Button>
      </div>

      <div className="panel divide-y divide-border">
        {rows.map((part) => (
          <div key={part.id} className="flex flex-wrap items-center gap-3 p-3">
            <Boxes className="size-4 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{part.name}</p>
              <p className="text-xs text-muted-foreground">
                {[
                  part.part_number ? `P/N ${part.part_number}` : null,
                  part.manufacturer,
                  part.location ? `at ${part.location}${part.bin ? ` / ${part.bin}` : ""}` : null,
                  part.unit_cost != null ? `$${part.unit_cost}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {part.part_assets.length > 0 && (
                <p className="mt-1 flex flex-wrap gap-2 text-xs">
                  {part.part_assets
                    .filter((l) => l.assets)
                    .map((l) => (
                      <Link
                        key={l.id}
                        to="/assets/$assetId"
                        params={{ assetId: l.asset_id }}
                        className="text-primary hover:underline"
                      >
                        {l.assets!.name}
                      </Link>
                    ))}
                </p>
              )}
              {part.where_to_buy && (
                <a
                  href={`https://www.google.com/search?q=${encodeURIComponent(
                    [part.manufacturer, part.part_number, part.name].filter(Boolean).join(" "),
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  Reorder: {part.where_to_buy} <ExternalLink className="size-3" />
                </a>
              )}
            </div>
            <Badge variant={isLowStock(part) ? "destructive" : "outline"}>
              {part.qty_on_hand} {part.unit}
            </Badge>
            <div className="flex items-center gap-1.5">
              <SendPartsDialog
                initialPart={{
                  name: part.name,
                  part_number: part.part_number,
                  manufacturer: part.manufacturer,
                  qty: isLowStock(part)
                    ? Math.max(1, (part.reorder_point ?? 5) - part.qty_on_hand)
                    : 1,
                  where_to_buy: part.where_to_buy,
                  unit_cost: part.unit_cost,
                }}
                trigger={
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-xs font-semibold text-muted-foreground hover:text-primary"
                    title="Send part requisition to supervisor or CMMS coordinator"
                  >
                    <Send className="size-3.5 mr-1 text-primary" />
                    Requisition
                  </Button>
                }
              />
              <MovementDialog part={part} />
            </div>
          </div>
        ))}
        {parts.isLoading && <p className="p-3 text-sm text-muted-foreground">Loading parts…</p>}
        {!parts.isLoading && rows.length === 0 && (
          <p className="p-3 text-sm text-muted-foreground">
            No parts yet — add one here, or send parts from a work order's Parts lookup straight
            into inventory.
          </p>
        )}
      </div>
    </div>
  );
}

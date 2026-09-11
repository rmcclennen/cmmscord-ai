import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { upsertPartAndLink } from "@/lib/inventory";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus } from "lucide-react";

type Props = {
  assetId: string;
  assetName: string;
  manufacturer?: string | null | undefined;
  trigger?: React.ReactNode | undefined;
};

export function AddAssetPartDialog({ assetId, assetName, manufacturer, trigger }: Props) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const [name, setName] = React.useState("");
  const [partNumber, setPartNumber] = React.useState("");
  const [mfr, setMfr] = React.useState("");
  const [whereToBuy, setWhereToBuy] = React.useState("");
  const [notes, setNotes] = React.useState("");

  const queryClient = useQueryClient();

  const existing = useQuery({
    queryKey: ["part-picker", search],
    enabled: open,
    queryFn: async () => {
      let q = supabase
        .from("parts")
        .select("id, name, part_number, manufacturer, qty_on_hand, unit")
        .order("name")
        .limit(30);
      if (search.trim()) {
        const term = `%${search.trim()}%`;
        q = q.or(`name.ilike.${term},part_number.ilike.${term},manufacturer.ilike.${term}`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const reset = () => {
    setSearch("");
    setSelectedId(null);
    setName("");
    setPartNumber("");
    setMfr("");
    setWhereToBuy("");
    setNotes("");
  };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["asset-linked-parts", assetId] });
    queryClient.invalidateQueries({ queryKey: ["parts"] });
    queryClient.invalidateQueries({ queryKey: ["part-picker"] });
  };

  const linkExisting = useMutation({
    mutationFn: async () => {
      if (!selectedId) throw new Error("Pick a part first");
      const { error } = await supabase
        .from("part_assets")
        .upsert({ part_id: selectedId, asset_id: assetId }, { onConflict: "part_id,asset_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`Part added to ${assetName}`);
      invalidate();
      reset();
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createNew = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Part name is required");
      await upsertPartAndLink({
        name,
        part_number: partNumber,
        manufacturer: mfr || manufacturer || null,
        where_to_buy: whereToBuy,
        description: notes,
        assetId,
      });
    },
    onSuccess: () => {
      toast.success(`"${name.trim()}" added to ${assetName}`);
      invalidate();
      reset();
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" className="h-7 gap-1 text-xs">
            <Plus className="size-3.5" /> Add part
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add a part for {assetName}</DialogTitle>
          <DialogDescription>
            Pick a part already in inventory, or enter a brand-new one.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="existing">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="existing" className="text-xs sm:text-sm">
              Pick existing part
            </TabsTrigger>
            <TabsTrigger value="new" className="text-xs sm:text-sm">
              Create new part
            </TabsTrigger>
          </TabsList>

          <TabsContent value="existing" className="space-y-3 pt-3">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search parts, part numbers, manufacturers…"
            />
            <div className="max-h-64 divide-y divide-border overflow-y-auto rounded-lg border border-border">
              {existing.isLoading && (
                <p className="p-3 text-sm text-muted-foreground">Loading parts…</p>
              )}
              {!existing.isLoading && (existing.data ?? []).length === 0 && (
                <p className="p-3 text-sm text-muted-foreground">
                  No parts found — use "Create new part".
                </p>
              )}
              {(existing.data ?? []).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedId(p.id)}
                  className={`flex w-full items-center justify-between gap-3 p-2.5 text-left text-sm hover:bg-muted/50 ${
                    selectedId === p.id ? "bg-primary/10" : ""
                  }`}
                >
                  <span>
                    <span className="font-medium">{p.name}</span>
                    {p.part_number && (
                      <span className="ml-2 font-mono text-xs text-muted-foreground">
                        {p.part_number}
                      </span>
                    )}
                    {p.manufacturer && (
                      <span className="block text-xs text-muted-foreground">{p.manufacturer}</span>
                    )}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {p.qty_on_hand} {p.unit}
                  </span>
                </button>
              ))}
            </div>
            <DialogFooter>
              <Button
                disabled={!selectedId || linkExisting.isPending}
                onClick={() => linkExisting.mutate()}
              >
                {linkExisting.isPending ? "Adding…" : "Add to this equipment"}
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="new" className="space-y-3 pt-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="ap-name">Part name *</Label>
                <Input
                  id="ap-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Mechanical seal kit"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ap-number">Part number</Label>
                <Input
                  id="ap-number"
                  value={partNumber}
                  onChange={(e) => setPartNumber(e.target.value)}
                  placeholder="105-3498-A"
                  className="font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ap-mfr">Manufacturer</Label>
                <Input
                  id="ap-mfr"
                  value={mfr}
                  onChange={(e) => setMfr(e.target.value)}
                  placeholder={manufacturer || "OEM"}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ap-buy">Where to buy</Label>
                <Input
                  id="ap-buy"
                  value={whereToBuy}
                  onChange={(e) => setWhereToBuy(e.target.value)}
                  placeholder="Grainger / Motion Industries"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="ap-notes">Specs / notes</Label>
              <Input
                id="ap-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Silicon carbide faces, Viton elastomers"
              />
            </div>
            <DialogFooter>
              <Button disabled={!name.trim() || createNew.isPending} onClick={() => createNew.mutate()}>
                {createNew.isPending ? "Saving…" : "Create and add"}
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

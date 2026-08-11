import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ManualDialog } from "@/components/manual-dialog";
import { toast } from "sonner";
import { ExternalLink, FileText, Plus, Search, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/manuals")({
  head: () => ({
    meta: [
      { title: "Manuals | AssetCareConnect" },
      {
        name: "description",
        content:
          "Equipment O&M manual library for the wastewater plant, attached to the assets they cover.",
      },
      { property: "og:title", content: "Equipment Manuals" },
      {
        property: "og:description",
        content: "O&M manuals, cut sheets and drawings linked to plant assets.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ManualsPage,
});

function ManualsPage() {
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState("all");
  const queryClient = useQueryClient();

  const manuals = useQuery({
    queryKey: ["manuals", search, scope],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let query = supabase.from("manuals").select("*, assets(id, name)").order("title");
      if (search.trim()) query = query.ilike("title", `%${search.trim()}%`);
      if (scope === "attached") query = query.not("asset_id", "is", null);
      if (scope === "unattached") query = query.is("asset_id", null);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const [assetSearch, setAssetSearch] = useState("");
  const assetOptions = useQuery({
    queryKey: ["asset-options", assetSearch],
    queryFn: async () => {
      let query = supabase.from("assets").select("id, name").order("name").limit(25);
      if (assetSearch.trim()) query = query.ilike("name", `%${assetSearch.trim()}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const attach = useMutation({
    mutationFn: async (v: { id: string; assetId: string | null }) => {
      const { error } = await supabase
        .from("manuals")
        .update({ asset_id: v.assetId })
        .eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Manual attachment updated");
      queryClient.invalidateQueries({ queryKey: ["manuals"] });
      queryClient.invalidateQueries({ queryKey: ["asset-manuals"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("manuals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Manual removed");
      queryClient.invalidateQueries({ queryKey: ["manuals"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rows = manuals.data ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-caps">Document library</p>
          <h1 className="text-2xl font-bold">Manuals</h1>
        </div>
        <ManualDialog
          trigger={
            <Button>
              <Plus className="size-4" /> Add manual
            </Button>
          }
        />
      </div>

      <div className="panel flex flex-wrap items-center gap-3 p-3">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search manuals…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={scope} onValueChange={setScope}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All manuals</SelectItem>
            <SelectItem value="attached">Attached to an asset</SelectItem>
            <SelectItem value="unattached">Not yet attached</SelectItem>
          </SelectContent>
        </Select>
        <span className="font-mono text-xs text-muted-foreground">{rows.length} documents</span>
      </div>

      <div className="panel divide-y divide-border">
        {rows.map((m) => (
          <div key={m.id} className="flex flex-wrap items-center gap-3 p-3">
            <FileText className="size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <a
                href={m.file_url}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-medium text-primary hover:underline"
              >
                {m.title}
                <ExternalLink className="ml-1 inline size-3" />
              </a>
              <p className="text-xs text-muted-foreground">
                {m.assets ? (
                  <Link
                    to="/assets/$assetId"
                    params={{ assetId: m.assets.id }}
                    className="hover:underline"
                  >
                    {m.assets.name}
                  </Link>
                ) : (
                  "Not attached to an asset"
                )}
                {m.manufacturer && ` · ${m.manufacturer}`}
                {m.notes && ` · ${m.notes}`}
              </p>
            </div>
            <Badge variant="outline" className="font-mono">
              {m.kind === "upload" ? "File" : "Link"}
            </Badge>
            <div className="w-56 space-y-1.5">
              <Input
                className="h-8"
                placeholder="Search assets…"
                value={assetSearch}
                onChange={(e) => setAssetSearch(e.target.value)}
              />
              <Select
                value={m.asset_id ?? "unattached"}
                onValueChange={(v) =>
                  attach.mutate({ id: m.id, assetId: v === "unattached" ? null : v })
                }
              >
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="Attach to asset…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unattached">Not attached</SelectItem>
                  {m.assets && !(assetOptions.data ?? []).some((a) => a.id === m.assets!.id) && (
                    <SelectItem value={m.assets.id}>{m.assets.name}</SelectItem>
                  )}
                  {(assetOptions.data ?? []).map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              size="sm"
              variant="ghost"
              disabled={remove.isPending}
              onClick={() => remove.mutate(m.id)}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
        {manuals.isLoading && <p className="p-3 text-sm text-muted-foreground">Loading manuals…</p>}
        {!manuals.isLoading && rows.length === 0 && (
          <p className="p-3 text-sm text-muted-foreground">No manuals match this filter.</p>
        )}
      </div>
    </div>
  );
}

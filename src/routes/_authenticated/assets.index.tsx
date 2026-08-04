import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { classLabel, CLASS_LABELS } from "@/lib/cmms";
import { Search } from "lucide-react";

const PAGE_SIZE = 50;

export const Route = createFileRoute("/_authenticated/assets/")({
  head: () => ({
    meta: [
      { title: "Plant Assets | Plant Maintenance" },
      { name: "description", content: "Searchable register of every wastewater plant asset with nameplate data." },
      { property: "og:title", content: "Plant Assets" },
      { property: "og:description", content: "Search the plant asset register by name, tag, make, or model." },
    ],
  }),
  component: AssetsPage,
});

function AssetsPage() {
  const [search, setSearch] = useState("");
  const [cls, setCls] = useState("all");
  const [page, setPage] = useState(0);

  const assets = useQuery({
    queryKey: ["assets", search, cls, page],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let query = supabase
        .from("assets")
        .select(
          "id, name, tag_number, class, type, make, model, location_name, criticality, status, manufacturer, serial_number, supplier",
          { count: "exact" },
        )
        .order("name")
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

      if (search.trim()) {
        const term = `%${search.trim()}%`;
        query = query.or(
          `name.ilike.${term},tag_number.ilike.${term},make.ilike.${term},model.ilike.${term},serial_number.ilike.${term}`,
        );
      }
      if (cls !== "all") query = query.eq("class", cls);
      const { data, error, count } = await query;
      if (error) throw error;
      return { rows: data, count: count ?? 0 };
    },
  });

  const total = assets.data?.count ?? 0;
  const maxPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);

  return (
    <div className="space-y-5">
      <div>
        <p className="label-caps">Asset register</p>
        <h1 className="text-2xl font-bold">Plant assets</h1>
      </div>

      <div className="panel flex flex-wrap items-center gap-3 p-3">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search name, tag, make, model, serial…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
          />
        </div>
        <Select
          value={cls}
          onValueChange={(v) => {
            setCls(v);
            setPage(0);
          }}
        >
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All classes</SelectItem>
            {Object.keys(CLASS_LABELS).map((c) => (
              <SelectItem key={c} value={c}>
                {CLASS_LABELS[c]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="font-mono text-xs text-muted-foreground">{total} assets</span>
      </div>

      <div className="panel overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Asset</TableHead>
              <TableHead>Class</TableHead>
              <TableHead>Make / Model</TableHead>
              <TableHead>Manufacturer</TableHead>
              <TableHead>Serial</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Criticality</TableHead>

            </TableRow>
          </TableHeader>
          <TableBody>
            {(assets.data?.rows ?? []).map((a) => (
              <TableRow key={a.id}>
                <TableCell>
                  <Link to="/assets/$assetId" params={{ assetId: a.id }} className="font-medium hover:underline">
                    {a.name}
                  </Link>
                  {a.tag_number && (
                    <span className="ml-2 font-mono text-xs text-muted-foreground">{a.tag_number}</span>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{classLabel(a.class)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {[a.make, a.model].filter(Boolean).join(" · ") || "—"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{a.manufacturer ?? "—"}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{a.serial_number ?? "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{a.supplier ?? "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{a.location_name ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={a.criticality === "high" ? "destructive" : "outline"}>{a.criticality}</Badge>
                </TableCell>
              </TableRow>
            ))}
            {assets.isLoading && (
              <TableRow>
                <TableCell colSpan={8} className="text-sm text-muted-foreground">

                  Loading assets…
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          Page {page + 1} of {maxPage + 1}
        </span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <Button variant="outline" size="sm" disabled={page >= maxPage} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

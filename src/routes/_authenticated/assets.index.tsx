import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { classLabel, CLASS_LABELS, BUILDING_NAMES, buildingOf } from "@/lib/cmms";
import { BulkAssetUploader } from "@/components/bulk-asset-uploader";
import { RelabelAssetDialog } from "@/components/relabel-asset-dialog";
import { Camera, Pencil, Search, Tag, UploadCloud } from "lucide-react";

const PAGE_SIZE = 50;

export const Route = createFileRoute("/_authenticated/assets/")({
  head: () => ({
    meta: [
      { title: "Plant Assets | AssetCareConnect" },
      {
        name: "description",
        content: "Searchable register of every wastewater plant asset with nameplate data.",
      },
      { property: "og:title", content: "Plant Assets" },
      {
        property: "og:description",
        content: "Search the plant asset register by name, tag, make, or model.",
      },
    ],
  }),
  component: AssetsPage,
});

function AssetsPage() {
  const [search, setSearch] = useState("");
  const [cls, setCls] = useState("all");
  const [building, setBuilding] = useState("all");
  const [page, setPage] = useState(0);
  const [importOpen, setImportOpen] = useState(false);

  const assets = useQuery({
    queryKey: ["assets-all"],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assets")
        .select(
          "id, name, tag_number, class, type, make, model, location_name, criticality, status, manufacturer, serial_number, supplier, building",
        )
        .order("name")
        .limit(5000);
      if (error) throw error;
      return (data ?? []).map((a) => ({
        ...a,
        building: buildingOf(a.name, null, a.location_name, a.building),
      }));
    },
  });

  const all = useMemo(() => assets.data ?? [], [assets.data]);

  const buildingCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of all) counts.set(a.building, (counts.get(a.building) ?? 0) + 1);
    return counts;
  }, [all]);

  const buildingTabs = useMemo(
    () =>
      [...BUILDING_NAMES, "Lift Stations", "Other / Unassigned"].filter(
        (b) => (buildingCounts.get(b) ?? 0) > 0,
      ),
    [buildingCounts],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return all.filter((a) => {
      if (building !== "all" && a.building !== building) return false;
      if (cls !== "all" && a.class !== cls) return false;
      if (!term) return true;
      return [a.name, a.tag_number, a.make, a.model, a.serial_number, a.manufacturer]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term));
    });
  }, [all, search, cls, building]);

  const total = filtered.length;
  const maxPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);
  const rows = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-caps">Asset register</p>
          <h1 className="text-2xl font-bold">Plant assets</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setImportOpen(true)}
            className="flex items-center gap-2 font-bold"
          >
            <UploadCloud className="size-4 text-primary" /> Bulk Import Spreadsheet
          </Button>
          <Button asChild>
            <Link to="/assets/capture">
              <Camera className="size-4" /> Add by photo
            </Link>
          </Button>
        </div>
      </div>

      <BulkAssetUploader open={importOpen} onOpenChange={setImportOpen} />

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

      <Tabs
        value={building}
        onValueChange={(v) => {
          setBuilding(v);
          setPage(0);
        }}
      >
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="all">All ({all.length})</TabsTrigger>
          {buildingTabs.map((b) => (
            <TabsTrigger key={b} value={b}>
              {b} ({buildingCounts.get(b)})
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="panel overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Asset</TableHead>
              <TableHead>Building / Area</TableHead>
              <TableHead>Class</TableHead>
              <TableHead>Make / Model</TableHead>
              <TableHead>Manufacturer</TableHead>
              <TableHead>Serial</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Criticality</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((a) => (
              <TableRow key={a.id}>
                <TableCell>
                  <Link
                    to="/assets/$assetId"
                    params={{ assetId: a.id }}
                    className="font-medium hover:underline"
                  >
                    {a.name}
                  </Link>
                  {a.tag_number && (
                    <span className="ml-2 font-mono text-xs text-muted-foreground">
                      {a.tag_number}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{a.building}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {classLabel(a.class)}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {[a.make, a.model].filter(Boolean).join(" · ") || "—"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {a.manufacturer ?? "—"}
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {a.serial_number ?? "—"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{a.supplier ?? "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {a.location_name ?? "—"}
                </TableCell>
                <TableCell>
                  <Badge variant={a.criticality === "high" ? "destructive" : "outline"}>
                    {a.criticality}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <RelabelAssetDialog
                    assetId={a.id}
                    initialAsset={a}
                    trigger={
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs font-semibold text-primary hover:bg-primary/10 gap-1"
                        title="Relabel asset across the whole program"
                      >
                        <Tag className="size-3" /> Relabel
                      </Button>
                    }
                  />
                </TableCell>
              </TableRow>
            ))}
            {assets.isLoading && (
              <TableRow>
                <TableCell colSpan={10} className="text-sm text-muted-foreground">
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
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= maxPage}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

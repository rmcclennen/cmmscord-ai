import { useMemo, useState, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";
import { plantForBuilding, slugifyPlant, type Plant } from "@/lib/plants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertOctagon, Building2, Factory, Plus, Save, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/company")({
  head: () => ({
    meta: [
      { title: "Company Workspace — Plants & Facilities | AssetCareConnect" },
      {
        name: "description",
        content:
          "Set your company name, list your plants, and map each building or area to the plant that runs it.",
      },
      { property: "og:title", content: "Company Workspace — Plants & Facilities" },
      {
        property: "og:description",
        content: "Manage your company name, plants, and building-to-plant assignments.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CompanyWorkspacePage,
});

const DOWN_STATUSES = ["down", "needs_repair", "maintenance", "offline"];

function CompanyWorkspacePage() {
  const { workspace, plants, companyName, update } = useWorkspace();
  const [nameDraft, setNameDraft] = useState(companyName);
  const [newPlant, setNewPlant] = useState("");

  useEffect(() => setNameDraft(companyName), [companyName]);

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ["workspace-buildings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("assets").select("id, building, status");
      if (error) throw error;
      return data ?? [];
    },
  });

  const buildings = useMemo(() => {
    const set = new Set<string>();
    assets.forEach((a) => {
      if (a.building && a.building.trim()) set.add(a.building.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [assets]);

  const statsByPlant = useMemo(() => {
    const stats = new Map<string, { total: number; down: number }>();
    plants.forEach((p) => stats.set(p.id, { total: 0, down: 0 }));
    assets.forEach((a) => {
      const plant = plantForBuilding(a.building, plants);
      if (!plant) return;
      const entry = stats.get(plant.id);
      if (!entry) return;
      entry.total += 1;
      if (DOWN_STATUSES.includes(a.status)) entry.down += 1;
    });
    return stats;
  }, [assets, plants]);

  function saveName() {
    const trimmed = nameDraft.trim();
    if (!trimmed) return;
    update({ ...workspace, companyName: trimmed });
    toast.success("Company name saved");
  }

  function addPlant() {
    const name = newPlant.trim();
    if (!name) return;
    const id = slugifyPlant(name);
    if (plants.some((p) => p.id === id)) {
      toast.error("That plant already exists");
      return;
    }
    update({ ...workspace, plants: [...plants, { id, name, buildings: [] }] });
    setNewPlant("");
    toast.success(`${name} added`);
  }

  function renamePlant(id: string, name: string) {
    update({
      ...workspace,
      plants: plants.map((p) => (p.id === id ? { ...p, name } : p)),
    });
  }

  function removePlant(id: string) {
    if (plants.length <= 1) {
      toast.error("Keep at least one plant");
      return;
    }
    update({ ...workspace, plants: plants.filter((p) => p.id !== id) });
    toast.success("Plant removed");
  }

  function assignBuilding(building: string, plantId: string) {
    const next: Plant[] = plants.map((p) => ({
      ...p,
      buildings: p.buildings.filter((b) => b.trim().toLowerCase() !== building.toLowerCase()),
    }));
    const target = next.find((p) => p.id === plantId);
    if (target) target.buildings = [...target.buildings, building];
    update({ ...workspace, plants: next });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 border-b border-border/80 pb-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Factory className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight">Company Workspace</h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {companyName} — {plants.length} plant{plants.length === 1 ? "" : "s"}, {buildings.length}{" "}
              building{buildings.length === 1 ? "" : "s"} mapped
            </p>
          </div>
        </div>
        <Button asChild size="sm" variant="outline" className="h-8 gap-1.5 text-xs font-semibold">
          <Link to="/equipment-down">
            <AlertOctagon className="size-3.5 text-destructive" />
            View Equipment Down by Plant
          </Link>
        </Button>
      </div>

      {/* Company name */}
      <section className="panel space-y-3 p-4">
        <h2 className="text-sm font-bold">Company name</h2>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            className="h-9 max-w-md text-xs"
            placeholder="City of Sioux City WWTP"
          />
          <Button size="sm" onClick={saveName} className="h-9 gap-1.5 text-xs font-bold">
            <Save className="size-3.5" />
            Save
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          This name appears across reports, print packets, and alerts.
        </p>
      </section>

      {/* Plants */}
      <section className="panel space-y-3 p-4">
        <h2 className="text-sm font-bold">Plants &amp; facilities</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {plants.map((plant, index) => {
            const stats = statsByPlant.get(plant.id) ?? { total: 0, down: 0 };
            return (
              <div key={plant.id} className="rounded-lg border border-border/70 bg-card p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <Input
                    value={plant.name}
                    onChange={(e) => renamePlant(plant.id, e.target.value)}
                    className="h-8 border-transparent bg-transparent px-1 text-sm font-bold focus-visible:border-input focus-visible:bg-background"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => removePlant(plant.id)}
                    className="size-7 text-muted-foreground hover:text-destructive"
                    aria-label={`Remove ${plant.name}`}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <Badge variant="secondary" className="text-[11px] font-mono">
                    {stats.total} assets
                  </Badge>
                  <Badge
                    variant={stats.down > 0 ? "destructive" : "outline"}
                    className="text-[11px] font-mono"
                  >
                    {stats.down} down / repair
                  </Badge>
                  {index === 0 && (
                    <Badge variant="outline" className="text-[11px]">
                      Default for unmapped buildings
                    </Badge>
                  )}
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {plant.buildings.length > 0
                    ? plant.buildings.join(" · ")
                    : "No buildings assigned yet"}
                </p>
              </div>
            );
          })}
        </div>

        <div className="flex flex-col gap-2 border-t border-border/60 pt-3 sm:flex-row">
          <Input
            value={newPlant}
            onChange={(e) => setNewPlant(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addPlant();
              }
            }}
            placeholder="Add a plant, e.g. Renewable Fuels"
            className="h-9 max-w-md text-xs"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={addPlant}
            className="h-9 gap-1.5 text-xs font-bold"
          >
            <Plus className="size-3.5" />
            Add plant
          </Button>
        </div>
      </section>

      {/* Building mapping */}
      <section className="panel space-y-3 p-4">
        <div>
          <h2 className="text-sm font-bold">Buildings &amp; areas</h2>
          <p className="text-[11px] text-muted-foreground">
            Every building belongs to one plant. Equipment inherits its plant from its building.
          </p>
        </div>

        {isLoading ? (
          <p className="py-6 text-center text-xs text-muted-foreground">Loading buildings…</p>
        ) : buildings.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            No buildings found on your equipment yet.
          </p>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {buildings.map((b) => {
              const current = plantForBuilding(b, plants);
              const explicit = plants.some((p) =>
                p.buildings.some((x) => x.trim().toLowerCase() === b.toLowerCase()),
              );
              return (
                <div
                  key={b}
                  className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-card px-3 py-2"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <Building2 className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate text-xs font-semibold">{b}</span>
                    {!explicit && (
                      <span className="text-[10px] text-muted-foreground">(default)</span>
                    )}
                  </div>
                  <Select
                    value={current?.id ?? ""}
                    onValueChange={(v) => assignBuilding(b, v)}
                  >
                    <SelectTrigger className="h-8 w-44 text-xs">
                      <SelectValue placeholder="Assign plant" />
                    </SelectTrigger>
                    <SelectContent>
                      {plants.map((p) => (
                        <SelectItem key={p.id} value={p.id} className="text-xs">
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

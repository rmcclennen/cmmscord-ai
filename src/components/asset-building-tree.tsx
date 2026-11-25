import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Building2, ChevronDown, ChevronRight, Layers, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ShowMoreList } from "@/components/show-more-list";
import { BUILDING_NAMES } from "@/lib/cmms";
import { buildAssetTree, treeAssetIds, type AssetTreeNode, type TreeAsset } from "@/lib/asset-tree";

function EquipmentBranch({ node }: { node: AssetTreeNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-w-0">
      <div className="flex min-w-0 items-start gap-1 py-1">
        {node.children.length > 0 ? (
          <Button variant="ghost" size="icon" className="size-6 shrink-0" aria-label={`${open ? "Collapse" : "Expand"} ${node.asset.name}`} aria-expanded={open} onClick={() => setOpen(!open)}>
            {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
          </Button>
        ) : <Wrench className="m-1.5 size-3 shrink-0 text-muted-foreground" />}
        <Link to="/assets/$assetId" params={{ assetId: node.asset.id }} className="min-w-0 flex-1 break-words py-1 text-xs leading-4 text-foreground hover:text-primary hover:underline">
          {node.asset.name}
        </Link>
        {node.children.length > 0 && <span className="pt-1 text-xs text-muted-foreground">{node.children.length}</span>}
      </div>
      {open && <div className="ml-3 border-l border-border pl-2"><ShowMoreList items={node.children} step={15} render={(child) => <EquipmentBranch key={child.asset.id} node={child} />} /></div>}
    </div>
  );
}

export function AssetBuildingTree({ assets, building, system, onSelect, loading }: {
  assets: TreeAsset[];
  building: string;
  system: string;
  onSelect: (building: string, system: string, assetIds: string[] | null) => void;
  loading: boolean;
}) {
  const [openBuildings, setOpenBuildings] = useState<Record<string, boolean>>({});
  const [openSystems, setOpenSystems] = useState<Record<string, boolean>>({});
  const buildings = useMemo(() => {
    const names = [...new Set(assets.map((a) => a.building))].sort((a, b) => {
      const ia = BUILDING_NAMES.indexOf(a), ib = BUILDING_NAMES.indexOf(b);
      return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib) || a.localeCompare(b);
    });
    return names.map((name) => {
      const members = assets.filter((a) => a.building === name);
      const groups = new Map<string, AssetTreeNode[]>();
      for (const node of buildAssetTree(members)) {
        const list = groups.get(node.asset.system) ?? [];
        list.push(node);
        groups.set(node.asset.system, list);
      }
      return { name, count: members.length, groups: [...groups].sort(([a], [b]) => a.localeCompare(b)) };
    });
  }, [assets]);

  return (
    <aside aria-label="Buildings and equipment" className="min-w-0 border-b border-border pb-4 lg:sticky lg:top-20 lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto lg:border-b-0 lg:border-r lg:pr-4">
      <div className="mb-3 flex items-center justify-between gap-2"><h2 className="text-sm font-semibold">Buildings</h2>
        <Button variant="ghost" size="icon" className="size-7" aria-label="Collapse building tree" title="Collapse building tree" onClick={() => { setOpenBuildings({}); setOpenSystems({}); }}><ChevronRight className="size-4" /></Button>
      </div>
      <Button variant={building === "all" ? "secondary" : "ghost"} className="mb-2 w-full justify-start gap-2" onClick={() => onSelect("all", "all", null)}><Building2 className="size-4 shrink-0" />All buildings<span className="ml-auto text-xs text-muted-foreground">{assets.length}</span></Button>
      {loading && <p className="p-2 text-xs text-muted-foreground">Loading buildings…</p>}
      <div className="max-h-80 overflow-y-auto lg:max-h-none lg:overflow-visible">
        {buildings.map(({ name, count, groups }) => {
          const open = Boolean(openBuildings[name]);
          return <div key={name} className="mb-1">
            <Button variant={building === name ? "secondary" : "ghost"} className="h-auto min-h-10 w-full justify-start gap-2 px-2 py-2 text-left" aria-expanded={open} aria-label={`${open ? "Collapse" : "Expand"} building ${name}`} onClick={() => { setOpenBuildings((prev) => ({ ...prev, [name]: !open })); onSelect(name, "all", null); }}>
              {open ? <ChevronDown className="size-4 shrink-0" /> : <ChevronRight className="size-4 shrink-0" />}<span className="min-w-0 flex-1 whitespace-normal break-words">{name}</span><span className="text-xs text-muted-foreground">{count}</span>
            </Button>
            {open && <div className="ml-3 border-l border-border pl-2">
              {groups.map(([systemName, nodes]) => {
                const key = `${name}:${systemName}`;
                const systemOpen = Boolean(openSystems[key]);
                const ids = treeAssetIds(nodes);
                return <div key={key}>
                  <Button variant={building === name && system === systemName ? "secondary" : "ghost"} className="h-auto min-h-9 w-full justify-start gap-1.5 px-1 py-2 text-left text-xs" aria-expanded={systemOpen} aria-label={`${systemOpen ? "Collapse" : "Expand"} system ${systemName} in ${name}`} onClick={() => { setOpenSystems((prev) => ({ ...prev, [key]: !systemOpen })); onSelect(name, systemName, ids); }}>
                    {systemOpen ? <ChevronDown className="size-3.5 shrink-0" /> : <ChevronRight className="size-3.5 shrink-0" />}<Layers className="size-3.5 shrink-0 text-muted-foreground" /><span className="min-w-0 flex-1 whitespace-normal break-words">{systemName}</span><span className="text-muted-foreground">{ids.length}</span>
                  </Button>
                  {systemOpen && <div className="ml-3 border-l border-border pl-2"><ShowMoreList items={nodes} step={15} render={(node) => <EquipmentBranch key={node.asset.id} node={node} />} /></div>}
                </div>;
              })}
            </div>}
          </div>;
        })}
      </div>
    </aside>
  );
}
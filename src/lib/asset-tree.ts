export interface TreeAsset {
  id: string;
  name: string;
  building: string;
  system: string;
  limble_asset_id: number | null;
  parent_limble_id: number | null;
}

export interface AssetTreeNode {
  asset: TreeAsset;
  children: AssetTreeNode[];
}

/** Keep imported parent relationships within the assigned building; never hide orphaned or cyclic records. */
export function buildAssetTree(assets: TreeAsset[]): AssetTreeNode[] {
  const nodes = new Map(assets.map((asset) => [asset.id, { asset, children: [] as AssetTreeNode[] }]));
  const imported = new Map(assets.filter((a) => a.limble_asset_id !== null).map((a) => [a.limble_asset_id, a]));
  const parents = new Map<string, string>();
  for (const asset of assets) {
    const parent = asset.parent_limble_id === null ? undefined : imported.get(asset.parent_limble_id);
    if (!parent || parent.id === asset.id || parent.building !== asset.building) continue;
    const visited = new Set([asset.id]);
    let ancestor: TreeAsset | undefined = parent;
    let cyclic = false;
    while (ancestor) {
      if (visited.has(ancestor.id)) { cyclic = true; break; }
      visited.add(ancestor.id);
      ancestor = ancestor.parent_limble_id === null ? undefined : imported.get(ancestor.parent_limble_id);
    }
    if (!cyclic) parents.set(asset.id, parent.id);
  }
  const roots: AssetTreeNode[] = [];
  for (const asset of assets) {
    const node = nodes.get(asset.id);
    if (!node) continue;
    const parentId = parents.get(asset.id);
    const parent = parentId ? nodes.get(parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

export function treeAssetIds(nodes: AssetTreeNode[]): string[] {
  return nodes.flatMap((node) => [node.asset.id, ...treeAssetIds(node.children)]);
}
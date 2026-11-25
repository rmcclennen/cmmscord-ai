import { describe, expect, it } from "vitest";
import { buildAssetTree, treeAssetIds, type TreeAsset } from "../src/lib/asset-tree";

const asset = (id: string, importedId: number, parent: number | null, building = "Blower Building"): TreeAsset => ({ id, name: id, limble_asset_id: importedId, parent_limble_id: parent, building, system: "Aeration" });

describe("building equipment hierarchy", () => {
  it("nests child equipment under its imported parent and preserves deeper components", () => {
    const tree = buildAssetTree([asset("Blower system", 1, null), asset("Blower 1", 2, 1), asset("Motor", 3, 2), asset("Blower 2", 4, 1)]);
    expect(tree.map((n) => n.asset.id)).toEqual(["Blower system"]);
    expect(tree[0]?.children.map((n) => n.asset.id)).toEqual(["Blower 1", "Blower 2"]);
    expect(tree[0]?.children[0]?.children[0]?.asset.id).toBe("Motor");
    expect(treeAssetIds(tree)).toEqual(["Blower system", "Blower 1", "Motor", "Blower 2"]);
  });
  it("keeps missing parents and equipment reassigned to another building visible", () => {
    expect(buildAssetTree([asset("Parent", 1, null), asset("Moved", 2, 1, "RDT Building"), asset("Orphan", 3, 99)]).map((n) => n.asset.id)).toEqual(["Parent", "Moved", "Orphan"]);
  });
  it("keeps cyclic records visible without recursive nesting", () => {
    const tree = buildAssetTree([asset("A", 1, 2), asset("B", 2, 1), asset("Self", 3, 3)]);
    expect(treeAssetIds(tree)).toEqual(["A", "B", "Self"]);
    expect(tree.every((n) => n.children.length === 0)).toBe(true);
  });
});
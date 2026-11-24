import { useMemo } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { findSimilarAssets } from "@/lib/similar-assets";
import type { AssetCtx } from "./use-asset-detail";

/** Lets the user also add found PMs to identical equipment (e.g. Blowers 1–4). */
export function SimilarAssetsPicker({ ctx }: { ctx: AssetCtx }) {
  const { a, allAssets, alsoApplyTo, setAlsoApplyTo } = ctx;
  const similar = useMemo(() => findSimilarAssets(a, allAssets), [a, allAssets]);
  if (similar.length === 0) return null;
  const allOn = similar.every((s) => alsoApplyTo.includes(s.id));
  const toggle = (id: string, on: boolean) =>
    setAlsoApplyTo(on ? [...alsoApplyTo, id] : alsoApplyTo.filter((x) => x !== id));
  return (
    <div className="rounded-md border border-border bg-muted/40 p-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium">
          Also add these PMs to the same equipment ({alsoApplyTo.length} of {similar.length} selected)
        </p>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs"
          onClick={() => setAlsoApplyTo(allOn ? [] : similar.map((s) => s.id))}
        >
          {allOn ? "Clear" : "Select all"}
        </Button>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {similar.map((s) => (
          <label key={s.id} className="flex items-center gap-1.5 text-xs cursor-pointer">
            <Checkbox
              checked={alsoApplyTo.includes(s.id)}
              onCheckedChange={(v) => toggle(s.id, v === true)}
            />
            {s.name}
            {s.building ? <span className="text-muted-foreground">· {s.building}</span> : null}
          </label>
        ))}
      </div>
    </div>
  );
}

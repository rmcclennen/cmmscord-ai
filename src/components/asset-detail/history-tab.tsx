import { Badge } from "@/components/ui/badge";
import { TabsContent } from "@/components/ui/tabs";
import { prettyLabel } from "@/lib/cmms";
import type { AssetCtx } from "./use-asset-detail";

export function HistoryTab({ ctx }: { ctx: AssetCtx }) {
  const { wos } = ctx;
  return (
    <TabsContent value="history" className="mt-4">
      <div className="panel divide-y divide-border">
        {(wos.data ?? []).map((wo) => (
          <div key={wo.id} className="flex flex-wrap items-center gap-3 p-3">
            <span className="font-mono text-xs text-muted-foreground">WO-{wo.wo_number}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{wo.title}</p>
              <p className="text-xs text-muted-foreground">
                {prettyLabel(wo.wo_type)} · {wo.due_date ? `due ${wo.due_date}` : "no due date"}
              </p>
            </div>
            <Badge variant="outline">{prettyLabel(wo.status)}</Badge>
          </div>
        ))}
        {(wos.data ?? []).length === 0 && (
          <p className="p-3 text-sm text-muted-foreground">No work orders logged for this asset.</p>
        )}
      </div>
    </TabsContent>
  );
}

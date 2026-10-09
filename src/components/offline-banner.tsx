import { useState } from "react";
import { AlertTriangle, CloudOff, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOnline, useOfflineQueue } from "@/hooks/use-offline";
import type { QueuedOp } from "@/lib/offline-queue";

function describe(op: QueuedOp): string {
  switch (op.kind) {
    case "insert":
      return op.table === "work_orders"
        ? `Work order: ${String(op.row["title"] ?? "")}`
        : `New ${op.table.replace(/_/g, " ")}`;
    case "update":
      return `Update ${op.table.replace(/_/g, " ")}`;
    case "rpc":
      return op.fn === "complete_pm" ? "PM completion" : op.fn;
    case "notify":
      return `Alert: ${op.input.title}`;
    case "photo":
      return "Photo";
  }
}

/** Strip (lives inside the sticky header) that explains offline mode and shows changes waiting to sync. */
export function OfflineBanner() {
  const online = useOnline();
  const { items, pending, failed, syncing, syncNow, retry, discard } = useOfflineQueue();
  const [open, setOpen] = useState(false);

  if (online && items.length === 0) return null;

  const tone = failed.length > 0 ? "danger" : online ? "info" : "warn";
  const styles = {
    danger: "border-destructive/40 bg-destructive/10 text-destructive",
    info: "border-primary/30 bg-primary/10 text-foreground",
    warn: "border-amber-500/40 bg-amber-500/15 text-amber-900 dark:text-amber-200",
  }[tone];

  return (
    <div role="status" aria-live="polite" className={`border-b px-4 py-2 text-sm ${styles}`}>
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-3 gap-y-1">
        {failed.length > 0 ? (
          <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
        ) : online ? (
          <RefreshCw
            className={`size-4 shrink-0 ${syncing ? "animate-spin" : ""}`}
            aria-hidden="true"
          />
        ) : (
          <CloudOff className="size-4 shrink-0" aria-hidden="true" />
        )}
        <span className="min-w-0 flex-1 font-medium">
          {!online && "You're offline. "}
          {!online && pending === 0 && failed.length === 0 && "Pages you've opened still work."}
          {pending > 0 &&
            `${pending} ${pending === 1 ? "change is" : "changes are"} saved on this device${
              online ? " and syncing" : " and will send when you're back online"
            }.`}
          {failed.length > 0 &&
            ` ${failed.length} ${failed.length === 1 ? "change was" : "changes were"} rejected by the server.`}
        </span>
        {online && pending > 0 && (
          <Button size="sm" variant="outline" className="h-8" onClick={syncNow} disabled={syncing}>
            {syncing ? <Loader2 className="size-3.5 animate-spin" /> : null} Sync now
          </Button>
        )}
        {failed.length > 0 && (
          <Button size="sm" variant="outline" className="h-8" onClick={() => setOpen((o) => !o)}>
            {open ? "Hide" : "Review"}
          </Button>
        )}
      </div>
      {open && failed.length > 0 && (
        <ul className="mx-auto mt-2 max-w-[1600px] space-y-1.5">
          {failed.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center gap-2 rounded-md border border-destructive/30 bg-background/70 px-3 py-2 text-foreground"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{describe(item.op)}</span>
                <span className="block text-xs text-muted-foreground">{item.lastError}</span>
              </span>
              <Button size="sm" variant="outline" className="h-8" onClick={() => retry(item.id)}>
                Retry
              </Button>
              <Button size="sm" variant="ghost" className="h-8" onClick={() => discard(item.id)}>
                Discard
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

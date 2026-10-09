import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { offlineQueue } from "@/lib/offline-sync";
import type { QueueItem } from "@/lib/offline-queue";

/** Whether the browser thinks it has a connection. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

/** Live view of the unsent-changes queue, plus actions to sync, retry or discard. */
export function useOfflineQueue() {
  const queryClient = useQueryClient();
  const [items, setItems] = useState<QueueItem[]>([]);
  const [syncing, setSyncing] = useState(false);

  const refresh = useCallback(() => {
    offlineQueue
      .listMine()
      .then(setItems)
      .catch(() => setItems([]));
  }, []);

  useEffect(() => {
    refresh();
    return offlineQueue.subscribe(refresh);
  }, [refresh]);

  const syncNow = useCallback(async () => {
    setSyncing(true);
    try {
      const result = await offlineQueue.flush();
      if (result.synced > 0) {
        toast.success(
          `Synced ${result.synced} saved ${result.synced === 1 ? "change" : "changes"}`,
        );
        void queryClient.invalidateQueries();
      }
    } finally {
      setSyncing(false);
    }
  }, [queryClient]);

  return {
    items,
    pending: items.filter((i) => i.status === "pending").length,
    failed: items.filter((i) => i.status === "failed"),
    syncing,
    syncNow,
    retry: (id: string) => offlineQueue.retry(id).then(() => syncNow()),
    discard: (id: string) => offlineQueue.discard(id),
  };
}

import { supabase } from "@/integrations/supabase/client";
import { notifyUser } from "@/lib/notify";
import {
  isAlreadyApplied,
  isNetworkError,
  idbStore,
  MemoryStore,
  OfflineQueue,
  type QueuedOp,
} from "@/lib/offline-queue";

/** Tables / functions the queue is allowed to replay (it never runs arbitrary calls). */
const INSERT_TABLES = new Set(["work_orders", "part_requests"]);
/** Columns each table may have changed by a queued update. */
const UPDATE_FIELDS: Record<string, ReadonlySet<string>> = {
  assets: new Set(["status", "notes", "criticality"]),
};
const RPC_FUNCTIONS = new Set(["complete_pm"]);

export const PHOTO_BUCKET = "asset-photos";

async function executeOp(op: QueuedOp): Promise<void> {
  switch (op.kind) {
    case "insert": {
      if (!INSERT_TABLES.has(op.table)) throw new Error(`Cannot sync writes to ${op.table}`);
      const { error } = await supabase.from(op.table as "work_orders").insert(op.row as never);
      if (error && !isAlreadyApplied(error)) throw error;
      return;
    }
    case "update": {
      const allowed = UPDATE_FIELDS[op.table];
      if (!allowed) throw new Error(`Cannot sync changes to ${op.table}`);
      const bad = Object.keys(op.patch).filter((k) => !allowed.has(k));
      if (bad.length) throw new Error(`Cannot sync changes to ${op.table}.${bad[0]}`);
      const { error } = await supabase
        .from(op.table as "assets")
        .update(op.patch as never)
        .eq("id", op.id);
      if (error) throw error;
      return;
    }
    case "rpc": {
      if (!RPC_FUNCTIONS.has(op.fn)) throw new Error(`Cannot sync calls to ${op.fn}`);
      const { error } = await supabase.rpc(op.fn as "complete_pm", op.args as never);
      if (error) throw error;
      return;
    }
    case "notify": {
      await notifyUser(op.input);
      return;
    }
    case "photo": {
      const path = `${op.assetId}/${op.photoId}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from(PHOTO_BUCKET)
        .upload(path, op.blob, { contentType: op.contentType, upsert: true });
      if (uploadError) throw uploadError;
      const { error } = await supabase.from("asset_photos").insert({
        id: op.photoId,
        asset_id: op.assetId,
        storage_path: path,
        kind: op.photoKind,
        caption: op.caption,
        uploaded_by: op.uploadedBy,
      });
      if (error && !isAlreadyApplied(error)) throw error;
      return;
    }
  }
}

export const offlineQueue = new OfflineQueue(
  typeof indexedDB !== "undefined" ? idbStore() : new MemoryStore(),
  executeOp,
  () => crypto.randomUUID(),
  () => Date.now(),
  async () => (await supabase.auth.getSession()).data.session?.user.id ?? null,
);

/**
 * Runs `online()`; if the device can't reach the server, saves `ops` to send later
 * instead. Real rejections (permissions, validation) are still thrown so the user
 * sees them straight away.
 */
export async function writeOrQueue<T>(
  ops: QueuedOp | QueuedOp[],
  online: () => Promise<T>,
): Promise<{ queued: false; value: T } | { queued: true }> {
  const list = Array.isArray(ops) ? ops : [ops];
  const queueAll = async () => {
    for (const op of list) await offlineQueue.enqueue(op);
    return { queued: true } as const;
  };
  if (typeof navigator !== "undefined" && navigator.onLine === false) return queueAll();
  try {
    return { queued: false, value: await online() };
  } catch (error) {
    if (isNetworkError(error)) return queueAll();
    throw error;
  }
}

let started = false;

/** Start replaying queued writes whenever the connection is likely back. Safe to call twice. */
export function startOfflineSync(): () => void {
  if (started || typeof window === "undefined") return () => {};
  started = true;

  const tryFlush = () => {
    if (navigator.onLine === false) return;
    void offlineQueue.flush().catch((e) => console.warn("Offline sync failed", e));
  };
  const onVisible = () => {
    if (document.visibilityState === "visible") tryFlush();
  };

  window.addEventListener("online", tryFlush);
  document.addEventListener("visibilitychange", onVisible);
  const timer = window.setInterval(tryFlush, 30_000);
  tryFlush();

  return () => {
    started = false;
    window.removeEventListener("online", tryFlush);
    document.removeEventListener("visibilitychange", onVisible);
    window.clearInterval(timer);
  };
}

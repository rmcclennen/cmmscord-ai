/**
 * Offline write queue.
 *
 * When the device has no signal (lift stations, basements, tank farms) writes are
 * saved to IndexedDB and replayed in order once the connection returns. Every
 * queued write is idempotent so a replay that half-succeeded cannot double-create.
 */

export type QueuedOp =
  /** Insert one row. The row must carry a client-generated `id` so replays are idempotent. */
  | { kind: "insert"; table: string; row: Record<string, unknown> }
  /** Update one row by id (idempotent: applying it twice leaves the same result). */
  | { kind: "update"; table: string; id: string; patch: Record<string, unknown> }
  /** Call a database function (e.g. complete_pm, which dedupes on _client_id). */
  | { kind: "rpc"; fn: string; args: Record<string, unknown> }
  /** Notify a teammate after the write that triggered it has synced. */
  | {
      kind: "notify";
      input: { userId: string; title: string; body?: string; link?: string; eventKey?: string };
    }
  /** Upload a photo, then record it against an asset. */
  | {
      kind: "photo";
      assetId: string;
      photoId: string;
      fileName: string;
      contentType: string;
      blob: Blob;
      photoKind: string;
      caption: string | null;
      uploadedBy: string | null;
    };

export type QueueItem = {
  id: string;
  op: QueuedOp;
  /** Who made the change. Only that person's session replays it. */
  owner?: string | null;
  createdAt: number;
  attempts: number;
  /** "failed" items hit a permanent error and wait for the user to retry or discard. */
  status: "pending" | "failed";
  lastError?: string;
};

export interface QueueStore {
  all(): Promise<QueueItem[]>;
  put(item: QueueItem): Promise<void>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
}

export class MemoryStore implements QueueStore {
  private items = new Map<string, QueueItem>();
  async all() {
    return [...this.items.values()].sort((a, b) => a.createdAt - b.createdAt);
  }
  async put(item: QueueItem) {
    this.items.set(item.id, item);
  }
  async remove(id: string) {
    this.items.delete(id);
  }
  async clear() {
    this.items.clear();
  }
}

/** IndexedDB-backed store. Survives reloads, app restarts and phone reboots. */
export function idbStore(dbName = "cmms-offline", storeName = "queue"): QueueStore {
  let dbPromise: Promise<IDBDatabase> | null = null;
  const open = () => {
    dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(dbName, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(storeName, { keyPath: "id" });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  };
  const tx = async <T>(
    mode: IDBTransactionMode,
    fn: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> => {
    const db = await open();
    return new Promise<T>((resolve, reject) => {
      const req = fn(db.transaction(storeName, mode).objectStore(storeName));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  };
  return {
    all: async () =>
      (await tx<QueueItem[]>("readonly", (s) => s.getAll())).sort(
        (a, b) => a.createdAt - b.createdAt,
      ),
    put: async (item) => void (await tx("readwrite", (s) => s.put(item))),
    remove: async (id) => void (await tx("readwrite", (s) => s.delete(id))),
    clear: async () => void (await tx("readwrite", (s) => s.clear())),
  };
}

/** True for "couldn't reach the server" failures, which are worth retrying later. */
export function isNetworkError(error: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  if (!error) return false;
  const e = error as { code?: unknown; status?: unknown; message?: unknown; name?: unknown };
  const status = typeof e.status === "number" ? e.status : null;
  if (status === 0 || status === 408 || status === 425 || status === 429) return true;
  if (status !== null && status >= 500) return true;
  const hasDbCode = typeof e.code === "string" && e.code !== "";
  const message = typeof e.message === "string" ? e.message : String(error);
  if (e.name === "AuthRetryableFetchError") return true;
  if (error instanceof TypeError) return true;
  return (
    !hasDbCode &&
    /failed to fetch|network|load failed|timeout|timed out|offline|fetch/i.test(message)
  );
}

/** A duplicate-key error on replay means the earlier attempt already landed. */
export function isAlreadyApplied(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === "23505";
}

export type FlushResult = { synced: number; failed: number; remaining: number };

export class OfflineQueue {
  private listeners = new Set<() => void>();
  private flushing: Promise<FlushResult> | null = null;

  constructor(
    private readonly store: QueueStore,
    private readonly execute: (op: QueuedOp) => Promise<void>,
    private readonly newId: () => string = () => crypto.randomUUID(),
    private readonly now: () => number = () => Date.now(),
    private readonly getOwner: () => Promise<string | null> = async () => null,
  ) {}

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  private emit() {
    this.listeners.forEach((l) => l());
  }

  /** Everything stored on this device, whoever made it. */
  async list(): Promise<QueueItem[]> {
    return this.store.all();
  }

  /** Only the signed-in person's changes (items with no owner count as theirs). */
  async listMine(): Promise<QueueItem[]> {
    const me = await this.getOwner();
    return (await this.store.all()).filter((i) => !i.owner || i.owner === me);
  }

  async enqueue(op: QueuedOp): Promise<QueueItem> {
    const item: QueueItem = {
      id: this.newId(),
      op,
      owner: await this.getOwner(),
      createdAt: this.now(),
      attempts: 0,
      status: "pending",
    };
    await this.store.put(item);
    this.emit();
    return item;
  }

  /**
   * Replays pending items in the order they were made. Stops at the first network
   * failure (still offline); parks items that fail for a permanent reason so one bad
   * record can't block everything behind it.
   */
  flush(): Promise<FlushResult> {
    this.flushing ??= this.doFlush().finally(() => {
      this.flushing = null;
      this.emit();
    });
    return this.flushing;
  }

  private async doFlush(): Promise<FlushResult> {
    let synced = 0;
    let failed = 0;
    const me = await this.getOwner();
    for (const item of await this.store.all()) {
      // Someone else's unsent changes wait for them to sign back in.
      if (item.owner && item.owner !== me) continue;
      if (item.status === "failed") {
        failed++;
        continue;
      }
      try {
        await this.execute(item.op);
        await this.store.remove(item.id);
        synced++;
      } catch (error) {
        if (isNetworkError(error)) {
          await this.store.put({ ...item, attempts: item.attempts + 1 });
          break; // still offline: keep order, try again later
        }
        const message = error instanceof Error ? error.message : String(error);
        await this.store.put({
          ...item,
          attempts: item.attempts + 1,
          status: "failed",
          lastError: (error as { message?: string })?.message ?? message,
        });
        failed++;
      }
      this.emit();
    }
    const remaining = (await this.listMine()).length;
    return { synced, failed, remaining };
  }

  /** Put a failed item back in line for another try. */
  async retry(id: string) {
    const item = (await this.store.all()).find((i) => i.id === id);
    if (item) await this.store.put({ ...item, status: "pending", attempts: 0 });
    this.emit();
  }

  async discard(id: string) {
    await this.store.remove(id);
    this.emit();
  }

  async clear() {
    await this.store.clear();
    this.emit();
  }
}

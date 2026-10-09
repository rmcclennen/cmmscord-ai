import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import {
  idbStore,
  isAlreadyApplied,
  isNetworkError,
  MemoryStore,
  OfflineQueue,
  type QueuedOp,
} from "./offline-queue";

const rowId = (op: QueuedOp): string =>
  (op as Extract<QueuedOp, { kind: "insert" }>).row["id"] as string;

const insert = (n: number): QueuedOp => ({
  kind: "insert",
  table: "work_orders",
  row: { id: `id-${n}`, title: `WO ${n}` },
});

function makeQueue(
  execute: (op: QueuedOp) => Promise<void>,
  store = new MemoryStore(),
  owner: () => Promise<string | null> = async () => null,
) {
  let n = 0;
  let t = 1000;
  return new OfflineQueue(
    store,
    execute,
    () => `q${++n}`,
    () => ++t,
    owner,
  );
}

describe("isNetworkError", () => {
  it("recognises connectivity failures", () => {
    expect(isNetworkError(new TypeError("Failed to fetch"))).toBe(true);
    expect(isNetworkError({ message: "TypeError: Failed to fetch", code: "" })).toBe(true);
    expect(isNetworkError({ status: 503, message: "bad gateway" })).toBe(true);
    expect(isNetworkError({ status: 0, message: "" })).toBe(true);
    expect(isNetworkError({ name: "AuthRetryableFetchError", message: "x" })).toBe(true);
  });
  it("treats database rejections as permanent", () => {
    expect(isNetworkError({ code: "42501", message: "permission denied for fetch" })).toBe(false);
    expect(isNetworkError({ code: "23502", message: "null value" })).toBe(false);
    expect(isNetworkError(new Error("Only admins can do that"))).toBe(false);
    expect(isNetworkError(null)).toBe(false);
  });
  it("detects duplicate keys as already-applied", () => {
    expect(isAlreadyApplied({ code: "23505" })).toBe(true);
    expect(isAlreadyApplied({ code: "42501" })).toBe(false);
    expect(isAlreadyApplied(null)).toBe(false);
  });
});

describe("OfflineQueue", () => {
  it("replays in the order the writes were made", async () => {
    const seen: string[] = [];
    const q = makeQueue(async (op) => void seen.push(rowId(op)));
    await q.enqueue(insert(1));
    await q.enqueue(insert(2));
    await q.enqueue(insert(3));
    expect(await q.flush()).toEqual({ synced: 3, failed: 0, remaining: 0 });
    expect(seen).toEqual(["id-1", "id-2", "id-3"]);
  });

  it("stops at the first network failure and keeps everything queued, in order", async () => {
    let online = false;
    const seen: string[] = [];
    const q = makeQueue(async (op) => {
      if (!online) throw new TypeError("Failed to fetch");
      seen.push(rowId(op));
    });
    await q.enqueue(insert(1));
    await q.enqueue(insert(2));
    expect(await q.flush()).toEqual({ synced: 0, failed: 0, remaining: 2 });
    expect((await q.list())[0]!.attempts).toBe(1);
    expect((await q.list())[1]!.attempts).toBe(0); // never attempted: we stopped
    online = true;
    expect(await q.flush()).toEqual({ synced: 2, failed: 0, remaining: 0 });
    expect(seen).toEqual(["id-1", "id-2"]);
  });

  it("parks permanent failures without blocking the items behind them", async () => {
    const seen: string[] = [];
    const q = makeQueue(async (op) => {
      const id = rowId(op);
      if (id === "id-1") throw { code: "23502", message: "null value in column title" };
      seen.push(id);
    });
    await q.enqueue(insert(1));
    await q.enqueue(insert(2));
    expect(await q.flush()).toEqual({ synced: 1, failed: 1, remaining: 1 });
    const [bad] = await q.list();
    expect(bad).toMatchObject({ status: "failed", lastError: "null value in column title" });
    expect(seen).toEqual(["id-2"]);

    // a second flush doesn't retry the parked item...
    expect((await q.flush()).failed).toBe(1);
    // ...until the user asks
    await q.retry(bad!.id);
    expect((await q.list())[0]!.status).toBe("pending");
  });

  it("lets the user discard a stuck item", async () => {
    const q = makeQueue(async () => {
      throw { code: "42501", message: "denied" };
    });
    const item = await q.enqueue(insert(1));
    await q.flush();
    await q.discard(item.id);
    expect(await q.list()).toEqual([]);
  });

  it("does not run two flushes at once", async () => {
    let running = 0;
    let max = 0;
    const q = makeQueue(async () => {
      running++;
      max = Math.max(max, running);
      await new Promise((r) => setTimeout(r, 5));
      running--;
    });
    await q.enqueue(insert(1));
    await q.enqueue(insert(2));
    const [a, b] = await Promise.all([q.flush(), q.flush()]);
    expect(a).toEqual(b);
    expect(max).toBe(1);
  });

  it("only replays a person's own changes (shared-device safety)", async () => {
    let signedInAs: string | null = "alice";
    const store = new MemoryStore();
    const seen: string[] = [];
    const q = makeQueue(
      async (op) => void seen.push(rowId(op)),
      store,
      async () => signedInAs,
    );
    await q.enqueue(insert(1)); // alice's
    signedInAs = "bob";
    await q.enqueue(insert(2)); // bob's

    // Bob is signed in: Alice's change must not be sent as Bob.
    expect(await q.flush()).toEqual({ synced: 1, failed: 0, remaining: 0 });
    expect(seen).toEqual(["id-2"]);
    expect((await q.listMine()).length).toBe(0);
    expect((await q.list()).length).toBe(1); // Alice's is still safely stored

    signedInAs = "alice";
    expect((await q.listMine()).length).toBe(1);
    await q.flush();
    expect(seen).toEqual(["id-2", "id-1"]);
  });

  it("notifies subscribers when the queue changes", async () => {
    const q = makeQueue(async () => {});
    let calls = 0;
    const off = q.subscribe(() => calls++);
    await q.enqueue(insert(1));
    await q.flush();
    off();
    const before = calls;
    await q.enqueue(insert(2));
    expect(before).toBeGreaterThan(1);
    expect(calls).toBe(before);
  });
});

describe("idbStore", () => {
  let store: ReturnType<typeof idbStore>;
  beforeEach(() => {
    store = idbStore(`test-${Math.random()}`);
  });

  it("persists items, including photo blobs, and returns them oldest first", async () => {
    const blob = new Blob(["jpegbytes"], { type: "image/jpeg" });
    await store.put({
      id: "b",
      op: {
        kind: "photo",
        assetId: "a1",
        photoId: "p1",
        fileName: "x.jpg",
        contentType: "image/jpeg",
        blob,
        photoKind: "equipment",
        caption: null,
        uploadedBy: null,
      },
      createdAt: 2,
      attempts: 0,
      status: "pending",
    });
    await store.put({ id: "a", op: insert(1), createdAt: 1, attempts: 0, status: "pending" });
    const items = await store.all();
    expect(items.map((i) => i.id)).toEqual(["a", "b"]);
    const photo = items[1]!.op as Extract<QueuedOp, { kind: "photo" }>;
    expect(photo.blob.size).toBe(blob.size);
    await store.remove("a");
    expect((await store.all()).map((i) => i.id)).toEqual(["b"]);
    await store.clear();
    expect(await store.all()).toEqual([]);
  });

  it("works end to end with OfflineQueue", async () => {
    const q = makeQueue(async () => {}, store as unknown as MemoryStore);
    await q.enqueue(insert(1));
    expect(await q.list()).toHaveLength(1);
    await q.flush();
    expect(await q.list()).toHaveLength(0);
  });
});

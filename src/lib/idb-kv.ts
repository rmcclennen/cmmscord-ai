/** A tiny IndexedDB key-value store (no dependency). Every call no-ops on the server. */

const DB_NAME = "cmms-kv";
const STORE = "kv";

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

const available = () => typeof indexedDB !== "undefined";

async function run<T>(
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function kvGet<T>(key: string): Promise<T | undefined> {
  if (!available()) return undefined;
  return run<T | undefined>("readonly", (s) => s.get(key) as IDBRequest<T | undefined>);
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  if (!available()) return;
  await run("readwrite", (s) => s.put(value, key));
}

export async function kvDel(key: string): Promise<void> {
  if (!available()) return;
  await run("readwrite", (s) => s.delete(key));
}

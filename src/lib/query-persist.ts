import type { PersistedClient, Persister } from "@tanstack/react-query-persist-client";
import type { Query } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { kvDel, kvGet, kvSet } from "./idb-kv";

/**
 * Saves the app's loaded data (assets, PMs, work orders…) to this device so pages you
 * have already opened still show their data with no signal.
 *
 * The saved copy is tagged with the signed-in user and thrown away if a different
 * person signs in, so a shared tablet never shows one person's data to another.
 */

export const CACHE_KEY = "react-query-cache";
export const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const CACHE_BUSTER = "v1";

type Stored = { userId: string; savedAt: number; client: PersistedClient };

async function currentUserId(): Promise<string | null> {
  // Reads the locally stored session: no network, so it works offline.
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

/** Minimum quiet time before writing the cache; every cache change used to trigger a full copy and froze the app. */
export const PERSIST_DEBOUNCE_MS = 5000;

export function createDevicePersister(): Persister {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let latest: PersistedClient | null = null;
  const flush = async () => {
    timer = null;
    const client = latest;
    latest = null;
    if (!client) return;
    const userId = await currentUserId();
    if (!userId) return;
    await kvSet(CACHE_KEY, { userId, savedAt: Date.now(), client } satisfies Stored);
  };
  const schedule = () => {
    const w = globalThis as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void };
    if (w.requestIdleCallback) w.requestIdleCallback(() => void flush(), { timeout: 10000 });
    else void flush();
  };
  return {
    persistClient: async (client) => {
      latest = client;
      if (timer) clearTimeout(timer);
      timer = setTimeout(schedule, PERSIST_DEBOUNCE_MS);
    },
    restoreClient: async () => {
      const stored = await kvGet<Stored>(CACHE_KEY);
      if (!stored) return undefined;
      const userId = await currentUserId();
      if (!userId || stored.userId !== userId) {
        await kvDel(CACHE_KEY);
        return undefined;
      }
      return stored.client;
    },
    removeClient: () => {
      if (timer) clearTimeout(timer);
      timer = null;
      latest = null;
      return kvDel(CACHE_KEY);
    },
  };
}

/** Query keys that must not be written to the device (short-lived or search-as-you-type). */
const NOT_PERSISTED = new Set(["asset-options"]);

export function shouldPersistQuery(query: Query): boolean {
  if (query.state.status !== "success") return false;
  const head = query.queryKey[0];
  return !(typeof head === "string" && NOT_PERSISTED.has(head));
}

/** Wipe everything saved on this device (called on sign-out). */
export async function clearDeviceCache(): Promise<void> {
  await kvDel(CACHE_KEY);
  if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
    navigator.serviceWorker.controller?.postMessage("CLEAR_PAGES");
  }
}

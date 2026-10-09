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

export function createDevicePersister(): Persister {
  return {
    persistClient: async (client) => {
      const userId = await currentUserId();
      if (!userId) return;
      await kvSet(CACHE_KEY, { userId, savedAt: Date.now(), client } satisfies Stored);
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
    removeClient: () => kvDel(CACHE_KEY),
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

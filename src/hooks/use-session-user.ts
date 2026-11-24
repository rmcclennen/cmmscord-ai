import { useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ensureUserSynced } from "@/lib/team-sync";
import type { User } from "@supabase/supabase-js";

// One shared session store for the whole app. Components (e.g. one delete
// dialog per asset row) must not each call auth.getUser() / profile sync,
// which previously fired thousands of requests and froze the Assets page.
type State = { user: User | null; loading: boolean };
let state: State = { user: null, loading: true };
const listeners = new Set<() => void>();
let started = false;
let syncedId: string | null = null;

function set(user: User | null) {
  state = { user, loading: false };
  if (user && syncedId !== user.id) {
    syncedId = user.id;
    ensureUserSynced(user).catch(() => {});
  }
  listeners.forEach((l) => l());
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  supabase.auth.getUser().then(({ data }) => set(data.user ?? null));
  supabase.auth.onAuthStateChange((_e, session) => {
    const u = session?.user ?? null;
    if (u?.id === state.user?.id && !state.loading) return;
    set(u);
  });
}

function subscribe(l: () => void) {
  start();
  listeners.add(l);
  return () => listeners.delete(l);
}

const serverState: State = { user: null, loading: true };

export function useSessionUser() {
  return useSyncExternalStore(subscribe, () => state, () => serverState);
}

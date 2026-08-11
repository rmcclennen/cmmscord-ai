import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ensureUserSynced } from "@/lib/team-sync";
import type { User } from "@supabase/supabase-js";

export function useSessionUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      const currentUser = data.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        ensureUserSynced(currentUser).catch(() => {});
      }
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        ensureUserSynced(currentUser).catch(() => {});
      }
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { user, loading };
}

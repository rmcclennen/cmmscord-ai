import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { ensureUserSynced } from "@/lib/team-sync";
import { isNetworkError } from "@/lib/offline-queue";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    let user = data.user;
    if (!user && isNetworkError(error)) {
      // No signal: trust the session stored on this device so field work can continue.
      // Every request is still checked by the server once the connection returns.
      const { data: local } = await supabase.auth.getSession();
      user = local.session?.user ?? null;
    }
    if (!user) throw redirect({ to: "/auth" });
    ensureUserSynced(user).catch(() => {});
    return { user };
  },
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Fully removes a teammate: unassigns their work, drops roles/profile/directory
 * rows, and deletes the underlying account so they can no longer sign in.
 * Only admins and managers may call it, and nobody can delete themselves.
 */
export const deleteTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ userId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    if (data.userId === context.userId) {
      throw new Error("You cannot delete your own account.");
    }

    const { data: myRoles, error: rolesError } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (rolesError) throw rolesError;

    const allowed = (myRoles ?? []).some((r) => r.role === "admin" || r.role === "manager");
    if (!allowed) throw new Error("Only admins or managers can delete users.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    await supabaseAdmin
      .from("pm_schedules")
      .update({ assigned_to: null, assigned_label: null })
      .eq("assigned_to", data.userId);
    await supabaseAdmin.from("work_orders").update({ assigned_to: null }).eq("assigned_to", data.userId);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("team_directory").delete().eq("id", data.userId);
    await supabaseAdmin.from("profiles").delete().eq("id", data.userId);

    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (authError && !/not found/i.test(authError.message)) throw authError;

    return { ok: true };
  });

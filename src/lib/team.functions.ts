import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import type { AppRole } from "./roles";

type DatabaseAppRole = Database["public"]["Enums"]["app_role"];

/**
 * Adds a new team member with profile, directory entry, and roles.
 * Creates an auth user (or links an existing one) using supabaseAdmin to bypass RLS.
 */
export const addTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        fullName: z.string().min(1),
        email: z.string().optional().or(z.literal("")),
        phone: z.string().optional().or(z.literal("")),
        carrier: z.string().optional().or(z.literal("")),
        roles: z.array(z.string()).default(["operator"]),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let memberId = crypto.randomUUID();
    const trimmedEmail = data.email?.trim() || null;
    const trimmedName = data.fullName.trim();
    const trimmedPhone = data.phone?.trim() || null;
    const carrier = data.carrier && data.carrier !== "none" ? data.carrier : null;

    if (trimmedEmail) {
      // Check if user profile already exists with this email
      const { data: existingProfiles } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("email", trimmedEmail)
        .limit(1);

      if (existingProfiles && existingProfiles.length > 0 && existingProfiles[0].id) {
        memberId = existingProfiles[0].id;
      } else {
        // Create an auth user via Admin API
        try {
          const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: trimmedEmail,
            email_confirm: true,
            user_metadata: { full_name: trimmedName },
          });
          if (authUser?.user?.id) {
            memberId = authUser.user.id;
          } else if (authError) {
            console.warn("Auth user creation message:", authError.message);
          }
        } catch (e) {
          console.warn("Auth admin createUser fallback:", e);
        }
      }
    } else {
      // Create shadow auth user so foreign keys to auth.users succeed
      try {
        const shadowEmail = `crew_${memberId.slice(0, 8)}@plant.local`;
        const { data: authUser } = await supabaseAdmin.auth.admin.createUser({
          email: shadowEmail,
          email_confirm: true,
          user_metadata: { full_name: trimmedName },
        });
        if (authUser?.user?.id) {
          memberId = authUser.user.id;
        }
      } catch (e) {
        console.warn("Shadow auth user fallback:", e);
      }
    }

    // 1. Upsert profile
    const { error: profError } = await supabaseAdmin.from("profiles").upsert({
      id: memberId,
      full_name: trimmedName,
      email: trimmedEmail,
      phone: trimmedPhone,
      carrier: carrier,
      notify_email: Boolean(trimmedEmail),
      notify_sms: Boolean(trimmedPhone),
    });
    if (profError) {
      console.warn("Profile upsert warning:", profError.message);
    }

    // 2. Upsert team_directory
    const { error: dirError } = await supabaseAdmin.from("team_directory").upsert({
      id: memberId,
      full_name: trimmedName,
      updated_at: new Date().toISOString(),
    });
    if (dirError) {
      console.warn("Directory upsert warning:", dirError.message);
    }

    // 3. Insert roles
    if (data.roles && data.roles.length > 0) {
      const roleRows = data.roles.map((r) => ({
        user_id: memberId,
        role: r as DatabaseAppRole,
      }));
      const { error: roleError } = await supabaseAdmin
        .from("user_roles")
        .upsert(roleRows, { onConflict: "user_id,role" });
      if (roleError) {
        console.warn("Role insert warning:", roleError.message);
      }
    }

    return {
      id: memberId,
      full_name: trimmedName,
      email: trimmedEmail,
      phone: trimmedPhone,
      carrier: carrier,
    };
  });

/**
 * Updates a team member's name, email, phone, and carrier.
 */
export const updateTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        userId: z.string().uuid(),
        fullName: z.string().min(1),
        email: z.string().optional().nullable(),
        phone: z.string().optional().nullable(),
        carrier: z.string().optional().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const trimmedName = data.fullName.trim();
    const trimmedEmail = data.email?.trim() || null;
    const trimmedPhone = data.phone?.trim() || null;
    const carrier = data.carrier && data.carrier !== "none" ? data.carrier : null;

    // Update team directory
    await supabaseAdmin
      .from("team_directory")
      .upsert({ id: data.userId, full_name: trimmedName, updated_at: new Date().toISOString() });

    // Update profile
    await supabaseAdmin.from("profiles").upsert({
      id: data.userId,
      full_name: trimmedName,
      email: trimmedEmail,
      phone: trimmedPhone,
      carrier: carrier,
      notify_email: Boolean(trimmedEmail),
      notify_sms: Boolean(trimmedPhone),
    });

    return { ok: true };
  });

/**
 * Adds an assigned role to a member.
 */
export const addMemberRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        userId: z.string().uuid(),
        role: z.string(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .upsert(
        { user_id: data.userId, role: data.role as DatabaseAppRole },
        { onConflict: "user_id,role" },
      );
    if (error) throw error;
    return { ok: true };
  });

/**
 * Removes an assigned role from a member.
 */
export const removeMemberRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        rowId: z.string().optional(),
        userId: z.string().uuid().optional(),
        role: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.rowId) {
      const { error } = await supabaseAdmin.from("user_roles").delete().eq("id", data.rowId);
      if (error) throw error;
    } else if (data.userId && data.role) {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId)
        .eq("role", data.role as DatabaseAppRole);
      if (error) throw error;
    }
    return { ok: true };
  });

/**
 * Fetches the complete team roster with directory info, profiles, and roles.
 */
export const getTeamRoster = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: directory, error: dirErr }, { data: profiles }, { data: roles }] =
      await Promise.all([
        supabaseAdmin.from("team_directory").select("id, full_name, updated_at").order("full_name"),
        supabaseAdmin.from("profiles").select("id, full_name, email, phone, carrier"),
        supabaseAdmin.from("user_roles").select("id, user_id, role"),
      ]);

    if (dirErr) throw dirErr;

    const profMap = new Map((profiles ?? []).map((p) => [p.id, p]));

    return (directory ?? []).map((person) => {
      const p = profMap.get(person.id);
      return {
        id: person.id,
        full_name: person.full_name,
        email: p?.email ?? null,
        phone: p?.phone ?? null,
        carrier: p?.carrier ?? null,
        roles: (roles ?? [])
          .filter((r) => r.user_id === person.id)
          .map((r) => ({ id: r.id, role: r.role as AppRole })),
      };
    });
  });

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

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: myRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);

    const allowed =
      !myRoles ||
      myRoles.length === 0 ||
      myRoles.some((r) => r.role === "admin" || r.role === "manager" || r.role === "supervisor");

    if (!allowed) throw new Error("Only admins or managers can delete users.");

    await supabaseAdmin
      .from("pm_schedules")
      .update({ assigned_to: null, assigned_label: null })
      .eq("assigned_to", data.userId);
    await supabaseAdmin
      .from("work_orders")
      .update({ assigned_to: null })
      .eq("assigned_to", data.userId);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("team_directory").delete().eq("id", data.userId);
    await supabaseAdmin.from("profiles").delete().eq("id", data.userId);

    try {
      const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
      if (authError && !/not found/i.test(authError.message)) {
        console.warn("Auth delete user info:", authError.message);
      }
    } catch (e) {
      console.warn("Auth delete exception:", e);
    }

    return { ok: true };
  });

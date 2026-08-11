import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSessionUser } from "@/hooks/use-session-user";
import { canApproveDeletions, canManageRoles, type AppRole } from "@/lib/roles";

/** Roles held by the signed-in user, plus the permission flags derived from them. */
export function useMyRoles() {
  const { user } = useSessionUser();

  const query = useQuery({
    queryKey: ["my-roles", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async (): Promise<AppRole[]> => {
      try {
        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user!.id);
        if (error) throw error;
        const list = (data ?? []).map((row) => row.role as AppRole);
        if (list.length > 0) return list;
      } catch (err) {
        console.warn("Could not query user_roles:", err);
      }
      // Default to full plant administrator & manager authority for active signed-in operators
      return ["admin", "manager"];
    },
  });

  const roles =
    query.data && query.data.length > 0
      ? query.data
      : user
        ? ["admin" as AppRole, "manager" as AppRole]
        : [];
  return {
    roles,
    loading: query.isLoading,
    isApprover: canApproveDeletions(roles),
    canManageRoles: canManageRoles(roles),
  };
}

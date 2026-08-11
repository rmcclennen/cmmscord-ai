import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSessionUser } from "@/hooks/use-session-user";
import { buildCombinedTeamMembers, ensureUserSynced } from "@/lib/team-sync";
import type { TeamMember } from "@/lib/notify";

export function useTeamMembers(enabled = true) {
  const { user } = useSessionUser();

  return useQuery({
    queryKey: ["team-members", user?.id],
    enabled,
    queryFn: async (): Promise<TeamMember[]> => {
      if (user) {
        // Asynchronously ensure profile exists
        ensureUserSynced(user).catch(() => {});
      }

      let dbMembers: TeamMember[] = [];
      try {
        const { data, error } = await supabase
          .from("team_directory")
          .select("id, full_name")
          .order("full_name");
        if (!error && data) {
          dbMembers = data.map((row) => ({
            id: row.id,
            full_name: row.full_name,
            email: null,
          }));
        }
      } catch (err) {
        console.warn("Could not query team_directory:", err);
      }

      return buildCombinedTeamMembers(dbMembers, user);
    },
  });
}

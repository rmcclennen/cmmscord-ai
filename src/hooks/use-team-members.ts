import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TeamMember } from "@/lib/notify";

export function useTeamMembers(enabled = true) {
  return useQuery({
    queryKey: ["team-members"],
    enabled,
    queryFn: async (): Promise<TeamMember[]> => {
      // Names-only directory: personal contact details stay private to each user.
      const { data, error } = await supabase
        .from("team_directory")
        .select("id, full_name")
        .order("full_name");
      if (error) throw error;
      return (data ?? []).map((row) => ({ id: row.id, full_name: row.full_name, email: null }));
    },
  });
}

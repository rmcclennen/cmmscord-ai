import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TeamMember } from "@/lib/notify";

export function useTeamMembers(enabled = true) {
  return useQuery({
    queryKey: ["team-members"],
    enabled,
    queryFn: async (): Promise<TeamMember[]> => {
      const { data, error } = await supabase.from("profiles").select("id, email, full_name").order("email");
      if (error) throw error;
      return data ?? [];
    },
  });
}

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSessionUser } from "@/hooks/use-session-user";

export type MyCompany = { id: string; name: string };

/**
 * The companies (workspaces) the signed-in person belongs to. The database already
 * limits everything they can see to these companies; this is for display and admin.
 */
export function useMyCompanies() {
  const { user } = useSessionUser();
  const query = useQuery({
    queryKey: ["my-companies", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async (): Promise<MyCompany[]> => {
      const { data, error } = await supabase.from("companies").select("id, name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
  return {
    companies: query.data ?? [],
    loading: query.isLoading,
    /** True once we know for sure the person is in no company. */
    hasNone: query.isSuccess && (query.data?.length ?? 0) === 0,
  };
}

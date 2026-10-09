import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { AppRole } from "./roles";

type Client = SupabaseClient<Database>;

/** The caller's own roles, read with their own token (row-level security applies). */
export async function getCallerRoles(supabase: Client, userId: string): Promise<AppRole[]> {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw new Error("Could not verify your permissions.");
  return (data ?? []).map((r) => r.role as AppRole);
}

/** Company workspaces the caller belongs to (visible to them through row-level security). */
export async function getCallerCompanyIds(supabase: Client, userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("company_members")
    .select("company_id")
    .eq("user_id", userId);
  if (error) throw new Error("Could not verify your company workspace.");
  return (data ?? []).map((r) => r.company_id).filter((id): id is string => Boolean(id));
}

/** Throws unless the caller shares a company workspace with `targetUserId`. */
export async function assertSharesCompany(supabase: Client, targetUserId: string): Promise<void> {
  const { data, error } = await supabase.rpc("shares_company_with", { _user_id: targetUserId });
  if (error || !data) throw new Error("That person is not in your company workspace.");
}

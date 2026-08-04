import { supabase } from "@/integrations/supabase/client";

/** Sends an in-app notification to a team member (looked up by their account email). */
export async function notifyUser(input: { userId: string; title: string; body?: string; link?: string }) {
  const { error } = await supabase.from("notifications").insert({
    user_id: input.userId,
    title: input.title,
    body: input.body ?? null,
    link: input.link ?? null,
  });
  if (error) throw error;
}

export type TeamMember = { id: string; email: string | null; full_name: string | null };

export function memberLabel(m: TeamMember) {
  return m.full_name && m.full_name !== m.email ? `${m.full_name} (${m.email ?? "no email"})` : (m.email ?? "Team member");
}

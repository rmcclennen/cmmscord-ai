import { supabase } from "@/integrations/supabase/client";
import { sendAssignmentAlert } from "@/lib/alerts.functions";

/**
 * Records an in-app notification for a teammate and, when they've opted in,
 * pushes it out to their email inbox and/or phone (free carrier SMS gateway).
 */
export async function notifyUser(input: {
  userId: string;
  title: string;
  body?: string;
  link?: string;
  eventKey?: string;
}) {
  const { error } = await supabase.from("notifications").insert({
    user_id: input.userId,
    title: input.title,
    body: input.body ?? null,
    link: input.link ?? null,
  });
  if (error) throw error;

  // Outbound delivery is best-effort: never block the assignment on it.
  try {
    await sendAssignmentAlert({
      data: {
        recipientUserId: input.userId,
        title: input.title,
        body: input.body ?? "",
        link: input.link,
        eventKey: input.eventKey ?? `${input.userId}-${input.title}-${new Date().toISOString().slice(0, 16)}`,
      },
    });
  } catch (err) {
    console.warn("Outbound alert failed", err);
  }
}

export type TeamMember = { id: string; email: string | null; full_name: string | null };

export function memberLabel(m: TeamMember) {
  return m.full_name && m.full_name !== m.email ? `${m.full_name} (${m.email ?? "no email"})` : (m.email ?? "Team member");
}

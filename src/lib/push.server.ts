import { buildPushPayload, type VapidKeys } from "@block65/webcrypto-web-push";
import { isAllowedPushEndpoint } from "@/lib/push-endpoints";

export type PushContent = { title: string; body?: string; url?: string; tag?: string };

export function vapidKeys(): VapidKeys | null {
  const publicKey = process.env["VAPID_PUBLIC_KEY"];
  const privateKey = process.env["VAPID_PRIVATE_KEY"];
  const subject = process.env["VAPID_SUBJECT"];
  if (!publicKey || !privateKey || !subject) return null;
  return { publicKey, privateKey, subject };
}

/**
 * Sends a push to every device a person has enabled. Best-effort: never throws, and
 * removes devices the push service says are gone (404 / 410).
 */
export async function sendPushToUser(userId: string, content: PushContent): Promise<number> {
  const vapid = vapidKeys();
  if (!vapid) return 0;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: subs, error } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);
  if (error || !subs?.length) return 0;

  const message = JSON.stringify({
    title: content.title.slice(0, 120),
    body: (content.body ?? "").slice(0, 300),
    url: content.url ?? "/",
    tag: content.tag,
  });

  let sent = 0;
  const gone: string[] = [];
  await Promise.all(
    subs.map(async (sub) => {
      if (!isAllowedPushEndpoint(sub.endpoint)) {
        gone.push(sub.id);
        return;
      }
      try {
        const payload = await buildPushPayload(
          { data: message, options: { ttl: 3600, urgency: "high" } },
          {
            endpoint: sub.endpoint,
            expirationTime: null,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          vapid,
        );
        const res = await fetch(sub.endpoint, { ...payload, redirect: "error" });
        if (res.ok) sent++;
        else if (res.status === 404 || res.status === 410) gone.push(sub.id);
      } catch (e) {
        console.warn("Push send failed", e instanceof Error ? e.message : e);
      }
    }),
  );

  if (gone.length) await supabaseAdmin.from("push_subscriptions").delete().in("id", gone);
  if (sent) {
    await supabaseAdmin
      .from("push_subscriptions")
      .update({ last_used_at: new Date().toISOString() })
      .eq("user_id", userId);
  }
  return sent;
}

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const schema = z.object({
  recipientUserId: z.string().uuid(),
  title: z.string().trim().min(1).max(140),
  body: z.string().trim().max(1000).default(""),
  link: z.string().trim().max(300).optional(),
  eventKey: z.string().trim().min(1).max(120),
});

/**
 * Sends an assignment alert to one teammate over the channels they opted into:
 * their email inbox and/or their carrier's free email-to-SMS gateway.
 */
export const sendAssignmentAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data, context }) => {
    const { smsGatewayAddress, truncateForSms } = await import("@/lib/carriers");
    const { dispatchMessage, emailConfigured } = await import("@/lib/alerts.server");

    const { data: profile, error } = await context.supabase
      .from("profiles")
      .select("email, full_name, phone, carrier, notify_email, notify_sms")
      .eq("id", data.recipientUserId)
      .maybeSingle();
    if (error) throw error;
    if (!profile) return { configured: emailConfigured(), results: [] };

    if (!emailConfigured()) {
      return { configured: false, results: [] };
    }

    const siteUrl = process.env["SITE_URL"] || "https://cmmscord-ai.lovable.app";
    const url = data.link ? `${siteUrl}${data.link}` : siteUrl;
    const targets: Array<{ to: string; channel: "email" | "sms" }> = [];

    if (profile.notify_email && profile.email) targets.push({ to: profile.email, channel: "email" });
    const smsTo = profile.notify_sms ? smsGatewayAddress(profile.phone, profile.carrier) : null;
    if (smsTo) targets.push({ to: smsTo, channel: "sms" });

    const results = [];
    for (const target of targets) {
      const isSms = target.channel === "sms";
      const text = isSms
        ? truncateForSms(`${data.title}${data.body ? ` — ${data.body}` : ""} ${url}`)
        : `${data.body || data.title}\n\nOpen in CMMSCord AI: ${url}`;
      results.push(
        await dispatchMessage({
          to: target.to,
          channel: target.channel,
          // Carrier gateways prepend the subject to the text body, so keep it empty-ish there.
          subject: isSms ? "CMMSCord AI" : data.title,
          text,
          html: `<p style="font-family:Arial,sans-serif;font-size:14px;color:#111"><strong>${escapeHtml(
            data.title,
          )}</strong><br/>${escapeHtml(data.body)}</p><p style="font-family:Arial,sans-serif;font-size:14px"><a href="${url}">Open in CMMSCord AI</a></p>`,
          idempotencyKey: `${data.eventKey}-${target.channel}-${data.recipientUserId}`,
        }),
      );
    }

    return { configured: true, results };
  });

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

import { sendLovableEmail, EmailAPIError } from "@lovable.dev/email-js";

export type DispatchResult =
  | { sent: true; channel: "email" | "sms"; to: string }
  | { sent: false; channel: "email" | "sms"; to: string; reason: string };

/**
 * The verified sending subdomain (e.g. notify.yourplant.org). Lovable injects it
 * once an email domain is set up for the project; until then alerts are recorded
 * in-app only and this returns null.
 */
function senderDomain() {
  return process.env["EMAIL_SENDER_DOMAIN"] || process.env["LOVABLE_EMAIL_SENDER_DOMAIN"] || null;
}

export function emailConfigured() {
  return Boolean(senderDomain() && process.env["LOVABLE_API_KEY"]);
}

/** Sends one plain message. Used for both real inboxes and carrier SMS gateways. */
export async function dispatchMessage(input: {
  to: string;
  channel: "email" | "sms";
  subject: string;
  text: string;
  html: string;
  idempotencyKey: string;
}): Promise<DispatchResult> {
  const domain = senderDomain();
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!domain || !apiKey) {
    return {
      sent: false,
      channel: input.channel,
      to: input.to,
      reason: "email_domain_not_configured",
    };
  }

  try {
    await sendLovableEmail(
      {
        to: input.to,
        from: `AssetCareConnect <alerts@${domain}>`,
        sender_domain: domain,
        subject: input.subject,
        text: input.text,
        html: input.html,
        label: input.channel === "sms" ? "sms-gateway" : "alert",
        idempotency_key: input.idempotencyKey,
      },
      { apiKey, idempotencyKey: input.idempotencyKey },
    );
    return { sent: true, channel: input.channel, to: input.to };
  } catch (error) {
    const reason =
      error instanceof EmailAPIError ? (error.code ?? `http_${error.status}`) : "send_failed";
    console.error(`[alerts] ${input.channel} send to ${input.to} failed: ${reason}`);
    return { sent: false, channel: input.channel, to: input.to, reason };
  }
}

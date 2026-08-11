/**
 * Email-to-SMS carrier gateways.
 *
 * A text is delivered by emailing <10-digit-number>@<gateway>. The carrier
 * converts the message into a text at no cost, but delivery is best-effort:
 * carriers throttle, strip long subjects, and some are sunsetting these
 * gateways entirely. Keep bodies short and always keep email as a fallback.
 */
export const CARRIERS = [
  { value: "verizon", label: "Verizon", gateway: "vtext.com" },
  { value: "att", label: "AT&T", gateway: "txt.att.net" },
  { value: "tmobile", label: "T-Mobile", gateway: "tmomail.net" },
  { value: "sprint", label: "Sprint / T-Mobile legacy", gateway: "messaging.sprintpcs.com" },
  { value: "uscellular", label: "US Cellular", gateway: "email.uscc.net" },
  { value: "boost", label: "Boost Mobile", gateway: "sms.myboostmobile.com" },
  { value: "cricket", label: "Cricket", gateway: "sms.cricketwireless.net" },
  { value: "metro", label: "Metro by T-Mobile", gateway: "mymetropcs.com" },
  { value: "googlefi", label: "Google Fi", gateway: "msg.fi.google.com" },
  { value: "consumer", label: "Consumer Cellular", gateway: "mailmymobile.net" },
  { value: "spectrum", label: "Spectrum Mobile", gateway: "vtext.com" },
  { value: "xfinity", label: "Xfinity Mobile", gateway: "vtext.com" },
  { value: "visible", label: "Visible", gateway: "vtext.com" },
  { value: "mint", label: "Mint Mobile", gateway: "tmomail.net" },
] as const;

export type CarrierValue = (typeof CARRIERS)[number]["value"];

export function carrierLabel(value: string | null | undefined) {
  return CARRIERS.find((c) => c.value === value)?.label ?? null;
}

/** Strips formatting and returns 10 digits, or null when the number isn't a US mobile number. */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  return digits.length === 10 ? digits : null;
}

export function formatPhone(raw: string | null | undefined) {
  const d = normalizePhone(raw);
  return d ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : (raw ?? "");
}

/** Builds the email-to-SMS gateway address for a phone + carrier, e.g. 5551234567@vtext.com. */
export function smsGatewayAddress(
  phone: string | null | undefined,
  carrier: string | null | undefined,
) {
  const digits = normalizePhone(phone);
  const entry = CARRIERS.find((c) => c.value === carrier);
  if (!digits || !entry) return null;
  return `${digits}@${entry.gateway}`;
}

/** Carrier gateways drop long messages; keep texts inside a single segment-ish budget. */
export function truncateForSms(text: string, max = 300) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1)}…`;
}

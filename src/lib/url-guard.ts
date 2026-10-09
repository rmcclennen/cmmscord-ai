/**
 * Guards for server-side fetches of user-supplied links (manual downloads, document
 * scans). Without them a signed-in user could make the server request internal
 * addresses (cloud metadata, localhost, private networks) or use it as an open proxy.
 *
 * Scope: blocks non-web schemes, credentials in the URL, non-standard ports, local /
 * internal hostnames and private, loopback and link-local IP literals, and re-checks
 * every redirect hop. It does not resolve DNS, so a public hostname that points at a
 * private address is not caught here; run on a platform that blocks private egress
 * (Cloudflare Workers does) for defence in depth.
 */

const BLOCKED_HOST_SUFFIXES = [".localhost", ".local", ".internal", ".intranet", ".lan", ".home"];

function ipv4ToParts(host: string): number[] | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return null;
  const parts = m.slice(1).map(Number);
  return parts.every((n) => n >= 0 && n <= 255) ? parts : null;
}

export function isPrivateIPv4(host: string): boolean {
  const p = ipv4ToParts(host);
  if (!p) return false;
  const [a, b] = p as [number, number, number, number];
  return (
    a === 0 || // "this" network
    a === 10 ||
    a === 127 || // loopback
    (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
    (a === 169 && b === 254) || // link-local, cloud metadata
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) || // protocol assignments
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) || // benchmarking
    a >= 224 // multicast, reserved, broadcast
  );
}

export function isPrivateIPv6(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, "").toLowerCase();
  if (!h.includes(":")) return false;
  if (h === "::" || h === "::1") return true;
  if (/^f[cd]/.test(h)) return true; // unique local fc00::/7
  if (/^fe[89ab]/.test(h)) return true; // link-local fe80::/10
  if (/^ff/.test(h)) return true; // multicast
  // IPv4-mapped (::ffff:a.b.c.d or ::ffff:7f00:1)
  const mapped = /^::ffff:(.+)$/.exec(h);
  if (mapped) {
    const rest = mapped[1]!;
    if (rest.includes(".")) return isPrivateIPv4(rest);
    const hex = rest.split(":");
    if (hex.length === 2) {
      const hi = parseInt(hex[0]!, 16);
      const lo = parseInt(hex[1]!, 16);
      return isPrivateIPv4(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
    }
    return true;
  }
  return false;
}

/** Throws a user-readable Error unless `raw` is a plain public http(s) URL. */
export function assertPublicHttpUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("That is not a valid web address.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only web links (http or https) are supported.");
  }
  if (url.username || url.password) {
    throw new Error("Links with a username or password are not supported.");
  }
  if (url.port && url.port !== "80" && url.port !== "443") {
    throw new Error("Links to non-standard ports are not supported.");
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  const isIp = host.includes(":") || /^[\d.]+$/.test(host);
  if (
    !host ||
    host === "localhost" ||
    BLOCKED_HOST_SUFFIXES.some((s) => host.endsWith(s)) ||
    (!isIp && !host.includes(".")) ||
    isPrivateIPv4(host) ||
    isPrivateIPv6(host)
  ) {
    throw new Error("That address points to a private or internal network.");
  }
  return url;
}

export type SafeFetchOptions = {
  maxRedirects?: number;
  timeoutMs?: number;
  /** An origin that is always allowed (the app's own origin, for site-relative files). */
  allowOrigin?: string;
};

/** fetch() that validates the URL and every redirect hop, with a timeout. */
export async function safeFetch(
  rawUrl: string,
  init: RequestInit = {},
  { maxRedirects = 3, timeoutMs = 20_000, allowOrigin }: SafeFetchOptions = {},
): Promise<Response> {
  let current = rawUrl;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const isOwn = allowOrigin ? new URL(current).origin === allowOrigin : false;
    const url = isOwn ? new URL(current) : assertPublicHttpUrl(current);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetch(url, { ...init, redirect: "manual", signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
    if (res.status >= 300 && res.status < 400 && res.headers.has("location")) {
      current = new URL(res.headers.get("location")!, url).toString();
      continue;
    }
    return res;
  }
  throw new Error("That link redirected too many times.");
}

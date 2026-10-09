/**
 * Push endpoints come from the browser, so they are untrusted. Only the well-known
 * push services are accepted; otherwise a signed-in user could make the server send
 * requests to any address they like.
 */
const ALLOWED_SUFFIXES = [
  ".googleapis.com", // Chrome / Android (FCM)
  ".push.services.mozilla.com", // Firefox
  ".push.apple.com", // Safari / iOS
  ".notify.windows.com", // Edge
];

export function isAllowedPushEndpoint(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
  const host = url.hostname.toLowerCase();
  return ALLOWED_SUFFIXES.some((s) => host.endsWith(s));
}

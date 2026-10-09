const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Pulls an asset id out of whatever a scanned code contains.
 * Accepts our label URLs (`https://host/assets/<uuid>`, any host, so labels printed
 * before a domain change keep working), a relative `/assets/<uuid>` path, or a bare uuid.
 */
export function parseAssetCode(raw: string): string | null {
  const text = (raw ?? "").trim();
  if (!text) return null;
  if (UUID.test(text)) return text.toLowerCase();
  let path = text;
  try {
    path = new URL(text, "https://placeholder.invalid").pathname;
  } catch {
    return null;
  }
  const m = /^\/assets\/([^/]+)\/?$/.exec(path);
  const id = m?.[1];
  return id && UUID.test(id) ? id.toLowerCase() : null;
}

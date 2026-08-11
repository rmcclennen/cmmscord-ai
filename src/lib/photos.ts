import { supabase } from "@/integrations/supabase/client";

export const PHOTO_BUCKET = "asset-photos";

export type PhotoKind = "equipment" | "nameplate";

export const PHOTO_KIND_LABEL: Record<PhotoKind, string> = {
  equipment: "Equipment",
  nameplate: "Nameplate / label",
};

/** Downscale + compress a captured photo into a JPEG data URL (browser only). */
export async function fileToJpegDataUrl(
  file: File,
  maxDim = 1600,
  quality = 0.82,
): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process the photo on this device.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();
  return canvas.toDataURL("image/jpeg", quality);
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, base64] = dataUrl.split(",");
  const mime = /:(.*?);/.exec(meta ?? "")?.[1] ?? "image/jpeg";
  const bytes = atob(base64 ?? "");
  const buf = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i);
  return new Blob([buf], { type: mime });
}

/** Uploads a captured photo and records it against an asset. */
export async function saveAssetPhoto(opts: {
  assetId: string;
  dataUrl: string;
  kind: PhotoKind;
  caption?: string | null;
  userId: string;
}) {
  const path = `${opts.assetId}/${crypto.randomUUID()}.jpg`;
  const { error: uploadError } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, dataUrlToBlob(opts.dataUrl), { contentType: "image/jpeg", upsert: false });
  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from("asset_photos")
    .insert({
      asset_id: opts.assetId,
      storage_path: path,
      kind: opts.kind,
      caption: opts.caption ?? null,
      uploaded_by: opts.userId,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function signedPhotoUrls(paths: string[]) {
  if (paths.length === 0) return {} as Record<string, string>;
  const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(paths, 3600);
  if (error) throw error;
  const map: Record<string, string> = {};
  for (const row of data ?? []) if (row.path && row.signedUrl) map[row.path] = row.signedUrl;
  return map;
}

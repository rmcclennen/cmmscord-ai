import { supabase } from "@/integrations/supabase/client";
import { PHOTO_BUCKET, fileToJpegDataUrl } from "@/lib/photos";

export const REQUEST_STATUSES = ["requested", "bidding", "ordered", "received", "cancelled"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const STATUS_LABEL: Record<RequestStatus, string> = {
  requested: "Requested",
  bidding: "Out for bid",
  ordered: "Ordered",
  received: "Received",
  cancelled: "Cancelled",
};

/** Where the request goes: the whole supervisor/manager group, or one person. */
export const ROUTE_OPTIONS = [
  { value: "supervisors", label: "Supervisors & managers (CMMS buyers)" },
  { value: "person", label: "A specific person" },
] as const;

export type PartRequestRow = {
  id: string;
  title: string;
  part_lines: string;
  note: string | null;
  priority: string;
  needed_by: string | null;
  status: string;
  route_to: string;
  vendor: string | null;
  quoted_cost: number | null;
  decision_note: string | null;
  photo_paths: string[];
  created_at: string;
  requested_by: string | null;
  sent_to: string | null;
  work_order_id: string | null;
  work_orders: { id: string; wo_number: number; title: string } | null;
  assets: { id: string; name: string } | null;
};

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, base64] = dataUrl.split(",");
  const mime = /:(.*?);/.exec(meta ?? "")?.[1] ?? "image/jpeg";
  const bytes = atob(base64 ?? "");
  const buf = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i);
  return new Blob([buf], { type: mime });
}

/** Compresses and uploads photos that travel with a parts request. */
export async function uploadRequestPhotos(files: File[]): Promise<string[]> {
  const paths: string[] = [];
  for (const file of files) {
    const dataUrl = await fileToJpegDataUrl(file);
    const path = `part-requests/${crypto.randomUUID()}.jpg`;
    const { error } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(path, dataUrlToBlob(dataUrl), { contentType: "image/jpeg", upsert: false });
    if (error) throw error;
    paths.push(path);
  }
  return paths;
}

/**
 * Sends a parts request to the buyers. The database trigger notifies either the
 * chosen teammate or every manager/supervisor, so nothing is needed here.
 */
export async function createPartRequest(input: {
  title: string;
  partLines: string;
  note?: string | null;
  priority?: string;
  neededBy?: string | null;
  routeTo: "supervisors" | "person";
  sentTo?: string | null;
  workOrderId?: string | null;
  assetId?: string | null;
  partId?: string | null;
  photos?: File[];
}) {
  const userId = (await supabase.auth.getUser()).data.user?.id ?? null;
  if (!userId) throw new Error("Sign in again to send a parts request.");
  const photo_paths = input.photos?.length ? await uploadRequestPhotos(input.photos) : [];

  const { data, error } = await supabase
    .from("part_requests")
    .insert({
      title: input.title.trim(),
      part_lines: input.partLines.trim(),
      note: input.note?.trim() || null,
      priority: input.priority ?? "medium",
      needed_by: input.neededBy || null,
      route_to: input.routeTo,
      sent_to: input.routeTo === "person" ? (input.sentTo ?? null) : null,
      work_order_id: input.workOrderId ?? null,
      asset_id: input.assetId ?? null,
      part_id: input.partId ?? null,
      photo_paths,
      requested_by: userId,
      status: "requested",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function updateRequestStatus(input: {
  id: string;
  status: RequestStatus;
  vendor?: string | null;
  quotedCost?: string | null;
  note?: string | null;
}) {
  const userId = (await supabase.auth.getUser()).data.user?.id ?? null;
  const cost = input.quotedCost?.trim() ? Number(input.quotedCost) : null;
  const { error } = await supabase
    .from("part_requests")
    .update({
      status: input.status,
      vendor: input.vendor?.trim() || null,
      quoted_cost: Number.isFinite(cost as number) ? cost : null,
      decision_note: input.note?.trim() || null,
      handled_by: userId,
      handled_at: new Date().toISOString(),
    })
    .eq("id", input.id);
  if (error) throw error;
}

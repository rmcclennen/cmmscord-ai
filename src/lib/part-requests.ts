import { supabase } from "@/integrations/supabase/client";
import { PHOTO_BUCKET, fileToJpegDataUrl } from "@/lib/photos";

export const REQUEST_STATUSES = [
  "requested",
  "bidding",
  "ordered",
  "received",
  "cancelled",
] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const STATUS_LABEL: Record<RequestStatus, string> = {
  requested: "Requested",
  bidding: "Out for bid",
  ordered: "Ordered",
  received: "Received",
  cancelled: "Cancelled",
};

export type RouteOptionValue = "supervisors" | "coordinator" | "supervisor" | "person";

/** Where the request goes: the whole supervisor/manager group, CMMS coordinator, shift supervisor, or one person. */
export const ROUTE_OPTIONS = [
  { value: "coordinator", label: "CMMS Coordinator / Procurement Lead" },
  { value: "supervisor", label: "Maintenance / Shift Supervisor" },
  { value: "supervisors", label: "All Supervisors & CMMS Buyers" },
  { value: "person", label: "A specific person" },
] as const;

export type PartRequestBid = {
  id: string;
  request_id: string;
  vendor: string;
  amount: number | null;
  lead_time_days: number | null;
  contact: string | null;
  note: string | null;
  is_winner: boolean;
  created_at: string;
};

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
  awarded_vendor: string | null;
  awarded_cost: number | null;
  lead_time_days: number | null;
  po_number: string | null;
  expected_date: string | null;
  ordered_at: string | null;
  received_at: string | null;
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

const num = (v?: string | null) => {
  const n = v?.trim() ? Number(v) : null;
  return n != null && Number.isFinite(n) ? n : null;
};

const int = (v?: string | null) => {
  const n = num(v);
  return n != null ? Math.round(n) : null;
};

/** Order/award details captured once a bid is chosen. */
export async function updateRequestOrder(input: {
  id: string;
  awardedVendor?: string | null;
  awardedCost?: string | null;
  leadTimeDays?: string | null;
  poNumber?: string | null;
  expectedDate?: string | null;
  status?: RequestStatus;
}) {
  const patch: {
    awarded_vendor: string | null;
    awarded_cost: number | null;
    lead_time_days: number | null;
    po_number: string | null;
    expected_date: string | null;
    ordered_at?: string;
    received_at?: string;
  } = {
    awarded_vendor: input.awardedVendor?.trim() || null,
    awarded_cost: num(input.awardedCost),
    lead_time_days: int(input.leadTimeDays),
    po_number: input.poNumber?.trim() || null,
    expected_date: input.expectedDate || null,
  };
  if (input.status === "ordered") patch.ordered_at = new Date().toISOString();
  if (input.status === "received") patch.received_at = new Date().toISOString();
  const { error } = await supabase.from("part_requests").update(patch).eq("id", input.id);
  if (error) throw error;
}

export async function listBids(requestId: string): Promise<PartRequestBid[]> {
  const { data, error } = await supabase
    .from("part_request_bids")
    .select("id, request_id, vendor, amount, lead_time_days, contact, note, is_winner, created_at")
    .eq("request_id", requestId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as PartRequestBid[];
}

export async function addBid(input: {
  requestId: string;
  vendor: string;
  amount?: string | null;
  leadTimeDays?: string | null;
  contact?: string | null;
  note?: string | null;
}) {
  const userId = (await supabase.auth.getUser()).data.user?.id ?? null;
  if (!userId) throw new Error("Sign in again to log a bid.");
  const { error } = await supabase.from("part_request_bids").insert({
    request_id: input.requestId,
    vendor: input.vendor.trim(),
    amount: num(input.amount),
    lead_time_days: int(input.leadTimeDays),
    contact: input.contact?.trim() || null,
    note: input.note?.trim() || null,
    created_by: userId,
  });
  if (error) throw error;
}

export async function deleteBid(id: string) {
  const { error } = await supabase.from("part_request_bids").delete().eq("id", id);
  if (error) throw error;
}

/** Marks one bid the winner and copies vendor/cost/lead time onto the request. */
export async function awardBid(bid: PartRequestBid) {
  const clear = await supabase
    .from("part_request_bids")
    .update({ is_winner: false })
    .eq("request_id", bid.request_id);
  if (clear.error) throw clear.error;
  const win = await supabase.from("part_request_bids").update({ is_winner: true }).eq("id", bid.id);
  if (win.error) throw win.error;
  const { error } = await supabase
    .from("part_requests")
    .update({
      awarded_vendor: bid.vendor,
      awarded_cost: bid.amount,
      lead_time_days: bid.lead_time_days,
    })
    .eq("id", bid.request_id);
  if (error) throw error;
}

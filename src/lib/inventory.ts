import { supabase } from "@/integrations/supabase/client";

export type PartRow = {
  id: string;
  name: string;
  part_number: string | null;
  manufacturer: string | null;
  description: string | null;
  unit: string;
  where_to_buy: string | null;
  unit_cost: number | null;
  qty_on_hand: number;
  min_qty: number;
  location: string | null;
  bin: string | null;
};

export const MOVEMENT_KINDS = ["receive", "issue", "adjust", "return"] as const;
export type MovementKind = (typeof MOVEMENT_KINDS)[number];

export function isLowStock(p: Pick<PartRow, "qty_on_hand" | "min_qty">) {
  return p.min_qty > 0 && p.qty_on_hand <= p.min_qty;
}

/**
 * Finds an existing part by part number (or name + manufacturer when there is
 * no number) so the same physical part isn't created twice, then optionally
 * links it to the asset it fits.
 */
export async function upsertPartAndLink(input: {
  name: string;
  part_number?: string | null;
  manufacturer?: string | null;
  where_to_buy?: string | null;
  description?: string | null;
  assetId?: string | null;
}) {
  const userId = (await supabase.auth.getUser()).data.user?.id ?? null;

  let existingId: string | null = null;
  if (input.part_number?.trim()) {
    const { data } = await supabase
      .from("parts")
      .select("id")
      .ilike("part_number", input.part_number.trim())
      .limit(1)
      .maybeSingle();
    existingId = data?.id ?? null;
  }
  if (!existingId) {
    const { data } = await supabase
      .from("parts")
      .select("id")
      .ilike("name", input.name.trim())
      .limit(1)
      .maybeSingle();
    existingId = data?.id ?? null;
  }

  let partId = existingId;
  if (!partId) {
    const { data, error } = await supabase
      .from("parts")
      .insert({
        name: input.name.trim(),
        part_number: input.part_number?.trim() || null,
        manufacturer: input.manufacturer?.trim() || null,
        where_to_buy: input.where_to_buy?.trim() || null,
        description: input.description?.trim() || null,
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) throw error;
    partId = data.id;
  }

  if (input.assetId) {
    const { error } = await supabase
      .from("part_assets")
      .upsert({ part_id: partId, asset_id: input.assetId }, { onConflict: "part_id,asset_id" });
    if (error) throw error;
  }

  return { partId, created: !existingId };
}

export async function recordMovement(input: {
  partId: string;
  kind: MovementKind;
  qty: number;
  assetId?: string | null;
  workOrderId?: string | null;
  note?: string | null;
}) {
  const userId = (await supabase.auth.getUser()).data.user?.id ?? null;
  const { error } = await supabase.from("part_transactions").insert({
    part_id: input.partId,
    kind: input.kind,
    qty: input.qty,
    asset_id: input.assetId ?? null,
    work_order_id: input.workOrderId ?? null,
    note: input.note?.trim() || null,
    performed_by: userId,
  });
  if (error) throw error;
}

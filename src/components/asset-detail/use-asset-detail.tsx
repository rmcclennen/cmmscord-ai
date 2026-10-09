import type { Json } from "@/integrations/supabase/types";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { researchAssetMaintenance, updateAssetMaintenanceParts } from "@/lib/maintenance.functions";
import { generateComprehensiveMaintenanceData } from "@/lib/maintenance-intelligence";
import { useTeamMembers } from "@/hooks/use-team-members";
import { notifyUser } from "@/lib/notify";
import {
  buildingOf,
  clampToSeason,
  classLabel,
  dueTone,
  frequencyToDays,
  getManufacturerConsumables,
  systemOf,
} from "@/lib/cmms";
import { getManufacturerPortalInfo } from "@/lib/manufacturer-links";
import { upsertPartAndLink } from "@/lib/inventory";
import { type PartRequestRow } from "@/lib/part-requests";
import { toast } from "sonner";
import { Interval, Part } from "./helpers";

export function useAssetDetail(assetId: string) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const research = useServerFn(researchAssetMaintenance);
  const team = useTeamMembers();
  const [tab, setTab] = useState("specs");
  const [scanManualDialogOpen, setScanManualDialogOpen] = useState(false);
  const [selectedManualForScan, setSelectedManualForScan] = useState<{
    id?: string;
    title: string;
    url: string;
  }>({ title: "", url: "" });

  const asset = useQuery({
    queryKey: ["asset", assetId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assets")
        .select("*")
        .eq("id", assetId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Query all assets to facilitate next/prev asset cycling and quick switching
  const allAssetsQuery = useQuery({
    queryKey: ["assets-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assets")
        .select("id, name, tag_number, class, type, make, model, category, building, location_name")
        .order("name");
      if (error) throw error;
      return (data ?? []).map((item) => {
        const bldg = buildingOf(item.name, null, item.location_name, item.building);
        const sys = systemOf(item.name, bldg, item.location_name, item.type, item.category);
        return {
          ...item,
          resolvedBuilding: bldg,
          resolvedSystem: sys,
        };
      });
    },
  });

  const allAssets = useMemo(() => allAssetsQuery.data ?? [], [allAssetsQuery.data]);
  const currentIndex = useMemo(
    () => allAssets.findIndex((item) => item.id === assetId),
    [allAssets, assetId],
  );
  const prevAsset = currentIndex > 0 ? allAssets[currentIndex - 1] : null;
  const nextAsset =
    currentIndex >= 0 && currentIndex < allAssets.length - 1 ? allAssets[currentIndex + 1] : null;

  const currentAssetData = asset.data;
  const resolvedBuilding = currentAssetData
    ? buildingOf(
        currentAssetData.name,
        null,
        currentAssetData.location_name,
        currentAssetData.building,
      )
    : "";
  const resolvedSystem = currentAssetData
    ? systemOf(
        currentAssetData.name,
        resolvedBuilding,
        currentAssetData.location_name,
        currentAssetData.type,
        currentAssetData.category,
      )
    : "";

  const systemSiblings = useMemo(() => {
    if (!resolvedSystem) return [];
    return allAssets.filter((other) => other.resolvedSystem === resolvedSystem);
  }, [allAssets, resolvedSystem]);

  // Keyboard navigation shortcuts: Alt+Left / '[' for Prev, Alt+Right / ']' for Next
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      if ((e.altKey && e.key === "ArrowLeft") || e.key === "[") {
        if (prevAsset) {
          e.preventDefault();
          navigate({ to: "/assets/$assetId", params: { assetId: prevAsset.id } });
        }
      } else if ((e.altKey && e.key === "ArrowRight") || e.key === "]") {
        if (nextAsset) {
          e.preventDefault();
          navigate({ to: "/assets/$assetId", params: { assetId: nextAsset.id } });
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [prevAsset, nextAsset, navigate]);

  const pms = useQuery({
    queryKey: ["asset-pms", assetId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pm_schedules")
        .select("*")
        .eq("asset_id", assetId)
        .order("next_due");
      if (error) throw error;
      return data;
    },
  });

  const wos = useQuery({
    queryKey: ["asset-wos", assetId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_orders")
        .select("*")
        .eq("asset_id", assetId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const manuals = useQuery({
    queryKey: ["asset-manuals", assetId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("manuals")
        .select("*")
        .eq("asset_id", assetId)
        .order("title");
      if (error) throw error;
      return data;
    },
  });

  const deleteManualMutation = useMutation({
    mutationFn: async (manualId: string) => {
      const { error } = await supabase.from("manuals").delete().eq("id", manualId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Manual unlinked from asset");
      queryClient.invalidateQueries({ queryKey: ["asset-manuals", assetId] });
      queryClient.invalidateQueries({ queryKey: ["manuals"] });
      queryClient.invalidateQueries({ queryKey: ["manuals-all"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const info = useQuery({
    queryKey: ["asset-info", assetId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asset_maintenance_info")
        .select("*")
        .eq("asset_id", assetId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const linkedPartsQuery = useQuery({
    queryKey: ["asset-linked-parts", assetId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("part_assets")
        .select(
          `
          id,
          note,
          parts (
            id,
            name,
            part_number,
            manufacturer,
            unit_cost,
            qty_on_hand,
            min_qty,
            unit,
            where_to_buy,
            description
          )
        `,
        )
        .eq("asset_id", assetId);
      if (error) throw error;
      return (data ?? []).map((r) => r.parts).filter(Boolean);
    },
  });

  const completePm = useMutation({
    mutationFn: async (pm: {
      id: string;
      interval_days: number;
      season_start_md: string | null;
      season_end_md: string | null;
    }) => {
      const todayStr = new Date().toISOString().slice(0, 10);
      const raw = new Date(Date.now() + pm.interval_days * 86400000).toISOString().slice(0, 10);
      const next = clampToSeason(raw, pm.season_start_md, pm.season_end_md);
      const { error } = await supabase
        .from("pm_schedules")
        .update({ last_completed: todayStr, next_due: next })
        .eq("id", pm.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("PM marked complete and scheduled for next interval");
      queryClient.invalidateQueries({ queryKey: ["asset-pms", assetId] });
      queryClient.invalidateQueries({ queryKey: ["pms"] });
      queryClient.invalidateQueries({ queryKey: ["assets-pms-summary"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const assignPm = useMutation({
    mutationFn: async (pm: {
      id: string;
      title: string;
      next_due: string;
      userId: string | null;
    }) => {
      const { error } = await supabase
        .from("pm_schedules")
        .update({ assigned_to: pm.userId })
        .eq("id", pm.id);
      if (error) throw error;
      if (pm.userId) {
        notifyUser({
          userId: pm.userId,
          title: "PM task assigned to you",
          body: `${pm.title} on ${asset.data?.name || "equipment"} · next due ${pm.next_due}`,
          link: `/assets/${assetId}`,
        }).catch(() => {});
      }
    },
    onSuccess: () => {
      toast.success("Technician assigned");
      queryClient.invalidateQueries({ queryKey: ["asset-pms", assetId] });
      queryClient.invalidateQueries({ queryKey: ["pms"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const lookup = useMutation({
    mutationFn: async () => {
      try {
        const res = await research({ data: { assetId } });
        if (res) return res;
      } catch (err) {
        console.warn("Server lookup error, applying resilient local intelligence fallback:", err);
      }

      if (asset.data) {
        const fallbackData = generateComprehensiveMaintenanceData(asset.data);
        const { data: row, error: insertError } = await supabase
          .from("asset_maintenance_info")
          .insert({
            asset_id: assetId,
            summary: fallbackData.summary,
            intervals: fallbackData.intervals as unknown as Json,
            parts: fallbackData.parts as unknown as Json,
            sources: fallbackData.sources as unknown as Json,
          })
          .select()
          .single();

        if (!insertError && row) {
          return row;
        }
        return {
          id: crypto.randomUUID(),
          asset_id: assetId,
          created_at: new Date().toISOString(),
          summary: fallbackData.summary,
          intervals: fallbackData.intervals as unknown as Json,
          parts: fallbackData.parts as unknown as Json,
          sources: fallbackData.sources as unknown as Json,
        };
      }
      throw new Error("Asset details not loaded yet.");
    },
    onSuccess: () => {
      toast.success("Manufacturer maintenance data retrieved");
      queryClient.invalidateQueries({ queryKey: ["asset-info", assetId] });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to retrieve maintenance data"),
  });

  const updatePartsFn = useServerFn(updateAssetMaintenanceParts);
  const deletePartMutation = useMutation({
    mutationFn: async (partIdx: number) => {
      const updated = parts.filter((_, i) => i !== partIdx);
      try {
        await updatePartsFn({ data: { assetId, parts: updated } });
      } catch (e) {
        console.warn("Server function update failed, saving via client fallback:", e);
        const { data: existing } = await supabase
          .from("asset_maintenance_info")
          .select("id")
          .eq("asset_id", assetId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existing) {
          await supabase
            .from("asset_maintenance_info")
            .update({ parts: updated })
            .eq("id", existing.id);
        }
      }
      return updated;
    },
    onSuccess: (_, partIdx) => {
      const deletedPartName = parts[partIdx]?.name || "Part";
      toast.success(`Removed "${deletedPartName}" from asset`);
      queryClient.invalidateQueries({ queryKey: ["asset-info", assetId] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to delete part");
    },
  });

  const moveBuilding = useMutation({
    mutationFn: async (value: string) => {
      const { error } = await supabase
        .from("assets")
        .update({ building: value === "auto" ? null : value })
        .eq("id", assetId);
      if (error) throw error;
      return value;
    },
    onSuccess: (value) => {
      toast.success(value === "auto" ? "Reset to automatic building" : `Moved to ${value}`);
      queryClient.invalidateQueries({ queryKey: ["asset", assetId] });
      queryClient.invalidateQueries({ queryKey: ["assets-all"] });
      queryClient.invalidateQueries({ queryKey: ["pms"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateAssetStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const { error } = await supabase
        .from("assets")
        .update({ status: newStatus })
        .eq("id", assetId);
      if (error) throw error;
      return newStatus;
    },
    onSuccess: (newStatus) => {
      toast.success(`Asset status updated to ${newStatus.toUpperCase().replace("_", " ")}`);
      queryClient.invalidateQueries({ queryKey: ["asset", assetId] });
      queryClient.invalidateQueries({ queryKey: ["assets-all"] });
      queryClient.invalidateQueries({ queryKey: ["equipment-down"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const addPms = useMutation({
    mutationFn: async (items: Interval[]) => {
      const today = new Date();
      const rows = items.map((i) => {
        const days = frequencyToDays(i.frequency);
        const due = new Date(today.getTime() + days * 86400000);
        return {
          asset_id: assetId,
          title: i.task,
          tasks: [i.frequency ? `Manufacturer interval: ${i.frequency}` : null, i.notes]
            .filter(Boolean)
            .join("\n"),
          interval_days: days,
          next_due: due.toISOString().slice(0, 10),
          priority: "medium",
          active: true,
        };
      });
      const { error } = await supabase.from("pm_schedules").insert(rows);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (n) => {
      toast.success(n === 1 ? "PM added to schedule" : `${n} PMs added to schedule`);
      queryClient.invalidateQueries({ queryKey: ["pms"] });
      queryClient.invalidateQueries({ queryKey: ["asset-pms", assetId] });
      queryClient.invalidateQueries({ queryKey: ["assets-pms-summary"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const assetPartRequests = useQuery({
    queryKey: ["asset-part-requests", assetId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("part_requests")
        .select(
          `id, title, part_lines, note, priority, needed_by, status, route_to, vendor, quoted_cost, decision_note, photo_paths, created_at, requested_by, sent_to, work_order_id, awarded_vendor, awarded_cost, lead_time_days, po_number, expected_date, ordered_at, received_at, work_orders(id, wo_number, title)`,
        )
        .eq("asset_id", assetId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PartRequestRow[];
    },
  });

  const markRequestReceived = useMutation({
    mutationFn: async (requestId: string) => {
      const { error } = await supabase
        .from("part_requests")
        .update({
          status: "received",
          received_at: new Date().toISOString(),
        })
        .eq("id", requestId);
      if (error) throw error;
      return requestId;
    },
    onSuccess: () => {
      toast.success("Part marked as received and ready in plant stockroom!");
      queryClient.invalidateQueries({ queryKey: ["asset-part-requests", assetId] });
      queryClient.invalidateQueries({ queryKey: ["part-requests"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const addPartToInventory = useMutation({
    mutationFn: async (p: Part) => {
      if (!asset.data) throw new Error("Asset not loaded");
      await upsertPartAndLink({
        name: p.name,
        part_number: p.part_number ?? null,
        manufacturer: asset.data.manufacturer ?? null,
        where_to_buy: p.notes ?? null,
        assetId: asset.data.id,
      });
    },
    onSuccess: (_, p) => {
      toast.success(`"${p.name}" added to plant stockroom inventory`);
      queryClient.invalidateQueries({ queryKey: ["parts"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const a = asset.data;

  const defaultIntelligence = useMemo(() => {
    if (!a) return null;
    return generateComprehensiveMaintenanceData({
      id: a.id,
      name: a.name,
      manufacturer: a.manufacturer || a.make,
      make: a.make,
      model: a.model,
      serial_number: a.serial_number,
      class: a.class,
      type: a.type,
      hp: a.hp,
      volts: a.volts,
      rpm: a.rpm,
      frame: a.frame,
    });
  }, [a]);

  const intervals: Interval[] = useMemo(() => {
    const raw = info.data?.intervals as Interval[] | null;
    if (Array.isArray(raw) && raw.length > 0) return raw;
    return defaultIntelligence?.intervals ?? [];
  }, [info.data?.intervals, defaultIntelligence]);

  const parts: Part[] = useMemo(() => {
    const raw = info.data?.parts as Part[] | null;
    if (Array.isArray(raw) && raw.length > 0) return raw;

    const dbParts = linkedPartsQuery.data;
    if (Array.isArray(dbParts) && dbParts.length > 0) {
      return dbParts.map((p) => ({
        name: p.name,
        part_number: p.part_number || undefined,
        notes: p.description || undefined,
      }));
    }

    return [];
  }, [info.data?.parts, linkedPartsQuery.data]);

  const dbPartMatch = useMemo(() => {
    const map = new Map<
      string,
      {
        qty_on_hand?: number | null;
        unit_cost?: number | null;
        min_qty?: number | null;
        unit?: string | null;
      }
    >();
    for (const dp of linkedPartsQuery.data ?? []) {
      if (!dp) continue;
      if (dp.part_number) map.set(dp.part_number.toLowerCase().trim(), dp);
      map.set(dp.name.toLowerCase().trim(), dp);
    }
    return map;
  }, [linkedPartsQuery.data]);

  if (asset.isLoading) return { state: "loading" as const };
  if (!asset.data || !a) return { state: "missing" as const };

  const mfgPortalInfo = getManufacturerPortalInfo(
    a.manufacturer || a.make,
    a.model,
    a.manufacturer_url,
    a.name,
  );
  const googleManualUrl = `https://www.google.com/search?q=${encodeURIComponent(
    [a.manufacturer || a.make || "", a.model || "", a.name, "O&M manual pdf"]
      .filter(Boolean)
      .join(" "),
  )}`;
  const openGoogleManualSearch = () =>
    window.open(googleManualUrl, "_blank", "noopener,noreferrer");
  const consumables = getManufacturerConsumables(a);

  const specs: [string, string | null][] = [
    ["Class", classLabel(a.class)],
    ["Type", a.type],
    ["Category", a.category],
    ["Tag number", a.tag_number],
    ["Make", a.make],
    ["Model", a.model],
    ["Serial", a.serial_number],
    ["Manufacturer", a.manufacturer],
    ["Supplier", a.supplier],
    ["HP", a.hp],
    ["Volts", a.volts],
    ["Phase", a.phase],
    ["Hertz", a.hertz],
    ["RPM", a.rpm],
    ["Frame", a.frame],
    ["Enclosure", a.enclosure],
    ["Building / area", resolvedBuilding],
    ["Location", a.location_name],
    ["Commissioned", a.commission_date],
  ];

  const pmList = pms.data ?? [];
  const overduePmsCount = pmList.filter((p) => dueTone(p.next_due) === "overdue").length;
  const dueSoonPmsCount = pmList.filter((p) => dueTone(p.next_due) === "due").length;
  const nextUpcomingPm = pmList[0];

  const partRequestsList = assetPartRequests.data ?? [];
  const activePartRequestsList = partRequestsList.filter(
    (r) => r.status === "requested" || r.status === "bidding" || r.status === "ordered",
  );
  const activePartRequestsCount = activePartRequestsList.length;

  return {
    state: "ready" as const,
    assetId,
    navigate,
    queryClient,
    research,
    team,
    tab,
    setTab,
    scanManualDialogOpen,
    setScanManualDialogOpen,
    selectedManualForScan,
    setSelectedManualForScan,
    asset,
    allAssetsQuery,
    allAssets,
    currentIndex,
    prevAsset,
    nextAsset,
    currentAssetData,
    resolvedBuilding,
    resolvedSystem,
    systemSiblings,
    pms,
    wos,
    manuals,
    deleteManualMutation,
    info,
    linkedPartsQuery,
    completePm,
    assignPm,
    lookup,
    updatePartsFn,
    deletePartMutation,
    moveBuilding,
    updateAssetStatusMutation,
    addPms,
    assetPartRequests,
    markRequestReceived,
    addPartToInventory,
    a,
    defaultIntelligence,
    intervals,
    parts,
    dbPartMatch,
    mfgPortalInfo,
    googleManualUrl,
    openGoogleManualSearch,
    consumables,
    specs,
    pmList,
    overduePmsCount,
    dueSoonPmsCount,
    nextUpcomingPm,
    partRequestsList,
    activePartRequestsList,
    activePartRequestsCount,
  };
}

export type AssetCtx = Extract<ReturnType<typeof useAssetDetail>, { state: "ready" }>;

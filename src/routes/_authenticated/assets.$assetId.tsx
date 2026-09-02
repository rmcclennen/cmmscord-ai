import type { Json } from "@/integrations/supabase/types";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { researchAssetMaintenance, updateAssetMaintenanceParts } from "@/lib/maintenance.functions";
import { generateComprehensiveMaintenanceData } from "@/lib/maintenance-intelligence";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WorkOrderDialog } from "@/components/work-order-dialog";
import { DeleteRequestDialog } from "@/components/delete-request-dialog";
import { EditAssetPartsDialog } from "@/components/edit-asset-parts-dialog";
import { RelabelAssetDialog } from "@/components/relabel-asset-dialog";
import { CreatePmScheduleDialog } from "@/components/create-pm-schedule-dialog";
import { EditPmScheduleDialog } from "@/components/edit-pm-schedule-dialog";
import { MatchPmAssetDialog } from "@/components/match-pm-asset-dialog";
import { useTeamMembers } from "@/hooks/use-team-members";
import { memberLabel, notifyUser } from "@/lib/notify";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ALL_BUILDING_OPTIONS,
  buildingOf,
  clampToSeason,
  classLabel,
  dueTone,
  frequencyToDays,
  getManufacturerConsumables,
  manualList,
  prettyLabel,
  seasonLabel,
  systemOf,
  systemMeta,
} from "@/lib/cmms";
import { SystemBadge } from "@/components/system-badge";
import { ManualDialog } from "@/components/manual-dialog";
import { AssetPhotosPanel } from "@/components/asset-photos-panel";
import { SendPartsDialog } from "@/components/send-parts-dialog";
import { PartsLookupDialog } from "@/components/parts-lookup-dialog";
import { PartOrderUpdateDialog } from "@/components/part-order-update-dialog";
import { upsertPartAndLink } from "@/lib/inventory";
import {
  REQUEST_STATUSES,
  STATUS_LABEL,
  type PartRequestRow,
  type RequestStatus,
} from "@/lib/part-requests";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Boxes,
  Calendar,
  CalendarPlus,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Disc,
  DollarSign,
  Droplet,
  ExternalLink,
  FileText,
  Filter,
  Globe,
  Layers,
  PackageCheck,
  PackagePlus,
  PackageSearch,
  Pencil,
  Plus,
  Search,
  Send,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Tag,
  Trash2,
  Truck,
  Upload,
  User,
  Wrench,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/assets/$assetId")({
  head: () => ({
    meta: [
      { title: "Asset Detail | AssetCareConnect" },
      {
        name: "description",
        content: "Nameplate specs, manufacturer maintenance data, PMs, and work order history.",
      },
      { property: "og:title", content: "Asset Detail" },
      {
        property: "og:description",
        content: "Specifications, maintenance program, and work order history.",
      },
    ],
  }),
  component: AssetDetail,
});

type Interval = { task: string; frequency: string; notes?: string };
type Part = { name: string; part_number?: string; notes?: string };
type Source = { title: string; url: string };

const PART_STATUS_BADGE: Record<string, { label: string; className: string }> = {
  requested: {
    label: "Requested / In Review",
    className: "bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-300",
  },
  bidding: {
    label: "Out for Vendor Bids",
    className: "bg-purple-500/10 text-purple-700 border-purple-500/30 dark:text-purple-300",
  },
  ordered: {
    label: "PO Issued / Ordered",
    className: "bg-blue-500/10 text-blue-700 border-blue-500/30 dark:text-blue-300",
  },
  received: {
    label: "Received / In Stock",
    className: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-300",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-muted text-muted-foreground border-border",
  },
};

function getVendorLinks(
  partName: string,
  partNumber?: string | null,
  manufacturer?: string | null,
  assetName?: string | null,
) {
  const query = [manufacturer, partNumber, partName, assetName].filter(Boolean).join(" ");
  const encodedQuery = encodeURIComponent(query);
  const partNumberOrQuery = encodeURIComponent(partNumber || query);

  return {
    google: `https://www.google.com/search?q=${encodeURIComponent(`buy ${query}`)}`,
    grainger: `https://www.grainger.com/search?searchQuery=${partNumberOrQuery}`,
    mcmaster: `https://www.mcmaster.com/${encodeURIComponent(partNumber || partName)}`,
    motion: `https://www.motion.com/search?q=${partNumberOrQuery}`,
    fastenal: `https://www.fastenal.com/product/all?searchKeyword=${partNumberOrQuery}`,
    amazon: `https://www.amazon.com/s?k=${encodedQuery}`,
  };
}

function AssetDetail() {
  const { assetId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const research = useServerFn(researchAssetMaintenance);
  const team = useTeamMembers();
  const [tab, setTab] = useState("specs");

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

  const attachManualMutation = useMutation({
    mutationFn: async ({
      title,
      url,
      manufacturer,
      notes,
    }: {
      title: string;
      url: string;
      manufacturer?: string;
      notes?: string;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("manuals").insert({
        title: title.trim(),
        file_url: url.trim(),
        kind: "link",
        asset_id: assetId,
        manufacturer: (manufacturer || asset.data?.manufacturer || "").trim() || null,
        notes: notes || `Attached from manufacturer research for ${asset.data?.name || "asset"}.`,
        added_by: userData.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      toast.success(
        `Attached "${variables.title}" to ${asset.data?.name || "asset"} under Manuals tab!`,
      );
      queryClient.invalidateQueries({ queryKey: ["asset-manuals", assetId] });
      queryClient.invalidateQueries({ queryKey: ["manuals"] });
      queryClient.invalidateQueries({ queryKey: ["manuals-all"] });
    },
    onError: (err: Error) => toast.error(`Failed to attach manual: ${err.message}`),
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

  const isManualAttached = (title: string, url: string) => {
    return (manuals.data ?? []).some(
      (m) =>
        m.file_url?.toLowerCase().trim() === url.toLowerCase().trim() ||
        m.title?.toLowerCase().trim() === title.toLowerCase().trim(),
    );
  };

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
        .select(`
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
        `)
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

  if (asset.isLoading) return <p className="text-sm text-muted-foreground">Loading asset…</p>;
  if (!asset.data) return <p className="text-sm text-muted-foreground">Asset not found.</p>;

  const a = asset.data;
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
      })) as Part[];
    }

    return defaultIntelligence?.parts ?? [];
  }, [info.data?.parts, linkedPartsQuery.data, defaultIntelligence]);

  const sources: Source[] = useMemo(() => {
    const raw = info.data?.sources as Source[] | null;
    if (Array.isArray(raw) && raw.length > 0) return raw;
    return defaultIntelligence?.sources ?? [];
  }, [info.data?.sources, defaultIntelligence]);

  const pmList = pms.data ?? [];
  const overduePmsCount = pmList.filter((p) => dueTone(p.next_due) === "overdue").length;
  const dueSoonPmsCount = pmList.filter((p) => dueTone(p.next_due) === "due").length;
  const nextUpcomingPm = pmList[0];

  const partRequestsList = assetPartRequests.data ?? [];
  const activePartRequestsList = partRequestsList.filter(
    (r) => r.status === "requested" || r.status === "bidding" || r.status === "ordered",
  );
  const activePartRequestsCount = activePartRequestsList.length;

  const dbPartMatch = useMemo(() => {
    const map = new Map<string, { qty_on_hand?: number | null; unit_cost?: number | null; min_qty?: number | null; unit?: string | null }>();
    for (const dp of linkedPartsQuery.data ?? []) {
      if (!dp) continue;
      if (dp.part_number) map.set(dp.part_number.toLowerCase().trim(), dp);
      map.set(dp.name.toLowerCase().trim(), dp);
    }
    return map;
  }, [linkedPartsQuery.data]);

  return (
    <div className="space-y-5">
      {/* Top Asset Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
        <div className="flex items-center gap-2.5">
          <Link
            to="/assets"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors hover:underline"
          >
            <ArrowLeft className="size-4" /> All assets
          </Link>
          {allAssets.length > 0 && currentIndex >= 0 && (
            <Badge
              variant="outline"
              className="text-xs font-mono font-normal text-muted-foreground bg-muted/40"
            >
              #{currentIndex + 1} of {allAssets.length}
            </Badge>
          )}
        </div>

        {/* Quick Asset Switcher & Prev / Next Controls */}
        <div className="flex items-center gap-1.5">
          {prevAsset ? (
            <Link
              to="/assets/$assetId"
              params={{ assetId: prevAsset.id }}
              className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md border border-input bg-background hover:bg-muted text-xs font-medium text-foreground transition-colors shadow-xs"
              title={`Previous: ${prevAsset.name} ${prevAsset.tag_number ? `[${prevAsset.tag_number}]` : ""} (Alt + ←)`}
            >
              <ChevronLeft className="size-3.5" />
              <span className="hidden sm:inline">Prev</span>
            </Link>
          ) : (
            <Button
              disabled
              variant="outline"
              size="sm"
              className="h-8 px-2.5 text-xs text-muted-foreground gap-1 opacity-40 cursor-not-allowed"
            >
              <ChevronLeft className="size-3.5" />
              <span className="hidden sm:inline">Prev</span>
            </Button>
          )}

          {allAssets.length > 0 && (
            <Select
              value={assetId}
              onValueChange={(selectedId) => {
                if (selectedId && selectedId !== assetId) {
                  navigate({ to: "/assets/$assetId", params: { assetId: selectedId } });
                }
              }}
            >
              <SelectTrigger className="h-8 w-44 sm:w-60 text-xs bg-background font-medium">
                <SelectValue placeholder={`Asset ${currentIndex + 1} of ${allAssets.length}`} />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {allAssets.map((item, idx) => (
                  <SelectItem key={item.id} value={item.id} className="text-xs">
                    <span className="font-mono text-muted-foreground mr-1.5">{idx + 1}.</span>
                    <span className="font-medium">{item.name}</span>{" "}
                    {item.tag_number && (
                      <span className="text-muted-foreground font-mono">[{item.tag_number}]</span>
                    )}
                    {item.resolvedBuilding && (
                      <span className="text-[11px] text-muted-foreground ml-1">
                        · {item.resolvedBuilding}
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {nextAsset ? (
            <Link
              to="/assets/$assetId"
              params={{ assetId: nextAsset.id }}
              className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md border border-primary/40 bg-primary/10 hover:bg-primary/20 text-xs font-semibold text-primary transition-colors shadow-xs"
              title={`Next: ${nextAsset.name} ${nextAsset.tag_number ? `[${nextAsset.tag_number}]` : ""} (Alt + →)`}
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRight className="size-3.5" />
            </Link>
          ) : (
            <Button
              disabled
              variant="outline"
              size="sm"
              className="h-8 px-2.5 text-xs text-muted-foreground gap-1 opacity-40 cursor-not-allowed"
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRight className="size-3.5" />
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="label-caps">{classLabel(a.class)}</p>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold">{a.name}</h1>
            <RelabelAssetDialog
              assetId={a.id}
              initialAsset={a}
              trigger={
                <Button
                  size="sm"
                  variant="ghost"
                  className="size-7 p-0 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                  title="Relabel asset and update entire program"
                >
                  <Pencil className="size-3.5" />
                </Button>
              }
            />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <SystemBadge system={resolvedSystem} size="md" />
            <Badge variant="outline">{prettyLabel(a.status)}</Badge>
            <Badge variant={a.criticality === "high" ? "destructive" : "secondary"}>
              {prettyLabel(a.criticality)} criticality
            </Badge>
            {a.tag_number && (
              <span className="font-mono text-xs text-muted-foreground">Tag: {a.tag_number}</span>
            )}
            {pmList.length > 0 && (
              <Badge
                variant={overduePmsCount > 0 ? "destructive" : "outline"}
                className="font-mono text-xs cursor-pointer gap-1"
                onClick={() => setTab("pms")}
                title="View PM schedules for this asset"
              >
                <Clock className="size-3" />
                {pmList.length} PM{pmList.length > 1 ? "s" : ""}
                {overduePmsCount > 0
                  ? ` · ${overduePmsCount} Overdue`
                  : ` · Next ${nextUpcomingPm?.next_due}`}
              </Badge>
            )}
            {partRequestsList.length > 0 && (
              <Badge
                variant="outline"
                className={`font-mono text-xs cursor-pointer gap-1 ${
                  activePartRequestsCount > 0
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 font-semibold"
                    : "text-muted-foreground"
                }`}
                onClick={() => setTab("parts")}
                title="View parts requisitions and orders for this asset"
              >
                <ShoppingCart className="size-3 text-amber-600 dark:text-amber-400" />
                {partRequestsList.length} Part Order{partRequestsList.length > 1 ? "s" : ""}
                {activePartRequestsCount > 0
                  ? ` · ${activePartRequestsCount} Active`
                  : ` · All Received`}
              </Badge>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="label-caps">Building / area</span>
            <Select
              value={a.building ?? "auto"}
              onValueChange={(v) => moveBuilding.mutate(v)}
              disabled={moveBuilding.isPending}
            >
              <SelectTrigger className="h-8 w-56 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">
                  Auto — {buildingOf(a.name, null, a.location_name)}
                </SelectItem>
                {ALL_BUILDING_OPTIONS.map((b) => (
                  <SelectItem key={b} value={b}>
                    {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <PartsLookupDialog
            asset={{
              id: a.id,
              name: a.name,
              manufacturer: a.manufacturer,
              model: a.model,
              tag_number: a.tag_number,
              manufacturer_url: a.manufacturer_url,
            }}
            trigger={
              <Button
                variant="outline"
                className="gap-1.5 font-semibold text-primary border-primary/40 hover:bg-primary/10"
              >
                <Sparkles className="size-3.5 text-primary" /> AI Google Parts Lookup
              </Button>
            }
          />
          <SendPartsDialog
            asset={{ id: a.id, name: a.name, manufacturer: a.manufacturer }}
            lockAsset
            trigger={
              <Button
                variant="outline"
                className="gap-1.5 font-semibold text-foreground border-border hover:bg-muted"
              >
                <PackagePlus className="size-3.5 text-primary" /> Order / Requisition Parts
              </Button>
            }
          />
          <CreatePmScheduleDialog
            assetId={a.id}
            assetName={a.name}
            lockAsset
            trigger={
              <Button
                variant="outline"
                className="gap-1.5 font-semibold text-foreground border-border hover:bg-muted"
              >
                <CalendarPlus className="size-3.5 text-primary" /> Schedule PM
              </Button>
            }
          />
          <RelabelAssetDialog
            assetId={a.id}
            initialAsset={a}
            trigger={
              <Button
                variant="outline"
                className="gap-1.5 font-semibold text-foreground border-border hover:bg-muted"
              >
                <Tag className="size-3.5 text-primary" /> Relabel asset
              </Button>
            }
          />
          <WorkOrderDialog
            assetId={a.id}
            lockAsset
            defaultTitle=""
            trigger={
              <Button>
                <Plus className="size-4" /> Work order
              </Button>
            }
          />
          <DeleteRequestDialog
            entityType="asset"
            entityId={a.id}
            entityLabel={a.name}
            trigger={
              <Button variant="outline">
                <Trash2 className="size-4" /> Delete
              </Button>
            }
          />
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="specs">Specifications</TabsTrigger>
          <TabsTrigger value="system">System Equipment ({systemSiblings.length})</TabsTrigger>
          <TabsTrigger value="pms">
            PMs ({pmList.length})
            {overduePmsCount > 0 && <span className="ml-1.5 size-2 rounded-full bg-destructive" />}
          </TabsTrigger>
          <TabsTrigger value="parts">
            Parts &amp; Orders ({parts.length + partRequestsList.length})
            {activePartRequestsCount > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-amber-500 px-1.5 py-0.2 text-[10px] font-bold text-white leading-none">
                {activePartRequestsCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="maintenance">Manufacturer data</TabsTrigger>
          <TabsTrigger value="photos">Photos</TabsTrigger>
          <TabsTrigger value="manuals">Manuals ({manuals.data?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="history">Work orders ({wos.data?.length ?? 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="photos" className="mt-4">
          <AssetPhotosPanel assetId={a.id} />
        </TabsContent>

        <TabsContent value="manuals" className="mt-4 space-y-4">
          <div className="panel p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-3">
              <div>
                <p className="label-caps text-foreground flex items-center gap-1.5">
                  <FileText className="size-4 text-primary" /> Attached O&amp;M Manuals (
                  {manuals.data?.length ?? 0})
                </p>
                <p className="text-xs text-muted-foreground">
                  Official manufacturer O&amp;M manuals, cut sheets, and technical drawings attached
                  to {a.name}.
                </p>
              </div>
              <ManualDialog
                assetId={a.id}
                lockAsset
                trigger={
                  <Button variant="outline" size="sm" className="gap-1.5 font-medium">
                    <Plus className="size-4 text-primary" /> Add manual or link
                  </Button>
                }
              />
            </div>

            <ul className="mt-3 divide-y divide-border/60 text-sm">
              {(manuals.data ?? []).map((m) => (
                <li key={m.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <a
                        href={m.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-primary hover:underline inline-flex items-center gap-1.5 text-sm"
                      >
                        <FileText className="size-4 text-blue-500 shrink-0" />
                        {m.title}
                        <ExternalLink className="size-3 text-muted-foreground" />
                      </a>
                      {m.kind && (
                        <Badge
                          variant="outline"
                          className="text-[10px] uppercase font-mono px-1.5 py-0"
                        >
                          {m.kind}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {m.manufacturer && (
                        <span className="font-medium text-foreground">{m.manufacturer} · </span>
                      )}
                      {m.notes || "Attached document"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" asChild>
                      <a href={m.file_url} target="_blank" rel="noreferrer">
                        <ExternalLink className="size-3.5" /> View
                      </a>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 p-2 text-destructive hover:bg-destructive/10"
                      disabled={deleteManualMutation.isPending}
                      onClick={() => {
                        if (confirm(`Remove "${m.title}" from this asset?`)) {
                          deleteManualMutation.mutate(m.id);
                        }
                      }}
                      title="Remove manual from asset"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </li>
              ))}
              {(manuals.data ?? []).length === 0 && (
                <li className="py-6 text-center text-xs text-muted-foreground">
                  <FileText className="size-8 mx-auto text-muted-foreground/40 mb-2" />
                  No manuals attached yet. You can upload a file, add a web link, or attach
                  discovered manufacturer manuals below.
                </li>
              )}
            </ul>

            {manualList(a.manuals).length > 0 && (
              <div className="mt-4 border-t border-border pt-3">
                <p className="label-caps">Nameplate Document References</p>
                <ul className="mt-1 space-y-1 text-xs text-muted-foreground font-mono">
                  {manualList(a.manuals).map((m) => (
                    <li key={m} className="flex items-center gap-1.5">
                      <span className="size-1.5 rounded-full bg-primary/60" /> {m}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* AI Search & Research Manuals Section inside Manuals Tab */}
          <div className="panel p-4 bg-muted/20 border-primary/30">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div>
                <p className="label-caps text-primary flex items-center gap-1.5">
                  <Sparkles className="size-4" /> Discovered Manufacturer O&amp;M Manuals
                </p>
                <p className="text-xs text-muted-foreground">
                  Look up official OEM manuals, parts breakdowns, and cut sheets for {a.name} (
                  {a.manufacturer || "Manufacturer"} {a.model ? `Model ${a.model}` : ""}) and attach
                  them with 1 click.
                </p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                className="gap-1.5 text-xs font-semibold"
                disabled={lookup.isPending}
                onClick={() => lookup.mutate()}
              >
                <Sparkles className="size-3.5 text-primary" />
                {lookup.isPending ? "Searching OEM Data…" : "Research & Discover Manuals"}
              </Button>
            </div>

            {sources.length > 0 ? (
              <div className="space-y-2 mt-3">
                {sources.map((s, idx) => {
                  const attached = isManualAttached(s.title, s.url);
                  return (
                    <div
                      key={idx}
                      className="p-3 rounded-md bg-background border border-border/80 flex flex-wrap items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noreferrer"
                          className="font-semibold text-primary hover:underline inline-flex items-center gap-1.5 text-sm"
                        >
                          <BookOpen className="size-4 text-blue-500 shrink-0" />
                          {s.title}
                          <ExternalLink className="size-3 text-muted-foreground" />
                        </a>
                        <p className="text-[11px] text-muted-foreground mt-0.5 truncate font-mono">
                          {s.url}
                        </p>
                      </div>
                      <div>
                        {attached ? (
                          <Badge
                            variant="secondary"
                            className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 font-semibold py-1 px-2.5"
                          >
                            <CheckCircle2 className="size-3.5 mr-1 text-emerald-600 dark:text-emerald-400" />
                            Attached
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            variant="default"
                            className="h-8 gap-1.5 text-xs font-semibold"
                            disabled={attachManualMutation.isPending}
                            onClick={() =>
                              attachManualMutation.mutate({
                                title: s.title,
                                url: s.url,
                                manufacturer: a.manufacturer || "",
                                notes: `Attached directly from manufacturer research for ${a.name}.`,
                              })
                            }
                          >
                            <Upload className="size-3.5" />
                            Upload / Attach to Asset
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 rounded-md border border-dashed border-border text-center text-xs text-muted-foreground space-y-2">
                <p>No manufacturer research entries cached yet for this asset.</p>
                <p>
                  Click{" "}
                  <strong className="text-foreground">"Research &amp; Discover Manuals"</strong>{" "}
                  above to find official O&amp;M manuals for {a.manufacturer || "this manufacturer"}
                  .
                </p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="specs" className="mt-4 space-y-4">
          {/* Active PM Program Overview Banner */}
          <div className="panel p-4 border-l-4 border-l-primary flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Calendar className="size-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">
                  Preventive Maintenance (PM) Program
                </h3>
                <p className="text-xs text-muted-foreground">
                  {pmList.length === 0 ? (
                    "No routine PM schedules attached to this asset."
                  ) : (
                    <>
                      <span className="font-semibold text-foreground">
                        {pmList.length} PM Schedule{pmList.length > 1 ? "s" : ""}
                      </span>
                      {" · "}
                      {overduePmsCount > 0 ? (
                        <span className="text-destructive font-semibold">
                          {overduePmsCount} Overdue
                        </span>
                      ) : (
                        <span>
                          Next due: {nextUpcomingPm?.next_due} ({nextUpcomingPm?.title})
                        </span>
                      )}
                    </>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <CreatePmScheduleDialog
                assetId={a.id}
                assetName={a.name}
                lockAsset
                trigger={
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-xs font-semibold text-primary border-primary/40"
                  >
                    <CalendarPlus className="size-3.5" /> Add PM
                  </Button>
                }
              />
              <Button size="sm" variant="ghost" className="text-xs" onClick={() => setTab("pms")}>
                View all PMs ({pmList.length}) →
              </Button>
            </div>
          </div>

          <div className="panel p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-border">
              <div>
                <p className="label-caps">Equipment Specifications</p>
                <p className="text-xs text-muted-foreground">
                  Master nameplate, electrical ratings, and operational parameters for {a.name}.
                </p>
              </div>
              <RelabelAssetDialog
                assetId={a.id}
                initialAsset={a}
                defaultTab="specs"
                trigger={
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1 text-xs font-semibold text-primary border-primary/40 hover:bg-primary/10"
                  >
                    <Pencil className="size-3" /> Relabel / Edit Specs
                  </Button>
                }
              />
            </div>
            <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
              {specs.map(([label, value]) => (
                <div key={label}>
                  <dt className="label-caps">{label}</dt>
                  <dd className="font-mono text-sm">{value || "—"}</dd>
                </div>
              ))}
            </dl>

            {(manuals.data ?? []).length > 0 && (
              <div className="mt-5 border-t border-border pt-4">
                <p className="label-caps">Manuals</p>
                <ul className="mt-2 space-y-1 text-sm">
                  {(manuals.data ?? []).map((m) => (
                    <li key={m.id}>
                      <a
                        href={m.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline"
                      >
                        {m.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {a.notes && (
              <div className="mt-5 border-t border-border pt-4">
                <p className="label-caps">Notes</p>
                <p className="mt-1 text-sm text-muted-foreground">{a.notes}</p>
              </div>
            )}
          </div>

          {/* OEM Consumables, Lubrication & Belt Sizing Specs */}
          <div className="panel p-5 border-l-4 border-l-primary space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Droplet className="size-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    Manufacturer Lube, Grease, Belt &amp; Seal Specifications
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    OEM-recommended fluids, belt sizing, mechanical seals, and filter elements for{" "}
                    {a.name}.
                  </p>
                </div>
              </div>
              <SendPartsDialog
                asset={{ id: a.id, name: a.name, manufacturer: a.manufacturer }}
                lockAsset
                initialPart={{
                  name: `Oil & Grease Consumables Pack for ${a.name}`,
                  part_number: consumables.oilGrade.split(" ")[0] || "LUBE-SPEC",
                  manufacturer: a.manufacturer,
                  qty: 1,
                }}
                trigger={
                  <Button size="sm" variant="outline" className="gap-1.5 font-semibold text-xs">
                    <Send className="size-3.5 text-primary" /> Requisition Lube / Belts
                  </Button>
                }
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 pt-2">
              <div className="rounded-lg border border-border bg-card/60 p-3.5 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400">
                  <Droplet className="size-4" /> Suggested Oil &amp; Viscosity
                </div>
                <p className="text-sm font-semibold text-foreground">{consumables.oilGrade}</p>
                {consumables.oilCapacity && (
                  <p className="text-xs text-muted-foreground">
                    Sump Capacity:{" "}
                    <span className="font-mono font-medium text-foreground">
                      {consumables.oilCapacity}
                    </span>
                  </p>
                )}
              </div>

              <div className="rounded-lg border border-border bg-card/60 p-3.5 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-sky-600 dark:text-sky-400">
                  <Disc className="size-4" /> Recommended Grease Type
                </div>
                <p className="text-sm font-semibold text-foreground">{consumables.greaseType}</p>
                <p className="text-xs text-muted-foreground">
                  Grease Bearing Schedule:{" "}
                  <span className="font-medium text-foreground">Clean relief plug first</span>
                </p>
              </div>

              <div className="rounded-lg border border-border bg-card/60 p-3.5 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400">
                  <Layers className="size-4" /> Drive Belt / Coupling Sizing
                </div>
                <p className="text-sm font-semibold text-foreground">{consumables.beltSize}</p>
                <p className="text-xs text-muted-foreground">
                  Always replace drive belts in matched sets.
                </p>
              </div>

              <div className="rounded-lg border border-border bg-card/60 p-3.5 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck className="size-4" /> Mechanical Seal / Packing
                </div>
                <p className="text-sm font-semibold text-foreground">{consumables.sealType}</p>
                <p className="text-xs text-muted-foreground">
                  Check barrier fluid flush lines and seal drops/min.
                </p>
              </div>

              {consumables.filterSpec && (
                <div className="rounded-lg border border-border bg-card/60 p-3.5 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-violet-600 dark:text-violet-400">
                    <Filter className="size-4" /> Filter / Strainer Spec
                  </div>
                  <p className="text-sm font-semibold text-foreground">{consumables.filterSpec}</p>
                  <p className="text-xs text-muted-foreground">
                    Replace cartridge elements during routine PM interval.
                  </p>
                </div>
              )}

              <div className="rounded-lg border border-border bg-card/60 p-3.5 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-rose-600 dark:text-rose-400">
                  <Clock className="size-4" /> Lubrication Interval
                </div>
                <p className="text-xs font-medium text-foreground">{consumables.lubeInterval}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground border border-border/70">
              <div className="flex items-start gap-2.5 min-w-0 flex-1">
                <Wrench className="size-4 text-primary shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-foreground">
                    Operator &amp; Mechanic Inspection Note:{" "}
                  </span>
                  {consumables.inspectionNotes}
                </div>
              </div>
              <EditAssetPartsDialog
                assetId={a.id}
                assetName={a.name}
                manufacturer={a.manufacturer}
                model={a.model}
                currentParts={parts}
                defaultTab="feedback"
                trigger={
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 gap-1 text-xs text-amber-600 hover:bg-amber-500/10 dark:text-amber-400 shrink-0"
                  >
                    <AlertTriangle className="size-3.5" />
                    Not the right parts/specs?
                  </Button>
                }
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="system" className="mt-4 space-y-4">
          <div className="panel p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <SystemBadge system={resolvedSystem} size="lg" />
                  <Badge variant="outline" className="text-xs">
                    {systemSiblings.length} Equipment Unit{systemSiblings.length === 1 ? "" : "s"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground pt-1">
                  All interconnected machinery, feed lines, drives, and components operating
                  together within the{" "}
                  <span className="font-semibold text-foreground">{resolvedSystem}</span>.
                </p>
              </div>
              <Button asChild variant="outline" size="sm" className="gap-1.5 font-semibold text-xs">
                <Link to="/assets" search={{ system: resolvedSystem }}>
                  <Layers className="size-3.5 text-primary" /> View All in Asset Register
                </Link>
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              {systemSiblings.map((sibling) => {
                const isCurrent = sibling.id === a.id;
                return (
                  <div
                    key={sibling.id}
                    className={`rounded-lg border p-3.5 transition-all flex flex-col justify-between gap-3 ${
                      isCurrent
                        ? "border-primary/60 bg-primary/5 shadow-xs ring-1 ring-primary/30"
                        : "border-border bg-card/60 hover:bg-muted/40 hover:border-primary/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {isCurrent ? (
                            <span className="font-bold text-sm text-foreground">
                              {sibling.name}
                            </span>
                          ) : (
                            <Link
                              to="/assets/$assetId"
                              params={{ assetId: sibling.id }}
                              className="font-bold text-sm text-foreground hover:text-primary hover:underline transition-colors"
                            >
                              {sibling.name}
                            </Link>
                          )}
                          {isCurrent && (
                            <Badge className="bg-primary text-primary-foreground text-[10px] h-4 px-1.5 font-semibold">
                              Current Asset
                            </Badge>
                          )}
                        </div>
                        {sibling.tag_number && (
                          <p className="font-mono text-xs text-muted-foreground mt-0.5">
                            Tag: {sibling.tag_number}
                          </p>
                        )}
                      </div>
                      <Badge variant="outline" className="text-[11px] shrink-0">
                        {classLabel(sibling.class)}
                      </Badge>
                    </div>

                    <div className="text-xs text-muted-foreground space-y-1 border-t border-border/50 pt-2 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span>Make/Model: </span>
                        <span className="font-medium text-foreground">
                          {[sibling.make, sibling.model].filter(Boolean).join(" · ") || "—"}
                        </span>
                      </div>
                      {!isCurrent && (
                        <Link
                          to="/assets/$assetId"
                          params={{ assetId: sibling.id }}
                          className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1 ml-auto"
                        >
                          View asset <ChevronRight className="size-3" />
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="pms" className="mt-4 space-y-5">
          {/* PM Management Header & Metrics */}
          <div className="panel p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="label-caps">Preventive Maintenance Schedules</p>
                <p className="text-xs text-muted-foreground">
                  Recurring inspection, lubrication, and overhaul routines for {a.name}.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <MatchPmAssetDialog
                  targetAsset={a}
                  trigger={
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 font-semibold text-xs border-primary/40 text-primary hover:bg-primary/10"
                    >
                      <Sparkles className="size-3.5" /> Match &amp; Link PM
                    </Button>
                  }
                />
                <CreatePmScheduleDialog
                  assetId={a.id}
                  assetName={a.name}
                  lockAsset
                  trigger={
                    <Button size="sm" className="gap-1.5 font-semibold">
                      <CalendarPlus className="size-4" /> Schedule New PM
                    </Button>
                  }
                />
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-border">
              <div className="rounded-lg bg-card border border-border p-3">
                <p className="text-xs text-muted-foreground font-medium">Total PMs</p>
                <p className="text-xl font-bold font-mono text-foreground mt-0.5">
                  {pmList.length}
                </p>
              </div>
              <div className="rounded-lg bg-card border border-border p-3">
                <p className="text-xs text-muted-foreground font-medium">Overdue</p>
                <p
                  className={`text-xl font-bold font-mono mt-0.5 ${overduePmsCount > 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"}`}
                >
                  {overduePmsCount}
                </p>
              </div>
              <div className="rounded-lg bg-card border border-border p-3">
                <p className="text-xs text-muted-foreground font-medium">Due in ≤7 Days</p>
                <p className="text-xl font-bold font-mono text-foreground mt-0.5">
                  {dueSoonPmsCount}
                </p>
              </div>
              <div className="rounded-lg bg-card border border-border p-3">
                <p className="text-xs text-muted-foreground font-medium">Next Due Date</p>
                <p className="text-sm font-semibold font-mono text-primary mt-1 truncate">
                  {nextUpcomingPm?.next_due || "—"}
                </p>
              </div>
            </div>
          </div>

          {/* Active PM Schedules List */}
          <div className="panel divide-y divide-border">
            {pmList.map((pm) => {
              const tone = dueTone(pm.next_due);
              return (
                <div key={pm.id} className="p-4 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-base font-bold text-foreground">{pm.title}</h4>
                        <Badge
                          variant={
                            pm.priority === "critical" || pm.priority === "high"
                              ? "destructive"
                              : "secondary"
                          }
                        >
                          {prettyLabel(pm.priority)} priority
                        </Badge>
                        {seasonLabel(pm.season_start_md, pm.season_end_md) && (
                          <Badge
                            variant="outline"
                            className="border-primary/40 text-primary text-xs"
                          >
                            Seasonal · {seasonLabel(pm.season_start_md, pm.season_end_md)}
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-1">
                        <span className="font-medium text-foreground">
                          Every {pm.interval_days} days
                        </span>
                        <span>·</span>
                        <span>
                          Next due:{" "}
                          <strong className="font-mono text-foreground">{pm.next_due}</strong>
                        </span>
                        {pm.estimated_hours != null && (
                          <>
                            <span>·</span>
                            <span>{pm.estimated_hours} hrs est.</span>
                          </>
                        )}
                        {pm.last_completed && (
                          <>
                            <span>·</span>
                            <span>Last completed on {pm.last_completed}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Badge
                        variant={
                          tone === "overdue"
                            ? "destructive"
                            : tone === "due"
                              ? "secondary"
                              : "outline"
                        }
                        className="font-mono text-xs px-2.5 py-1"
                      >
                        {tone === "overdue"
                          ? "OVERDUE · "
                          : tone === "due"
                            ? "DUE SOON · "
                            : "DUE · "}
                        {pm.next_due}
                      </Badge>
                    </div>
                  </div>

                  {pm.tasks && (
                    <div className="rounded-md bg-muted/40 border border-border/70 p-2.5 text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground block mb-0.5">
                        Instructions &amp; Checklist:
                      </span>
                      <p className="whitespace-pre-wrap">{pm.tasks}</p>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                        <User className="size-3.5" /> Assigned Tech:
                      </span>
                      <Select
                        value={pm.assigned_to ?? "unassigned"}
                        onValueChange={(v) =>
                          assignPm.mutate({
                            id: pm.id,
                            title: pm.title,
                            next_due: pm.next_due,
                            userId: v === "unassigned" ? null : v,
                          })
                        }
                        disabled={assignPm.isPending}
                      >
                        <SelectTrigger className="h-8 w-48 text-xs">
                          <SelectValue placeholder="Assign technician…" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">Unassigned (Open Pool)</SelectItem>
                          {(team.data ?? []).map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              {memberLabel(m)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <WorkOrderDialog
                        assetId={a.id}
                        pmScheduleId={pm.id}
                        defaultTitle={pm.title}
                        lockAsset
                        trigger={
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1.5 text-xs font-semibold"
                          >
                            <Plus className="size-3.5 text-primary" /> Issue WO
                          </Button>
                        }
                      />
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-8 gap-1.5 text-xs font-semibold"
                        disabled={completePm.isPending}
                        onClick={() =>
                          completePm.mutate({
                            id: pm.id,
                            interval_days: pm.interval_days,
                            season_start_md: pm.season_start_md,
                            season_end_md: pm.season_end_md,
                          })
                        }
                      >
                        <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                        Complete &amp; Advance
                      </Button>
                      <EditPmScheduleDialog
                        pm={pm}
                        trigger={
                          <Button size="sm" variant="ghost" className="h-8 px-2 text-xs">
                            <Pencil className="size-3.5 mr-1" /> Edit
                          </Button>
                        }
                      />
                      <DeleteRequestDialog
                        entityType="pm_schedule"
                        entityId={pm.id}
                        entityLabel={pm.title}
                      />
                    </div>
                  </div>
                </div>
              );
            })}

            {pmList.length === 0 && (
              <div className="p-8 text-center space-y-3">
                <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Calendar className="size-6" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-foreground">
                    No PM schedules for this asset
                  </h4>
                  <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1">
                    Set up recurring preventive maintenance routines to prevent unexpected plant
                    downtime and extend equipment life.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                  <MatchPmAssetDialog
                    targetAsset={a}
                    trigger={
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 font-semibold text-xs border-primary/40 text-primary hover:bg-primary/10"
                      >
                        <Sparkles className="size-3.5" /> Match Existing PM Routine
                      </Button>
                    }
                  />
                  <CreatePmScheduleDialog
                    assetId={a.id}
                    assetName={a.name}
                    lockAsset
                    trigger={
                      <Button size="sm" className="gap-1.5 font-semibold">
                        <CalendarPlus className="size-4" /> Schedule First PM
                      </Button>
                    }
                  />
                </div>
              </div>
            )}
          </div>

          {/* OEM Recommended Intervals section on the PM tab */}
          {intervals.length > 0 && (
            <div className="panel p-4 space-y-3 border-l-4 border-l-primary/60">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="label-caps">Recommended Manufacturer Intervals</p>
                  <p className="text-xs text-muted-foreground">
                    O&amp;M manual suggestions ready to be imported directly into active PM
                    schedules.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={addPms.isPending}
                  onClick={() => addPms.mutate(intervals)}
                  className="gap-1.5 font-semibold text-primary border-primary/40 hover:bg-primary/10"
                >
                  <CalendarPlus className="size-4" />
                  Add all to PM schedule
                </Button>
              </div>
              <ul className="mt-2 divide-y divide-border">
                {intervals.map((i, idx) => (
                  <li
                    key={idx}
                    className="py-2.5 flex flex-wrap items-center justify-between gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{i.task}</span>
                        <span className="font-mono text-xs text-primary bg-primary/10 px-2 py-0.5 rounded">
                          {i.frequency} (Every {frequencyToDays(i.frequency)} days)
                        </span>
                      </div>
                      {i.notes && <p className="mt-0.5 text-xs text-muted-foreground">{i.notes}</p>}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={addPms.isPending}
                      onClick={() => addPms.mutate([i])}
                      className="text-xs font-medium text-primary hover:bg-primary/10"
                    >
                      <CalendarPlus className="size-3.5 mr-1" />
                      Add to schedule
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </TabsContent>

        <TabsContent value="parts" className="mt-4 space-y-4">
          {/* Main Top Actions & Overview */}
          <div className="panel p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold flex items-center gap-2 text-foreground">
                    <ShoppingCart className="size-4 text-primary" /> Spare Parts Sourcing &amp;
                    Procurement Orders
                  </h2>
                  <Badge variant="outline" className="text-xs font-mono">
                    {partRequestsList.length} Requisition{partRequestsList.length === 1 ? "" : "s"}{" "}
                    · {parts.length} Catalog Parts
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Active parts requisitions, quote bidding, PO tracking, and 1-click vendor order
                  links for <span className="font-semibold text-foreground">{a.name}</span>.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <PartsLookupDialog
                  asset={{
                    id: a.id,
                    name: a.name,
                    manufacturer: a.manufacturer,
                    model: a.model,
                    tag_number: a.tag_number,
                    manufacturer_url: a.manufacturer_url,
                  }}
                  trigger={
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 font-semibold text-primary border-primary/40 hover:bg-primary/10"
                    >
                      <Sparkles className="size-3.5 text-primary" /> AI Google Parts Lookup
                    </Button>
                  }
                />
                <SendPartsDialog
                  asset={{ id: a.id, name: a.name, manufacturer: a.manufacturer }}
                  lockAsset
                  trigger={
                    <Button className="gap-1.5 font-bold shadow-sm" size="sm">
                      <PackagePlus className="size-4" /> Requisition / Order Parts
                    </Button>
                  }
                />
                <EditAssetPartsDialog
                  assetId={a.id}
                  assetName={a.name}
                  manufacturer={a.manufacturer}
                  model={a.model}
                  currentParts={parts}
                  trigger={
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs font-medium">
                      <Plus className="size-3.5 text-primary" /> Add Custom Part
                    </Button>
                  }
                />
                <Button variant="outline" size="sm" asChild className="gap-1.5 text-xs font-medium">
                  <Link to="/part-requests">
                    <ExternalLink className="size-3.5 text-muted-foreground" /> Procurement Hub
                  </Link>
                </Button>
              </div>
            </div>

            {/* Quick Metrics Bar if there are requests */}
            {partRequestsList.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                <div className="rounded-lg border border-border bg-muted/30 p-2.5">
                  <p className="text-[11px] font-medium text-muted-foreground">
                    Total Requisitions
                  </p>
                  <p className="text-lg font-bold text-foreground">{partRequestsList.length}</p>
                </div>
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5">
                  <p className="text-[11px] font-medium text-amber-800 dark:text-amber-300">
                    Pending / In Review
                  </p>
                  <p className="text-lg font-bold text-amber-900 dark:text-amber-200">
                    {
                      partRequestsList.filter(
                        (r) => r.status === "requested" || r.status === "bidding",
                      ).length
                    }
                  </p>
                </div>
                <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-2.5">
                  <p className="text-[11px] font-medium text-blue-800 dark:text-blue-300">
                    PO Issued / Ordered
                  </p>
                  <p className="text-lg font-bold text-blue-900 dark:text-blue-200">
                    {partRequestsList.filter((r) => r.status === "ordered").length}
                  </p>
                </div>
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2.5">
                  <p className="text-[11px] font-medium text-emerald-800 dark:text-emerald-300">
                    Received &amp; Stocked
                  </p>
                  <p className="text-lg font-bold text-emerald-900 dark:text-emerald-200">
                    {partRequestsList.filter((r) => r.status === "received").length}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Section: Requisitions and POs Table / List */}
          <div className="panel p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 pb-3">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2 text-foreground">
                  <Truck className="size-4 text-primary" /> Active &amp; Historical Parts Orders for
                  this Asset
                </h3>
                <p className="text-xs text-muted-foreground">
                  All parts sent to CMMS coordinators and supervisors to be ordered, bid out, or
                  stocked.
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                asChild
                className="text-xs text-primary font-medium"
              >
                <Link to="/part-requests">View All Plant Requisitions →</Link>
              </Button>
            </div>

            {assetPartRequests.isLoading ? (
              <p className="text-xs text-muted-foreground py-4">Loading requisitions...</p>
            ) : partRequestsList.length > 0 ? (
              <div className="space-y-3">
                {partRequestsList.map((req) => {
                  const statusInfo = PART_STATUS_BADGE[req.status] || {
                    label: req.status,
                    className: "bg-muted text-muted-foreground border-border",
                  };
                  return (
                    <div
                      key={req.id}
                      className="rounded-lg border border-border bg-card p-4 space-y-3 shadow-xs hover:border-primary/30 transition-colors"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-sm font-bold text-foreground">{req.title}</h4>
                            <Badge
                              variant="outline"
                              className={`text-[11px] font-semibold ${statusInfo.className}`}
                            >
                              {statusInfo.label}
                            </Badge>
                            {req.priority && req.priority !== "medium" && (
                              <Badge
                                variant={
                                  req.priority === "urgent" || req.priority === "high"
                                    ? "destructive"
                                    : "secondary"
                                }
                                className="text-[10px] uppercase font-bold"
                              >
                                {req.priority}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {[
                              req.route_to === "coordinator"
                                ? "Sent to CMMS Coordinator"
                                : req.route_to === "supervisor"
                                  ? "Sent to Supervisor"
                                  : req.route_to === "supervisors"
                                    ? "Sent to Supervisors & Coordinators"
                                    : "Sent to Teammate",
                              req.needed_by ? `Needed by: ${req.needed_by}` : null,
                              `Logged: ${new Date(req.created_at).toLocaleDateString()}`,
                              req.work_orders ? `WO-${req.work_orders.wo_number}` : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <PartOrderUpdateDialog request={req} />
                          {req.status !== "received" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 gap-1 text-xs font-semibold text-emerald-700 border-emerald-500/40 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
                              disabled={markRequestReceived.isPending}
                              onClick={() => markRequestReceived.mutate(req.id)}
                              title="Mark as received and verified on-site"
                            >
                              <CheckCircle2 className="size-3.5 text-emerald-600" />
                              Mark Received
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="rounded bg-muted/40 p-2.5 text-xs font-mono text-foreground whitespace-pre-wrap border border-border/50">
                        {req.part_lines}
                      </div>

                      {/* PO & Fulfillment details */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground pt-1 border-t border-border/50">
                        <span className="flex items-center gap-1 font-mono">
                          <span className="font-semibold text-foreground">PO#:</span>{" "}
                          {req.po_number ? (
                            <span className="font-bold text-primary">{req.po_number}</span>
                          ) : (
                            <span className="italic text-muted-foreground">Pending</span>
                          )}
                        </span>

                        {(req.awarded_vendor || req.vendor) && (
                          <span className="flex items-center gap-1">
                            <span className="font-semibold text-foreground">Vendor:</span>{" "}
                            {req.awarded_vendor || req.vendor}
                          </span>
                        )}

                        {(req.awarded_cost != null || req.quoted_cost != null) && (
                          <span className="flex items-center gap-1">
                            <span className="font-semibold text-foreground">Cost:</span> $
                            {req.awarded_cost ?? req.quoted_cost}
                          </span>
                        )}

                        {req.expected_date && (
                          <span className="flex items-center gap-1">
                            <span className="font-semibold text-foreground">ETA:</span>{" "}
                            {req.expected_date}
                          </span>
                        )}

                        {req.lead_time_days != null && (
                          <span className="flex items-center gap-1">
                            <span className="font-semibold text-foreground">Lead Time:</span>{" "}
                            {req.lead_time_days} days
                          </span>
                        )}

                        {req.received_at && (
                          <span className="flex items-center gap-1 text-emerald-600 font-medium">
                            <Check className="size-3.5" /> Received{" "}
                            {new Date(req.received_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground space-y-2">
                <ShoppingCart className="mx-auto size-6 text-muted-foreground/60" />
                <p className="font-medium text-foreground">
                  No active or historical parts orders logged for this asset yet.
                </p>
                <p>
                  Click "Requisition / Order Parts" above or select any part below to send a
                  requisition to the CMMS coordinator or maintenance supervisors.
                </p>
                <div className="pt-2">
                  <SendPartsDialog
                    asset={{ id: a.id, name: a.name, manufacturer: a.manufacturer }}
                    lockAsset
                    trigger={
                      <Button size="sm" className="gap-1.5 font-semibold">
                        <PackagePlus className="size-3.5" /> Requisition Parts for {a.name}
                      </Button>
                    }
                  />
                </div>
              </div>
            )}
          </div>

          {/* Section: Wear & Spare Parts Catalog with 1-Click Buy Links */}
          <div className="panel p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold flex items-center gap-2 text-foreground">
                    <Boxes className="size-4 text-primary" /> Asset Wear &amp; Spare Parts Catalog
                  </h3>
                  <Badge variant="secondary" className="text-xs">
                    {parts.length} Part{parts.length === 1 ? "" : "s"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  OEM part numbers, specifications, and instant 1-click vendor buying links
                  (McMaster, Grainger, Motion, Fastenal).
                </p>
              </div>

              <div className="flex items-center gap-2">
                <EditAssetPartsDialog
                  assetId={a.id}
                  assetName={a.name}
                  manufacturer={a.manufacturer}
                  model={a.model}
                  currentParts={parts}
                  trigger={
                    <Button variant="outline" size="sm" className="gap-1 text-xs font-medium">
                      <Plus className="size-3.5 text-primary" /> Edit / Add Parts
                    </Button>
                  }
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1 text-xs font-medium"
                  onClick={() => lookup.mutate()}
                  disabled={lookup.isPending}
                >
                  <Sparkles className="size-3.5 text-primary" />
                  {lookup.isPending ? "Researching..." : "Research OEM Parts"}
                </Button>
              </div>
            </div>

            {parts.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {parts.map((p, idx) => {
                  const links = getVendorLinks(p.name, p.part_number, a.manufacturer, a.name);
                  const matchedInv = p.part_number
                    ? dbPartMatch.get(p.part_number.toLowerCase().trim()) ||
                      dbPartMatch.get(p.name.toLowerCase().trim())
                    : dbPartMatch.get(p.name.toLowerCase().trim());
                  return (
                    <div
                      key={idx}
                      className="rounded-lg border border-border bg-card p-4 space-y-3 shadow-xs flex flex-col justify-between hover:border-primary/30 transition-colors"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-sm font-bold text-foreground leading-snug">
                            {p.name}
                          </h4>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-6 text-muted-foreground hover:text-destructive"
                            onClick={() => deletePartMutation.mutate(idx)}
                            disabled={deletePartMutation.isPending}
                            title="Remove from asset catalog"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {p.part_number ? (
                            <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 font-mono text-xs font-bold text-primary">
                              P/N: {p.part_number}
                              <button
                                type="button"
                                className="ml-1 text-primary/70 hover:text-primary"
                                onClick={() => {
                                  navigator.clipboard.writeText(p.part_number!);
                                  toast.success(`Copied P/N ${p.part_number} to clipboard`);
                                }}
                                title="Copy Part Number"
                              >
                                <Copy className="size-3" />
                              </button>
                            </span>
                          ) : (
                            <span className="text-xs italic text-muted-foreground">No OEM P/N</span>
                          )}

                          {a.manufacturer && (
                            <span className="text-xs text-muted-foreground font-medium">
                              OEM: {a.manufacturer}
                            </span>
                          )}

                          {matchedInv?.qty_on_hand != null && (
                            <Badge
                              variant="outline"
                              className={`text-[11px] font-semibold ${
                                matchedInv.qty_on_hand > (matchedInv.min_qty ?? 1)
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800"
                                  : "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800"
                              }`}
                            >
                              Stock: {matchedInv.qty_on_hand} {matchedInv.unit || "ea"}
                            </Badge>
                          )}

                          {matchedInv?.unit_cost != null && (
                            <Badge variant="outline" className="text-[11px] font-mono text-muted-foreground bg-muted/40">
                              ${matchedInv.unit_cost.toFixed(2)}
                            </Badge>
                          )}
                        </div>

                        {p.notes && (
                          <p className="text-xs text-muted-foreground line-clamp-2">{p.notes}</p>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-border/50">
                        {/* 1. Send / Requisition Button */}
                        <SendPartsDialog
                          asset={{ id: a.id, name: a.name, manufacturer: a.manufacturer }}
                          lockAsset
                          initialPart={{
                            name: p.name,
                            part_number: p.part_number,
                            manufacturer: a.manufacturer,
                            qty: 1,
                          }}
                          trigger={
                            <Button size="sm" className="h-8 gap-1 text-xs font-bold shadow-xs">
                              <Send className="size-3" /> Requisition / Order
                            </Button>
                          }
                        />

                        {/* 2. Direct Buy / Search Vendor Dropdown */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 gap-1 text-xs font-semibold"
                            >
                              <Globe className="size-3 text-primary" /> Buy Online{" "}
                              <ChevronDown className="size-3 opacity-60" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56 text-xs">
                            <DropdownMenuLabel className="text-[11px] text-muted-foreground">
                              1-Click Vendor Sourcing
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem asChild>
                              <a
                                href={links.google}
                                target="_blank"
                                rel="noreferrer"
                                className="cursor-pointer gap-2"
                              >
                                <Search className="size-3.5 text-primary" /> Google Industrial
                                Search
                              </a>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <a
                                href={links.grainger}
                                target="_blank"
                                rel="noreferrer"
                                className="cursor-pointer gap-2"
                              >
                                <ExternalLink className="size-3.5 text-orange-600" /> Grainger
                                Catalog
                              </a>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <a
                                href={links.mcmaster}
                                target="_blank"
                                rel="noreferrer"
                                className="cursor-pointer gap-2"
                              >
                                <ExternalLink className="size-3.5 text-emerald-600" /> McMaster-Carr
                                Supply
                              </a>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <a
                                href={links.motion}
                                target="_blank"
                                rel="noreferrer"
                                className="cursor-pointer gap-2"
                              >
                                <ExternalLink className="size-3.5 text-blue-600" /> Motion
                                Industries
                              </a>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <a
                                href={links.fastenal}
                                target="_blank"
                                rel="noreferrer"
                                className="cursor-pointer gap-2"
                              >
                                <ExternalLink className="size-3.5 text-blue-800" /> Fastenal
                                Industrial
                              </a>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <a
                                href={links.amazon}
                                target="_blank"
                                rel="noreferrer"
                                className="cursor-pointer gap-2"
                              >
                                <ExternalLink className="size-3.5 text-amber-600" /> Amazon Business
                              </a>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>

                        {/* 3. Add to Stockroom Inventory */}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => addPartToInventory.mutate(p)}
                          disabled={addPartToInventory.isPending}
                          title="Stock this part in plant MRO inventory"
                        >
                          <Boxes className="size-3.5 text-primary" /> Stock
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground space-y-2">
                <Boxes className="mx-auto size-6 text-muted-foreground/60" />
                <p className="font-medium text-foreground">
                  No spare parts cataloged for this asset yet.
                </p>
                <p>
                  Run manufacturer research or manually add OEM parts to enable 1-click ordering and
                  sourcing.
                </p>
                <div className="pt-2 flex items-center justify-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => lookup.mutate()}
                    disabled={lookup.isPending}
                    className="gap-1.5 font-semibold"
                  >
                    <Sparkles className="size-3.5" /> Research OEM Parts
                  </Button>
                  <EditAssetPartsDialog
                    assetId={a.id}
                    assetName={a.name}
                    manufacturer={a.manufacturer}
                    model={a.model}
                    currentParts={parts}
                    trigger={
                      <Button variant="outline" size="sm" className="gap-1.5 font-medium">
                        <Plus className="size-3.5 text-primary" /> Add Custom Part
                      </Button>
                    }
                  />
                </div>
              </div>
            )}
          </div>

          {/* Section: Consumables, Lubricants & Belts Pack */}
          {consumables && (
            <div className="panel p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 pb-3">
                <div>
                  <h3 className="text-sm font-bold flex items-center gap-2 text-foreground">
                    <Droplet className="size-4 text-blue-600" /> Lubricants, Greases &amp;
                    Consumables Sourcing
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Recommended factory lubrication, greases, filter, and drive belt specifications
                    for {a.name}.
                  </p>
                </div>
                <SendPartsDialog
                  asset={{ id: a.id, name: a.name, manufacturer: a.manufacturer }}
                  lockAsset
                  initialPart={{
                    name: `Lube / Filter Kit for ${a.name}`,
                    manufacturer: a.manufacturer,
                    qty: 1,
                  }}
                  trigger={
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs font-semibold text-primary"
                    >
                      <Send className="size-3" /> Requisition Consumables
                    </Button>
                  }
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
                {consumables.oilGrade && (
                  <div className="rounded-lg border border-border bg-card p-3 space-y-1">
                    <p className="text-[11px] font-semibold uppercase text-muted-foreground">
                      Lube / Oil Spec
                    </p>
                    <p className="text-xs font-bold text-foreground">{consumables.oilGrade}</p>
                  </div>
                )}
                {consumables.greaseType && (
                  <div className="rounded-lg border border-border bg-card p-3 space-y-1">
                    <p className="text-[11px] font-semibold uppercase text-muted-foreground">
                      Bearing Grease Spec
                    </p>
                    <p className="text-xs font-bold text-foreground">{consumables.greaseType}</p>
                  </div>
                )}
                {consumables.beltSize && (
                  <div className="rounded-lg border border-border bg-card p-3 space-y-1">
                    <p className="text-[11px] font-semibold uppercase text-muted-foreground">
                      Drive Belt Spec
                    </p>
                    <p className="text-xs font-bold text-foreground">{consumables.beltSize}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="maintenance" className="mt-4 space-y-4">
          <div className="panel flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="text-sm font-medium">Manufacturer maintenance lookup</p>
              <p className="text-xs text-muted-foreground">
                Pulls published O&amp;M intervals, wear parts, and manual links for this make/model.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {a.manufacturer_url && (
                <a
                  href={a.manufacturer_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-primary underline"
                >
                  Manufacturer site <ExternalLink className="size-3.5" />
                </a>
              )}
              <Button onClick={() => lookup.mutate()} disabled={lookup.isPending}>
                <Sparkles className="size-4" />
                {lookup.isPending
                  ? "Researching…"
                  : info.data
                    ? "Refresh data"
                    : "Look up maintenance info"}
              </Button>
            </div>
          </div>

          {info.data ? (
            <div className="space-y-4">
              <div className="panel p-4">
                <p className="label-caps">Summary</p>
                <p className="mt-1 text-sm">{info.data.summary}</p>
              </div>

              {intervals.length > 0 && (
                <div className="panel p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="label-caps">Recommended intervals</p>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={addPms.isPending}
                      onClick={() => addPms.mutate(intervals)}
                    >
                      <CalendarPlus className="size-4" />
                      Add all to PM schedule
                    </Button>
                  </div>
                  <ul className="mt-2 divide-y divide-border">
                    {intervals.map((i, idx) => (
                      <li key={idx} className="py-2">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <span className="text-sm font-medium">{i.task}</span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-primary">{i.frequency}</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={addPms.isPending}
                              onClick={() => addPms.mutate([i])}
                            >
                              <CalendarPlus className="size-4" />
                              Add PM
                            </Button>
                          </div>
                        </div>
                        {i.notes && (
                          <p className="mt-0.5 text-xs text-muted-foreground">{i.notes}</p>
                        )}
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Every {frequencyToDays(i.frequency)} days
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="panel p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <p className="label-caps">Wear &amp; spare parts</p>
                    <Badge variant="secondary" className="text-xs">
                      {parts.length}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <EditAssetPartsDialog
                      assetId={a.id}
                      assetName={a.name}
                      manufacturer={a.manufacturer}
                      model={a.model}
                      currentParts={parts}
                      defaultTab="feedback"
                      trigger={
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-1 text-xs text-amber-600 hover:bg-amber-500/10 dark:text-amber-400"
                        >
                          <AlertTriangle className="size-3.5" />
                          Not the right parts?
                        </Button>
                      }
                    />
                    <EditAssetPartsDialog
                      assetId={a.id}
                      assetName={a.name}
                      manufacturer={a.manufacturer}
                      model={a.model}
                      currentParts={parts}
                      defaultTab="manage"
                      trigger={
                        <Button size="sm" variant="outline" className="gap-1 text-xs">
                          <Plus className="size-3" /> Edit / Add parts
                        </Button>
                      }
                    />
                    {parts.length > 0 && (
                      <SendPartsDialog
                        asset={{ id: a.id, name: a.name, manufacturer: a.manufacturer }}
                        lockAsset
                        trigger={
                          <Button size="sm" variant="outline" className="gap-1 text-xs">
                            <Send className="size-3 text-primary" /> Request all parts
                          </Button>
                        }
                      />
                    )}
                  </div>
                </div>

                {parts.length > 0 ? (
                  <ul className="mt-3 divide-y divide-border">
                    {parts.map((p, idx) => (
                      <li
                        key={idx}
                        className="flex flex-wrap items-center justify-between gap-3 py-2.5"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-foreground">{p.name}</span>
                            {p.part_number ? (
                              <span className="font-mono text-xs text-primary font-medium">
                                P/N: {p.part_number}
                              </span>
                            ) : (
                              <span className="text-xs italic text-muted-foreground">
                                No OEM P/N
                              </span>
                            )}
                          </div>
                          {p.notes && (
                            <p className="mt-0.5 text-xs text-muted-foreground">{p.notes}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <SendPartsDialog
                            asset={{ id: a.id, name: a.name, manufacturer: a.manufacturer }}
                            lockAsset
                            initialPart={{
                              name: p.name,
                              part_number: p.part_number,
                              manufacturer: a.manufacturer,
                              qty: 1,
                            }}
                            trigger={
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs font-semibold text-primary hover:bg-primary/10"
                              >
                                <Send className="size-3 mr-1" /> Send to coordinator
                              </Button>
                            }
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => deletePartMutation.mutate(idx)}
                            disabled={deletePartMutation.isPending}
                            title="Delete part (not right for this asset)"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="mt-3 rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                    <p>No parts stored for this asset.</p>
                    <p className="mt-1">
                      Click "Edit / Add parts" to add custom items or "Not the right parts?" to
                      research with custom equipment specs.
                    </p>
                  </div>
                )}
              </div>

              {sources.length > 0 && (
                <div className="panel p-4 border-l-4 border-l-blue-500">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 pb-2.5">
                    <div>
                      <p className="label-caps text-foreground flex items-center gap-1.5">
                        <BookOpen className="size-4 text-blue-500" /> Discovered Manufacturer
                        Sources &amp; Manuals
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Official manufacturer documentation and O&amp;M manuals found during
                        research. Attach any document to this asset's Manuals tab with 1 click.
                      </p>
                    </div>
                  </div>
                  <ul className="mt-3 divide-y divide-border/60">
                    {sources.map((s, idx) => {
                      const attached = isManualAttached(s.title, s.url);
                      return (
                        <li
                          key={idx}
                          className="py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs"
                        >
                          <div className="min-w-0 flex-1">
                            <a
                              href={s.url}
                              target="_blank"
                              rel="noreferrer"
                              className="font-semibold text-primary hover:underline inline-flex items-center gap-1.5 text-sm"
                            >
                              <FileText className="size-4 text-blue-500 shrink-0" />
                              {s.title}
                              <ExternalLink className="size-3 text-muted-foreground" />
                            </a>
                            <p className="text-[11px] text-muted-foreground mt-0.5 truncate font-mono">
                              {s.url}
                            </p>
                          </div>
                          <div className="shrink-0">
                            {attached ? (
                              <Badge
                                variant="secondary"
                                className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 font-semibold py-1 px-2.5"
                              >
                                <CheckCircle2 className="size-3.5 mr-1 text-emerald-600 dark:text-emerald-400" />
                                Attached to Manuals
                              </Badge>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 gap-1.5 text-xs font-semibold text-primary border-primary/40 hover:bg-primary/10"
                                disabled={attachManualMutation.isPending}
                                onClick={() =>
                                  attachManualMutation.mutate({
                                    title: s.title,
                                    url: s.url,
                                    manufacturer: a.manufacturer || "",
                                    notes: `Attached directly from manufacturer research for ${a.name}.`,
                                  })
                                }
                              >
                                <Upload className="size-3.5" />
                                Upload / Attach to Asset
                              </Button>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  <p className="mt-3 text-xs text-muted-foreground italic">
                    AI-assisted research — verify against the manufacturer manual before performing
                    work.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No manufacturer data stored yet for this asset. Run a lookup to pull it in.
            </p>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <div className="panel divide-y divide-border">
            {(wos.data ?? []).map((wo) => (
              <div key={wo.id} className="flex flex-wrap items-center gap-3 p-3">
                <span className="font-mono text-xs text-muted-foreground">WO-{wo.wo_number}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{wo.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {prettyLabel(wo.wo_type)} · {wo.due_date ? `due ${wo.due_date}` : "no due date"}
                  </p>
                </div>
                <Badge variant="outline">{prettyLabel(wo.status)}</Badge>
              </div>
            ))}
            {(wos.data ?? []).length === 0 && (
              <p className="p-3 text-sm text-muted-foreground">
                No work orders logged for this asset.
              </p>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Bottom Next / Previous Asset Navigation Footer */}
      {allAssets.length > 1 && (
        <div className="panel p-4 mt-6 border-border/80 bg-card/70 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center gap-2 w-full sm:w-1/3 justify-start">
            {prevAsset ? (
              <Link
                to="/assets/$assetId"
                params={{ assetId: prevAsset.id }}
                className="flex items-center gap-2.5 text-left group p-2.5 rounded-lg border border-border/70 hover:border-primary/40 hover:bg-muted/50 transition-all w-full max-w-sm"
              >
                <div className="size-8 rounded-md bg-muted flex items-center justify-center text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors shrink-0">
                  <ChevronLeft className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                    Previous Asset
                  </p>
                  <p className="text-xs font-medium text-foreground truncate group-hover:text-primary transition-colors">
                    {prevAsset.name} {prevAsset.tag_number ? `[${prevAsset.tag_number}]` : ""}
                  </p>
                </div>
              </Link>
            ) : (
              <div className="text-xs text-muted-foreground italic px-2 py-1">
                Beginning of asset catalog
              </div>
            )}
          </div>

          <div className="flex flex-col items-center text-center gap-0.5 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">
              Asset {currentIndex >= 0 ? currentIndex + 1 : 1} of {allAssets.length}
            </span>
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              Shortcuts:{" "}
              <kbd className="px-1 py-0.5 font-mono bg-muted rounded border text-[10px]">
                Alt + ←
              </kbd>{" "}
              or{" "}
              <kbd className="px-1 py-0.5 font-mono bg-muted rounded border text-[10px]">{"["}</kbd>{" "}
              /{" "}
              <kbd className="px-1 py-0.5 font-mono bg-muted rounded border text-[10px]">
                Alt + →
              </kbd>{" "}
              or{" "}
              <kbd className="px-1 py-0.5 font-mono bg-muted rounded border text-[10px]">{"]"}</kbd>
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-1/3 justify-end">
            {nextAsset ? (
              <Link
                to="/assets/$assetId"
                params={{ assetId: nextAsset.id }}
                className="flex items-center gap-2.5 text-right group p-2.5 rounded-lg border border-primary/30 bg-primary/5 hover:border-primary hover:bg-primary/10 transition-all w-full max-w-sm ml-auto"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-primary">
                    Next Asset
                  </p>
                  <p className="text-xs font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                    {nextAsset.name} {nextAsset.tag_number ? `[${nextAsset.tag_number}]` : ""}
                  </p>
                </div>
                <div className="size-8 rounded-md bg-primary/15 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors shrink-0">
                  <ChevronRight className="size-4" />
                </div>
              </Link>
            ) : (
              <div className="text-xs text-muted-foreground italic px-2 py-1 text-right">
                End of asset catalog
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

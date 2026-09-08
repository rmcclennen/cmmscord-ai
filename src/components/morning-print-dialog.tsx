import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AutoMorningPrintConfig,
  getAutoPrintConfig,
  getTodayIso,
  formatTime12h,
  markPrintedToday,
} from "@/lib/auto-morning-print";
import { prettyLabel, daysUntil } from "@/lib/cmms";
import { useTeamMembers } from "@/hooks/use-team-members";
import type { TeamMember } from "@/lib/notify";

function assignedName(members: TeamMember[] | undefined, id: string | null): string {
  if (!id) return "Unassigned";
  const m = members?.find((x) => x.id === id);
  return m?.full_name || m?.email || "Unassigned";
}
import { toast } from "sonner";
import {
  Printer,
  CalendarClock,
  ClipboardList,
  AlertTriangle,
  Clock,
  MapPin,
  Tag,
  ShieldAlert,
  CheckSquare,
  Wrench,
  Settings,
  Sparkles,
} from "lucide-react";

interface MorningPrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  autoPrintOnOpen?: boolean;
  onOpenSettings?: () => void;
}

export function MorningPrintDialog({
  open,
  onOpenChange,
  autoPrintOnOpen = false,
  onOpenSettings,
}: MorningPrintDialogProps) {
  const [config, setConfig] = useState<AutoMorningPrintConfig>(getAutoPrintConfig);
  const [activeTab, setActiveTab] = useState<"all" | "pms" | "wos">("all");
  const [selectedBuilding, setSelectedBuilding] = useState<string>("all");
  const [includeCover, setIncludeCover] = useState(true);
  // Job tickets are one-per-page-ish; default to none so a print job stays a few pages.
  const [ticketLimit, setTicketLimit] = useState<string>("0");
  const [dueScope, setDueScope] = useState<"due" | "horizon">("due");
  const includeTickets = ticketLimit !== "0";

  const team = useTeamMembers();
  const today = getTodayIso();

  // Keep config in sync if user changes it
  useEffect(() => {
    const handleConfigChange = (e: Event) => {
      const customEvent = e as CustomEvent<AutoMorningPrintConfig>;
      if (customEvent.detail) setConfig(customEvent.detail);
    };
    window.addEventListener("auto-morning-print-config-changed", handleConfigChange);
    return () =>
      window.removeEventListener("auto-morning-print-config-changed", handleConfigChange);
  }, []);

  // Sync initial building preference
  useEffect(() => {
    if (config.selectedBuilding) {
      setSelectedBuilding(config.selectedBuilding);
    }
  }, [config.selectedBuilding]);

  // Fetch PMs for the morning batch
  const pmsQuery = useQuery({
    queryKey: ["morning-print-pms", today, config.includeUpcomingPmsDays],
    enabled: open,
    queryFn: async () => {
      // Calculate horizon
      const horizonDate = new Date();
      horizonDate.setDate(horizonDate.getDate() + (config.includeUpcomingPmsDays || 0));
      const horizonIso = horizonDate.toISOString().slice(0, 10);

      const { data, error } = await supabase
        .from("pm_schedules")
        .select(
          "*, assets(id, name, location_name, building, tag_number, class, manufacturer, model)",
        )
        .eq("active", true)
        .lte("next_due", horizonIso)
        .order("next_due", { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch active Work Orders for the morning batch
  const wosQuery = useQuery({
    queryKey: ["morning-print-wos", today, config.includeEmergencyWosOnly],
    enabled: open,
    queryFn: async () => {
      let query = supabase
        .from("work_orders")
        .select(
          "*, assets(id, name, location_name, building, tag_number, class, manufacturer, model)",
        )
        .in("status", ["open", "in_progress", "on_hold"])
        .order("priority", { ascending: false });

      if (config.includeEmergencyWosOnly) {
        query = query.in("priority", ["critical", "emergency", "high"]);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Unique buildings for filter dropdown
  const availableBuildings = useMemo(() => {
    const buildings = new Set<string>();
    pmsQuery.data?.forEach((pm) => {
      if (pm.assets?.building) buildings.add(pm.assets.building);
    });
    wosQuery.data?.forEach((wo) => {
      if (wo.assets?.building) buildings.add(wo.assets.building);
    });
    return Array.from(buildings).sort();
  }, [pmsQuery.data, wosQuery.data]);

  // Filtered lists based on building selection
  const filteredPms = useMemo(() => {
    let list = pmsQuery.data || [];
    if (dueScope === "due") list = list.filter((p) => p.next_due <= today);
    if (selectedBuilding === "all") return list;
    return list.filter((p) => p.assets?.building === selectedBuilding);
  }, [pmsQuery.data, selectedBuilding, dueScope, today]);

  const filteredWos = useMemo(() => {
    const list = wosQuery.data || [];
    if (selectedBuilding === "all") return list;
    return list.filter((w) => w.assets?.building === selectedBuilding);
  }, [wosQuery.data, selectedBuilding]);


  // Counts & Statistics
  const overduePms = useMemo(
    () => filteredPms.filter((p) => p.next_due < today),
    [filteredPms, today],
  );
  const dueTodayPms = useMemo(
    () => filteredPms.filter((p) => p.next_due === today),
    [filteredPms, today],
  );
  const criticalWos = useMemo(
    () => filteredWos.filter((w) => w.priority === "critical" || w.priority === "high"),
    [filteredWos],
  );

  const totalEstimatedHours = useMemo(() => {
    const pmHours = filteredPms.reduce((acc, p) => acc + (Number(p.estimated_hours) || 0.5), 0);
    const woHours = filteredWos.reduce((acc, w) => acc + (Number(w.labor_hours) || 1.0), 0);
    return Math.round((pmHours + woHours) * 10) / 10;
  }, [filteredPms, filteredWos]);

  // Trigger print
  const handlePrint = () => {
    markPrintedToday();
    window.print();
  };

  // Auto-print on open if requested (e.g. from the scheduled morning alarm)
  useEffect(() => {
    if (open && autoPrintOnOpen && !pmsQuery.isLoading && !wosQuery.isLoading) {
      const timer = setTimeout(() => {
        handlePrint();
      }, 750);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [open, autoPrintOnOpen, pmsQuery.isLoading, wosQuery.isLoading]);

  const copyRosterToClipboard = () => {
    let text = `ASSETCARECONNECT - MORNING DISPATCH (${today})\n`;
    text += `==============================================\n`;
    text += `Overdue PMs: ${overduePms.length} | Due Today PMs: ${dueTodayPms.length} | Active WOs: ${filteredWos.length} | Est Hours: ${totalEstimatedHours}h\n\n`;

    if (filteredPms.length > 0) {
      text += `PREVENTIVE MAINTENANCE (${filteredPms.length}):\n`;
      filteredPms.forEach((p, idx) => {
        const assigned = assignedName(team.data, p.assigned_to);
        const bldg = p.assets?.building ? ` [${p.assets.building}]` : "";
        text += `${idx + 1}. ${p.title} - ${p.assets?.name || "Asset"}${bldg} (Due: ${p.next_due}, Assigned: ${assigned})\n`;
      });
      text += "\n";
    }

    if (filteredWos.length > 0) {
      text += `WORK ORDERS (${filteredWos.length}):\n`;
      filteredWos.forEach((w, idx) => {
        const assigned = assignedName(team.data, w.assigned_to);
        const bldg = w.assets?.building ? ` [${w.assets.building}]` : "";
        text += `${idx + 1}. WO-${w.wo_number}: ${w.title} - ${w.assets?.name || "Asset"}${bldg} (${w.priority.toUpperCase()}, Assigned: ${assigned})\n`;
      });
    }

    navigator.clipboard.writeText(text);
    toast.success("Morning dispatch roster copied to clipboard");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden bg-background">
        {/* Modal Top Controls (HIDDEN WHEN PRINTING) */}
        <div className="p-4 sm:p-5 border-b border-border bg-card print:hidden flex-shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <DialogTitle className="text-xl font-bold flex items-center gap-2">
                  <Printer className="size-5 text-primary" />
                  Morning Maintenance Print Dispatch
                </DialogTitle>
                <Badge
                  variant="outline"
                  className="font-mono text-xs border-primary/30 bg-primary/10 text-primary"
                >
                  {config.enabled
                    ? `Auto-Scheduled: ${formatTime12h(config.scheduledTime)}`
                    : "Auto-Print Off"}
                </Badge>
              </div>
              <DialogDescription className="text-xs text-muted-foreground">
                Batch print daily preventive maintenance tasks, corrective work orders, and shop
                dispatch rosters for morning shift meetings.
              </DialogDescription>
            </div>

            <div className="flex items-center gap-2">
              {onOpenSettings && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 text-xs"
                  onClick={() => {
                    onOpenChange(false);
                    onOpenSettings();
                  }}
                  title="Configure auto-print schedule"
                >
                  <Settings className="size-3.5" />
                  Schedule Settings
                </Button>
              )}
              <Button
                size="sm"
                onClick={handlePrint}
                className="h-8 gap-1.5 text-xs font-bold shadow-sm bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Printer className="size-4" />
                Print Packet Now
              </Button>
            </div>
          </div>

          {/* Filter & View Bar */}
          <div className="mt-4 pt-3 border-t border-border flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <Tabs
                value={activeTab}
                onValueChange={(v) => setActiveTab(v as "all" | "pms" | "wos")}
              >
                <TabsList className="h-8 text-xs">
                  <TabsTrigger value="all" className="text-xs px-2.5">
                    All Batch ({filteredPms.length + filteredWos.length})
                  </TabsTrigger>
                  <TabsTrigger value="pms" className="text-xs px-2.5">
                    PMs ({filteredPms.length})
                  </TabsTrigger>
                  <TabsTrigger value="wos" className="text-xs px-2.5">
                    Work Orders ({filteredWos.length})
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {availableBuildings.length > 0 && (
                <Select value={selectedBuilding} onValueChange={setSelectedBuilding}>
                  <SelectTrigger className="h-8 w-44 text-xs">
                    <SelectValue placeholder="All Buildings" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Plant Buildings</SelectItem>
                    {availableBuildings.map((b) => (
                      <SelectItem key={b} value={b}>
                        {b}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="flex items-center gap-2 text-muted-foreground">
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeCover}
                  onChange={(e) => setIncludeCover(e.target.checked)}
                  className="rounded border-border"
                />
                <span>Summary Sheet</span>
              </label>
              <span className="text-border">•</span>
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeTickets}
                  onChange={(e) => setIncludeTickets(e.target.checked)}
                  className="rounded border-border"
                />
                <span>Job Tickets</span>
              </label>
              <span className="text-border">•</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground"
                onClick={copyRosterToClipboard}
              >
                Copy Text
              </Button>
            </div>
          </div>
        </div>

        {/* Scrollable Printable Document Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50 dark:bg-slate-950/40 print:p-0 print:bg-white print:overflow-visible">
          <div className="max-w-3xl mx-auto space-y-6 print:max-w-none print:m-0 print:space-y-4">
            {/* 1. COVER / DISPATCH SUMMARY SHEET */}
            {includeCover && (
              <div className="bg-card text-card-foreground border border-border rounded-lg p-6 shadow-sm print:shadow-none print:border-2 print:border-black print:rounded-none print:p-6 print:break-after-page">
                {/* Document Header */}
                <div className="border-b-2 border-primary/60 pb-4 print:border-black">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground print:text-black font-semibold">
                        Plant Operations • Maintenance Management System
                      </p>
                      <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground print:text-black">
                        Daily Morning Maintenance Dispatch
                      </h1>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold font-mono text-primary print:text-black">
                        {today}
                      </p>
                      <p className="text-xs text-muted-foreground print:text-black">
                        Morning Shift Standup
                      </p>
                    </div>
                  </div>
                </div>

                {/* Key Morning Metrics Bar */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4 py-3 px-4 bg-muted/40 border border-border rounded-md print:bg-slate-100 print:border-black print:rounded-none">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-muted-foreground print:text-black block">
                      Overdue PMs
                    </span>
                    <span
                      className={`text-lg font-black font-mono ${
                        overduePms.length > 0
                          ? "text-destructive print:text-black"
                          : "text-foreground print:text-black"
                      }`}
                    >
                      {overduePms.length}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-muted-foreground print:text-black block">
                      PMs Due Today
                    </span>
                    <span className="text-lg font-black font-mono text-primary print:text-black">
                      {dueTodayPms.length}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-muted-foreground print:text-black block">
                      Active Work Orders
                    </span>
                    <span className="text-lg font-black font-mono text-foreground print:text-black">
                      {filteredWos.length}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-muted-foreground print:text-black block">
                      Est. Labor Hours
                    </span>
                    <span className="text-lg font-black font-mono text-foreground print:text-black">
                      {totalEstimatedHours} hrs
                    </span>
                  </div>
                </div>

                {/* Master Task Dispatch List */}
                <div className="space-y-4">
                  {/* PM Tasks Table */}
                  {(activeTab === "all" || activeTab === "pms") && filteredPms.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground print:text-black flex items-center gap-1.5">
                        <CalendarClock className="size-3.5 text-primary print:text-black" />
                        Preventive Maintenance Tasks ({filteredPms.length})
                      </h3>
                      <div className="border border-border print:border-black rounded-md overflow-hidden">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-muted/70 print:bg-slate-200 border-b border-border print:border-black text-[11px] font-semibold text-muted-foreground print:text-black">
                            <tr>
                              <th className="py-2 px-2.5">Due Date</th>
                              <th className="py-2 px-2.5">Asset / Equipment</th>
                              <th className="py-2 px-2.5">Location / Bldg</th>
                              <th className="py-2 px-2.5">Maintenance Routine</th>
                              <th className="py-2 px-2.5">Assigned</th>
                              <th className="py-2 px-2.5 text-center w-14">Initial</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border print:divide-black">
                            {filteredPms.map((pm) => {
                              const isOverdue = pm.next_due < today;
                              const assigned = assignedName(team.data, pm.assigned_to);
                              return (
                                <tr key={pm.id} className="hover:bg-muted/30">
                                  <td className="py-2 px-2.5 font-mono whitespace-nowrap">
                                    <span
                                      className={
                                        isOverdue
                                          ? "font-bold text-destructive print:text-black"
                                          : ""
                                      }
                                    >
                                      {pm.next_due}
                                      {isOverdue && (
                                        <span className="ml-1 text-[10px] text-destructive print:text-black font-semibold">
                                          ({Math.abs(daysUntil(pm.next_due) || 0)}d late)
                                        </span>
                                      )}
                                    </span>
                                  </td>
                                  <td className="py-2 px-2.5 font-semibold">
                                    {pm.assets?.name || "Equipment"}
                                    {pm.assets?.tag_number && (
                                      <span className="block text-[10px] text-muted-foreground print:text-black font-mono font-normal">
                                        Tag #{pm.assets.tag_number}
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2 px-2.5 text-muted-foreground print:text-black">
                                    {pm.assets?.building || "—"}
                                    {pm.assets?.location_name && (
                                      <span className="block text-[10px]">
                                        {pm.assets.location_name}
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2 px-2.5">
                                    <span className="font-medium text-foreground print:text-black">
                                      {pm.title}
                                    </span>
                                    {pm.estimated_hours && (
                                      <span className="text-[10px] text-muted-foreground print:text-black ml-1 font-mono">
                                        ({pm.estimated_hours}h)
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2 px-2.5 text-muted-foreground print:text-black whitespace-nowrap">
                                    {assigned}
                                  </td>
                                  <td className="py-2 px-2.5 text-center">
                                    <div className="size-4 mx-auto border border-border print:border-black rounded-sm" />
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Work Orders Table */}
                  {(activeTab === "all" || activeTab === "wos") && filteredWos.length > 0 && (
                    <div className="space-y-2 mt-4">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground print:text-black flex items-center gap-1.5">
                        <ClipboardList className="size-3.5 text-primary print:text-black" />
                        Active Work Orders ({filteredWos.length})
                      </h3>
                      <div className="border border-border print:border-black rounded-md overflow-hidden">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-muted/70 print:bg-slate-200 border-b border-border print:border-black text-[11px] font-semibold text-muted-foreground print:text-black">
                            <tr>
                              <th className="py-2 px-2.5 w-16">WO #</th>
                              <th className="py-2 px-2.5">Priority</th>
                              <th className="py-2 px-2.5">Asset / Equipment</th>
                              <th className="py-2 px-2.5">Problem / Work Title</th>
                              <th className="py-2 px-2.5">Assigned</th>
                              <th className="py-2 px-2.5 text-center w-14">Initial</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border print:divide-black">
                            {filteredWos.map((wo) => {
                              const assigned = assignedName(team.data, wo.assigned_to);
                              const isCrit =
                                wo.priority === "critical" || wo.priority === "emergency";
                              return (
                                <tr key={wo.id} className="hover:bg-muted/30">
                                  <td className="py-2 px-2.5 font-mono font-bold whitespace-nowrap">
                                    WO-{wo.wo_number}
                                  </td>
                                  <td className="py-2 px-2.5 uppercase text-[10px] font-bold">
                                    <span
                                      className={
                                        isCrit
                                          ? "text-destructive print:text-black font-extrabold"
                                          : ""
                                      }
                                    >
                                      {wo.priority}
                                    </span>
                                  </td>
                                  <td className="py-2 px-2.5 font-semibold">
                                    {wo.assets?.name || "Plant Asset"}
                                    {wo.assets?.tag_number && (
                                      <span className="block text-[10px] text-muted-foreground print:text-black font-mono font-normal">
                                        Tag #{wo.assets.tag_number} • {wo.assets?.building || ""}
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2 px-2.5">
                                    <span className="font-medium text-foreground print:text-black">
                                      {wo.title}
                                    </span>
                                    {wo.description && (
                                      <p className="text-[11px] text-muted-foreground print:text-black line-clamp-1">
                                        {wo.description}
                                      </p>
                                    )}
                                  </td>
                                  <td className="py-2 px-2.5 text-muted-foreground print:text-black whitespace-nowrap">
                                    {assigned}
                                  </td>
                                  <td className="py-2 px-2.5 text-center">
                                    <div className="size-4 mx-auto border border-border print:border-black rounded-sm" />
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Morning Shift Sign-off Block */}
                  <div className="mt-6 pt-4 border-t border-dashed border-border print:border-black grid grid-cols-2 gap-6 text-xs text-muted-foreground print:text-black">
                    <div>
                      <p className="font-semibold mb-6">Shift Supervisor Sign-off:</p>
                      <div className="border-b border-border print:border-black w-full" />
                      <p className="text-[10px] mt-1">Printed: {today} • Shift Dispatch</p>
                    </div>
                    <div>
                      <p className="font-semibold mb-6">Lead Technician Sign-off:</p>
                      <div className="border-b border-border print:border-black w-full" />
                      <p className="text-[10px] mt-1">Completed / Handover Verified</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 2. INDIVIDUAL JOB TICKETS (PRINTABLE CARDS) */}
            {includeTickets && (
              <div className="space-y-4 print:space-y-6">
                {/* PM Job Tickets */}
                {(activeTab === "all" || activeTab === "pms") &&
                  filteredPms.map((pm, idx) => {
                    const assigned = assignedName(team.data, pm.assigned_to);
                    const isOverdue = pm.next_due < today;
                    return (
                      <div
                        key={pm.id}
                        className="bg-card text-card-foreground border border-border rounded-lg p-5 shadow-sm print:shadow-none print:border-2 print:border-black print:rounded-none print:p-5 print:break-inside-avoid print:mb-6"
                      >
                        {/* Ticket Header */}
                        <div className="flex items-start justify-between border-b border-border print:border-black pb-3 gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="bg-primary/10 text-primary print:bg-transparent print:text-black border border-primary/30 print:border-black font-mono text-[11px] font-bold px-1.5 py-0.5 rounded">
                                PM TICKET
                              </span>
                              <span className="text-xs text-muted-foreground print:text-black font-mono">
                                Every {pm.interval_days} Days
                              </span>
                              {isOverdue && (
                                <span className="text-xs font-bold text-destructive print:text-black border border-destructive/30 px-1 rounded">
                                  OVERDUE
                                </span>
                              )}
                            </div>
                            <h2 className="text-base font-bold mt-1 text-foreground print:text-black">
                              {pm.title}
                            </h2>
                          </div>
                          <div className="text-right font-mono text-xs">
                            <p className="font-bold">Due: {pm.next_due}</p>
                            <p className="text-muted-foreground print:text-black text-[11px]">
                              Est: {pm.estimated_hours || 0.5} hrs
                            </p>
                          </div>
                        </div>

                        {/* Equipment Identification Box */}
                        <div className="my-3 py-2 px-3 bg-muted/30 border border-border/80 print:bg-slate-50 print:border-black rounded grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                          <div>
                            <span className="text-[10px] uppercase font-bold text-muted-foreground print:text-black block">
                              Equipment Name
                            </span>
                            <span className="font-semibold text-foreground print:text-black">
                              {pm.assets?.name || "Asset"}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-bold text-muted-foreground print:text-black block">
                              Asset Tag / ID
                            </span>
                            <span className="font-mono text-foreground print:text-black">
                              {pm.assets?.tag_number ? `#${pm.assets.tag_number}` : "—"}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-bold text-muted-foreground print:text-black block">
                              Building / Area
                            </span>
                            <span className="text-foreground print:text-black">
                              {pm.assets?.building || "Main Facility"}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-bold text-muted-foreground print:text-black block">
                              Assigned Tech
                            </span>
                            <span className="font-semibold text-foreground print:text-black">
                              {assigned}
                            </span>
                          </div>
                        </div>

                        {/* Safety & LOTO Precautions Notice */}
                        <div className="my-2 p-2.5 bg-amber-500/10 border border-amber-500/30 print:bg-transparent print:border-black rounded text-[11px] flex items-start gap-2">
                          <ShieldAlert className="size-4 text-amber-600 print:text-black shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold uppercase text-amber-700 dark:text-amber-400 print:text-black">
                              Safety &amp; Lockout / Tagout (LOTO):
                            </span>{" "}
                            De-energize, bleed residual pressure, and place safety locks/tags before
                            servicing. Wear mandated safety glasses, gloves, and steel-toe boots.
                          </div>
                        </div>

                        {/* Tasks / Checklist */}
                        <div className="my-3">
                          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground print:text-black mb-1.5 flex items-center gap-1">
                            <CheckSquare className="size-3.5" /> Inspection &amp; Maintenance Steps
                          </p>
                          <div className="space-y-1.5">
                            {pm.tasks ? (
                              pm.tasks
                                .split("\n")
                                .filter((t) => t.trim().length > 0)
                                .map((step, sIdx) => (
                                  <div
                                    key={sIdx}
                                    className="flex items-start gap-2 text-xs text-foreground print:text-black"
                                  >
                                    <div className="size-3.5 border-2 border-border print:border-black rounded-sm mt-0.5 shrink-0" />
                                    <span>{step.replace(/^[-*•\d.]+\s*/, "")}</span>
                                  </div>
                                ))
                            ) : (
                              <div className="flex items-start gap-2 text-xs text-foreground print:text-black">
                                <div className="size-3.5 border-2 border-border print:border-black rounded-sm mt-0.5 shrink-0" />
                                <span>
                                  Perform full manufacturer-recommended preventive maintenance
                                  inspection according to standard operating procedure.
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Sign-off & Technician Execution Box */}
                        <div className="mt-4 pt-3 border-t border-border print:border-black grid grid-cols-3 gap-3 text-xs">
                          <div>
                            <span className="text-[10px] text-muted-foreground print:text-black block mb-4">
                              Technician Signature:
                            </span>
                            <div className="border-b border-border print:border-black" />
                          </div>
                          <div>
                            <span className="text-[10px] text-muted-foreground print:text-black block mb-4">
                              Date Completed:
                            </span>
                            <div className="border-b border-border print:border-black" />
                          </div>
                          <div>
                            <span className="text-[10px] text-muted-foreground print:text-black block mb-4">
                              Actual Labor Hours:
                            </span>
                            <div className="border-b border-border print:border-black" />
                          </div>
                        </div>
                      </div>
                    );
                  })}

                {/* Work Order Job Tickets */}
                {(activeTab === "all" || activeTab === "wos") &&
                  filteredWos.map((wo) => {
                    const assigned = assignedName(team.data, wo.assigned_to);
                    const isCrit = wo.priority === "critical" || wo.priority === "emergency";
                    return (
                      <div
                        key={wo.id}
                        className="bg-card text-card-foreground border border-border rounded-lg p-5 shadow-sm print:shadow-none print:border-2 print:border-black print:rounded-none print:p-5 print:break-inside-avoid print:mb-6"
                      >
                        {/* Ticket Header */}
                        <div className="flex items-start justify-between border-b border-border print:border-black pb-3 gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="bg-primary/10 text-primary print:bg-transparent print:text-black border border-primary/30 print:border-black font-mono text-[11px] font-bold px-1.5 py-0.5 rounded">
                                WO #{wo.wo_number}
                              </span>
                              <span
                                className={`text-xs font-bold uppercase ${
                                  isCrit
                                    ? "text-destructive print:text-black border border-destructive/40 px-1 rounded"
                                    : "text-muted-foreground print:text-black"
                                }`}
                              >
                                {wo.priority} Priority
                              </span>
                              <span className="text-xs text-muted-foreground print:text-black capitalize">
                                • {wo.wo_type || "Corrective"}
                              </span>
                            </div>
                            <h2 className="text-base font-bold mt-1 text-foreground print:text-black">
                              {wo.title}
                            </h2>
                          </div>
                          <div className="text-right font-mono text-xs">
                            <p className="font-bold">
                              Status: {prettyLabel(wo.status).toUpperCase()}
                            </p>
                            {wo.due_date && (
                              <p className="text-muted-foreground print:text-black text-[11px]">
                                Target: {wo.due_date}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Equipment Identification Box */}
                        <div className="my-3 py-2 px-3 bg-muted/30 border border-border/80 print:bg-slate-50 print:border-black rounded grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                          <div>
                            <span className="text-[10px] uppercase font-bold text-muted-foreground print:text-black block">
                              Equipment Name
                            </span>
                            <span className="font-semibold text-foreground print:text-black">
                              {wo.assets?.name || "Facility Equipment"}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-bold text-muted-foreground print:text-black block">
                              Asset Tag / ID
                            </span>
                            <span className="font-mono text-foreground print:text-black">
                              {wo.assets?.tag_number ? `#${wo.assets.tag_number}` : "—"}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-bold text-muted-foreground print:text-black block">
                              Building / Area
                            </span>
                            <span className="text-foreground print:text-black">
                              {wo.assets?.building || "Main Plant"}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-bold text-muted-foreground print:text-black block">
                              Assigned Tech
                            </span>
                            <span className="font-semibold text-foreground print:text-black">
                              {assigned}
                            </span>
                          </div>
                        </div>

                        {/* Problem Description & Work Scope */}
                        <div className="my-3 space-y-1.5">
                          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground print:text-black flex items-center gap-1">
                            <Wrench className="size-3.5" /> Scope of Work / Reported Problem:
                          </p>
                          <div className="p-2.5 bg-muted/20 border border-border/60 print:bg-transparent print:border-black rounded text-xs leading-relaxed text-foreground print:text-black">
                            {wo.description || "Diagnose, repair, and test equipment operation."}
                          </div>
                        </div>

                        {/* Parts Used / Required Line */}
                        <div className="my-2 text-xs">
                          <span className="font-bold text-muted-foreground print:text-black">
                            Parts / MRO Items Required:
                          </span>{" "}
                          <span className="italic text-muted-foreground print:text-black">
                            {wo.parts_used ||
                              "______________________________________________________"}
                          </span>
                        </div>

                        {/* Sign-off & Technician Execution Box */}
                        <div className="mt-4 pt-3 border-t border-border print:border-black grid grid-cols-3 gap-3 text-xs">
                          <div>
                            <span className="text-[10px] text-muted-foreground print:text-black block mb-4">
                              Technician Signature:
                            </span>
                            <div className="border-b border-border print:border-black" />
                          </div>
                          <div>
                            <span className="text-[10px] text-muted-foreground print:text-black block mb-4">
                              Date Completed:
                            </span>
                            <div className="border-b border-border print:border-black" />
                          </div>
                          <div>
                            <span className="text-[10px] text-muted-foreground print:text-black block mb-4">
                              Actual Labor Hours:
                            </span>
                            <div className="border-b border-border print:border-black" />
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

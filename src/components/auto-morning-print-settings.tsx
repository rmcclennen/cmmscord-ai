import { useState, useEffect } from "react";
import {
  AutoMorningPrintConfig,
  DEFAULT_AUTO_PRINT_CONFIG,
  getAutoPrintConfig,
  saveAutoPrintConfig,
  formatTime12h,
  getCurrentTime24,
  getTodayIso,
  playMorningChime,
  resetTodayTrigger,
  openMorningPrintDialog,
  requestDesktopNotificationPermission,
} from "@/lib/auto-morning-print";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Printer,
  Clock,
  CalendarCheck,
  ClipboardList,
  Volume2,
  Bell,
  Sparkles,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

const COMMON_SHIFT_TIMES = [
  { value: "05:00", label: "05:00 AM (Early Shift / Lead Prep)" },
  { value: "05:30", label: "05:30 AM (Pre-Shift Briefing)" },
  { value: "06:00", label: "06:00 AM (Shift 1 Kickoff)" },
  { value: "06:30", label: "06:30 AM (Standard Plant Morning)" },
  { value: "07:00", label: "07:00 AM (Day Shift Start)" },
  { value: "07:30", label: "07:30 AM (Morning Standup)" },
  { value: "08:00", label: "08:00 AM (General Maintenance)" },
];

interface AutoMorningPrintSettingsProps {
  onOpenBatchPreview?: () => void;
  className?: string;
}

export function AutoMorningPrintSettings({
  onOpenBatchPreview,
  className = "",
}: AutoMorningPrintSettingsProps) {
  const [config, setConfig] = useState<AutoMorningPrintConfig>(getAutoPrintConfig);
  const [customTime, setCustomTime] = useState("");
  const [isCustomTime, setIsCustomTime] = useState(false);

  useEffect(() => {
    const c = getAutoPrintConfig();
    setConfig(c);
    const isPreset = COMMON_SHIFT_TIMES.some((t) => t.value === c.scheduledTime);
    if (!isPreset && c.scheduledTime) {
      setIsCustomTime(true);
      setCustomTime(c.scheduledTime);
    }
  }, []);

  const update = (partial: Partial<AutoMorningPrintConfig>) => {
    const next = saveAutoPrintConfig(partial);
    setConfig(next);
    toast.success("Morning print settings saved");
  };

  const handleTimeSelect = (val: string) => {
    if (val === "custom") {
      setIsCustomTime(true);
      if (!customTime) setCustomTime(config.scheduledTime || "06:30");
    } else {
      setIsCustomTime(false);
      update({ scheduledTime: val });
    }
  };

  const handleCustomTimeBlur = () => {
    if (/^([01]\d|2[0-3]):([0-5]\d)$/.test(customTime)) {
      update({ scheduledTime: customTime });
    } else {
      toast.error("Enter a valid 24-hour time format (HH:MM), e.g. 06:45");
      setCustomTime(config.scheduledTime);
    }
  };

  const handleToggleDesktopNotif = async (checked: boolean) => {
    if (checked) {
      const granted = await requestDesktopNotificationPermission();
      if (!granted) {
        toast.error("Browser desktop notifications were blocked or denied.");
        update({ desktopNotification: false });
        return;
      }
    }
    update({ desktopNotification: checked });
  };

  const handleTestChime = () => {
    playMorningChime();
    toast.info("Playing morning alert chime test...");
  };

  const handleResetToday = () => {
    resetTodayTrigger();
    setConfig(getAutoPrintConfig());
    toast.success("Today's morning auto-trigger has been reset for testing.");
  };

  const handleTriggerNow = () => {
    playMorningChime();
    toast.success("☀️ Morning Maintenance Dispatch triggered!");
    if (onOpenBatchPreview) {
      onOpenBatchPreview();
    } else {
      openMorningPrintDialog(config.autoTriggerPrintDialog);
    }
  };

  const today = getTodayIso();
  const printedToday = config.lastPrintedDate === today;

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="rounded-lg border border-border bg-card p-5 space-y-6 shadow-sm">
        {/* Card Header & Master Switch */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Printer className="size-5 text-primary" />
              <h2 className="text-base font-bold text-foreground">
                Automatic Morning Print &amp; Dispatch
              </h2>
              <Badge
                variant={config.enabled ? "default" : "secondary"}
                className="text-xs font-semibold"
              >
                {config.enabled ? "Active" : "Disabled"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground max-w-xl">
              Automatically compiles and prints today&apos;s preventive maintenance tasks and open
              work orders every morning at your plant&apos;s shift start time.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Switch
              id="enable-morning-print"
              checked={config.enabled}
              onCheckedChange={(checked) => update({ enabled: checked })}
              aria-label="Toggle Automatic Morning Printing"
            />
            <Label htmlFor="enable-morning-print" className="text-sm font-semibold cursor-pointer">
              {config.enabled ? "Auto-Print ON" : "Auto-Print OFF"}
            </Label>
          </div>
        </div>

        {/* Schedule Time Selector */}
        <div className="grid gap-4 sm:grid-cols-2 bg-muted/20 border border-border/80 rounded-md p-4">
          <div className="space-y-2">
            <Label
              htmlFor="shift-time"
              className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5"
            >
              <Clock className="size-3.5 text-primary" />
              Morning Shift Print Time
            </Label>
            <Select
              value={isCustomTime ? "custom" : config.scheduledTime}
              onValueChange={handleTimeSelect}
            >
              <SelectTrigger id="shift-time" className="h-9 text-xs bg-background">
                <SelectValue placeholder="Select shift time" />
              </SelectTrigger>
              <SelectContent>
                {COMMON_SHIFT_TIMES.map((t) => (
                  <SelectItem key={t.value} value={t.value} className="text-xs">
                    {t.label}
                  </SelectItem>
                ))}
                <SelectItem value="custom" className="text-xs font-semibold">
                  Custom Time (HH:MM)...
                </SelectItem>
              </SelectContent>
            </Select>

            {isCustomTime && (
              <div className="pt-2 flex items-center gap-2">
                <Input
                  type="time"
                  value={customTime}
                  onChange={(e) => setCustomTime(e.target.value)}
                  onBlur={handleCustomTimeBlur}
                  className="h-8 w-36 text-xs font-mono bg-background"
                />
                <span className="text-xs text-muted-foreground">
                  (Currently {formatTime12h(config.scheduledTime)})
                </span>
              </div>
            )}
          </div>

          <div className="space-y-1.5 text-xs text-muted-foreground border-l border-border/60 pl-4">
            <p className="font-semibold text-foreground">Schedule Status:</p>
            {config.enabled ? (
              <div className="space-y-1">
                <p className="text-primary font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5" />
                  Scheduled daily for {formatTime12h(config.scheduledTime)}
                </p>
                <p className="text-[11px]">
                  {printedToday ? (
                    <span className="text-muted-foreground">
                      ✓ Today&apos;s batch was recorded at{" "}
                      {config.lastTriggeredAt
                        ? new Date(config.lastTriggeredAt).toLocaleTimeString()
                        : "earlier"}
                      .
                    </span>
                  ) : (
                    <span>
                      Batch will trigger automatically when this station reaches{" "}
                      {formatTime12h(config.scheduledTime)}.
                    </span>
                  )}
                </p>
              </div>
            ) : (
              <p className="italic text-muted-foreground">
                Automatic printing is disabled. Turn the switch on above to enable daily morning
                dispatch.
              </p>
            )}
          </div>
        </div>

        {/* Content & Scope Filters */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            What to Include in Morning Print Packet
          </h3>

          <div className="grid gap-3 sm:grid-cols-2">
            {/* PM Overdue */}
            <div className="flex items-center justify-between p-3 rounded-md border border-border bg-card">
              <div className="space-y-0.5">
                <Label
                  htmlFor="inc-overdue-pms"
                  className="text-xs font-bold cursor-pointer flex items-center gap-1.5"
                >
                  <AlertTriangle className="size-3.5 text-destructive" />
                  Overdue PM Schedules
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Include missed or past-due preventive routines.
                </p>
              </div>
              <Switch
                id="inc-overdue-pms"
                checked={config.includeOverduePms}
                onCheckedChange={(c) => update({ includeOverduePms: c })}
              />
            </div>

            {/* PM Due Today */}
            <div className="flex items-center justify-between p-3 rounded-md border border-border bg-card">
              <div className="space-y-0.5">
                <Label
                  htmlFor="inc-today-pms"
                  className="text-xs font-bold cursor-pointer flex items-center gap-1.5"
                >
                  <CalendarCheck className="size-3.5 text-primary" />
                  PMs Due Today
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Include routines scheduled for today&apos;s date.
                </p>
              </div>
              <Switch
                id="inc-today-pms"
                checked={config.includeDueTodayPms}
                onCheckedChange={(c) => update({ includeDueTodayPms: c })}
              />
            </div>

            {/* Active Work Orders */}
            <div className="flex items-center justify-between p-3 rounded-md border border-border bg-card">
              <div className="space-y-0.5">
                <Label
                  htmlFor="inc-wos"
                  className="text-xs font-bold cursor-pointer flex items-center gap-1.5"
                >
                  <ClipboardList className="size-3.5 text-primary" />
                  Active Work Orders
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Include open and in-progress corrective work.
                </p>
              </div>
              <Switch
                id="inc-wos"
                checked={config.includeActiveWorkOrders}
                onCheckedChange={(c) => update({ includeActiveWorkOrders: c })}
              />
            </div>

            {/* Emergency WOs Only */}
            <div className="flex items-center justify-between p-3 rounded-md border border-border bg-card">
              <div className="space-y-0.5">
                <Label htmlFor="inc-emerg-only" className="text-xs font-bold cursor-pointer">
                  Urgent / Critical WOs Only
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Limit work orders to high, critical, or emergency jobs.
                </p>
              </div>
              <Switch
                id="inc-emerg-only"
                checked={config.includeEmergencyWosOnly}
                onCheckedChange={(c) => update({ includeEmergencyWosOnly: c })}
              />
            </div>
          </div>

          {/* Upcoming PMs horizon dropdown */}
          <div className="grid gap-3 sm:grid-cols-2 pt-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">PM Horizon Lookahead</Label>
              <Select
                value={String(config.includeUpcomingPmsDays)}
                onValueChange={(v) => update({ includeUpcomingPmsDays: Number(v) })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Horizon" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0" className="text-xs">
                    Today only (no lookahead)
                  </SelectItem>
                  <SelectItem value="1" className="text-xs">
                    Include tomorrow (next 24 hours)
                  </SelectItem>
                  <SelectItem value="3" className="text-xs">
                    Next 3 days lookahead
                  </SelectItem>
                  <SelectItem value="7" className="text-xs">
                    Full 7-day week lookahead
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Print Packet Structure</Label>
              <Select
                value={config.formatStyle}
                onValueChange={(v) =>
                  update({ formatStyle: v as "both" | "summary_only" | "tickets_only" })
                }
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="both" className="text-xs">
                    Cover Sheet + Individual Job Tickets
                  </SelectItem>
                  <SelectItem value="summary_only" className="text-xs">
                    Cover / Dispatch Sheet Only (Compact Roster)
                  </SelectItem>
                  <SelectItem value="tickets_only" className="text-xs">
                    Individual Job Tickets Only
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Alerts & Audio Automation Settings */}
        <div className="space-y-3 pt-2 border-t border-border">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Print Action &amp; Sound Alerts
          </h3>

          <div className="grid gap-3 sm:grid-cols-3">
            {/* Auto Print Dialog */}
            <div className="flex items-center justify-between p-3 rounded-md border border-border bg-card">
              <div className="space-y-0.5">
                <Label htmlFor="auto-dialog" className="text-xs font-bold cursor-pointer">
                  Auto-Open Printer
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Launch system print window on trigger.
                </p>
              </div>
              <Switch
                id="auto-dialog"
                checked={config.autoTriggerPrintDialog}
                onCheckedChange={(c) => update({ autoTriggerPrintDialog: c })}
              />
            </div>

            {/* Sound Chime */}
            <div className="flex items-center justify-between p-3 rounded-md border border-border bg-card">
              <div className="space-y-0.5">
                <Label
                  htmlFor="sound-chime"
                  className="text-xs font-bold cursor-pointer flex items-center gap-1"
                >
                  <Volume2 className="size-3.5 text-primary" />
                  Morning Chime
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Play tone when morning dispatch runs.
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleTestChime}
                  className="h-6 px-1.5 text-[10px] text-muted-foreground"
                  title="Test audio chime"
                >
                  Test
                </Button>
                <Switch
                  id="sound-chime"
                  checked={config.notifySound}
                  onCheckedChange={(c) => update({ notifySound: c })}
                />
              </div>
            </div>

            {/* Browser Notification */}
            <div className="flex items-center justify-between p-3 rounded-md border border-border bg-card">
              <div className="space-y-0.5">
                <Label
                  htmlFor="desktop-notif"
                  className="text-xs font-bold cursor-pointer flex items-center gap-1"
                >
                  <Bell className="size-3.5 text-primary" />
                  Desktop Alert
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Send system notification to screen.
                </p>
              </div>
              <Switch
                id="desktop-notif"
                checked={config.desktopNotification}
                onCheckedChange={handleToggleDesktopNotif}
              />
            </div>
          </div>
        </div>

        {/* Action Buttons: Preview & Testing */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleTriggerNow}
              className="h-9 gap-1.5 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Printer className="size-4" />
              Preview / Print Today&apos;s Batch Now
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleResetToday}
              className="h-9 gap-1.5 text-xs"
              title="Clears today's trigger flag to re-test the auto scheduler"
            >
              <RotateCcw className="size-3.5" />
              Reset Today&apos;s Run Flag
            </Button>
          </div>

          <p className="text-[11px] text-muted-foreground">
            Current system time:{" "}
            <span className="font-mono font-semibold">{getCurrentTime24()}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

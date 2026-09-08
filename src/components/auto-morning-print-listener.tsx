import { useState, useEffect, useCallback, useRef } from "react";
import {
  AutoMorningPrintConfig,
  getAutoPrintConfig,
  checkShouldTriggerNow,
  markPrintedToday,
  playMorningChime,
  sendDesktopNotification,
  formatTime12h,
} from "@/lib/auto-morning-print";
import { MorningPrintDialog } from "@/components/morning-print-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AutoMorningPrintSettings } from "@/components/auto-morning-print-settings";
import { toast } from "sonner";

export function AutoMorningPrintListener() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [autoPrintFlag, setAutoPrintFlag] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Prevent multiple overlapping triggers in the same render loop
  const isTriggeringRef = useRef(false);

  // Check whether the scheduled morning time has arrived
  const checkTime = useCallback(() => {
    if (isTriggeringRef.current) return;
    const config = getAutoPrintConfig();
    if (!config.enabled) return;

    if (checkShouldTriggerNow(config)) {
      isTriggeringRef.current = true;
      try {
        // Mark printed today so it won't fire again today
        markPrintedToday();

        // Sound alert
        if (config.notifySound) {
          playMorningChime();
        }

        // Desktop system notification
        if (config.desktopNotification) {
          sendDesktopNotification(
            "Morning Maintenance Dispatch",
            `Shift print run ready for ${formatTime12h(config.scheduledTime)}. PMs and work orders are compiled.`,
          );
        }

        toast.info(
          `☀️ Morning Dispatch triggered for ${formatTime12h(config.scheduledTime)}. Preparing PMs and Work Orders packet...`,
          { duration: 6000 },
        );

        setAutoPrintFlag(Boolean(config.autoTriggerPrintDialog));
        setDialogOpen(true);
      } finally {
        setTimeout(() => {
          isTriggeringRef.current = false;
        }, 5000);
      }
    }
  }, []);

  // Run periodic check and handle window focus/tab switches
  useEffect(() => {
    // Immediate check on mount
    checkTime();

    // Check every 30 seconds
    const interval = setInterval(checkTime, 30_000);

    const onFocusOrVisible = () => {
      checkTime();
    };

    window.addEventListener("focus", onFocusOrVisible);
    document.addEventListener("visibilitychange", onFocusOrVisible);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocusOrVisible);
      document.removeEventListener("visibilitychange", onFocusOrVisible);
    };
  }, [checkTime]);

  // Listen for programmatic open events from buttons across the app
  useEffect(() => {
    const handleOpen = (e: Event) => {
      const custom = e as CustomEvent<{ autoPrint?: boolean }>;
      setAutoPrintFlag(Boolean(custom.detail?.autoPrint));
      setDialogOpen(true);
    };

    window.addEventListener("open-morning-print-dialog", handleOpen);
    return () => {
      window.removeEventListener("open-morning-print-dialog", handleOpen);
    };
  }, []);

  return (
    <>
      <MorningPrintDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        autoPrintOnOpen={autoPrintFlag}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-5">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              Automatic Morning Print Configuration
            </DialogTitle>
          </DialogHeader>
          <AutoMorningPrintSettings
            onOpenBatchPreview={() => {
              setSettingsOpen(false);
              setAutoPrintFlag(false);
              setDialogOpen(true);
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

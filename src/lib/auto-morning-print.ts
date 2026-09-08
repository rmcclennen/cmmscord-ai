/**
 * Automatic Morning Print Dispatch for PMs and Work Orders
 * Manages daily scheduled print runs, local persistence, audio alerts, and dispatch triggers.
 */

export interface AutoMorningPrintConfig {
  enabled: boolean;
  scheduledTime: string; // "HH:mm" in 24-hour format, e.g. "06:30"
  includeOverduePms: boolean;
  includeDueTodayPms: boolean;
  includeUpcomingPmsDays: number; // 0 = today only, 1, 3, 7 days
  includeActiveWorkOrders: boolean;
  includeEmergencyWosOnly: boolean;
  selectedBuilding: string; // "all" or specific plant building
  formatStyle: "both" | "summary_only" | "tickets_only";
  autoTriggerPrintDialog: boolean; // call window.print() directly or open review modal first
  notifySound: boolean;
  desktopNotification: boolean;
  lastPrintedDate: string | null; // "YYYY-MM-DD"
  lastTriggeredAt: string | null; // ISO timestamp
}

export const DEFAULT_AUTO_PRINT_CONFIG: AutoMorningPrintConfig = {
  enabled: false,
  scheduledTime: "06:30", // 6:30 AM shift start default
  includeOverduePms: true,
  includeDueTodayPms: true,
  includeUpcomingPmsDays: 0, // Today only by default
  includeActiveWorkOrders: true,
  includeEmergencyWosOnly: false,
  selectedBuilding: "all",
  formatStyle: "both", // Cover sheet + individual tickets
  autoTriggerPrintDialog: true,
  notifySound: true,
  desktopNotification: false,
  lastPrintedDate: null,
  lastTriggeredAt: null,
};

const STORAGE_KEY = "assetcare_auto_morning_print_config_v1";

export function getTodayIso(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getCurrentTime24(): string {
  const d = new Date();
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function formatTime12h(time24: string): string {
  if (!time24 || !time24.includes(":")) return time24;
  const [hStr, mStr] = time24.split(":");
  const h = parseInt(hStr ?? "", 10);
  const m = parseInt(mStr ?? "", 10);
  if (isNaN(h) || isNaN(m)) return time24;
  const period = h >= 12 ? "PM" : "AM";
  const displayH = h % 12 === 0 ? 12 : h % 12;
  return `${displayH}:${String(m).padStart(2, "0")} ${period}`;
}

export function getAutoPrintConfig(): AutoMorningPrintConfig {
  if (typeof window === "undefined") return DEFAULT_AUTO_PRINT_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_AUTO_PRINT_CONFIG;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_AUTO_PRINT_CONFIG,
      ...parsed,
    };
  } catch (err) {
    console.warn("Failed to load auto-print config from localStorage:", err);
    return DEFAULT_AUTO_PRINT_CONFIG;
  }
}

export function saveAutoPrintConfig(
  updates: Partial<AutoMorningPrintConfig>,
): AutoMorningPrintConfig {
  const current = getAutoPrintConfig();
  const updated: AutoMorningPrintConfig = {
    ...current,
    ...updates,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent("auto-morning-print-config-changed", { detail: updated }));
  } catch (err) {
    console.warn("Failed to save auto-print config to localStorage:", err);
  }
  return updated;
}

/**
 * Checks whether the morning print batch should trigger right now.
 * Returns true if:
 * 1. Automation is enabled
 * 2. It hasn't already run for today's calendar date
 * 3. The current time is at or past the scheduled morning time
 */
export function checkShouldTriggerNow(config = getAutoPrintConfig()): boolean {
  if (!config.enabled) return false;
  const today = getTodayIso();
  if (config.lastPrintedDate === today) return false;

  const current = getCurrentTime24();
  return current >= config.scheduledTime;
}

/**
 * Marks today's morning print run as completed in storage.
 */
export function markPrintedToday(): AutoMorningPrintConfig {
  const today = getTodayIso();
  return saveAutoPrintConfig({
    lastPrintedDate: today,
    lastTriggeredAt: new Date().toISOString(),
  });
}

/**
 * Clears the `lastPrintedDate` so technicians or supervisors can test
 * the auto-trigger workflow again today.
 */
export function resetTodayTrigger(): AutoMorningPrintConfig {
  return saveAutoPrintConfig({
    lastPrintedDate: null,
  });
}

/**
 * Dispatches an event to open the Morning Print modal.
 * If `autoPrint` is true, the dialog can immediately call `window.print()` once mounted.
 */
export function openMorningPrintDialog(autoPrint = false) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("open-morning-print-dialog", {
      detail: { autoPrint },
    }),
  );
}

/**
 * Synthesizes a gentle, crisp dual-tone morning chime (C5 -> E5) using Web Audio API.
 * Does not require external audio assets or network requests.
 */
export function playMorningChime() {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();

    osc1.type = "sine";
    osc1.frequency.setValueAtTime(523.25, now); // C5
    gain1.gain.setValueAtTime(0.2, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.5);

    // Second chime harmonic (E5)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(659.25, now + 0.18); // E5
    gain2.gain.setValueAtTime(0.25, now + 0.18);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.9);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.18);
    osc2.stop(now + 0.9);
  } catch (err) {
    console.debug("AudioContext error or blocked autoplay:", err);
  }
}

/**
 * Requests desktop notification permission if supported.
 */
export async function requestDesktopNotificationPermission(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission !== "denied") {
    const perm = await Notification.requestPermission();
    return perm === "granted";
  }
  return false;
}

/**
 * Sends a browser desktop notification for morning print dispatch.
 */
export function sendDesktopNotification(title: string, body: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission === "granted") {
    try {
      new Notification(title, {
        body,
        icon: "/favicon.ico",
        tag: "morning-print-dispatch",
      });
    } catch (e) {
      console.debug("Notification display error:", e);
    }
  }
}

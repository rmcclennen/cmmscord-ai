import { BellRing, Download } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { usePushNotifications, type PushState } from "@/hooks/use-push";
import { useInstallApp } from "@/components/pwa";
import { isIosDevice, isStandaloneDisplay } from "@/lib/pwa";

const HINT: Partial<Record<PushState, string>> = {
  unconfigured: "Push isn't set up on the server yet. An admin needs to add the VAPID keys.",
  blocked: "Notifications are blocked for this site. Allow them in your browser settings.",
};

/** Phone/computer notifications and "install the app" controls. */
export function PushSettings() {
  const { state, busy, error, enable, disable } = usePushNotifications();
  const { installed, canPrompt, isIos, install } = useInstallApp();

  const iosNeedsInstall =
    state === "unsupported" &&
    typeof navigator !== "undefined" &&
    isIosDevice(navigator.userAgent, navigator.maxTouchPoints) &&
    !isStandaloneDisplay();

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <BellRing className="size-4 text-primary" aria-hidden="true" />
            Push notifications on this device
          </div>
          <p className="text-xs text-muted-foreground">
            Instant alerts when work is assigned to you, even with the app closed. Free, no carrier
            or email setup.
          </p>
        </div>
        <Switch
          checked={state === "on"}
          disabled={busy || !(state === "on" || state === "off")}
          onCheckedChange={(on) => (on ? void enable() : void disable())}
          aria-label="Push notifications on this device"
        />
      </div>
      {HINT[state] && <p className="text-xs text-muted-foreground">{HINT[state]}</p>}
      {iosNeedsInstall && (
        <p className="text-xs text-muted-foreground">
          On iPhone and iPad, tap Share, then “Add to Home Screen”, open the app from there, and
          come back here to turn notifications on.
        </p>
      )}
      {state === "unsupported" && !iosNeedsInstall && (
        <p className="text-xs text-muted-foreground">This browser doesn't support push.</p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}

      {!installed && (canPrompt || isIos) && (
        <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
          <p className="text-xs text-muted-foreground">
            {canPrompt
              ? "Install AssetCareConnect as an app on this device."
              : "To install on iPhone: tap Share, then “Add to Home Screen”."}
          </p>
          {canPrompt && (
            <Button size="sm" variant="outline" onClick={() => void install()}>
              <Download className="mr-1.5 size-4" aria-hidden="true" /> Install
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

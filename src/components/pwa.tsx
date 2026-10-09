import { useCallback, useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  dismissInstallBanner,
  installBannerDismissed,
  isIosDevice,
  isStandaloneDisplay,
  shouldRegisterServiceWorker,
} from "@/lib/pwa";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/** Registers the service worker that makes the app load and work without signal. */
export function PwaRegister() {
  useEffect(() => {
    const ok = shouldRegisterServiceWorker({
      dev: import.meta.env.DEV,
      hostname: window.location.hostname,
      inIframe: window.self !== window.top,
      hasServiceWorker: "serviceWorker" in navigator,
    });
    if (!ok) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((e) => {
      console.warn("Service worker registration failed", e);
    });
  }, []);
  return null;
}

/** "Install app" state: Android/desktop Chrome use a native prompt; iPhone needs Share → Add to Home Screen. */
export function useInstallApp() {
  const [event, setEvent] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    setInstalled(isStandaloneDisplay());
    setIos(isIosDevice(navigator.userAgent, navigator.maxTouchPoints));
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setEvent(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!event) return false;
    await event.prompt();
    const choice = await event.userChoice;
    setEvent(null);
    return choice.outcome === "accepted";
  }, [event]);

  return { installed, canPrompt: event !== null, isIos: ios, install };
}

/** One-time, dismissible nudge for phones and tablets that haven't installed the app yet. */
export function InstallBanner() {
  const { installed, canPrompt, isIos, install } = useInstallApp();
  const [hidden, setHidden] = useState(true);

  useEffect(() => setHidden(installBannerDismissed()), []);

  if (installed || hidden || !(canPrompt || isIos)) return null;

  const close = () => {
    dismissInstallBanner();
    setHidden(true);
  };

  return (
    <div className="border-b border-primary/30 bg-primary/10 px-4 py-2.5 text-sm md:hidden">
      <div className="mx-auto flex max-w-[1600px] items-center gap-3">
        <Download className="size-4 shrink-0 text-primary" aria-hidden="true" />
        <p className="min-w-0 flex-1">
          {canPrompt ? (
            <>Install AssetCareConnect for one-tap access and offline use.</>
          ) : (
            <>
              Install on your iPhone: tap{" "}
              <Share className="mx-0.5 inline size-3.5" aria-label="Share" /> then{" "}
              <strong>Add to Home Screen</strong>.
            </>
          )}
        </p>
        {canPrompt && (
          <Button
            size="sm"
            className="h-9"
            onClick={async () => {
              if (await install()) setHidden(true);
            }}
          >
            Install
          </Button>
        )}
        <button
          type="button"
          onClick={close}
          aria-label="Dismiss install suggestion"
          className="flex size-9 items-center justify-center rounded-md hover:bg-primary/15"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

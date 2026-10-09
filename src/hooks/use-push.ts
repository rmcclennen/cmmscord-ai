import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getPushConfig, removePushSubscription, savePushSubscription } from "@/lib/push.functions";

export type PushState =
  | "loading"
  | "unsupported" // browser can't do push (or iPhone not installed to Home Screen)
  | "unconfigured" // server has no VAPID keys yet
  | "blocked" // user denied permission in the browser
  | "off"
  | "on";

function urlBase64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

const b64url = (buf: ArrayBuffer | null) =>
  buf
    ? btoa(String.fromCharCode(...new Uint8Array(buf)))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "")
    : "";

/** Turn push notifications on or off for this device. */
export function usePushNotifications() {
  const getConfig = useServerFn(getPushConfig);
  const save = useServerFn(savePushSubscription);
  const remove = useServerFn(removePushSubscription);
  const [state, setState] = useState<PushState>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    ) {
      setState("unsupported");
      return;
    }
    try {
      const { publicKey } = await getConfig();
      if (!publicKey) return setState("unconfigured");
      if (Notification.permission === "denied") return setState("blocked");
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      setState(sub ? "on" : "off");
    } catch {
      setState("off");
    }
  }, [getConfig]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const enable = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const { publicKey } = await getConfig();
      if (!publicKey) return setState("unconfigured");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return setState(permission === "denied" ? "blocked" : "off");
      const reg = await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToBytes(publicKey),
        }));
      await save({
        data: {
          endpoint: sub.endpoint,
          p256dh: b64url(sub.getKey("p256dh")),
          auth: b64url(sub.getKey("auth")),
          userAgent: navigator.userAgent.slice(0, 300),
        },
      });
      setState("on");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not turn on notifications");
      setState("off");
    } finally {
      setBusy(false);
    }
  }, [getConfig, save]);

  const disable = useCallback(async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await remove({ data: { endpoint: sub.endpoint } }).catch(() => {});
        await sub.unsubscribe();
      }
      setState("off");
    } finally {
      setBusy(false);
    }
  }, [remove]);

  return { state, busy, error, enable, disable };
}

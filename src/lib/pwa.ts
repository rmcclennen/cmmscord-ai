/** Helpers for the installable-app (PWA) features. Pure functions so they can be tested. */

/** Hosts where a service worker would just get in the way of the editor preview. */
export function isPreviewHost(hostname: string): boolean {
  return (
    /(^|\.)lovableproject\.com$/i.test(hostname) ||
    /^(id-)?preview--.+\.lovable\.app$/i.test(hostname)
  );
}

export function shouldRegisterServiceWorker(env: {
  dev: boolean;
  hostname: string;
  inIframe: boolean;
  hasServiceWorker: boolean;
}): boolean {
  return env.hasServiceWorker && !env.dev && !env.inIframe && !isPreviewHost(env.hostname);
}

export function isIosDevice(userAgent: string, maxTouchPoints = 0): boolean {
  // iPadOS 13+ reports itself as a Mac, so also check for touch support.
  return /iPad|iPhone|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
}

export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return window.matchMedia?.("(display-mode: standalone)").matches || iosStandalone;
}

export const INSTALL_DISMISSED_KEY = "cmms_install_banner_dismissed_at";
const DISMISS_FOR_MS = 14 * 24 * 60 * 60 * 1000;

export function installBannerDismissed(now = Date.now()): boolean {
  try {
    const at = Number(localStorage.getItem(INSTALL_DISMISSED_KEY));
    return Number.isFinite(at) && at > 0 && now - at < DISMISS_FOR_MS;
  } catch {
    return false;
  }
}

export function dismissInstallBanner(now = Date.now()) {
  try {
    localStorage.setItem(INSTALL_DISMISSED_KEY, String(now));
  } catch {
    /* private mode: it will simply show again */
  }
}

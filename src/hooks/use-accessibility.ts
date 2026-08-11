import { useState, useEffect, useCallback } from "react";

export type ThemeMode = "light" | "dark" | "high-contrast-dark" | "high-contrast-light";
export type TextSize = "normal" | "large" | "xlarge" | "xxlarge";

export interface AccessibilitySettings {
  themeMode: ThemeMode;
  textSize: TextSize;
  accessibleFont: boolean;
  underlineLinks: boolean;
  highlightInteractive: boolean;
  reduceMotion: boolean;
  largeCursor: boolean;
  readingGuide: boolean;
}

const STORAGE_KEY = "assetcareconnect_a11y_prefs_v1";

const DEFAULT_SETTINGS: AccessibilitySettings = {
  themeMode: "light",
  textSize: "normal",
  accessibleFont: false,
  underlineLinks: false,
  highlightInteractive: false,
  reduceMotion: false,
  largeCursor: false,
  readingGuide: false,
};

export function useAccessibility() {
  const [settings, setSettings] = useState<AccessibilitySettings>(() => {
    if (typeof window === "undefined") return DEFAULT_SETTINGS;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
      }
      // Check system reduced motion
      const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      // Check system dark mode
      const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
      return {
        ...DEFAULT_SETTINGS,
        reduceMotion: Boolean(prefersReducedMotion),
        themeMode: prefersDark ? "dark" : "light",
      };
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  const [announcement, setAnnouncement] = useState<string>("");
  const [readingGuideY, setReadingGuideY] = useState<number>(0);

  // Apply classes to document root
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;

    // Reset theme classes
    root.classList.remove("dark", "high-contrast-dark", "high-contrast-light");
    if (settings.themeMode === "dark") root.classList.add("dark");
    if (settings.themeMode === "high-contrast-dark")
      root.classList.add("dark", "high-contrast-dark");
    if (settings.themeMode === "high-contrast-light") root.classList.add("high-contrast-light");

    // Text scaling
    root.classList.remove("text-scale-115", "text-scale-130", "text-scale-150");
    if (settings.textSize === "large") root.classList.add("text-scale-115");
    if (settings.textSize === "xlarge") root.classList.add("text-scale-130");
    if (settings.textSize === "xxlarge") root.classList.add("text-scale-150");

    // Accessible font
    if (settings.accessibleFont) {
      root.classList.add("font-accessible");
    } else {
      root.classList.remove("font-accessible");
    }

    // Underline links
    if (settings.underlineLinks) {
      root.classList.add("underline-links");
    } else {
      root.classList.remove("underline-links");
    }

    // Highlight interactive
    if (settings.highlightInteractive) {
      root.classList.add("highlight-interactive");
    } else {
      root.classList.remove("highlight-interactive");
    }

    // Reduce motion
    if (settings.reduceMotion) {
      root.classList.add("reduce-motion");
    } else {
      root.classList.remove("reduce-motion");
    }

    // Large cursor
    if (settings.largeCursor) {
      root.classList.add("large-cursor");
    } else {
      root.classList.remove("large-cursor");
    }

    // Save to localStorage
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // ignore
    }
  }, [settings]);

  // Reading guide mouse tracker
  useEffect(() => {
    if (!settings.readingGuide) return;

    const handleMouseMove = (e: MouseEvent) => {
      setReadingGuideY(e.clientY);
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [settings.readingGuide]);

  const updateSetting = useCallback(
    <K extends keyof AccessibilitySettings>(key: K, value: AccessibilitySettings[K]) => {
      setSettings((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
  }, []);

  const announce = useCallback((message: string) => {
    setAnnouncement(message);
    // Auto-clear after 3 seconds so subsequent identical messages re-trigger
    setTimeout(() => setAnnouncement(""), 3000);
  }, []);

  return {
    settings,
    updateSetting,
    resetSettings,
    announcement,
    announce,
    readingGuideY,
  };
}

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAccessibility, type ThemeMode, type TextSize } from "@/hooks/use-accessibility";
import {
  Eye,
  Type,
  Sun,
  Moon,
  Sparkles,
  Contrast,
  Underline,
  MousePointer,
  RotateCcw,
  Volume2,
  CheckCircle2,
  ShieldCheck,
  ZapOff,
  Crosshair,
  Keyboard,
} from "lucide-react";

export function AccessibilityToolbar() {
  const [open, setOpen] = useState(false);
  const { settings, updateSetting, resetSettings, announcement, announce, readingGuideY } =
    useAccessibility();

  // Keyboard shortcut listener: Alt+A opens accessibility options
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === "a" || e.key === "A")) {
        e.preventDefault();
        setOpen((prev) => !prev);
        announce("Accessibility menu toggled");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [announce]);

  return (
    <>
      {/* Screen Reader Live Region for ADA compliance */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        id="a11y-status-announcer"
      >
        {announcement}
      </div>

      {/* Reading Guide Ruler line */}
      {settings.readingGuide && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed left-0 right-0 z-50 h-8 -translate-y-1/2 border-y-2 border-primary/60 bg-primary/10 transition-transform duration-75 ease-out"
          style={{ top: `${readingGuideY}px` }}
        />
      )}

      {/* Floating Accessibility Trigger Button */}
      <div className="fixed bottom-4 right-4 z-40 print:hidden">
        <Button
          id="accessibility-trigger-button"
          onClick={() => setOpen(true)}
          variant="secondary"
          size="sm"
          className="flex items-center gap-2 rounded-full border-2 border-primary bg-card px-3.5 py-2 font-semibold text-foreground shadow-lg hover:bg-primary hover:text-primary-foreground focus-visible:ring-4 focus-visible:ring-primary/50"
          aria-label="Accessibility settings & ADA accommodations (Shortcut: Alt + A)"
          aria-expanded={open}
          aria-haspopup="dialog"
        >
          <Eye className="size-4 text-primary" aria-hidden="true" />
          <span className="text-xs font-bold tracking-wide">ADA Accessibility</span>
          <Badge
            variant="outline"
            className="hidden border-primary/40 px-1 py-0 text-[10px] font-mono sm:inline-flex"
          >
            Alt+A
          </Badge>
        </Button>
      </div>

      {/* Accessibility Controls Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-h-[90vh] max-w-2xl overflow-y-auto p-6"
          aria-describedby="a11y-dialog-description"
        >
          <DialogHeader>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <ShieldCheck className="size-5" aria-hidden="true" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-bold">
                    ADA & WCAG 2.1 Accessibility Suite
                  </DialogTitle>
                  <p id="a11y-dialog-description" className="text-xs text-muted-foreground">
                    Customize contrast, typography, motion, and visual guides to match your needs.
                  </p>
                </div>
              </div>
              <Badge
                variant="outline"
                className="border-success/40 bg-success/10 text-success text-xs"
              >
                <CheckCircle2 className="mr-1 size-3" /> WCAG AAA Ready
              </Badge>
            </div>
          </DialogHeader>

          <div className="mt-4 space-y-6">
            {/* Color & Contrast Section */}
            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
                <Contrast className="size-4 text-primary" aria-hidden="true" />
                Color & Contrast Mode
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Select high-contrast modes engineered for visual clarity and sunlight legibility.
              </p>

              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  {
                    id: "light" as ThemeMode,
                    label: "Standard Light",
                    sub: "WCAG AAA 7:1",
                    icon: Sun,
                    bgClass: "bg-white text-slate-900 border-slate-300",
                  },
                  {
                    id: "dark" as ThemeMode,
                    label: "Deep Dark",
                    sub: "Eye-comfort",
                    icon: Moon,
                    bgClass: "bg-slate-900 text-white border-slate-700",
                  },
                  {
                    id: "high-contrast-dark" as ThemeMode,
                    label: "High Contrast Dark",
                    sub: "Yellow on Black",
                    icon: Sparkles,
                    bgClass: "bg-black text-yellow-300 border-yellow-400 font-bold",
                  },
                  {
                    id: "high-contrast-light" as ThemeMode,
                    label: "High Contrast Light",
                    sub: "Stark Black/White",
                    icon: Contrast,
                    bgClass: "bg-white text-black border-black font-bold",
                  },
                ].map((mode) => {
                  const active = settings.themeMode === mode.id;
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => {
                        updateSetting("themeMode", mode.id);
                        announce(`Theme changed to ${mode.label}`);
                      }}
                      className={`flex flex-col items-start rounded-lg border-2 p-2.5 text-left transition-all focus-visible:ring-2 focus-visible:ring-primary ${
                        active
                          ? "border-primary ring-2 ring-primary/40"
                          : "border-border hover:border-primary/50"
                      } ${mode.bgClass}`}
                    >
                      <div className="flex w-full items-center justify-between">
                        <mode.icon className="size-4" aria-hidden="true" />
                        {active && <CheckCircle2 className="size-3.5 text-primary" />}
                      </div>
                      <span className="mt-2 text-xs font-bold leading-tight">{mode.label}</span>
                      <span className="mt-0.5 text-[10px] opacity-80">{mode.sub}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Typography & Text Size */}
            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
                <Type className="size-4 text-primary" aria-hidden="true" />
                Text Scaling & Legibility
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Scale all typography proportionally without breaking layout grids.
              </p>

              <div className="mt-3 grid grid-cols-4 gap-2">
                {[
                  { id: "normal" as TextSize, label: "100%", sub: "Default" },
                  { id: "large" as TextSize, label: "115%", sub: "Large" },
                  { id: "xlarge" as TextSize, label: "130%", sub: "Extra Large" },
                  { id: "xxlarge" as TextSize, label: "150%", sub: "Jumbo" },
                ].map((size) => {
                  const active = settings.textSize === size.id;
                  return (
                    <button
                      key={size.id}
                      type="button"
                      onClick={() => {
                        updateSetting("textSize", size.id);
                        announce(`Text scale changed to ${size.label}`);
                      }}
                      className={`flex flex-col items-center justify-center rounded-lg border-2 p-2.5 transition-all focus-visible:ring-2 focus-visible:ring-primary ${
                        active
                          ? "border-primary bg-primary/10 font-bold text-primary ring-2 ring-primary/30"
                          : "border-border hover:bg-muted"
                      }`}
                    >
                      <span className="text-sm font-bold">{size.label}</span>
                      <span className="text-[10px] text-muted-foreground">{size.sub}</span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                <div>
                  <Label
                    htmlFor="dyslexic-font-toggle"
                    className="text-xs font-semibold text-foreground cursor-pointer"
                  >
                    Dyslexia-Friendly / Hyperlegible Typography
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    Increases letter spacing, distinct glyph shapes, and line height.
                  </p>
                </div>
                <Switch
                  id="dyslexic-font-toggle"
                  checked={settings.accessibleFont}
                  onCheckedChange={(val) => {
                    updateSetting("accessibleFont", val);
                    announce(val ? "Dyslexia font enabled" : "Dyslexia font disabled");
                  }}
                  aria-label="Toggle dyslexia-friendly font"
                />
              </div>
            </div>

            {/* Visual Guides & Interaction Accommodations */}
            <div className="rounded-lg border border-border bg-card p-4 space-y-4">
              <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
                <MousePointer className="size-4 text-primary" aria-hidden="true" />
                Visual Aids & Focus Assist
              </h3>

              {/* Underline Links */}
              <div className="flex items-center justify-between">
                <div>
                  <Label
                    htmlFor="underline-links-toggle"
                    className="text-xs font-semibold text-foreground cursor-pointer flex items-center gap-1.5"
                  >
                    <Underline className="size-3.5 text-primary" aria-hidden="true" />
                    Always Underline Links
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    Makes all hyperlinks visually distinct from normal body text.
                  </p>
                </div>
                <Switch
                  id="underline-links-toggle"
                  checked={settings.underlineLinks}
                  onCheckedChange={(val) => {
                    updateSetting("underlineLinks", val);
                    announce(val ? "Link underlines enabled" : "Link underlines disabled");
                  }}
                />
              </div>

              {/* Reading Guide Ruler */}
              <div className="flex items-center justify-between border-t border-border pt-3">
                <div>
                  <Label
                    htmlFor="reading-guide-toggle"
                    className="text-xs font-semibold text-foreground cursor-pointer flex items-center gap-1.5"
                  >
                    <Crosshair className="size-3.5 text-primary" aria-hidden="true" />
                    Reading Guide Ruler
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    Displays a soft horizontal highlight bar that follows your cursor.
                  </p>
                </div>
                <Switch
                  id="reading-guide-toggle"
                  checked={settings.readingGuide}
                  onCheckedChange={(val) => {
                    updateSetting("readingGuide", val);
                    announce(val ? "Reading guide ruler enabled" : "Reading guide ruler disabled");
                  }}
                />
              </div>

              {/* Highlight Clickable Elements */}
              <div className="flex items-center justify-between border-t border-border pt-3">
                <div>
                  <Label
                    htmlFor="highlight-interactive-toggle"
                    className="text-xs font-semibold text-foreground cursor-pointer flex items-center gap-1.5"
                  >
                    <Crosshair className="size-3.5 text-primary" aria-hidden="true" />
                    Highlight Clickable Elements
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    Outlines all buttons, inputs, and interactive controls with high-visibility
                    borders.
                  </p>
                </div>
                <Switch
                  id="highlight-interactive-toggle"
                  checked={settings.highlightInteractive}
                  onCheckedChange={(val) => {
                    updateSetting("highlightInteractive", val);
                    announce(
                      val ? "Interactive highlights enabled" : "Interactive highlights disabled",
                    );
                  }}
                />
              </div>

              {/* Reduce Motion */}
              <div className="flex items-center justify-between border-t border-border pt-3">
                <div>
                  <Label
                    htmlFor="reduce-motion-toggle"
                    className="text-xs font-semibold text-foreground cursor-pointer flex items-center gap-1.5"
                  >
                    <ZapOff className="size-3.5 text-primary" aria-hidden="true" />
                    Pause Animations & Motion
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    Stops animated transitions, flashing indicators, and smooth scrolling.
                  </p>
                </div>
                <Switch
                  id="reduce-motion-toggle"
                  checked={settings.reduceMotion}
                  onCheckedChange={(val) => {
                    updateSetting("reduceMotion", val);
                    announce(val ? "Motion reduced" : "Motion enabled");
                  }}
                />
              </div>

              {/* Big Cursor */}
              <div className="flex items-center justify-between border-t border-border pt-3">
                <div>
                  <Label
                    htmlFor="large-cursor-toggle"
                    className="text-xs font-semibold text-foreground cursor-pointer flex items-center gap-1.5"
                  >
                    <MousePointer className="size-3.5 text-primary" aria-hidden="true" />
                    High-Visibility Cursor
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    Enlarges pointer size for easier tracking on large plant monitors.
                  </p>
                </div>
                <Switch
                  id="large-cursor-toggle"
                  checked={settings.largeCursor}
                  onCheckedChange={(val) => {
                    updateSetting("largeCursor", val);
                    announce(val ? "Large cursor enabled" : "Large cursor disabled");
                  }}
                />
              </div>
            </div>

            {/* Keyboard Navigation Quick Guide */}
            <div className="rounded-lg border border-border bg-muted/40 p-4">
              <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <Keyboard className="size-4 text-primary" aria-hidden="true" />
                Section 508 Keyboard Navigation Shortcuts
              </h3>
              <div className="mt-2 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                <div className="flex items-center justify-between rounded bg-card px-2.5 py-1.5 border border-border">
                  <span className="text-muted-foreground">Toggle Accessibility</span>
                  <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] font-bold">
                    Alt + A
                  </kbd>
                </div>
                <div className="flex items-center justify-between rounded bg-card px-2.5 py-1.5 border border-border">
                  <span className="text-muted-foreground">Skip to Main Content</span>
                  <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] font-bold">
                    Tab on Page Load
                  </kbd>
                </div>
                <div className="flex items-center justify-between rounded bg-card px-2.5 py-1.5 border border-border">
                  <span className="text-muted-foreground">Navigate Next Element</span>
                  <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] font-bold">
                    Tab
                  </kbd>
                </div>
                <div className="flex items-center justify-between rounded bg-card px-2.5 py-1.5 border border-border">
                  <span className="text-muted-foreground">Close Dialogs & Modals</span>
                  <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] font-bold">
                    Esc
                  </kbd>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                resetSettings();
                announce("Accessibility settings reset to default");
              }}
              className="text-xs"
            >
              <RotateCcw className="mr-1.5 size-3.5" />
              Reset to Defaults
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={() => {
                setOpen(false);
                announce("Accessibility settings saved");
              }}
            >
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

import React from "react";
import { Badge } from "@/components/ui/badge";
import { systemMeta } from "@/lib/cmms";
import {
  FlaskConical,
  Hourglass,
  RotateCw,
  Disc,
  Layers,
  Grid,
  SunMedium,
  Wind,
  Flame,
  Repeat,
  Waves,
  ArrowDownToLine,
  Droplets,
  Pipette,
  ThermometerSnowflake,
  Gauge,
  Zap,
  ShieldAlert,
  Truck,
  Building,
  Cpu,
} from "lucide-react";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  FlaskConical,
  Hourglass,
  RotateCw,
  Disc,
  Layers,
  Grid,
  SunMedium,
  Wind,
  Flame,
  Repeat,
  Waves,
  ArrowDownToLine,
  Droplets,
  Pipette,
  ThermometerSnowflake,
  Gauge,
  Zap,
  ShieldAlert,
  Truck,
  Building,
  Cpu,
};

const COLOR_CLASSES: Record<string, { bg: string; text: string; border: string; badge: string }> = {
  purple: {
    bg: "bg-purple-500/10 dark:bg-purple-500/20",
    text: "text-purple-700 dark:text-purple-300",
    border: "border-purple-500/30",
    badge: "border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300",
  },
  indigo: {
    bg: "bg-indigo-500/10 dark:bg-indigo-500/20",
    text: "text-indigo-700 dark:text-indigo-300",
    border: "border-indigo-500/30",
    badge: "border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
  },
  amber: {
    bg: "bg-amber-500/10 dark:bg-amber-500/20",
    text: "text-amber-800 dark:text-amber-300",
    border: "border-amber-500/30",
    badge: "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300",
  },
  teal: {
    bg: "bg-teal-500/10 dark:bg-teal-500/20",
    text: "text-teal-700 dark:text-teal-300",
    border: "border-teal-500/30",
    badge: "border-teal-500/30 bg-teal-500/10 text-teal-700 dark:text-teal-300",
  },
  sky: {
    bg: "bg-sky-500/10 dark:bg-sky-500/20",
    text: "text-sky-700 dark:text-sky-300",
    border: "border-sky-500/30",
    badge: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  },
  stone: {
    bg: "bg-stone-500/10 dark:bg-stone-500/20",
    text: "text-stone-700 dark:text-stone-300",
    border: "border-stone-500/30",
    badge: "border-stone-500/30 bg-stone-500/10 text-stone-700 dark:text-stone-300",
  },
  blue: {
    bg: "bg-blue-500/10 dark:bg-blue-500/20",
    text: "text-blue-700 dark:text-blue-300",
    border: "border-blue-500/30",
    badge: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  },
  violet: {
    bg: "bg-violet-500/10 dark:bg-violet-500/20",
    text: "text-violet-700 dark:text-violet-300",
    border: "border-violet-500/30",
    badge: "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  },
  emerald: {
    bg: "bg-emerald-500/10 dark:bg-emerald-500/20",
    text: "text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-500/30",
    badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  orange: {
    bg: "bg-orange-500/10 dark:bg-orange-500/20",
    text: "text-orange-700 dark:text-orange-300",
    border: "border-orange-500/30",
    badge: "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300",
  },
  cyan: {
    bg: "bg-cyan-500/10 dark:bg-cyan-500/20",
    text: "text-cyan-700 dark:text-cyan-300",
    border: "border-cyan-500/30",
    badge: "border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
  },
  rose: {
    bg: "bg-rose-500/10 dark:bg-rose-500/20",
    text: "text-rose-700 dark:text-rose-300",
    border: "border-rose-500/30",
    badge: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  },
  slate: {
    bg: "bg-slate-500/10 dark:bg-slate-500/20",
    text: "text-slate-700 dark:text-slate-300",
    border: "border-slate-500/30",
    badge: "border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300",
  },
  zinc: {
    bg: "bg-zinc-500/10 dark:bg-zinc-500/20",
    text: "text-zinc-700 dark:text-zinc-300",
    border: "border-zinc-500/30",
    badge: "border-zinc-500/30 bg-zinc-500/10 text-zinc-700 dark:text-zinc-300",
  },
  red: {
    bg: "bg-red-500/10 dark:bg-red-500/20",
    text: "text-red-700 dark:text-red-300",
    border: "border-red-500/30",
    badge: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
  },
};

export interface SystemBadgeProps {
  system: string;
  size?: "sm" | "md" | "lg";
  showIcon?: boolean;
  className?: string;
  onClick?: () => void;
}

export function SystemBadge({
  system,
  size = "md",
  showIcon = true,
  className = "",
  onClick,
}: SystemBadgeProps) {
  const meta = systemMeta(system);
  const IconComponent = (meta.icon && ICON_MAP[meta.icon]) || Cpu;
  const color = COLOR_CLASSES[meta.color] ?? COLOR_CLASSES.slate;

  const sizeClasses = {
    sm: "text-[11px] px-1.5 py-0.5 gap-1",
    md: "text-xs px-2 py-0.5 gap-1.5",
    lg: "text-sm px-2.5 py-1 gap-2 font-semibold",
  }[size];

  const iconSizes = {
    sm: "size-3",
    md: "size-3.5",
    lg: "size-4",
  }[size];

  return (
    <Badge
      variant="outline"
      className={`inline-flex items-center font-medium ${color.badge} ${sizeClasses} ${
        onClick ? "cursor-pointer hover:opacity-80 transition-opacity" : ""
      } ${className}`}
      onClick={onClick}
      title={`System: ${system} (${meta.category})`}
    >
      {showIcon && <IconComponent className={`${iconSizes} shrink-0`} />}
      <span className="truncate">{system}</span>
    </Badge>
  );
}

export function getSystemIcon(iconName?: string) {
  return (iconName && ICON_MAP[iconName]) || Cpu;
}

export function getSystemColor(colorName?: string) {
  return COLOR_CLASSES[colorName ?? "slate"] ?? COLOR_CLASSES.slate;
}

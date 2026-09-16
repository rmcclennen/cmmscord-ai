import { useState } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSessionUser } from "@/hooks/use-session-user";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NotificationBell } from "@/components/notification-bell";
import { BulkAssetUploader } from "@/components/bulk-asset-uploader";
import { CompanyOnboardingDialog } from "@/components/company-onboarding-dialog";
import { AutoMorningPrintListener } from "@/components/auto-morning-print-listener";
import { openMorningPrintDialog } from "@/lib/auto-morning-print";
import {
  AlertTriangle,
  AlertOctagon,
  BarChart3,
  Boxes,
  CalendarClock,
  ClipboardList,
  FileText,
  LogOut,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Users,
  LayoutDashboard,
  UploadCloud,
  Building2,
  ChevronDown,
  MoreHorizontal,
  PackageSearch,
  Printer,
} from "lucide-react";
import type { ReactNode } from "react";

const PRIMARY_NAV = [
  { to: "/pm-schedule", label: "PM Schedule", icon: CalendarClock },
  { to: "/pm-due", label: "Due & Overdue", icon: AlertTriangle },
  { to: "/equipment-down", label: "Equipment Down", icon: AlertOctagon },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/work-orders", label: "Work Orders", icon: ClipboardList },
] as const;

const ASSET_NAV = [
  { to: "/assets", label: "Asset Registry", description: "View and manage equipment", icon: Boxes },
  { to: "/inventory", label: "Parts Inventory", description: "Stock and reorder parts", icon: PackageSearch },
  { to: "/part-requests", label: "Parts Requests", icon: ShoppingCart },
  { to: "/manuals", label: "Manuals", icon: FileText },
] as const;

const MORE_NAV = [
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/approvals", label: "Approvals", icon: ShieldCheck },
  { to: "/team", label: "Team", icon: Users },
  { to: "/company", label: "Company", icon: Building2 },
  { to: "/settings", label: "Alerts", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { user } = useSessionUser();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const [importOpen, setImportOpen] = useState(false);
  const [onboardOpen, setOnboardOpen] = useState(false);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <header
        role="banner"
        className="sticky top-0 z-30 border-b border-sidebar-border bg-sidebar text-sidebar-foreground"
      >
        <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-4 px-4">
          <Link
            to="/pm-schedule"
            className="flex items-center gap-2.5 rounded-md p-1 focus-visible:ring-2 focus-visible:ring-sidebar-primary"
            aria-label="AssetCareConnect Home"
          >
            <div className="flex size-7 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground font-black text-sm">
              AC
            </div>
            <span className="text-sm font-extrabold tracking-wide uppercase">AssetCareConnect</span>
          </Link>

          <nav
            role="navigation"
            aria-label="Main Navigation"
            className="hidden items-center gap-1 lg:flex"
          >
            {PRIMARY_NAV.map((item) => {
              const active = pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                  }`}
                >
                  <item.icon className="size-3.5" aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className={`h-8 gap-1.5 px-2.5 text-xs font-semibold ${
                    ASSET_NAV.some((item) => pathname.startsWith(item.to))
                      ? "border border-sidebar-border bg-sidebar-accent text-sidebar-primary"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                  }`}
                >
                  <Boxes className="size-3.5" aria-hidden="true" />
                  Assets
                  <ChevronDown className="size-3 opacity-60" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="w-72 border-sidebar-border bg-sidebar text-sidebar-foreground shadow-xl"
              >
                <DropdownMenuLabel className="px-3 py-2 text-[10px] font-bold uppercase text-sidebar-foreground/50">
                  Asset management
                </DropdownMenuLabel>
                {ASSET_NAV.map((item) => (
                  <DropdownMenuItem key={item.to} asChild className="cursor-pointer px-3 py-2.5 focus:bg-sidebar-accent focus:text-sidebar-accent-foreground">
                    <Link to={item.to} className="flex items-start gap-3">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-sidebar-accent">
                        <item.icon className="size-4 text-sidebar-primary" aria-hidden="true" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">{item.label}</span>
                        <span className="block text-[11px] text-sidebar-foreground/55">
                          {"description" in item ? item.description : item.label === "Parts Requests" ? "Request, bid, and order parts" : "Equipment documents and manuals"}
                        </span>
                      </span>
                    </Link>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator className="bg-sidebar-border" />
                <DropdownMenuItem
                  onSelect={() => setImportOpen(true)}
                  className="cursor-pointer px-3 py-2.5 font-semibold text-sidebar-primary focus:bg-sidebar-accent focus:text-sidebar-primary"
                >
                  <UploadCloud className="size-4" aria-hidden="true" />
                  Bulk Import Assets & Manuals
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className={`h-8 gap-1.5 px-2.5 text-xs font-semibold ${
                    MORE_NAV.some((item) => pathname.startsWith(item.to))
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                  }`}
                >
                  <MoreHorizontal className="size-3.5" aria-hidden="true" />
                  More
                  <ChevronDown className="size-3 opacity-60" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52 border-sidebar-border bg-sidebar text-sidebar-foreground">
                {MORE_NAV.map((item) => (
                  <DropdownMenuItem key={item.to} asChild className="cursor-pointer focus:bg-sidebar-accent focus:text-sidebar-accent-foreground">
                    <Link to={item.to}>
                      <item.icon className="size-4 text-sidebar-primary" aria-hidden="true" />
                      {item.label}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {/* Daily Morning Print Dispatch Trigger */}
            <Button
              size="sm"
              variant="outline"
              onClick={() => openMorningPrintDialog()}
              className="hidden md:inline-flex items-center gap-1.5 border-sidebar-border bg-sidebar-accent/40 text-sidebar-foreground text-xs font-bold hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              aria-label="Morning Maintenance Print Dispatch"
              title="Daily Morning Print Dispatch for PMs and Work Orders"
            >
              <Printer className="size-3.5 text-primary" aria-hidden="true" />
              <span>Morning Print</span>
            </Button>

            {/* Company Purchase / Plan Trigger */}
            <Button
              size="sm"
              onClick={() => setOnboardOpen(true)}
              className="hidden md:inline-flex items-center gap-1.5 bg-sidebar-primary text-sidebar-primary-foreground text-xs font-bold hover:bg-sidebar-primary/90"
              aria-label="View company purchasing and subscription plans"
            >
              <Building2 className="size-3.5" aria-hidden="true" />
              <span>Company Plans</span>
            </Button>

            <NotificationBell />

            <span className="hidden text-xs font-medium text-sidebar-foreground/75 xl:inline max-w-40 truncate">
              {user?.email}
            </span>

            <Button
              size="sm"
              variant="ghost"
              onClick={signOut}
              className="text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-xs"
              aria-label="Sign out of AssetCareConnect"
            >
              <LogOut className="size-3.5 sm:mr-1" aria-hidden="true" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>

        {/* Mobile Nav Bar */}
        <nav
          role="navigation"
          aria-label="Mobile Navigation"
          className="flex items-center gap-1 overflow-x-auto border-t border-sidebar-border px-3 py-1.5 lg:hidden"
        >
          {PRIMARY_NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`rounded-md px-2.5 py-1 text-xs font-bold whitespace-nowrap ${
                pathname.startsWith(item.to)
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/75 hover:text-sidebar-foreground"
              }`}
            >
              {item.label}
            </Link>
          ))}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" className="h-7 shrink-0 gap-1 px-2.5 text-xs font-bold text-sidebar-primary">
                Assets <ChevronDown className="size-3" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              {ASSET_NAV.map((item) => (
                <DropdownMenuItem key={item.to} asChild>
                  <Link to={item.to}>
                    <item.icon className="size-4" aria-hidden="true" />
                    {item.label}
                  </Link>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setImportOpen(true)}>
                <UploadCloud className="size-4" aria-hidden="true" />
                Bulk Import
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" className="h-7 shrink-0 gap-1 px-2.5 text-xs font-bold text-sidebar-foreground/75">
                More <ChevronDown className="size-3" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              {MORE_NAV.map((item) => (
                <DropdownMenuItem key={item.to} asChild>
                  <Link to={item.to}>
                    <item.icon className="size-4" aria-hidden="true" />
                    {item.label}
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>
      </header>

      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto max-w-[1600px] px-4 py-6 outline-none"
      >
        {children}
      </main>

      {/* Global In-App Asset Importer Dialog */}
      <BulkAssetUploader open={importOpen} onOpenChange={setImportOpen} />

      {/* Global In-App Company Plan Selector */}
      <CompanyOnboardingDialog
        open={onboardOpen}
        onOpenChange={setOnboardOpen}
        onLaunchUploader={() => setImportOpen(true)}
      />

      {/* Global In-App Automatic Morning Print Dispatch Scheduler & Dialog */}
      <AutoMorningPrintListener />
    </div>
  );
}

import { useState } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSessionUser } from "@/hooks/use-session-user";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/notification-bell";
import { BulkAssetUploader } from "@/components/bulk-asset-uploader";
import { CompanyOnboardingDialog } from "@/components/company-onboarding-dialog";
import {
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
} from "lucide-react";
import type { ReactNode } from "react";

const NAV = [
  { to: "/pm-schedule", label: "PM Schedule", icon: CalendarClock },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/assets", label: "Assets", icon: Boxes },
  { to: "/work-orders", label: "Work Orders", icon: ClipboardList },
  { to: "/inventory", label: "Inventory", icon: Boxes },
  { to: "/part-requests", label: "Parts Requests", icon: ShoppingCart },
  { to: "/manuals", label: "Manuals", icon: FileText },
  { to: "/approvals", label: "Approvals", icon: ShieldCheck },
  { to: "/team", label: "Team", icon: Users },
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
            {NAV.map((item) => {
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
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {/* Quick Bulk Asset Importer Trigger */}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setImportOpen(true)}
              className="hidden sm:inline-flex items-center gap-1.5 border-sidebar-border bg-sidebar-accent/40 text-sidebar-foreground text-xs font-bold hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              aria-label="Upload and bulk import company assets"
            >
              <UploadCloud className="size-3.5 text-sidebar-primary" aria-hidden="true" />
              <span>Bulk Import</span>
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
          {NAV.map((item) => (
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
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="rounded-md bg-sidebar-accent/50 px-2.5 py-1 text-xs font-bold text-sidebar-primary whitespace-nowrap hover:bg-sidebar-accent"
          >
            + Bulk Import
          </button>
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
    </div>
  );
}

import { Link, useRouterState } from "@tanstack/react-router";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSessionUser } from "@/hooks/use-session-user";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/notification-bell";

import { Waves, LayoutDashboard, Boxes, CalendarClock, ClipboardList, FileText, LogOut, Settings, ShieldCheck, ShoppingCart, Users } from "lucide-react";
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

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-sidebar-border bg-sidebar text-sidebar-foreground">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-6 px-4">
          <Link to="/pm-schedule" className="flex items-center gap-2">
            <Waves className="size-5 text-sidebar-primary" />
            <span className="text-sm font-bold tracking-wide uppercase">CMMSCord AI</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => {
              const active = pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                  }`}
                >
                  <item.icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <NotificationBell />
            <span className="hidden text-xs text-sidebar-foreground/70 sm:inline">{user?.email}</span>

            <Button
              size="sm"
              variant="ghost"
              onClick={signOut}
              className="text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <LogOut className="size-4" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
        <nav className="flex items-center gap-1 overflow-x-auto border-t border-sidebar-border px-3 py-1.5 md:hidden">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`rounded-md px-3 py-1 text-xs font-semibold whitespace-nowrap ${
                pathname.startsWith(item.to)
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-[1600px] px-4 py-6">{children}</main>
    </div>
  );
}

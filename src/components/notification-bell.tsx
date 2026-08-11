import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSessionUser } from "@/hooks/use-session-user";
import { safeAppLink } from "@/lib/notify";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Bell } from "lucide-react";

export function NotificationBell() {
  const { user } = useSessionUser();
  const queryClient = useQueryClient();

  const notes = useQuery({
    queryKey: ["notifications", user?.id],
    enabled: !!user?.id,
    refetchInterval: 60000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(25);
      if (error) throw error;
      return data ?? [];
    },
  });

  const markRead = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .is("read_at", null);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const unread = (notes.data ?? []).filter((n) => !n.read_at).length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          className="relative text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          aria-label="Notifications"
        >
          <Bell className="size-4" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <p className="label-caps">Notifications</p>
          {unread > 0 && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs"
              onClick={() => markRead.mutate()}
            >
              Mark all read
            </Button>
          )}
        </div>
        <div className="max-h-80 divide-y divide-border overflow-y-auto">
          {(notes.data ?? []).map((n) => {
            const link = safeAppLink(n.link);
            return (
              <div key={n.id} className={`px-3 py-2 ${n.read_at ? "" : "bg-accent/40"}`}>
                <p className="text-sm font-medium">{n.title}</p>
                {n.body && <p className="text-xs text-muted-foreground">{n.body}</p>}
                <div className="mt-1 flex items-center justify-between">
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {new Date(n.created_at).toLocaleString()}
                  </span>
                  {link && (
                    <a
                      href={link}
                      className="text-xs text-primary underline"
                      rel="noopener noreferrer"
                    >
                      Open
                    </a>
                  )}
                </div>
              </div>
            );
          })}

          {(notes.data ?? []).length === 0 && (
            <p className="px-3 py-4 text-sm text-muted-foreground">No notifications yet.</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

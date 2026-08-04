import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WorkOrderDialog } from "@/components/work-order-dialog";
import { dueTone, prettyLabel } from "@/lib/cmms";
import { useTeamMembers } from "@/hooks/use-team-members";
import { memberLabel, notifyUser } from "@/lib/notify";
import { toast } from "sonner";
import { CheckCircle2, Search } from "lucide-react";


const PAGE_SIZE = 40;
const today = () => new Date().toISOString().slice(0, 10);
const inDays = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

export const Route = createFileRoute("/_authenticated/pm-schedule")({
  head: () => ({
    meta: [
      { title: "PM Schedule | CMMSCord AI" },
      { name: "description", content: "Preventive maintenance schedule with overdue, due-soon, and upcoming tasks." },
      { property: "og:title", content: "PM Schedule" },
      { property: "og:description", content: "Track and complete preventive maintenance across the plant." },
    ],
  }),
  component: PmSchedulePage,
});

function PmSchedulePage() {
  const [search, setSearch] = useState("");
  const [window, setWindow] = useState("all");
  const [page, setPage] = useState(0);
  const queryClient = useQueryClient();
  const team = useTeamMembers();

  const assign = useMutation({
    mutationFn: async (pm: { id: string; title: string; next_due: string; userId: string | null }) => {
      const { error } = await supabase
        .from("pm_schedules")
        .update({ assigned_to: pm.userId })
        .eq("id", pm.id);
      if (error) throw error;
      if (pm.userId) {
        await notifyUser({
          userId: pm.userId,
          title: "PM task assigned to you",
          body: `${pm.title} · next due ${pm.next_due}`,
          link: "/pm-schedule",
        });
      }
    },
    onSuccess: () => {
      toast.success("PM assignment updated");
      queryClient.invalidateQueries({ queryKey: ["pms"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });


  const pms = useQuery({
    queryKey: ["pms", search, window, page],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const history = window === "history";
      let query = supabase
        .from("pm_schedules")
        .select("*, assets(id, name)", { count: "exact" })
        .eq("active", !history)
        .order("next_due", { ascending: !history })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      if (search.trim()) query = query.ilike("title", `%${search.trim()}%`);
      if (window === "overdue") query = query.lt("next_due", today());
      if (window === "week") query = query.gte("next_due", today()).lte("next_due", inDays(7));
      if (window === "month") query = query.gte("next_due", today()).lte("next_due", inDays(30));
      const { data, error, count } = await query;
      if (error) throw error;
      return { rows: data, count: count ?? 0 };
    },
  });

  const complete = useMutation({
    mutationFn: async (pm: { id: string; interval_days: number }) => {
      const next = new Date(Date.now() + pm.interval_days * 86400000).toISOString().slice(0, 10);
      const { error } = await supabase
        .from("pm_schedules")
        .update({ last_completed: today(), next_due: next })
        .eq("id", pm.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("PM marked complete and rescheduled");
      queryClient.invalidateQueries({ queryKey: ["pms"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const total = pms.data?.count ?? 0;
  const maxPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);

  return (
    <div className="space-y-5">
      <div>
        <p className="label-caps">Preventive maintenance</p>
        <h1 className="text-2xl font-bold">PM schedule</h1>
      </div>

      <div className="panel flex flex-wrap items-center gap-3 p-3">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search PM tasks…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
          />
        </div>
        <Select
          value={window}
          onValueChange={(v) => {
            setWindow(v);
            setPage(0);
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All active</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
            <SelectItem value="week">Next 7 days</SelectItem>
            <SelectItem value="month">Next 30 days</SelectItem>
          </SelectContent>
        </Select>
        <span className="font-mono text-xs text-muted-foreground">{total} schedules</span>
      </div>

      <div className="panel divide-y divide-border">
        {(pms.data?.rows ?? []).map((pm) => {
          const tone = dueTone(pm.next_due);
          return (
            <div key={pm.id} className="flex flex-wrap items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{pm.title}</p>
                <p className="text-xs text-muted-foreground">
                  {pm.assets ? (
                    <Link to="/assets/$assetId" params={{ assetId: pm.assets.id }} className="hover:underline">
                      {pm.assets.name}
                    </Link>
                  ) : (
                    "Unassigned asset"
                  )}
                  {" · every "}
                  {pm.interval_days} days · {prettyLabel(pm.priority)}
                </p>
                {pm.tasks && <p className="mt-1 text-xs text-muted-foreground">{pm.tasks}</p>}
              </div>
              <Badge
                variant={tone === "overdue" ? "destructive" : tone === "due" ? "secondary" : "outline"}
                className="font-mono"
              >
                {pm.next_due}
              </Badge>
              <Select
                value={pm.assigned_to ?? "unassigned"}
                onValueChange={(v) =>
                  assign.mutate({
                    id: pm.id,
                    title: pm.title,
                    next_due: pm.next_due,
                    userId: v === "unassigned" ? null : v,
                  })
                }
              >
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Send to…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {(team.data ?? []).map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {memberLabel(m)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <WorkOrderDialog
                assetId={pm.asset_id}
                pmScheduleId={pm.id}
                defaultTitle={pm.title}
                lockAsset
                trigger={
                  <Button size="sm" variant="outline">
                    Issue WO
                  </Button>
                }
              />
              <Button
                size="sm"
                variant="ghost"
                disabled={complete.isPending}
                onClick={() => complete.mutate({ id: pm.id, interval_days: pm.interval_days })}
              >
                <CheckCircle2 className="size-4" /> Complete
              </Button>
            </div>
          );
        })}
        {pms.isLoading && <p className="p-3 text-sm text-muted-foreground">Loading PM schedule…</p>}
        {!pms.isLoading && (pms.data?.rows ?? []).length === 0 && (
          <p className="p-3 text-sm text-muted-foreground">No PM schedules match this filter.</p>
        )}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          Page {page + 1} of {maxPage + 1}
        </span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <Button variant="outline" size="sm" disabled={page >= maxPage} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

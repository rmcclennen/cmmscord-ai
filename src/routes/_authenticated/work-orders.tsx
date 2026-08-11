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
import { DeleteRequestDialog } from "@/components/delete-request-dialog";
import { PartsLookupDialog } from "@/components/parts-lookup-dialog";
import { prettyLabel, WO_STATUSES } from "@/lib/cmms";
import { useTeamMembers } from "@/hooks/use-team-members";
import { memberLabel, notifyUser } from "@/lib/notify";
import { toast } from "sonner";
import { Plus, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/work-orders")({
  head: () => ({
    meta: [
      { title: "Work Orders | AssetCareConnect" },
      { name: "description", content: "Write, assign, and close plant maintenance work orders." },
      { property: "og:title", content: "Work Orders" },
      {
        property: "og:description",
        content: "Create and track corrective, preventive, and emergency work.",
      },
    ],
  }),
  component: WorkOrdersPage,
});

function WorkOrdersPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("active");
  const queryClient = useQueryClient();
  const team = useTeamMembers();

  const reassign = useMutation({
    mutationFn: async (wo: {
      id: string;
      wo_number: number;
      title: string;
      userId: string | null;
    }) => {
      const { error } = await supabase
        .from("work_orders")
        .update({ assigned_to: wo.userId })
        .eq("id", wo.id);
      if (error) throw error;
      if (wo.userId) {
        await notifyUser({
          userId: wo.userId,
          title: `WO-${wo.wo_number} assigned to you`,
          body: wo.title,
          link: "/work-orders",
        });
      }
    },
    onSuccess: () => {
      toast.success("Work order assignment updated");
      queryClient.invalidateQueries({ queryKey: ["work-orders"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const wos = useQuery({
    queryKey: ["work-orders", search, status],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let query = supabase
        .from("work_orders")
        .select("*, assets(id, name, manufacturer, manufacturer_url)")
        .order("created_at", { ascending: false })
        .limit(100);
      if (search.trim()) query = query.ilike("title", `%${search.trim()}%`);
      if (status === "active") query = query.in("status", ["open", "in_progress", "on_hold"]);
      else if (status !== "all") query = query.eq("status", status);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, next }: { id: string; next: string }) => {
      const { error } = await supabase
        .from("work_orders")
        .update({
          status: next,
          completed_at: next === "completed" ? new Date().toISOString() : null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Work order updated");
      queryClient.invalidateQueries({ queryKey: ["work-orders"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-caps">Maintenance work</p>
          <h1 className="text-2xl font-bold">Work orders</h1>
        </div>
        <WorkOrderDialog
          trigger={
            <Button>
              <Plus className="size-4" /> New work order
            </Button>
          }
        />
      </div>

      <div className="panel flex flex-wrap items-center gap-3 p-3">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search work orders…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="all">All</SelectItem>
            {WO_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {prettyLabel(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="panel divide-y divide-border">
        {(wos.data ?? []).map((wo) => (
          <div key={wo.id} className="flex flex-wrap items-center gap-3 p-3">
            <span className="font-mono text-xs text-muted-foreground">WO-{wo.wo_number}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{wo.title}</p>
              <p className="text-xs text-muted-foreground">
                {wo.assets ? (
                  <Link
                    to="/assets/$assetId"
                    params={{ assetId: wo.assets.id }}
                    className="hover:underline"
                  >
                    {wo.assets.name}
                  </Link>
                ) : (
                  "No asset"
                )}
                {" · "}
                {prettyLabel(wo.wo_type)} · {wo.due_date ? `due ${wo.due_date}` : "no due date"}
              </p>
              {wo.description && (
                <p className="mt-1 text-xs text-muted-foreground">{wo.description}</p>
              )}
              {wo.parts_used && (
                <div className="mt-2 rounded-md border border-border bg-muted/40 p-2">
                  <p className="label-caps text-[10px]">Parts</p>
                  <p className="whitespace-pre-line text-xs text-muted-foreground">
                    {wo.parts_used}
                  </p>
                </div>
              )}
            </div>

            <Badge
              variant={
                wo.priority === "critical" || wo.priority === "high" ? "destructive" : "outline"
              }
            >
              {prettyLabel(wo.priority)}
            </Badge>
            <Select value={wo.status} onValueChange={(next) => update.mutate({ id: wo.id, next })}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WO_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {prettyLabel(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={wo.assigned_to ?? "unassigned"}
              onValueChange={(v) =>
                reassign.mutate({
                  id: wo.id,
                  wo_number: wo.wo_number,
                  title: wo.title,
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
            <PartsLookupDialog
              workOrder={{
                id: wo.id,
                wo_number: wo.wo_number,
                title: wo.title,
                parts_used: wo.parts_used,
                assigned_to: wo.assigned_to,
                asset: wo.assets ?? null,
              }}
            />
            <DeleteRequestDialog
              entityType="work_order"
              entityId={wo.id}
              entityLabel={`WO-${wo.wo_number} ${wo.title}`}
            />
          </div>
        ))}
        {wos.isLoading && <p className="p-3 text-sm text-muted-foreground">Loading work orders…</p>}
        {!wos.isLoading && (wos.data ?? []).length === 0 && (
          <p className="p-3 text-sm text-muted-foreground">No work orders match this filter.</p>
        )}
      </div>
    </div>
  );
}

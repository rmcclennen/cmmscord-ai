import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMyRoles } from "@/hooks/use-my-roles";
import { ENTITY_LABELS, type DeletableEntity } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Check, ShieldCheck, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/approvals")({
  head: () => ({
    meta: [
      { title: "Deletion Approvals | AssetCareConnect" },
      {
        name: "description",
        content:
          "Review and approve requests to delete plant assets, PM schedules, and work orders.",
      },
      { property: "og:title", content: "Deletion Approvals" },
      {
        property: "og:description",
        content: "Manager and supervisor sign-off on every asset, PM, and work order deletion.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ApprovalsPage,
});

function ApprovalsPage() {
  const { isApprover } = useMyRoles();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("pending");
  const [notes, setNotes] = useState<Record<string, string>>({});

  const requests = useQuery({
    queryKey: ["deletion-requests", tab],
    queryFn: async () => {
      let query = supabase
        .from("deletion_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (tab === "pending") query = query.eq("status", "pending");
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const decide = useMutation({
    mutationFn: async ({ id, approve }: { id: string; approve: boolean }) => {
      const note = notes[id]?.trim();
      const { error } = await supabase.rpc("decide_deletion_request", {
        _request_id: id,
        _approve: approve,
        ...(note ? { _note: note } : {}),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Decision recorded");
      queryClient.invalidateQueries({ queryKey: ["deletion-requests"] });
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      queryClient.invalidateQueries({ queryKey: ["pm-schedules"] });
      queryClient.invalidateQueries({ queryKey: ["work-orders"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rows = requests.data ?? [];

  return (
    <div className="space-y-5">
      <div>
        <p className="label-caps">Change control</p>
        <h1 className="text-2xl font-bold">Deletion approvals</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Assets, PM schedules, and work orders can only be removed with manager or supervisor
          sign-off.
        </p>
      </div>

      {!isApprover && (
        <div className="panel flex items-center gap-2 p-3 text-sm text-muted-foreground">
          <ShieldCheck className="size-4" /> You can track requests here; only managers and
          supervisors can decide them.
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="all">All requests</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4">
          <div className="panel divide-y divide-border">
            {rows.map((req) => (
              <div key={req.id} className="flex flex-wrap items-center gap-3 p-3">
                <Badge variant="outline">
                  {ENTITY_LABELS[req.entity_type as DeletableEntity] ?? req.entity_type}
                </Badge>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{req.entity_label}</p>
                  <p className="text-xs text-muted-foreground">
                    Requested {new Date(req.created_at).toLocaleString()}
                    {req.reason ? ` · ${req.reason}` : ""}
                    {req.decision_note ? ` · note: ${req.decision_note}` : ""}
                  </p>
                </div>
                <Badge
                  variant={
                    req.status === "approved"
                      ? "default"
                      : req.status === "denied"
                        ? "destructive"
                        : "secondary"
                  }
                >
                  {req.status}
                </Badge>
                {req.status === "pending" && isApprover && (
                  <>
                    <Input
                      className="w-48"
                      placeholder="Decision note…"
                      value={notes[req.id] ?? ""}
                      onChange={(e) => setNotes((prev) => ({ ...prev, [req.id]: e.target.value }))}
                    />
                    <Button
                      size="sm"
                      disabled={decide.isPending}
                      onClick={() => decide.mutate({ id: req.id, approve: true })}
                    >
                      <Check className="size-4" /> Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={decide.isPending}
                      onClick={() => decide.mutate({ id: req.id, approve: false })}
                    >
                      <X className="size-4" /> Deny
                    </Button>
                  </>
                )}
              </div>
            ))}
            {requests.isLoading && (
              <p className="p-3 text-sm text-muted-foreground">Loading requests…</p>
            )}
            {!requests.isLoading && rows.length === 0 && (
              <p className="p-3 text-sm text-muted-foreground">No deletion requests here.</p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

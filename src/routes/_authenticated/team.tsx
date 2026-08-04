import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMyRoles } from "@/hooks/use-my-roles";
import { ROLE_OPTIONS, roleLabel, type AppRole } from "@/lib/roles";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ShieldCheck, UserCog, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({
    meta: [
      { title: "Team Roles | CMMSCord AI" },
      {
        name: "description",
        content: "Assign plant roles — manager, supervisor, lead operator, operator, electrician, maintenance.",
      },
      { property: "og:title", content: "Team Roles" },
      { property: "og:description", content: "Control who can approve deletions and who can only request them." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TeamPage,
});

function TeamPage() {
  const { canManageRoles } = useMyRoles();
  const queryClient = useQueryClient();

  const members = useQuery({
    queryKey: ["team-roles"],
    queryFn: async () => {
      const [{ data: directory, error: dirError }, { data: roles, error: roleError }] = await Promise.all([
        supabase.from("team_directory").select("id, full_name").order("full_name"),
        supabase.from("user_roles").select("id, user_id, role"),
      ]);
      if (dirError) throw dirError;
      if (roleError) throw roleError;
      return (directory ?? []).map((person) => ({
        ...person,
        roles: (roles ?? []).filter((r) => r.user_id === person.id),
      }));
    },
  });

  const addRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Role added");
      queryClient.invalidateQueries({ queryKey: ["team-roles"] });
      queryClient.invalidateQueries({ queryKey: ["my-roles"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeRole = useMutation({
    mutationFn: async (rowId: string) => {
      const { error } = await supabase.from("user_roles").delete().eq("id", rowId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Role removed");
      queryClient.invalidateQueries({ queryKey: ["team-roles"] });
      queryClient.invalidateQueries({ queryKey: ["my-roles"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-5">
      <div>
        <p className="label-caps">Access control</p>
        <h1 className="text-2xl font-bold">Team roles</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Managers and supervisors approve deletions. Lead operators, operators, electricians, and maintenance staff
          submit requests instead.
        </p>
      </div>

      {!canManageRoles && (
        <div className="panel flex items-center gap-2 p-3 text-sm text-muted-foreground">
          <ShieldCheck className="size-4" /> Only admins and managers can change roles.
        </div>
      )}

      <div className="panel divide-y divide-border">
        {(members.data ?? []).map((person) => (
          <div key={person.id} className="flex flex-wrap items-center gap-3 p-3">
            <UserCog className="size-4 text-muted-foreground" />
            <p className="min-w-40 flex-1 text-sm font-medium">{person.full_name ?? "Unnamed teammate"}</p>
            <div className="flex flex-wrap items-center gap-1.5">
              {person.roles.length === 0 && <span className="text-xs text-muted-foreground">No role</span>}
              {person.roles.map((r) => (
                <Badge key={r.id} variant="outline" className="gap-1">
                  {roleLabel(r.role)}
                  {canManageRoles && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-4"
                      aria-label={`Remove ${roleLabel(r.role)}`}
                      onClick={() => removeRole.mutate(r.id)}
                    >
                      <X className="size-3" />
                    </Button>
                  )}
                </Badge>
              ))}
            </div>
            {canManageRoles && (
              <Select
                value=""
                onValueChange={(role) => addRole.mutate({ userId: person.id, role: role as AppRole })}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Add role…" />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.filter((opt) => !person.roles.some((r) => r.role === opt.value)).map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label} — {opt.hint}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        ))}
        {members.isLoading && <p className="p-3 text-sm text-muted-foreground">Loading team…</p>}
      </div>
    </div>
  );
}

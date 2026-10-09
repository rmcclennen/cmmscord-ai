import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMyRoles } from "@/hooks/use-my-roles";
import { useTeamMembers } from "@/hooks/use-team-members";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AUDIT_ACTIONS, AUDIT_TABLES, summarizeChanges } from "@/lib/audit";

export const Route = createFileRoute("/_authenticated/audit-log")({
  head: () => ({ meta: [{ title: "Audit Log | AssetCareConnect" }] }),
  component: AuditLogPage,
});

const PAGE_SIZE = 50;

function AuditLogPage() {
  const { isApprover, loading: isLoading } = useMyRoles();
  const team = useTeamMembers();
  const [page, setPage] = useState(0);
  const [table, setTable] = useState("all");
  const [action, setAction] = useState("all");

  const log = useQuery({
    queryKey: ["audit-log", page, table, action],
    enabled: isApprover,
    queryFn: async () => {
      let q = supabase
        .from("audit_log")
        .select("*", { count: "exact" })
        .order("at", { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      if (table !== "all") q = q.eq("table_name", table);
      if (action !== "all") q = q.eq("action", action);
      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: data ?? [], count: count ?? 0 };
    },
  });

  if (!isLoading && !isApprover) {
    return (
      <p className="rounded-md border p-6 text-sm text-muted-foreground">
        The audit log is available to managers and supervisors.
      </p>
    );
  }

  const nameOf = (id: string | null) =>
    id ? (team.data?.find((m) => m.id === id)?.full_name ?? "Someone") : "System";
  const total = log.data?.count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <History className="size-5 text-primary" aria-hidden="true" />
        <h1 className="text-xl font-extrabold">Audit log</h1>
        <div className="ml-auto flex gap-2">
          <Select
            value={table}
            onValueChange={(v) => {
              setTable(v);
              setPage(0);
            }}
          >
            <SelectTrigger className="w-44" aria-label="Filter by record type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All records</SelectItem>
              {AUDIT_TABLES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={action}
            onValueChange={(v) => {
              setAction(v);
              setPage(0);
            }}
          >
            <SelectTrigger className="w-36" aria-label="Filter by action">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              {AUDIT_ACTIONS.map((a) => (
                <SelectItem key={a} value={a}>
                  {a.charAt(0) + a.slice(1).toLowerCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {log.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {log.error && <p className="text-sm text-destructive">Couldn't load the audit log.</p>}
      {log.data && log.data.rows.length === 0 && (
        <p className="text-sm text-muted-foreground">Nothing recorded yet.</p>
      )}

      <ul className="divide-y rounded-md border">
        {log.data?.rows.map((r) => (
          <li key={r.id} className="space-y-1 p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={r.action === "DELETE" ? "destructive" : "secondary"}>
                {r.action}
              </Badge>
              <span className="font-semibold">
                {AUDIT_TABLES.find((t) => t.value === r.table_name)?.label ?? r.table_name}
              </span>
              <span className="text-muted-foreground">by {nameOf(r.user_id)}</span>
              <time className="ml-auto text-xs text-muted-foreground" dateTime={r.at}>
                {new Date(r.at).toLocaleString()}
              </time>
            </div>
            <ul className="font-mono text-xs text-muted-foreground">
              {summarizeChanges(r.action, r.changes).map((line, i) => (
                <li key={i} className="break-words">
                  {line}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          Page {page + 1} of {pages} · {total} entries
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage(page - 1)}
          >
            Newer
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page + 1 >= pages}
            onClick={() => setPage(page + 1)}
          >
            Older
          </Button>
        </div>
      </div>
    </div>
  );
}

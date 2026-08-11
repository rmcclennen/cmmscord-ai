import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { signedPhotoUrls } from "@/lib/photos";
import {
  REQUEST_STATUSES,
  STATUS_LABEL,
  updateRequestOrder,
  updateRequestStatus,
  type PartRequestRow,
  type RequestStatus,
} from "@/lib/part-requests";
import { useMyRoles } from "@/hooks/use-my-roles";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PartRequestBids } from "@/components/part-request-bids";
import { SendPartsDialog } from "@/components/send-parts-dialog";
import { toast } from "sonner";
import { PackagePlus, PackageSearch, Send, ShoppingCart } from "lucide-react";

export const Route = createFileRoute("/_authenticated/part-requests")({
  head: () => ({
    meta: [
      { title: "Parts Requests | AssetCareConnect" },
      {
        name: "description",
        content:
          "Parts requests sent to supervisors and CMMS buyers, with photos, quotes, and ordering status.",
      },
      { property: "og:title", content: "Parts Requests" },
      {
        property: "og:description",
        content: "Send needed parts to be ordered or bid out, with photos attached.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PartRequestsPage,
});

const STATUS_TONE: Record<string, string> = {
  requested: "default",
  bidding: "secondary",
  ordered: "secondary",
  received: "outline",
  cancelled: "outline",
};

function RequestPhotos({ paths }: { paths: string[] }) {
  const { data } = useQuery({
    queryKey: ["part-request-photos", paths],
    enabled: paths.length > 0,
    queryFn: () => signedPhotoUrls(paths),
  });
  if (paths.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {paths.map((p) => {
        const url = data?.[p];
        return url ? (
          <a key={p} href={url} target="_blank" rel="noopener noreferrer">
            <img
              src={url}
              alt="Photo attached to the parts request"
              loading="lazy"
              className="size-20 rounded-md border border-border object-cover"
            />
          </a>
        ) : (
          <div key={p} className="size-20 animate-pulse rounded-md bg-muted" />
        );
      })}
    </div>
  );
}

function HandleDialog({ request }: { request: PartRequestRow }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<RequestStatus>("bidding");
  const [vendor, setVendor] = useState(request.vendor ?? "");
  const [cost, setCost] = useState(request.quoted_cost != null ? String(request.quoted_cost) : "");
  const [note, setNote] = useState("");
  const [awardedVendor, setAwardedVendor] = useState(request.awarded_vendor ?? "");
  const [awardedCost, setAwardedCost] = useState(
    request.awarded_cost != null ? String(request.awarded_cost) : "",
  );
  const [lead, setLead] = useState(
    request.lead_time_days != null ? String(request.lead_time_days) : "",
  );
  const [po, setPo] = useState(request.po_number ?? "");
  const [expected, setExpected] = useState(request.expected_date ?? "");
  const queryClient = useQueryClient();

  const save = useMutation({
    mutationFn: async () => {
      await updateRequestStatus({ id: request.id, status, vendor, quotedCost: cost, note });
      await updateRequestOrder({
        id: request.id,
        awardedVendor,
        awardedCost,
        leadTimeDays: lead,
        poNumber: po,
        expectedDate: expected,
        status,
      });
    },
    onSuccess: () => {
      toast.success(`Marked ${STATUS_LABEL[status].toLowerCase()}`);
      queryClient.invalidateQueries({ queryKey: ["part-requests"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["part-request-bids", request.id] });
      setOpen(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Update
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Update parts request</DialogTitle>
          <DialogDescription>{request.title}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as RequestStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REQUEST_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="vendor">Vendor / supplier</Label>
              <Input id="vendor" value={vendor} onChange={(e) => setVendor(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cost">Quoted cost</Label>
              <Input
                id="cost"
                inputMode="decimal"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
              />
            </div>
          </div>
          <div className="rounded-md border border-border p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Award & order details
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="awardedVendor">Who won the bid</Label>
                <Input
                  id="awardedVendor"
                  value={awardedVendor}
                  onChange={(e) => setAwardedVendor(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="awardedCost">Awarded cost</Label>
                <Input
                  id="awardedCost"
                  inputMode="decimal"
                  value={awardedCost}
                  onChange={(e) => setAwardedCost(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lead">Lead time (days)</Label>
                <Input
                  id="lead"
                  inputMode="numeric"
                  value={lead}
                  onChange={(e) => setLead(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="po">PO number</Label>
                <Input id="po" value={po} onChange={(e) => setPo(e.target.value)} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="expected">Expected arrival</Label>
                <Input
                  id="expected"
                  type="date"
                  value={expected}
                  onChange={(e) => setExpected(e.target.value)}
                />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="note">Note back to the requester</Label>
            <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
          </div>
          <Button onClick={() => save.mutate()} disabled={save.isPending} className="w-full">
            {save.isPending ? "Saving…" : "Save & notify requester"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PartRequestsPage() {
  const [tab, setTab] = useState<string>("open");
  const { isApprover } = useMyRoles();

  const { data, isLoading } = useQuery({
    queryKey: ["part-requests"],
    queryFn: async (): Promise<PartRequestRow[]> => {
      const { data, error } = await supabase
        .from("part_requests")
        .select(
          "id, title, part_lines, note, priority, needed_by, status, route_to, vendor, quoted_cost, decision_note, photo_paths, created_at, requested_by, sent_to, work_order_id, awarded_vendor, awarded_cost, lead_time_days, po_number, expected_date, ordered_at, received_at, work_orders(id, wo_number, title), assets(id, name)",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PartRequestRow[];
    },
  });

  const rows = useMemo(() => {
    const all = data ?? [];
    if (tab === "all") return all;
    if (tab === "open")
      return all.filter(
        (r) => r.status === "requested" || r.status === "bidding" || r.status === "ordered",
      );
    return all.filter((r) => r.status === tab);
  }, [data, tab]);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Parts Requests</h1>
          <p className="text-sm text-muted-foreground">
            Parts sent to supervisors and CMMS coordinators to be ordered or bid out — photos
            included.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SendPartsDialog
            trigger={
              <Button className="gap-1.5 font-bold shadow-sm">
                <PackagePlus className="size-4" /> Send parts to supervisor / coordinator
              </Button>
            }
          />
          <Button variant="outline" asChild>
            <Link to="/work-orders">
              <PackageSearch className="size-4" /> From work order
            </Link>
          </Button>
        </div>
      </header>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="open">Open</TabsTrigger>
          {REQUEST_STATUSES.map((s) => (
            <TabsTrigger key={s} value={s}>
              {STATUS_LABEL[s]}
            </TabsTrigger>
          ))}
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading && <p className="text-sm text-muted-foreground">Loading requests…</p>}
      {!isLoading && rows.length === 0 && (
        <div className="panel p-8 text-center text-sm text-muted-foreground">
          <ShoppingCart className="mx-auto mb-2 size-6" />
          No parts requests here yet. Open a work order, run Parts lookup, then send the list to
          supervisors.
        </div>
      )}

      <div className="space-y-3">
        {rows.map((r) => (
          <article key={r.id} className="panel space-y-2 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold">{r.title}</h2>
                <p className="text-xs text-muted-foreground">
                  {[
                    r.assets?.name,
                    r.work_orders ? `WO-${r.work_orders.wo_number}` : null,
                    r.needed_by ? `Needed by ${r.needed_by}` : null,
                    r.route_to === "coordinator"
                      ? "Sent to CMMS coordinator"
                      : r.route_to === "supervisor"
                        ? "Sent to supervisor"
                        : r.route_to === "supervisors"
                          ? "Sent to all supervisors & coordinators"
                          : "Sent to a teammate",
                    new Date(r.created_at).toLocaleDateString(),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant={
                    (STATUS_TONE[r.status] ?? "outline") as "default" | "secondary" | "outline"
                  }
                >
                  {STATUS_LABEL[r.status as RequestStatus] ?? r.status}
                </Badge>
                {isApprover && <HandleDialog request={r} />}
              </div>
            </div>
            <pre className="whitespace-pre-wrap font-sans text-sm text-foreground">
              {r.part_lines}
            </pre>
            {r.note && <p className="text-xs text-muted-foreground">{r.note}</p>}
            {(r.vendor || r.quoted_cost != null || r.decision_note) && (
              <p className="text-xs text-muted-foreground">
                {[r.vendor, r.quoted_cost != null ? `$${r.quoted_cost}` : null, r.decision_note]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
            <RequestPhotos paths={r.photo_paths ?? []} />
            {(r.status === "bidding" ||
              r.status === "ordered" ||
              r.status === "received" ||
              isApprover) && <PartRequestBids request={r} canManage={isApprover} />}
          </article>
        ))}
      </div>
    </div>
  );
}

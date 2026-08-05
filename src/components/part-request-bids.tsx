import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addBid,
  awardBid,
  deleteBid,
  listBids,
  type PartRequestBid,
  type PartRequestRow,
} from "@/lib/part-requests";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Trophy, Trash2, Plus, Truck } from "lucide-react";

const money = (v: number | null) =>
  v == null ? null : `$${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

/** Bids collected for a parts request plus who won, for how much, and lead time. */
export function PartRequestBids({
  request,
  canManage,
}: {
  request: PartRequestRow;
  canManage: boolean;
}) {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [vendor, setVendor] = useState("");
  const [amount, setAmount] = useState("");
  const [lead, setLead] = useState("");
  const [contact, setContact] = useState("");

  const { data: bids } = useQuery({
    queryKey: ["part-request-bids", request.id],
    queryFn: () => listBids(request.id),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["part-request-bids", request.id] });
    queryClient.invalidateQueries({ queryKey: ["part-requests"] });
  };

  const create = useMutation({
    mutationFn: () =>
      addBid({ requestId: request.id, vendor, amount, leadTimeDays: lead, contact }),
    onSuccess: () => {
      toast.success("Bid logged");
      setVendor("");
      setAmount("");
      setLead("");
      setContact("");
      setAdding(false);
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const award = useMutation({
    mutationFn: (bid: PartRequestBid) => awardBid(bid),
    onSuccess: () => {
      toast.success("Bid awarded");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteBid(id),
    onSuccess: refresh,
    onError: (error: Error) => toast.error(error.message),
  });

  const rows = bids ?? [];
  const hasOrder =
    request.awarded_vendor ||
    request.awarded_cost != null ||
    request.lead_time_days != null ||
    request.po_number ||
    request.expected_date;

  return (
    <div className="space-y-3 rounded-md border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Truck className="size-3.5" /> Bids & order tracking
        </h3>
        {canManage && (
          <Button size="sm" variant="ghost" onClick={() => setAdding((v) => !v)}>
            <Plus className="size-4" /> Log a bid
          </Button>
        )}
      </div>

      {hasOrder && (
        <div className="grid gap-2 rounded-md bg-muted/50 p-2 text-xs sm:grid-cols-2">
          {request.awarded_vendor && (
            <p>
              <span className="text-muted-foreground">Won by </span>
              <span className="font-medium">{request.awarded_vendor}</span>
            </p>
          )}
          {request.awarded_cost != null && (
            <p>
              <span className="text-muted-foreground">Awarded cost </span>
              <span className="font-medium">{money(request.awarded_cost)}</span>
            </p>
          )}
          {request.lead_time_days != null && (
            <p>
              <span className="text-muted-foreground">Lead time </span>
              <span className="font-medium">{request.lead_time_days} days</span>
            </p>
          )}
          {request.po_number && (
            <p>
              <span className="text-muted-foreground">PO </span>
              <span className="font-medium">{request.po_number}</span>
            </p>
          )}
          {request.expected_date && (
            <p>
              <span className="text-muted-foreground">Expected </span>
              <span className="font-medium">{request.expected_date}</span>
            </p>
          )}
          {request.ordered_at && (
            <p className="text-muted-foreground">
              Ordered {new Date(request.ordered_at).toLocaleDateString()}
            </p>
          )}
          {request.received_at && (
            <p className="text-muted-foreground">
              Received {new Date(request.received_at).toLocaleDateString()}
            </p>
          )}
        </div>
      )}

      {adding && (
        <div className="grid gap-2 sm:grid-cols-4">
          <div className="space-y-1">
            <Label className="text-xs">Vendor</Label>
            <Input value={vendor} onChange={(e) => setVendor(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Amount</Label>
            <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Lead time (days)</Label>
            <Input inputMode="numeric" value={lead} onChange={(e) => setLead(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Contact</Label>
            <Input value={contact} onChange={(e) => setContact(e.target.value)} />
          </div>
          <Button
            size="sm"
            className="sm:col-span-4"
            disabled={!vendor.trim() || create.isPending}
            onClick={() => create.mutate()}
          >
            {create.isPending ? "Saving…" : "Save bid"}
          </Button>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">No bids logged yet.</p>
      ) : (
        <ul className="space-y-1">
          {rows.map((b) => (
            <li
              key={b.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 px-2 py-1.5 text-xs"
            >
              <span className="min-w-0">
                <span className="font-medium">{b.vendor}</span>
                {[
                  money(b.amount),
                  b.lead_time_days != null ? `${b.lead_time_days} day lead` : null,
                  b.contact,
                ]
                  .filter(Boolean)
                  .map((t) => (
                    <span key={String(t)} className="text-muted-foreground">
                      {" · "}
                      {t}
                    </span>
                  ))}
              </span>
              <span className="flex items-center gap-1">
                {b.is_winner && (
                  <Badge variant="default" className="gap-1">
                    <Trophy className="size-3" /> Winner
                  </Badge>
                )}
                {canManage && !b.is_winner && (
                  <Button size="sm" variant="ghost" onClick={() => award.mutate(b)}>
                    Award
                  </Button>
                )}
                {canManage && (
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Remove bid from ${b.vendor}`}
                    onClick={() => remove.mutate(b.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

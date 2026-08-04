import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { lookupAssetParts, type PartsLookupResult } from "@/lib/parts.functions";
import { useTeamMembers } from "@/hooks/use-team-members";
import { memberLabel, notifyUser } from "@/lib/notify";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import { toast } from "sonner";
import { ExternalLink, PackageSearch, Send } from "lucide-react";

type Part = PartsLookupResult["parts"][number];

function googleUrl(part: Part, assetName: string) {
  const q = part.search_terms?.trim() || [part.manufacturer, part.part_number, part.name, assetName].filter(Boolean).join(" ");
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}

function vendorUrl(part: Part, manufacturerUrl: string | null) {
  if (!manufacturerUrl) return null;
  try {
    const host = new URL(manufacturerUrl.startsWith("http") ? manufacturerUrl : `https://${manufacturerUrl}`).hostname;
    const q = [part.part_number, part.name].filter(Boolean).join(" ");
    return `https://www.google.com/search?q=${encodeURIComponent(`site:${host} ${q}`)}`;
  } catch {
    return null;
  }
}

function partLine(part: Part) {
  return [part.qty ? `${part.qty} ×` : null, part.name, part.part_number ? `(P/N ${part.part_number})` : null, part.manufacturer]
    .filter(Boolean)
    .join(" ");
}

export function PartsLookupDialog({
  workOrder,
  trigger,
}: {
  workOrder: {
    id: string;
    wo_number: number;
    title: string;
    parts_used: string | null;
    assigned_to: string | null;
    asset: { id: string; name: string; manufacturer: string | null; manufacturer_url: string | null } | null;
  };
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [need, setNeed] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [recipient, setRecipient] = useState<string>("none");
  const [result, setResult] = useState<PartsLookupResult | null>(null);
  const queryClient = useQueryClient();
  const team = useTeamMembers();
  const runLookup = useServerFn(lookupAssetParts);

  const asset = workOrder.asset;

  const lookup = useMutation({
    mutationFn: async () => {
      if (!asset) throw new Error("Attach an asset to this work order first.");
      return runLookup({ data: { assetId: asset.id, need: need.trim() || workOrder.title } });
    },
    onSuccess: (data) => {
      setResult(data);
      setSelected(Object.fromEntries(data.parts.map((_, i) => [String(i), true])));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const chosen = (result?.parts ?? []).filter((_, i) => selected[String(i)]);

  const submit = useMutation({
    mutationFn: async () => {
      if (chosen.length === 0) throw new Error("Select at least one part.");
      const lines = chosen.map((p) => `• ${partLine(p)}`).join("\n");
      const next = [workOrder.parts_used?.trim(), `Parts needed:\n${lines}`].filter(Boolean).join("\n\n");
      const { error } = await supabase.from("work_orders").update({ parts_used: next }).eq("id", workOrder.id);
      if (error) throw error;

      if (recipient !== "none") {
        await notifyUser({
          userId: recipient,
          title: `Parts needed — WO-${workOrder.wo_number}`,
          body: `${workOrder.title}${asset ? ` (${asset.name})` : ""}\n${lines}`,
          link: "/work-orders",
        });
      }
    },
    onSuccess: () => {
      toast.success(recipient === "none" ? "Parts added to work order" : "Parts request sent");
      queryClient.invalidateQueries({ queryKey: ["work-orders"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      setOpen(false);
      setResult(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm">
            <PackageSearch className="size-4" /> Parts
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Parts lookup — WO-{workOrder.wo_number}</DialogTitle>
          <DialogDescription>
            {asset
              ? `Find replacement parts for ${asset.name}, then send the list to whoever orders parts.`
              : "This work order has no asset attached, so parts can't be looked up."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="need">What's needed?</Label>
          <div className="flex gap-2">
            <Input
              id="need"
              placeholder={workOrder.title}
              value={need}
              onChange={(e) => setNeed(e.target.value)}
            />
            <Button onClick={() => lookup.mutate()} disabled={!asset || lookup.isPending}>
              {lookup.isPending ? "Searching…" : "Look up parts"}
            </Button>
          </div>
        </div>

        {result && (
          <div className="space-y-4">
            {result.notes && <p className="text-xs text-muted-foreground">{result.notes}</p>}
            <div className="panel divide-y divide-border">
              {result.parts.map((part, i) => {
                const vendor = vendorUrl(part, asset?.manufacturer_url ?? null);
                return (
                  <div key={i} className="flex items-start gap-3 p-3">
                    <Checkbox
                      checked={!!selected[String(i)]}
                      onCheckedChange={(v) => setSelected((s) => ({ ...s, [String(i)]: v === true }))}
                      className="mt-1"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{part.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {[part.part_number ? `P/N ${part.part_number}` : null, part.manufacturer, part.qty, part.where_to_buy]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-3 text-xs">
                        <a
                          href={googleUrl(part, asset?.name ?? "")}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          Google <ExternalLink className="size-3" />
                        </a>
                        {vendor && (
                          <a
                            href={vendor}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                          >
                            Manufacturer site <ExternalLink className="size-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {result.parts.length === 0 && (
                <p className="p-3 text-sm text-muted-foreground">No parts identified for this request.</p>
              )}
            </div>

            {result.sources.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {result.sources.map((s, i) => (
                  <a key={i} href={s.url} target="_blank" rel="noopener noreferrer">
                    <Badge variant="outline" className="gap-1">
                      {s.title} <ExternalLink className="size-3" />
                    </Badge>
                  </a>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-56 flex-1 space-y-2">
                <Label>Send request to</Label>
                <Select value={recipient} onValueChange={setRecipient}>
                  <SelectTrigger>
                    <SelectValue placeholder="Nobody — just save to WO" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Just save to work order</SelectItem>
                    {(team.data ?? []).map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {memberLabel(m)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => submit.mutate()} disabled={submit.isPending || chosen.length === 0}>
                <Send className="size-4" />
                {submit.isPending ? "Sending…" : `Send ${chosen.length} part${chosen.length === 1 ? "" : "s"}`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

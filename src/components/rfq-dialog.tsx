import * as React from "react";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { createPartRequest } from "@/lib/part-requests";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Copy, FileText, Printer, Send } from "lucide-react";

export type RfqAsset = {
  id?: string | null;
  name: string;
  serial_number?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  notes?: string | null;
};

export type RfqWorkOrder = {
  id?: string | null;
  wo_number?: number | null;
  title?: string;
  description?: string | null;
};

type Props = {
  asset?: RfqAsset | null;
  workOrder?: RfqWorkOrder | null;
  quotedCost?: number | null | undefined;
  trigger?: React.ReactNode | undefined;
};

function buildBody(v: {
  equipment: string;
  serial: string;
  mfrModel: string;
  workNeeded: string;
  estCost: string;
  neededBy: string;
  notes: string;
}) {
  const lines = [
    `EQUIPMENT: ${v.equipment || "—"}`,
    v.serial ? `SERIAL NUMBER: ${v.serial}` : null,
    v.mfrModel ? `MANUFACTURER / MODEL: ${v.mfrModel}` : null,
    `WORK NEEDED (repair / replace): ${v.workNeeded || "—"}`,
    v.estCost ? `ESTIMATED COST: $${v.estCost}` : null,
    v.neededBy ? `NEEDED BY: ${v.neededBy}` : null,
    v.notes ? `NOTES: ${v.notes}` : null,
    "",
    `Please quote this equipment need — reply with price and lead time.`,
  ].filter(Boolean);
  return lines.join("\n");
}

/**
 * Auto-populated RFQ: pulls the equipment's serial number, what needs repaired
 * or replaced, and an estimated cost — every field editable before sending,
 * printing, or copying for a vendor.
 */
export function RfqDialog({ asset, workOrder, quotedCost, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [equipment, setEquipment] = useState("");
  const [serial, setSerial] = useState("");
  const [mfrModel, setMfrModel] = useState("");
  const [workNeeded, setWorkNeeded] = useState("");
  const [estCost, setEstCost] = useState("");
  const [neededBy, setNeededBy] = useState("");
  const [notes, setNotes] = useState("");
  const [body, setBody] = useState("");
  const [seeded, setSeeded] = useState(false);

  // Prefill once the dialog opens, from the asset/work-order data on hand.
  const seed = () => {
    const mfrModelDefault = [asset?.manufacturer, asset?.model].filter(Boolean).join(" ");
    const workDefault =
      workOrder?.description?.trim() ||
      asset?.notes?.trim() ||
      workOrder?.title?.trim() ||
      "";
    const t = `RFQ: ${workOrder?.title || `Repair parts for ${asset?.name ?? "equipment"}`}`;
    setTitle(t);
    setEquipment(asset?.name ?? "");
    setSerial(asset?.serial_number ?? "");
    setMfrModel(mfrModelDefault);
    setWorkNeeded(workDefault);
    setEstCost(quotedCost != null && quotedCost > 0 ? String(quotedCost) : "");
    setNeededBy("");
    setNotes(workOrder?.wo_number ? `Work order: WO-${workOrder.wo_number}` : "");
    setBody(
      buildBody({
        equipment: asset?.name ?? "",
        serial: asset?.serial_number ?? "",
        mfrModel: mfrModelDefault,
        workNeeded: workDefault,
        estCost: quotedCost != null && quotedCost > 0 ? String(quotedCost) : "",
        neededBy: "",
        notes: workOrder?.wo_number ? `Work order: WO-${workOrder.wo_number}` : "",
      }),
    );
    setSeeded(true);
  };

  const regenerated = useMemo(
    () =>
      buildBody({
        equipment,
        serial,
        mfrModel,
        workNeeded,
        estCost,
        neededBy,
        notes,
      }),
    [equipment, serial, mfrModel, workNeeded, estCost, neededBy, notes],
  );

  const preview = seeded ? body : regenerated;
  const applyField = (field: string, value: string) => {
    setBody((prev) => {
      const lines = prev.split("\n");
      const idx = lines.findIndex((l) => l.startsWith(`${field}:`));
      if (idx >= 0) lines[idx] = `${field}: ${value}`;
      return lines.join("\n");
    });
  };

  const send = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error("Give the RFQ a title.");
      if (!preview.trim()) throw new Error("Nothing to send — add the details first.");
      const assetId = asset?.id ?? null;
      const woId = workOrder?.id ?? null;
      if (assetId) {
        const { data } = await supabase
          .from("assets")
          .select("id")
          .eq("id", assetId)
          .maybeSingle();
        if (!data) throw new Error("This equipment was removed — reload the page.");
      }
      await createPartRequest({
        title: title.trim(),
        partLines: preview.trim(),
        note: notes.trim() || null,
        priority: "medium",
        routeTo: "supervisors",
        workOrderId: woId,
        assetId,
      });
    },
    onSuccess: () => {
      toast.success("RFQ sent to supervisors & buyers for quoting");
      queryClient.invalidateQueries({ queryKey: ["part-requests"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      setOpen(false);
      setSeeded(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${title}\n\n${preview}`);
      toast.success("RFQ copied — paste it into an email to a vendor");
    } catch {
      toast.error("Couldn't copy — select the text manually.");
    }
  };

  const print = () => {
    const win = window.open("", "_blank", "width=800,height=700");
    if (!win) {
      toast.error("Allow pop-ups to print the RFQ.");
      return;
    }
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    win.document.write(`<!doctype html><html><head><title>${esc(title)}</title>
      <style>body{font-family:Arial,Helvetica,sans-serif;margin:1in;color:#111}
      h1{font-size:18px;margin-bottom:4px} .meta{color:#666;font-size:12px;margin-bottom:20px}
      pre{font-family:inherit;font-size:13px;white-space:pre-wrap;line-height:1.6}
      </style></head><body>
      <h1>${esc(title)}</h1>
      <div class="meta">Request for Quote · AssetCareConnect · ${new Date().toLocaleDateString()}</div>
      <pre>${esc(preview)}</pre>
      <script>window.onload = function () { window.print(); };</script>
      </body></html>`);
    win.document.close();
  };

  const editField = (
    label: string,
    field: string,
    value: string,
    onChange: (v: string) => void,
    id: string,
  ) => (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          applyField(field, e.target.value);
        }}
      />
    </div>
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v && !seeded) seed();
        if (!v) setSeeded(false);
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
            <FileText className="size-3.5" /> Generate RFQ
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Generate RFQ</DialogTitle>
          <DialogDescription>
            Auto-filled from the equipment record and work order — serial number, what needs
            repaired or replaced, and estimated cost. Everything is editable before you send it.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="rfq-title">RFQ subject *</Label>
            <Input
              id="rfq-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          {editField("Equipment", "EQUIPMENT", equipment, setEquipment, "rfq-equipment")}
          {editField("Serial number", "SERIAL NUMBER", serial, setSerial, "rfq-serial")}
          {editField(
            "Manufacturer / model",
            "MANUFACTURER / MODEL",
            mfrModel,
            setMfrModel,
            "rfq-mfr",
          )}
          {editField("Estimated cost ($)", "ESTIMATED COST", estCost, setEstCost, "rfq-cost")}
          {editField("Needed by", "NEEDED BY", neededBy, setNeededBy, "rfq-needed")}
          {editField("Notes", "NOTES", notes, setNotes, "rfq-notes")}
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="rfq-work">What needs repaired or replaced</Label>
            <Textarea
              id="rfq-work"
              rows={3}
              value={workNeeded}
              onChange={(e) => {
                setWorkNeeded(e.target.value);
                applyField("WORK NEEDED (repair / replace)", e.target.value);
              }}
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="rfq-body">RFQ text (final, editable)</Label>
            <Textarea
              id="rfq-body"
              rows={9}
              className="font-mono text-xs"
              value={preview}
              onChange={(e) => {
                setSeeded(true);
                setBody(e.target.value);
              }}
            />
          </div>
        </div>

        <DialogFooter className="flex-wrap gap-2 sm:gap-0">
          <Button variant="ghost" size="sm" onClick={copy}>
            <Copy className="size-3.5" /> Copy
          </Button>
          <Button variant="outline" size="sm" onClick={print}>
            <Printer className="size-3.5" /> Print / PDF
          </Button>
          <Button size="sm" onClick={() => send.mutate()} disabled={send.isPending}>
            <Send className="size-3.5" />
            {send.isPending ? "Sending…" : "Send for quoting"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

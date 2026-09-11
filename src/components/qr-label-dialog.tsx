import * as React from "react";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Printer, QrCode } from "lucide-react";

export type QrLabelAsset = {
  id: string;
  name: string;
  tag_number?: string | null;
  location_name?: string | null;
  building?: string | null;
};

function labelHtml(asset: QrLabelAsset, qrDataUrl: string, scanUrl: string) {
  const sub = [asset.tag_number, asset.building, asset.location_name]
    .filter(Boolean)
    .join(" · ");
  return `
  <div class="label">
    <div class="info">
      <div class="brand">AssetCareConnect</div>
      <div class="name">${asset.name}</div>
      ${sub ? `<div class="sub">${sub}</div>` : ""}
      <div class="scan">Scan for history, PMs &amp; manuals</div>
      <div class="url">${scanUrl.replace(/^https?:\/\//, "")}</div>
    </div>
    <img class="qr" src="${qrDataUrl}" alt="QR code for ${asset.name}" />
  </div>`;
}

export function printQrLabels(assets: QrLabelAsset[]) {
  const origin = window.location.origin;
  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) {
    toast.error("Allow pop-ups to print labels.");
    return;
  }
  const cards = assets.map(
    (a) => labelHtml(a, qrCache.current[a.id] ?? "", `${origin}/assets/${a.id}`),
  );
  win.document.write(`<!doctype html><html><head><title>Asset QR Labels</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; margin: 0.25in; }
    .label { width: 3.4in; height: 2in; border: 1px solid #333; border-radius: 6px;
      display: flex; align-items: center; gap: 10px; padding: 10px; margin: 0 8px 8px 0;
      page-break-inside: avoid; float: left; }
    .info { flex: 1; min-width: 0; }
    .brand { font-size: 8px; letter-spacing: 1px; text-transform: uppercase; color: #555; }
    .name { font-size: 14px; font-weight: bold; margin-top: 2px; }
    .sub { font-size: 10px; color: #444; margin-top: 2px; }
    .scan { font-size: 9px; color: #666; margin-top: 8px; }
    .url { font-size: 8px; color: #999; word-break: break-all; margin-top: 2px; }
    .qr { width: 1.2in; height: 1.2in; }
    @media print { .label { border: 1px dashed #999; } }
  </style></head><body>${cards.join("")}
  <script>window.onload = function () { window.print(); };</script>
  </body></html>`);
  win.document.close();
}

/** Cache of generated QR data URLs so print and preview share them. */
const qrCache = React.createRef<{ [id: string]: string }>().current ?? ({} as { [id: string]: string });
const store: { [id: string]: string } = qrCache;

export function useQrCodes(assets: QrLabelAsset[], enabled: boolean) {
  const [urls, setUrls] = useState<{ [id: string]: string }>({});
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const origin = window.location.origin;
    (async () => {
      const next: { [id: string]: string } = {};
      for (const a of assets.slice(0, 60)) {
        try {
          const url = await QRCode.toDataURL(`${origin}/assets/${a.id}`, {
            margin: 1,
            width: 220,
          });
          next[a.id] = url;
          store[a.id] = url;
        } catch {
          // skip a failed code rather than blocking the rest
        }
      }
      if (!cancelled) setUrls(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [assets, enabled]);
  return urls;
}

type Props = {
  assets: QrLabelAsset[];
  title?: string;
  trigger?: React.ReactNode | undefined;
};

/** Shows a QR label preview for one or more assets, with a print button. */
export function QrLabelDialog({ assets, title, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const urls = useQrCodes(assets, open);

  const print = () => {
    if (assets.some((a) => !store[a.id])) {
      toast.error("Still generating codes — try again in a second.");
      return;
    }
    printQrLabels(assets);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
            <QrCode className="size-3.5" /> QR label
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{title ?? "Equipment QR label"}</DialogTitle>
          <DialogDescription>
            Print this label and stick it on the equipment. Scanning it with a phone opens that
            asset's history, PMs, and manuals.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          {assets.slice(0, 8).map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-3 rounded-lg border border-border p-3"
            >
              <div className="flex-1 overflow-hidden">
                <p className="label-caps text-[9px]">AssetCareConnect</p>
                <p className="truncate text-sm font-bold">{a.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {[a.tag_number, a.building, a.location_name].filter(Boolean).join(" · ")}
                </p>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Scan for history, PMs &amp; manuals
                </p>
              </div>
              {urls[a.id] ? (
                <img src={urls[a.id]} alt={`QR code for ${a.name}`} className="size-20 shrink-0" />
              ) : (
                <div className="size-20 shrink-0 animate-pulse rounded-md bg-muted" />
              )}
            </div>
          ))}
        </div>
        <Button onClick={print} disabled={Object.keys(urls).length === 0}>
          <Printer className="size-4" /> Print {assets.length > 1 ? `${assets.length} labels` : "label"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

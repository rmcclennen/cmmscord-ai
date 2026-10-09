import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TabsContent } from "@/components/ui/tabs";
import { manualList } from "@/lib/cmms";
import { ManualDialog } from "@/components/manual-dialog";
import { ManufacturerManualSearch } from "@/components/manufacturer-manual-search";
import { ExternalLink, FileText, Plus, Search, Trash2, Zap } from "lucide-react";
import type { AssetCtx } from "./use-asset-detail";

export function ManualsTab({ ctx }: { ctx: AssetCtx }) {
  const {
    a,
    deleteManualMutation,
    manuals,
    openGoogleManualSearch,
    setScanManualDialogOpen,
    setSelectedManualForScan,
  } = ctx;
  return (
    <TabsContent value="manuals" className="mt-4 space-y-4">
      {/* Manufacturer Manual Search & Direct Model Links Component */}
      <ManufacturerManualSearch asset={a} />

      <div className="panel p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-3">
          <div>
            <p className="label-caps text-foreground flex items-center gap-1.5">
              <FileText className="size-4 text-primary" /> Attached O&amp;M Manuals (
              {manuals.data?.length ?? 0})
            </p>
            <p className="text-xs text-muted-foreground">
              Official manufacturer O&amp;M manuals, cut sheets, and technical drawings attached to{" "}
              {a.name}.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 font-semibold text-xs border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
              onClick={() =>
                window.open(
                  `https://www.google.com/search?q=${encodeURIComponent(
                    [a.manufacturer || a.make || "", a.model || "", a.name, "O&M manual pdf"]
                      .filter(Boolean)
                      .join(" "),
                  )}`,
                  "_blank",
                  "noopener,noreferrer",
                )
              }
              title="Open a Google search for this equipment's manual"
            >
              <Search className="size-3.5 text-amber-500" /> Scan for manual
            </Button>

            <ManualDialog
              assetId={a.id}
              lockAsset
              trigger={
                <Button variant="outline" size="sm" className="gap-1.5 font-medium">
                  <Plus className="size-4 text-primary" /> Add manual or link
                </Button>
              }
            />
          </div>
        </div>

        <ul className="mt-3 divide-y divide-border/60 text-sm">
          {(manuals.data ?? []).map((m) => (
            <li key={m.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <a
                    href={m.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-primary hover:underline inline-flex items-center gap-1.5 text-sm"
                  >
                    <FileText className="size-4 text-blue-500 shrink-0" />
                    {m.title}
                    <ExternalLink className="size-3 text-muted-foreground" />
                  </a>
                  {m.kind && (
                    <Badge
                      variant="outline"
                      className="text-[10px] uppercase font-mono px-1.5 py-0"
                    >
                      {m.kind}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {m.manufacturer && (
                    <span className="font-medium text-foreground">{m.manufacturer} · </span>
                  )}
                  {m.notes || "Attached document"}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1 text-xs border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                  onClick={() => {
                    setSelectedManualForScan({
                      id: m.id,
                      title: m.title,
                      url: m.file_url,
                    });
                    setScanManualDialogOpen(true);
                  }}
                  title="Scan this manual with AI to extract PMs into the PM schedule"
                >
                  <Zap className="size-3.5 text-amber-500" />
                  Scan for PMs
                </Button>
                <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" asChild>
                  <a href={m.file_url} target="_blank" rel="noreferrer">
                    <ExternalLink className="size-3.5" /> View
                  </a>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 p-2 text-destructive hover:bg-destructive/10"
                  disabled={deleteManualMutation.isPending}
                  onClick={() => {
                    if (confirm(`Remove "${m.title}" from this asset?`)) {
                      deleteManualMutation.mutate(m.id);
                    }
                  }}
                  title="Remove manual from asset"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </li>
          ))}
          {(manuals.data ?? []).length === 0 && (
            <li className="py-6 text-center text-xs text-muted-foreground">
              <FileText className="size-8 mx-auto text-muted-foreground/40 mb-2" />
              No manuals attached yet. Upload a file, add a web link, or use "Scan for manual" to
              search Google for this equipment.
            </li>
          )}
        </ul>

        {manualList(a.manuals).length > 0 && (
          <div className="mt-4 border-t border-border pt-3">
            <p className="label-caps">Nameplate Document References</p>
            <ul className="mt-1 space-y-1 text-xs text-muted-foreground font-mono">
              {manualList(a.manuals).map((m) => (
                <li key={m} className="flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-primary/60" /> {m}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Google manual search shortcut */}
      <div className="panel p-4 bg-muted/20 border-primary/30 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="label-caps text-primary flex items-center gap-1.5">
            <Search className="size-4" /> Find a manual
          </p>
          <p className="text-xs text-muted-foreground">
            Opens a Google search for {a.manufacturer || a.make || "this equipment"}{" "}
            {a.model ? `model ${a.model}` : ""} manuals, then add the link you find above.
          </p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          className="gap-1.5 text-xs font-semibold"
          onClick={openGoogleManualSearch}
        >
          <Search className="size-3.5 text-primary" /> Scan for manual
        </Button>
      </div>
    </TabsContent>
  );
}

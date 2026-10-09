import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TabsContent } from "@/components/ui/tabs";
import { EditAssetPartsDialog } from "@/components/edit-asset-parts-dialog";
import { frequencyToDays } from "@/lib/cmms";
import { SendPartsDialog } from "@/components/send-parts-dialog";
import {
  AlertTriangle,
  CalendarPlus,
  ExternalLink,
  Globe,
  Plus,
  Search,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react";
import type { AssetCtx } from "./use-asset-detail";

export function MaintenanceTab({ ctx }: { ctx: AssetCtx }) {
  const { a, addPms, deletePartMutation, info, intervals, lookup, mfgPortalInfo, parts } = ctx;
  return (
    <TabsContent value="maintenance" className="mt-4 space-y-4">
      <div className="panel flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <p className="text-sm font-medium">Manufacturer maintenance lookup</p>
          <p className="text-xs text-muted-foreground">
            Pulls published O&amp;M intervals, wear parts, and manual links for this make/model.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(a.manufacturer_url || mfgPortalInfo.website) && (
            <a
              href={a.manufacturer_url || mfgPortalInfo.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
            >
              <Globe className="size-3.5" />
              {mfgPortalInfo.name} Site <ExternalLink className="size-3" />
            </a>
          )}
          {mfgPortalInfo.companySearchUrl && (
            <a
              href={mfgPortalInfo.companySearchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground hover:underline"
            >
              <Search className="size-3" />
              Search {mfgPortalInfo.name} <ExternalLink className="size-3" />
            </a>
          )}
          <Button onClick={() => lookup.mutate()} disabled={lookup.isPending}>
            <Sparkles className="size-4" />
            {lookup.isPending
              ? "Researching…"
              : info.data
                ? "Refresh data"
                : "Look up maintenance info"}
          </Button>
        </div>
      </div>

      {info.data ? (
        <div className="space-y-4">
          <div className="panel p-4">
            <p className="label-caps">Summary</p>
            <p className="mt-1 text-sm">{info.data.summary}</p>
          </div>

          {intervals.length > 0 && (
            <div className="panel p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="label-caps">Recommended intervals</p>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={addPms.isPending}
                  onClick={() => addPms.mutate(intervals)}
                >
                  <CalendarPlus className="size-4" />
                  Add all to PM schedule
                </Button>
              </div>
              <ul className="mt-2 divide-y divide-border">
                {intervals.map((i, idx) => (
                  <li key={idx} className="py-2">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-sm font-medium">{i.task}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-primary">{i.frequency}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={addPms.isPending}
                          onClick={() => addPms.mutate([i])}
                        >
                          <CalendarPlus className="size-4" />
                          Add PM
                        </Button>
                      </div>
                    </div>
                    {i.notes && <p className="mt-0.5 text-xs text-muted-foreground">{i.notes}</p>}
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Every {frequencyToDays(i.frequency)} days
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="panel p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <p className="label-caps">Wear &amp; spare parts</p>
                <Badge variant="secondary" className="text-xs">
                  {parts.length}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <EditAssetPartsDialog
                  assetId={a.id}
                  assetName={a.name}
                  manufacturer={a.manufacturer}
                  model={a.model}
                  currentParts={parts}
                  defaultTab="feedback"
                  trigger={
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1 text-xs text-amber-600 hover:bg-amber-500/10 dark:text-amber-400"
                    >
                      <AlertTriangle className="size-3.5" />
                      Not the right parts?
                    </Button>
                  }
                />
                <EditAssetPartsDialog
                  assetId={a.id}
                  assetName={a.name}
                  manufacturer={a.manufacturer}
                  model={a.model}
                  currentParts={parts}
                  defaultTab="manage"
                  trigger={
                    <Button size="sm" variant="outline" className="gap-1 text-xs">
                      <Plus className="size-3" /> Edit / Add parts
                    </Button>
                  }
                />
                {parts.length > 0 && (
                  <SendPartsDialog
                    asset={{ id: a.id, name: a.name, manufacturer: a.manufacturer }}
                    lockAsset
                    trigger={
                      <Button size="sm" variant="outline" className="gap-1 text-xs">
                        <Send className="size-3 text-primary" /> Request all parts
                      </Button>
                    }
                  />
                )}
              </div>
            </div>

            {parts.length > 0 ? (
              <ul className="mt-3 divide-y divide-border">
                {parts.map((p, idx) => (
                  <li
                    key={idx}
                    className="flex flex-wrap items-center justify-between gap-3 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">{p.name}</span>
                        {p.part_number ? (
                          <span className="font-mono text-xs text-primary font-medium">
                            P/N: {p.part_number}
                          </span>
                        ) : (
                          <span className="text-xs italic text-muted-foreground">No OEM P/N</span>
                        )}
                      </div>
                      {p.notes && <p className="mt-0.5 text-xs text-muted-foreground">{p.notes}</p>}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <SendPartsDialog
                        asset={{ id: a.id, name: a.name, manufacturer: a.manufacturer }}
                        lockAsset
                        initialPart={{
                          name: p.name,
                          part_number: p.part_number,
                          manufacturer: a.manufacturer,
                          qty: 1,
                        }}
                        trigger={
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs font-semibold text-primary hover:bg-primary/10"
                          >
                            <Send className="size-3 mr-1" /> Send to coordinator
                          </Button>
                        }
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => deletePartMutation.mutate(idx)}
                        disabled={deletePartMutation.isPending}
                        title="Delete part (not right for this asset)"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-3 rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                <p>No parts stored for this asset.</p>
                <p className="mt-1">
                  Click "Edit / Add parts" to add custom items or "Not the right parts?" to research
                  with custom equipment specs.
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No manufacturer data stored yet for this asset. Run a lookup to pull it in.
        </p>
      )}
    </TabsContent>
  );
}

import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TabsContent } from "@/components/ui/tabs";
import { classLabel } from "@/lib/cmms";
import { SystemBadge } from "@/components/system-badge";
import { ChevronRight, Layers } from "lucide-react";
import type { AssetCtx } from "./use-asset-detail";

export function SystemTab({ ctx }: { ctx: AssetCtx }) {
  const { a, resolvedSystem, systemSiblings } = ctx;
  return (
    <TabsContent value="system" className="mt-4 space-y-4">
      <div className="panel p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <SystemBadge system={resolvedSystem} size="lg" />
              <Badge variant="outline" className="text-xs">
                {systemSiblings.length} Equipment Unit{systemSiblings.length === 1 ? "" : "s"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground pt-1">
              All interconnected machinery, feed lines, drives, and components operating together
              within the <span className="font-semibold text-foreground">{resolvedSystem}</span>.
            </p>
          </div>
          <Button asChild variant="outline" size="sm" className="gap-1.5 font-semibold text-xs">
            <Link to="/assets" search={{ system: resolvedSystem }}>
              <Layers className="size-3.5 text-primary" /> View All in Asset Register
            </Link>
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          {systemSiblings.map((sibling) => {
            const isCurrent = sibling.id === a.id;
            return (
              <div
                key={sibling.id}
                className={`rounded-lg border p-3.5 transition-all flex flex-col justify-between gap-3 ${
                  isCurrent
                    ? "border-primary/60 bg-primary/5 shadow-xs ring-1 ring-primary/30"
                    : "border-border bg-card/60 hover:bg-muted/40 hover:border-primary/40"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {isCurrent ? (
                        <span className="font-bold text-sm text-foreground">{sibling.name}</span>
                      ) : (
                        <Link
                          to="/assets/$assetId"
                          params={{ assetId: sibling.id }}
                          className="font-bold text-sm text-foreground hover:text-primary hover:underline transition-colors"
                        >
                          {sibling.name}
                        </Link>
                      )}
                      {isCurrent && (
                        <Badge className="bg-primary text-primary-foreground text-[10px] h-4 px-1.5 font-semibold">
                          Current Asset
                        </Badge>
                      )}
                    </div>
                    {sibling.tag_number && (
                      <p className="font-mono text-xs text-muted-foreground mt-0.5">
                        Tag: {sibling.tag_number}
                      </p>
                    )}
                  </div>
                  <Badge variant="outline" className="text-[11px] shrink-0">
                    {classLabel(sibling.class)}
                  </Badge>
                </div>

                <div className="text-xs text-muted-foreground space-y-1 border-t border-border/50 pt-2 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span>Make/Model: </span>
                    <span className="font-medium text-foreground">
                      {[sibling.make, sibling.model].filter(Boolean).join(" · ") || "—"}
                    </span>
                  </div>
                  {!isCurrent && (
                    <Link
                      to="/assets/$assetId"
                      params={{ assetId: sibling.id }}
                      className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1 ml-auto"
                    >
                      View asset <ChevronRight className="size-3" />
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </TabsContent>
  );
}

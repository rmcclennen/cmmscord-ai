import { Link } from "@tanstack/react-router";
import { ScanManualDialog } from "@/components/scan-manual-dialog";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { AssetCtx } from "./use-asset-detail";

export function AssetFooter({ ctx }: { ctx: AssetCtx }) {
  const {
    a,
    allAssets,
    currentIndex,
    nextAsset,
    prevAsset,
    scanManualDialogOpen,
    selectedManualForScan,
    setScanManualDialogOpen,
  } = ctx;
  return (
    <>
      {/* Bottom Next / Previous Asset Navigation Footer */}
      {allAssets.length > 1 && (
        <div className="panel p-4 mt-6 border-border/80 bg-card/70 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center gap-2 w-full sm:w-1/3 justify-start">
            {prevAsset ? (
              <Link
                to="/assets/$assetId"
                params={{ assetId: prevAsset.id }}
                className="flex items-center gap-2.5 text-left group p-2.5 rounded-lg border border-border/70 hover:border-primary/40 hover:bg-muted/50 transition-all w-full max-w-sm"
              >
                <div className="size-8 rounded-md bg-muted flex items-center justify-center text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors shrink-0">
                  <ChevronLeft className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                    Previous Asset
                  </p>
                  <p className="text-xs font-medium text-foreground truncate group-hover:text-primary transition-colors">
                    {prevAsset.name} {prevAsset.tag_number ? `[${prevAsset.tag_number}]` : ""}
                  </p>
                </div>
              </Link>
            ) : (
              <div className="text-xs text-muted-foreground italic px-2 py-1">
                Beginning of asset catalog
              </div>
            )}
          </div>

          <div className="flex flex-col items-center text-center gap-0.5 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">
              Asset {currentIndex >= 0 ? currentIndex + 1 : 1} of {allAssets.length}
            </span>
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              Shortcuts:{" "}
              <kbd className="px-1 py-0.5 font-mono bg-muted rounded border text-[10px]">
                Alt + ←
              </kbd>{" "}
              or{" "}
              <kbd className="px-1 py-0.5 font-mono bg-muted rounded border text-[10px]">{"["}</kbd>{" "}
              /{" "}
              <kbd className="px-1 py-0.5 font-mono bg-muted rounded border text-[10px]">
                Alt + →
              </kbd>{" "}
              or{" "}
              <kbd className="px-1 py-0.5 font-mono bg-muted rounded border text-[10px]">{"]"}</kbd>
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-1/3 justify-end">
            {nextAsset ? (
              <Link
                to="/assets/$assetId"
                params={{ assetId: nextAsset.id }}
                className="flex items-center gap-2.5 text-right group p-2.5 rounded-lg border border-primary/30 bg-primary/5 hover:border-primary hover:bg-primary/10 transition-all w-full max-w-sm ml-auto"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-primary">
                    Next Asset
                  </p>
                  <p className="text-xs font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                    {nextAsset.name} {nextAsset.tag_number ? `[${nextAsset.tag_number}]` : ""}
                  </p>
                </div>
                <div className="size-8 rounded-md bg-primary/15 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors shrink-0">
                  <ChevronRight className="size-4" />
                </div>
              </Link>
            ) : (
              <div className="text-xs text-muted-foreground italic px-2 py-1 text-right">
                End of asset catalog
              </div>
            )}
          </div>
        </div>
      )}

      {/* AI Scan Manual for PMs Dialog */}
      <ScanManualDialog
        open={scanManualDialogOpen}
        onOpenChange={setScanManualDialogOpen}
        assetId={a.id}
        assetName={a.name}
        manualId={selectedManualForScan.id}
        manualTitle={selectedManualForScan.title}
        manualUrl={selectedManualForScan.url}
      />
    </>
  );
}

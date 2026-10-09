import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AssetCtx } from "./use-asset-detail";
import { AssetHeader } from "./asset-header";
import { AssetFooter } from "./asset-footer";
import { HistoryTab } from "./history-tab";
import { MaintenanceTab } from "./maintenance-tab";
import { PartsTab } from "./parts-tab";
import { PmsTab } from "./pms-tab";
import { SystemTab } from "./system-tab";
import { SpecsTab } from "./specs-tab";
import { ManualsTab } from "./manuals-tab";
import { PhotosTab } from "./photos-tab";

export function AssetDetailView({ ctx }: { ctx: AssetCtx }) {
  const {
    activePartRequestsCount,
    manuals,
    overduePmsCount,
    partRequestsList,
    parts,
    pmList,
    setTab,
    systemSiblings,
    tab,
    wos,
  } = ctx;
  return (
    <div className="space-y-5">
      <AssetHeader ctx={ctx} />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="specs">Specifications</TabsTrigger>
          <TabsTrigger value="system">System Equipment ({systemSiblings.length})</TabsTrigger>
          <TabsTrigger value="pms">
            PMs ({pmList.length})
            {overduePmsCount > 0 && <span className="ml-1.5 size-2 rounded-full bg-destructive" />}
          </TabsTrigger>
          <TabsTrigger value="parts">
            Parts &amp; Orders ({parts.length + partRequestsList.length})
            {activePartRequestsCount > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-amber-500 px-1.5 py-0.2 text-[10px] font-bold text-white leading-none">
                {activePartRequestsCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="maintenance">Manufacturer data</TabsTrigger>
          <TabsTrigger value="photos">Photos</TabsTrigger>
          <TabsTrigger value="manuals">Manuals ({manuals.data?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="history">Work orders ({wos.data?.length ?? 0})</TabsTrigger>
        </TabsList>

        <PhotosTab ctx={ctx} />

        <ManualsTab ctx={ctx} />

        <SpecsTab ctx={ctx} />

        <SystemTab ctx={ctx} />

        <PmsTab ctx={ctx} />

        <PartsTab ctx={ctx} />

        <MaintenanceTab ctx={ctx} />

        <HistoryTab ctx={ctx} />
      </Tabs>

      <AssetFooter ctx={ctx} />
    </div>
  );
}

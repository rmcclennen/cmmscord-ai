import { TabsContent } from "@/components/ui/tabs";
import { AssetPhotosPanel } from "@/components/asset-photos-panel";
import type { AssetCtx } from "./use-asset-detail";

export function PhotosTab({ ctx }: { ctx: AssetCtx }) {
  const { a } = ctx;
  return (
    <TabsContent value="photos" className="mt-4">
      <AssetPhotosPanel assetId={a.id} />
    </TabsContent>
  );
}

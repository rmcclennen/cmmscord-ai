import { createFileRoute } from "@tanstack/react-router";
import { useAssetDetail } from "@/components/asset-detail/use-asset-detail";
import { AssetDetailView } from "@/components/asset-detail/asset-detail-view";

export const Route = createFileRoute("/_authenticated/assets/$assetId")({
  head: () => ({
    meta: [
      { title: "Asset Detail | AssetCareConnect" },
      {
        name: "description",
        content: "Nameplate specs, manufacturer maintenance data, PMs, and work order history.",
      },
      { property: "og:title", content: "Asset Detail" },
      {
        property: "og:description",
        content: "Specifications, maintenance program, and work order history.",
      },
    ],
  }),
  component: AssetDetail,
});

function AssetDetail() {
  const { assetId } = Route.useParams();
  const ctx = useAssetDetail(assetId);
  if (ctx.state === "loading") {
    return <p className="text-sm text-muted-foreground">Loading asset…</p>;
  }
  if (ctx.state === "missing") {
    return <p className="text-sm text-muted-foreground">Asset not found.</p>;
  }
  return <AssetDetailView ctx={ctx} />;
}

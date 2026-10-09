export type Interval = { task: string; frequency: string; notes?: string };

export type Part = { name: string; part_number?: string | undefined; notes?: string | undefined };

export const PART_STATUS_BADGE: Record<string, { label: string; className: string }> = {
  requested: {
    label: "Requested / In Review",
    className: "bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-300",
  },
  bidding: {
    label: "Out for Vendor Bids",
    className: "bg-purple-500/10 text-purple-700 border-purple-500/30 dark:text-purple-300",
  },
  ordered: {
    label: "PO Issued / Ordered",
    className: "bg-blue-500/10 text-blue-700 border-blue-500/30 dark:text-blue-300",
  },
  received: {
    label: "Received / In Stock",
    className: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-300",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-muted text-muted-foreground border-border",
  },
};

export function getVendorLinks(
  partName: string,
  partNumber?: string | null,
  manufacturer?: string | null,
  assetName?: string | null,
) {
  const query = [manufacturer, partNumber, partName, assetName].filter(Boolean).join(" ");
  const encodedQuery = encodeURIComponent(query);
  const partNumberOrQuery = encodeURIComponent(partNumber || query);

  return {
    google: `https://www.google.com/search?q=${encodeURIComponent(`buy ${query}`)}`,
    grainger: `https://www.grainger.com/search?searchQuery=${partNumberOrQuery}`,
    mcmaster: `https://www.mcmaster.com/${encodeURIComponent(partNumber || partName)}`,
    motion: `https://www.motion.com/search?q=${partNumberOrQuery}`,
    fastenal: `https://www.fastenal.com/product/all?searchKeyword=${partNumberOrQuery}`,
    amazon: `https://www.amazon.com/s?k=${encodedQuery}`,
  };
}

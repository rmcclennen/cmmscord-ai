import trojanOm from "@/assets/trojan-uv-om.pdf.asset.json";
import trojanCloseout from "@/assets/trojan-uv-closeout.pdf.asset.json";

export type AssetDocument = { label: string; url: string; note?: string };

type DocGroup = { match: (name: string) => boolean; docs: AssetDocument[] };

const GROUPS: DocGroup[] = [
  {
    match: (name) => /\buv\b/i.test(name),
    docs: [
      {
        label: "Trojan UV — Volume 2: O&M + Warranties",
        url: trojanOm.url,
        note: "Operation, maintenance and warranty manual",
      },
      {
        label: "Trojan UV — Volume 1: Closeout table of contents",
        url: trojanCloseout.url,
        note: "Index of the closeout submittal package",
      },
    ],
  },
];

export function assetDocuments(name: string | null | undefined): AssetDocument[] {
  if (!name) return [];
  return GROUPS.filter((g) => g.match(name)).flatMap((g) => g.docs);
}

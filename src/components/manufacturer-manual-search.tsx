import { useState, useMemo, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getManufacturerPortalInfo } from "@/lib/manufacturer-links";
import { identifyAssetBrandModel, downloadManualFromLink } from "@/lib/manuals.functions";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  BookOpen,
  ExternalLink,
  FileText,
  Globe,
  Search,
  CheckCircle2,
  BookmarkPlus,
  FileCode2,
  Loader2,
  Sparkles,
} from "lucide-react";

interface ManufacturerManualSearchProps {
  asset: {
    id: string;
    name: string;
    manufacturer?: string | null;
    make?: string | null;
    model?: string | null;
    serial_number?: string | null;
    tag_number?: string | null;
    manufacturer_url?: string | null;
  };
  className?: string;
}

export function ManufacturerManualSearch({ asset, className = "" }: ManufacturerManualSearchProps) {
  const queryClient = useQueryClient();
  const identifyFn = useServerFn(identifyAssetBrandModel);
  const downloadFn = useServerFn(downloadManualFromLink);

  const storedMfg = asset.manufacturer || asset.make || "";
  const storedModel = asset.model || "";

  // Identified (web-verified) brand & model
  const [identity, setIdentity] = useState<{
    brand: string;
    model: string;
    equipmentType: string;
    website: string;
    manualsPage: string;
    confidence: string;
    reasoning: string;
    changedBrand: boolean;
    changedModel: boolean;
  } | null>(null);
  const [identityHint, setIdentityHint] = useState("");
  const [identitySaved, setIdentitySaved] = useState(false);

  const mfg = identity?.brand || storedMfg;
  const model = identity?.model || storedModel;

  const portalInfo = useMemo(() => {
    return getManufacturerPortalInfo(
      mfg,
      model,
      identity?.website || asset.manufacturer_url,
      asset.name,
    );
  }, [mfg, model, identity?.website, asset.manufacturer_url, asset.name]);

  const identifyMutation = useMutation({
    mutationFn: async () =>
      await identifyFn({
        data: { assetId: asset.id, ...(identityHint.trim() ? { hint: identityHint.trim() } : {}) },
      }),
    onSuccess: (data) => {
      setIdentity(data);
      setIdentitySaved(false);
      if (data.brand) {
        toast.success(
          `Identified ${data.brand}${data.model ? ` · Model ${data.model}` : ""} (${data.confidence} confidence)`,
        );
      } else {
        toast.warning("Could not confirm the brand — add a hint like a nameplate word or part number.");
      }
    },
    onError: (err: Error) => toast.error(err.message || "Brand identification failed"),
  });

  const saveIdentity = useMutation({
    mutationFn: async () => {
      if (!identity?.brand) throw new Error("Nothing to save yet.");
      const { error } = await supabase
        .from("assets")
        .update({
          manufacturer: identity.brand,
          ...(identity.model ? { model: identity.model } : {}),
          ...(identity.website ? { manufacturer_url: identity.website } : {}),
        })
        .eq("id", asset.id);
      if (error) throw error;
    },
    onSuccess: () => {
      setIdentitySaved(true);
      toast.success("Saved brand & model to the asset record.");
      queryClient.invalidateQueries({ queryKey: ["asset", asset.id] });
      queryClient.invalidateQueries({ queryKey: ["assets"] });
    },
    onError: (err: Error) => toast.error(err.message || "Could not save to asset"),
  });

  // Attach Form State
  const [attachOpen, setAttachOpen] = useState(false);
  const [manualTitle, setManualTitle] = useState(
    `${portalInfo.name} ${model ? `Model ${model} ` : ""}O&M Manual`.trim(),
  );
  const [manualUrl, setManualUrl] = useState("");
  const [manualKind, setManualKind] = useState("manual");
  const [manualNotes, setManualNotes] = useState(
    `Saved from a Google manual search for ${asset.name}.`,
  );

  // Google Search State
  const [companySearchQuery, setCompanySearchQuery] = useState(
    [mfg, model, "manual pdf"].filter(Boolean).join(" ") || asset.name,
  );

  const googleUrl = (terms: string) =>
    `https://www.google.com/search?q=${encodeURIComponent(terms.trim() || asset.name)}`;

  const handleCompanySearch = (term?: string) => {
    const q = term !== undefined ? term : companySearchQuery;
    window.open(googleUrl(q), "_blank", "noopener,noreferrer");
  };


  // Auto-identify the real brand/model when the record is missing one
  useEffect(() => {
    if (!identity && !identifyMutation.isPending && (!storedMfg || !storedModel)) {
      identifyMutation.mutate();
    }
  }, [asset.id]);

  // Custom Manual Attach Mutation
  const attachManual = useMutation({
    mutationFn: async () => {
      if (!manualUrl.trim()) throw new Error("Please enter a valid manual URL or link.");
      if (!manualTitle.trim()) throw new Error("Please enter a manual title.");
      return await downloadFn({
        data: {
          assetId: asset.id,
          title: manualTitle.trim(),
          url: manualUrl.trim(),
          kind: manualKind,
          manufacturer: mfg || portalInfo.name,
          notes: manualNotes.trim() || undefined,
        },
      });
    },
    onSuccess: (res) => {
      if (res.downloaded) toast.success(`Downloaded "${manualTitle}" into Manuals.`);
      else toast.warning(`Saved the link only — couldn't download the file (${res.reason}).`);
      queryClient.invalidateQueries({ queryKey: ["asset-manuals", asset.id] });
      queryClient.invalidateQueries({ queryKey: ["manuals"] });
      setManualUrl("");
      setAttachOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className={`panel p-5 space-y-5 border-primary/40 bg-card/60 ${className}`}>
      {/* Verified Brand & Model Identification */}
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-emerald-500" /> Identified Brand &amp; Model
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Finds the real manufacturer brand and model number for {asset.name} from live web
              search, then targets the manual search at it.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => identifyMutation.mutate()}
            disabled={identifyMutation.isPending}
            className="h-7 text-xs gap-1.5 font-semibold bg-background"
          >
            {identifyMutation.isPending ? (
              <>
                <Loader2 className="size-3 animate-spin" /> Identifying…
              </>
            ) : (
              <>
                <Search className="size-3 text-emerald-600" /> Identify Brand &amp; Model
              </>
            )}
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="outline" className="bg-background font-semibold">
            Brand: {mfg || "Not identified"}
          </Badge>
          <Badge variant="outline" className="bg-background font-mono font-semibold">
            Model: {model || "Not identified"}
          </Badge>
          {identity?.equipmentType && (
            <Badge variant="secondary" className="text-[10px]">
              {identity.equipmentType}
            </Badge>
          )}
          {identity && (
            <Badge
              variant="outline"
              className="text-[10px] uppercase border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
            >
              {identity.confidence} confidence
            </Badge>
          )}
        </div>

        {identity?.reasoning && (
          <p className="text-[11px] text-muted-foreground leading-relaxed">{identity.reasoning}</p>
        )}

        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            value={identityHint}
            onChange={(e) => setIdentityHint(e.target.value)}
            placeholder="Optional hint from the nameplate (brand word, model, part or serial number)…"
            className="h-8 text-xs bg-background"
            onKeyDown={(e) => {
              if (e.key === "Enter") identifyMutation.mutate();
            }}
          />
          {identity && (identity.changedBrand || identity.changedModel) && identity.brand && (
            <Button
              size="sm"
              onClick={() => saveIdentity.mutate()}
              disabled={saveIdentity.isPending || identitySaved}
              className="h-8 text-xs gap-1.5 font-semibold shrink-0"
            >
              {identitySaved ? (
                <>
                  <CheckCircle2 className="size-3.5" /> Saved to Asset
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-3.5" /> Save to Asset Record
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Top Header: Google manual search */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-border/70 pb-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Globe className="size-4 text-primary" /> Google Search for Technical Manuals
            </h3>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Searches Google for{" "}
            <strong className="text-foreground">{mfg || asset.name}</strong>{" "}
            {model && (
              <>
                · Model: <span className="font-mono font-semibold text-primary">{model}</span>
              </>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="default"
            asChild
            className="gap-1.5 text-xs font-semibold shadow-xs"
          >
            <a
              href={googleUrl([mfg, model, "O&M manual pdf"].filter(Boolean).join(" "))}
              target="_blank"
              rel="noopener noreferrer"
              title="Search Google for this equipment's manual"
            >
              <Search className="size-3.5" />
              Google the manual
              <ExternalLink className="size-3 opacity-70" />
            </a>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              window.open(
                googleUrl([mfg, model, "O&M manual pdf"].filter(Boolean).join(" ")),
                "_blank",
                "noopener,noreferrer",
              )
            }
            className="gap-1.5 text-xs font-semibold border-amber-500/40 hover:bg-amber-500/10 text-amber-600 dark:text-amber-400"
            title="Open a Google search for this equipment's manual"
          >
            <Search className="size-3.5 text-amber-500" />
            Scan for manual
          </Button>


          <Button
            size="sm"
            variant="ghost"
            onClick={() => setAttachOpen(!attachOpen)}
            className="gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            <BookmarkPlus className="size-3.5 text-primary" />
            {attachOpen ? "Close Form" : "Custom Link"}
          </Button>
        </div>
      </div>

      {/* 1. Google search bar */}
      <div className="rounded-lg border border-primary/25 bg-primary/5 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Globe className="size-4 text-primary" />
            <span className="text-xs font-bold text-foreground">Search Google directly</span>
            <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 bg-background/60">
              google.com
            </Badge>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleCompanySearch();
          }}
          className="flex flex-col sm:flex-row gap-2"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              value={companySearchQuery}
              onChange={(e) => setCompanySearchQuery(e.target.value)}
              placeholder="Search Google for model, serial, cut sheet, or manual…"
              className="pl-9 h-9 text-xs bg-background"
            />
          </div>
          <Button
            type="submit"
            size="sm"
            className="gap-1.5 shrink-0 text-xs font-semibold shadow-xs"
          >
            <Search className="size-3.5" />
            Search Google
            <ExternalLink className="size-3 opacity-70" />
          </Button>
        </form>

        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground pt-0.5">
          <span className="font-medium text-foreground text-[11px]">Instant Google searches:</span>
          {[
            { label: "Manual PDF", terms: "O&M manual pdf", icon: BookOpen },
            { label: "Parts Breakdown", terms: "parts list manual pdf", icon: FileText },
            { label: "Wiring Diagram", terms: "wiring diagram pdf", icon: FileCode2 },
            { label: "Troubleshooting / Specs", terms: "troubleshooting specifications", icon: null },
          ].map(({ label, terms, icon: Icon }) => (
            <Button
              key={label}
              variant="outline"
              size="sm"
              className="h-6 text-[11px] px-2.5 py-0 bg-background gap-1"
              asChild
            >
              <a
                href={googleUrl([mfg, model, terms].filter(Boolean).join(" "))}
                target="_blank"
                rel="noopener noreferrer"
              >
                {Icon && <Icon className="size-2.5" />} {label}
                <ExternalLink className="size-2.5 opacity-50" />
              </a>
            </Button>
          ))}
        </div>
      </div>


      {/* Expandable Manual Attach Form */}
      {attachOpen && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <BookmarkPlus className="size-4 text-primary" /> Attach Custom Manual / Link to{" "}
              {asset.name}
            </h4>
            <span className="text-[11px] text-muted-foreground">
              Attach any manual URL, OEM portal link, or technical file
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="space-y-1">
              <Label className="text-[11px]">Document Title *</Label>
              <Input
                value={manualTitle}
                onChange={(e) => setManualTitle(e.target.value)}
                placeholder="e.g., Flygt 3152 Installation & Maintenance Manual"
                className="h-8 text-xs bg-background"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Manual / PDF Web URL *</Label>
              <Input
                value={manualUrl}
                onChange={(e) => setManualUrl(e.target.value)}
                placeholder="https://.../manual.pdf"
                className="h-8 text-xs bg-background"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="space-y-1">
              <Label className="text-[11px]">Document Type</Label>
              <select
                value={manualKind}
                onChange={(e) => setManualKind(e.target.value)}
                className="w-full h-8 px-2.5 rounded-md border border-input bg-background text-xs"
              >
                <option value="manual">O&amp;M Manual</option>
                <option value="cut_sheet">Cut Sheet / Technical Specs</option>
                <option value="drawing">Wiring / Mechanical Drawing</option>
                <option value="parts_list">Parts Breakdown / BOM</option>
                <option value="certificate">Factory Test / Warranty Certificate</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Notes</Label>
              <Input
                value={manualNotes}
                onChange={(e) => setManualNotes(e.target.value)}
                placeholder="Optional notes, revision number, or drawing spec"
                className="h-8 text-xs bg-background"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setAttachOpen(false)}
              className="h-8 text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => attachManual.mutate()}
              disabled={attachManual.isPending || !manualUrl.trim()}
              className="h-8 gap-1.5 text-xs font-semibold"
            >
              <CheckCircle2 className="size-3.5" />
              {attachManual.isPending ? "Attaching…" : "Save & Attach Manual"}
            </Button>
          </div>
        </div>
      )}

    </div>
  );
}

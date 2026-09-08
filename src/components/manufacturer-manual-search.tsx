import { useState, useMemo, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getManufacturerPortalInfo } from "@/lib/manufacturer-links";
import {
  searchInternetManuals,
  placeManualInAsset,
  identifyAssetBrandModel,
  type DiscoveredManual,
} from "@/lib/manuals.functions";

import { ScanManualDialog } from "@/components/scan-manual-dialog";
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
  Plus,
  Search,
  CheckCircle2,
  BookmarkPlus,
  FileCode2,
  Zap,
  Loader2,
  Sparkles,
  Download,
  Layers,
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
  const searchInternetFn = useServerFn(searchInternetManuals);
  const placeManualFn = useServerFn(placeManualInAsset);
  const identifyFn = useServerFn(identifyAssetBrandModel);

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
        const q = [data.brand, data.model, "O&M manual PDF"].filter(Boolean).join(" ");
        setSearchQuery(q);
        searchMutation.mutate(q);
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

  const defaultSearch = [mfg, model, "O&M manual PDF"].filter(Boolean).join(" ");
  const [searchQuery, setSearchQuery] = useState(defaultSearch);


  // Internet Search Results State
  const [searchResults, setSearchResults] = useState<DiscoveredManual[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [placedManualUrls, setPlacedManualUrls] = useState<Set<string>>(new Set());

  // Attach Form State
  const [attachOpen, setAttachOpen] = useState(false);
  const [manualTitle, setManualTitle] = useState(
    `${portalInfo.name} ${model ? `Model ${model} ` : ""}O&M Manual`.trim(),
  );
  const [manualUrl, setManualUrl] = useState("");
  const [manualKind, setManualKind] = useState("manual");
  const [manualNotes, setManualNotes] = useState(
    `Discovered from ${portalInfo.name} documentation for ${asset.name}.`,
  );

  // Company Website Live Search State
  const [companySearchQuery, setCompanySearchQuery] = useState(model || asset.name || "");

  const handleCompanySearch = (term?: string) => {
    const q = term !== undefined ? term : companySearchQuery;
    const url = portalInfo.getCompanySearchUrl(q);
    window.open(url, "_blank", "noopener,noreferrer");
  };

  // Scan Manual PMs Dialog State
  const [scanDialogOpen, setScanDialogOpen] = useState(false);
  const [scanTargetManual, setScanTargetManual] = useState<{
    title: string;
    url: string;
  }>({
    title: `${portalInfo.name} ${model} O&M Manual`,
    url: portalInfo.modelUrl,
  });

  const triggerScanOnManual = (title: string, url: string) => {
    setScanTargetManual({ title, url });
    setScanDialogOpen(true);
  };

  // Internet Manual Search Mutation
  const searchMutation = useMutation({
    mutationFn: async (customQuery?: string) => {
      const q = customQuery !== undefined ? customQuery : searchQuery;
      return await searchInternetFn({
        data: {
          assetId: asset.id,
          query: q.trim() || undefined,
        },
      });
    },
    onSuccess: (data) => {
      setSearchResults(data.results);
      setHasSearched(true);
      toast.success(
        data.results.length === 1
          ? "Found 1 manual on the internet!"
          : `Found ${data.results.length} manuals & technical documents online!`,
      );
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to search internet for manuals");
    },
  });

  // Auto-search on initial load once so technician sees results immediately
  useEffect(() => {
    if (!hasSearched && (mfg || model || asset.name)) {
      searchMutation.mutate(defaultSearch);
    }
  }, [asset.id]);

  // Auto-identify the real brand/model when the record is missing one
  useEffect(() => {
    if (!identity && !identifyMutation.isPending && (!storedMfg || !storedModel)) {
      identifyMutation.mutate();
    }
  }, [asset.id]);


  // Place in Manuals Mutation (One-Click)
  const placeManual = useMutation({
    mutationFn: async (manual: { title: string; url: string; kind: string; snippet?: string }) => {
      return await placeManualFn({
        data: {
          assetId: asset.id,
          title: manual.title,
          fileUrl: manual.url,
          kind: manual.kind,
          manufacturer: mfg || portalInfo.name,
          notes: manual.snippet || `Online manual discovered for ${asset.name}.`,
        },
      });
    },
    onSuccess: (_, variables) => {
      toast.success(`Placed "${variables.title}" in Asset Manuals!`);
      setPlacedManualUrls((prev) => new Set(prev).add(variables.url));
      queryClient.invalidateQueries({ queryKey: ["asset-manuals", asset.id] });
      queryClient.invalidateQueries({ queryKey: ["manuals"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to place manual");
    },
  });

  // Custom Manual Attach Mutation
  const attachManual = useMutation({
    mutationFn: async () => {
      if (!manualUrl.trim()) throw new Error("Please enter a valid manual URL or link.");
      if (!manualTitle.trim()) throw new Error("Please enter a manual title.");

      const { data: authData } = await supabase.auth.getUser();

      const { error } = await supabase.from("manuals").insert({
        asset_id: asset.id,
        title: manualTitle.trim(),
        file_url: manualUrl.trim(),
        kind: manualKind,
        manufacturer: mfg || portalInfo.name,
        notes: manualNotes.trim() || null,
        added_by: authData?.user?.id ?? null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`Attached "${manualTitle}" to asset!`);
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

      {/* Top Header: Manufacturer Verified Links & Model Lookup */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-border/70 pb-4">

        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Globe className="size-4 text-primary" /> Manufacturer Website &amp; Technical Manuals
            </h3>
            {portalInfo.hasDirectPortal && (
              <Badge
                variant="outline"
                className="text-[10px] font-semibold text-primary border-primary/30 bg-primary/5"
              >
                OEM Verified: {portalInfo.domain}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Direct portal and live internet search for{" "}
            <strong className="text-foreground">{portalInfo.name}</strong>{" "}
            {model && (
              <>
                · Model: <span className="font-mono font-semibold text-primary">{model}</span>
              </>
            )}
          </p>
        </div>

        {/* Quick Verified Direct Buttons */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="default"
            asChild
            className="gap-1.5 text-xs font-semibold shadow-xs"
          >
            <a
              href={portalInfo.companySearchUrl || portalInfo.modelUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={`Search ${portalInfo.name} official website for ${model || "equipment"}`}
            >
              <Search className="size-3.5" />
              {model
                ? `Search ${portalInfo.name} for "${model}"`
                : `Search ${portalInfo.name} Website`}
              <ExternalLink className="size-3 opacity-70" />
            </a>
          </Button>

          <Button size="sm" variant="outline" asChild className="gap-1.5 text-xs font-semibold">
            <a href={portalInfo.website} target="_blank" rel="noopener noreferrer">
              <Globe className="size-3.5 text-primary" />
              Official Site
              <ExternalLink className="size-3 opacity-70" />
            </a>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              triggerScanOnManual(
                `${portalInfo.name} ${model} O&M Manual`,
                portalInfo.companySearchUrl || portalInfo.modelUrl,
              )
            }
            className="gap-1.5 text-xs font-semibold border-amber-500/40 hover:bg-amber-500/10 text-amber-600 dark:text-amber-400"
          >
            <Zap className="size-3.5 text-amber-500" />
            Scan Manual for PMs
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

      {/* 1. Dedicated Direct Manufacturer Website Search Bar */}
      <div className="rounded-lg border border-primary/25 bg-primary/5 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Globe className="size-4 text-primary" />
            <span className="text-xs font-bold text-foreground">
              Search {portalInfo.name}&apos;s Official Website Directly
            </span>
            <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 bg-background/60">
              {portalInfo.domain}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              asChild
              className="h-7 text-xs gap-1 font-medium bg-background"
            >
              <a href={portalInfo.website} target="_blank" rel="noopener noreferrer">
                <Globe className="size-3 text-primary" />
                {portalInfo.name} Homepage
                <ExternalLink className="size-2.5 opacity-60" />
              </a>
            </Button>
            {portalInfo.directDocsUrl && portalInfo.directDocsUrl !== portalInfo.website && (
              <Button
                size="sm"
                variant="outline"
                asChild
                className="h-7 text-xs gap-1 font-medium bg-background"
              >
                <a href={portalInfo.directDocsUrl} target="_blank" rel="noopener noreferrer">
                  <BookOpen className="size-3 text-primary" />
                  Documentation Library
                  <ExternalLink className="size-2.5 opacity-60" />
                </a>
              </Button>
            )}
          </div>
        </div>

        {/* Live on-site search form for the company's website */}
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
              placeholder={`Search ${portalInfo.name}'s website for model, serial, cut sheet, or manual...`}
              className="pl-9 h-9 text-xs bg-background"
            />
          </div>
          <Button
            type="submit"
            size="sm"
            className="gap-1.5 shrink-0 text-xs font-semibold shadow-xs"
          >
            <Search className="size-3.5" />
            Search {portalInfo.name} Website
            <ExternalLink className="size-3 opacity-70" />
          </Button>
        </form>

        {/* Quick 1-Click Search Buttons on Company's Website */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground pt-0.5">
          <span className="font-medium text-foreground text-[11px]">
            Instant {portalInfo.name} searches:
          </span>
          {model && (
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-[11px] px-2.5 py-0 bg-background font-mono gap-1"
              asChild
            >
              <a
                href={portalInfo.getCompanySearchUrl(model)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Search className="size-2.5" /> Model {model}
                <ExternalLink className="size-2.5 opacity-50" />
              </a>
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-6 text-[11px] px-2.5 py-0 bg-background gap-1"
            asChild
          >
            <a
              href={portalInfo.getCompanySearchUrl(`${model ? `${model} ` : ""}manual`)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <BookOpen className="size-2.5" /> {model ? `${model} Manuals` : "Manuals & O&M"}
              <ExternalLink className="size-2.5 opacity-50" />
            </a>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-6 text-[11px] px-2.5 py-0 bg-background gap-1"
            asChild
          >
            <a
              href={portalInfo.getCompanySearchUrl(`${model ? `${model} ` : ""}parts`)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <FileText className="size-2.5" /> Parts Breakdown
              <ExternalLink className="size-2.5 opacity-50" />
            </a>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-6 text-[11px] px-2.5 py-0 bg-background gap-1"
            asChild
          >
            <a
              href={portalInfo.getCompanySearchUrl(`${model ? `${model} ` : ""}troubleshooting`)}
              target="_blank"
              rel="noopener noreferrer"
            >
              Troubleshooting / Specs
              <ExternalLink className="size-2.5 opacity-50" />
            </a>
          </Button>
        </div>
      </div>

      {/* Live Internet Manual Search Bar */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <Label
            htmlFor="internet-manual-search"
            className="text-xs font-bold text-foreground flex items-center gap-1.5"
          >
            <Sparkles className="size-3.5 text-primary" /> Search Internet for Equipment Manuals
            (Live Web &amp; OEM)
          </Label>
          <span className="text-[11px] text-muted-foreground">
            Search live internet &amp; 1-click place in asset manuals
          </span>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              id="internet-manual-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search equipment manuals, cut sheets, or wiring diagrams on the internet…"
              className="pl-9 text-xs h-9 bg-background"
              onKeyDown={(e) => {
                if (e.key === "Enter") searchMutation.mutate(searchQuery);
              }}
            />
          </div>

          <Button
            size="sm"
            onClick={() => searchMutation.mutate(searchQuery)}
            disabled={searchMutation.isPending}
            className="h-9 gap-1.5 text-xs font-semibold shrink-0"
          >
            {searchMutation.isPending ? (
              <>
                <Loader2 className="size-3.5 animate-spin" /> Searching Internet…
              </>
            ) : (
              <>
                <Search className="size-3.5" /> Search Internet
              </>
            )}
          </Button>
        </div>

        {/* Quick Search Term Chips */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-[11px] text-muted-foreground font-medium mr-1">
            Quick searches:
          </span>
          {[
            "O&M Manual PDF",
            "Installation & Maintenance Guide",
            "Parts Breakdown List & Diagram",
            "Wiring & Electrical Schematic",
            "Mechanical Seal Replacement Manual",
            "Troubleshooting & Clearances",
          ].map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => {
                const q = [mfg, model, tag].filter(Boolean).join(" ");
                setSearchQuery(q);
                searchMutation.mutate(q);
              }}
              className="rounded-md border border-border/80 bg-background/80 px-2 py-0.5 text-[11px] text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors font-mono"
            >
              + {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Internet Search Results Grid */}
      {searchMutation.isPending && (
        <div className="rounded-lg border border-border/80 bg-muted/20 p-8 text-center space-y-2">
          <Loader2 className="size-6 text-primary animate-spin mx-auto" />
          <p className="text-xs font-medium text-foreground">
            Searching internet and manufacturer portals for {portalInfo.name} {model} manuals…
          </p>
        </div>
      )}

      {!searchMutation.isPending && hasSearched && searchResults.length === 0 && (
        <div className="rounded-lg border border-border/80 bg-muted/20 p-6 text-center space-y-2">
          <p className="text-xs text-muted-foreground">
            No direct manuals found for "{searchQuery}". Try using the official OEM link above or
            search by model number.
          </p>
          <Button size="sm" variant="outline" asChild className="text-xs h-8 gap-1.5">
            <a href={portalInfo.googleManualPdfUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="size-3" /> Search Google for PDF Manuals
            </a>
          </Button>
        </div>
      )}

      {!searchMutation.isPending && searchResults.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between pb-1 border-b border-border/60">
            <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <BookOpen className="size-3.5 text-primary" /> Discovered Online Manuals (
              {searchResults.length})
            </span>
            <span className="text-[11px] text-muted-foreground">
              Click "Place in Manuals" to save to asset
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {searchResults.map((item) => {
              const isPlaced = placedManualUrls.has(item.url);

              return (
                <div
                  key={item.id}
                  className="rounded-lg border border-border/80 bg-card p-3.5 flex flex-col justify-between space-y-3 hover:border-primary/40 transition-colors shadow-2xs"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-xs font-bold text-foreground line-clamp-2 leading-snug">
                        {item.title}
                      </h4>
                      <div className="flex items-center gap-1 shrink-0">
                        <Badge
                          variant="outline"
                          className="text-[10px] font-mono px-1.5 py-0 uppercase"
                        >
                          {item.kind.replace("_", " ")}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px] font-mono px-1.5 py-0">
                          {item.file_type}
                        </Badge>
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground line-clamp-2">{item.snippet}</p>

                    <div className="text-[11px] text-muted-foreground font-mono truncate">
                      Source: {item.source_domain}
                    </div>
                  </div>

                  {/* Actions for this manual */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/60">
                    <Button
                      size="sm"
                      variant="ghost"
                      asChild
                      className="h-7 text-xs px-2 gap-1 text-muted-foreground hover:text-foreground"
                    >
                      <a href={item.url} target="_blank" rel="noreferrer">
                        <ExternalLink className="size-3" /> View / Download
                      </a>
                    </Button>

                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => triggerScanOnManual(item.title, item.url)}
                        className="h-7 text-xs px-2 gap-1 border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                        title="Scan this manual for PM schedules"
                      >
                        <Zap className="size-3 text-amber-500" />
                        Scan for PMs
                      </Button>

                      <Button
                        size="sm"
                        variant={isPlaced ? "secondary" : "default"}
                        onClick={() =>
                          placeManual.mutate({
                            title: item.title,
                            url: item.url,
                            kind: item.kind,
                            snippet: item.snippet,
                          })
                        }
                        disabled={placeManual.isPending || isPlaced}
                        className="h-7 text-xs px-2.5 gap-1 font-semibold"
                      >
                        {isPlaced ? (
                          <>
                            <CheckCircle2 className="size-3 text-emerald-500" /> Placed
                          </>
                        ) : (
                          <>
                            <Plus className="size-3" /> Place in Manuals
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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

      {/* AI Scan Manual for PMs Dialog */}
      <ScanManualDialog
        open={scanDialogOpen}
        onOpenChange={setScanDialogOpen}
        assetId={asset.id}
        assetName={asset.name}
        manualTitle={scanTargetManual.title}
        manualUrl={scanTargetManual.url}
      />
    </div>
  );
}

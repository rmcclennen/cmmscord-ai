import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  KNOWN_FIELDS,
  autoDetectColumns,
  parseDocumentText,
  transformRowsToAssets,
  downloadSampleAssetCsv,
  downloadSampleHierarchicalDoc,
  clearAllAssetsDatabase,
  bulkInsertAssets,
  type ColumnMapping,
  type ParsedAssetRow,
} from "@/lib/asset-import";
import { toast } from "sonner";
import {
  UploadCloud,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Boxes,
  CalendarCheck,
  RefreshCw,
  FileText,
  Trash2,
  Package,
} from "lucide-react";

interface BulkAssetUploaderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function BulkAssetUploader({ open, onOpenChange, onSuccess }: BulkAssetUploaderProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Wizard state: 1 = File Upload, 2 = Column Mapping, 3 = Preview & Options, 4 = Importing / Done
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [fileName, setFileName] = useState<string>("");
  const [rawText, setRawText] = useState<string>("");
  const [isHierarchical, setIsHierarchical] = useState<boolean>(false);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({
    name: "",
    tag_number: "",
    class: "",
    make: "",
    model: "",
    serial_number: "",
    location_name: "",
    building: "",
    manufacturer: "",
    supplier: "",
    hp: "",
    volts: "",
    rpm: "",
    frame: "",
    criticality: "",
    notes: "",
  });

  const [cleanReset, setCleanReset] = useState<boolean>(false);
  const [autoGeneratePms, setAutoGeneratePms] = useState<boolean>(true);
  const [parsedAssets, setParsedAssets] = useState<ParsedAssetRow[]>([]);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [isWiping, setIsWiping] = useState<boolean>(false);
  const [progress, setProgress] = useState<{ current: number; total: number }>({
    current: 0,
    total: 0,
  });
  const [resultSummary, setResultSummary] = useState<{
    inserted: number;
    partsLinked: number;
    pmsCreated: number;
  } | null>(null);

  const resetState = () => {
    setStep(1);
    setFileName("");
    setRawText("");
    setIsHierarchical(false);
    setHeaders([]);
    setRawRows([]);
    setParsedAssets([]);
    setCleanReset(false);
    setIsImporting(false);
    setIsWiping(false);
    setProgress({ current: 0, total: 0 });
    setResultSummary(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = String(event.target?.result || "");
      setRawText(text);
      processFileText(text);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = String(event.target?.result || "");
      setRawText(text);
      processFileText(text);
    };
    reader.readAsText(file);
  };

  const processFileText = (text: string) => {
    try {
      const parsed = parseDocumentText(text);
      if (parsed.rows.length === 0 && parsed.hierarchicalAssets.length === 0) {
        toast.error("No valid data rows found in the uploaded file.");
        return;
      }

      setIsHierarchical(parsed.isHierarchical);
      setHeaders(parsed.headers);
      setRawRows(parsed.rows);

      if (parsed.isHierarchical && parsed.hierarchicalAssets.length > 0) {
        // Direct hierarchical asset-parts structure detected!
        setParsedAssets(parsed.hierarchicalAssets);
        setStep(3);
        const totalParts = parsed.hierarchicalAssets.reduce(
          (acc, a) => acc + (a.parts?.length || 0),
          0,
        );
        toast.success(
          `Detected tabbed hierarchy: ${parsed.hierarchicalAssets.length} Assets with ${totalParts} nested Parts!`,
        );
      } else {
        // Standard tabular format
        const autoMap = autoDetectColumns(parsed.headers);
        setMapping(autoMap);
        setStep(2);
        toast.success(`Loaded ${parsed.rows.length} rows with ${parsed.headers.length} columns.`);
      }
    } catch {
      toast.error("Failed to parse file. Please verify formatting.");
    }
  };

  const proceedToPreview = () => {
    if (!mapping.name) {
      toast.error("Please map the 'Asset Name / Equipment Description' column.");
      return;
    }
    const assets = transformRowsToAssets(rawRows, mapping);
    if (assets.length === 0) {
      toast.error("No valid assets found. Ensure rows have a name.");
      return;
    }
    setParsedAssets(assets);
    setStep(3);
  };

  const executeWipeDatabase = async () => {
    if (
      !confirm(
        "Are you sure you want to delete ALL assets and their linked part associations? This will remove all existing assets so you can start fresh.",
      )
    ) {
      return;
    }
    setIsWiping(true);
    try {
      const res = await clearAllAssetsDatabase();
      queryClient.invalidateQueries({ queryKey: ["assets-all"] });
      queryClient.invalidateQueries({ queryKey: ["assets-parts-map"] });
      toast.success(`Cleared ${res.deletedAssets} assets and ${res.deletedLinks} links.`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to clear database");
    } finally {
      setIsWiping(false);
    }
  };

  const executeImport = async () => {
    if (parsedAssets.length === 0) return;
    setIsImporting(true);
    setStep(4);
    setProgress({ current: 0, total: parsedAssets.length });

    try {
      const res = await bulkInsertAssets(parsedAssets, {
        cleanReset,
        generatePmSchedules: autoGeneratePms,
        onProgress: (curr, tot) => setProgress({ current: curr, total: tot }),
      });

      setResultSummary(res);
      queryClient.invalidateQueries({ queryKey: ["assets-all"] });
      queryClient.invalidateQueries({ queryKey: ["assets-parts-map"] });
      queryClient.invalidateQueries({ queryKey: ["parts-all"] });
      queryClient.invalidateQueries({ queryKey: ["pm-schedules-all"] });
      toast.success(
        `Successfully imported ${res.inserted} assets and linked ${res.partsLinked} parts!`,
      );
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Failed to insert assets";
      toast.error(errMsg);
      setIsImporting(false);
    }
  };

  const totalNestedPartsCount = parsedAssets.reduce((acc, a) => acc + (a.parts?.length || 0), 0);

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        if (!val) resetState();
        onOpenChange(val);
      }}
    >
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto p-6">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Boxes className="size-5" aria-hidden="true" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold">
                  Asset & Nested Parts Document Importer
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Import plant assets with tabbed-over replacement parts nested under each unit,
                  minus location data.
                </DialogDescription>
              </div>
            </div>
            <Badge variant="outline" className="font-mono text-xs">
              Step {step} of 4
            </Badge>
          </div>
        </DialogHeader>

        {/* Step 1: Upload or Paste File */}
        {step === 1 && (
          <div className="mt-4 space-y-5">
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 p-8 text-center transition-colors hover:border-primary hover:bg-primary/10"
            >
              <FileSpreadsheet className="size-12 text-primary" aria-hidden="true" />
              <h3 className="mt-3 text-base font-bold text-foreground">
                Drop your document or spreadsheet here (.csv, .tsv, .txt)
              </h3>
              <p className="mt-1 max-w-md text-xs text-muted-foreground">
                Supports hierarchical lists (Assets with indented/tabbed Parts) or standard CSV
                equipment tables.
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.tsv,.txt"
                className="sr-only"
                onChange={handleFileChange}
              />

              <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                <Button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 font-bold"
                >
                  <UploadCloud className="size-4" />
                  Select Document / File
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={downloadSampleHierarchicalDoc}
                  className="flex items-center gap-2 text-xs font-semibold"
                >
                  <Download className="size-4 text-primary" />
                  Download Tabbed Asset + Parts Template (.txt)
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={downloadSampleAssetCsv}
                  className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Download className="size-4" />
                  Download Standard CSV
                </Button>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <FileText className="size-3.5 text-primary" /> Or Paste Tabbed / Hierarchical
                Document Text
              </h4>
              <p className="text-[11px] text-muted-foreground mt-1">
                Tip: Indent parts with a tab (
                <kbd className="font-mono bg-muted px-1 rounded">Tab</kbd>) or 2+ spaces under their
                parent asset.
              </p>
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder={`Grit Pump #1\tTag: HD-GTP-140\tHayward Gordon\tCR4-8\n\tChopper Impeller\tPart#: VP-IMP-SE4L\tMfr: Hayward Gordon\tQty: 2\tCost: $1450\n\tMechanical Seal Assembly\tPart#: VP-SEAL-4L\tMfr: Hayward Gordon\tQty: 2\tCost: $920\nRDT Feed Pump #1\tTag: WAS-P-845-10\tHayward Gordon\n\tVortex Impeller\tPart#: HG-IMP-XCS4\tQty: 1\tCost: $1250`}
                className="mt-2 h-32 w-full rounded-md border border-input bg-background p-3 font-mono text-xs text-foreground focus-visible:ring-2 focus-visible:ring-primary"
              />
              {rawText.trim().length > 0 && (
                <div className="mt-3 flex justify-end">
                  <Button size="sm" onClick={() => processFileText(rawText)} className="font-bold">
                    Parse Document & Load <ArrowRight className="ml-1 size-3.5" />
                  </Button>
                </div>
              )}
            </div>

            {/* Database Clear Utility */}
            <div className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <div className="flex items-center gap-2">
                <Trash2 className="size-4 text-destructive" />
                <div>
                  <p className="text-xs font-bold text-destructive">
                    Wipe Existing Assets Database
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Clear all current assets and links if you want to replace everything cleanly
                    with your document.
                  </p>
                </div>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={executeWipeDatabase}
                disabled={isWiping}
                className="text-xs font-bold"
              >
                {isWiping ? "Clearing…" : "Wipe Clean"}
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Column Mapping (for Standard CSVs) */}
        {step === 2 && (
          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between rounded-lg bg-muted/60 p-3">
              <div>
                <p className="text-xs font-bold text-foreground">
                  File: <span className="font-mono text-primary">{fileName || "Pasted Data"}</span>
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Detected {rawRows.length} data rows and {headers.length} columns.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setStep(1)} className="text-xs">
                <ArrowLeft className="mr-1 size-3.5" /> Choose Different File
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Verify how your spreadsheet columns correspond to equipment fields. Note: Shelf/bin
              location codes are automatically stripped per plant standard.
            </p>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {KNOWN_FIELDS.map((field) => {
                const isRequired = field.required;
                const currentValue = mapping[field.key];
                return (
                  <div
                    key={field.key}
                    className={`rounded-lg border p-3 ${
                      isRequired && !currentValue
                        ? "border-destructive/50 bg-destructive/5"
                        : currentValue
                          ? "border-primary/40 bg-card"
                          : "border-border bg-card/60"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <Label className="text-xs font-bold text-foreground flex items-center gap-1">
                        {field.label}
                        {isRequired && <span className="text-destructive font-bold">*</span>}
                      </Label>
                      {currentValue && (
                        <Badge
                          variant="outline"
                          className="text-[10px] border-primary/40 bg-primary/10 text-primary"
                        >
                          Matched
                        </Badge>
                      )}
                    </div>
                    <Select
                      value={currentValue || "__none__"}
                      onValueChange={(val) => {
                        setMapping((prev) => ({
                          ...prev,
                          [field.key]: val === "__none__" ? "" : val,
                        }));
                      }}
                    >
                      <SelectTrigger className="w-full text-xs">
                        <SelectValue placeholder="Select column…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">-- Do not map --</SelectItem>
                        {headers.map((h) => (
                          <SelectItem key={h} value={h}>
                            {h}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between border-t border-border pt-4">
              <Button variant="outline" size="sm" onClick={() => setStep(1)}>
                <ArrowLeft className="mr-1.5 size-3.5" /> Back
              </Button>
              <Button size="sm" onClick={proceedToPreview} className="font-bold">
                Continue to Preview ({rawRows.length} Assets){" "}
                <ArrowRight className="ml-1.5 size-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Preview & Import Options */}
        {step === 3 && (
          <div className="mt-4 space-y-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-border bg-card p-3 text-center">
                <p className="text-[11px] text-muted-foreground font-semibold uppercase">
                  Assets to Ingest
                </p>
                <p className="text-2xl font-bold text-foreground">{parsedAssets.length}</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-3 text-center">
                <p className="text-[11px] text-muted-foreground font-semibold uppercase">
                  Parts to Link
                </p>
                <p className="text-2xl font-bold text-primary">{totalNestedPartsCount} Parts</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-3 text-center">
                <p className="text-[11px] text-muted-foreground font-semibold uppercase">
                  High Criticality
                </p>
                <p className="text-2xl font-bold text-destructive">
                  {parsedAssets.filter((a) => a.criticality === "high").length}
                </p>
              </div>
            </div>

            {/* Ingestion Options: Clean Replace & Auto PM */}
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-xl border border-destructive/30 bg-destructive/5 p-3.5">
                <div className="flex items-start gap-3">
                  <Trash2 className="mt-0.5 size-4 text-destructive" aria-hidden="true" />
                  <div>
                    <Label
                      htmlFor="clean-reset-toggle"
                      className="text-xs font-bold text-destructive cursor-pointer"
                    >
                      Clean Replacement (Delete existing assets before importing)
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      Removes all currently loaded assets and links so your uploaded document
                      becomes the exact single source of truth.
                    </p>
                  </div>
                </div>
                <Switch
                  id="clean-reset-toggle"
                  checked={cleanReset}
                  onCheckedChange={setCleanReset}
                />
              </div>

              <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/5 p-3.5">
                <div className="flex items-start gap-3">
                  <CalendarCheck className="mt-0.5 size-4 text-primary" aria-hidden="true" />
                  <div>
                    <Label
                      htmlFor="auto-pm-toggle"
                      className="text-xs font-bold text-foreground cursor-pointer"
                    >
                      Auto-Generate PM Schedules for Equipment
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      Seeds quarterly & semi-annual lubrication, seal inspection, and vibration PMs.
                    </p>
                  </div>
                </div>
                <Switch
                  id="auto-pm-toggle"
                  checked={autoGeneratePms}
                  onCheckedChange={setAutoGeneratePms}
                />
              </div>
            </div>

            {/* Hierarchical Preview Tree */}
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="bg-muted px-4 py-2 text-xs font-bold text-foreground flex items-center justify-between">
                <span>Document Hierarchy Preview (Assets & Nested Parts)</span>
                <span className="text-[11px] text-muted-foreground font-normal">
                  Showing first {Math.min(10, parsedAssets.length)} assets
                </span>
              </div>
              <div className="overflow-y-auto max-h-72 p-3 space-y-3">
                {parsedAssets.slice(0, 10).map((asset, idx) => (
                  <div key={idx} className="rounded-lg border border-border bg-background/70 p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Boxes className="size-4 text-primary" />
                        <span className="font-bold text-sm text-foreground">{asset.name}</span>
                        {asset.tag_number && (
                          <Badge variant="outline" className="font-mono text-[10px]">
                            {asset.tag_number}
                          </Badge>
                        )}
                        <Badge variant="secondary" className="text-[10px]">
                          {asset.class}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">{asset.building}</span>
                    </div>

                    {/* Tabbed-over nested parts section */}
                    {asset.parts && asset.parts.length > 0 ? (
                      <div className="mt-2.5 ml-4 border-l-2 border-primary/40 pl-3 space-y-1.5">
                        <div className="text-[11px] font-semibold text-primary flex items-center gap-1">
                          <Package className="size-3" /> Tabbed Parts for this Unit (
                          {asset.parts.length}):
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {asset.parts.map((p, pIdx) => (
                            <div
                              key={pIdx}
                              className="flex items-center justify-between rounded bg-muted/40 px-2.5 py-1 text-xs"
                            >
                              <span className="font-medium text-foreground truncate max-w-[180px]">
                                ↳ {p.name}
                              </span>
                              <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono">
                                {p.part_number && <span>#{p.part_number}</span>}
                                {p.qty_on_hand !== undefined && <span>Qty: {p.qty_on_hand}</span>}
                                {p.unit_cost !== undefined && <span>${p.unit_cost}</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-1.5 ml-4 text-[11px] text-muted-foreground italic">
                        ↳ No parts attached in document row
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-border pt-4">
              <Button variant="outline" size="sm" onClick={() => setStep(isHierarchical ? 1 : 2)}>
                <ArrowLeft className="mr-1.5 size-3.5" /> Back
              </Button>
              <Button size="sm" onClick={executeImport} className="font-bold">
                <Boxes className="mr-1.5 size-4" /> Start Ingestion ({parsedAssets.length} Assets,{" "}
                {totalNestedPartsCount} Parts)
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Progress / Done */}
        {step === 4 && (
          <div className="mt-6 flex flex-col items-center justify-center py-8 text-center space-y-4">
            {isImporting ? (
              <>
                <RefreshCw className="size-12 animate-spin text-primary" aria-hidden="true" />
                <h3 className="text-lg font-bold text-foreground">
                  Ingesting & Linking Fleet ({progress.current} / {progress.total})
                </h3>
                <p className="max-w-md text-xs text-muted-foreground">
                  Creating asset records, setting up inventory parts, and linking units to their
                  bill of materials…
                </p>
                <div className="w-full max-w-md bg-muted rounded-full h-3 overflow-hidden border border-border">
                  <div
                    className="bg-primary h-full transition-all duration-200"
                    style={{
                      width: `${progress.total ? (progress.current / progress.total) * 100 : 0}%`,
                    }}
                  />
                </div>
              </>
            ) : resultSummary ? (
              <>
                <div className="flex size-14 items-center justify-center rounded-full bg-success/10 text-success">
                  <CheckCircle2 className="size-8" aria-hidden="true" />
                </div>
                <h3 className="text-xl font-bold text-foreground">
                  Fleet & Parts Successfully Ingested!
                </h3>
                <p className="max-w-md text-xs text-muted-foreground">
                  Your equipment register is configured with nested parts linked directly under each
                  unit.
                </p>

                <div className="grid grid-cols-3 gap-3 w-full max-w-md my-2">
                  <div className="rounded-lg border border-border bg-card p-3">
                    <span className="text-xs text-muted-foreground">Assets</span>
                    <p className="text-xl font-bold text-foreground">{resultSummary.inserted}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-card p-3">
                    <span className="text-xs text-muted-foreground">Parts Linked</span>
                    <p className="text-xl font-bold text-primary">{resultSummary.partsLinked}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-card p-3">
                    <span className="text-xs text-muted-foreground">PM Tasks</span>
                    <p className="text-xl font-bold text-foreground">{resultSummary.pmsCreated}</p>
                  </div>
                </div>

                <div className="pt-4">
                  <Button
                    onClick={() => {
                      resetState();
                      onOpenChange(false);
                    }}
                    className="font-bold"
                  >
                    View Asset Register
                  </Button>
                </div>
              </>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

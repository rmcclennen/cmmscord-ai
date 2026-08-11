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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  KNOWN_FIELDS,
  autoDetectColumns,
  parseCsvText,
  transformRowsToAssets,
  downloadSampleAssetCsv,
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

  const [autoGeneratePms, setAutoGeneratePms] = useState<boolean>(true);
  const [parsedAssets, setParsedAssets] = useState<ParsedAssetRow[]>([]);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [progress, setProgress] = useState<{ current: number; total: number }>({
    current: 0,
    total: 0,
  });
  const [resultSummary, setResultSummary] = useState<{
    inserted: number;
    pmsCreated: number;
  } | null>(null);

  const resetState = () => {
    setStep(1);
    setFileName("");
    setRawText("");
    setHeaders([]);
    setRawRows([]);
    setParsedAssets([]);
    setIsImporting(false);
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
      const { headers: parsedHeaders, rows: parsedRows } = parseCsvText(text);
      if (parsedHeaders.length === 0 || parsedRows.length === 0) {
        toast.error("No valid data rows found in the uploaded file.");
        return;
      }
      setHeaders(parsedHeaders);
      setRawRows(parsedRows);

      const autoMap = autoDetectColumns(parsedHeaders);
      setMapping(autoMap);
      setStep(2);
      toast.success(`Loaded ${parsedRows.length} rows with ${parsedHeaders.length} columns.`);
    } catch {
      toast.error("Failed to parse file. Please upload a standard CSV or TSV file.");
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

  const executeImport = async () => {
    if (parsedAssets.length === 0) return;
    setIsImporting(true);
    setStep(4);
    setProgress({ current: 0, total: parsedAssets.length });

    try {
      const res = await bulkInsertAssets(parsedAssets, {
        generatePmSchedules: autoGeneratePms,
        onProgress: (curr, tot) => setProgress({ current: curr, total: tot }),
      });

      setResultSummary(res);
      queryClient.invalidateQueries({ queryKey: ["assets-all"] });
      queryClient.invalidateQueries({ queryKey: ["pm-schedules-all"] });
      toast.success(`Successfully imported ${res.inserted} assets!`);
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Failed to insert assets";
      toast.error(errMsg);
      setIsImporting(false);
    }
  };

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
                  Bulk Asset Importer & Fleet Onboarding
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Import hundreds of pumps, motors, blowers, and plant assets in seconds from your
                  existing spreadsheets.
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
                Drop your asset spreadsheet here (.csv, .tsv, .xlsx export)
              </h3>
              <p className="mt-1 max-w-md text-xs text-muted-foreground">
                Drag and drop your plant equipment export or select a file from your computer.
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
                  Select File from Computer
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={downloadSampleAssetCsv}
                  className="flex items-center gap-2 text-xs font-semibold"
                >
                  <Download className="size-4 text-primary" />
                  Download Sample CSV Template
                </Button>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <FileText className="size-3.5 text-primary" /> Or Paste Raw CSV / Tab-Delimited Data
              </h4>
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Asset Name, Tag Number, Equipment Class, Make, Model, Serial Number, Location, Building&#10;Influent Pump #1, PMP-101, PMP, Flygt, NP 3153, FL-889421, Wet Well 1, Headworks"
                className="mt-2 h-28 w-full rounded-md border border-input bg-background p-3 font-mono text-xs text-foreground focus-visible:ring-2 focus-visible:ring-primary"
              />
              {rawText.trim().length > 0 && (
                <div className="mt-3 flex justify-end">
                  <Button size="sm" onClick={() => processFileText(rawText)} className="font-bold">
                    Parse Pasted Data <ArrowRight className="ml-1 size-3.5" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Column Mapping */}
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
              Verify how your spreadsheet columns correspond to AssetCareConnect equipment fields.
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
                  Total Assets to Import
                </p>
                <p className="text-2xl font-bold text-foreground">{parsedAssets.length}</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-3 text-center">
                <p className="text-[11px] text-muted-foreground font-semibold uppercase">
                  Equipment Classes
                </p>
                <p className="text-2xl font-bold text-primary">
                  {new Set(parsedAssets.map((a) => a.class)).size} Types
                </p>
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

            {/* PM Automation Toggle */}
            <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/5 p-4">
              <div className="flex items-start gap-3">
                <CalendarCheck className="mt-0.5 size-5 text-primary" aria-hidden="true" />
                <div>
                  <Label
                    htmlFor="auto-pm-toggle"
                    className="text-xs font-bold text-foreground cursor-pointer"
                  >
                    Auto-Generate Preventive Maintenance (PM) Schedules
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    Automatically seeds manufacturer-grade quarterly & semi-annual inspection
                    schedules for pumps, motors, and electrical gear.
                  </p>
                </div>
              </div>
              <Switch
                id="auto-pm-toggle"
                checked={autoGeneratePms}
                onCheckedChange={setAutoGeneratePms}
              />
            </div>

            {/* Preview Table */}
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="bg-muted px-4 py-2 text-xs font-bold text-foreground">
                First 5 Assets Preview (of {parsedAssets.length})
              </div>
              <div className="overflow-x-auto max-h-60">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Asset Name</TableHead>
                      <TableHead>Tag #</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead>Make / Model</TableHead>
                      <TableHead>Building</TableHead>
                      <TableHead>Criticality</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedAssets.slice(0, 5).map((a, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-semibold text-xs text-foreground">
                          {a.name}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {a.tag_number || "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{a.class}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {[a.make, a.model].filter(Boolean).join(" · ") || "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {a.building}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={a.criticality === "high" ? "destructive" : "outline"}
                            className="text-[10px]"
                          >
                            {a.criticality}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-border pt-4">
              <Button variant="outline" size="sm" onClick={() => setStep(2)}>
                <ArrowLeft className="mr-1.5 size-3.5" /> Back to Mapping
              </Button>
              <Button size="sm" onClick={executeImport} className="font-bold">
                <Boxes className="mr-1.5 size-4" /> Start Ingestion ({parsedAssets.length} Assets)
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
                  Ingesting Equipment Fleet ({progress.current} / {progress.total})
                </h3>
                <p className="max-w-md text-xs text-muted-foreground">
                  Writing asset records, assigning plant buildings, and generating PM maintenance
                  calendars…
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
                <h3 className="text-xl font-bold text-foreground">Fleet Successfully Onboarded!</h3>
                <p className="max-w-md text-xs text-muted-foreground">
                  Your equipment register is live in AssetCareConnect and ready for dispatch, PM
                  scheduling, and work orders.
                </p>

                <div className="grid grid-cols-2 gap-4 w-full max-w-sm my-2">
                  <div className="rounded-lg border border-border bg-card p-3">
                    <span className="text-xs text-muted-foreground">Assets Imported</span>
                    <p className="text-xl font-bold text-foreground">{resultSummary.inserted}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-card p-3">
                    <span className="text-xs text-muted-foreground">PM Tasks Seeded</span>
                    <p className="text-xl font-bold text-primary">{resultSummary.pmsCreated}</p>
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

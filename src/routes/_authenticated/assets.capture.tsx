import { useRef, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useSessionUser } from "@/hooks/use-session-user";
import { readNameplate, type NameplateReading } from "@/lib/nameplate.functions";
import { fileToJpegDataUrl, saveAssetPhoto, PHOTO_KIND_LABEL, type PhotoKind } from "@/lib/photos";
import { ALL_BUILDING_OPTIONS } from "@/lib/cmms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Camera, Loader2, Save, Sparkles, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/assets/capture")({
  head: () => ({
    meta: [
      { title: "Capture Equipment Photo — AssetCareConnect" },
      {
        name: "description",
        content:
          "Photograph a piece of plant equipment and its nameplate to add it to the AssetCareConnect asset register automatically.",
      },
      { property: "og:title", content: "Capture Equipment Photo — AssetCareConnect" },
      {
        property: "og:description",
        content:
          "Snap an equipment nameplate and let AssetCareConnect read the make, model and serial into your register.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CaptureAsset,
});

type Shot = { dataUrl: string; kind: PhotoKind };

const FIELDS: { key: keyof Form; label: string }[] = [
  { key: "tag_number", label: "Tag number" },
  { key: "manufacturer", label: "Manufacturer" },
  { key: "make", label: "Make" },
  { key: "model", label: "Model" },
  { key: "serial_number", label: "Serial number" },
  { key: "type", label: "Type" },
  { key: "hp", label: "HP" },
  { key: "rpm", label: "RPM" },
  { key: "volts", label: "Volts" },
  { key: "phase", label: "Phase" },
  { key: "hertz", label: "Hertz" },
  { key: "frame", label: "Frame" },
  { key: "enclosure", label: "Enclosure" },
  { key: "location_name", label: "Location" },
];

type Form = {
  name: string;
  tag_number: string;
  manufacturer: string;
  make: string;
  model: string;
  serial_number: string;
  type: string;
  hp: string;
  rpm: string;
  volts: string;
  phase: string;
  hertz: string;
  frame: string;
  enclosure: string;
  location_name: string;
  notes: string;
};

const EMPTY: Form = {
  name: "",
  tag_number: "",
  manufacturer: "",
  make: "",
  model: "",
  serial_number: "",
  type: "",
  hp: "",
  rpm: "",
  volts: "",
  phase: "",
  hertz: "",
  frame: "",
  enclosure: "",
  location_name: "",
  notes: "",
};

function CaptureAsset() {
  const navigate = useNavigate();
  const { user } = useSessionUser();
  const runRead = useServerFn(readNameplate);
  const fileInput = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<PhotoKind>("nameplate");
  const [shots, setShots] = useState<Shot[]>([]);
  const [hint, setHint] = useState("");
  const [form, setForm] = useState<Form>(EMPTY);
  const [building, setBuilding] = useState("auto");
  const [criticality, setCriticality] = useState("medium");
  const [reading, setReading] = useState<NameplateReading | null>(null);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);

  async function onPick(file: File | undefined) {
    if (!file) return;
    try {
      const dataUrl = await fileToJpegDataUrl(file);
      setShots((prev) => [...prev, { dataUrl, kind }]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not read that photo");
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function scan() {
    const labels = shots.filter((s) => s.kind === "nameplate");
    const pool = (labels.length > 0 ? labels : shots).slice(0, 3);
    if (pool.length === 0) {
      toast.error("Take a photo of the nameplate first.");
      return;
    }
    setScanning(true);
    try {
      const result = await runRead({
        data: { images: pool.map((s) => s.dataUrl), hint: hint || undefined },
      });
      setReading(result);
      setForm((prev) => ({
        ...prev,
        name: prev.name || result.name || "",
        manufacturer: prev.manufacturer || result.manufacturer || "",
        make: prev.make || result.make || result.manufacturer || "",
        model: prev.model || result.model || "",
        serial_number: prev.serial_number || result.serial_number || "",
        type: prev.type || result.type || "",
        hp: prev.hp || result.hp || "",
        rpm: prev.rpm || result.rpm || "",
        volts: prev.volts || result.volts || "",
        phase: prev.phase || result.phase || "",
        hertz: prev.hertz || result.hertz || "",
        frame: prev.frame || result.frame || "",
        enclosure: prev.enclosure || result.enclosure || "",
        notes: prev.notes || result.notes || "",
      }));
      toast.success("Nameplate read — check the fields before saving");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not read the nameplate");
    } finally {
      setScanning(false);
    }
  }

  async function save() {
    if (!user) return;
    if (!form.name.trim()) {
      toast.error("Give the asset a name.");
      return;
    }
    setSaving(true);
    try {
      const extras: Partial<Record<keyof Form, string>> = {};
      for (const { key } of FIELDS) {
        const value = form[key].trim();
        if (value) extras[key] = value;
      }
      const payload = {
        ...extras,
        name: form.name.trim(),
        criticality,
        status: "active",
        ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
        ...(building !== "auto" ? { building } : {}),
      };

      const { data: asset, error } = await supabase
        .from("assets")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;

      for (const shot of shots) {
        await saveAssetPhoto({
          assetId: asset.id,
          dataUrl: shot.dataUrl,
          kind: shot.kind,
          userId: user.id,
        });
      }
      toast.success("Asset added to the register");
      navigate({ to: "/assets/$assetId", params: { assetId: asset.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the asset");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/assets">
            <ArrowLeft className="size-4" /> Assets
          </Link>
        </Button>
      </div>

      <div>
        <p className="label-caps">Add asset by photo</p>
        <h1 className="text-2xl font-bold">Capture equipment</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Photograph the equipment and its nameplate. The label is read automatically to fill in
          make, model, serial and electrical data.
        </p>
      </div>

      <div className="panel space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={kind} onValueChange={(v) => setKind(v as PhotoKind)}>
            <SelectTrigger className="h-9 w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="nameplate">{PHOTO_KIND_LABEL.nameplate}</SelectItem>
              <SelectItem value="equipment">{PHOTO_KIND_LABEL.equipment}</SelectItem>
            </SelectContent>
          </Select>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => onPick(e.target.files?.[0])}
          />
          <Button onClick={() => fileInput.current?.click()}>
            <Camera className="size-4" /> Take photo
          </Button>
          <Button variant="outline" onClick={scan} disabled={scanning || shots.length === 0}>
            {scanning ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}{" "}
            Read nameplate
          </Button>
          {reading && <Badge variant="outline">Confidence: {reading.confidence}</Badge>}
        </div>

        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {shots.map((s, i) => (
            <div key={i} className="relative overflow-hidden rounded-md border border-border">
              <img
                src={s.dataUrl}
                alt={`${s.kind} photo ${i + 1}`}
                className="h-36 w-full object-cover"
              />
              <span className="absolute left-2 top-2 rounded bg-background/85 px-2 py-0.5 text-xs">
                {PHOTO_KIND_LABEL[s.kind]}
              </span>
              <Button
                size="sm"
                variant="secondary"
                className="absolute right-1 top-1 size-7 p-0"
                aria-label="Remove photo"
                onClick={() => setShots((prev) => prev.filter((_, idx) => idx !== i))}
              >
                <X className="size-4" />
              </Button>
            </div>
          ))}
          {shots.length === 0 && <p className="text-sm text-muted-foreground">No photos yet.</p>}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="hint">What is this equipment? (optional, helps the reader)</Label>
          <Input
            id="hint"
            placeholder="e.g. RAS pump #3 motor in the blower building"
            value={hint}
            onChange={(e) => setHint(e.target.value)}
          />
        </div>
      </div>

      <div className="panel space-y-4 p-4">
        <p className="label-caps">Asset details</p>
        <div className="grid gap-2">
          <Label htmlFor="name">Asset name *</Label>
          <Input
            id="name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FIELDS.map(({ key, label }) => (
            <div key={key} className="grid gap-2">
              <Label htmlFor={key}>{label}</Label>
              <Input
                id={key}
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
            </div>
          ))}
          <div className="grid gap-2">
            <Label>Building / area</Label>
            <Select value={building} onValueChange={setBuilding}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto — infer from name</SelectItem>
                {ALL_BUILDING_OPTIONS.map((b) => (
                  <SelectItem key={b} value={b}>
                    {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Criticality</Label>
            <Select value={criticality} onValueChange={setCriticality}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </div>

        <Button onClick={save} disabled={saving || !user}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save
          asset
        </Button>
      </div>
    </div>
  );
}

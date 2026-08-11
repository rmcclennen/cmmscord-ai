import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useSessionUser } from "@/hooks/use-session-user";
import { readNameplate } from "@/lib/nameplate.functions";
import {
  fileToJpegDataUrl,
  saveAssetPhoto,
  signedPhotoUrls,
  PHOTO_KIND_LABEL,
  type PhotoKind,
} from "@/lib/photos";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Camera, Loader2, Sparkles, Trash2 } from "lucide-react";

const FILLABLE = [
  "manufacturer",
  "make",
  "model",
  "serial_number",
  "type",
  "hp",
  "rpm",
  "volts",
  "phase",
  "hertz",
  "frame",
  "enclosure",
] as const;

export function AssetPhotosPanel({ assetId }: { assetId: string }) {
  const { user } = useSessionUser();
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<PhotoKind>("nameplate");
  const [busy, setBusy] = useState(false);
  const runRead = useServerFn(readNameplate);

  const photos = useQuery({
    queryKey: ["asset-photos", assetId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asset_photos")
        .select("id, storage_path, kind, caption, created_at")
        .eq("asset_id", assetId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const urls = await signedPhotoUrls((data ?? []).map((p) => p.storage_path));
      return (data ?? []).map((p) => ({ ...p, url: urls[p.storage_path] ?? null }));
    },
  });

  async function onPick(file: File | undefined) {
    if (!file || !user) return;
    setBusy(true);
    try {
      const dataUrl = await fileToJpegDataUrl(file);
      await saveAssetPhoto({ assetId, dataUrl, kind, userId: user.id });
      await queryClient.invalidateQueries({ queryKey: ["asset-photos", assetId] });
      toast.success("Photo added to this asset");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the photo");
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  const removePhoto = useMutation({
    mutationFn: async (photo: { id: string; storage_path: string }) => {
      const { error } = await supabase.from("asset_photos").delete().eq("id", photo.id);
      if (error) throw error;
      await supabase.storage.from("asset-photos").remove([photo.storage_path]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["asset-photos", assetId] });
      toast.success("Photo removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const fillFromLabel = useMutation({
    mutationFn: async () => {
      const labelPhotos = (photos.data ?? [])
        .filter((p) => p.kind === "nameplate" && p.url)
        .slice(0, 2);
      const pool =
        labelPhotos.length > 0 ? labelPhotos : (photos.data ?? []).filter((p) => p.url).slice(0, 2);
      if (pool.length === 0) throw new Error("Add a nameplate photo first.");
      const images = await Promise.all(
        pool.map(async (p) => {
          const res = await fetch(p.url as string);
          const blob = await res.blob();
          return await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(new Error("Could not read the photo"));
            reader.readAsDataURL(blob);
          });
        }),
      );
      const reading = await runRead({ data: { images } });

      const { data: current, error: currentError } = await supabase
        .from("assets")
        .select("*")
        .eq("id", assetId)
        .single();
      if (currentError) throw currentError;

      const patch: Partial<Record<(typeof FILLABLE)[number], string>> = {};
      for (const key of FILLABLE) {
        const value = reading[key];
        if (value && !current[key]) patch[key] = value;
      }
      if (Object.keys(patch).length === 0) return { filled: 0, reading };
      const { error } = await supabase.from("assets").update(patch).eq("id", assetId);
      if (error) throw error;
      return { filled: Object.keys(patch).length, reading };
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["asset", assetId] });
      queryClient.invalidateQueries({ queryKey: ["assets-all"] });
      toast.success(
        res.filled === 0
          ? "Nameplate read — nothing new to fill in"
          : `Filled ${res.filled} field${res.filled === 1 ? "" : "s"} from the nameplate`,
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="panel space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="label-caps">Equipment photos</p>
          <p className="text-sm text-muted-foreground">
            Snap the equipment and its nameplate — the label photo can fill in missing spec fields.
          </p>
        </div>
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
          <Button onClick={() => fileInput.current?.click()} disabled={busy || !user}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}{" "}
            Take photo
          </Button>
          <Button
            variant="outline"
            onClick={() => fillFromLabel.mutate()}
            disabled={fillFromLabel.isPending || (photos.data ?? []).length === 0}
          >
            {fillFromLabel.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            Read nameplate
          </Button>
        </div>
      </div>

      {photos.isLoading && <p className="text-sm text-muted-foreground">Loading photos…</p>}
      {!photos.isLoading && (photos.data ?? []).length === 0 && (
        <p className="text-sm text-muted-foreground">No photos yet for this asset.</p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(photos.data ?? []).map((p) => (
          <div key={p.id} className="overflow-hidden rounded-md border border-border">
            {p.url ? (
              <img
                src={p.url}
                alt={`${p.kind} photo of asset`}
                className="h-40 w-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="flex h-40 items-center justify-center text-xs text-muted-foreground">
                Unavailable
              </div>
            )}
            <div className="flex items-center justify-between gap-2 px-2 py-1.5">
              <Badge variant="outline">{PHOTO_KIND_LABEL[p.kind as PhotoKind] ?? p.kind}</Badge>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => removePhoto.mutate(p)}
                disabled={removePhoto.isPending}
                aria-label="Remove photo"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

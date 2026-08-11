import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import type { ReactNode } from "react";

type Props = {
  trigger: ReactNode;
  assetId?: string | null;
  lockAsset?: boolean;
};

export function ManualDialog({ trigger, assetId, lockAsset }: Props) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [notes, setNotes] = useState("");
  const [asset, setAsset] = useState<string | null>(assetId ?? null);
  const [assetSearch, setAssetSearch] = useState("");
  const queryClient = useQueryClient();

  const assetOptions = useQuery({
    queryKey: ["asset-options", assetSearch],
    enabled: open && !lockAsset,
    queryFn: async () => {
      let query = supabase.from("assets").select("id, name").order("name").limit(25);
      if (assetSearch.trim()) query = query.ilike("name", `%${assetSearch.trim()}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("manuals").insert({
        title: title.trim(),
        file_url: fileUrl.trim(),
        kind: "link",
        asset_id: asset,
        manufacturer: manufacturer.trim() || null,
        notes: notes.trim() || null,
        added_by: userData.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Manual added");
      queryClient.invalidateQueries({ queryKey: ["manuals"] });
      queryClient.invalidateQueries({ queryKey: ["asset-manuals"] });
      setOpen(false);
      setTitle("");
      setFileUrl("");
      setManufacturer("");
      setNotes("");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <span onClick={() => setOpen(true)}>{trigger}</span>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add manual</DialogTitle>
          <DialogDescription>
            Link an O&amp;M manual, cut sheet, or drawing and attach it to an asset.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="man-title">Title</Label>
            <Input
              id="man-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Gorman-Rupp T Series O&M Manual"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="man-url">Document link</Label>
            <Input
              id="man-url"
              value={fileUrl}
              onChange={(e) => setFileUrl(e.target.value)}
              placeholder="https://manufacturer.com/manual.pdf"
            />
            <p className="text-xs text-muted-foreground">
              Paste a manufacturer PDF URL. To load a file from your computer, send it in chat and
              it will be hosted here.
            </p>
          </div>
          {!lockAsset && (
            <div className="space-y-1.5">
              <Label htmlFor="man-asset">Attach to asset</Label>
              <Input
                id="man-asset"
                value={assetSearch}
                onChange={(e) => setAssetSearch(e.target.value)}
                placeholder="Search assets…"
              />
              <Select value={asset ?? ""} onValueChange={setAsset}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an asset (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {(assetOptions.data ?? []).map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="man-make">Manufacturer</Label>
            <Input
              id="man-make"
              value={manufacturer}
              onChange={(e) => setManufacturer(e.target.value)}
              placeholder="Schwing Bioset"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="man-notes">Notes</Label>
            <Textarea
              id="man-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Revision, section of interest, model coverage…"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={!title.trim() || !fileUrl.trim() || create.isPending}
            onClick={() => create.mutate()}
          >
            {create.isPending ? "Saving…" : "Add manual"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

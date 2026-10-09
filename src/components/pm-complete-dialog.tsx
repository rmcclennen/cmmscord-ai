import { useRef, useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { writeOrQueue } from "@/lib/offline-sync";
import { clampToSeason } from "@/lib/cmms";
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

export const isoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Next due date: completion date + interval, pushed into the PM's season if it has one. */
export function nextDueAfter(
  completedOn: string,
  intervalDays: number,
  seasonStart: string | null,
  seasonEnd: string | null,
): string {
  const base = new Date(`${completedOn}T00:00:00`);
  base.setDate(base.getDate() + intervalDays);
  return clampToSeason(isoDay(base), seasonStart, seasonEnd);
}

type Props = {
  trigger: ReactNode;
  pm: {
    id: string;
    title: string;
    interval_days: number;
    season_start_md: string | null;
    season_end_md: string | null;
  };
  completedOn?: string;
};

export function PmCompleteDialog({ trigger, pm, completedOn }: Props) {
  const [open, setOpen] = useState(false);
  const [hours, setHours] = useState("");
  const [parts, setParts] = useState("");
  const [notes, setNotes] = useState("");
  const clientId = useRef<string | null>(null);
  const queryClient = useQueryClient();

  const complete = useMutation({
    networkMode: "always",
    mutationFn: async () => {
      const done = completedOn ?? isoDay(new Date());
      const args = {
        _pm_id: pm.id,
        _completed_on: done,
        _next_due: nextDueAfter(done, pm.interval_days, pm.season_start_md, pm.season_end_md),
        ...(hours.trim() ? { _labor_hours: Number(hours) } : {}),
        ...(notes.trim() ? { _notes: notes.trim() } : {}),
        ...(parts.trim() ? { _parts_used: parts.trim() } : {}),
        // Lets the server ignore a resend of the same completion.
        _client_id: (clientId.current ??= crypto.randomUUID()),
      };
      return writeOrQueue({ kind: "rpc", fn: "complete_pm", args }, async () => {
        const { error } = await supabase.rpc("complete_pm", args);
        if (error) throw error;
      });
    },
    onSuccess: (result) => {
      clientId.current = null;
      toast.success(
        result.queued
          ? "Saved on this device. It will be sent when you're back online."
          : "PM completed and rescheduled",
      );
      void queryClient.invalidateQueries({ queryKey: ["pms"] });
      void queryClient.invalidateQueries({ queryKey: ["work-orders"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setOpen(false);
      setHours("");
      setParts("");
      setNotes("");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const hoursInvalid = hours.trim() !== "" && !(Number(hours) >= 0 && Number(hours) <= 999);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <span onClick={() => setOpen(true)}>{trigger}</span>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Complete PM</DialogTitle>
          <DialogDescription>{pm.title}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pmc-hours">Labor hours (optional)</Label>
            <Input
              id="pmc-hours"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.25"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              aria-invalid={hoursInvalid}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pmc-parts">Parts used (optional)</Label>
            <Input
              id="pmc-parts"
              value={parts}
              onChange={(e) => setParts(e.target.value)}
              placeholder="2 × V-belt B68, 1 grease cartridge"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pmc-notes">Findings / notes (optional)</Label>
            <Textarea
              id="pmc-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Bearing running warm, recheck next visit"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Next due date is set automatically: {pm.interval_days} days from today
            {pm.season_start_md ? ", inside this PM's season" : ""}.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button disabled={hoursInvalid || complete.isPending} onClick={() => complete.mutate()}>
            {complete.isPending ? "Saving…" : "Mark complete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

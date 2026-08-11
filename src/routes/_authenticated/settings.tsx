import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSessionUser } from "@/hooks/use-session-user";
import { CARRIERS, formatPhone, normalizePhone, smsGatewayAddress } from "@/lib/carriers";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { MailCheck, MessageSquare, Save } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Alert Settings | AssetCareConnect" },
      {
        name: "description",
        content:
          "Choose how work order and PM assignments reach you — email inbox, text message, or both.",
      },
      { property: "og:title", content: "Alert Settings" },
      {
        property: "og:description",
        content: "Set your phone, carrier and alert channels for plant maintenance assignments.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useSessionUser();
  const queryClient = useQueryClient();

  const profile = useQuery({
    queryKey: ["my-profile", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, full_name, phone, carrier, notify_email, notify_sms")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [carrier, setCarrier] = useState("");
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifySms, setNotifySms] = useState(false);

  useEffect(() => {
    const p = profile.data;
    if (!p) return;
    setFullName(p.full_name ?? "");
    setPhone(formatPhone(p.phone));
    setCarrier(p.carrier ?? "");
    setNotifyEmail(p.notify_email ?? true);
    setNotifySms(p.notify_sms ?? false);
  }, [profile.data]);

  const gateway = smsGatewayAddress(phone, carrier);
  const phoneInvalid = phone.trim().length > 0 && !normalizePhone(phone);

  const save = useMutation({
    mutationFn: async () => {
      if (phoneInvalid) throw new Error("Enter a 10-digit US mobile number.");
      if (notifySms && !gateway)
        throw new Error("Text alerts need both a valid mobile number and a carrier.");
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim() || null,
          phone: normalizePhone(phone),
          carrier: carrier || null,
          notify_email: notifyEmail,
          notify_sms: notifySms,
        })
        .eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Alert settings saved");
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Alert settings</h1>
        <p className="text-sm text-muted-foreground">
          Pick how assignments reach you. In-app alerts always show in the bell; email and text are
          optional.
        </p>
      </div>

      <div className="space-y-5 rounded-lg border border-border bg-card p-5">
        <div className="space-y-2">
          <Label htmlFor="full-name">Name</Label>
          <Input
            id="full-name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            maxLength={80}
          />
        </div>

        <div className="space-y-2">
          <Label>Account email</Label>
          <Input value={profile.data?.email ?? ""} readOnly className="bg-muted/40" />
        </div>

        <div className="flex items-start justify-between gap-4 rounded-md border border-border p-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <MailCheck className="size-4 text-primary" />
              Email alerts
            </div>
            <p className="text-xs text-muted-foreground">
              Full details in your inbox when a work order or PM is assigned to you.
            </p>
          </div>
          <Switch
            checked={notifyEmail}
            onCheckedChange={setNotifyEmail}
            aria-label="Email alerts"
          />
        </div>

        <div className="space-y-4 rounded-md border border-border p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <MessageSquare className="size-4 text-primary" />
                Text alerts (carrier gateway)
              </div>
              <p className="text-xs text-muted-foreground">
                Free — the alert is emailed to your carrier's text gateway. Short message,
                best-effort delivery.
              </p>
            </div>
            <Switch checked={notifySms} onCheckedChange={setNotifySms} aria-label="Text alerts" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="phone">Mobile number</Label>
              <Input
                id="phone"
                inputMode="tel"
                placeholder="(555) 123-4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                maxLength={20}
                aria-invalid={phoneInvalid}
              />
              {phoneInvalid && <p className="text-xs text-destructive">Needs 10 digits.</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="carrier">Carrier</Label>
              <Select value={carrier} onValueChange={setCarrier}>
                <SelectTrigger id="carrier">
                  <SelectValue placeholder="Select carrier" />
                </SelectTrigger>
                <SelectContent>
                  {CARRIERS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {gateway && (
            <p className="font-mono text-xs text-muted-foreground">
              Texts route through <span className="text-foreground">{gateway}</span>
            </p>
          )}
        </div>

        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          <Save className="size-4" />
          {save.isPending ? "Saving…" : "Save settings"}
        </Button>
      </div>

      <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 text-xs text-muted-foreground">
        <Badge variant="outline" className="mb-2">
          Sending not live yet
        </Badge>
        <p>
          Email and text alerts are wired up but stay queued until a sender domain is verified for
          the plant (a domain you own, set up once). Until then every assignment still lands in the
          in-app bell.
        </p>
      </div>
    </div>
  );
}

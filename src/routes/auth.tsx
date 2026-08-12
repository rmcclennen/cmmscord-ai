import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { ensureUserSynced } from "@/lib/team-sync";
import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Waves } from "lucide-react";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in | AssetCareConnect" },
      {
        name: "description",
        content: "Sign in to the enterprise asset, PM, and work order management system.",
      },
      { property: "og:title", content: "Sign in | AssetCareConnect" },
      {
        property: "og:description",
        content: "Team access to plant assets, PM schedules, and work orders.",
      },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) throw redirect({ to: "/pm-schedule" });
  },
  component: AuthPage,
});

function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [tab, setTab] = useState<string>("signin");
  const [invitedRole, setInvitedRole] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const inviteParam = params.get("invite");
      const emailParam = params.get("email");
      const nameParam = params.get("name");
      const roleParam = params.get("role");

      if (emailParam) setEmail(emailParam);
      if (nameParam) setFullName(nameParam);
      if (roleParam) setInvitedRole(roleParam);
      if (inviteParam === "1" || (emailParam && !params.has("signin"))) {
        setTab("signup");
      }
    }
  }, []);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, session) => {
      if (session?.user) {
        await ensureUserSynced(session.user, invitedRole).catch(() => {});
        window.location.replace("/pm-schedule");
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [invitedRole]);

  async function signIn() {
    setBusy(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (data?.user) {
      await ensureUserSynced(data.user, invitedRole).catch(() => {});
    }
    setBusy(false);
    if (error) toast.error(error.message);
  }

  async function signUp() {
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin, data: { full_name: fullName } },
    });
    if (data?.user) {
      await ensureUserSynced(data.user, invitedRole).catch(() => {});
    }
    setBusy(false);
    if (error) {
      toast.error(error.message);
    } else if (!data.session) {
      toast.success("Account created! Check your email to confirm if required or sign in.");
    }
  }

  async function google() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) toast.error("Google sign-in failed. Please try again.");
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground font-black text-sm">
            AC
          </div>
          <span className="text-sm font-extrabold uppercase tracking-wider">AssetCareConnect</span>
        </div>
        <div>
          <h1 className="text-4xl font-bold leading-tight">
            Every asset, every PM, every work order — one control room.
          </h1>
          <p className="mt-4 max-w-md text-sm text-sidebar-foreground/70">
            Site-specific equipment management, OEM manufacturer suggested lubrication &amp; belt
            specs, automated PM schedules, and direct parts routing built by plant operators and
            maintenance pros.
          </p>
        </div>
        <p className="font-mono text-xs text-sidebar-foreground/50">
          ENTERPRISE MAINTENANCE OPERATIONS
        </p>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm panel p-6">
          {invitedRole && (
            <div className="mb-4 rounded-lg border border-primary/30 bg-primary/10 p-3 text-xs">
              <p className="font-semibold text-primary">Team Access Invitation</p>
              <p className="mt-0.5 text-muted-foreground">
                You've been invited as{" "}
                <strong className="text-foreground">{invitedRole.replace(/_/g, " ")}</strong>.
                Create your password to activate your plant workspace access.
              </p>
            </div>
          )}

          <h2 className="text-lg font-semibold">Team access</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in to your plant maintenance account.
          </p>

          <div className="mt-4 rounded-md border border-border bg-muted/40 p-3">
            <p className="label-caps">Demo access</p>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              demo@cmmscord.ai / CMMSdemo2026!
            </p>
            <Button
              size="sm"
              variant="secondary"
              className="mt-2 w-full"
              onClick={() => {
                setEmail("demo@cmmscord.ai");
                setPassword("CMMSdemo2026!");
                setTab("signin");
              }}
            >
              Fill demo credentials
            </Button>
          </div>

          <Button variant="outline" className="mt-5 w-full" onClick={google}>
            Continue with Google
          </Button>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="label-caps">or email</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="w-full">
              <TabsTrigger value="signin" className="flex-1">
                Sign in
              </TabsTrigger>
              <TabsTrigger value="signup" className="flex-1">
                Create account
              </TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="email">Work email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button className="w-full" disabled={busy} onClick={signIn}>
                Sign in
              </Button>
            </TabsContent>

            <TabsContent value="signup" className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="name">Full name</Label>
                <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email2">Work email</Label>
                <Input
                  id="email2"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password2">Password</Label>
                <Input
                  id="password2"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button className="w-full" disabled={busy} onClick={signUp}>
                Create account
              </Button>
            </TabsContent>
          </Tabs>

          <p className="mt-5 text-center text-xs text-muted-foreground flex items-center justify-center gap-3">
            <Link to="/" className="underline hover:text-foreground font-semibold text-primary">
              Member Portal
            </Link>
            <span>•</span>
            <Link to="/overview" className="underline hover:text-foreground">
              Public Overview &amp; Trial
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

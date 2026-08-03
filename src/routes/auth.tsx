import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
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
      { title: "Sign in | Plant Maintenance" },
      { name: "description", content: "Sign in to the wastewater plant asset, PM, and work order system." },
      { property: "og:title", content: "Sign in | Plant Maintenance" },
      { property: "og:description", content: "Team access to plant assets, PM schedules, and work orders." },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) throw redirect({ to: "/dashboard" });
  },
  component: AuthPage,
});

function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) window.location.replace("/dashboard");
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function signIn() {
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
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
    setBusy(false);
    if (error) {
      toast.error(error.message);
    } else if (!data.session) {
      toast.success("Check your email to confirm your account.");
    }
  }

  async function google() {
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) toast.error("Google sign-in failed. Please try again.");
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-2">
          <Waves className="size-6 text-sidebar-primary" />
          <span className="text-sm font-bold uppercase tracking-widest">Plant Maintenance</span>
        </div>
        <div>
          <h1 className="text-4xl font-bold leading-tight">
            Every asset, every PM, every work order — one control room.
          </h1>
          <p className="mt-4 max-w-md text-sm text-sidebar-foreground/70">
            1,160 plant assets with full nameplate data, seeded PM programs by equipment class, AI-assisted
            manufacturer maintenance lookups, and work orders your crew can act on.
          </p>
        </div>
        <p className="font-mono text-xs text-sidebar-foreground/50">WASTEWATER TREATMENT / MAINTENANCE OPS</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm panel p-6">
          <h2 className="text-lg font-semibold">Team access</h2>
          <p className="mt-1 text-sm text-muted-foreground">Sign in to your plant maintenance account.</p>

          <Button variant="outline" className="mt-5 w-full" onClick={google}>
            Continue with Google
          </Button>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="label-caps">or email</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <Tabs defaultValue="signin">
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
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
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
                <Input id="email2" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
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

          <p className="mt-5 text-center text-xs text-muted-foreground">
            <Link to="/" className="underline">
              Back to overview
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

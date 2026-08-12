import { useState, useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { ensureUserSynced } from "@/lib/team-sync";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  ShieldCheck,
  Sparkles,
  Wrench,
  CalendarClock,
  Boxes,
  FileText,
  Users,
  CheckCircle2,
  ArrowRight,
  Lock,
  Building2,
  Key,
  Zap,
  Activity,
  QrCode,
  HelpCircle,
  LogOut,
  PackageCheck,
  ClipboardList,
  Flame,
  ArrowUpRight,
  Bot,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Operator & Member Portal | AssetCareConnect" },
      {
        name: "description",
        content:
          "Dedicated access portal for existing users, plant technicians, supervisors, and plant operations staff.",
      },
      { property: "og:title", content: "Member Portal | AssetCareConnect" },
      {
        property: "og:description",
        content: "Direct access portal for authorized plant operators and maintenance staff.",
      },
    ],
  }),
  component: ExistingUsersPortalMain,
});

function ExistingUsersPortalMain() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [tab, setTab] = useState("signin");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    async function checkSession() {
      const { data } = await supabase.auth.getUser();
      setCurrentUser(data.user || null);
      setLoadingUser(false);
    }
    checkSession();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, session) => {
      setCurrentUser(session?.user || null);
      if (session?.user) {
        await ensureUserSynced(session.user).catch(() => {});
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSignIn(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!email || !password) {
      toast.error("Please enter both email and password.");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (data?.user) {
      await ensureUserSynced(data.user).catch(() => {});
      toast.success("Welcome back! Redirecting to plant control room...");
      window.location.replace("/pm-schedule");
    }
    setBusy(false);
    if (error) toast.error(error.message);
  }

  async function handleGoogleSignIn() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) toast.error("Google sign-in failed. Please try again.");
  }

  async function handleQuickDemoAccess(demoEmail: string, roleHint = "admin") {
    setBusy(true);
    setEmail(demoEmail);
    setPassword("DemoPassword123!");
    const { data, error } = await supabase.auth.signInWithPassword({
      email: demoEmail,
      password: "DemoPassword123!",
    });

    if (error) {
      // Try signing up if demo account doesn't exist yet
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: demoEmail,
        password: "DemoPassword123!",
        options: {
          data: {
            full_name:
              demoEmail.includes("sioux") || demoEmail.includes("rmcclennen")
                ? "R. McClennen (Sioux City Plant Operations)"
                : "Plant Maintenance Supervisor",
          },
        },
      });

      if (signUpError) {
        toast.error(`Quick access error: ${signUpError.message}`);
        setBusy(false);
        return;
      }
      if (signUpData.user) {
        await ensureUserSynced(signUpData.user, roleHint).catch(() => {});
        toast.success("Demo access activated! Redirecting...");
        window.location.replace("/pm-schedule");
      }
    } else if (data.user) {
      await ensureUserSynced(data.user, roleHint).catch(() => {});
      toast.success("Signed in successfully! Redirecting...");
      window.location.replace("/pm-schedule");
    }
    setBusy(false);
  }

  async function handlePasswordReset(e: React.FormEvent) {
    e.preventDefault();
    if (!resetEmail) {
      toast.error("Please enter your registered email address.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/auth`,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Password reset link sent! Check your inbox.");
      setResetEmail("");
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    setCurrentUser(null);
    toast.success("Signed out successfully.");
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top Banner Notice - Points to Overview for new/unauthorized users */}
      <div className="bg-primary/10 border-b border-primary/20 px-4 py-2 text-center text-xs font-semibold text-primary flex items-center justify-center gap-2">
        <ShieldCheck className="size-4 shrink-0 text-primary" />
        <span>Authorized Plant Personnel &amp; Existing Subscriber Portal</span>
        <span className="hidden sm:inline text-muted-foreground">•</span>
        <Link to="/overview" className="underline hover:text-primary/80 font-bold hidden sm:inline">
          Don't have plant access yet? View public features &amp; 6-month free trial →
        </Link>
      </div>

      {/* Navigation Bar */}
      <header className="sticky top-0 z-30 border-b border-border bg-sidebar text-sidebar-foreground">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-black text-lg shadow-sm">
              AC
            </div>
            <div>
              <span className="text-base font-extrabold uppercase tracking-wider block leading-tight">
                AssetCareConnect
              </span>
              <span className="text-[10px] text-sidebar-foreground/60 uppercase tracking-widest font-mono block">
                Member &amp; Operator Portal
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            {currentUser ? (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => navigate({ to: "/pm-schedule" })}
                  className="gap-1.5 font-bold"
                >
                  <Activity className="size-4" /> Go to Control Room
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleSignOut}
                  className="text-xs text-muted-foreground hover:text-destructive"
                >
                  <LogOut className="size-3.5 mr-1" /> Sign out
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link to="/overview">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs border-primary/40 font-semibold"
                  >
                    Public Overview &amp; Trial
                  </Button>
                </Link>
                <Button
                  size="sm"
                  onClick={() => {
                    const el = document.getElementById("portal-login-card");
                    if (el) el.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="font-bold gap-1.5"
                >
                  <Lock className="size-3.5" /> Direct Sign In
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8 sm:px-6 space-y-8">
        {/* Active Session Card if User is Already Logged In */}
        {currentUser && (
          <div className="p-6 rounded-xl bg-emerald-500/10 border-2 border-emerald-500/30 text-card-foreground shadow-sm flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge className="bg-emerald-600 text-white font-bold text-xs uppercase px-2 py-0.5">
                  Active Session
                </Badge>
                <span className="text-xs font-mono text-emerald-700 dark:text-emerald-300 font-semibold">
                  Signed in as: {currentUser.email}
                </span>
              </div>
              <h2 className="text-xl font-bold">
                You are already signed in to your plant account!
              </h2>
              <p className="text-xs text-muted-foreground">
                You have active access to PM schedules, work orders, asset registers, and inventory.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="lg"
                onClick={() => navigate({ to: "/pm-schedule" })}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2 shadow-md"
              >
                <Activity className="size-5" /> Open Plant Control Room{" "}
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Hero Banner for Existing Users */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-sidebar via-sidebar/95 to-slate-900 text-sidebar-foreground p-8 sm:p-12 border border-sidebar-border shadow-xl">
          <div className="relative z-10 max-w-3xl space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className="border-primary/50 bg-primary/10 text-primary font-mono text-xs uppercase tracking-widest"
              >
                <Building2 className="mr-1 size-3" /> Facility Member Access
              </Badge>
              <Badge
                variant="outline"
                className="border-emerald-500/50 bg-emerald-500/10 text-emerald-400 text-xs font-semibold"
              >
                <Activity className="mr-1 size-3" /> Systems Operational
              </Badge>
              <Badge
                variant="outline"
                className="border-blue-500/50 bg-blue-500/10 text-blue-300 text-xs font-semibold"
              >
                <ShieldCheck className="mr-1 size-3" /> Sioux City Enabled
              </Badge>
            </div>

            <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
              Welcome Back to Your Plant Operations Control Room
            </h1>

            <p className="text-sm sm:text-base text-sidebar-foreground/80 leading-relaxed max-w-2xl">
              Direct access portal for municipal utility operators, maintenance technicians,
              supervisors, and plant directors. Sign in below to access live PM schedules, work
              orders, parts requisitions, and equipment O&amp;M manuals.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-4 text-xs text-sidebar-foreground/70 font-mono">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="size-4 text-emerald-400" /> Single Sign-On (SSO) Ready
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="size-4 text-emerald-400" /> Offline Mobile Sync
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="size-4 text-emerald-400" /> Instant QR Tag Scan
              </span>
            </div>
          </div>
        </div>

        {/* Access Form Section & Operator Quick Links Grid */}
        <div className="grid gap-8 lg:grid-cols-12 items-start">
          {/* Sign In & Access Form Column (5 cols) */}
          <div id="portal-login-card" className="lg:col-span-5 space-y-6">
            <div className="panel p-6 shadow-md border-2 border-primary/20 bg-card">
              <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
                <div>
                  <h2 className="text-lg font-extrabold flex items-center gap-2">
                    <Lock className="size-5 text-primary" /> Member Sign In
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Enter your plant credentials to enter the control room.
                  </p>
                </div>
                <Badge variant="secondary" className="font-mono text-[10px] uppercase">
                  Secure SSO
                </Badge>
              </div>

              <Tabs value={tab} onValueChange={setTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="signin" className="text-xs font-bold">
                    Direct Login
                  </TabsTrigger>
                  <TabsTrigger value="quick" className="text-xs font-bold">
                    Quick Access
                  </TabsTrigger>
                </TabsList>

                {/* Direct Login Form */}
                <TabsContent value="signin" className="space-y-4">
                  <form onSubmit={handleSignIn} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="email" className="text-xs font-bold">
                        Work Email / Operator ID
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="operator@plant.gov"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="h-10 text-sm"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="pass" className="text-xs font-bold">
                          Password
                        </Label>
                        <button
                          type="button"
                          onClick={() => setTab("reset")}
                          className="text-[11px] text-primary hover:underline font-medium"
                        >
                          Forgot password?
                        </button>
                      </div>
                      <Input
                        id="pass"
                        type="password"
                        placeholder="••••••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="h-10 text-sm"
                      />
                    </div>

                    <Button
                      type="submit"
                      disabled={busy}
                      className="w-full font-bold h-11 text-sm gap-2"
                    >
                      <Key className="size-4" />
                      {busy ? "Signing in..." : "Sign In to Control Room"}
                    </Button>
                  </form>

                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-border" />
                    </div>
                    <div className="relative flex justify-center text-[10px] uppercase font-mono">
                      <span className="bg-card px-2 text-muted-foreground">Or single sign-on</span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleGoogleSignIn}
                    className="w-full h-10 text-xs font-semibold gap-2 border-border"
                  >
                    <svg className="size-4" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    Continue with Google OAuth
                  </Button>
                </TabsContent>

                {/* Quick Access for Plant Staff */}
                <TabsContent value="quick" className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Instant 1-click test access for verified plant staff &amp; certified operators:
                  </p>

                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() =>
                        handleQuickDemoAccess("rmcclennensiouxcity@gmail.com", "admin")
                      }
                      disabled={busy}
                      className="w-full text-left p-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors flex items-center justify-between group"
                    >
                      <div>
                        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                          <Sparkles className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                          Sioux City Plant Operations
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          rmcclennensiouxcity@gmail.com
                        </p>
                      </div>
                      <Badge className="bg-emerald-600 text-white text-[10px]">Full Access</Badge>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleQuickDemoAccess("demo-supervisor@plant.gov", "manager")}
                      disabled={busy}
                      className="w-full text-left p-3 rounded-lg border border-border bg-muted/40 hover:bg-muted/80 transition-colors flex items-center justify-between group"
                    >
                      <div>
                        <div className="flex items-center gap-1.5 text-xs font-bold">
                          <ShieldCheck className="size-3.5 text-primary" />
                          Plant Maintenance Supervisor
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          demo-supervisor@plant.gov
                        </p>
                      </div>
                      <Badge variant="outline" className="text-[10px]">
                        Manager
                      </Badge>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleQuickDemoAccess("demo-tech@plant.gov", "operator")}
                      disabled={busy}
                      className="w-full text-left p-3 rounded-lg border border-border bg-muted/40 hover:bg-muted/80 transition-colors flex items-center justify-between group"
                    >
                      <div>
                        <div className="flex items-center gap-1.5 text-xs font-bold">
                          <Wrench className="size-3.5 text-blue-500" />
                          Shift Technician / Operator
                        </div>
                        <p className="text-[11px] text-muted-foreground">demo-tech@plant.gov</p>
                      </div>
                      <Badge variant="outline" className="text-[10px]">
                        Technician
                      </Badge>
                    </button>
                  </div>
                </TabsContent>

                {/* Password Reset Tab */}
                <TabsContent value="reset" className="space-y-4">
                  <form onSubmit={handlePasswordReset} className="space-y-3">
                    <p className="text-xs text-muted-foreground">
                      Enter your registered email address and we'll send a password reset link.
                    </p>
                    <div className="space-y-1">
                      <Label htmlFor="reset-email" className="text-xs font-bold">
                        Work Email Address
                      </Label>
                      <Input
                        id="reset-email"
                        type="email"
                        placeholder="operator@plant.gov"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        required
                        className="h-10 text-sm"
                      />
                    </div>
                    <Button type="submit" disabled={busy} className="w-full font-bold h-10 text-xs">
                      {busy ? "Sending link..." : "Send Reset Link"}
                    </Button>
                    <button
                      type="button"
                      onClick={() => setTab("signin")}
                      className="w-full text-center text-xs text-muted-foreground hover:underline pt-1"
                    >
                      ← Back to Sign In
                    </button>
                  </form>
                </TabsContent>
              </Tabs>
            </div>

            {/* Support & Public Overview Link Box */}
            <div className="panel p-4 bg-muted/30 border border-border text-xs space-y-2">
              <div className="flex items-center gap-2 text-foreground font-bold">
                <HelpCircle className="size-4 text-primary" /> Don't have a plant account yet?
              </div>
              <p className="text-muted-foreground leading-normal">
                If you are exploring AssetCareConnect for your facility or municipality, visit the
                public overview page to review features, download sample CSV asset registers, and
                request a 6-month free trial.
              </p>
              <Link to="/overview" className="text-primary font-bold hover:underline block pt-1">
                Explore Public Features &amp; Request Free Trial →
              </Link>
            </div>
          </div>

          {/* Quick Jump Modules Grid for Existing Operators (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            <div>
              <h2 className="text-xl font-extrabold flex items-center gap-2">
                <Zap className="size-5 text-amber-500" /> Direct Command Modules
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Jump straight to your active plant module if you are already signed in or
                authorized:
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Link
                to="/pm-schedule"
                className="panel p-4 hover:border-primary/60 hover:shadow-md transition-all group block space-y-2 bg-card"
              >
                <div className="flex items-center justify-between">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold">
                    <CalendarClock className="size-5" />
                  </div>
                  <ArrowUpRight className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">
                    PM Schedule &amp; Calendar
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Preventive maintenance routines, recurring tasks, next-due intervals, and
                    completion logging.
                  </p>
                </div>
              </Link>

              <Link
                to="/work-orders"
                className="panel p-4 hover:border-primary/60 hover:shadow-md transition-all group block space-y-2 bg-card"
              >
                <div className="flex items-center justify-between">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold">
                    <Wrench className="size-5" />
                  </div>
                  <ArrowUpRight className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">
                    Active Work Orders
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Corrective, emergency, and PM work order dispatch, priority tiers, and
                    technician notes.
                  </p>
                </div>
              </Link>

              <Link
                to="/assets"
                className="panel p-4 hover:border-primary/60 hover:shadow-md transition-all group block space-y-2 bg-card"
              >
                <div className="flex items-center justify-between">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold">
                    <Boxes className="size-5" />
                  </div>
                  <ArrowUpRight className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">
                    Site Asset Register
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Equipment records, nameplate specs, lube/belt sizing, and mobile QR code tag
                    capture.
                  </p>
                </div>
              </Link>

              <Link
                to="/part-requests"
                className="panel p-4 hover:border-primary/60 hover:shadow-md transition-all group block space-y-2 bg-card"
              >
                <div className="flex items-center justify-between">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold">
                    <PackageCheck className="size-5" />
                  </div>
                  <ArrowUpRight className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">
                    Part Requisitions &amp; RFQs
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Send parts to supervisors, track supplier bidding, and approve component orders.
                  </p>
                </div>
              </Link>

              <Link
                to="/inventory"
                className="panel p-4 hover:border-primary/60 hover:shadow-md transition-all group block space-y-2 bg-card"
              >
                <div className="flex items-center justify-between">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-bold">
                    <ClipboardList className="size-5" />
                  </div>
                  <ArrowUpRight className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">
                    MRO Spare Parts Store
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Inventory counts, bin locations, reorder alerts, and manufacturer part
                    cross-references.
                  </p>
                </div>
              </Link>

              <Link
                to="/manuals"
                className="panel p-4 hover:border-primary/60 hover:shadow-md transition-all group block space-y-2 bg-card"
              >
                <div className="flex items-center justify-between">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold">
                    <FileText className="size-5" />
                  </div>
                  <ArrowUpRight className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">
                    Equipment O&amp;M Manuals
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    OEM operation and maintenance manuals, cut sheets, electrical schematics, and
                    PDF links.
                  </p>
                </div>
              </Link>
            </div>

            {/* Plant Operations Feature Highlights */}
            <div className="panel p-6 bg-sidebar text-sidebar-foreground border-sidebar-border space-y-4">
              <div className="flex items-center gap-2 text-primary font-bold text-sm">
                <Bot className="size-5 text-primary" /> AI &amp; OEM Maintenance Research
                Integration
              </div>
              <p className="text-xs text-sidebar-foreground/80 leading-relaxed">
                As an existing member, you get full access to AI-driven maintenance research on
                every asset. Look up manufacturer specs, lube intervals, belt sizes, and link
                official O&amp;M manuals straight into the asset record.
              </p>
              <div className="pt-2 border-t border-sidebar-border flex flex-wrap items-center justify-between text-xs text-sidebar-foreground/70">
                <span className="font-semibold text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="size-3.5" /> Sioux City Operations Synced
                </span>
                <Link to="/team" className="text-primary hover:underline font-semibold">
                  Manage Team Roster &amp; Roles →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Portal Footer */}
      <footer className="border-t border-border bg-sidebar text-sidebar-foreground py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-wrap items-center justify-between gap-4 text-xs text-sidebar-foreground/70">
          <div className="flex items-center gap-2">
            <span className="font-extrabold uppercase tracking-wider text-sidebar-foreground">
              AssetCareConnect
            </span>
            <span>• Existing User &amp; Plant Member Portal</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/overview" className="hover:text-sidebar-foreground underline">
              Public Marketing &amp; Free Trial Overview
            </Link>
            <Link to="/auth" className="hover:text-sidebar-foreground underline">
              Sign In / Claim Invite
            </Link>
            <Link to="/pm-schedule" className="hover:text-sidebar-foreground underline">
              PM Control Room
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

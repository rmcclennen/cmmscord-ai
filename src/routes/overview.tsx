import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CompanyOnboardingDialog } from "@/components/company-onboarding-dialog";
import { BulkAssetUploader } from "@/components/bulk-asset-uploader";
import { downloadSampleAssetCsv } from "@/lib/asset-import";
import {
  Boxes,
  CalendarClock,
  ClipboardList,
  Sparkles,
  ShieldCheck,
  UploadCloud,
  Download,
  Building2,
  CheckCircle2,
  Zap,
  Eye,
  Users,
  Clock,
  ArrowRight,
  HelpCircle,
  FileSpreadsheet,
  Droplet,
} from "lucide-react";

export const Route = createFileRoute("/overview")({
  head: () => ({
    meta: [
      { title: "Public Overview & Trial | AssetCareConnect" },
      {
        name: "description",
        content:
          "Enterprise asset management, bulk fleet onboarding, automated PM schedules, MRO inventory, and ADA-compliant maintenance dispatch for utilities and industrial plants.",
      },
      { property: "og:title", content: "Public Overview & Trial | AssetCareConnect" },
      {
        property: "og:description",
        content:
          "Enterprise asset care, fleet import tools, PM automation, and work orders for treatment plants and industrial facilities.",
      },
    ],
  }),
  component: OverviewPage,
});

const FEATURES = [
  {
    icon: Boxes,
    title: "Complete Site-Specific Asset Register",
    body: "Every pump, motor, blower, clarifier, and panel with make, model, serial, HP, volts, RPM, frame, and physical building locations.",
  },
  {
    icon: CalendarClock,
    title: "Automated PM Scheduling",
    body: "Preventive programs seeded by equipment class with intervals, next-due tracking, seasonal windows, and one-click completion rescheduling.",
  },
  {
    icon: UploadCloud,
    title: "Instant Bulk Asset Ingestion",
    body: "Upload your facility's existing spreadsheets or CSV exports in seconds with automatic column mapping, validation, and PM generation.",
  },
  {
    icon: ClipboardList,
    title: "Work Order Management",
    body: "Write corrective, preventive, or emergency work orders against any asset with priority tiers, due date tracking, and automated technician dispatch.",
  },
  {
    icon: Droplet,
    title: "Manufacturer Lube & Belt Specs",
    body: "Automatic OEM oil grades, grease types, belt sizing, mechanical seal specs, and lubrication run intervals right on each asset record.",
  },
  {
    icon: ShieldCheck,
    title: "ADA & Section 508 Compliant",
    body: "Engineered with WCAG 2.1 AAA high-contrast modes, text scaling up to 150%, screen reader live regions, dyslexia typography, and keyboard navigation.",
  },
];

const TARGET_SECTORS = [
  {
    icon: "🏭",
    title: "Wastewater Treatment (WWTP)",
    desc: "Aeration blowers, clarifiers, influent/effluent pumps, digester mixers, bar screens, and dewatering presses.",
  },
  {
    icon: "💧",
    title: "Drinking Water & Utilities",
    desc: "Well pumps, chemical dosing, booster stations, water towers, filter beds, and distribution valving.",
  },
  {
    icon: "🏗️",
    title: "Public Works, Streets & Fleet",
    desc: "Municipal garages, stormwater lift stations, emergency generators, street equipment, and facility HVAC.",
  },
  {
    icon: "⚡",
    title: "Power, Energy & Utilities",
    desc: "Substations, switchgear, backup turbine generators, cooling towers, and electrical distribution panels.",
  },
];

function OverviewPage() {
  const [showCompanyDialog, setShowCompanyDialog] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top Banner Notice for Existing Members */}
      <div className="bg-sidebar-primary/20 border-b border-sidebar-primary/30 px-4 py-2 text-center text-xs font-semibold text-sidebar-foreground flex items-center justify-center gap-2">
        <ShieldCheck className="size-4 text-sidebar-primary shrink-0" />
        <span>Already an existing user or authorized plant operator?</span>
        <Link
          to="/"
          className="text-sidebar-primary hover:underline font-bold inline-flex items-center gap-1"
        >
          Open Member &amp; Operator Portal →
        </Link>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-sidebar-border bg-sidebar text-sidebar-foreground">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground font-black text-lg shadow-sm">
              AC
            </div>
            <div>
              <span className="text-base font-extrabold uppercase tracking-wider block leading-tight">
                AssetCareConnect
              </span>
              <span className="text-[10px] text-sidebar-foreground/60 uppercase tracking-widest font-mono block">
                Public Overview &amp; 6-Month Trial
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            <a
              href="#features"
              className="text-sidebar-foreground/80 hover:text-sidebar-foreground"
            >
              Key Features
            </a>
            <a
              href="#bulk-import"
              className="text-sidebar-foreground/80 hover:text-sidebar-foreground"
            >
              Bulk CSV Import
            </a>
            <a href="#sectors" className="text-sidebar-foreground/80 hover:text-sidebar-foreground">
              Sectors &amp; Utilities
            </a>
            <a href="#pricing" className="text-sidebar-foreground/80 hover:text-sidebar-foreground">
              6-Month Free Trial
            </a>
            <Link
              to="/"
              className="text-sidebar-primary hover:underline font-bold flex items-center gap-1"
            >
              Member Portal
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link to="/">
              <Button
                size="sm"
                variant="outline"
                className="border-sidebar-primary/40 text-sidebar-foreground font-semibold hover:bg-sidebar-accent"
              >
                Member Portal
              </Button>
            </Link>
            <Link to="/auth">
              <Button
                size="sm"
                className="bg-sidebar-primary text-sidebar-primary-foreground font-bold hover:bg-sidebar-primary/90"
              >
                Sign In / Claim Invite
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-sidebar/50 via-background to-background py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
            <div className="space-y-6 lg:col-span-7">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className="border-sidebar-primary/40 bg-sidebar-primary/10 text-sidebar-foreground font-mono text-xs uppercase tracking-widest"
                >
                  Enterprise CMMS &amp; Asset Care
                </Badge>
                <Badge className="bg-emerald-600 text-white text-xs font-semibold">
                  6 Months Free • No Credit Card
                </Badge>
                <Badge
                  variant="outline"
                  className="border-blue-500/40 text-blue-600 dark:text-blue-400 text-xs font-semibold"
                >
                  Section 508 / WCAG AAA
                </Badge>
              </div>

              <h1 className="text-4xl font-black tracking-tight sm:text-6xl text-foreground leading-[1.1]">
                Connected Asset Operations for Plant &amp; Utility Facilities
              </h1>

              <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-2xl">
                Onboard your entire facility equipment register in minutes with bulk CSV importers,
                automated PM schedules, MRO spare parts tracking, work order dispatch, and mobile QR
                tag access.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Link to="/">
                  <Button
                    size="lg"
                    className="font-bold text-sm h-12 px-6 gap-2 bg-primary text-primary-foreground shadow-md"
                  >
                    <ShieldCheck className="size-5" /> Open Member Portal
                  </Button>
                </Link>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => setShowCompanyDialog(true)}
                  className="font-bold text-sm h-12 px-6 gap-2 border-primary/40 text-foreground"
                >
                  <Building2 className="size-5 text-primary" /> Onboard Facility &amp; Get 6 Months
                  Free
                </Button>
              </div>

              <div className="pt-4 border-t border-border/60 grid grid-cols-3 gap-4 text-xs font-mono text-muted-foreground">
                <div>
                  <span className="block text-foreground font-bold text-base">Zero Lock-in</span>
                  Full CSV &amp; PDF Export
                </div>
                <div>
                  <span className="block text-foreground font-bold text-base">Bulk Importer</span>
                  Auto-mapped CSV Upload
                </div>
                <div>
                  <span className="block text-foreground font-bold text-base">ADA Accessible</span>
                  High Contrast &amp; Dyslexia Modes
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 space-y-4">
              <div className="panel p-6 border-2 border-primary/30 shadow-xl bg-card space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div className="flex items-center gap-2">
                    <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Sparkles className="size-4" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-sm">6-Month Free Plant Trial</h3>
                      <p className="text-[11px] text-muted-foreground">
                        No payment method required
                      </p>
                    </div>
                  </div>
                  <Badge className="bg-emerald-600 text-white font-mono text-[10px] uppercase">
                    Active Promo
                  </Badge>
                </div>

                <ul className="space-y-2.5 text-xs">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <span>
                      <strong>Unlimited Assets &amp; Equipment:</strong> Onboard pumps, blowers,
                      panels, motors, and valves.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <span>
                      <strong>Bulk CSV Importer:</strong> Import existing Excel asset registers in
                      seconds.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <span>
                      <strong>Automated PM Calendar:</strong> Seed routines by manufacturer class
                      &amp; run intervals.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <span>
                      <strong>Parts Requisitions &amp; Bidding:</strong> Send part RFQs to
                      supervisors and suppliers.
                    </span>
                  </li>
                </ul>

                <Button
                  onClick={() => setShowCompanyDialog(true)}
                  className="w-full font-bold h-11 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm"
                >
                  <Zap className="size-4" /> Claim Your 6 Months Free
                </Button>

                <p className="text-[10px] text-center text-muted-foreground">
                  Already have access?{" "}
                  <Link to="/" className="text-primary hover:underline font-semibold">
                    Sign in on the Member Portal →
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Bulk CSV Asset Import Highlight Section */}
      <section id="bulk-import" className="py-16 bg-muted/30 border-b border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 space-y-8">
          <div className="text-center max-w-3xl mx-auto space-y-2">
            <Badge
              variant="outline"
              className="border-primary/40 bg-primary/10 text-primary font-mono text-xs uppercase"
            >
              <FileSpreadsheet className="mr-1 size-3" /> Quick Fleet Onboarding
            </Badge>
            <h2 className="text-2xl sm:text-4xl font-black text-foreground">
              Bring Your Existing Equipment Spreadsheets
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground">
              Don't manually re-type hundreds of plant assets. Upload your facility's CSV
              spreadsheet or download our pre-built template.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-12 items-start">
            <div className="lg:col-span-5 space-y-4">
              <div className="panel p-5 space-y-3">
                <h3 className="font-extrabold text-base flex items-center gap-2">
                  <Download className="size-5 text-primary" /> Download Sample CSV Template
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Includes pre-filled sample rows for Wastewater Influent Pumps, Aeration Blowers,
                  Clarifier Drives, Variable Frequency Drives, and Motor Control Centers.
                </p>
                <Button
                  variant="outline"
                  onClick={downloadSampleAssetCsv}
                  className="w-full font-semibold text-xs h-10 gap-2 border-primary/40"
                >
                  <Download className="size-4 text-primary" /> Download Sample Asset CSV (.csv)
                </Button>
              </div>

              <div className="panel p-5 bg-card border border-border space-y-2 text-xs">
                <p className="font-bold text-foreground">Supported CSV Columns:</p>
                <ul className="grid grid-cols-2 gap-1.5 font-mono text-[11px] text-muted-foreground">
                  <li>• Name / Equipment Title</li>
                  <li>• Asset Number / Tag ID</li>
                  <li>• Class / Category</li>
                  <li>• Building / Location</li>
                  <li>• Manufacturer / Make</li>
                  <li>• Model &amp; Serial Number</li>
                  <li>• HP, Volts, RPM, Frame</li>
                  <li>• Criticality Rating</li>
                </ul>
              </div>
            </div>

            <div className="lg:col-span-7">
              <div className="panel p-6 border-2 border-primary/20 bg-card shadow-lg">
                <BulkAssetUploader />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Capabilities Grid */}
      <section id="features" className="py-16 border-b border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 space-y-12">
          <div className="text-center max-w-3xl mx-auto space-y-2">
            <Badge
              variant="outline"
              className="border-primary/40 bg-primary/10 text-primary font-mono text-xs uppercase"
            >
              Core CMMS Platform
            </Badge>
            <h2 className="text-2xl sm:text-4xl font-black text-foreground">
              Built for Plant Operators, Mechanics &amp; Facility Managers
            </h2>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => {
              const Icon = f.icon;
              return (
                <div
                  key={i}
                  className="panel p-5 hover:border-primary/50 transition-colors space-y-3 bg-card"
                >
                  <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold">
                    <Icon className="size-5" />
                  </div>
                  <h3 className="font-bold text-base text-foreground">{f.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{f.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Target Sectors & Utilities */}
      <section id="sectors" className="py-16 bg-muted/20 border-b border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 space-y-8">
          <div className="text-center max-w-3xl mx-auto space-y-2">
            <Badge
              variant="outline"
              className="border-primary/40 bg-primary/10 text-primary font-mono text-xs uppercase"
            >
              Facility Domains
            </Badge>
            <h2 className="text-2xl sm:text-4xl font-black text-foreground">
              Configured for Essential Infrastructure
            </h2>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {TARGET_SECTORS.map((s, i) => (
              <div key={i} className="panel p-5 space-y-2 bg-card border border-border">
                <div className="text-3xl">{s.icon}</div>
                <h3 className="font-bold text-sm text-foreground">{s.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing & 6-Month Free Trial Promo */}
      <section id="pricing" className="py-16 bg-sidebar text-sidebar-foreground">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 text-center space-y-6">
          <Badge className="bg-emerald-600 text-white font-mono text-xs uppercase px-3 py-1">
            6 Months Completely Free • No Obligations
          </Badge>
          <h2 className="text-3xl sm:text-5xl font-black text-sidebar-foreground">
            Get Your Facility Onboarded Today
          </h2>
          <p className="text-sm sm:text-base text-sidebar-foreground/80 max-w-2xl mx-auto leading-relaxed">
            Try AssetCareConnect free for 6 full months. Onboard your equipment, generate preventive
            maintenance routines, and manage work orders without typing a credit card.
          </p>

          <div className="pt-4 flex flex-wrap items-center justify-center gap-4">
            <Button
              size="lg"
              onClick={() => setShowCompanyDialog(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-12 px-8 text-base shadow-lg"
            >
              Start Your 6-Month Free Trial Now
            </Button>
            <Link to="/">
              <Button
                size="lg"
                variant="outline"
                className="border-sidebar-border text-sidebar-foreground font-bold h-12 px-6"
              >
                Open Member Portal
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-background py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 flex flex-wrap items-center justify-between gap-4 text-xs text-muted-foreground">
          <div>
            <span className="font-black text-foreground uppercase tracking-wider">
              AssetCareConnect
            </span>{" "}
            • Connected Asset Management &amp; CMMS
          </div>
          <div className="flex items-center gap-4">
            <Link to="/" className="hover:text-foreground underline">
              Member Portal
            </Link>
            <Link to="/auth" className="hover:text-foreground underline">
              Sign In / Claim Code
            </Link>
          </div>
        </div>
      </footer>

      {/* Facility Onboarding Dialog */}
      <CompanyOnboardingDialog open={showCompanyDialog} onOpenChange={setShowCompanyDialog} />
    </div>
  );
}

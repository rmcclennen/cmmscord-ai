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

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AssetCareConnect | Connected Maintenance Management & Asset Operations" },
      {
        name: "description",
        content:
          "Enterprise asset management, bulk fleet onboarding, automated PM schedules, MRO inventory, and ADA-compliant maintenance dispatch for utilities and industrial plants.",
      },
      { property: "og:title", content: "AssetCareConnect | Maintenance & Asset Operations" },
      {
        property: "og:description",
        content:
          "Enterprise asset care, fleet import tools, PM automation, and work orders for treatment plants and industrial facilities.",
      },
    ],
  }),
  component: Landing,
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
  {
    icon: "⚙️",
    title: "Industrial & Manufacturing",
    desc: "Conveyors, packaging lines, hydraulic presses, industrial air compressors, and robotic cells.",
  },
  {
    icon: "🥩",
    title: "Food & Beverage Processing",
    desc: "Sanitary pumps, pasteurizers, industrial refrigeration skids, homogenizers, and clean-in-place (CIP) loops.",
  },
];

const TIERS = [
  {
    id: "unlimited" as const,
    name: "Unlimited Plant License",
    priceMonthly: 375,
    priceAnnual: 333,
    annualTotal: 4000,
    trial: "6 Months Free Trial",
    popular: true,
    badge: "Disruptive Flat Rate",
    assets: "Unlimited Site-Specific Assets",
    seats: "Unlimited Users & Technicians",
    description:
      "Full plant operations with unlimited technician, supervisor, and coordinator seats. 6 months free, then only $4,000/yr flat — zero per-seat fees.",
    bullets: [
      "6-Month Full-Access Free Trial ($0 today)",
      "Unlimited equipment assets for your facility",
      "Unlimited technician & supervisor seats",
      "Send parts to supervisors & CMMS coordinators",
      "OEM suggested oil, grease, belts & seal specs",
      "Supplier parts RFQ & auto-bidding engine",
      "PM schedule generator & recurring calendar",
      "Instant Bulk Fleet Ingestion wizard",
      "O&M manual lookup & search engine",
      "Priority 24/7 technical support",
    ],
  },
  {
    id: "starter" as const,
    name: "Single Facility / Station",
    priceMonthly: 149,
    priceAnnual: 124,
    annualTotal: 1490,
    trial: "6 Months Free Trial",
    badge: "Small Districts & Stations",
    assets: "Up to 350 Assets",
    seats: "Unlimited Users",
    description:
      "Ideal for smaller water districts, lift stations, and localized municipal maintenance crews.",
    bullets: [
      "6-Month Full-Access Free Trial ($0 today)",
      "Up to 350 equipment asset records",
      "Unlimited user seats & technician logins",
      "PM calendar & recurrence engine",
      "Mobile nameplate photo capture",
      "Parts requisition and inventory tracking",
      "CSV asset import & export",
    ],
  },
  {
    id: "enterprise" as const,
    name: "Municipal Authority / Multi-Site",
    priceMonthly: 790,
    priceAnnual: 708,
    annualTotal: 8500,
    trial: "6 Months Free Trial",
    badge: "Regional & Multi-Dept",
    assets: "Unlimited Assets (All Plants)",
    seats: "Unlimited Users (All Departments)",
    description:
      "For municipal utility authorities, public works directorates, and regional multi-plant operations.",
    bullets: [
      "6-Month Authority-Wide Free Trial",
      "Unlimited assets across all municipal departments",
      "Multi-department access (Water, WWTP, Streets, Power, Fleet)",
      "Custom ERP & SCADA telemetry integration",
      "White-glove spreadsheet migration service",
      "Dedicated account engineer & 99.9% SLA",
      "Custom audit & compliance export tools",
    ],
  },
];

function Landing() {
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<"unlimited" | "starter" | "enterprise">(
    "unlimited",
  );
  const [uploaderOpen, setUploaderOpen] = useState(false);
  const [billingAnnual, setBillingAnnual] = useState(true);

  const openPlanCheckout = (planId: "unlimited" | "starter" | "enterprise") => {
    setSelectedPlan(planId);
    setOnboardingOpen(true);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-sidebar-border bg-sidebar text-sidebar-foreground">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground font-black text-base">
              AC
            </div>
            <span className="text-base font-extrabold uppercase tracking-wider">
              AssetCareConnect
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-sm font-semibold">
            <a
              href="#industries"
              className="text-sidebar-foreground/80 hover:text-sidebar-foreground"
            >
              Industries &amp; Municipalities
            </a>
            <a
              href="#features"
              className="text-sidebar-foreground/80 hover:text-sidebar-foreground"
            >
              Features
            </a>
            <a href="#import" className="text-sidebar-foreground/80 hover:text-sidebar-foreground">
              Bulk Asset Upload
            </a>
            <a href="#pricing" className="text-sidebar-foreground/80 hover:text-sidebar-foreground">
              6-Month Free Trial
            </a>
            <a
              href="#accessibility"
              className="text-sidebar-foreground/80 hover:text-sidebar-foreground"
            >
              ADA Compliance
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <Link to="/auth">
              <Button
                size="sm"
                variant="ghost"
                className="text-sidebar-foreground/90 hover:bg-sidebar-accent"
              >
                Sign in
              </Button>
            </Link>
            <Button
              size="sm"
              onClick={() => openPlanCheckout("unlimited")}
              className="bg-sidebar-primary text-sidebar-primary-foreground font-bold hover:bg-sidebar-primary/90"
            >
              Start 6-Month Free Trial
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="border-b border-border bg-sidebar text-sidebar-foreground">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-24">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className="border-sidebar-primary/50 bg-sidebar-accent text-sidebar-primary font-mono text-xs uppercase tracking-widest px-2.5 py-0.5"
            >
              Built by Operators &amp; Maintenance Professionals
            </Badge>
            <Badge
              variant="outline"
              className="border-success/50 bg-success/10 text-success text-xs font-semibold px-2.5 py-0.5"
            >
              <CheckCircle2 className="mr-1 size-3" /> 6 Months 100% Free Trial
            </Badge>
            <Badge
              variant="outline"
              className="border-sidebar-border bg-sidebar-accent/60 text-sidebar-foreground text-xs font-semibold px-2.5 py-0.5"
            >
              <CheckCircle2 className="mr-1 size-3 text-sidebar-primary" /> ADA &amp; WCAG AAA
              Compliant
            </Badge>
          </div>

          <h1 className="mt-5 max-w-4xl text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
            The maintenance platform your operators and technicians will actually use.
          </h1>

          <p className="mt-6 max-w-3xl text-base text-sidebar-foreground/85 sm:text-lg lg:text-xl leading-relaxed">
            Most CMMS software fails because it is too bloated for operators and too expensive for
            municipal budgets. AssetCareConnect was engineered from the plant floor up by veteran
            operators and maintenance pros to deliver high daily field adoption. From instant OEM
            lubrication and belt specifications to automated PM schedules and one-click parts
            routing, get everything your crew needs with a transparent flat rate and zero per-seat
            licensing penalties.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Button
              size="lg"
              onClick={() => openPlanCheckout("unlimited")}
              className="bg-sidebar-primary text-sidebar-primary-foreground font-extrabold text-base px-6 hover:bg-sidebar-primary/90 shadow-md"
            >
              <Building2 className="mr-2 size-5" /> Start 6-Month Free Trial
            </Button>

            <Button
              size="lg"
              variant="outline"
              onClick={() => setUploaderOpen(true)}
              className="border-sidebar-border bg-sidebar-accent/50 text-sidebar-foreground font-bold hover:bg-sidebar-accent"
            >
              <UploadCloud className="mr-2 size-5 text-sidebar-primary" /> Import Site Equipment CSV
            </Button>

            <Link to="/auth">
              <Button
                size="lg"
                variant="ghost"
                className="text-sidebar-foreground/80 hover:bg-sidebar-accent text-sm font-semibold"
              >
                Open Plant Control Room <ArrowRight className="ml-1.5 size-4" />
              </Button>
            </Link>
          </div>

          {/* Quick Metrics Bar */}
          <div className="mt-14 grid grid-cols-2 gap-4 border-t border-sidebar-border/60 pt-8 sm:grid-cols-4">
            <div>
              <p className="text-2xl font-black text-sidebar-primary">6 Months</p>
              <p className="text-xs text-sidebar-foreground/70">100% Free Full Enterprise Trial</p>
            </div>
            <div>
              <p className="text-2xl font-black text-sidebar-primary">$4,000/yr</p>
              <p className="text-xs text-sidebar-foreground/70">Flat Rate — Zero Per-Seat Fees</p>
            </div>
            <div>
              <p className="text-2xl font-black text-sidebar-primary">Site-Specific</p>
              <p className="text-xs text-sidebar-foreground/70">Instant Custom Fleet Ingestion</p>
            </div>
            <div>
              <p className="text-2xl font-black text-sidebar-primary">Built by Pros</p>
              <p className="text-xs text-sidebar-foreground/70">Operator &amp; Mechanic Designed</p>
            </div>
          </div>
        </div>
      </section>

      {/* Target Industries & Municipal Departments Section */}
      <section id="industries" className="border-b border-border bg-muted/40 py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="max-w-3xl">
            <p className="label-caps text-primary">Cross-Sector Plant Operations</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl text-foreground">
              Engineered for all industries &amp; municipal departments.
            </h2>
            <p className="mt-3 text-base text-muted-foreground">
              Whether you run a municipal water treatment plant, a public works fleet garage, an
              electric substation, or an industrial packaging plant, AssetCareConnect organizes your
              exact equipment fleet with zero complexity.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {TARGET_SECTORS.map((sector) => (
              <div
                key={sector.title}
                className="rounded-xl border border-border bg-card p-6 shadow-sm transition-all hover:border-primary/50 hover:shadow-md"
              >
                <span className="text-3xl" role="img" aria-label={sector.title}>
                  {sector.icon}
                </span>
                <h3 className="mt-4 text-base font-bold text-foreground">{sector.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{sector.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bulk Asset Ingestion Showcase Section */}
      <section id="import" className="border-b border-border bg-card py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="label-caps text-primary">Fleet Migration Engine</p>
              <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
                Upload your entire equipment fleet in one simple step.
              </h2>
              <p className="mt-4 text-base text-muted-foreground">
                Don't spend weeks manually retyping pump and motor tags. AssetCareConnect includes
                an intelligent bulk ingestion engine that parses your CSV, Excel, or CMMS exports,
                automatically detects columns, assigns facility buildings, and seeds preventive
                maintenance schedules.
              </p>

              <div className="mt-6 space-y-3 text-sm">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 size-5 text-success shrink-0" />
                  <span>
                    <strong>Smart Column Auto-Detection:</strong> Matches tags, serial numbers,
                    motor HP, voltage, and criticality automatically.
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 size-5 text-success shrink-0" />
                  <span>
                    <strong>Automated PM Generation:</strong> Generates manufacturer-grade
                    lubrication, vibration, and safety checks based on equipment class.
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 size-5 text-success shrink-0" />
                  <span>
                    <strong>Zero Data Lock-in:</strong> Export full asset registers and compliance
                    records anytime in standard formats.
                  </span>
                </div>
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button
                  onClick={() => setUploaderOpen(true)}
                  className="font-bold flex items-center gap-2"
                >
                  <UploadCloud className="size-4" /> Launch Bulk Asset Importer
                </Button>
                <Button
                  variant="outline"
                  onClick={downloadSampleAssetCsv}
                  className="font-semibold text-xs flex items-center gap-2"
                >
                  <Download className="size-4 text-primary" /> Download Sample CSV Template
                </Button>
              </div>
            </div>

            {/* Visual Box */}
            <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-6 shadow-md">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="size-5 text-primary" />
                  <span className="text-sm font-bold text-foreground">Import Wizard Preview</span>
                </div>
                <Badge variant="outline" className="bg-success/10 text-success text-xs font-mono">
                  Ready to Ingest
                </Badge>
              </div>

              <div className="mt-4 space-y-2 font-mono text-xs">
                <div className="flex items-center justify-between rounded bg-card p-2 border border-border">
                  <span className="font-semibold text-foreground">
                    Influent Submersible Pumps (6 units)
                  </span>
                  <Badge className="bg-primary/10 text-primary text-[10px]">Class: PMP</Badge>
                </div>
                <div className="flex items-center justify-between rounded bg-card p-2 border border-border">
                  <span className="font-semibold text-foreground">
                    Aeration Blower Motors 100HP (4 units)
                  </span>
                  <Badge className="bg-primary/10 text-primary text-[10px]">Class: MOT</Badge>
                </div>
                <div className="flex items-center justify-between rounded bg-card p-2 border border-border">
                  <span className="font-semibold text-foreground">
                    Primary Clarifier Drives (3 units)
                  </span>
                  <Badge className="bg-primary/10 text-primary text-[10px]">Class: PEQ</Badge>
                </div>
                <div className="flex items-center justify-between rounded bg-card p-2 border border-border">
                  <span className="font-semibold text-foreground">
                    TrojanUV Disinfection Banks (2 modules)
                  </span>
                  <Badge className="bg-primary/10 text-primary text-[10px]">Class: PEQ</Badge>
                </div>
              </div>

              <div className="mt-5 rounded-xl bg-card p-3 border border-border flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-foreground">Auto-Generate PM Schedules</p>
                  <p className="text-[11px] text-muted-foreground">
                    Seeds 90-day & 180-day inspection routines
                  </p>
                </div>
                <span className="text-xs font-bold text-success">Enabled ✓</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="text-center max-w-3xl mx-auto">
            <p className="label-caps text-primary">Comprehensive Plant Operations</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
              Everything maintenance crews need in one unified platform.
            </h2>
            <p className="mt-3 text-base text-muted-foreground">
              From routine grease routes to emergency pump rebuilds, AssetCareConnect streamlines
              every maintenance action.
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="panel p-6 flex flex-col justify-between">
                <div>
                  <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <f.icon className="size-5" aria-hidden="true" />
                  </div>
                  <h3 className="mt-4 text-lg font-bold text-foreground">{f.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing / Company Purchase Section */}
      <section id="pricing" className="border-t border-b border-border bg-card py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="text-center max-w-3xl mx-auto">
            <p className="label-caps text-primary">Transparent Organization Pricing</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
              Equip your maintenance department today.
            </h2>
            <p className="mt-3 text-base text-muted-foreground">
              Full enterprise access with a 6-month risk-free trial for all municipal departments,
              utilities, and industrial plants. Zero per-seat licensing penalties.
            </p>

            {/* Annual / Monthly Toggle */}
            <div className="mt-6 inline-flex items-center gap-3 rounded-full border border-border bg-muted p-1.5 shadow-sm">
              <button
                type="button"
                onClick={() => setBillingAnnual(false)}
                className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
                  !billingAnnual
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Monthly Billing
              </button>
              <button
                type="button"
                onClick={() => setBillingAnnual(true)}
                className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
                  billingAnnual
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Annual Billing
                <Badge className="bg-success text-success-foreground text-[10px] px-1.5 py-0">
                  Save 20%
                </Badge>
              </button>
            </div>
          </div>

          {/* 6-Month Free Trial Guarantee Banner */}
          <div className="mt-8 rounded-2xl border-2 border-primary/40 bg-primary/5 p-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md font-black text-xl">
                6M
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-foreground">
                    6 Months 100% Free Full-Access Trial
                  </h3>
                  <Badge className="bg-primary text-primary-foreground text-xs px-2 py-0.5 font-bold">
                    Zero Risk
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Available immediately for water plants, WWTP facilities, municipal public works,
                  and industrial manufacturing plants. No immediate credit card commitment.
                </p>
              </div>
            </div>
            <Button
              onClick={() => openPlanCheckout("unlimited")}
              className="shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 font-bold px-6"
            >
              Start 6-Month Free Trial
            </Button>
          </div>

          {/* Pricing Cards */}
          <div className="mt-8 grid gap-8 lg:grid-cols-3">
            {TIERS.map((tier) => {
              const price = billingAnnual ? tier.priceAnnual : tier.priceMonthly;

              return (
                <div
                  key={tier.id}
                  className={`relative flex flex-col justify-between rounded-2xl border-2 p-8 shadow-sm transition-all ${
                    tier.popular
                      ? "border-primary bg-card shadow-lg ring-2 ring-primary/30"
                      : "border-border bg-card"
                  }`}
                >
                  {tier.popular && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-extrabold uppercase tracking-wide text-primary-foreground">
                      Most Popular
                    </span>
                  )}

                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="text-xl font-bold text-foreground">{tier.name}</h3>
                      <Badge variant="outline" className="text-xs font-semibold">
                        {tier.badge}
                      </Badge>
                    </div>

                    <p className="mt-2 text-xs text-muted-foreground">{tier.description}</p>

                    <div className="mt-6 flex items-baseline gap-1.5 border-b border-border pb-6">
                      <span className="text-4xl font-black text-foreground">${price}</span>
                      <span className="text-sm font-semibold text-muted-foreground">/ month</span>
                      {billingAnnual && (
                        <span className="ml-2 text-xs text-success font-semibold">
                          (${tier.annualTotal}/yr flat)
                        </span>
                      )}
                    </div>

                    <div className="mt-4 rounded-lg bg-primary/10 px-3 py-1.5 text-center text-xs font-bold text-primary">
                      ✓ {tier.trial} Included
                    </div>

                    <div className="mt-5 space-y-2 text-xs font-semibold text-foreground">
                      <div className="flex items-center gap-2">
                        <Boxes className="size-4 text-primary" /> {tier.assets}
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="size-4 text-primary" /> {tier.seats}
                      </div>
                    </div>

                    <ul className="mt-6 space-y-3 text-xs text-muted-foreground border-t border-border pt-6">
                      {tier.bullets.map((b) => (
                        <li key={b} className="flex items-start gap-2.5">
                          <CheckCircle2 className="mt-0.5 size-4 text-primary shrink-0" />
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-8">
                    <Button
                      onClick={() => openPlanCheckout(tier.id)}
                      className={`w-full font-bold ${
                        tier.popular
                          ? "bg-primary text-primary-foreground hover:bg-primary/90"
                          : "border border-input bg-card text-foreground hover:bg-muted"
                      }`}
                    >
                      Start 6-Month Free Trial
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ADA Accessibility Section */}
      <section id="accessibility" className="py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="rounded-2xl border-2 border-border bg-card p-8 sm:p-12 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Eye className="size-6" />
              </div>
              <div>
                <h2 className="text-2xl font-extrabold text-foreground">
                  Built for Full ADA & Section 508 Accessibility
                </h2>
                <p className="text-xs text-muted-foreground">
                  Compliant with Americans with Disabilities Act standards and WCAG 2.1 AAA contrast
                  guidelines.
                </p>
              </div>
            </div>

            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-border p-4 bg-background">
                <h3 className="text-sm font-bold text-foreground">WCAG AAA Contrast</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  High-contrast black/yellow and dark modes provide effortless readability in direct
                  sunlight and dark pump stations.
                </p>
              </div>

              <div className="rounded-xl border border-border p-4 bg-background">
                <h3 className="text-sm font-bold text-foreground">Dynamic Text Scaling</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Scale application typography up to 150% without overflowing cards, tables, or
                  navigation headers.
                </p>
              </div>

              <div className="rounded-xl border border-border p-4 bg-background">
                <h3 className="text-sm font-bold text-foreground">Screen Reader Ready</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Full ARIA landmark roles, skip-to-content links, live region announcements, and
                  descriptive button labels.
                </p>
              </div>

              <div className="rounded-xl border border-border p-4 bg-background">
                <h3 className="text-sm font-bold text-foreground">Dyslexia Typography</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Integrated Atkinson Hyperlegible typeface, reading guide rulers, and interactive
                  element highlighting.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-sidebar-border bg-sidebar py-12 text-sidebar-foreground">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="flex size-6 items-center justify-center rounded bg-sidebar-primary text-sidebar-primary-foreground font-black text-xs">
              AC
            </div>
            <span className="text-sm font-bold uppercase tracking-wider">AssetCareConnect</span>
          </div>

          <p className="text-xs text-sidebar-foreground/70">
            © 2026 AssetCareConnect. Enterprise Computerized Maintenance Management System.
          </p>

          <div className="flex items-center gap-4 text-xs font-semibold text-sidebar-foreground/80">
            <a href="#features" className="hover:text-sidebar-foreground">
              Features
            </a>
            <a href="#pricing" className="hover:text-sidebar-foreground">
              Pricing
            </a>
            <Link to="/auth" className="hover:text-sidebar-foreground">
              Sign in
            </Link>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <CompanyOnboardingDialog
        open={onboardingOpen}
        onOpenChange={setOnboardingOpen}
        defaultPlan={selectedPlan}
        onLaunchUploader={() => setUploaderOpen(true)}
      />

      <BulkAssetUploader open={uploaderOpen} onOpenChange={setUploaderOpen} />
    </div>
  );
}

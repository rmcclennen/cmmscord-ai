import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Building2,
  CheckCircle2,
  ShieldCheck,
  CreditCard,
  FileSpreadsheet,
  ArrowRight,
  Zap,
  Users,
  Boxes,
  Gift,
  Sparkles,
  Award,
} from "lucide-react";

export type PlanKey = "unlimited" | "starter" | "enterprise";

interface CompanyOnboardingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLaunchUploader?: () => void;
  defaultPlan?: PlanKey;
}

export function CompanyOnboardingDialog({
  open,
  onOpenChange,
  onLaunchUploader,
  defaultPlan = "unlimited",
}: CompanyOnboardingDialogProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1); // 1 = Plan & Company Info, 2 = Billing/Checkout, 3 = Activated
  const [selectedPlan, setSelectedPlan] = useState<PlanKey>(defaultPlan);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("annual");

  const [companyName, setCompanyName] = useState("");
  const [industry, setIndustry] = useState("wastewater");
  const [assetRange, setAssetRange] = useState("500-1500");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [paymentType, setPaymentType] = useState<"card" | "invoice">("card");
  const [poNumber, setPoNumber] = useState("");

  const plans: Record<
    PlanKey,
    {
      name: string;
      monthly: number;
      annualMonthly: number;
      annualTotal: number;
      popular?: boolean;
      trial: string;
      assets: string;
      seats: string;
      desc: string;
      features: string[];
    }
  > = {
    unlimited: {
      name: "Unlimited Plant License",
      monthly: 375,
      annualMonthly: 333,
      annualTotal: 4000,
      popular: true,
      trial: "6 Months Free",
      assets: "Unlimited Assets",
      seats: "Unlimited Users & Seats",
      desc: "Disruptive flat rate: Cheaper than legacy competitors ($15k–$30k/yr). Zero per-seat fees.",
      features: [
        "6-Month Full-Access Free Trial ($0 charged today)",
        "Unlimited plant equipment & site-specific assets",
        "Unlimited technician, supervisor & coordinator seats",
        "Send parts to supervisors & CMMS coordinators",
        "OEM suggested oil, grease, belts & seal specs",
        "Full PM generator & visual calendar engine",
        "Instant CSV fleet ingestion & full export",
        "Priority technical support & onboarding",
      ],
    },
    starter: {
      name: "Single Facility / Station",
      monthly: 149,
      annualMonthly: 124,
      annualTotal: 1490,
      trial: "6 Months Free",
      assets: "Up to 350 assets",
      seats: "Unlimited Users",
      desc: "For small water districts, lift stations, and localized shop crews.",
      features: [
        "6-Month Full-Access Free Trial ($0 charged today)",
        "Up to 350 tracked site assets",
        "Unlimited technician & operator seats",
        "PM schedule generator & calendar",
        "Mobile nameplate photo capture",
        "Work order dispatch & compliance logs",
      ],
    },
    enterprise: {
      name: "Municipal Authority / Multi-Dept",
      monthly: 790,
      annualMonthly: 708,
      annualTotal: 8500,
      trial: "6 Months Free",
      assets: "Unlimited Assets (All Plants)",
      seats: "Unlimited Users (All Depts)",
      desc: "For municipal utility authorities, public works directorates, and regional multi-plant operations.",
      features: [
        "6-Month Full-Access Free Trial ($0 charged today)",
        "Multi-department access (Water, WWTP, Streets, Fleet)",
        "Unlimited assets across all municipal facilities",
        "Custom ERP & SCADA telemetry integration",
        "White-glove spreadsheet migration service",
        "Dedicated account engineer & 99.9% SLA",
      ],
    },
  };

  const currentPlan = plans[selectedPlan] || plans.unlimited;
  const activeMonthlyPrice =
    billingCycle === "annual" ? currentPlan.annualMonthly : currentPlan.monthly;
  const activeAnnualTotal = currentPlan.annualTotal;

  const handleCompleteSetup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim() || !contactName.trim() || !contactEmail.trim()) {
      toast.error("Please fill in your facility and contact details.");
      return;
    }
    setStep(2);
  };

  const handleConfirmPurchase = () => {
    toast.success(`6-Month Free Trial Active! Workspace created for ${companyName}.`);
    setStep(3);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto p-6">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Building2 className="size-5" aria-hidden="true" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold">
                  {step === 3
                    ? "Facility Workspace Live"
                    : "Get AssetCareConnect for Your Facility"}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  {step === 3
                    ? "Your facility environment is ready. Import your assets to get started."
                    : "Affordable, flat-rate CMMS designed by operators and maintenance pros. Unlimited users, zero per-seat fees."}
                </DialogDescription>
              </div>
            </div>
            {step < 3 && (
              <Badge variant="outline" className="text-xs">
                Step {step} of 2
              </Badge>
            )}
          </div>
        </DialogHeader>

        {/* 6-Month Risk-Free Trial Guarantee Banner */}
        <div className="rounded-xl border border-primary/40 bg-primary/10 p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground font-black text-xs shadow-sm">
              6M
            </div>
            <div>
              <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                6-Month 100% Free Full-Access Trial
                <Badge className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0 font-bold">
                  $0 Today
                </Badge>
              </p>
              <p className="text-[11px] text-muted-foreground">
                Enjoy 6 full months of unlimited access for your operators, mechanics, and
                supervisors with zero obligation.
              </p>
            </div>
          </div>
          <Badge
            variant="outline"
            className="bg-background text-primary border-primary/50 text-xs font-semibold shrink-0"
          >
            Cancel Anytime
          </Badge>
        </div>

        {/* Step 1: Select Plan & Company Profile */}
        {step === 1 && (
          <form onSubmit={handleCompleteSetup} className="mt-4 space-y-6">
            {/* Billing Switch */}
            <div className="flex items-center justify-center gap-3 rounded-xl bg-muted/60 p-2">
              <button
                type="button"
                onClick={() => setBillingCycle("monthly")}
                className={`rounded-lg px-4 py-1.5 text-xs font-bold transition-all ${
                  billingCycle === "monthly"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Monthly Billing
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle("annual")}
                className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-bold transition-all ${
                  billingCycle === "annual"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Annual Billing ($4,000/yr flat)
                <Badge className="bg-success text-success-foreground text-[10px] px-1.5 py-0">
                  Save 20%
                </Badge>
              </button>
            </div>

            {/* Plan Cards */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {(Object.keys(plans) as PlanKey[]).map((key) => {
                const p = plans[key];
                const active = selectedPlan === key;
                const price =
                  billingCycle === "annual" ? `$${p.annualTotal}/yr` : `$${p.monthly}/mo`;
                const subtext =
                  billingCycle === "annual"
                    ? `($${p.annualMonthly}/mo billed annually)`
                    : "Billed monthly";

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedPlan(key)}
                    className={`relative flex flex-col rounded-xl border-2 p-4 text-left transition-all ${
                      active
                        ? "border-primary bg-primary/5 shadow-md ring-2 ring-primary/40"
                        : "border-border bg-card hover:border-primary/40"
                    }`}
                  >
                    {p.popular && (
                      <span className="absolute -top-2.5 right-3 rounded-full bg-primary px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-primary-foreground">
                        Most Popular
                      </span>
                    )}
                    <h3 className="text-sm font-bold text-foreground">{p.name}</h3>
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="text-2xl font-black text-foreground">{price}</span>
                    </div>
                    <p className="text-[10px] font-medium text-muted-foreground">{subtext}</p>
                    <div className="mt-1 inline-block rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                      ✓ {p.trial} Included
                    </div>
                    <p className="mt-1.5 text-[11px] text-muted-foreground">{p.desc}</p>

                    <div className="mt-3 space-y-1.5 border-t border-border pt-3 text-[11px]">
                      <div className="flex items-center gap-1.5 font-semibold text-foreground">
                        <Boxes className="size-3.5 text-primary" /> {p.assets}
                      </div>
                      <div className="flex items-center gap-1.5 font-semibold text-foreground">
                        <Users className="size-3.5 text-primary" /> {p.seats}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Company & Contact Details */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Building2 className="size-4 text-primary" /> Facility &amp; Organization Info
              </h4>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="org-name" className="text-xs font-bold text-foreground">
                    Plant / Municipality / Company Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="org-name"
                    required
                    placeholder="e.g. Metro Water Recovery & Utilities"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="industry-select" className="text-xs font-bold text-foreground">
                    Target Industry / Municipal Department
                  </Label>
                  <Select value={industry} onValueChange={setIndustry}>
                    <SelectTrigger id="industry-select" className="text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="wastewater">Wastewater Treatment Plant (WWTP)</SelectItem>
                      <SelectItem value="water_district">
                        Drinking Water &amp; Water Utilities
                      </SelectItem>
                      <SelectItem value="public_works">
                        Public Works, Streets &amp; Fleet Garage
                      </SelectItem>
                      <SelectItem value="energy">Power, Energy &amp; Substations</SelectItem>
                      <SelectItem value="manufacturing">
                        Industrial &amp; Heavy Manufacturing
                      </SelectItem>
                      <SelectItem value="food_bev">Food &amp; Beverage Processing</SelectItem>
                      <SelectItem value="facilities">Municipal Parks &amp; Facilities</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="asset-range" className="text-xs font-bold text-foreground">
                    Estimated Plant Equipment Count
                  </Label>
                  <Select value={assetRange} onValueChange={setAssetRange}>
                    <SelectTrigger id="asset-range" className="text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="under-250">Under 250 Assets</SelectItem>
                      <SelectItem value="250-1000">250 – 1,000 Assets</SelectItem>
                      <SelectItem value="1000-2500">1,000 – 2,500 Assets</SelectItem>
                      <SelectItem value="2500-plus">
                        2,500+ Assets (Multi-Plant / Regional)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="contact-name" className="text-xs font-bold text-foreground">
                    Primary Plant Admin / Lead Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="contact-name"
                    required
                    placeholder="e.g. Lead Maintenance Supervisor"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="contact-email" className="text-xs font-bold text-foreground">
                    Work Email (Domain-Authenticated) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="contact-email"
                    type="email"
                    required
                    placeholder="e.g. supervisor@plantoperations.com"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    className="text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-border pt-4">
              <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" className="font-bold">
                Continue to 6-Month Free Trial <ArrowRight className="ml-1.5 size-3.5" />
              </Button>
            </div>
          </form>
        )}

        {/* Step 2: Payment / Checkout Simulation */}
        {step === 2 && (
          <div className="mt-4 space-y-6">
            {/* Order Summary Box */}
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-foreground">{currentPlan.name}</h4>
                    <Badge className="bg-primary text-primary-foreground text-[10px] font-bold">
                      6 Months Free Trial
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Facility: <span className="font-semibold text-foreground">{companyName}</span> (
                    {currentPlan.assets}, {currentPlan.seats})
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black text-primary">$0.00</p>
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">
                    Due Today (6-Month Free Trial)
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Then{" "}
                    {billingCycle === "annual"
                      ? `$${activeAnnualTotal}/yr flat`
                      : `$${activeMonthlyPrice}/mo`}
                  </p>
                </div>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Trial Verification &amp; Future Billing Option
              </h4>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentType("card")}
                  className={`flex items-center gap-2 rounded-lg border-2 p-3 text-left font-bold text-xs ${
                    paymentType === "card"
                      ? "border-primary bg-primary/5 text-primary ring-2 ring-primary/30"
                      : "border-border bg-card text-foreground"
                  }`}
                >
                  <CreditCard className="size-4" /> Credit Card ($0 Charged Today)
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentType("invoice")}
                  className={`flex items-center gap-2 rounded-lg border-2 p-3 text-left font-bold text-xs ${
                    paymentType === "invoice"
                      ? "border-primary bg-primary/5 text-primary ring-2 ring-primary/30"
                      : "border-border bg-card text-foreground"
                  }`}
                >
                  <Building2 className="size-4" /> Municipal PO / Net-30 Invoice
                </button>
              </div>

              {paymentType === "card" ? (
                <div className="space-y-3 pt-2">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">
                      Card Number (6 Months Free - $0 Charged Today)
                    </Label>
                    <Input
                      placeholder="4000 1234 5678 9010"
                      defaultValue="4242 •••• •••• 4242"
                      className="text-xs font-mono"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">Expires</Label>
                      <Input
                        placeholder="MM/YY"
                        defaultValue="12/28"
                        className="text-xs font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">CVC / CVV</Label>
                      <Input placeholder="123" defaultValue="•••" className="text-xs font-mono" />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 pt-2">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">
                      Municipal PO # or Department Billing Code (Optional for Trial)
                    </Label>
                    <Input
                      placeholder="e.g. PO-2026-UTIL-8921 (or Leave Blank for Trial)"
                      value={poNumber}
                      onChange={(e) => setPoNumber(e.target.value)}
                      className="text-xs font-mono"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    An official trial confirmation and future Net-30 invoice will be prepared for{" "}
                    <span className="font-semibold">{contactEmail}</span> after your 6-month
                    evaluation.
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 rounded-lg bg-success/10 p-3 text-xs text-success font-semibold border border-success/30">
              <ShieldCheck className="size-4 shrink-0" />
              Includes unlimited seats, OEM lube/belt specs, parts routing, nameplate OCR, and full
              ADA accessibility compliance.
            </div>

            <div className="flex items-center justify-between border-t border-border pt-4">
              <Button variant="outline" size="sm" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmPurchase}
                className="font-bold bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Zap className="mr-1.5 size-4" /> Activate 6-Month Free Trial
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Success & Asset Uploader Launch */}
        {step === 3 && (
          <div className="mt-4 flex flex-col items-center justify-center py-6 text-center space-y-4">
            <div className="flex size-14 items-center justify-center rounded-full bg-success/10 text-success">
              <CheckCircle2 className="size-8" />
            </div>
            <h3 className="text-xl font-bold text-foreground">
              {companyName} 6-Month Free Trial is Active!
            </h3>
            <p className="max-w-md text-xs text-muted-foreground">
              Your facility account is active with{" "}
              <span className="font-semibold text-foreground">{currentPlan.name}</span>. The next
              step is to import your plant's equipment fleet so your maintenance technicians and
              supervisors can begin logging PMs, viewing OEM lube specs, and routing parts requests.
            </p>

            <div className="mt-4 flex flex-col sm:flex-row gap-3">
              <Button
                onClick={() => {
                  onOpenChange(false);
                  if (onLaunchUploader) onLaunchUploader();
                }}
                size="lg"
                className="flex items-center gap-2 font-bold"
              >
                <FileSpreadsheet className="size-4" />
                Upload &amp; Import Site Assets
              </Button>
              <Button variant="outline" onClick={() => onOpenChange(false)} className="text-xs">
                Explore Control Room First
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

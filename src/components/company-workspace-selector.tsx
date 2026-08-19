import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getActiveCompany,
  setActiveCompany,
  DEFAULT_COMPANY,
  GLOBAL_ALL_COMPANIES,
  type CompanyInfo,
} from "@/lib/company-context";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Building2, Check, Plus, Shield, ChevronDown } from "lucide-react";
import { useSessionUser } from "@/hooks/use-session-user";

export function CompanyWorkspaceSelector() {
  const { user } = useSessionUser();
  const queryClient = useQueryClient();
  const [activeCompany, setCompany] = useState<CompanyInfo>(() => getActiveCompany(user));
  const [createOpen, setCreateOpen] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");

  useEffect(() => {
    setCompany(getActiveCompany(user));

    const handleCompanyChange = (e: Event) => {
      const customEvent = e as CustomEvent<CompanyInfo>;
      if (customEvent.detail) {
        setCompany(customEvent.detail);
      }
    };

    window.addEventListener("cmms:company-changed", handleCompanyChange);
    return () => window.removeEventListener("cmms:company-changed", handleCompanyChange);
  }, [user]);

  const handleSelectCompany = (comp: CompanyInfo) => {
    setActiveCompany(comp);
    setCompany(comp);
    queryClient.invalidateQueries();
    toast.success(`Switched active workspace to: ${comp.name}`);
  };

  const handleCreateCompany = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName.trim()) return;

    const slug = newCompanyName.toLowerCase().replace(/[^a-z0-9]+/g, "_");
    const newComp: CompanyInfo = { id: slug, name: newCompanyName.trim() };

    setActiveCompany(newComp);
    setCompany(newComp);
    queryClient.invalidateQueries();
    setCreateOpen(false);
    setNewCompanyName("");
    toast.success(`New company workspace created: ${newComp.name}`);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            className="hidden sm:inline-flex items-center gap-1.5 border-sidebar-border bg-sidebar-accent/50 text-sidebar-foreground text-xs font-bold hover:bg-sidebar-accent hover:text-sidebar-accent-foreground max-w-[200px] truncate"
          >
            <Building2 className="size-3.5 text-primary shrink-0" />
            <span className="truncate">{activeCompany.name}</span>
            <ChevronDown className="size-3 opacity-60 shrink-0" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Active Company Workspace
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          <DropdownMenuItem
            className="flex items-center justify-between text-xs cursor-pointer"
            onClick={() => handleSelectCompany(DEFAULT_COMPANY)}
          >
            <div className="flex items-center gap-2 font-medium">
              <Building2 className="size-3.5 text-blue-500" />
              <span>Sioux City Plant Operations</span>
            </div>
            {activeCompany.id === DEFAULT_COMPANY.id && <Check className="size-3.5 text-primary" />}
          </DropdownMenuItem>

          {activeCompany.id !== DEFAULT_COMPANY.id &&
            activeCompany.id !== GLOBAL_ALL_COMPANIES.id && (
              <DropdownMenuItem
                className="flex items-center justify-between text-xs cursor-pointer font-semibold"
                onClick={() => handleSelectCompany(activeCompany)}
              >
                <div className="flex items-center gap-2">
                  <Building2 className="size-3.5 text-emerald-500" />
                  <span className="truncate">{activeCompany.name}</span>
                </div>
                <Check className="size-3.5 text-primary" />
              </DropdownMenuItem>
            )}

          <DropdownMenuSeparator />

          <DropdownMenuItem
            className="flex items-center gap-2 text-xs cursor-pointer text-primary font-semibold"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="size-3.5" />
            <span>Create New Company Workspace</span>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            className="flex items-center justify-between text-xs cursor-pointer text-muted-foreground hover:text-foreground"
            onClick={() => handleSelectCompany(GLOBAL_ALL_COMPANIES)}
          >
            <div className="flex items-center gap-2">
              <Shield className="size-3.5 text-purple-500" />
              <span>All Companies (Global Admin)</span>
            </div>
            {activeCompany.id === GLOBAL_ALL_COMPANIES.id && (
              <Check className="size-3.5 text-primary" />
            )}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleCreateCompany}>
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <Building2 className="size-4 text-primary" />
                Create New Company Workspace
              </DialogTitle>
            </DialogHeader>

            <div className="py-4 space-y-3">
              <p className="text-xs text-muted-foreground">
                Enter your company, municipality, or plant facility name to set up a clean, isolated
                workspace.
              </p>
              <Input
                placeholder="e.g., Des Moines Water Works / Cedar Rapids WWTP"
                value={newCompanyName}
                onChange={(e) => setNewCompanyName(e.target.value)}
                className="text-xs"
                autoFocus
                required
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" className="font-bold">
                Create & Switch Workspace
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

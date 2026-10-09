import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMyCompanies } from "@/hooks/use-companies";
import { useMyRoles } from "@/hooks/use-my-roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Real, database-backed companies: who you belong to, and (for managers) creating a new one. */
export function CompanyMembershipCard() {
  const { companies, hasNone } = useMyCompanies();
  const { canManageRoles, roles } = useMyRoles();
  const canCreate = canManageRoles || roles.includes("manager");
  const queryClient = useQueryClient();
  const [name, setName] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("create_company", { _name: name.trim() });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Company created");
      setName("");
      void queryClient.invalidateQueries({ queryKey: ["my-companies"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="space-y-3 rounded-lg border border-border bg-card p-4">
      <h2 className="flex items-center gap-2 text-sm font-bold">
        <Building2 className="size-4 text-primary" aria-hidden="true" /> Your companies
      </h2>
      {hasNone ? (
        <p className="text-sm text-muted-foreground">
          You're not in a company yet, so you won't see any plant data. Ask a manager to add you
          from the Team page.
        </p>
      ) : (
        <ul className="text-sm">
          {companies.map((c) => (
            <li key={c.id} className="py-0.5">
              {c.name}
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">
        Each company's assets, work orders, parts and people are kept separate by the database.
      </p>
      {canCreate && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) create.mutate();
          }}
        >
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New company name"
            maxLength={120}
            aria-label="New company name"
          />
          <Button type="submit" variant="outline" disabled={!name.trim() || create.isPending}>
            Create
          </Button>
        </form>
      )}
    </section>
  );
}

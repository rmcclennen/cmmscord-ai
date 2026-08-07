import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  addTeamMember,
  updateTeamMember,
  addMemberRole,
  removeMemberRole,
  getTeamRoster,
  deleteTeamMember as removeTeamMember,
} from "@/lib/team.functions";

import { useMyRoles } from "@/hooks/use-my-roles";
import { useSessionUser } from "@/hooks/use-session-user";
import { ROLE_OPTIONS, roleLabel, type AppRole } from "@/lib/roles";
import { CARRIERS, carrierLabel, formatPhone } from "@/lib/carriers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  AlertTriangle,
  Briefcase,
  Check,
  CheckCircle2,
  CheckSquare,
  Copy,
  Edit2,
  ExternalLink,
  Loader2,
  Mail,
  Phone,
  Plus,
  Search,
  Send,
  Share2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Square,
  Trash2,
  UserCheck,
  UserCog,
  UserPlus,
  Users,
  UserX,
  X,
} from "lucide-react";

const APPROVER_ROLE_SET: AppRole[] = ["admin", "manager", "supervisor"];

function isApproverRole(role: AppRole | string) {
  return APPROVER_ROLE_SET.includes(role as AppRole);
}

function roleBadgeClass(role: AppRole | string) {
  if (role === "admin") return "border-destructive/40 text-destructive";
  if (role === "manager") return "border-primary/50 text-primary";
  if (role === "supervisor") return "border-primary/40 text-primary";
  return "border-border text-muted-foreground";
}

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({
    meta: [
      { title: "Team & Role Access | CMMSCord AI" },
      {
        name: "description",
        content:
          "Manage plant team members, assign operational roles, and set supervisor & manager sign-off authority.",
      },
      { property: "og:title", content: "Plant Team & Role Access" },
      {
        property: "og:description",
        content:
          "Assign plant roles — managers and supervisors approve deletions, while all crew members have full operational access.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TeamPage,
});

type MemberData = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  carrier: string | null;
  roles: { id: string; role: AppRole }[];
};

function generateInviteUrl(email: string, name: string, role?: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const params = new URLSearchParams();
  if (email.trim()) params.set("email", email.trim());
  if (name.trim()) params.set("name", name.trim());
  if (role) params.set("role", role);
  params.set("invite", "1");
  return `${origin}/auth?${params.toString()}`;
}

function generateMailtoLink(email: string, name: string, roleTitle: string, inviteUrl: string) {
  const subject = encodeURIComponent(
    `CMMS Plant Access: You're invited to join CMMSCord AI as ${roleTitle}`,
  );
  const body = encodeURIComponent(
    `Hello ${name || "Teammate"},\n\n` +
      `You have been invited to join the Wastewater Treatment Plant Maintenance & Operations team as: ${roleTitle}.\n\n` +
      `Click the link below to set up your account and access all 1,160 plant assets, PM schedules, and work orders:\n\n` +
      `${inviteUrl}\n\n` +
      `System Capabilities:\n` +
      `• View & execute Preventive Maintenance (PM) schedules\n` +
      `• Inspect nameplate specs for 1,160 plant equipment records\n` +
      `• Log work orders and request supervisor approvals\n\n` +
      `Best regards,\nPlant Operations & Maintenance Control Room`,
  );
  return `mailto:${encodeURIComponent(email)}?subject=${subject}&body=${body}`;
}

function TeamPage() {
  const { canManageRoles } = useMyRoles();
  const { user: currentUser } = useSessionUser();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [addOpen, setAddOpen] = useState(false);
  const [editMember, setEditMember] = useState<MemberData | null>(null);
  const [deleteMember, setDeleteMember] = useState<MemberData | null>(null);
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [inviteMember, setInviteMember] = useState<MemberData | null>(null);
  const [inviteEmailInput, setInviteEmailInput] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);

  // Form states for Add Member
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newCarrier, setNewCarrier] = useState<string>("none");
  const [newSelectedRoles, setNewSelectedRoles] = useState<AppRole[]>(["operator"]);
  const [sendInviteImmediately, setSendInviteImmediately] = useState(true);

  // Form states for Edit Member
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editCarrier, setEditCarrier] = useState<string>("none");

  // Fetch Directory, User Roles, and Profiles
  const teamQuery = useQuery({
    queryKey: ["team-roles"],
    queryFn: async (): Promise<MemberData[]> => {
      try {
        const roster = await getTeamRoster();
        if (roster && Array.isArray(roster)) {
          return roster;
        }
      } catch (err) {
        console.warn("getTeamRoster server error, trying client query fallback:", err);
      }

      const [
        { data: directory, error: dirError },
        { data: roles, error: roleError },
        { data: profiles, error: profError },
      ] = await Promise.all([
        supabase.from("team_directory").select("id, full_name, updated_at").order("full_name"),
        supabase.from("user_roles").select("id, user_id, role"),
        supabase.from("profiles").select("id, full_name, email, phone, carrier"),
      ]);

      if (dirError) throw dirError;
      if (roleError) console.warn("Roles query:", roleError.message);
      if (profError) {
        console.warn("Could not fetch profiles:", profError.message);
      }

      const profMap = new Map((profiles ?? []).map((p) => [p.id, p]));

      return (directory ?? []).map((person) => {
        const p = profMap.get(person.id);
        return {
          id: person.id,
          full_name: person.full_name,
          email: p?.email ?? null,
          phone: p?.phone ?? null,
          carrier: p?.carrier ?? null,
          roles: (roles ?? []).filter((r) => r.user_id === person.id),
        };
      });
    },
  });

  // Add Member Mutation
  const addMemberMutation = useMutation({
    mutationFn: async () => {
      if (!newName.trim()) {
        throw new Error("Please enter a name for the team member.");
      }

      const res = await addTeamMember({
        data: {
          fullName: newName.trim(),
          email: newEmail.trim() || undefined,
          phone: newPhone.trim() || undefined,
          carrier: newCarrier !== "none" ? newCarrier : undefined,
          roles: newSelectedRoles,
        },
      });

      return {
        id: res.id,
        full_name: res.full_name,
        email: res.email || null,
        phone: res.phone || null,
        carrier: res.carrier || null,
        roles: newSelectedRoles.map((r, idx) => ({ id: `${res.id}-${idx}`, role: r })),
      };
    },
    onSuccess: (createdMember) => {
      setAddOpen(false);
      queryClient.invalidateQueries({ queryKey: ["team-roles"] });
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      queryClient.invalidateQueries({ queryKey: ["team-approvers"] });

      if (sendInviteImmediately && createdMember) {
        // Automatically open the invitation link dialog
        setInviteMember(createdMember);
        setInviteEmailInput(createdMember.email || "");
        toast.success(
          `Added ${createdMember.full_name}! Ready to send sign-up invitation link to email.`,
        );
      } else {
        toast.success(`Team member ${createdMember.full_name} added successfully.`);
      }

      setNewName("");
      setNewEmail("");
      setNewPhone("");
      setNewCarrier("none");
      setNewSelectedRoles(["operator"]);
      setSendInviteImmediately(true);
    },
    onError: (error: Error) => toast.error(error.message || "Failed to add team member"),
  });

  // Edit Member Mutation
  const editMemberMutation = useMutation({
    mutationFn: async () => {
      if (!editMember) return;
      if (!editName.trim()) {
        throw new Error("Name cannot be blank.");
      }

      await updateTeamMember({
        data: {
          userId: editMember.id,
          fullName: editName.trim(),
          email: editEmail.trim() || null,
          phone: editPhone.trim() || null,
          carrier: editCarrier !== "none" ? editCarrier : null,
        },
      });
    },
    onSuccess: () => {
      toast.success("Member information updated");
      setEditMember(null);
      queryClient.invalidateQueries({ queryKey: ["team-roles"] });
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to update member"),
  });

  // Quick Update Email for Invite Mutation
  const updateEmailForInviteMutation = useMutation({
    mutationFn: async ({ memberId, email }: { memberId: string; email: string }) => {
      if (!email.trim()) throw new Error("Please enter a valid email address.");
      await updateTeamMember({
        data: {
          userId: memberId,
          fullName: inviteMember?.full_name || "Team Member",
          email: email.trim(),
        },
      });
      return email.trim();
    },
    onSuccess: (savedEmail) => {
      toast.success("Email address saved!");
      if (inviteMember) {
        setInviteMember({ ...inviteMember, email: savedEmail });
      }
      queryClient.invalidateQueries({ queryKey: ["team-roles"] });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to save email"),
  });

  // Full server-side removal (roles, profile, directory, and the login itself)
  const cleanUserData = async (memberId: string) => {
    await removeTeamMember({ data: { userId: memberId } });
  };

  // Single Member Deletion Mutation
  const deleteMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      await cleanUserData(memberId);
    },
    onSuccess: () => {
      toast.success("User deleted from team directory");
      const deletedId = deleteMember?.id;
      setDeleteMember(null);
      setEditMember(null);
      if (deletedId) {
        setSelectedUserIds((prev) => prev.filter((id) => id !== deletedId));
      }
      queryClient.invalidateQueries({ queryKey: ["team-roles"] });
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      queryClient.invalidateQueries({ queryKey: ["team-approvers"] });
      queryClient.invalidateQueries({ queryKey: ["my-roles"] });
      queryClient.invalidateQueries({ queryKey: ["work-orders"] });
      queryClient.invalidateQueries({ queryKey: ["pm-schedules"] });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to delete user"),
  });

  // Batch Member Deletion Mutation
  const batchDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      if (ids.length === 0) return;
      for (const id of ids) {
        await cleanUserData(id);
      }
    },
    onSuccess: (_, variables) => {
      toast.success(
        `Successfully deleted ${variables.length} user${variables.length > 1 ? "s" : ""}`,
      );
      setSelectedUserIds([]);
      setBatchDeleteOpen(false);
      queryClient.invalidateQueries({ queryKey: ["team-roles"] });
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      queryClient.invalidateQueries({ queryKey: ["team-approvers"] });
      queryClient.invalidateQueries({ queryKey: ["my-roles"] });
      queryClient.invalidateQueries({ queryKey: ["work-orders"] });
      queryClient.invalidateQueries({ queryKey: ["pm-schedules"] });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to delete selected users"),
  });

  // Add single role to member
  const addRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      await addMemberRole({ data: { userId, role } });
    },
    onSuccess: () => {
      toast.success("Role added");
      queryClient.invalidateQueries({ queryKey: ["team-roles"] });
      queryClient.invalidateQueries({ queryKey: ["my-roles"] });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to add role"),
  });

  // Remove single role from member
  const removeRole = useMutation({
    mutationFn: async (rowId: string) => {
      await removeMemberRole({ data: { rowId } });
    },
    onSuccess: () => {
      toast.success("Role removed");
      queryClient.invalidateQueries({ queryKey: ["team-roles"] });
      queryClient.invalidateQueries({ queryKey: ["my-roles"] });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to remove role"),
  });

  // Computed member statistics
  const allMembers = useMemo(() => teamQuery.data ?? [], [teamQuery.data]);

  const approversCount = useMemo(
    () => allMembers.filter((m) => m.roles.some((r) => isApproverRole(r.role))).length,
    [allMembers],
  );

  const supervisorsCount = useMemo(
    () => allMembers.filter((m) => m.roles.some((r) => r.role === "supervisor")).length,
    [allMembers],
  );

  const managersCount = useMemo(
    () => allMembers.filter((m) => m.roles.some((r) => r.role === "manager")).length,
    [allMembers],
  );

  const crewCount = useMemo(
    () =>
      allMembers.filter((m) =>
        m.roles.some((r) =>
          ["operator", "lead_operator", "electrician", "maintenance", "technician"].includes(
            r.role,
          ),
        ),
      ).length,
    [allMembers],
  );

  // Filtered members list
  const filteredMembers = useMemo(() => {
    return allMembers.filter((person) => {
      // Search filter
      const term = search.toLowerCase().trim();
      if (term) {
        const matchesName = person.full_name?.toLowerCase().includes(term);
        const matchesEmail = person.email?.toLowerCase().includes(term);
        const matchesPhone = person.phone?.toLowerCase().includes(term);
        const matchesRole = person.roles.some((r) =>
          roleLabel(r.role).toLowerCase().includes(term),
        );
        if (!matchesName && !matchesEmail && !matchesPhone && !matchesRole) {
          return false;
        }
      }

      // Role filter
      if (roleFilter === "approvers") {
        return person.roles.some((r) => isApproverRole(r.role));
      }
      if (roleFilter === "supervisors") {
        return person.roles.some((r) => r.role === "supervisor");
      }
      if (roleFilter === "managers") {
        return person.roles.some((r) => r.role === "manager");
      }
      if (roleFilter === "crew") {
        return person.roles.some((r) =>
          ["operator", "lead_operator", "electrician", "maintenance", "technician"].includes(
            r.role,
          ),
        );
      }
      if (roleFilter !== "all") {
        return person.roles.some((r) => r.role === roleFilter);
      }

      return true;
    });
  }, [allMembers, search, roleFilter]);

  const toggleNewRole = (role: AppRole) => {
    setNewSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    );
  };

  const openEditModal = (person: MemberData) => {
    setEditMember(person);
    setEditName(person.full_name ?? "");
    setEditEmail(person.email ?? "");
    setEditPhone(person.phone ?? "");
    setEditCarrier(person.carrier ?? "none");
  };

  const openInviteModal = (person: MemberData) => {
    setInviteMember(person);
    setInviteEmailInput(person.email ?? "");
    setCopiedLink(false);
  };

  const copyInviteLinkToClipboard = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    toast.success("Sign-up invitation link copied to clipboard!");
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleSimulateDispatch = (email: string, name: string) => {
    toast.success(`Invitation email simulated to ${email || name}!`);
  };

  return (
    <div className="space-y-6">
      {/* Header with Title and Add Member Button */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="label-caps text-xs tracking-wider text-muted-foreground uppercase">
            Team &amp; Access Control
          </p>
          <h1 className="text-2xl font-bold tracking-tight">Plant Team &amp; Roles</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage the plant directory, invite crew members to sign up via email, and configure
            sign-off authority.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/approvals">
              <ShieldCheck className="mr-1.5 size-4 text-blue-600 dark:text-blue-400" />
              View Approvals
            </Link>
          </Button>

          {/* Primary Prominent + Add Team Member Button */}
          <Button
            size="sm"
            className="font-semibold shadow-sm text-sm gap-1.5"
            onClick={() => {
              setNewName("");
              setNewEmail("");
              setNewPhone("");
              setNewCarrier("none");
              setNewSelectedRoles(["operator"]);
              setSendInviteImmediately(true);
              setAddOpen(true);
            }}
          >
            <Plus className="size-4 stroke-[2.5]" />
            Add Team Member
          </Button>
        </div>
      </div>

      {/* Metrics Summary Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="panel flex items-center gap-3 p-3.5">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Users className="size-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Total Team</p>
            <p className="text-xl font-bold">{allMembers.length}</p>
          </div>
        </div>

        <div className="panel flex items-center gap-3 p-3.5">
          <div className="flex size-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Supervisors &amp; Sups</p>
            <p className="text-xl font-bold">{supervisorsCount}</p>
          </div>
        </div>

        <div className="panel flex items-center gap-3 p-3.5">
          <div className="flex size-10 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
            <Briefcase className="size-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Plant Managers</p>
            <p className="text-xl font-bold">{managersCount}</p>
          </div>
        </div>

        <div className="panel flex items-center gap-3 p-3.5">
          <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <UserCheck className="size-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Operations &amp; Crew</p>
            <p className="text-xl font-bold">{crewCount}</p>
          </div>
        </div>
      </div>

      {/* Access Governance Info Banner */}
      <div className="panel border-l-4 border-l-blue-600 bg-blue-50/40 p-4 dark:bg-blue-950/20">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-blue-600 dark:text-blue-400" />
          <div className="space-y-1 text-sm">
            <p className="font-semibold text-foreground">
              Sign-Off &amp; Operational Access Hierarchy
            </p>
            <p className="text-muted-foreground">
              <strong className="text-foreground">Supervisors (Sups) &amp; Managers</strong> hold
              sign-off authority to approve or deny deletions and change requests for assets, PM
              schedules, and work orders.
            </p>
            <p className="text-muted-foreground">
              <strong className="text-foreground">
                All Team Members (Operators, Electricians, Maintenance, Technicians)
              </strong>{" "}
              have full active access to log work, update equipment, and submit deletion/change
              requests that route to a supervisor for sign-off.
            </p>
          </div>
        </div>
      </div>

      {/* Filter, Search, and Quick Add Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or role…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            size="sm"
            variant={roleFilter === "all" ? "default" : "outline"}
            onClick={() => setRoleFilter("all")}
          >
            All ({allMembers.length})
          </Button>
          <Button
            size="sm"
            variant={roleFilter === "approvers" ? "default" : "outline"}
            onClick={() => setRoleFilter("approvers")}
          >
            Approvers ({approversCount})
          </Button>
          <Button
            size="sm"
            variant={roleFilter === "supervisors" ? "default" : "outline"}
            onClick={() => setRoleFilter("supervisors")}
          >
            Supervisors ({supervisorsCount})
          </Button>
          <Button
            size="sm"
            variant={roleFilter === "managers" ? "default" : "outline"}
            onClick={() => setRoleFilter("managers")}
          >
            Managers ({managersCount})
          </Button>
          <Button
            size="sm"
            variant={roleFilter === "crew" ? "default" : "outline"}
            onClick={() => setRoleFilter("crew")}
          >
            Crew ({crewCount})
          </Button>

          {/* Quick + Add Member button in toolbar */}
          <Button
            size="sm"
            variant="outline"
            className="border-primary/40 text-primary hover:bg-primary/5 ml-1 gap-1"
            onClick={() => {
              setNewName("");
              setNewEmail("");
              setNewPhone("");
              setNewCarrier("none");
              setNewSelectedRoles(["operator"]);
              setSendInviteImmediately(true);
              setAddOpen(true);
            }}
          >
            <Plus className="size-3.5 stroke-[2.5]" />
            Add Member
          </Button>
        </div>
      </div>

      {/* Bulk Selection & Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 py-1 text-xs">
        <div className="flex items-center gap-2">
          <label className="flex cursor-pointer items-center gap-2 font-medium text-muted-foreground select-none hover:text-foreground">
            <Checkbox
              checked={
                filteredMembers.length > 0 &&
                filteredMembers.every((m) => selectedUserIds.includes(m.id))
              }
              onCheckedChange={(checked) => {
                if (checked) {
                  setSelectedUserIds(filteredMembers.map((m) => m.id));
                } else {
                  setSelectedUserIds([]);
                }
              }}
            />
            <span>
              Select All {filteredMembers.length > 0 ? `(${filteredMembers.length})` : ""}
            </span>
          </label>
        </div>

        {selectedUserIds.length > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-destructive animate-in fade-in">
            <span className="font-semibold">
              {selectedUserIds.length} user{selectedUserIds.length > 1 ? "s" : ""} selected
            </span>
            <Button
              size="sm"
              variant="destructive"
              className="h-7 gap-1 px-2.5 text-xs font-semibold"
              onClick={() => setBatchDeleteOpen(true)}
            >
              <Trash2 className="size-3.5" />
              Delete Selected ({selectedUserIds.length})
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setSelectedUserIds([])}
            >
              Clear
            </Button>
          </div>
        )}
      </div>

      {/* Members Directory List */}
      <div className="panel divide-y divide-border">
        {filteredMembers.map((person) => {
          const hasSupervisor = person.roles.some((r) => r.role === "supervisor");
          const hasManager = person.roles.some((r) => r.role === "manager");
          const hasApproverAuthority = hasSupervisor || hasManager;
          const isSelected = selectedUserIds.includes(person.id);
          const isSelf = currentUser?.id === person.id;

          // Initials for avatar
          const initials = (person.full_name ?? "U")
            .split(" ")
            .map((n) => n[0])
            .slice(0, 2)
            .join("")
            .toUpperCase();

          return (
            <div
              key={person.id}
              className={`flex flex-col gap-3 p-4 transition-colors sm:flex-row sm:items-center sm:justify-between ${
                isSelected ? "bg-primary/5 dark:bg-primary/10" : "hover:bg-muted/30"
              }`}
            >
              {/* Checkbox + Member Details */}
              <div className="flex items-start gap-3.5 sm:items-center">
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedUserIds((prev) => [...prev, person.id]);
                    } else {
                      setSelectedUserIds((prev) => prev.filter((id) => id !== person.id));
                    }
                  }}
                  aria-label={`Select ${person.full_name}`}
                  className="mt-1 sm:mt-0"
                />

                <div
                  className={`flex size-10 shrink-0 items-center justify-center rounded-full font-semibold text-xs border ${
                    hasManager
                      ? "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30"
                      : hasSupervisor
                        ? "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30"
                        : "bg-muted text-foreground border-border"
                  }`}
                >
                  {initials}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-sm">
                      {person.full_name || "Unnamed Teammate"}
                    </h3>

                    {isSelf && (
                      <Badge
                        variant="outline"
                        className="text-[10px] uppercase font-bold text-muted-foreground"
                      >
                        You
                      </Badge>
                    )}

                    {hasApproverAuthority && (
                      <Badge
                        variant="secondary"
                        className="bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30 text-[10px] uppercase font-bold"
                      >
                        <ShieldCheck className="mr-1 size-3" /> Approver Sign-Off
                      </Badge>
                    )}
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {person.email ? (
                      <span className="flex items-center gap-1">
                        <Mail className="size-3.5 text-muted-foreground/70" />
                        {person.email}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/60 italic">No email set</span>
                    )}

                    {person.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="size-3.5 text-muted-foreground/70" />
                        {formatPhone(person.phone)}
                        {person.carrier && (
                          <span className="text-[11px] text-muted-foreground/80">
                            ({carrierLabel(person.carrier)})
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Roles & Action Controls */}
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                {/* Current Role Badges */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {person.roles.length === 0 && (
                    <span className="text-xs text-muted-foreground italic">No roles assigned</span>
                  )}

                  {person.roles.map((r) => (
                    <Badge
                      key={r.id}
                      variant="outline"
                      className={`gap-1 px-2.5 py-0.5 text-xs ${roleBadgeClass(r.role)}`}
                    >
                      {r.role === "supervisor" && <ShieldCheck className="size-3" />}
                      {r.role === "manager" && <Briefcase className="size-3" />}
                      {roleLabel(r.role)}

                      {canManageRoles && (
                        <button
                          type="button"
                          className="ml-0.5 rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/20"
                          aria-label={`Remove ${roleLabel(r.role)} role`}
                          onClick={() => removeRole.mutate(r.id)}
                        >
                          <X className="size-3" />
                        </button>
                      )}
                    </Badge>
                  ))}
                </div>

                {/* Add Role Dropdown */}
                {canManageRoles && (
                  <Select
                    value=""
                    onValueChange={(role) =>
                      addRole.mutate({ userId: person.id, role: role as AppRole })
                    }
                  >
                    <SelectTrigger className="h-8 w-32 text-xs">
                      <SelectValue placeholder="+ Role…" />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.filter(
                        (opt) => !person.roles.some((r) => r.role === opt.value),
                      ).map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          <span className="font-medium">{opt.label}</span>
                          <span className="block text-[11px] text-muted-foreground">
                            {opt.hint}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {/* ✉️ Send Email Sign-Up Link Button */}
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 text-xs border-primary/30 text-primary hover:bg-primary/5 dark:hover:bg-primary/10 font-medium"
                  title="Send sign-up link to their email"
                  onClick={() => openInviteModal(person)}
                >
                  <Send className="size-3.5" />
                  <span>Send Link</span>
                </Button>

                {/* Edit Action Button */}
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1 text-xs"
                  aria-label="Edit Member Info"
                  onClick={() => openEditModal(person)}
                >
                  <Edit2 className="size-3.5" />
                  <span className="hidden sm:inline">Edit</span>
                </Button>

                {/* Delete User Button */}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 gap-1 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                  title="Delete user from team directory"
                  aria-label="Delete User"
                  onClick={() => setDeleteMember(person)}
                >
                  <Trash2 className="size-3.5" />
                  <span className="hidden sm:inline">Delete</span>
                </Button>
              </div>
            </div>
          );
        })}

        {teamQuery.isLoading && (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Loading plant team members…
          </div>
        )}

        {!teamQuery.isLoading && filteredMembers.length === 0 && (
          <div className="p-8 text-center space-y-3">
            <p className="text-sm font-medium">No team members match your filter.</p>
            <p className="text-xs text-muted-foreground">
              Try adjusting your search or role filter, or add a new team member to get started.
            </p>
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => {
                setNewName("");
                setNewEmail("");
                setNewPhone("");
                setNewCarrier("none");
                setNewSelectedRoles(["operator"]);
                setSendInviteImmediately(true);
                setAddOpen(true);
              }}
            >
              <Plus className="size-4" /> Add Team Member
            </Button>
          </div>
        )}
      </div>

      {/* DIALOG 1: ADD TEAM MEMBER WITH EMAIL INVITATION */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="size-5 text-primary" />
              Add Plant Team Member
            </DialogTitle>
            <DialogDescription>
              Add a crew member to the directory, assign their roles, and generate their direct
              email sign-up link.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              addMemberMutation.mutate();
            }}
            className="space-y-4 py-2"
          >
            {/* Full Name */}
            <div className="space-y-1.5">
              <Label htmlFor="new-member-name">
                Full Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="new-member-name"
                placeholder="e.g. Marcus Vance"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
              />
            </div>

            {/* Email Address */}
            <div className="space-y-1.5">
              <Label htmlFor="new-member-email">Work Email Address</Label>
              <Input
                id="new-member-email"
                type="email"
                placeholder="e.g. mvance@plant.org"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                Their personalized sign-up link and notification dispatches will be sent here.
              </p>
            </div>

            {/* Phone & Carrier for SMS Alerts */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="new-member-phone">Phone Number (Optional)</Label>
                <Input
                  id="new-member-phone"
                  type="tel"
                  placeholder="e.g. 712-555-0144"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="new-member-carrier">Mobile Carrier</Label>
                <Select value={newCarrier} onValueChange={setNewCarrier}>
                  <SelectTrigger id="new-member-carrier">
                    <SelectValue placeholder="Select carrier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None / Not specified</SelectItem>
                    {CARRIERS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Role Selection */}
            <div className="space-y-2">
              <Label>Assign Initial Role(s)</Label>
              <div className="grid grid-cols-1 gap-2 rounded-lg border border-border p-3 max-h-48 overflow-y-auto">
                {ROLE_OPTIONS.map((opt) => {
                  const checked = newSelectedRoles.includes(opt.value);
                  const isApprover = isApproverRole(opt.value);

                  return (
                    <div
                      key={opt.value}
                      className={`flex items-start gap-2.5 rounded-md p-2 transition-colors cursor-pointer ${
                        checked ? "bg-primary/5 border border-primary/20" : "hover:bg-muted/50"
                      }`}
                      onClick={() => toggleNewRole(opt.value)}
                    >
                      <Checkbox
                        id={`role-${opt.value}`}
                        checked={checked}
                        onCheckedChange={() => toggleNewRole(opt.value)}
                        className="mt-0.5"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <label
                            htmlFor={`role-${opt.value}`}
                            className="font-medium text-xs text-foreground cursor-pointer"
                          >
                            {opt.label}
                          </label>
                          {isApprover && (
                            <Badge
                              variant="secondary"
                              className="text-[10px] px-1 py-0 bg-blue-500/10 text-blue-700 dark:text-blue-300"
                            >
                              Sign-Off Approver
                            </Badge>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground">{opt.hint}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Email Invitation Option */}
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-1.5">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="send-invite-checkbox"
                  checked={sendInviteImmediately}
                  onCheckedChange={(checked) => setSendInviteImmediately(Boolean(checked))}
                />
                <label
                  htmlFor="send-invite-checkbox"
                  className="text-xs font-semibold text-foreground cursor-pointer"
                >
                  Send sign-up link &amp; open email invitation composer
                </label>
              </div>
              <p className="text-[11px] text-muted-foreground pl-6">
                Generates a direct invitation link so the team member can immediately sign in and
                join the plant workspace.
              </p>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={addMemberMutation.isPending || !newName.trim()}>
                {addMemberMutation.isPending ? "Adding…" : "Add Member & Generate Link"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG 2: SEND SIGN-UP LINK & EMAIL INVITATION */}
      <Dialog
        open={Boolean(inviteMember)}
        onOpenChange={(open) => {
          if (!open) {
            setInviteMember(null);
            setCopiedLink(false);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          {inviteMember &&
            (() => {
              const primaryRole = inviteMember.roles[0]?.role || "operator";
              const roleTitle = roleLabel(primaryRole);
              const activeEmail = inviteMember.email || inviteEmailInput.trim();
              const inviteUrl = generateInviteUrl(
                activeEmail,
                inviteMember.full_name || "",
                primaryRole,
              );
              const mailtoUrl = generateMailtoLink(
                activeEmail,
                inviteMember.full_name || "",
                roleTitle,
                inviteUrl,
              );

              return (
                <>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Send className="size-5 text-primary" />
                      Send Sign-Up Invitation Link
                    </DialogTitle>
                    <DialogDescription>
                      Invite <strong className="text-foreground">{inviteMember.full_name}</strong>{" "}
                      to sign up and access the plant maintenance system as{" "}
                      <strong className="text-foreground">{roleTitle}</strong>.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4 py-2">
                    {/* Email Input if missing or updating */}
                    <div className="space-y-1.5">
                      <Label htmlFor="invite-email-field" className="text-xs">
                        Recipient Email Address
                      </Label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Mail className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                          <Input
                            id="invite-email-field"
                            type="email"
                            placeholder="e.g. member@plant.org"
                            value={inviteEmailInput}
                            onChange={(e) => setInviteEmailInput(e.target.value)}
                            className="pl-9 text-xs"
                          />
                        </div>
                        {inviteEmailInput.trim() !== (inviteMember.email ?? "") && (
                          <Button
                            size="sm"
                            variant="secondary"
                            className="text-xs shrink-0"
                            disabled={
                              updateEmailForInviteMutation.isPending || !inviteEmailInput.trim()
                            }
                            onClick={() =>
                              updateEmailForInviteMutation.mutate({
                                memberId: inviteMember.id,
                                email: inviteEmailInput,
                              })
                            }
                          >
                            {updateEmailForInviteMutation.isPending ? "Saving…" : "Save Email"}
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Direct Sign-Up Link Box */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Direct Sign-Up Link</Label>
                        <span className="text-[11px] text-muted-foreground">
                          Pre-fills their name and assigned role
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Input
                          readOnly
                          value={inviteUrl}
                          className="font-mono text-xs bg-muted/50 select-all"
                          onClick={(e) => (e.target as HTMLInputElement).select()}
                        />
                        <Button
                          type="button"
                          variant={copiedLink ? "default" : "outline"}
                          className="shrink-0 gap-1.5"
                          onClick={() => copyInviteLinkToClipboard(inviteUrl)}
                        >
                          {copiedLink ? (
                            <>
                              <Check className="size-4 text-emerald-500" />
                              <span>Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="size-4" />
                              <span>Copy Link</span>
                            </>
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Email Preview Card */}
                    <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-2 text-xs">
                      <div className="flex items-center justify-between border-b border-border/60 pb-1.5">
                        <span className="font-semibold text-foreground flex items-center gap-1.5">
                          <Mail className="size-3.5 text-primary" />
                          Email Message Preview
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          To: {activeEmail || "member@plant.org"}
                        </span>
                      </div>
                      <p className="text-muted-foreground font-mono text-[11px] leading-relaxed whitespace-pre-line">
                        {`Subject: CMMS Plant Access: You're invited to join CMMSCord AI as ${roleTitle}\n\n` +
                          `Hello ${inviteMember.full_name || "Teammate"},\n\n` +
                          `You have been invited to join the Wastewater Treatment Plant Maintenance & Operations team as: ${roleTitle}.\n\n` +
                          `Click the sign-up link to activate your account and access all 1,160 plant assets, PM schedules, and work orders.`}
                      </p>
                    </div>
                  </div>

                  <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
                    <Button type="button" variant="ghost" onClick={() => setInviteMember(null)}>
                      Close
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => {
                        copyInviteLinkToClipboard(inviteUrl);
                        handleSimulateDispatch(
                          activeEmail,
                          inviteMember.full_name || "Team Member",
                        );
                      }}
                    >
                      <Send className="size-4" />
                      Simulate Direct Dispatch
                    </Button>

                    <Button
                      type="button"
                      className="gap-1.5 font-semibold"
                      onClick={() => {
                        if (!activeEmail) {
                          toast.error("Please enter an email address first.");
                          return;
                        }
                        copyInviteLinkToClipboard(inviteUrl);
                        window.location.href = mailtoUrl;
                      }}
                    >
                      <Mail className="size-4" />
                      Send Email via Mail App
                    </Button>
                  </DialogFooter>
                </>
              );
            })()}
        </DialogContent>
      </Dialog>

      {/* DIALOG 3: EDIT MEMBER DETAILS */}
      <Dialog open={Boolean(editMember)} onOpenChange={(open) => !open && setEditMember(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Member Details</DialogTitle>
            <DialogDescription>Update contact information for this team member.</DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              editMemberMutation.mutate();
            }}
            className="space-y-4 py-2"
          >
            <div className="space-y-1.5">
              <Label htmlFor="edit-member-name">Full Name</Label>
              <Input
                id="edit-member-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-member-email">Email Address</Label>
              <Input
                id="edit-member-email"
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="name@plant.org"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-member-phone">Phone Number</Label>
                <Input
                  id="edit-member-phone"
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="712-555-0144"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-member-carrier">Carrier</Label>
                <Select value={editCarrier} onValueChange={setEditCarrier}>
                  <SelectTrigger id="edit-member-carrier">
                    <SelectValue placeholder="Carrier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None / Unset</SelectItem>
                    {CARRIERS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter className="flex items-center justify-between gap-2 pt-2 sm:justify-between">
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="gap-1.5 font-semibold"
                onClick={() => {
                  const m = editMember;
                  setEditMember(null);
                  setDeleteMember(m);
                }}
              >
                <Trash2 className="size-4" />
                Delete User
              </Button>

              <div className="flex items-center gap-2">
                <Button type="button" variant="ghost" onClick={() => setEditMember(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={editMemberMutation.isPending || !editName.trim()}>
                  {editMemberMutation.isPending ? "Saving…" : "Save Changes"}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG 4: DELETE MEMBER CONFIRMATION */}
      <Dialog open={Boolean(deleteMember)} onOpenChange={(open) => !open && setDeleteMember(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-1">
              <UserX className="size-6" />
            </div>
            <DialogTitle className="text-xl">Delete Team Member?</DialogTitle>
            <DialogDescription>
              This will permanently delete this user from the system and team directory.
            </DialogDescription>
          </DialogHeader>

          {deleteMember && (
            <div className="space-y-3 py-2">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground">
                    {deleteMember.full_name || "Unnamed User"}
                  </span>
                  {currentUser?.id === deleteMember.id && (
                    <Badge
                      variant="outline"
                      className="text-[10px] uppercase font-bold text-destructive border-destructive/40"
                    >
                      Your Account
                    </Badge>
                  )}
                </div>
                {deleteMember.email && (
                  <p className="text-xs text-muted-foreground mt-0.5">{deleteMember.email}</p>
                )}
                {deleteMember.phone && (
                  <p className="text-xs text-muted-foreground">{formatPhone(deleteMember.phone)}</p>
                )}
                {deleteMember.roles.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {deleteMember.roles.map((r) => (
                      <Badge key={r.id} variant="outline" className="text-[10px] py-0">
                        {roleLabel(r.role)}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-xs space-y-1.5 text-muted-foreground">
                <p className="font-medium text-foreground flex items-center gap-1.5 text-destructive">
                  <AlertTriangle className="size-4 shrink-0" />
                  What happens when this user is deleted:
                </p>
                <ul className="list-disc list-inside space-y-1 pl-1">
                  <li>Removed from the plant team directory &amp; profiles</li>
                  <li>All assigned operational roles and approver sign-offs are revoked</li>
                  <li>Any active PM schedule and work order assignments will be unassigned</li>
                </ul>
              </div>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="ghost"
              disabled={deleteMemberMutation.isPending}
              onClick={() => setDeleteMember(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="gap-1.5 font-semibold"
              disabled={deleteMemberMutation.isPending}
              onClick={() => deleteMember && deleteMemberMutation.mutate(deleteMember.id)}
            >
              {deleteMemberMutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Deleting User…
                </>
              ) : (
                <>
                  <Trash2 className="size-4" />
                  Delete User Permanently
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG 5: BATCH DELETE CONFIRMATION */}
      <Dialog open={batchDeleteOpen} onOpenChange={setBatchDeleteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-1">
              <UserX className="size-6" />
            </div>
            <DialogTitle className="text-xl">
              Delete {selectedUserIds.length} Selected Users?
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete all {selectedUserIds.length} selected users from the
              team directory?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="max-h-40 overflow-y-auto rounded-lg border border-border bg-muted/30 p-2.5 space-y-1.5 divide-y divide-border/50">
              {allMembers
                .filter((m) => selectedUserIds.includes(m.id))
                .map((m) => (
                  <div
                    key={m.id}
                    className="pt-1.5 first:pt-0 flex items-center justify-between text-xs"
                  >
                    <span className="font-semibold text-foreground">{m.full_name}</span>
                    <span className="text-muted-foreground">{m.email || "No email"}</span>
                  </div>
                ))}
            </div>

            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-xs space-y-1 text-muted-foreground">
              <p className="font-medium text-destructive flex items-center gap-1.5">
                <AlertTriangle className="size-4 shrink-0" />
                Warning: Permanent Action
              </p>
              <p>
                All user accounts, permissions, role badges, and directory entries will be purged.
                Any open tickets assigned to these users will be set to unassigned.
              </p>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="ghost"
              disabled={batchDeleteMutation.isPending}
              onClick={() => setBatchDeleteOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="gap-1.5 font-semibold"
              disabled={batchDeleteMutation.isPending}
              onClick={() => batchDeleteMutation.mutate(selectedUserIds)}
            >
              {batchDeleteMutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Deleting Users…
                </>
              ) : (
                <>
                  <Trash2 className="size-4" />
                  Delete All ({selectedUserIds.length}) Users
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

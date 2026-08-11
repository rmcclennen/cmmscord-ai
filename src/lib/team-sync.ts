import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { AppRole } from "./roles";
import type { TeamMember } from "./notify";

export type PlantMember = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  carrier: string | null;
  roles: { id: string; role: AppRole }[];
};

export function formatNameFromEmail(email?: string | null): string {
  if (!email) return "Plant Operations Tech";
  const userPart = email.split("@")[0] || "";

  if (email.toLowerCase().includes("rmcclennen") || userPart.toLowerCase().includes("rmcclennen")) {
    return "R. McClennen (Sioux City Plant Operations)";
  }
  if (email.toLowerCase().includes("demo")) {
    return "Plant Operations Lead (Demo)";
  }

  const clean = userPart
    .replace(/[._+-]+/g, " ")
    .trim()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");

  return clean || "Plant Maintenance Lead";
}

/** Standard facility maintenance team members for plant operations & work order delegation */
export const DEFAULT_PLANT_CREW: PlantMember[] = [
  {
    id: "crew-bob-anderson-001",
    full_name: "Bob Anderson",
    email: "banderson@plantoperations.local",
    phone: "7125550142",
    carrier: "verizon",
    roles: [
      { id: "role-bob-1", role: "supervisor" },
      { id: "role-bob-2", role: "manager" },
    ],
  },
  {
    id: "crew-marcus-vance-002",
    full_name: "Marcus Vance",
    email: "mvance@plantoperations.local",
    phone: "7125550188",
    carrier: "att",
    roles: [
      { id: "role-marcus-1", role: "lead_operator" },
      { id: "role-marcus-2", role: "supervisor" },
    ],
  },
  {
    id: "crew-dave-miller-003",
    full_name: "Dave Miller",
    email: "dmiller@plantoperations.local",
    phone: "7125550193",
    carrier: "verizon",
    roles: [
      { id: "role-dave-1", role: "electrician" },
      { id: "role-dave-2", role: "maintenance" },
    ],
  },
  {
    id: "crew-tyler-hayes-004",
    full_name: "Tyler Hayes",
    email: "thayes@plantoperations.local",
    phone: "7125550155",
    carrier: "tmobile",
    roles: [
      { id: "role-tyler-1", role: "maintenance" },
      { id: "role-tyler-2", role: "technician" },
    ],
  },
  {
    id: "crew-sarah-jenkins-005",
    full_name: "Sarah Jenkins",
    email: "sjenkins@plantoperations.local",
    phone: "7125550167",
    carrier: "uscellular",
    roles: [
      { id: "role-sarah-1", role: "technician" },
      { id: "role-sarah-2", role: "electrician" },
    ],
  },
  {
    id: "crew-rachel-adams-006",
    full_name: "Rachel Adams",
    email: "radams@plantoperations.local",
    phone: "7125550129",
    carrier: "verizon",
    roles: [
      { id: "role-rachel-1", role: "manager" },
      { id: "role-rachel-2", role: "supervisor" },
    ],
  },
];

const LOCAL_STORAGE_CREW_KEY = "cmms_plant_custom_crew_members";

export function getCustomLocalCrew(): PlantMember[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_CREW_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCustomLocalCrew(crew: PlantMember[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_STORAGE_CREW_KEY, JSON.stringify(crew));
  } catch (e) {
    console.warn("Could not save custom crew to localStorage:", e);
  }
}

export function addCustomLocalCrewMember(member: PlantMember) {
  const current = getCustomLocalCrew();
  const filtered = current.filter((m) => m.id !== member.id && m.full_name !== member.full_name);
  filtered.push(member);
  saveCustomLocalCrew(filtered);
}

export function removeCustomLocalCrewMember(memberId: string) {
  const current = getCustomLocalCrew();
  const filtered = current.filter((m) => m.id !== memberId);
  saveCustomLocalCrew(filtered);
}

/**
 * Ensures the signed-in user's profile and roles exist in the database and local session.
 */
export async function ensureUserSynced(
  user: User,
  roleHint?: AppRole | string | null,
): Promise<void> {
  if (!user || !user.id) return;

  try {
    const rawFullName =
      (user.user_metadata?.full_name as string) ||
      (user.user_metadata?.name as string) ||
      formatNameFromEmail(user.email);

    // 1. Check / upsert profile
    const { data: existingProf } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("id", user.id)
      .maybeSingle();

    if (!existingProf || !existingProf.full_name) {
      await supabase.from("profiles").upsert({
        id: user.id,
        full_name: rawFullName,
        email: user.email ?? null,
        notify_email: Boolean(user.email),
        notify_sms: false,
      });
    }

    // 2. Check / upsert team_directory
    const { data: existingDir } = await supabase
      .from("team_directory")
      .select("id, full_name")
      .eq("id", user.id)
      .maybeSingle();

    if (!existingDir || !existingDir.full_name) {
      await supabase.from("team_directory").upsert({
        id: user.id,
        full_name: rawFullName,
        updated_at: new Date().toISOString(),
      });
    }

    // 3. Check / insert default roles if none exist
    const { data: existingRoles } = await supabase
      .from("user_roles")
      .select("id, role")
      .eq("user_id", user.id);

    if (!existingRoles || existingRoles.length === 0) {
      const assignedRole: AppRole = (roleHint as AppRole) || "admin";
      await supabase
        .from("user_roles")
        .upsert(
          [
            { user_id: user.id, role: assignedRole },
            ...(assignedRole === "admin" ? [{ user_id: user.id, role: "manager" as AppRole }] : []),
          ],
          { onConflict: "user_id,role" },
        );
    }
  } catch (err) {
    console.warn("Non-fatal: ensureUserSynced error:", err);
  }
}

/**
 * Returns complete combined team members for dropdowns and assignees.
 */
export function buildCombinedTeamMembers(
  dbMembers: TeamMember[],
  currentUser: User | null,
): TeamMember[] {
  const map = new Map<string, TeamMember>();

  // 1. Add current user if authenticated
  if (currentUser) {
    const currentName =
      (currentUser.user_metadata?.full_name as string) ||
      (currentUser.user_metadata?.name as string) ||
      formatNameFromEmail(currentUser.email);
    map.set(currentUser.id, {
      id: currentUser.id,
      full_name: currentName,
      email: currentUser.email ?? null,
    });
  }

  // 2. Add DB members
  for (const m of dbMembers) {
    if (m && m.id && m.full_name) {
      map.set(m.id, {
        id: m.id,
        full_name: m.full_name,
        email: m.email ?? null,
      });
    }
  }

  // 3. Add custom local crew members
  const localCustom = getCustomLocalCrew();
  for (const c of localCustom) {
    if (!map.has(c.id)) {
      map.set(c.id, {
        id: c.id,
        full_name: c.full_name,
        email: c.email,
      });
    }
  }

  // 4. Add default plant crew members
  for (const crew of DEFAULT_PLANT_CREW) {
    if (!map.has(crew.id)) {
      map.set(crew.id, {
        id: crew.id,
        full_name: crew.full_name,
        email: crew.email,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) =>
    (a.full_name ?? "").localeCompare(b.full_name ?? ""),
  );
}

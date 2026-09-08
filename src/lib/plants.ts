/**
 * Company workspace: the organization name plus the plants (facilities) it runs.
 * Each plant owns a set of buildings/areas, so any asset can be resolved to a plant
 * through its building. Stored locally per browser and broadcast via a window event.
 */

export interface Plant {
  id: string;
  name: string;
  /** Buildings / areas that belong to this plant. */
  buildings: string[];
  location?: string;
}

export interface CompanyWorkspace {
  companyName: string;
  plants: Plant[];
}

export const WORKSPACE_STORAGE_KEY = "cmms_company_workspace";
export const WORKSPACE_CHANGED_EVENT = "cmms:workspace-changed";

export const DEFAULT_WORKSPACE: CompanyWorkspace = {
  companyName: "City of Sioux City WWTP",
  plants: [
    {
      id: "wastewater",
      name: "Wastewater",
      location: "Sioux City, IA",
      buildings: [],
    },
  ],
};

export function slugifyPlant(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "") || `plant_${Date.now()}`
  );
}

function sanitize(raw: unknown): CompanyWorkspace | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Partial<CompanyWorkspace>;
  if (typeof obj.companyName !== "string" || !Array.isArray(obj.plants)) return null;
  const plants = obj.plants
    .filter((p): p is Plant => Boolean(p && typeof p.name === "string"))
    .map((p) => ({
      id: p.id || slugifyPlant(p.name),
      name: p.name,
      location: p.location,
      buildings: Array.isArray(p.buildings) ? p.buildings.filter((b) => typeof b === "string") : [],
    }));
  if (plants.length === 0) return null;
  return { companyName: obj.companyName || DEFAULT_WORKSPACE.companyName, plants };
}

export function getWorkspace(): CompanyWorkspace {
  if (typeof window === "undefined") return DEFAULT_WORKSPACE;
  try {
    const stored = localStorage.getItem(WORKSPACE_STORAGE_KEY);
    if (stored) {
      const parsed = sanitize(JSON.parse(stored));
      if (parsed) return parsed;
    }
  } catch {
    /* ignore malformed local data */
  }
  return DEFAULT_WORKSPACE;
}

export function saveWorkspace(ws: CompanyWorkspace): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(ws));
    window.dispatchEvent(new CustomEvent<CompanyWorkspace>(WORKSPACE_CHANGED_EVENT, { detail: ws }));
  } catch {
    /* storage unavailable */
  }
}

/** The plant a building belongs to; unmapped buildings fall back to the first plant. */
export function plantForBuilding(
  building: string | null | undefined,
  plants: Plant[],
): Plant | undefined {
  if (plants.length === 0) return undefined;
  const key = (building || "").trim().toLowerCase();
  if (key) {
    const match = plants.find((p) =>
      p.buildings.some((b) => b.trim().toLowerCase() === key),
    );
    if (match) return match;
  }
  return plants[0];
}

export function isBuildingInPlant(
  building: string | null | undefined,
  plant: Plant,
  plants: Plant[],
): boolean {
  return plantForBuilding(building, plants)?.id === plant.id;
}

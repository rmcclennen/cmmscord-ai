import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { isSiouxCityUser } from "./roles";

export interface CompanyInfo {
  id: string;
  name: string;
}

export const DEFAULT_COMPANY: CompanyInfo = {
  id: "sioux_city",
  name: "Sioux City Plant Operations",
};

export const GLOBAL_ALL_COMPANIES: CompanyInfo = {
  id: "all_companies",
  name: "All Companies & Plants (Global Admin)",
};

const LOCAL_STORAGE_COMPANY_KEY = "cmms_active_company";

/**
 * Returns the active company for the current session/user.
 */
export function getActiveCompany(user?: User | null): CompanyInfo {
  if (typeof window === "undefined") return DEFAULT_COMPANY;

  try {
    // 1. Check local storage override first
    const stored = localStorage.getItem(LOCAL_STORAGE_COMPANY_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && parsed.id && parsed.name) {
        return parsed as CompanyInfo;
      }
    }
  } catch (e) {
    console.warn("Could not read company from localStorage", e);
  }

  // 2. Check user metadata if logged in
  if (user) {
    const metaCompany =
      (user.user_metadata?.company as string) ||
      (user.user_metadata?.company_name as string) ||
      (user.user_metadata?.facility as string);

    if (metaCompany) {
      const slug = metaCompany.toLowerCase().replace(/[^a-z0-9]+/g, "_");
      return { id: slug, name: metaCompany };
    }

    if (isSiouxCityUser(user)) {
      return DEFAULT_COMPANY;
    }
  }

  return DEFAULT_COMPANY;
}

/**
 * Updates the active company in local storage and dispatches a change event.
 */
export function setActiveCompany(company: CompanyInfo): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_STORAGE_COMPANY_KEY, JSON.stringify(company));
    window.dispatchEvent(new CustomEvent("cmms:company-changed", { detail: company }));
  } catch (e) {
    console.warn("Could not save company to localStorage", e);
  }
}

/**
 * Extracts company tag from an entity's notes or metadata string.
 */
export function extractCompanyFromNotes(notes?: string | null): string | null {
  if (!notes) return null;
  const match = notes.match(/\[Company:\s*([^\]]+)\]/i);
  return match ? match[1].trim() : null;
}

/**
 * Formats notes string with a company tag.
 */
export function formatNotesWithCompany(
  notes: string | null | undefined,
  companyName: string,
): string {
  const cleanNotes = (notes || "").replace(/\[Company:\s*[^\]]+\]/gi, "").trim();
  const tag = `[Company: ${companyName}]`;
  return cleanNotes ? `${cleanNotes}\n${tag}` : tag;
}

/**
 * Determines if an asset, PM, or WO belongs to the target company.
 */
export function isEntityInCompany(
  entity: { notes?: string | null; company_name?: string | null; building?: string | null },
  activeCompany: CompanyInfo,
): boolean {
  if (activeCompany.id === "all_companies") return true;

  const entityCompany = extractCompanyFromNotes(entity.notes) || entity.company_name;

  // If entity has an explicit company tag, match it exactly
  if (entityCompany) {
    return entityCompany.toLowerCase().trim() === activeCompany.name.toLowerCase().trim();
  }

  // If entity has NO explicit company tag, default seed data belongs to Sioux City
  if (activeCompany.id === "sioux_city" || activeCompany.name.includes("Sioux City")) {
    return true;
  }

  // Otherwise, a newly registered company should NOT see default Sioux City assets
  return false;
}

/**
 * Filters a list of entities by the current active company.
 */
export function filterEntitiesByCompany<
  T extends { notes?: string | null; company_name?: string | null; building?: string | null },
>(entities: T[], activeCompany: CompanyInfo): T[] {
  if (activeCompany.id === "all_companies") return entities;
  return entities.filter((e) => isEntityInCompany(e, activeCompany));
}

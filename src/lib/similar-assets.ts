export type SimilarCandidate = {
  id: string;
  name: string;
  make?: string | null;
  model?: string | null;
};

/** Strip unit numbers so "Aeration Blower #3" and "Aeration Blower 1" match. */
export function baseEquipmentName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(no\.?|number|unit|#)\s*/g, " ")
    .replace(/\b[a-z]?\d+[a-z]?\b/g, " ")
    .replace(/[^a-z ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const norm = (v?: string | null) => (v ?? "").trim().toLowerCase();

/** Assets that are the same equipment: same name ignoring unit numbers, or same make + model. */
export function findSimilarAssets<T extends SimilarCandidate>(current: SimilarCandidate, all: T[]): T[] {
  const base = baseEquipmentName(current.name);
  const mk = norm(current.make);
  const md = norm(current.model);
  return all.filter((x) => {
    if (x.id === current.id) return false;
    if (base.length >= 3 && baseEquipmentName(x.name) === base) return true;
    return !!mk && !!md && norm(x.make) === mk && norm(x.model) === md;
  });
}

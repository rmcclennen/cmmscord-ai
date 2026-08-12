export interface MatchableAsset {
  id: string;
  name: string;
  tag_number?: string | null;
  building?: string | null;
  class?: string | null;
  location_name?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  serial_number?: string | null;
}

export interface MatchablePm {
  id: string;
  title: string;
  tasks?: string | null;
  asset_id?: string | null;
  interval_days?: number | null;
  priority?: string | null;
  next_due?: string | null;
  assets?: MatchableAsset | null;
}

export interface PmAssetMatch {
  pmId: string;
  pmTitle: string;
  pmTasks?: string | null;
  currentAssetId?: string | null;
  currentAssetName?: string | null;
  suggestedAssetId: string;
  suggestedAssetName: string;
  suggestedAssetTag?: string | null;
  suggestedAssetBuilding?: string | null;
  confidence: "high" | "medium" | "low";
  score: number;
  reason: string;
}

function cleanStr(s?: string | null): string {
  return (s || "").toLowerCase().trim();
}

function extractTokens(s?: string | null): string[] {
  if (!s) return [];
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

/**
 * Evaluates how well a PM schedule matches a specific Asset.
 * Returns null if no relevant match is found.
 */
export function scorePmAgainstAsset(
  pm: MatchablePm,
  asset: MatchableAsset,
): { score: number; confidence: "high" | "medium" | "low"; reason: string } | null {
  const pmTitle = cleanStr(pm.title);
  const pmTasks = cleanStr(pm.tasks);
  const pmCombined = `${pmTitle} ${pmTasks}`;

  const assetName = cleanStr(asset.name);
  const assetTag = cleanStr(asset.tag_number);
  const assetModel = cleanStr(asset.model);
  const assetMake = cleanStr(asset.manufacturer);
  const assetBldg = cleanStr(asset.building);

  // 1. Exact Tag Match (Highest confidence)
  if (assetTag && assetTag.length >= 2) {
    const tagRegex = new RegExp(
      `(^|[^a-z0-9])${assetTag.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}([^a-z0-9]|$)`,
      "i",
    );
    if (tagRegex.test(pmTitle)) {
      return {
        score: 100,
        confidence: "high",
        reason: `PM title explicitly references Asset Tag [${asset.tag_number}]`,
      };
    }
    if (tagRegex.test(pmTasks)) {
      return {
        score: 95,
        confidence: "high",
        reason: `PM checklist instructions reference Asset Tag [${asset.tag_number}]`,
      };
    }
  }

  // 2. Full or Substring Asset Name Match
  if (assetName.length >= 3) {
    if (pmTitle.includes(assetName)) {
      return {
        score: 90,
        confidence: "high",
        reason: `Full asset name "${asset.name}" found in PM title`,
      };
    }
    if (pmTasks.includes(assetName)) {
      return {
        score: 85,
        confidence: "high",
        reason: `Asset name "${asset.name}" found in PM task description`,
      };
    }
  }

  // 3. Specific Model / Serial Number Match
  if (assetModel && assetModel.length >= 3) {
    if (pmCombined.includes(assetModel)) {
      return {
        score: 80,
        confidence: "high",
        reason: `Equipment model "${asset.model}" matched in PM details`,
      };
    }
  }

  // 4. Token Overlap between Asset Name and PM Title
  const assetTokens = extractTokens(asset.name);
  const matchedTokens: string[] = [];
  for (const token of assetTokens) {
    // Ignore overly generic terms
    if (["and", "the", "for", "with", "all", "per", "set"].includes(token)) continue;
    if (pmTitle.includes(token)) {
      matchedTokens.push(token);
    }
  }

  if (assetTokens.length > 0 && matchedTokens.length >= 2) {
    const overlapRatio = matchedTokens.length / assetTokens.length;
    if (overlapRatio >= 0.5 || matchedTokens.length >= 3) {
      return {
        score: Math.round(65 + overlapRatio * 20),
        confidence: overlapRatio >= 0.7 ? "high" : "medium",
        reason: `Matched key equipment terms: ${matchedTokens.map((t) => `"${t}"`).join(", ")}`,
      };
    }
  }

  if (matchedTokens.length === 1 && matchedTokens[0].length >= 4) {
    // Single distinctive token (e.g., "schwing", "trojan", "centrifuge", "clarifier", "digester", "aeration")
    const distinctiveWords = [
      "schwing",
      "trojan",
      "centrifuge",
      "clarifier",
      "digester",
      "aeration",
      "blower",
      "generator",
      "submersible",
      "skimmer",
      "grit",
      "barminutor",
      "chlorine",
      "uv",
    ];
    if (distinctiveWords.some((w) => matchedTokens[0].includes(w))) {
      return {
        score: 65,
        confidence: "medium",
        reason: `Matched specific system keyword: "${matchedTokens[0]}"`,
      };
    }
  }

  // 5. Manufacturer + Building Co-occurrence
  if (assetMake && assetMake.length >= 3 && pmCombined.includes(assetMake)) {
    if (assetBldg && assetBldg.length >= 3 && pmCombined.includes(assetBldg)) {
      return {
        score: 60,
        confidence: "medium",
        reason: `Matched manufacturer "${asset.manufacturer}" in building "${asset.building}"`,
      };
    }
    return {
      score: 50,
      confidence: "low",
      reason: `Matched manufacturer "${asset.manufacturer}"`,
    };
  }

  return null;
}

/**
 * Finds the single best asset match for a PM schedule from a list of assets.
 */
export function findBestAssetForPm(pm: MatchablePm, assets: MatchableAsset[]): PmAssetMatch | null {
  let bestMatch: PmAssetMatch | null = null;
  let highestScore = 0;

  for (const asset of assets) {
    // Skip if already the same asset
    if (pm.asset_id && pm.asset_id === asset.id) continue;

    const evaluation = scorePmAgainstAsset(pm, asset);
    if (evaluation && evaluation.score > highestScore) {
      highestScore = evaluation.score;
      bestMatch = {
        pmId: pm.id,
        pmTitle: pm.title,
        pmTasks: pm.tasks,
        currentAssetId: pm.asset_id,
        currentAssetName: pm.assets?.name,
        suggestedAssetId: asset.id,
        suggestedAssetName: asset.name,
        suggestedAssetTag: asset.tag_number,
        suggestedAssetBuilding: asset.building,
        confidence: evaluation.confidence,
        score: evaluation.score,
        reason: evaluation.reason,
      };
    }
  }

  return bestMatch;
}

/**
 * Scans all PM schedules and computes matches against all assets.
 */
export function batchMatchPmsToAssets(
  pms: MatchablePm[],
  assets: MatchableAsset[],
  options: { unlinkedOnly?: boolean; minConfidence?: "high" | "medium" | "low" } = {},
): PmAssetMatch[] {
  const { unlinkedOnly = true, minConfidence = "medium" } = options;
  const results: PmAssetMatch[] = [];

  for (const pm of pms) {
    if (unlinkedOnly && pm.asset_id) continue;

    const match = findBestAssetForPm(pm, assets);
    if (!match) continue;

    if (minConfidence === "high" && match.confidence !== "high") continue;
    if (minConfidence === "medium" && match.confidence !== "high" && match.confidence !== "medium")
      continue;

    results.push(match);
  }

  return results.sort((a, b) => b.score - a.score);
}

/**
 * Finds all candidate PM schedules for a specific Asset.
 */
export function findMatchingPmsForAsset(
  asset: MatchableAsset,
  pms: MatchablePm[],
): Array<{
  pm: MatchablePm;
  score: number;
  confidence: "high" | "medium" | "low";
  reason: string;
}> {
  const matches: Array<{
    pm: MatchablePm;
    score: number;
    confidence: "high" | "medium" | "low";
    reason: string;
  }> = [];

  for (const pm of pms) {
    // Only look at PMs not currently linked to this asset
    if (pm.asset_id === asset.id) continue;

    const evaluation = scorePmAgainstAsset(pm, asset);
    if (evaluation) {
      matches.push({
        pm,
        score: evaluation.score,
        confidence: evaluation.confidence,
        reason: evaluation.reason,
      });
    }
  }

  return matches.sort((a, b) => b.score - a.score);
}

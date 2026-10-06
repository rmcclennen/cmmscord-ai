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
  pmTasks?: string | null | undefined;
  currentAssetId?: string | null | undefined;
  currentAssetName?: string | null | undefined;
  suggestedAssetId: string;
  suggestedAssetName: string;
  suggestedAssetTag?: string | null | undefined;
  suggestedAssetBuilding?: string | null | undefined;
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

// ---- Precomputation caches -------------------------------------------------
// Matching is O(pms x assets). Without caching, every pair re-lowercases every
// field and recompiles a tag regex, which locks the main thread on large plants.

interface PreparedAsset {
  name: string;
  tag: string;
  model: string;
  make: string;
  bldg: string;
  tagRegex: RegExp | null;
  tokens: string[];
}

interface PreparedPm {
  title: string;
  tasks: string;
  combined: string;
}

interface AssetMatchIndex {
  assets: MatchableAsset[];
  byToken: Map<string, MatchableAsset[]>;
}

const assetCache = new WeakMap<MatchableAsset, PreparedAsset>();
const pmCache = new WeakMap<MatchablePm, PreparedPm>();

function addIndexToken(index: Map<string, MatchableAsset[]>, token: string, asset: MatchableAsset) {
  if (token.length < 2) return;
  const existing = index.get(token);
  if (existing) existing.push(asset);
  else index.set(token, [asset]);
}

function buildAssetMatchIndex(assets: MatchableAsset[]): AssetMatchIndex {
  const byToken = new Map<string, MatchableAsset[]>();
  for (const asset of assets) {
    const values = [asset.name, asset.tag_number, asset.model, asset.manufacturer, asset.building];
    const tokens = new Set<string>();
    for (const value of values) {
      const cleaned = cleanStr(value);
      if (!cleaned) continue;
      tokens.add(cleaned);
      for (const token of cleaned.split(/[^a-z0-9-]+/)) {
        if (token.length >= 2) tokens.add(token);
      }
    }
    for (const token of tokens) addIndexToken(byToken, token, asset);
  }
  return { assets, byToken };
}

function candidateAssetsForPm(pm: MatchablePm, index: AssetMatchIndex): MatchableAsset[] {
  const prepared = preparePm(pm);
  const pmTokens = new Set(
    prepared.combined.split(/[^a-z0-9-]+/).filter((token) => token.length >= 2),
  );
  const candidates = new Map<string, MatchableAsset>();
  const buckets = [...pmTokens]
    .map((token) => index.byToken.get(token))
    .filter((bucket): bucket is MatchableAsset[] => Boolean(bucket?.length))
    .sort((a, b) => a.length - b.length);

  // Common words such as "pump" or a manufacturer shared by hundreds of
  // assets are not useful candidates and recreate the all-to-all scan.
  for (const bucket of buckets) {
    if (bucket.length > 250) continue;
    for (const asset of bucket) candidates.set(asset.id, asset);
    if (candidates.size >= 250) break;
  }
  return [...candidates.values()];
}

function prepareAsset(asset: MatchableAsset): PreparedAsset {
  const cached = assetCache.get(asset);
  if (cached) return cached;
  const tag = cleanStr(asset.tag_number);
  const prepared: PreparedAsset = {
    name: cleanStr(asset.name),
    tag,
    model: cleanStr(asset.model),
    make: cleanStr(asset.manufacturer),
    bldg: cleanStr(asset.building),
    tagRegex:
      tag && tag.length >= 2
        ? new RegExp(
            `(^|[^a-z0-9])${tag.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}([^a-z0-9]|$)`,
            "i",
          )
        : null,
    tokens: extractTokens(asset.name),
  };
  assetCache.set(asset, prepared);
  return prepared;
}

function preparePm(pm: MatchablePm): PreparedPm {
  const cached = pmCache.get(pm);
  if (cached) return cached;
  const title = cleanStr(pm.title);
  const tasks = cleanStr(pm.tasks);
  const prepared: PreparedPm = { title, tasks, combined: `${title} ${tasks}` };
  pmCache.set(pm, prepared);
  return prepared;
}

/**
 * Evaluates how well a PM schedule matches a specific Asset.
 * Returns null if no relevant match is found.
 */
export function scorePmAgainstAsset(
  pm: MatchablePm,
  asset: MatchableAsset,
): { score: number; confidence: "high" | "medium" | "low"; reason: string } | null {
  const { title: pmTitle, tasks: pmTasks, combined: pmCombined } = preparePm(pm);
  const {
    name: assetName,
    tag: assetTag,
    model: assetModel,
    make: assetMake,
    bldg: assetBldg,
    tagRegex,
    tokens: preparedTokens,
  } = prepareAsset(asset);

  // 1. Exact Tag Match (Highest confidence)
  if (tagRegex) {
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
  const assetTokens = preparedTokens;
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

  if (matchedTokens.length === 1 && matchedTokens[0]!.length >= 4) {
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
    if (distinctiveWords.some((w) => matchedTokens[0]!.includes(w))) {
      return {
        score: 65,
        confidence: "medium",
        reason: `Matched specific system keyword: "${matchedTokens[0]!}"`,
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
 * Same as batchMatchPmsToAssets, but processes PMs in small chunks and yields to
 * the browser between chunks so the UI stays responsive on large data sets.
 */
export async function batchMatchPmsToAssetsAsync(
  pms: MatchablePm[],
  assets: MatchableAsset[],
  options: {
    unlinkedOnly?: boolean;
    minConfidence?: "high" | "medium" | "low";
    chunkSize?: number;
    onProgress?: (done: number, total: number) => void;
    shouldCancel?: () => boolean;
  } = {},
): Promise<PmAssetMatch[]> {
  const {
    unlinkedOnly = true,
    minConfidence = "medium",
    chunkSize = 25,
    onProgress,
    shouldCancel,
  } = options;

  const candidates = unlinkedOnly ? pms.filter((p) => !p.asset_id) : pms;
  const results: PmAssetMatch[] = [];
  const assetIndex = buildAssetMatchIndex(assets);
  let lastYield = performance.now();

  for (let i = 0; i < candidates.length; i += 1) {
    if (shouldCancel?.()) return [];

    const pm = candidates[i];
    if (!pm) continue;
    const indexedCandidates = candidateAssetsForPm(pm, assetIndex);
    const match = findBestAssetForPm(pm, indexedCandidates);
    if (match) {
      const passesConfidence =
        minConfidence === "low" ||
        match.confidence === "high" ||
        (minConfidence === "medium" && match.confidence === "medium");
      if (passesConfidence) results.push(match);
    }

    const shouldYield = i % chunkSize === chunkSize - 1 || performance.now() - lastYield >= 8;
    if (shouldYield) {
      onProgress?.(i + 1, candidates.length);
      await new Promise((resolve) => setTimeout(resolve, 0));
      lastYield = performance.now();
    }
  }

  onProgress?.(candidates.length, candidates.length);
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

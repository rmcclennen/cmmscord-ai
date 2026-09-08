/**
 * Manufacturer Links & Manual Search Intelligence
 * Generates direct manufacturer website links, model product pages,
 * and direct on-site company website searches based on make, manufacturer, and model number.
 */

export interface ManufacturerPortalInfo {
  name: string;
  website: string;
  domain: string;
  directDocsUrl: string;
  companySearchUrl: string;
  modelUrl: string;
  manualsSearchUrl: string;
  partsDiagramUrl: string;
  googleManualPdfUrl: string;
  directPortalName: string;
  hasDirectPortal: boolean;
  getCompanySearchUrl: (query: string) => string;
}

interface ManufacturerRule {
  match: (mfg: string) => boolean;
  name: string;
  domain: string;
  website: string;
  directDocsUrl: string;
  portalName: string;
  searchWebsiteUrl: (query: string) => string;
}

const MANUFACTURER_RULES: ManufacturerRule[] = [
  {
    match: (m) => m.includes("vaughan") || m.includes("chopper"),
    name: "Vaughan Company",
    domain: "chopperpumps.com",
    website: "https://www.chopperpumps.com/",
    directDocsUrl: "https://www.chopperpumps.com/resources/literature/",
    portalName: "Vaughan Chopper Technical Library",
    searchWebsiteUrl: (q) => `https://www.chopperpumps.com/?s=${encodeURIComponent(q)}`,
  },
  {
    match: (m) => m.includes("flygt") || m.includes("xylem"),
    name: "Flygt (Xylem)",
    domain: "xylem.com",
    website: "https://www.xylem.com/",
    directDocsUrl: "https://www.xylem.com/en-us/support/documentation/",
    portalName: "Xylem / Flygt Documentation Portal",
    searchWebsiteUrl: (q) => `https://www.xylem.com/en-us/search/?q=${encodeURIComponent(q)}`,
  },
  {
    match: (m) => m.includes("goulds") || m.includes("itt"),
    name: "Goulds Pumps (ITT)",
    domain: "gouldspumps.com",
    website: "https://www.gouldspumps.com/",
    directDocsUrl: "https://www.gouldspumps.com/en-US/Literature/",
    portalName: "ITT Goulds Pumps Literature Portal",
    searchWebsiteUrl: (q) =>
      `https://www.gouldspumps.com/en-US/Search/?query=${encodeURIComponent(q)}`,
  },
  {
    match: (m) => m.includes("hayward") || m.includes("gordon"),
    name: "Hayward Gordon",
    domain: "haywardgordon.com",
    website: "https://haywardgordon.com/",
    directDocsUrl: "https://haywardgordon.com/resources/",
    portalName: "Hayward Gordon Product Portal",
    searchWebsiteUrl: (q) => `https://haywardgordon.com/?s=${encodeURIComponent(q)}`,
  },
  {
    match: (m) => m.includes("moyno") || m.includes("nov"),
    name: "Moyno (NOV)",
    domain: "nov.com",
    website: "https://www.nov.com/products-and-services/brands/moyno",
    directDocsUrl: "https://www.nov.com/products-and-services/brands/moyno",
    portalName: "Moyno Progressive Cavity Library",
    searchWebsiteUrl: (q) => `https://www.nov.com/search#q=${encodeURIComponent(q)}`,
  },
  {
    match: (m) => m.includes("sulzer") || m.includes("abs"),
    name: "Sulzer",
    domain: "sulzer.com",
    website: "https://www.sulzer.com/",
    directDocsUrl: "https://www.sulzer.com/en/shared/products-and-services",
    portalName: "Sulzer Global Documentation",
    searchWebsiteUrl: (q) => `https://www.sulzer.com/en/shared/search#q=${encodeURIComponent(q)}`,
  },
  {
    match: (m) => m.includes("baldor") || m.includes("reliance") || m.includes("abb"),
    name: "Baldor (ABB / Reliance)",
    domain: "baldor.com",
    website: "https://www.baldor.com/",
    directDocsUrl: "https://www.baldor.com/support/product-support/manuals",
    portalName: "Baldor / ABB Motors Portal",
    searchWebsiteUrl: (q) => `https://www.baldor.com/search#q=${encodeURIComponent(q)}`,
  },
  {
    match: (m) => m.includes("allen") || m.includes("bradley") || m.includes("rockwell"),
    name: "Allen-Bradley (Rockwell)",
    domain: "rockwellautomation.com",
    website: "https://www.rockwellautomation.com/",
    directDocsUrl:
      "https://www.rockwellautomation.com/en-us/support/documentation/literature-library.html",
    portalName: "Rockwell Literature & Manual Library",
    searchWebsiteUrl: (q) =>
      `https://www.rockwellautomation.com/en-us/search.html?q=${encodeURIComponent(q)}`,
  },
  {
    match: (m) => m.includes("gorman") || m.includes("rupp"),
    name: "Gorman-Rupp",
    domain: "grpumps.com",
    website: "https://www.grpumps.com/",
    directDocsUrl: "https://www.grpumps.com/parts-and-service",
    portalName: "Gorman-Rupp Pumps Library",
    searchWebsiteUrl: (q) => `https://www.grpumps.com/search?q=${encodeURIComponent(q)}`,
  },
  {
    match: (m) => m.includes("grundfos"),
    name: "Grundfos",
    domain: "grundfos.com",
    website: "https://www.grundfos.com/",
    directDocsUrl: "https://product-selection.grundfos.com/us",
    portalName: "Grundfos Product Center & Manuals",
    searchWebsiteUrl: (q) =>
      `https://product-selection.grundfos.com/us/search?q=${encodeURIComponent(q)}`,
  },
  {
    match: (m) => m.includes("kaeser"),
    name: "Kaeser Compressors",
    domain: "kaeser.com",
    website: "https://us.kaeser.com/",
    directDocsUrl: "https://us.kaeser.com/downloads/",
    portalName: "Kaeser Blower & Compressor Portal",
    searchWebsiteUrl: (q) => `https://us.kaeser.com/search/?query=${encodeURIComponent(q)}`,
  },
  {
    match: (m) => m.includes("flowserve") || m.includes("limitorque"),
    name: "Limitorque (Flowserve)",
    domain: "flowserve.com",
    website: "https://www.flowserve.com/",
    directDocsUrl: "https://www.flowserve.com/en/products/brands/limitorque/",
    portalName: "Flowserve / Limitorque Documentation",
    searchWebsiteUrl: (q) => `https://www.flowserve.com/en/search/?q=${encodeURIComponent(q)}`,
  },
  {
    match: (m) => m.includes("rotork"),
    name: "Rotork",
    domain: "rotork.com",
    website: "https://www.rotork.com/",
    directDocsUrl: "https://www.rotork.com/en/support-and-service/technical-support",
    portalName: "Rotork Actuation Documentation",
    searchWebsiteUrl: (q) => `https://www.rotork.com/en/search?q=${encodeURIComponent(q)}`,
  },
  {
    match: (m) => m.includes("dezurik"),
    name: "DeZURIK",
    domain: "dezurik.com",
    website: "https://www.dezurik.com/",
    directDocsUrl: "https://www.dezurik.com/technical-documentation/",
    portalName: "DeZURIK Valve Resources",
    searchWebsiteUrl: (q) => `https://www.dezurik.com/search/?q=${encodeURIComponent(q)}`,
  },
  {
    match: (m) => m.includes("val-matic") || m.includes("valmatic"),
    name: "Val-Matic",
    domain: "valmatic.com",
    website: "https://www.valmatic.com/",
    directDocsUrl: "https://www.valmatic.com/literature",
    portalName: "Val-Matic Technical Library",
    searchWebsiteUrl: (q) => `https://www.valmatic.com/search?q=${encodeURIComponent(q)}`,
  },
  {
    match: (m) => m.includes("bray"),
    name: "Bray Controls",
    domain: "bray.com",
    website: "https://www.bray.com/",
    directDocsUrl: "https://www.bray.com/resources/literature",
    portalName: "Bray Controls & Valves Portal",
    searchWebsiteUrl: (q) => `https://www.bray.com/search?query=${encodeURIComponent(q)}`,
  },
  {
    match: (m) => m.includes("endress") || m.includes("hauser"),
    name: "Endress+Hauser",
    domain: "endress.com",
    website: "https://www.endress.com/",
    directDocsUrl: "https://www.endress.com/en/downloads",
    portalName: "Endress+Hauser Download Center",
    searchWebsiteUrl: (q) => `https://www.endress.com/en/search?q=${encodeURIComponent(q)}`,
  },
  {
    match: (m) => m.includes("rosemount") || m.includes("emerson"),
    name: "Emerson (Rosemount)",
    domain: "emerson.com",
    website: "https://www.emerson.com/",
    directDocsUrl: "https://www.emerson.com/en-us/support",
    portalName: "Emerson Documentation & Support",
    searchWebsiteUrl: (q) => `https://www.emerson.com/en-us/search?q=${encodeURIComponent(q)}`,
  },
  {
    match: (m) => m.includes("hach"),
    name: "Hach",
    domain: "hach.com",
    website: "https://www.hach.com/",
    directDocsUrl: "https://www.hach.com/downloads",
    portalName: "Hach Instrument Downloads & Manuals",
    searchWebsiteUrl: (q) => `https://www.hach.com/search?q=${encodeURIComponent(q)}`,
  },
  {
    match: (m) => m.includes("ysi") || m.includes("wtw"),
    name: "YSI (Xylem)",
    domain: "ysi.com",
    website: "https://www.ysi.com/",
    directDocsUrl: "https://www.ysi.com/support/documents-and-downloads",
    portalName: "YSI Environmental Documentation",
    searchWebsiteUrl: (q) => `https://www.ysi.com/search?q=${encodeURIComponent(q)}`,
  },
  {
    match: (m) => m.includes("siemens"),
    name: "Siemens",
    domain: "siemens.com",
    website: "https://www.siemens.com/",
    directDocsUrl: "https://support.industry.siemens.com/cs/products?dtp=Manual",
    portalName: "Siemens Industry Online Support",
    searchWebsiteUrl: (q) =>
      `https://support.industry.siemens.com/cs/products?search=${encodeURIComponent(q)}`,
  },
  {
    match: (m) => m.includes("schneider") || m.includes("square d"),
    name: "Schneider Electric (Square D)",
    domain: "se.com",
    website: "https://www.se.com/",
    directDocsUrl: "https://www.se.com/us/en/download/",
    portalName: "Schneider Electric Technical Downloads",
    searchWebsiteUrl: (q) => `https://www.se.com/us/en/search/?q=${encodeURIComponent(q)}`,
  },
  {
    match: (m) => m.includes("eaton") || m.includes("cutler"),
    name: "Eaton",
    domain: "eaton.com",
    website: "https://www.eaton.com/",
    directDocsUrl: "https://www.eaton.com/us/en-us/support.html",
    portalName: "Eaton Documentation Center",
    searchWebsiteUrl: (q) =>
      `https://www.eaton.com/us/en-us/site-search.html?q=${encodeURIComponent(q)}`,
  },
  {
    match: (m) => m.includes("us motors") || m.includes("nidec"),
    name: "U.S. MOTORS (Nidec)",
    domain: "usmotors.com",
    website: "https://www.usmotors.com/",
    directDocsUrl: "https://www.usmotors.com/Technical-Support/Product-Manuals",
    portalName: "Nidec / U.S. MOTORS Portal",
    searchWebsiteUrl: (q) => `https://www.usmotors.com/search?query=${encodeURIComponent(q)}`,
  },
  {
    match: (m) => m.includes("marathon"),
    name: "Marathon Motors",
    domain: "regalrexnord.com",
    website: "https://www.regalrexnord.com/brands/marathon-motors",
    directDocsUrl: "https://www.regalrexnord.com/document-library",
    portalName: "Marathon Motors / Regal Rexnord",
    searchWebsiteUrl: (q) => `https://www.regalrexnord.com/search#q=${encodeURIComponent(q)}`,
  },
  {
    match: (m) => m.includes("leeson"),
    name: "Leeson Motors",
    domain: "regalrexnord.com",
    website: "https://www.regalrexnord.com/brands/leeson",
    directDocsUrl: "https://www.regalrexnord.com/document-library",
    portalName: "Leeson Electric Motor Library",
    searchWebsiteUrl: (q) => `https://www.regalrexnord.com/search#q=${encodeURIComponent(q)}`,
  },
  {
    match: (m) => m.includes("weg"),
    name: "WEG",
    domain: "weg.net",
    website: "https://www.weg.net/",
    directDocsUrl: "https://www.weg.net/institutional/US/en/downloads",
    portalName: "WEG Technical Downloads",
    searchWebsiteUrl: (q) =>
      `https://www.weg.net/institutional/US/en/search?q=${encodeURIComponent(q)}`,
  },
  {
    match: (m) => m.includes("wilo"),
    name: "Wilo",
    domain: "wilo.com",
    website: "https://wilo.com/us/en/",
    directDocsUrl: "https://wilo.com/us/en/Downloads/",
    portalName: "Wilo Pump Documentation",
    searchWebsiteUrl: (q) => `https://wilo.com/us/en/search/?q=${encodeURIComponent(q)}`,
  },
  {
    match: (m) => m.includes("spx") || m.includes("waukesha") || m.includes("lightnin"),
    name: "SPX FLOW (Waukesha / Lightnin)",
    domain: "spxflow.com",
    website: "https://www.spxflow.com/",
    directDocsUrl: "https://www.spxflow.com/literature/",
    portalName: "SPX FLOW Technical Literature",
    searchWebsiteUrl: (q) => `https://www.spxflow.com/search?q=${encodeURIComponent(q)}`,
  },
  {
    match: (m) => m.includes("peerless"),
    name: "Peerless Pump",
    domain: "peerlesspump.com",
    website: "https://www.peerlesspump.com/",
    directDocsUrl: "https://www.peerlesspump.com/literature/",
    portalName: "Peerless Technical Literature",
    searchWebsiteUrl: (q) => `https://www.peerlesspump.com/?s=${encodeURIComponent(q)}`,
  },
  {
    match: (m) => m.includes("fairbanks") || m.includes("morse"),
    name: "Fairbanks Morse",
    domain: "fairbanksmorsepump.com",
    website: "https://www.fairbanksmorsepump.com/",
    directDocsUrl: "https://www.fairbanksmorsepump.com/literature/",
    portalName: "Fairbanks Morse Pump Library",
    searchWebsiteUrl: (q) => `https://www.fairbanksmorsepump.com/?s=${encodeURIComponent(q)}`,
  },
  {
    match: (m) => m.includes("ksb"),
    name: "KSB Pumps & Valves",
    domain: "ksb.com",
    website: "https://www.ksb.com/",
    directDocsUrl: "https://www.ksb.com/en-us/service/documentation",
    portalName: "KSB Documentation Center",
    searchWebsiteUrl: (q) => `https://www.ksb.com/en-us/search?q=${encodeURIComponent(q)}`,
  },
  {
    match: (m) => m.includes("gardner") || m.includes("denver") || m.includes("sutorbilt"),
    name: "Gardner Denver (Sutorbilt)",
    domain: "gardnerdenver.com",
    website: "https://www.gardnerdenver.com/",
    directDocsUrl: "https://www.gardnerdenver.com/en-us/blowers",
    portalName: "Gardner Denver Blower Portal",
    searchWebsiteUrl: (q) =>
      `https://www.gardnerdenver.com/en-us/search?q=${encodeURIComponent(q)}`,
  },
  {
    match: (m) => m.includes("roots") || m.includes("howden"),
    name: "Roots Blowers (Howden)",
    domain: "howden.com",
    website: "https://www.howden.com/",
    directDocsUrl: "https://www.howden.com/en-us/products/blowers-and-compressors",
    portalName: "Roots Blower Documentation",
    searchWebsiteUrl: (q) => `https://www.howden.com/en-us/search?q=${encodeURIComponent(q)}`,
  },
  {
    match: (m) => m.includes("hydro gate") || m.includes("hydrogate"),
    name: "Hydro Gate",
    domain: "hydrogate.com",
    website: "https://hydrogate.com/",
    directDocsUrl: "https://hydrogate.com/resources/",
    portalName: "Hydro Gate Technical Resources",
    searchWebsiteUrl: (q) => `https://hydrogate.com/?s=${encodeURIComponent(q)}`,
  },
  {
    match: (m) => m.includes("ashcroft"),
    name: "Ashcroft",
    domain: "ashcroft.com",
    website: "https://www.ashcroft.com/",
    directDocsUrl: "https://www.ashcroft.com/literature/",
    portalName: "Ashcroft Literature Center",
    searchWebsiteUrl: (q) => `https://www.ashcroft.com/?s=${encodeURIComponent(q)}`,
  },
  {
    match: (m) => m.includes("trojan") || m.includes("uv"),
    name: "TrojanUV",
    domain: "trojanuv.com",
    website: "https://www.trojanuv.com/",
    directDocsUrl: "https://www.trojanuv.com/resources",
    portalName: "TrojanUV Technical Documentation",
    searchWebsiteUrl: (q) => `https://www.trojanuv.com/search?q=${encodeURIComponent(q)}`,
  },
  {
    match: (m) => m.includes("huber"),
    name: "Huber Technology",
    domain: "huber-technology.com",
    website: "https://www.huber-technology.com/",
    directDocsUrl: "https://www.huber-technology.com/products/",
    portalName: "Huber Screens & Sludge Portal",
    searchWebsiteUrl: (q) => `https://www.huber-technology.com/search/?q=${encodeURIComponent(q)}`,
  },
  {
    match: (m) => m.includes("pentair") || m.includes("fairbanks nijhuis"),
    name: "Pentair",
    domain: "pentair.com",
    website: "https://www.pentair.com/",
    directDocsUrl: "https://www.pentair.com/en-us/products/commercial-water-treatment.html",
    portalName: "Pentair Equipment Portal",
    searchWebsiteUrl: (q) => `https://www.pentair.com/en-us/search.html?q=${encodeURIComponent(q)}`,
  },
  {
    match: (m) => m.includes("bell") && m.includes("gossett"),
    name: "Bell & Gossett (Xylem)",
    domain: "bellgossett.com",
    website: "https://bellgossett.com/",
    directDocsUrl: "https://bellgossett.com/literature/",
    portalName: "Bell & Gossett Technical Portal",
    searchWebsiteUrl: (q) => `https://bellgossett.com/?s=${encodeURIComponent(q)}`,
  },
  {
    match: (m) => m.includes("cummins"),
    name: "Cummins",
    domain: "cummins.com",
    website: "https://www.cummins.com/",
    directDocsUrl: "https://www.cummins.com/generators",
    portalName: "Cummins Power Generation Portal",
    searchWebsiteUrl: (q) => `https://www.cummins.com/search?keys=${encodeURIComponent(q)}`,
  },
  {
    match: (m) => m.includes("caterpillar") || m.includes("cat"),
    name: "Caterpillar (CAT)",
    domain: "cat.com",
    website: "https://www.cat.com/",
    directDocsUrl: "https://www.cat.com/en_US/support.html",
    portalName: "Caterpillar Equipment & Power Portal",
    searchWebsiteUrl: (q) =>
      `https://www.cat.com/en_US/search/search-results.html?q=${encodeURIComponent(q)}`,
  },
  {
    match: (m) => m.includes("kohler"),
    name: "Kohler Power Systems",
    domain: "kohlerpower.com",
    website: "https://kohlerpower.com/",
    directDocsUrl: "https://kohlerpower.com/en/industrial-generators",
    portalName: "Kohler Power Systems Portal",
    searchWebsiteUrl: (q) => `https://kohlerpower.com/en/search#q=${encodeURIComponent(q)}`,
  },
  {
    match: (m) => m.includes("generac"),
    name: "Generac",
    domain: "generac.com",
    website: "https://www.generac.com/",
    directDocsUrl: "https://www.generac.com/industrial",
    portalName: "Generac Industrial Portal",
    searchWebsiteUrl: (q) => `https://www.generac.com/search?q=${encodeURIComponent(q)}`,
  },
];

/**
 * Gets manufacturer portal URLs and direct on-site company website searches based on manufacturer name and model.
 */
export function getManufacturerPortalInfo(
  manufacturerInput: string | null | undefined,
  modelInput: string | null | undefined,
  knownUrl?: string | null,
  assetName?: string | null | undefined,
): ManufacturerPortalInfo {
  let mfgClean = (manufacturerInput || "").trim();
  const modelClean = (modelInput || "").trim();

  // If manufacturer is empty, try to detect brand from asset name
  if (!mfgClean && assetName) {
    const nameLower = assetName.toLowerCase();
    for (const rule of MANUFACTURER_RULES) {
      if (rule.match(nameLower)) {
        mfgClean = rule.name;
        break;
      }
    }
  }

  const mfgLower = mfgClean.toLowerCase();

  // Check matching custom rule
  const matchedRule = MANUFACTURER_RULES.find((r) => r.match(mfgLower));

  if (matchedRule) {
    const domain = matchedRule.domain;
    const modelTerm = modelClean || "";

    // Direct search on the company's real website (NOT a google search!)
    const companySearchUrl = modelClean
      ? matchedRule.searchWebsiteUrl(modelClean)
      : matchedRule.searchWebsiteUrl("manuals");

    const getCompanySearchUrl = (q: string) =>
      matchedRule.searchWebsiteUrl(q || modelClean || "manuals");

    const manualsSearchUrl = modelClean
      ? matchedRule.searchWebsiteUrl(`${modelClean} manual`)
      : matchedRule.directDocsUrl;

    const partsDiagramUrl = modelClean
      ? matchedRule.searchWebsiteUrl(`${modelClean} parts`)
      : matchedRule.searchWebsiteUrl("parts diagram");

    // Clean Google manual search as a secondary fallback
    const googleManualPdfUrl = `https://www.google.com/search?q=${encodeURIComponent(
      `${matchedRule.name} ${modelClean} O&M manual pdf`.trim(),
    )}`;

    return {
      name: matchedRule.name,
      website: matchedRule.website,
      domain,
      directDocsUrl: matchedRule.directDocsUrl,
      companySearchUrl,
      modelUrl: companySearchUrl,
      manualsSearchUrl,
      partsDiagramUrl,
      googleManualPdfUrl,
      directPortalName: matchedRule.portalName,
      hasDirectPortal: true,
      getCompanySearchUrl,
    };
  }

  // Fallback for custom or unmapped manufacturer
  let baseWebsite = knownUrl && knownUrl.startsWith("http") ? knownUrl : "";
  let domain = "";

  if (baseWebsite) {
    try {
      const urlObj = new URL(baseWebsite);
      domain = urlObj.hostname.replace(/^www\./, "");
    } catch {
      // keep domain empty
    }
  }

  if (!baseWebsite) {
    // If we have a manufacturer name like "Acme Pumps", build a probable website or clean link
    const cleanSlug = mfgClean.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (cleanSlug) {
      domain = `${cleanSlug}.com`;
      baseWebsite = `https://www.${domain}/`;
    } else {
      baseWebsite = "https://www.google.com/";
    }
  }

  const genericSearch = (q: string) => {
    const queryTerm = q.trim() || modelClean || mfgClean;
    if (domain && domain !== "google.com") {
      // Direct on-site search convention on the company's domain
      return `https://www.${domain}/search?q=${encodeURIComponent(queryTerm)}`;
    }
    return `https://www.google.com/search?q=${encodeURIComponent(
      `${mfgClean} ${queryTerm} official website manual`.trim(),
    )}`;
  };

  const companySearchUrl = genericSearch(modelClean || "manuals");
  const manualsSearchUrl = genericSearch(modelClean ? `${modelClean} manual` : "manuals");
  const partsDiagramUrl = genericSearch(modelClean ? `${modelClean} parts` : "parts");
  const googleManualPdfUrl = `https://www.google.com/search?q=${encodeURIComponent(
    `${mfgClean || "equipment"} ${modelClean} manual pdf`.trim(),
  )}`;

  return {
    name: mfgClean || "OEM Manufacturer",
    website: baseWebsite,
    domain: domain || "oem",
    directDocsUrl: baseWebsite,
    companySearchUrl,
    modelUrl: companySearchUrl,
    manualsSearchUrl,
    partsDiagramUrl,
    googleManualPdfUrl,
    directPortalName: mfgClean ? `${mfgClean} Resources` : "OEM Manufacturer Search",
    hasDirectPortal: Boolean(domain && domain !== "google.com"),
    getCompanySearchUrl: genericSearch,
  };
}

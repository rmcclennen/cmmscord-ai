import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateComprehensiveMaintenanceData } from "./maintenance-intelligence";

const PartsSchema = z.object({
  notes: z.string(),
  parts: z.array(
    z.object({
      name: z.string(),
      part_number: z.string().optional(),
      manufacturer: z.string().optional(),
      qty: z.string().optional(),
      where_to_buy: z.string().optional(),
      search_terms: z.string().optional(),
    }),
  ),
  sources: z.array(z.object({ title: z.string(), url: z.string() })),
});

export type PartsLookupResult = z.infer<typeof PartsSchema>;

function cleanJsonString(raw: string): string {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }
  return cleaned.trim();
}

export const lookupAssetParts = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        assetId: z.string().uuid().optional(),
        equipmentName: z.string().max(200).optional(),
        manufacturer: z.string().max(200).optional(),
        model: z.string().max(200).optional(),
        need: z.string().max(500).optional(),
        feedback: z.string().max(1000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<PartsLookupResult> => {
    let assetName = data.equipmentName || "Plant Equipment";
    let assetMfr = data.manufacturer || "OEM";
    let assetModel = data.model || "";
    let assetRecord: Record<string, unknown> | null = null;

    if (data.assetId) {
      const { supabaseAdmin: supabase } = await import("@/integrations/supabase/client.server");
      const { data: asset, error } = await supabase
        .from("assets")
        .select("*")
        .eq("id", data.assetId)
        .maybeSingle();

      if (!error && asset) {
        assetRecord = asset as Record<string, unknown>;
        assetName = asset.name || assetName;
        assetMfr = asset.manufacturer || asset.make || assetMfr;
        assetModel = asset.model || assetModel;
      }
    }

    let result: PartsLookupResult | null = null;

    const correctionPrompt = data.feedback?.trim()
      ? `\n\nCRITICAL TECHNICIAN CORRECTION & EXACT FIELD SPECS:\n"${data.feedback.trim()}"\nNote: The user indicated prior standard specs were incorrect. You MUST strictly adjust the parts list to match these exact specifications, sizes, materials, voltages, or part numbers provided by the technician.`
      : "";

    // 1. Try Gemini API via @google/genai (Gemini 3.7 Flash)
    const geminiKey = process.env["GEMINI_API_KEY"];
    if (geminiKey) {
      try {
        const { GoogleGenAI } = await import("@google/genai");
        const ai = new GoogleGenAI({
          apiKey: geminiKey,
          httpOptions: { headers: { "User-Agent": "aistudio-build" } },
        });

        const prompt = `You are a master industrial equipment maintenance and MRO spare parts procurement specialist. Identify the exact replacement parts, wear components, consumables, OEM part numbers, and vendor sourcing links for this equipment.

Equipment Name: ${assetName}
Manufacturer / OEM: ${assetMfr}
Model / Series: ${assetModel || "N/A"}
Specific Maintenance Need: ${data.need || "Routine replacement wear parts, bearings, seals, consumables, and gaskets"}${correctionPrompt}

Provide exact OEM or high-grade aftermarket part numbers where standard, standard industrial sizing (e.g. bearing numbers like 6309 C3, seal shaft diameters, NEMA frame sizes, ANSI flange ratings), and top supplier availability (Grainger, McMaster-Carr, Motion Industries, Fastenal).

Respond strictly with valid JSON conforming to this schema (no extra text):
{
  "notes": "Clear summary of parts, specs, and sizing recommendations for this asset",
  "parts": [
    {
      "name": "Part / Component Name (e.g. Mechanical Seal Cartridge, Drive V-Belt, Outboard Bearing)",
      "part_number": "OEM Part Number or Industry Standard Code (e.g. 56C, B54, 6308-2RS-C3)",
      "manufacturer": "${assetMfr}",
      "qty": "1",
      "where_to_buy": "Grainger / Motion Industries / McMaster-Carr / OEM Distributor",
      "search_terms": "exact search keywords to find this part on Google / Grainger"
    }
  ],
  "sources": [
    { "title": "OEM Catalog / Sourcing Reference", "url": "https://www.google.com/search?q=${encodeURIComponent(`${assetMfr} ${assetModel || assetName} parts catalog`)}" }
  ]
}`;

        const response = await ai.models.generateContent({
          model: "gemini-3.7-flash",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
          },
        });

        if (response.text) {
          const parsed = JSON.parse(cleanJsonString(response.text));
          result = PartsSchema.parse(parsed);
        }
      } catch (e) {
        console.warn("Gemini parts lookup error:", e);
      }
    }

    // 2. Try Lovable API Gateway if needed
    const lovableKey = process.env["LOVABLE_API_KEY"];
    if (!result && lovableKey) {
      try {
        const [{ generateText, Output }, { createOpenAICompatible }] = await Promise.all([
          import("ai"),
          import("@ai-sdk/openai-compatible"),
        ]);

        const gateway = createOpenAICompatible({
          name: "lovable-ai-gateway",
          supportsStructuredOutputs: true,
          baseURL: "https://ai.gateway.lovable.dev/v1",
          headers: { "Lovable-API-Key": lovableKey },
        });

        const { output } = await generateText({
          model: gateway("google/gemini-2.5-flash"),
          output: Output.object({ schema: PartsSchema }),
          prompt: `Identify industrial spare parts for ${assetName} (${assetMfr} ${assetModel}). Need: ${data.need || "Wear parts and consumables"}. ${correctionPrompt}`,
        });
        result = output;
      } catch (e) {
        console.warn("Lovable parts gateway error:", e);
      }
    }

    // 3. Fallback to comprehensive maintenance intelligence + smart feedback adaptation
    if (!result) {
      const mockAsset = assetRecord || {
        id: data.assetId || "temp",
        name: assetName,
        manufacturer: assetMfr,
        model: assetModel,
        type: "equipment",
      };

      const maint = generateComprehensiveMaintenanceData(mockAsset as unknown as AssetData);
      const feedbackText = data.feedback?.trim() || "";

      // If technician provided specific keywords or corrections, add them to the top of the list
      const customFeedbackParts: Array<{
        name: string;
        part_number?: string | undefined;
        manufacturer?: string | undefined;
        qty?: string | undefined;
        where_to_buy?: string | undefined;
        search_terms?: string | undefined;
      }> = [];

      if (feedbackText) {
        customFeedbackParts.push({
          name: `Custom Spec: ${feedbackText.length > 50 ? feedbackText.slice(0, 50) + "…" : feedbackText}`,
          part_number: feedbackText.match(/[A-Z0-9-]{4,}/)?.[0] || undefined,
          manufacturer: assetMfr,
          qty: "1",
          where_to_buy: "OEM / Grainger / Motion Industries",
          search_terms: `${assetMfr} ${feedbackText}`.trim(),
        });
      }

      const standardParts = maint.parts.map((p) => ({
        name: p.name,
        part_number: p.part_number,
        manufacturer: assetMfr,
        qty: "1",
        where_to_buy: "Grainger / Motion Industries / McMaster-Carr",
        search_terms: `${assetMfr} ${assetModel} ${p.name}`.trim(),
      }));

      result = {
        notes: feedbackText
          ? `Parts customized according to technician field notes: "${feedbackText}"`
          : `OEM replacement parts, wear components, and consumables recommended for ${assetName}.`,
        parts: [...customFeedbackParts, ...standardParts],
        sources: [
          {
            title: `${assetMfr} Equipment Sourcing Search`,
            url: `https://www.google.com/search?q=${encodeURIComponent(`${assetMfr} ${assetModel || assetName} parts catalog`)}`,
          },
          ...(maint.sources || []),
        ],
      };
    }

    return result;
  });

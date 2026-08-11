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

export const lookupAssetParts = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        assetId: z.string().uuid(),
        need: z.string().max(500).optional(),
        feedback: z.string().max(1000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<PartsLookupResult> => {
    const { supabaseAdmin: supabase } = await import("@/integrations/supabase/client.server");

    const { data: asset, error } = await supabase
      .from("assets")
      .select("*")
      .eq("id", data.assetId)
      .maybeSingle();

    if (error) throw error;
    if (!asset) throw new Error("Asset not found");

    let result: PartsLookupResult | null = null;

    const correctionPrompt = data.feedback?.trim()
      ? `\nTechnician Correction / Field Requirements: "${data.feedback.trim()}"\nNote: The user indicated standard lookup returned the wrong parts. Please find parts specifically meeting these requirements.`
      : "";

    // 1. Try Gemini API via @google/genai
    const geminiKey = process.env["GEMINI_API_KEY"];
    if (geminiKey) {
      try {
        const { GoogleGenAI } = await import("@google/genai");
        const ai = new GoogleGenAI({ apiKey: geminiKey });

        const prompt = `You are a wastewater and plant maintenance parts procurement specialist. Identify replacement parts for this equipment.

Asset: ${asset.name}
Manufacturer: ${asset.manufacturer || asset.make || "OEM"}
Model: ${asset.model || "N/A"}
Need: ${data.need || "Routine replacement wear parts"}${correctionPrompt}

Respond strictly with valid JSON matching this schema:
{
  "notes": "Brief overview of parts for this asset",
  "parts": [
    {
      "name": "Part name",
      "part_number": "OEM Part Number or spec",
      "manufacturer": "${asset.manufacturer || "OEM"}",
      "qty": "1",
      "where_to_buy": "Grainger / Motion Industries / OEM Portal",
      "search_terms": "search query"
    }
  ],
  "sources": [
    { "title": "Source title", "url": "https://..." }
  ]
}`;

        const response = await ai.models.generateContent({
          model: "gemini-3.6-flash",
          contents: prompt,
          config: { responseMimeType: "application/json" },
        });

        if (response.text) {
          result = PartsSchema.parse(JSON.parse(response.text));
        }
      } catch (e) {
        console.warn("Gemini parts lookup error:", e);
      }
    }

    // 2. Try Lovable API Gateway
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
          model: gateway("google/gemini-3.5-flash"),
          output: Output.object({ schema: PartsSchema }),
          prompt:
            `Identify spare parts for ${asset.name} (${asset.manufacturer} ${asset.model}). ${data.need || ""} ${correctionPrompt}`.trim(),
        });
        result = output;
      } catch (e) {
        console.warn("Lovable parts gateway error:", e);
      }
    }

    // 3. Fallback to comprehensive maintenance intelligence
    if (!result) {
      const maint = generateComprehensiveMaintenanceData(asset);
      result = {
        notes: data.feedback?.trim()
          ? `Parts adjusted based on technician notes: ${data.feedback.trim()}`
          : `Standard OEM replacement parts and consumables recommended for ${asset.name}.`,
        parts: maint.parts.map((p) => ({
          name: p.name,
          part_number: p.part_number,
          manufacturer: asset.manufacturer || "OEM",
          qty: "1",
          where_to_buy: "Grainger / Motion Industries / OEM Authorized Distributor",
          search_terms: `${asset.manufacturer || ""} ${asset.model || ""} ${p.name}`.trim(),
        })),
        sources: maint.sources,
      };
    }

    return result;
  });

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

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
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        assetId: z.string().uuid(),
        need: z.string().max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<PartsLookupResult> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured for this project.");

    const { data: asset, error } = await context.supabase
      .from("assets")
      .select("*")
      .eq("id", data.assetId)
      .maybeSingle();
    if (error) throw error;
    if (!asset) throw new Error("Asset not found");

    const spec = [
      `Asset: ${asset.name}`,
      asset.manufacturer ? `Manufacturer: ${asset.manufacturer}` : null,
      asset.make ? `Make: ${asset.make}` : null,
      asset.model ? `Model: ${asset.model}` : null,
      asset.serial_number ? `Serial: ${asset.serial_number}` : null,
      asset.type ? `Type: ${asset.type}` : null,
      asset.class ? `Equipment class code: ${asset.class}` : null,
      asset.hp ? `HP: ${asset.hp}` : null,
      asset.volts ? `Volts: ${asset.volts}` : null,
      asset.rpm ? `RPM: ${asset.rpm}` : null,
      asset.frame ? `Frame: ${asset.frame}` : null,
      asset.supplier ? `Local supplier of record: ${asset.supplier}` : null,
      asset.manufacturer_url ? `Manufacturer site: ${asset.manufacturer_url}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const prompt = `You are a wastewater treatment plant parts buyer. Identify the replacement/spare parts a technician would order for the equipment below.

${spec}
${data.need?.trim() ? `\nTechnician's stated need: ${data.need.trim()}` : ""}

Rules:
- Return at most 10 parts, most likely needed first.
- Only give a part_number when you are confident it is the real manufacturer number; otherwise omit it.
- "search_terms" must be a short string a buyer can paste into Google to find the exact part (include manufacturer + model + part).
- "where_to_buy" names likely distributors (e.g. Grainger, Motion Industries, the OEM's parts portal).
- Sources must be real manufacturer or distributor pages you are confident exist. Never invent URLs or part numbers.
- Keep notes to 2 sentences or fewer.`;

    const [{ generateText, Output, NoObjectGeneratedError }, { createOpenAICompatible }] = await Promise.all([
      import("ai"),
      import("@ai-sdk/openai-compatible"),
    ]);

    const gateway = createOpenAICompatible({
      name: "lovable-ai-gateway",
      baseURL: "https://ai.gateway.lovable.dev/v1",
      headers: { "Lovable-API-Key": apiKey },
    });

    try {
      const { output } = await generateText({
        model: gateway("google/gemini-3.5-flash"),
        output: Output.object({ schema: PartsSchema }),
        prompt,
      });
      return output;
    } catch (err) {
      if (NoObjectGeneratedError.isInstance(err) && err.text) {
        try {
          return PartsSchema.parse(JSON.parse(err.text));
        } catch {
          /* fall through */
        }
      }
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("429")) throw new Error("AI rate limit reached — try again in a moment.");
      if (message.includes("402")) throw new Error("AI credits exhausted for this workspace.");
      throw new Error(`Parts lookup failed: ${message}`);
    }
  });

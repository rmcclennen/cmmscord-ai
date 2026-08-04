import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const ResearchSchema = z.object({
  summary: z.string(),
  intervals: z.array(
    z.object({
      task: z.string(),
      frequency: z.string(),
      notes: z.string().optional(),
    }),
  ),
  parts: z.array(
    z.object({
      name: z.string(),
      part_number: z.string().optional(),
      notes: z.string().optional(),
    }),
  ),
  sources: z.array(z.object({ title: z.string(), url: z.string() })),
});

export const researchAssetMaintenance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ assetId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
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
      asset.class ? `Equipment class code: ${asset.class}` : null,
      asset.type ? `Type: ${asset.type}` : null,
      asset.hp ? `HP: ${asset.hp}` : null,
      asset.volts ? `Volts: ${asset.volts}` : null,
      asset.rpm ? `RPM: ${asset.rpm}` : null,
      asset.commission_date ? `Commissioned: ${asset.commission_date}` : null,
      asset.manufacturer_url ? `Manufacturer site: ${asset.manufacturer_url}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const prompt = `You are a senior wastewater treatment plant maintenance planner. Using manufacturer O&M documentation knowledge for the equipment below, produce its recommended maintenance program.

${spec}

Rules:
- Base intervals on the manufacturer's published O&M recommendations for this make/model when known; otherwise give industry-standard intervals for this equipment class and say so in the notes.
- Keep the summary to 3 sentences or fewer.
- List at most 8 maintenance tasks with their frequency (e.g. "Every 2,000 run hours or quarterly").
- List at most 8 wear/spare parts, with manufacturer part numbers only when you are confident.
- For sources, give manufacturer product/support page URLs where the O&M manual can be found. Only include URLs you are confident exist. Never invent part numbers or URLs.`;

    const [{ generateText, Output, NoObjectGeneratedError }, { createOpenAICompatible }] = await Promise.all([
      import("ai"),
      import("@ai-sdk/openai-compatible"),
    ]);

    const gateway = createOpenAICompatible({
      name: "lovable-ai-gateway",
      supportsStructuredOutputs: true,
      baseURL: "https://ai.gateway.lovable.dev/v1",
      headers: { "Lovable-API-Key": apiKey },
    });

    let result: z.infer<typeof ResearchSchema>;
    try {
      const { output } = await generateText({
        model: gateway("google/gemini-3.5-flash"),
        output: Output.object({ schema: ResearchSchema }),
        prompt,
      });
      result = output;
    } catch (err) {
      let recovered: z.infer<typeof ResearchSchema> | null = null;
      if (NoObjectGeneratedError.isInstance(err) && err.text) {
        try {
          recovered = ResearchSchema.parse(JSON.parse(err.text));
        } catch {
          recovered = null;
        }
      }
      if (!recovered) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("429")) throw new Error("AI rate limit reached — try again in a moment.");
        if (message.includes("402")) throw new Error("AI credits exhausted for this workspace.");
        throw new Error(`Maintenance lookup failed: ${message}`);
      }
      result = recovered;
    }

    const { data: row, error: insertError } = await context.supabase
      .from("asset_maintenance_info")
      .insert({
        asset_id: data.assetId,
        summary: result.summary,
        intervals: result.intervals,
        parts: result.parts,
        sources: result.sources,
      })
      .select()
      .single();
    if (insertError) throw insertError;
    return row;
  });

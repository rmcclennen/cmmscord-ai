import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const NameplateSchema = z.object({
  name: z.string().describe("Short descriptive equipment name, e.g. 'Influent Pump #2 Motor'"),
  manufacturer: z.string().optional(),
  make: z.string().optional(),
  model: z.string().optional(),
  serial_number: z.string().optional(),
  type: z.string().optional(),
  hp: z.string().optional(),
  rpm: z.string().optional(),
  volts: z.string().optional(),
  phase: z.string().optional(),
  hertz: z.string().optional(),
  frame: z.string().optional(),
  enclosure: z.string().optional(),
  notes: z.string().optional(),
  confidence: z.enum(["high", "medium", "low"]),
});

export type NameplateReading = z.infer<typeof NameplateSchema>;

const InputSchema = z.object({
  images: z.array(z.string().min(20)).min(1).max(3),
  hint: z.string().max(300).optional(),
});

export const readNameplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured for this project.");

    const [{ generateText, Output, NoObjectGeneratedError }, { createOpenAICompatible }] =
      await Promise.all([import("ai"), import("@ai-sdk/openai-compatible")]);

    const gateway = createOpenAICompatible({
      name: "lovable-ai-gateway",
      supportsStructuredOutputs: true,
      baseURL: "https://ai.gateway.lovable.dev/v1",
      headers: { "Lovable-API-Key": apiKey },
    });

    const instructions = `You are a wastewater treatment plant maintenance planner reading equipment photos.

Read the equipment and its nameplate / data label in the attached photo(s) and extract asset register fields.

Rules:
- Transcribe values EXACTLY as printed on the label (model and serial especially). Never guess or invent characters.
- Omit any field you cannot read.
- "make"/"manufacturer" is the brand on the label (e.g. Baldor, Goulds, Flygt, ABB).
- Give a short practical asset name using the equipment type visible in the photo.
- Put anything else useful (frame data, duty, ratios, illegible fields) in notes.
- confidence: "high" only if the label text is clearly legible.${data.hint ? `\n\nOperator note about this equipment: ${data.hint}` : ""}`;

    try {
      const { output } = await generateText({
        model: gateway("google/gemini-3.5-flash"),
        output: Output.object({ schema: NameplateSchema }),
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: instructions },
              ...data.images.map((image) => ({ type: "image" as const, image })),
            ],
          },
        ],
      });
      return output;
    } catch (err) {
      if (NoObjectGeneratedError.isInstance(err) && err.text) {
        try {
          return NameplateSchema.parse(JSON.parse(err.text));
        } catch {
          /* fall through */
        }
      }
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("429"))
        throw new Error("AI rate limit reached — try again in a moment.");
      if (message.includes("402")) throw new Error("AI credits exhausted for this workspace.");
      throw new Error(`Could not read the nameplate: ${message}`);
    }
  });

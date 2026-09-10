import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const ScannedPartSchema = z.object({
  name: z.string(),
  part_number: z.string().optional(),
  manufacturer: z.string().optional(),
  qty: z.number().optional(),
  unit_cost: z.number().optional(),
  notes: z.string().optional(),
});

const ScannedComponentSchema = z.object({
  name: z.string(),
  make: z.string().optional(),
  model: z.string().optional(),
  serial_number: z.string().optional(),
  notes: z.string().optional(),
  parts: z.array(ScannedPartSchema).default([]),
});

const ScannedEquipmentSchema = z.object({
  name: z.string(),
  tag_number: z.string().optional(),
  make: z.string().optional(),
  model: z.string().optional(),
  serial_number: z.string().optional(),
  manufacturer: z.string().optional(),
  hp: z.string().optional(),
  volts: z.string().optional(),
  rpm: z.string().optional(),
  frame: z.string().optional(),
  criticality: z.enum(["low", "medium", "high"]).default("medium"),
  notes: z.string().optional(),
  components: z.array(ScannedComponentSchema).default([]),
  parts: z.array(ScannedPartSchema).default([]),
});

const ScanResultSchema = z.object({
  document_summary: z.string().default(""),
  equipment: z.array(ScannedEquipmentSchema).default([]),
});

export type ScannedPart = z.infer<typeof ScannedPartSchema>;
export type ScannedComponent = z.infer<typeof ScannedComponentSchema>;
export type ScannedEquipment = z.infer<typeof ScannedEquipmentSchema>;
export type DocumentScanResult = z.infer<typeof ScanResultSchema>;

const InputSchema = z.object({
  fileName: z.string().max(300).optional(),
  mediaType: z.string().max(100).optional(),
  /** Base64 (no data: prefix) of a PDF or image document */
  fileBase64: z.string().min(50).optional(),
  /** Public https link to a PDF or image manual, fetched server-side */
  fileUrl: z.string().url().max(2000).optional(),
  /** Plain text extracted from a spreadsheet, manual excerpt, or pasted list */
  text: z.string().max(200000).optional(),
  hint: z.string().max(500).optional(),
});

const INSTRUCTIONS = `You are a wastewater treatment plant maintenance planner building an asset register from an equipment document (O&M manual, parts list, cut sheet, or equipment spreadsheet).

Extract, as completely as the document allows:
1. equipment — each distinct machine or unit (pump, blower, motor, mixer, UV bank, valve actuator, panel). Include nameplate data when printed.
2. components — major sub-assemblies belonging to that machine (drive motor, gearbox, mechanical seal assembly, VFD, lamp module).
3. parts — replaceable/spare parts and consumables with OEM part numbers, quantities and costs when listed.

Rules:
- Transcribe model, serial and part numbers EXACTLY as printed. Never invent numbers.
- Omit fields you cannot read instead of guessing.
- Do NOT include shelf, bin or storage location codes in names.
- If the document covers one machine, return exactly one equipment entry with its components and parts.
- Keep names short and practical, e.g. "Grit Pump #1", "Mechanical Seal Assembly".`;

export const scanDocumentForAssets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }): Promise<DocumentScanResult> => {
    if (!data.fileBase64 && !data.fileUrl && !data.text?.trim()) {
      throw new Error("Nothing to scan — upload a document, paste a link, or paste some text.");
    }

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

    const header = `${INSTRUCTIONS}${data.fileName ? `\n\nDocument: ${data.fileName}` : ""}${
      data.hint ? `\n\nOperator note: ${data.hint}` : ""
    }`;

    let mediaType = data.mediaType || "application/pdf";
    let fileBase64 = data.fileBase64;

    if (!fileBase64 && data.fileUrl) {
      let res: Response;
      try {
        res = await fetch(data.fileUrl, { redirect: "follow" });
      } catch {
        throw new Error("Could not download that link — check the address and try again.");
      }
      if (!res.ok) {
        throw new Error(
          `That link could not be downloaded (${res.status}). Some sites block downloads — save the file and upload it instead.`,
        );
      }
      const contentType = res.headers.get("content-type") || "";
      if (/text\/html/i.test(contentType)) {
        throw new Error(
          "That link is a web page, not a manual file. Use the direct link to the PDF.",
        );
      }
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (bytes.byteLength === 0) throw new Error("That link returned an empty file.");
      if (bytes.byteLength > 18 * 1024 * 1024) {
        throw new Error(
          "That manual is larger than 18 MB. Upload just the parts list or nameplate pages instead.",
        );
      }
      mediaType = contentType.split(";")[0]?.trim() || "application/pdf";
      let binary = "";
      for (let i = 0; i < bytes.length; i += 8192) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      }
      fileBase64 = btoa(binary);
    }

    const content: Array<Record<string, unknown>> = [{ type: "text", text: header }];

    if (fileBase64) {
      if (mediaType.startsWith("image/")) {
        content.push({ type: "image", image: `data:${mediaType};base64,${data.fileBase64}` });
      } else {
        content.push({ type: "file", data: data.fileBase64, mediaType });
      }
    }
    if (data.text?.trim()) {
      content.push({
        type: "text",
        text: `Document contents:\n\n${data.text.trim().slice(0, 120000)}`,
      });
    }

    try {
      const { output } = await generateText({
        model: gateway("google/gemini-3.5-flash"),
        output: Output.object({ schema: ScanResultSchema }),
        messages: [
          {
            role: "user",
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            content: content as any,
          },
        ],
      });
      return output;
    } catch (err) {
      if (NoObjectGeneratedError.isInstance(err) && err.text) {
        try {
          return ScanResultSchema.parse(JSON.parse(err.text));
        } catch {
          /* fall through */
        }
      }
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("429"))
        throw new Error("AI rate limit reached — try again in a moment.");
      if (message.includes("402")) throw new Error("AI credits exhausted for this workspace.");
      throw new Error(`Could not read this document: ${message}`);
    }
  });

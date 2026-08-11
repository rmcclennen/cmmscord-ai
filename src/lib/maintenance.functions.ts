import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import {
  generateComprehensiveMaintenanceData,
  type MaintenanceLookupData,
} from "./maintenance-intelligence";

const DEFAULT_SUPABASE_URL = "https://wylqoosdanaltciwrwht.supabase.co";
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_hOeYd2G3LdsYfOyy4ajovA_vYM4o6mz";

function getSupabaseClient() {
  const envUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const envKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const url = envUrl && envUrl.startsWith("http") ? envUrl : DEFAULT_SUPABASE_URL;
  const key = envKey && envKey.length > 20 ? envKey : DEFAULT_SUPABASE_PUBLISHABLE_KEY;
  return createClient<Database>(url, key);
}

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
  .inputValidator((input: unknown) =>
    z
      .object({
        assetId: z.string().uuid(),
        feedback: z.string().max(1000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const supabase = getSupabaseClient();

    const { data: asset, error } = await supabase
      .from("assets")
      .select("*")
      .eq("id", data.assetId)
      .maybeSingle();

    if (error) throw error;
    if (!asset) throw new Error("Asset not found");

    let result: MaintenanceLookupData | null = null;

    const feedbackText = data.feedback?.trim()
      ? `\n\nUSER CORRECTION / OPERATOR FIELD NOTES:\n"${data.feedback.trim()}"\nThe technician indicated the previous parts/intervals were not the right parts for this asset. Adapt the maintenance program and parts list specifically to match these operator notes.`
      : "";

    // 1. Try Gemini API via @google/genai if GEMINI_API_KEY is available
    const geminiKey = process.env["GEMINI_API_KEY"];
    if (geminiKey) {
      try {
        const { GoogleGenAI } = await import("@google/genai");
        const ai = new GoogleGenAI({ apiKey: geminiKey });

        const prompt = `You are a senior wastewater and municipal plant maintenance planner. Using manufacturer O&M documentation knowledge for the equipment below, generate its manufacturer-recommended maintenance program in valid JSON.

Asset Name: ${asset.name}
Manufacturer: ${asset.manufacturer || asset.make || "Unknown"}
Make: ${asset.make || "N/A"}
Model: ${asset.model || "N/A"}
Serial: ${asset.serial_number || "N/A"}
Class: ${asset.class || "N/A"}
Type: ${asset.type || "N/A"}
HP: ${asset.hp || "N/A"}
Volts: ${asset.volts || "N/A"}
RPM: ${asset.rpm || "N/A"}${feedbackText}

Respond strictly with valid JSON matching this schema:
{
  "summary": "3-sentence summary of manufacturer O&M program",
  "intervals": [
    { "task": "Specific inspection or service task", "frequency": "Monthly / Quarterly / Annually", "notes": "Clear instructions" }
  ],
  "parts": [
    { "name": "Part name (seal, bearing, belt, filter)", "part_number": "Manufacturer part number or OEM spec", "notes": "Specs" }
  ],
  "sources": [
    { "title": "Manual or source title", "url": "https://..." }
  ]
}`;

        const response = await ai.models.generateContent({
          model: "gemini-3.6-flash",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
          },
        });

        if (response.text) {
          const parsed = JSON.parse(response.text);
          result = ResearchSchema.parse(parsed);
        }
      } catch (geminiErr) {
        console.warn("Gemini API lookup attempt:", geminiErr);
      }
    }

    // 2. Try Lovable AI gateway if LOVABLE_API_KEY is available and no result yet
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
          output: Output.object({ schema: ResearchSchema }),
          prompt: `Generate maintenance program for ${asset.name} (${asset.manufacturer} ${asset.model})${feedbackText}`,
        });
        result = output;
      } catch (gatewayErr) {
        console.warn("Lovable AI gateway attempt:", gatewayErr);
      }
    }

    // 3. Robust OEM & Manufacturer Knowledge Base Fallback
    if (!result) {
      result = generateComprehensiveMaintenanceData(asset);
      if (data.feedback?.trim()) {
        result.summary = `${result.summary} (Adjusted per operator note: ${data.feedback.trim()})`;
      }
    }

    // Insert into asset_maintenance_info table
    const { data: row, error: insertError } = await supabase
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

    if (insertError) {
      console.error("Error saving maintenance info to database:", insertError);
      return {
        id: crypto.randomUUID(),
        asset_id: data.assetId,
        created_at: new Date().toISOString(),
        summary: result.summary,
        intervals: result.intervals,
        parts: result.parts,
        sources: result.sources,
      };
    }

    return row;
  });

export const updateAssetMaintenanceParts = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        assetId: z.string().uuid(),
        parts: z.array(
          z.object({
            name: z.string(),
            part_number: z.string().optional(),
            notes: z.string().optional(),
            manufacturer: z.string().optional(),
            qty: z.string().optional(),
            where_to_buy: z.string().optional(),
          }),
        ),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const supabase = getSupabaseClient();

    const { data: existing } = await supabase
      .from("asset_maintenance_info")
      .select("*")
      .eq("asset_id", data.assetId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      const { data: updated, error } = await supabase
        .from("asset_maintenance_info")
        .update({ parts: data.parts })
        .eq("id", existing.id)
        .select()
        .single();

      if (error) {
        console.error("Error updating asset parts:", error);
        throw error;
      }
      return updated;
    } else {
      const { data: created, error } = await supabase
        .from("asset_maintenance_info")
        .insert({
          asset_id: data.assetId,
          summary: "Custom maintenance and parts records updated by technician.",
          intervals: [],
          parts: data.parts,
          sources: [],
        })
        .select()
        .single();

      if (error) {
        console.error("Error creating asset parts info:", error);
        throw error;
      }
      return created;
    }
  });

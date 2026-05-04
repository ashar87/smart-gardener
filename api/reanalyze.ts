import type { VercelRequest, VercelResponse } from "@vercel/node";

const GEMINI_URL = (key: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${key}`;

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    isPlant: { type: "BOOLEAN" },
    species: { type: "STRING" },
    commonName: { type: "STRING" },
    confidence: { type: "NUMBER" },
    location: { type: "STRING", enum: ["indoor", "outdoor"] },
    health: {
      type: "OBJECT",
      properties: {
        status: { type: "STRING", enum: ["healthy", "warning", "critical"] },
        assessment: { type: "STRING" },
        issues: { type: "ARRAY", items: { type: "STRING" } },
      },
      required: ["status", "assessment", "issues"],
    },
    careSuggestions: {
      type: "OBJECT",
      properties: {
        watering: {
          type: "OBJECT",
          properties: { frequency: { type: "STRING" } },
          required: ["frequency"],
        },
        sunlight: { type: "STRING" },
        fertilizer: {
          type: "OBJECT",
          properties: {
            instructions: { type: "STRING" },
            frequencyDays: { type: "INTEGER" },
            activeMonths: { type: "ARRAY", items: { type: "INTEGER" } },
          },
          required: ["instructions", "frequencyDays", "activeMonths"],
        },
        pruning: {
          type: "OBJECT",
          properties: {
            instructions: { type: "STRING" },
            frequencyDays: { type: "INTEGER" },
            activeMonths: { type: "ARRAY", items: { type: "INTEGER" } },
          },
          required: ["instructions", "frequencyDays", "activeMonths"],
        },
      },
      required: ["watering", "sunlight", "fertilizer", "pruning"],
    },
  },
  required: ["isPlant", "species", "commonName", "confidence", "location", "health", "careSuggestions"],
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { image, commonName, species } = req.body as { image?: string; commonName?: string; species?: string };
  if (!image || !commonName) return res.status(400).json({ error: "Missing image or commonName" });

  const mimeMatch = image.match(/^data:([^;]+);base64,/);
  const mimeType = mimeMatch?.[1] ?? "image/jpeg";
  const imageData = image.split(",")[1] || image;
  const key = process.env.GEMINI_API_KEY || "";

  try {
    const response = await fetch(GEMINI_URL(key), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [
          { inline_data: { mime_type: mimeType, data: imageData } },
          { text: `The user has confirmed this plant is "${commonName}" (${species || commonName}). Do NOT re-identify. Assess health and return care instructions for this confirmed species.` },
        ]}],
        generationConfig: { responseMimeType: "application/json", responseSchema: RESPONSE_SCHEMA },
        systemInstruction: { parts: [{ text: `You are an expert botanist. The species is confirmed as "${commonName}". Do not re-identify. Assess health and return care instructions for ${commonName}.` }] },
      }),
    });

    const data = await response.json() as any;
    if (!response.ok) throw new Error(data?.error?.message || `Gemini error ${response.status}`);
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("AI returned an empty response.");
    const result = JSON.parse(text);
    result.commonName = commonName;
    result.species = species || result.species;
    return res.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("reanalyze error:", msg);
    return res.status(500).json({ error: `Reanalysis failed: ${msg}` });
  }
}

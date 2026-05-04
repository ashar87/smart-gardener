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

const isTransient = (error: unknown) => {
  const msg = error instanceof Error ? error.message : String(error);
  return msg.includes("503") || msg.includes("429") || msg.includes("quota") || msg.includes("UNAVAILABLE");
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { image } = req.body as { image?: string };
  if (!image) return res.status(400).json({ error: "Missing image" });

  const mimeMatch = image.match(/^data:([^;]+);base64,/);
  const mimeType = mimeMatch?.[1] ?? "image/jpeg";
  const imageData = image.split(",")[1] || image;
  const key = process.env.GEMINI_API_KEY || "";
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(GEMINI_URL(key), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [
            { inline_data: { mime_type: mimeType, data: imageData } },
            { text: "Identify this plant, assess its health, and predict whether it is typically an indoor or outdoor plant. For fertilizer and pruning, provide instructions, frequency in days, and active months (1-12, Northern Hemisphere)." },
          ]}],
          generationConfig: { responseMimeType: "application/json", responseSchema: RESPONSE_SCHEMA },
          systemInstruction: { parts: [{ text: "You are an expert botanist. Always return valid JSON. If the image does not show a plant, set isPlant to false, species to 'Unknown', commonName to 'Unknown', confidence to 0, and health.status to 'healthy' with an empty issues array." }] },
        }),
      });

      const data = await response.json() as any;
      if (!response.ok) throw new Error(data?.error?.message || `Gemini error ${response.status}`);
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("AI returned an empty response.");
      return res.json(JSON.parse(text));
    } catch (error) {
      if (isTransient(error) && attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 1500 * attempt));
        continue;
      }
      const msg = error instanceof Error ? error.message : String(error);
      console.error("identify error:", msg);
      return res.status(isTransient(error) ? 503 : 500).json({
        error: isTransient(error) ? "AI service is busy. Please try again." : `Plant identification failed: ${msg}`,
      });
    }
  }

  return res.status(503).json({ error: "AI service is busy. Please try again." });
}

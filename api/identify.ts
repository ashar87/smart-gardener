import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAi, MODEL, RESPONSE_SCHEMA, isTransient } from "./_gemini";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { image } = req.body as { image?: string };
  if (!image) return res.status(400).json({ error: "Missing image" });

  const ai = getAi();
  const maxAttempts = 3;

  const mimeMatch = image.match(/^data:([^;]+);base64,/);
  const mimeType = (mimeMatch?.[1] as "image/jpeg" | "image/png" | "image/webp") ?? "image/jpeg";
  const imageData = image.split(",")[1] || image;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: [
          {
            role: "user",
            parts: [
              { inlineData: { data: imageData, mimeType } },
              {
                text: "Identify this plant, assess its health, and predict whether it is typically an indoor or outdoor plant. For fertilizer and pruning, provide instructions, frequency in days, and active months (1-12, Northern Hemisphere).",
              },
            ],
          },
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
          systemInstruction:
            "You are an expert botanist and computer vision plant identification engine. Always return valid JSON. If the image does not show a plant, set isPlant to false, species to 'Unknown', commonName to 'Unknown', confidence to 0, and health.status to 'healthy' with an empty issues array. Never fabricate plant data for non-plant images.",
        },
      });

      if (!response.text) throw new Error("AI returned an empty response.");
      return res.json(JSON.parse(response.text));
    } catch (error) {
      if (isTransient(error) && attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 1500 * attempt));
        continue;
      }
      const msg = error instanceof Error ? error.message : String(error);
      console.error("identify error:", msg);
      return res
        .status(isTransient(error) ? 503 : 500)
        .json({ error: isTransient(error) ? "AI service is busy. Please try again." : `Plant identification failed: ${msg}` });
    }
  }

  return res.status(503).json({ error: "AI service is busy. Please try again." });
}

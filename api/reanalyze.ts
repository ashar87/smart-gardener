import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAi, MODEL, RESPONSE_SCHEMA } from "./_gemini";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { image, commonName, species } = req.body as {
    image?: string;
    commonName?: string;
    species?: string;
  };
  if (!image || !commonName) return res.status(400).json({ error: "Missing image or commonName" });

  const ai = getAi();

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: {
        parts: [
          { inlineData: { data: image.split(",")[1] || image, mimeType: "image/jpeg" } },
          {
            text: `The user has confirmed this plant is "${commonName}" (${species || commonName}). Do NOT re-identify the species. Use the image only to assess health and return accurate care instructions for this confirmed species.`,
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
        systemInstruction: `You are an expert botanist. The species has been confirmed as "${commonName}" (${species || commonName}). Do NOT re-identify or override this. Assess the plant's health from the photo and return accurate care instructions for ${commonName}.`,
      },
    });

    if (!response.text) throw new Error("AI returned an empty response.");
    const result = JSON.parse(response.text);
    result.commonName = commonName;
    result.species = species || result.species;
    return res.json(result);
  } catch (error) {
    console.error("reanalyze error:", error);
    return res.status(500).json({ error: "Reanalysis failed." });
  }
}

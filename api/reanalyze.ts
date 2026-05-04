import type { VercelRequest, VercelResponse } from "@vercel/node";
import { callGemini, MODEL, RESPONSE_SCHEMA } from "../lib/gemini";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { image, commonName, species } = req.body as {
    image?: string;
    commonName?: string;
    species?: string;
  };
  if (!image || !commonName) return res.status(400).json({ error: "Missing image or commonName" });

  const mimeMatch = image.match(/^data:([^;]+);base64,/);
  const mimeType = mimeMatch?.[1] ?? "image/jpeg";
  const imageData = image.split(",")[1] || image;

  try {
    const text = await callGemini(MODEL, {
      contents: [
        {
          role: "user",
          parts: [
            { inline_data: { mime_type: mimeType, data: imageData } },
            {
              text: `The user has confirmed this plant is "${commonName}" (${species || commonName}). Do NOT re-identify the species. Use the image only to assess health and return accurate care instructions for this confirmed species.`,
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
      },
      systemInstruction: {
        parts: [
          {
            text: `You are an expert botanist. The species has been confirmed as "${commonName}" (${species || commonName}). Do NOT re-identify or override this. Assess the plant's health from the photo and return accurate care instructions for ${commonName}.`,
          },
        ],
      },
    });

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

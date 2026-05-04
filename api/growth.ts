import type { VercelRequest, VercelResponse } from "@vercel/node";
import { callGemini, MODEL, GROWTH_SCHEMA } from "../lib/gemini";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { newImage, pastImages } = req.body as {
    newImage?: string;
    pastImages?: string[];
  };
  if (!newImage) return res.status(400).json({ error: "Missing newImage" });

  const imagesToCompare = [...(pastImages || []).slice(-3), newImage];

  const parts: object[] = imagesToCompare.flatMap((img: string, i: number) => {
    const mimeMatch = img.match(/^data:([^;]+);base64,/);
    const mimeType = mimeMatch?.[1] ?? "image/jpeg";
    return [
      { inline_data: { mime_type: mimeType, data: img.split(",")[1] || img } },
      { text: i === imagesToCompare.length - 1 ? "Current photo" : `Previous photo ${i + 1}` },
    ];
  });

  try {
    const text = await callGemini(MODEL, {
      contents: [
        {
          role: "user",
          parts: [
            ...parts,
            {
              text: "Analyze growth progress. Compare the 'Current photo' with 'Previous photo(s)'. Detect changes in size, leaf count, and health.",
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: GROWTH_SCHEMA,
      },
      systemInstruction: {
        parts: [{ text: "You are an expert botanist specialized in time-lapse plant growth analysis." }],
      },
    });

    return res.json(JSON.parse(text));
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("growth error:", msg);
    return res.status(500).json({ error: `Growth analysis failed: ${msg}` });
  }
}

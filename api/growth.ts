import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAi, MODEL, GROWTH_SCHEMA } from "./_gemini";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { newImage, pastImages } = req.body as {
    newImage?: string;
    pastImages?: string[];
  };
  if (!newImage) return res.status(400).json({ error: "Missing newImage" });

  const ai = getAi();
  const imagesToCompare = [...(pastImages || []).slice(-3), newImage];

  const parts: object[] = imagesToCompare.flatMap((img: string, i: number) => [
    { inlineData: { data: img.split(",")[1] || img, mimeType: "image/jpeg" } },
    { text: i === imagesToCompare.length - 1 ? "Current photo" : `Previous photo ${i + 1}` },
  ]);

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: {
        parts: [
          ...parts,
          {
            text: "Analyze growth progress. Compare the 'Current photo' with 'Previous photo(s)'. Detect changes in size, leaf count, and health.",
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: GROWTH_SCHEMA,
        systemInstruction: "You are an expert botanist specialized in time-lapse plant growth analysis.",
      },
    });

    if (!response.text) throw new Error("AI returned an empty response.");
    return res.json(JSON.parse(response.text));
  } catch (error) {
    console.error("growth error:", error);
    return res.status(500).json({ error: "Growth analysis failed." });
  }
}

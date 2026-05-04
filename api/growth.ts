import type { VercelRequest, VercelResponse } from "@vercel/node";

const GEMINI_URL = (key: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${key}`;

const GROWTH_SCHEMA = {
  type: "OBJECT",
  properties: {
    status: { type: "STRING" },
    description: { type: "STRING" },
    growthDetected: { type: "BOOLEAN" },
  },
  required: ["status", "description", "growthDetected"],
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { newImage, pastImages } = req.body as { newImage?: string; pastImages?: string[] };
  if (!newImage) return res.status(400).json({ error: "Missing newImage" });

  const key = process.env.GEMINI_API_KEY || "";
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
    const response = await fetch(GEMINI_URL(key), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [...parts, { text: "Analyze growth progress comparing the current photo with previous photos." }] }],
        generationConfig: { responseMimeType: "application/json", responseSchema: GROWTH_SCHEMA },
        systemInstruction: { parts: [{ text: "You are an expert botanist specialized in plant growth analysis." }] },
      }),
    });

    const data = await response.json() as any;
    if (!response.ok) throw new Error(data?.error?.message || `Gemini error ${response.status}`);
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("AI returned an empty response.");
    return res.json(JSON.parse(text));
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("growth error:", msg);
    return res.status(500).json({ error: `Growth analysis failed: ${msg}` });
  }
}

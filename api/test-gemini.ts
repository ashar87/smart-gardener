import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAi } from "./_gemini";

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const ai = getAi();
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ role: "user", parts: [{ text: "Reply with just the word: ok" }] }],
    });
    return res.json({ success: true, reply: response.text });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ success: false, error: msg });
  }
}

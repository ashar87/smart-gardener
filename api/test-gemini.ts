import { callGemini, MODEL } from "./_gemini";

export default async function handler(req: any, res: any) {
  try {
    const reply = await callGemini(MODEL, {
      contents: [{ role: "user", parts: [{ text: "Reply with just the word: ok" }] }],
    });
    return res.json({ success: true, reply });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ success: false, error: msg });
  }
}

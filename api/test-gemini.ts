const GEMINI_URL = (key: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`;

export default async function handler(req: any, res: any) {
  try {
    const key = process.env.GEMINI_API_KEY || "";
    const response = await fetch(GEMINI_URL(key), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: "Reply with just the word: ok" }] }],
      }),
    });
    const data = await response.json() as any;
    if (!response.ok) return res.status(500).json({ success: false, error: data?.error?.message });
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
    return res.json({ success: true, reply });
  } catch (error) {
    return res.status(500).json({ success: false, error: String(error) });
  }
}

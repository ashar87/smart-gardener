export default async function handler(req: any, res: any) {
  const model = (req.query?.model as string) || "gemini-2.5-flash";
  const key = process.env.GEMINI_API_KEY || "";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: "Reply with just the word: ok" }] }],
      }),
    });
    const data = await response.json() as any;
    if (!response.ok) return res.status(response.status).json({ success: false, model, error: data?.error?.message });
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
    return res.json({ success: true, model, reply });
  } catch (error) {
    return res.status(500).json({ success: false, model, error: String(error) });
  }
}

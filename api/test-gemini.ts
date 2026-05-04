export default async function handler(req: any, res: any) {
  try {
    const key = process.env.GEMINI_API_KEY || "";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: "Reply with just the word: ok" }] }],
      }),
    });

    const data = await response.json();
    return res.json({ httpStatus: response.status, data });
  } catch (error) {
    return res.status(500).json({ error: String(error) });
  }
}

export default async function handler(req: any, res: any) {
  res.json({
    ok: true,
    nodeVersion: process.version,
    hasFetch: typeof fetch !== "undefined",
    hasGeminiKey: !!process.env.GEMINI_API_KEY,
  });
}

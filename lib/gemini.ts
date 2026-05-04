const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
export const MODEL = "gemini-2.0-flash";

export const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    isPlant: {
      type: "BOOLEAN",
      description:
        "true if the image clearly shows a plant, tree, flower, moss, fungi, or other botanical organism. false for animals, people, objects, food, or landscapes with no identifiable plant.",
    },
    species: { type: "STRING", description: "Scientific name of the plant" },
    commonName: { type: "STRING", description: "Common name of the plant" },
    confidence: { type: "NUMBER", description: "Confidence score 0-1" },
    health: {
      type: "OBJECT",
      properties: {
        status: { type: "STRING", enum: ["healthy", "warning", "critical"] },
        assessment: { type: "STRING", description: "Detailed health assessment" },
        issues: {
          type: "ARRAY",
          items: { type: "STRING" },
          description: "Specific identified issues",
        },
      },
      required: ["status", "assessment", "issues"],
    },
    location: {
      type: "STRING",
      enum: ["indoor", "outdoor"],
      description: "Whether this plant is typically kept indoors or outdoors.",
    },
    careSuggestions: {
      type: "OBJECT",
      properties: {
        watering: {
          type: "OBJECT",
          properties: {
            frequency: { type: "STRING", description: "Watering frequency (e.g. 'Every 3 days')" },
          },
          required: ["frequency"],
        },
        sunlight: { type: "STRING" },
        fertilizer: {
          type: "OBJECT",
          properties: {
            instructions: { type: "STRING" },
            frequencyDays: { type: "INTEGER" },
            activeMonths: { type: "ARRAY", items: { type: "INTEGER" } },
          },
          required: ["instructions", "frequencyDays", "activeMonths"],
        },
        pruning: {
          type: "OBJECT",
          properties: {
            instructions: { type: "STRING" },
            frequencyDays: { type: "INTEGER" },
            activeMonths: { type: "ARRAY", items: { type: "INTEGER" } },
          },
          required: ["instructions", "frequencyDays", "activeMonths"],
        },
      },
      required: ["watering", "sunlight", "fertilizer", "pruning"],
    },
  },
  required: ["isPlant", "species", "commonName", "confidence", "location", "health", "careSuggestions"],
};

export const GROWTH_SCHEMA = {
  type: "OBJECT",
  properties: {
    status: { type: "STRING", description: "Short status summary" },
    description: { type: "STRING", description: "Comparison analysis" },
    growthDetected: { type: "BOOLEAN" },
  },
  required: ["status", "description", "growthDetected"],
};

export interface GeminiBody {
  contents: object[];
  generationConfig?: object;
  systemInstruction?: object;
}

export async function callGemini(model: string, body: GeminiBody): Promise<string> {
  const key = process.env.GEMINI_API_KEY || "";
  const url = `${GEMINI_BASE}/${model}:generateContent?key=${key}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(err.error?.message || `Gemini API error ${res.status}`);
  }

  const data = await res.json() as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("AI returned an empty response.");
  return text;
}

export const isTransient = (error: unknown): boolean => {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    msg.includes("503") ||
    msg.includes("UNAVAILABLE") ||
    msg.includes("429") ||
    msg.includes("RESOURCE_EXHAUSTED") ||
    msg.includes("quota")
  );
};

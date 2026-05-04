import { GoogleGenAI, Type } from "@google/genai";

export const getAi = () =>
  new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const MODEL = "gemini-3-flash-preview";

export const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    isPlant: {
      type: Type.BOOLEAN,
      description:
        "true if the image clearly shows a plant, tree, flower, moss, fungi, or other botanical organism. false for animals, people, objects, food, or landscapes with no identifiable plant.",
    },
    species: { type: Type.STRING, description: "Scientific name of the plant" },
    commonName: { type: Type.STRING, description: "Common name of the plant" },
    confidence: { type: Type.NUMBER, description: "Confidence score 0-1" },
    health: {
      type: Type.OBJECT,
      properties: {
        status: { type: Type.STRING, enum: ["healthy", "warning", "critical"] },
        assessment: { type: Type.STRING, description: "Detailed health assessment" },
        issues: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Specific identified issues",
        },
      },
      required: ["status", "assessment", "issues"],
    },
    location: {
      type: Type.STRING,
      enum: ["indoor", "outdoor"],
      description: "Whether this plant is typically kept indoors or outdoors.",
    },
    careSuggestions: {
      type: Type.OBJECT,
      properties: {
        watering: {
          type: Type.OBJECT,
          properties: {
            frequency: {
              type: Type.STRING,
              description: "Watering frequency (e.g. 'Every 3 days')",
            },
          },
          required: ["frequency"],
        },
        sunlight: { type: Type.STRING },
        fertilizer: {
          type: Type.OBJECT,
          properties: {
            instructions: { type: Type.STRING },
            frequencyDays: { type: Type.INTEGER },
            activeMonths: { type: Type.ARRAY, items: { type: Type.INTEGER } },
          },
          required: ["instructions", "frequencyDays", "activeMonths"],
        },
        pruning: {
          type: Type.OBJECT,
          properties: {
            instructions: { type: Type.STRING },
            frequencyDays: { type: Type.INTEGER },
            activeMonths: { type: Type.ARRAY, items: { type: Type.INTEGER } },
          },
          required: ["instructions", "frequencyDays", "activeMonths"],
        },
      },
      required: ["watering", "sunlight", "fertilizer", "pruning"],
    },
  },
  required: [
    "isPlant",
    "species",
    "commonName",
    "confidence",
    "location",
    "health",
    "careSuggestions",
  ],
};

export const GROWTH_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    status: { type: Type.STRING, description: "Short status summary" },
    description: { type: Type.STRING, description: "Comparison analysis" },
    growthDetected: { type: Type.BOOLEAN },
  },
  required: ["status", "description", "growthDetected"],
};

export const isTransient = (error: unknown): boolean => {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    msg.includes("503") ||
    msg.includes("UNAVAILABLE") ||
    msg.includes("429") ||
    msg.includes("RESOURCE_EXHAUSTED")
  );
};

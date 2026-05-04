/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from "@google/genai";
import { IdentificationResult } from "../types";

const getAiClient = () => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
  if (!apiKey) {
    throw new Error("Gemini API key is not configured in the environment (.env file).");
  }
  return new GoogleGenAI({ apiKey });
};

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    isPlant: {
      type: Type.BOOLEAN,
      description: "true if the image clearly shows a plant, tree, flower, moss, fungi, or other botanical organism. false for animals, people, objects, food, or landscapes with no identifiable plant."
    },
    species: { type: Type.STRING, description: "Scientific name of the plant" },
    commonName: { type: Type.STRING, description: "Common name of the plant" },
    confidence: { type: Type.NUMBER, description: "Confidence score 0-1" },
    health: {
      type: Type.OBJECT,
      properties: {
        status: { type: Type.STRING, enum: ["healthy", "warning", "critical"] },
        assessment: { type: Type.STRING, description: "Detailed health assessment" },
        issues: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Specific identified issues (e.g. browning leaves)" }
      },
      required: ["status", "assessment", "issues"]
    },
    location: {
      type: Type.STRING,
      enum: ["indoor", "outdoor"],
      description: "Whether this plant is typically kept indoors or outdoors. If it can be both, choose the most common environment for this species."
    },
    careSuggestions: {
      type: Type.OBJECT,
      properties: {
        watering: {
          type: Type.OBJECT,
          properties: {
            frequency: { type: Type.STRING, description: "Watering frequency (e.g. 'Every 3 days')" }
          },
          required: ["frequency"]
        },
        sunlight: { type: Type.STRING },
        fertilizer: { type: Type.STRING },
        pruning: { type: Type.STRING }
      },
      required: ["watering", "sunlight"]
    }
  },
  required: ["isPlant", "species", "commonName", "confidence", "location", "health", "careSuggestions"]
};

const GROWTH_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    status: { type: Type.STRING, description: "Short status summary (e.g. 'Improved', 'Stagnant')" },
    description: { type: Type.STRING, description: "Comparison analysis of changes since past photos" },
    growthDetected: { type: Type.BOOLEAN, description: "Whether new growth is visible" }
  },
  required: ["status", "description", "growthDetected"]
};

const isTransientError = (error: unknown): boolean => {
  const msg = error instanceof Error ? error.message : String(error);
  return msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED');
};

export async function identifyPlant(base64Image: string): Promise<IdentificationResult> {
  const model = "gemini-3-flash-preview";
  const ai = getAiClient();
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: {
          parts: [
            {
              inlineData: {
                data: base64Image.split(',')[1] || base64Image,
                mimeType: "image/jpeg"
              }
            },
            {
              text: "Identify this plant, assess its health, and predict whether it is typically an indoor or outdoor plant. Provide detailed care instructions in JSON format."
            }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
          systemInstruction: "You are an expert botanist and computer vision plant identification engine. Always return valid JSON. For the location field, carefully consider whether this species thrives indoors or outdoors in typical home environments. If the image does not show a plant, set isPlant to false, species to 'Unknown', commonName to 'Unknown', confidence to 0, and health.status to 'healthy' with an empty issues array. Never fabricate plant data for non-plant images."
        }
      });

      if (!response.text) {
        throw new Error("AI returned an empty response.");
      }

      const rawResult = JSON.parse(response.text);
      return rawResult as IdentificationResult;
    } catch (error) {
      const transient = isTransientError(error);
      if (transient && attempt < maxAttempts) {
        await new Promise(r => setTimeout(r, 1500 * attempt));
        continue;
      }
      console.error("Gemini API Error (Identification):", error);
      // Surface a human-readable message for known transient errors
      if (transient) {
        throw new Error("Gemini is experiencing high demand right now. Please try again in a moment.");
      }
      throw error;
    }
  }

  // unreachable, satisfies TypeScript
  throw new Error("Gemini is experiencing high demand right now. Please try again in a moment.");
}

export async function reanalyzeWithCorrectName(
  base64Image: string,
  commonName: string,
  species: string
): Promise<IdentificationResult> {
  const model = "gemini-3-flash-preview";
  const ai = getAiClient();

  console.log(`Calling Gemini (${model}) for care reanalysis with confirmed name: ${commonName}...`);

  try {
    const response = await ai.models.generateContent({
      model,
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Image.split(',')[1] || base64Image,
              mimeType: "image/jpeg"
            }
          },
          {
            text: `The user has confirmed this plant is "${commonName}" (${species || commonName}). Do NOT re-identify the species. Use the image only to assess the plant's current health condition. Return accurate care instructions for this confirmed species.`
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
        systemInstruction: `You are an expert botanist. The species has already been confirmed by the user as "${commonName}" (${species || commonName}). Do NOT re-identify or override this. Your job is to: (1) assess the health of the plant shown in the photo, (2) return accurate care instructions specific to ${commonName}. Always populate the species and commonName fields with the confirmed values provided.`
      }
    });

    if (!response.text) {
      throw new Error("AI returned an empty response.");
    }

    const rawResult = JSON.parse(response.text) as IdentificationResult;
    // Enforce the user's confirmed name regardless of what the model returns
    rawResult.commonName = commonName;
    rawResult.species = species || rawResult.species;
    return rawResult;
  } catch (error) {
    console.error("Gemini API Error (Reanalysis):", error);
    throw error;
  }
}

export async function analyzeGrowth(newImage: string, pastImages: string[]): Promise<any> {
  const model = "gemini-3-flash-preview";
  const ai = getAiClient();
  
  console.log(`Calling Gemini (${model}) for growth analysis...`);
  
  // We'll take the latest 3 past images + the new one
  const imagesToCompare = [...pastImages.slice(-3), newImage];
  
  const parts: any[] = imagesToCompare.flatMap((img, i) => [
    {
      inlineData: {
        data: img.split(',')[1] || img,
        mimeType: "image/jpeg"
      }
    },
    {
      text: i === imagesToCompare.length - 1 ? "Current photo" : `Previous photo ${i+1}`
    }
  ]);

  try {
    const response = await ai.models.generateContent({
      model,
      contents: {
        parts: [
          ...parts,
          {
            text: "Analyze the growth progress. Compare the 'Current photo' with the 'Previous photo(s)'. Detect changes in size, leaf count, and health."
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: GROWTH_SCHEMA,
        systemInstruction: "You are an expert botanist specialized in time-lapse plant growth analysis."
      }
    });

    if (!response.text) {
      throw new Error("AI returned an empty response.");
    }

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Gemini API Error (Growth):", error);
    throw error;
  }
}

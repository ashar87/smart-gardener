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
  required: ["species", "commonName", "confidence", "health", "careSuggestions"]
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

export async function identifyPlant(base64Image: string): Promise<IdentificationResult> {
  const model = "gemini-3-flash-preview";
  const ai = getAiClient();
  
  console.log(`Calling Gemini (${model}) for plant identification...`);
  
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
            text: "Identify this plant and assess its health. Provide detailed care instructions in JSON format."
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
        systemInstruction: "You are an expert botanist and computer vision plant identification engine. Always return valid JSON."
      }
    });

    if (!response.text) {
      throw new Error("AI returned an empty response.");
    }

    const rawResult = JSON.parse(response.text);
    return rawResult as IdentificationResult;
  } catch (error) {
    console.error("Gemini API Error (Identification):", error);
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

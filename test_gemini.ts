import { GoogleGenAI, Type } from "@google/genai";
import * as fs from 'fs';

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

async function test() {
  const apiKey = process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    console.error("NO API KEY FOUND!");
    process.exit(1);
  }
  
  const ai = new GoogleGenAI({ apiKey });
  
  // Create a 1x1 base64 encoded dummy jpeg
  const base64Data = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Data,
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
    console.log("SUCCESS:", response.text);
  } catch(e) {
    console.error("ERROR:", e);
  }
}

test();

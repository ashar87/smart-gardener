/**
 * Smart Gardener — Firebase Cloud Functions
 * Proxies Gemini AI calls so the API key stays server-side.
 */

import { onRequest } from "firebase-functions/v2/https";
import { defineString } from "firebase-functions/params";
import { GoogleGenAI, Type } from "@google/genai";
import cors from "cors";

// The API key is stored in Firebase environment config (set via `firebase functions:secrets:set GEMINI_API_KEY`)
const geminiApiKey = defineString("GEMINI_API_KEY");

const corsHandler = cors({ origin: true });

// ─── Schemas ────────────────────────────────────────────────────────────────────

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
        issues: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Specific identified issues" }
      },
      required: ["status", "assessment", "issues"]
    },
    location: {
      type: Type.STRING,
      enum: ["indoor", "outdoor"],
      description: "Whether this plant is typically kept indoors or outdoors."
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
        fertilizer: {
          type: Type.OBJECT,
          properties: {
            instructions: { type: Type.STRING, description: "Detailed fertilizer instructions" },
            frequencyDays: { type: Type.INTEGER, description: "Frequency in days between applications" },
            activeMonths: { type: Type.ARRAY, items: { type: Type.INTEGER }, description: "Months (1-12) when this care should be performed." }
          },
          required: ["instructions", "frequencyDays", "activeMonths"]
        },
        pruning: {
          type: Type.OBJECT,
          properties: {
            instructions: { type: Type.STRING, description: "Detailed pruning instructions" },
            frequencyDays: { type: Type.INTEGER, description: "Frequency in days between prunings" },
            activeMonths: { type: Type.ARRAY, items: { type: Type.INTEGER }, description: "Months (1-12) when this care should be performed." }
          },
          required: ["instructions", "frequencyDays", "activeMonths"]
        }
      },
      required: ["watering", "sunlight", "fertilizer", "pruning"]
    }
  },
  required: ["isPlant", "species", "commonName", "confidence", "location", "health", "careSuggestions"]
};

const GROWTH_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    status: { type: Type.STRING, description: "Short status summary" },
    description: { type: Type.STRING, description: "Comparison analysis" },
    growthDetected: { type: Type.BOOLEAN, description: "Whether new growth is visible" }
  },
  required: ["status", "description", "growthDetected"]
};

const isTransientError = (error: unknown): boolean => {
  const msg = error instanceof Error ? error.message : String(error);
  return msg.includes("503") || msg.includes("UNAVAILABLE") || msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED");
};

// ─── Cloud Functions ────────────────────────────────────────────────────────────

export const identify = onRequest(
  { timeoutSeconds: 60, memory: "512MiB", secrets: [geminiApiKey] },
  (req, res) => {
    corsHandler(req, res, async () => {
      if (req.method !== "POST") { res.status(405).send("Method not allowed"); return; }

      const { image } = req.body;
      if (!image) { res.status(400).json({ error: "Missing image" }); return; }

      const ai = new GoogleGenAI({ apiKey: geminiApiKey.value() });
      const model = "gemini-3-flash-preview";
      const maxAttempts = 3;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const response = await ai.models.generateContent({
            model,
            contents: {
              parts: [
                { inlineData: { data: image.split(",")[1] || image, mimeType: "image/jpeg" } },
                { text: "Identify this plant, assess its health, and predict whether it is typically an indoor or outdoor plant. Provide detailed care instructions in JSON format. For fertilizer and pruning, provide the instructions, the frequency in days, and an array of integers (1-12) representing the active months when this care is required (assuming Northern Hemisphere seasons)." }
              ]
            },
            config: {
              responseMimeType: "application/json",
              responseSchema: RESPONSE_SCHEMA,
              systemInstruction: "You are an expert botanist and computer vision plant identification engine. Always return valid JSON. For the location field, carefully consider whether this species thrives indoors or outdoors in typical home environments. If the image does not show a plant, set isPlant to false, species to 'Unknown', commonName to 'Unknown', confidence to 0, and health.status to 'healthy' with an empty issues array. Never fabricate plant data for non-plant images."
            }
          });

          if (!response.text) throw new Error("AI returned an empty response.");
          res.json(JSON.parse(response.text));
          return;
        } catch (error) {
          if (isTransientError(error) && attempt < maxAttempts) {
            await new Promise(r => setTimeout(r, 1500 * attempt));
            continue;
          }
          console.error("Gemini identify error:", error);
          if (isTransientError(error)) {
            res.status(503).json({ error: "AI service is busy. Please try again." });
          } else {
            res.status(500).json({ error: "Plant identification failed." });
          }
          return;
        }
      }

      res.status(503).json({ error: "AI service is busy. Please try again." });
    });
  }
);

export const reanalyze = onRequest(
  { timeoutSeconds: 60, memory: "512MiB", secrets: [geminiApiKey] },
  (req, res) => {
    corsHandler(req, res, async () => {
      if (req.method !== "POST") { res.status(405).send("Method not allowed"); return; }

      const { image, commonName, species } = req.body;
      if (!image || !commonName) { res.status(400).json({ error: "Missing image or commonName" }); return; }

      const confirmedName = commonName;
      const ai = new GoogleGenAI({ apiKey: geminiApiKey.value() });

      try {
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: {
            parts: [
              { inlineData: { data: image.split(",")[1] || image, mimeType: "image/jpeg" } },
              { text: `The user has confirmed this plant is "${confirmedName}" (${species || confirmedName}). Do NOT re-identify the species. Use the image only to assess the plant's current health condition. Return accurate care instructions for this confirmed species.` }
            ]
          },
          config: {
            responseMimeType: "application/json",
            responseSchema: RESPONSE_SCHEMA,
            systemInstruction: `You are an expert botanist. The species has already been confirmed by the user as "${confirmedName}" (${species || confirmedName}). Do NOT re-identify or override this. Your job is to: (1) assess the health of the plant shown in the photo, (2) return accurate care instructions specific to ${confirmedName}. Always populate the species and commonName fields with the confirmed values provided.`
          }
        });

        if (!response.text) throw new Error("AI returned an empty response.");
        const result = JSON.parse(response.text);
        result.commonName = confirmedName;
        result.species = species || result.species;
        res.json(result);
      } catch (error) {
        console.error("Gemini reanalyze error:", error);
        res.status(500).json({ error: "Reanalysis failed." });
      }
    });
  }
);

export const growth = onRequest(
  { timeoutSeconds: 60, memory: "512MiB", secrets: [geminiApiKey] },
  (req, res) => {
    corsHandler(req, res, async () => {
      if (req.method !== "POST") { res.status(405).send("Method not allowed"); return; }

      const { newImage, pastImages } = req.body;
      if (!newImage) { res.status(400).json({ error: "Missing newImage" }); return; }

      const ai = new GoogleGenAI({ apiKey: geminiApiKey.value() });
      const imagesToCompare = [...(pastImages || []).slice(-3), newImage];

      const parts: any[] = imagesToCompare.flatMap((img: string, i: number) => [
        { inlineData: { data: img.split(",")[1] || img, mimeType: "image/jpeg" } },
        { text: i === imagesToCompare.length - 1 ? "Current photo" : `Previous photo ${i + 1}` }
      ]);

      try {
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: {
            parts: [
              ...parts,
              { text: "Analyze the growth progress. Compare the 'Current photo' with the 'Previous photo(s)'. Detect changes in size, leaf count, and health." }
            ]
          },
          config: {
            responseMimeType: "application/json",
            responseSchema: GROWTH_SCHEMA,
            systemInstruction: "You are an expert botanist specialized in time-lapse plant growth analysis."
          }
        });

        if (!response.text) throw new Error("AI returned an empty response.");
        res.json(JSON.parse(response.text));
      } catch (error) {
        console.error("Gemini growth error:", error);
        res.status(500).json({ error: "Growth analysis failed." });
      }
    });
  }
);

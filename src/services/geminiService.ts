/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { IdentificationResult } from "../types";

/**
 * Returns the base URL for the Gemini proxy Cloud Functions.
 * In development, Vite proxies /api/* to the Firebase emulator.
 * In production, this points to the deployed Cloud Function URL.
 */
const getApiBaseUrl = (): string => {
  return import.meta.env.VITE_API_BASE_URL || '';
};

export async function identifyPlant(base64Image: string): Promise<IdentificationResult> {
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(`${getApiBaseUrl()}/identify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64Image })
      });

      if (response.status === 503 && attempt < maxAttempts) {
        await new Promise(r => setTimeout(r, 1500 * attempt));
        continue;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Plant identification failed.');
      }

      return await response.json();
    } catch (error) {
      if (attempt < maxAttempts && error instanceof TypeError) {
        // Network error — retry
        await new Promise(r => setTimeout(r, 1500 * attempt));
        continue;
      }
      console.error("Identification error:", error);
      if (attempt === maxAttempts) {
        throw error instanceof Error ? error : new Error("Plant identification failed.");
      }
    }
  }

  throw new Error("Gemini is experiencing high demand right now. Please try again in a moment.");
}

export async function reanalyzeWithCorrectName(
  base64Image: string,
  commonName: string,
  species: string
): Promise<IdentificationResult> {
  console.log(`Calling proxy for care reanalysis with confirmed name: ${commonName}...`);

  const response = await fetch(`${getApiBaseUrl()}/reanalyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: base64Image, commonName, species })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Reanalysis failed.');
  }

  return await response.json();
}

export async function analyzeGrowth(newImage: string, pastImages: string[]): Promise<any> {
  console.log('Calling proxy for growth analysis...');

  const response = await fetch(`${getApiBaseUrl()}/growth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ newImage, pastImages })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Growth analysis failed.');
  }

  return await response.json();
}

/**
 * Integration tests for geminiService.ts
 *
 * Mocks @google/genai using a proper class syntax so `new GoogleGenAI()`
 * works correctly under Vitest's module hoisting.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Store the mock fn in module scope so tests can access it via import
// The trick: use a module-level __mocks__ object that the factory closes over
// Since vi.mock factories are hoisted, we must use globalThis to share state
vi.mock('@google/genai', () => {
  const generateContent = vi.fn();
  (globalThis as any).__geminiGenerateContent = generateContent;

  class GoogleGenAI {
    models = { generateContent };
    constructor(_config: any) {}
  }

  return {
    GoogleGenAI,
    Type: {
      OBJECT: 'object',
      STRING: 'string',
      NUMBER: 'number',
      BOOLEAN: 'boolean',
      ARRAY: 'array',
    },
  };
});

vi.stubEnv('VITE_GEMINI_API_KEY', 'test-api-key-123');

import { identifyPlant, analyzeGrowth } from './geminiService';

// Helper to access the shared mock after module load
const getMock = (): ReturnType<typeof vi.fn> => (globalThis as any).__geminiGenerateContent;

// ─── Test data ────────────────────────────────────────────────────────────────

const MOCK_BASE64 = 'data:image/jpeg;base64,/9j/fakeimagebytes';

const MOCK_IDENTIFICATION = {
  species: 'Monstera deliciosa',
  commonName: 'Swiss Cheese Plant',
  confidence: 0.97,
  location: 'indoor',
  health: { status: 'healthy', assessment: 'Vibrant and well-hydrated.', issues: [] },
  careSuggestions: {
    watering: { frequency: 'Every 7 days' },
    sunlight: 'Indirect bright light',
    fertilizer: 'Monthly during growing season',
    pruning: 'Trim dead leaves as needed',
  },
};

const MOCK_GROWTH = {
  status: 'Improved',
  description: 'Two new leaves have emerged since the last photo.',
  growthDetected: true,
};

// ─── identifyPlant ────────────────────────────────────────────────────────────

describe('identifyPlant', () => {
  beforeEach(() => getMock().mockReset());

  it('returns a parsed IdentificationResult on success', async () => {
    getMock().mockResolvedValueOnce({ text: JSON.stringify(MOCK_IDENTIFICATION) });

    const result = await identifyPlant(MOCK_BASE64);

    expect(result.species).toBe('Monstera deliciosa');
    expect(result.commonName).toBe('Swiss Cheese Plant');
    expect(result.confidence).toBe(0.97);
    expect(result.location).toBe('indoor');
    expect(result.health.status).toBe('healthy');
    expect(result.health.issues).toHaveLength(0);
    expect(result.careSuggestions.watering?.frequency).toBe('Every 7 days');
  });

  it('strips the data URI prefix and sends raw base64 as inlineData', async () => {
    getMock().mockResolvedValueOnce({ text: JSON.stringify(MOCK_IDENTIFICATION) });

    await identifyPlant(MOCK_BASE64);

    const parts = getMock().mock.calls[0][0].contents.parts;
    expect(parts[0].inlineData.data).toBe('/9j/fakeimagebytes');
    expect(parts[0].inlineData.mimeType).toBe('image/jpeg');
  });

  it('throws when the AI returns an empty response', async () => {
    getMock().mockResolvedValueOnce({ text: null });

    await expect(identifyPlant(MOCK_BASE64)).rejects.toThrow('AI returned an empty response');
  });

  it('throws when the network call fails', async () => {
    getMock().mockRejectedValueOnce(new Error('503 Service Unavailable'));

    await expect(identifyPlant(MOCK_BASE64)).rejects.toThrow('503 Service Unavailable');
  });

  it('correctly handles a plant with health issues', async () => {
    const warningResult = {
      ...MOCK_IDENTIFICATION,
      health: { status: 'warning', assessment: 'Brown tips.', issues: ['Brown leaf tips', 'Low humidity'] },
    };
    getMock().mockResolvedValueOnce({ text: JSON.stringify(warningResult) });

    const result = await identifyPlant(MOCK_BASE64);

    expect(result.health.status).toBe('warning');
    expect(result.health.issues).toContain('Brown leaf tips');
    expect(result.health.issues).toHaveLength(2);
  });
});

// ─── analyzeGrowth ────────────────────────────────────────────────────────────

describe('analyzeGrowth', () => {
  beforeEach(() => getMock().mockReset());

  it('returns a parsed growth analysis result on success', async () => {
    getMock().mockResolvedValueOnce({ text: JSON.stringify(MOCK_GROWTH) });

    const result = await analyzeGrowth(MOCK_BASE64, []);

    expect(result.status).toBe('Improved');
    expect(result.growthDetected).toBe(true);
  });

  it('sends only the new image when no past images are provided', async () => {
    getMock().mockResolvedValueOnce({ text: JSON.stringify(MOCK_GROWTH) });

    await analyzeGrowth(MOCK_BASE64, []);

    const imageParts = getMock().mock.calls[0][0].contents.parts.filter((p: any) => p.inlineData);
    expect(imageParts).toHaveLength(1);
  });

  it('slices past images to a maximum of 3', async () => {
    getMock().mockResolvedValueOnce({ text: JSON.stringify(MOCK_GROWTH) });

    await analyzeGrowth(MOCK_BASE64, Array(10).fill('data:image/jpeg;base64,old'));

    const imageParts = getMock().mock.calls[0][0].contents.parts.filter((p: any) => p.inlineData);
    expect(imageParts).toHaveLength(4); // 3 past + 1 new
  });

  it('throws when the AI returns an empty response', async () => {
    getMock().mockResolvedValueOnce({ text: null });

    await expect(analyzeGrowth(MOCK_BASE64, [])).rejects.toThrow('AI returned an empty response');
  });

  it('throws when the AI call fails', async () => {
    getMock().mockRejectedValueOnce(new Error('Rate limit exceeded'));

    await expect(analyzeGrowth(MOCK_BASE64, [])).rejects.toThrow('Rate limit exceeded');
  });

  it('returns growthDetected: false when no growth is visible', async () => {
    getMock().mockResolvedValueOnce({
      text: JSON.stringify({ status: 'Stagnant', description: 'No change.', growthDetected: false }),
    });

    const result = await analyzeGrowth(MOCK_BASE64, [MOCK_BASE64]);
    expect(result.growthDetected).toBe(false);
    expect(result.status).toBe('Stagnant');
  });
});

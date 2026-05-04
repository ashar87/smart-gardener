/**
 * Unit tests for geminiService.ts
 *
 * geminiService now calls a backend proxy via fetch.
 * Tests mock the global fetch using vi.stubGlobal.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { identifyPlant, analyzeGrowth, reanalyzeWithCorrectName } from './geminiService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const okResponse = (body: object) =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  } as Response);

const errorResponse = (status: number, body: object = {}) =>
  Promise.resolve({
    ok: false,
    status,
    json: () => Promise.resolve(body),
  } as Response);

// ─── Test data ────────────────────────────────────────────────────────────────

const MOCK_BASE64 = 'data:image/jpeg;base64,/9j/fakeimagebytes';

const MOCK_IDENTIFICATION = {
  isPlant: true,
  species: 'Monstera deliciosa',
  commonName: 'Swiss Cheese Plant',
  confidence: 0.97,
  location: 'indoor' as const,
  health: { status: 'healthy', assessment: 'Vibrant and well-hydrated.', issues: [] },
  careSuggestions: {
    watering: { frequency: 'Every 7 days' },
    sunlight: 'Indirect bright light',
    fertilizer: { instructions: 'Monthly', frequencyDays: 30, activeMonths: [3, 4, 5, 6, 7, 8, 9] },
    pruning: { instructions: 'Trim dead leaves', frequencyDays: 90, activeMonths: [3, 9] },
  },
};

const MOCK_GROWTH = {
  status: 'Improved',
  description: 'Two new leaves have emerged since the last photo.',
  growthDetected: true,
};

// ─── identifyPlant ────────────────────────────────────────────────────────────

describe('identifyPlant', () => {
  beforeEach(() => mockFetch.mockReset());

  it('returns a parsed IdentificationResult on success', async () => {
    mockFetch.mockReturnValueOnce(okResponse(MOCK_IDENTIFICATION));

    const result = await identifyPlant(MOCK_BASE64);

    expect(result.species).toBe('Monstera deliciosa');
    expect(result.commonName).toBe('Swiss Cheese Plant');
    expect(result.confidence).toBe(0.97);
    expect(result.location).toBe('indoor');
    expect(result.health.status).toBe('healthy');
    expect(result.health.issues).toHaveLength(0);
    expect(result.careSuggestions.watering?.frequency).toBe('Every 7 days');
  });

  it('sends the image as JSON in the request body', async () => {
    mockFetch.mockReturnValueOnce(okResponse(MOCK_IDENTIFICATION));

    await identifyPlant(MOCK_BASE64);

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('/identify');
    expect(options.method).toBe('POST');
    const body = JSON.parse(options.body);
    expect(body.image).toBe(MOCK_BASE64);
  });

  it('returns isPlant true for a valid plant', async () => {
    mockFetch.mockReturnValueOnce(okResponse(MOCK_IDENTIFICATION));

    const result = await identifyPlant(MOCK_BASE64);
    expect(result.isPlant).toBe(true);
  });

  it('returns isPlant false for a non-plant image', async () => {
    const nonPlant = { ...MOCK_IDENTIFICATION, isPlant: false, commonName: 'Unknown', confidence: 0 };
    mockFetch.mockReturnValueOnce(okResponse(nonPlant));

    const result = await identifyPlant(MOCK_BASE64);
    expect(result.isPlant).toBe(false);
    expect(result.confidence).toBe(0);
    expect(result.commonName).toBe('Unknown');
  });

  it('retries on 503 and eventually throws a friendly message', async () => {
    vi.useFakeTimers();
    mockFetch
      .mockReturnValueOnce(errorResponse(503, { error: 'Service Unavailable' }))
      .mockReturnValueOnce(errorResponse(503, { error: 'Service Unavailable' }))
      .mockReturnValueOnce(errorResponse(503, { error: 'Service Unavailable' }));

    const assertion = expect(identifyPlant(MOCK_BASE64)).rejects.toThrow();
    await vi.runAllTimersAsync();
    await assertion;
    vi.useRealTimers();
  });

  it('succeeds on retry after a transient 503', async () => {
    vi.useFakeTimers();
    mockFetch
      .mockReturnValueOnce(errorResponse(503))
      .mockReturnValueOnce(okResponse(MOCK_IDENTIFICATION));

    const promise = identifyPlant(MOCK_BASE64);
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result.isPlant).toBe(true);
    expect(result.species).toBe('Monstera deliciosa');
    vi.useRealTimers();
  });

  it('throws on non-transient errors without retrying', async () => {
    mockFetch.mockReturnValueOnce(errorResponse(400, { error: 'Bad Request' }));

    await expect(identifyPlant(MOCK_BASE64)).rejects.toThrow();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('retries on network errors (TypeError)', async () => {
    vi.useFakeTimers();
    mockFetch
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockReturnValueOnce(okResponse(MOCK_IDENTIFICATION));

    const promise = identifyPlant(MOCK_BASE64);
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result.species).toBe('Monstera deliciosa');
    vi.useRealTimers();
  });

  it('handles plants with health issues', async () => {
    const warning = {
      ...MOCK_IDENTIFICATION,
      health: { status: 'warning', assessment: 'Brown tips.', issues: ['Brown leaf tips', 'Low humidity'] },
    };
    mockFetch.mockReturnValueOnce(okResponse(warning));

    const result = await identifyPlant(MOCK_BASE64);
    expect(result.health.status).toBe('warning');
    expect(result.health.issues).toContain('Brown leaf tips');
    expect(result.health.issues).toHaveLength(2);
  });
});

// ─── reanalyzeWithCorrectName ─────────────────────────────────────────────────

describe('reanalyzeWithCorrectName', () => {
  beforeEach(() => mockFetch.mockReset());

  it('sends commonName and species in the request body', async () => {
    mockFetch.mockReturnValueOnce(okResponse(MOCK_IDENTIFICATION));

    await reanalyzeWithCorrectName(MOCK_BASE64, 'Fiddle Leaf Fig', 'Ficus lyrata');

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.commonName).toBe('Fiddle Leaf Fig');
    expect(body.species).toBe('Ficus lyrata');
    expect(body.image).toBe(MOCK_BASE64);
  });

  it('throws on error response', async () => {
    mockFetch.mockReturnValueOnce(errorResponse(500, { error: 'Reanalysis failed.' }));

    await expect(reanalyzeWithCorrectName(MOCK_BASE64, 'Rose', '')).rejects.toThrow('Reanalysis failed.');
  });
});

// ─── analyzeGrowth ────────────────────────────────────────────────────────────

describe('analyzeGrowth', () => {
  beforeEach(() => mockFetch.mockReset());

  it('returns a parsed growth analysis result on success', async () => {
    mockFetch.mockReturnValueOnce(okResponse(MOCK_GROWTH));

    const result = await analyzeGrowth(MOCK_BASE64, []);
    expect(result.status).toBe('Improved');
    expect(result.growthDetected).toBe(true);
  });

  it('sends newImage and pastImages in the request body', async () => {
    mockFetch.mockReturnValueOnce(okResponse(MOCK_GROWTH));

    await analyzeGrowth(MOCK_BASE64, ['data:image/jpeg;base64,old']);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.newImage).toBe(MOCK_BASE64);
    expect(body.pastImages).toHaveLength(1);
  });

  it('throws on error response', async () => {
    mockFetch.mockReturnValueOnce(errorResponse(500, { error: 'Growth analysis failed.' }));

    await expect(analyzeGrowth(MOCK_BASE64, [])).rejects.toThrow('Growth analysis failed.');
  });

  it('returns growthDetected false when no growth is visible', async () => {
    mockFetch.mockReturnValueOnce(
      okResponse({ status: 'Stagnant', description: 'No change.', growthDetected: false })
    );

    const result = await analyzeGrowth(MOCK_BASE64, [MOCK_BASE64]);
    expect(result.growthDetected).toBe(false);
    expect(result.status).toBe('Stagnant');
  });
});

/**
 * Integration tests for cloudSync.ts
 * All Firebase SDK calls are mocked. No real network traffic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Plant } from '../types';

// ─── Mock firebase/firestore (self-contained factory, no top-level refs) ──────
vi.mock('firebase/firestore', () => {
  const setDoc = vi.fn();
  const deleteDoc = vi.fn();
  const onSnapshot = vi.fn();
  const doc = vi.fn(() => ({ path: 'mocked/doc' }));
  const collection = vi.fn();
  const query = vi.fn();

  (globalThis as any).__firestoreMocks = { setDoc, deleteDoc, onSnapshot, doc, collection, query };

  return { doc, setDoc, deleteDoc, onSnapshot, collection, query, getDocs: vi.fn() };
});

vi.mock('firebase/storage', () => {
  const ref = vi.fn((s, path) => ({ path }));
  const uploadString = vi.fn();
  const getDownloadURL = vi.fn();
  const deleteObject = vi.fn();

  (globalThis as any).__storageMocks = { ref, uploadString, getDownloadURL, deleteObject };

  return { ref, uploadString, getDownloadURL, deleteObject };
});

vi.mock('./firebase', () => ({
  db: { _type: 'firestore-mock' },
  storage: { _type: 'storage-mock' },
  auth: null,
}));

import {
  uploadPlantImage,
  syncPlantToCloud,
  deletePlantFromCloud,
  subscribeToPlants,
} from './cloudSync';

const mocks = () => (globalThis as any).__firestoreMocks as {
  setDoc: ReturnType<typeof vi.fn>;
  deleteDoc: ReturnType<typeof vi.fn>;
  onSnapshot: ReturnType<typeof vi.fn>;
  doc: ReturnType<typeof vi.fn>;
  collection: ReturnType<typeof vi.fn>;
  query: ReturnType<typeof vi.fn>;
};

const storageMocks = () => (globalThis as any).__storageMocks as {
  ref: ReturnType<typeof vi.fn>;
  uploadString: ReturnType<typeof vi.fn>;
  getDownloadURL: ReturnType<typeof vi.fn>;
  deleteObject: ReturnType<typeof vi.fn>;
};

// ─── Test data ────────────────────────────────────────────────────────────────

const USER_ID = 'user-123';

function makePlant(overrides: Partial<Plant> = {}): Plant {
  return {
    id: 'plant-abc',
    species: 'Monstera deliciosa',
    commonName: 'Swiss Cheese Plant',
    image: 'data:image/jpeg;base64,abc',
    addedAt: 1700000000000,
    location: 'indoor',
    healthStatus: { status: 'healthy', assessment: 'Good', issues: [] },
    careSchedule: {
      watering: { frequency: 'Weekly', lastWatered: 1700000000000, nextWatered: 1700604800000 },
      sunlight: 'Indirect light',
    },
    history: [],
    growthLog: [],
    ...overrides,
  };
}

// ─── uploadPlantImage ─────────────────────────────────────────────────────────

describe('uploadPlantImage', () => {
  it('returns the base64 string as-is (Storage bypass)', async () => {
    const b64 = 'data:image/jpeg;base64,abc123';
    expect(await uploadPlantImage(USER_ID, 'plant-1', b64)).toBe(b64);
  });

  it('works for milestone images with same passthrough', async () => {
    const b64 = 'data:image/jpeg;base64,milestone';
    expect(await uploadPlantImage(USER_ID, 'plant-1', b64, true, 'ms-1')).toBe(b64);
  });
});

// ─── syncPlantToCloud ─────────────────────────────────────────────────────────

describe('syncPlantToCloud', () => {
  beforeEach(() => Object.values(mocks()).forEach(m => m.mockReset()));

  it('calls setDoc with the correct Firestore path', async () => {
    mocks().setDoc.mockResolvedValueOnce(undefined);
    const plant = makePlant();

    await syncPlantToCloud(USER_ID, plant);

    expect(mocks().doc).toHaveBeenCalledWith(expect.anything(), `users/${USER_ID}/plants/${plant.id}`);
    expect(mocks().setDoc).toHaveBeenCalledWith(expect.anything(), plant);
  });

  it('resolves without error on success', async () => {
    mocks().setDoc.mockResolvedValueOnce(undefined);
    await expect(syncPlantToCloud(USER_ID, makePlant())).resolves.toBeUndefined();
  });

  it('throws when setDoc rejects', async () => {
    mocks().setDoc.mockRejectedValueOnce(new Error('Write failed'));
    await expect(syncPlantToCloud(USER_ID, makePlant())).rejects.toThrow('Write failed');
  });

  it('times out after 10 seconds if setDoc hangs', async () => {
    vi.useFakeTimers();
    mocks().setDoc.mockImplementationOnce(() => new Promise(() => {})); // never resolves

    const promise = syncPlantToCloud(USER_ID, makePlant());
    vi.advanceTimersByTime(10001);

    await expect(promise).rejects.toThrow('Firestore timeout');
    vi.useRealTimers();
  });

  it('syncs a plant with a growth log', async () => {
    mocks().setDoc.mockResolvedValueOnce(undefined);
    const plant = makePlant({
      growthLog: [{
        id: 'g1', image: 'data:image/jpeg;base64,g', timestamp: Date.now(),
        analysis: { status: 'Improved', description: 'New leaf', growthDetected: true },
      }],
    });

    await syncPlantToCloud(USER_ID, plant);
    expect(mocks().setDoc).toHaveBeenCalledWith(expect.anything(), plant);
  });
});

// ─── deletePlantFromCloud ─────────────────────────────────────────────────────

describe('deletePlantFromCloud', () => {
  beforeEach(() => {
    Object.values(mocks()).forEach(m => m.mockReset());
  });

  it('calls deleteDoc with the correct path', async () => {
    mocks().deleteDoc.mockResolvedValueOnce(undefined);
    await deletePlantFromCloud(USER_ID, 'plant-abc');

    expect(mocks().doc).toHaveBeenCalledWith(expect.anything(), `users/${USER_ID}/plants/plant-abc`);
    expect(mocks().deleteDoc).toHaveBeenCalledTimes(1);
  });

  it('resolves without error on success', async () => {
    mocks().deleteDoc.mockResolvedValueOnce(undefined);
    await expect(deletePlantFromCloud(USER_ID, 'plant-abc')).resolves.toBeUndefined();
  });

  it('throws when deleteDoc rejects', async () => {
    mocks().deleteDoc.mockRejectedValueOnce(new Error('Delete failed'));
    await expect(deletePlantFromCloud(USER_ID, 'plant-abc')).rejects.toThrow('Delete failed');
  });
});

// ─── subscribeToPlants ────────────────────────────────────────────────────────

describe('subscribeToPlants', () => {
  beforeEach(() => Object.values(mocks()).forEach(m => m.mockReset()));

  it('calls onSnapshot and returns an unsubscribe function', () => {
    const mockUnsub = vi.fn();
    mocks().onSnapshot.mockReturnValueOnce(mockUnsub);

    const unsub = subscribeToPlants(USER_ID, vi.fn());
    expect(mocks().onSnapshot).toHaveBeenCalledTimes(1);
    expect(typeof unsub).toBe('function');
  });

  it('delivers plants sorted by addedAt descending', () => {
    const callback = vi.fn();
    const older = makePlant({ id: 'old', addedAt: 1000 });
    const newer = makePlant({ id: 'new', addedAt: 9000 });

    mocks().onSnapshot.mockImplementationOnce((_: any, onNext: Function) => {
      onNext({ forEach: (fn: Function) => [older, newer].forEach(p => fn({ data: () => p })) });
      return vi.fn();
    });

    subscribeToPlants(USER_ID, callback);
    const plants = callback.mock.calls[0][0] as Plant[];
    expect(plants[0].id).toBe('new');
    expect(plants[1].id).toBe('old');
  });

  it('calls callback with empty array for empty snapshot', () => {
    const callback = vi.fn();
    mocks().onSnapshot.mockImplementationOnce((_: any, onNext: Function) => {
      onNext({ forEach: () => {} });
      return vi.fn();
    });

    subscribeToPlants(USER_ID, callback);
    expect(callback).toHaveBeenCalledWith([]);
  });

  it('the returned unsubscribe can be called without error', () => {
    const mockUnsub = vi.fn();
    mocks().onSnapshot.mockReturnValueOnce(mockUnsub);

    const unsub = subscribeToPlants(USER_ID, vi.fn());
    expect(() => unsub()).not.toThrow();
    expect(mockUnsub).toHaveBeenCalledTimes(1);
  });
});

/**
 * Integration tests for firebase.ts auth functions.
 *
 * All Firebase SDK calls are mocked so no real network traffic occurs.
 * Note: vi.mock() factories are hoisted to the top of the file by Vitest,
 * so they cannot reference variables declared outside the factory.
 * All mock functions are accessed via vi.mocked() after import.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock all Firebase modules ────────────────────────────────────────────────
vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({ name: 'mock-app' })),
}));

vi.mock('firebase/auth', () => {
  class GoogleAuthProvider { name = 'mock-provider'; }
  return {
    getAuth: vi.fn(() => ({ name: 'mock-auth' })),
    GoogleAuthProvider,
    signInWithPopup: vi.fn(),
    createUserWithEmailAndPassword: vi.fn(),
    signInWithEmailAndPassword: vi.fn(),
    signOut: vi.fn(),
    onAuthStateChanged: vi.fn(() => () => {}),
  };
});

vi.mock('firebase/firestore', () => ({ getFirestore: vi.fn() }));
vi.mock('firebase/storage', () => ({ getStorage: vi.fn() }));

// Import after mocks so the module picks up the mocked SDK
import { signInWithGoogle, loginWithEmail, registerWithEmail } from './firebase';
import {
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth';

const mockSignInWithPopup = vi.mocked(signInWithPopup);
const mockCreateUser = vi.mocked(createUserWithEmailAndPassword);
const mockSignIn = vi.mocked(signInWithEmailAndPassword);

// ─── Mock User ────────────────────────────────────────────────────────────────
const MOCK_USER = { uid: 'user-123', email: 'test@example.com', displayName: 'Test User' };

// ─── signInWithGoogle ─────────────────────────────────────────────────────────

describe('signInWithGoogle', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the signed-in user on success', async () => {
    mockSignInWithPopup.mockResolvedValueOnce({ user: MOCK_USER } as any);

    const user = await signInWithGoogle();

    expect(user).toEqual(MOCK_USER);
    expect(mockSignInWithPopup).toHaveBeenCalledTimes(1);
  });

  it('throws when the popup is closed by the user', async () => {
    mockSignInWithPopup.mockRejectedValueOnce(new Error('auth/popup-closed-by-user'));

    await expect(signInWithGoogle()).rejects.toThrow('auth/popup-closed-by-user');
  });
});

// ─── loginWithEmail ───────────────────────────────────────────────────────────

describe('loginWithEmail', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the user on successful login', async () => {
    mockSignIn.mockResolvedValueOnce({ user: MOCK_USER } as any);

    const user = await loginWithEmail('test@example.com', 'password123');

    expect(user).toEqual(MOCK_USER);
    expect(mockSignIn).toHaveBeenCalledWith(
      expect.anything(),
      'test@example.com',
      'password123'
    );
  });

  it('throws when credentials are wrong', async () => {
    mockSignIn.mockRejectedValueOnce(new Error('auth/wrong-password'));

    await expect(loginWithEmail('test@example.com', 'wrongpass')).rejects.toThrow('auth/wrong-password');
  });

  it('throws when the user does not exist', async () => {
    mockSignIn.mockRejectedValueOnce(new Error('auth/user-not-found'));

    await expect(loginWithEmail('noone@example.com', 'pass')).rejects.toThrow('auth/user-not-found');
  });
});

// ─── registerWithEmail ────────────────────────────────────────────────────────

describe('registerWithEmail', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the new user on successful registration', async () => {
    const newUser = { uid: 'new-456', email: 'new@example.com' };
    mockCreateUser.mockResolvedValueOnce({ user: newUser } as any);

    const user = await registerWithEmail('new@example.com', 'securePass1');

    expect(user).toEqual(newUser);
    expect(mockCreateUser).toHaveBeenCalledWith(
      expect.anything(),
      'new@example.com',
      'securePass1'
    );
  });

  it('throws when the email is already in use', async () => {
    mockCreateUser.mockRejectedValueOnce(new Error('auth/email-already-in-use'));

    await expect(registerWithEmail('exists@example.com', 'pass')).rejects.toThrow('auth/email-already-in-use');
  });

  it('throws when the password is too weak', async () => {
    mockCreateUser.mockRejectedValueOnce(new Error('auth/weak-password'));

    await expect(registerWithEmail('new@example.com', '123')).rejects.toThrow('auth/weak-password');
  });
});

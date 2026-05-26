/**
 * Smoke tests for the Onboarding (Welcome) screen.
 *
 * Verifies that the landing screen renders correctly when no user is signed in,
 * and that the basic navigation flows (to login, to signup, back) work.
 *
 * AuthContext is mocked to simulate a logged-out state.
 * firebase.ts is mocked so no real Firebase SDK is initialised.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Mock firebase.ts so the `auth` export is null (no config scenario)
vi.mock('../services/firebase', () => ({
  auth: null,
  db: null,
  storage: null,
  signInWithGoogle: vi.fn(),
  loginWithEmail: vi.fn(),
  registerWithEmail: vi.fn(),
}));

// Provide a logged-out AuthContext
const mockLoginWithGoogle = vi.fn();
const mockLoginWithEmail = vi.fn();
const mockRegisterWithEmail = vi.fn();
(globalThis as any).__onboardingMocks = {
  loginWithGoogle: mockLoginWithGoogle,
  loginWithEmail: mockLoginWithEmail,
  registerWithEmail: mockRegisterWithEmail,
};

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    loginWithGoogle: (globalThis as any).__onboardingMocks.loginWithGoogle,
    loginWithEmail: (globalThis as any).__onboardingMocks.loginWithEmail,
    registerWithEmail: (globalThis as any).__onboardingMocks.registerWithEmail,
  }),
}));

import Onboarding from './Onboarding';

// ─── Smoke tests — Landing screen ─────────────────────────────────────────────

describe('Onboarding — landing screen (smoke tests)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the app name "PlantPatrol"', () => {
    render(<Onboarding />);
    expect(screen.getByText('PlantPatrol')).toBeInTheDocument();
  });

  it('renders the app tagline', () => {
    render(<Onboarding />);
    expect(
      screen.getByText(/Your personal AI assistant for keeping your plants/i)
    ).toBeInTheDocument();
  });

  it('renders a "Continue with Google" button', () => {
    render(<Onboarding />);
    expect(screen.getByText('Continue with Google')).toBeInTheDocument();
  });

  it('renders a "Sign up with Email" button', () => {
    render(<Onboarding />);
    expect(screen.getByText('Sign up with Email')).toBeInTheDocument();
  });

  it('renders a "Log in" link for existing users', () => {
    render(<Onboarding />);
    expect(screen.getByText('Log in')).toBeInTheDocument();
  });

  it('renders the terms of service notice', () => {
    render(<Onboarding />);
    expect(screen.getByText(/Terms of Service/i)).toBeInTheDocument();
  });
});

// ─── Navigation — landing → sign up ──────────────────────────────────────────

describe('Onboarding — navigation to sign up form', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows the "Create Account" heading after clicking "Sign up with Email"', () => {
    render(<Onboarding />);
    fireEvent.click(screen.getByText('Sign up with Email'));
    expect(screen.getByText('Create Account')).toBeInTheDocument();
  });

  it('shows email and password inputs after navigating to sign up', () => {
    render(<Onboarding />);
    fireEvent.click(screen.getByText('Sign up with Email'));
    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
  });

  it('shows a "Back" button on the sign up form', () => {
    render(<Onboarding />);
    fireEvent.click(screen.getByText('Sign up with Email'));
    expect(screen.getByText(/Back/i)).toBeInTheDocument();
  });
});

// ─── Navigation — landing → log in ───────────────────────────────────────────

describe('Onboarding — navigation to log in form', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows the "Welcome Back" heading after clicking "Log in"', () => {
    render(<Onboarding />);
    fireEvent.click(screen.getByText('Log in'));
    expect(screen.getByText('Welcome Back')).toBeInTheDocument();
  });

  it('shows email and password inputs on the log in form', () => {
    render(<Onboarding />);
    fireEvent.click(screen.getByText('Log in'));
    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
  });
});

// ─── Navigation — back to landing ────────────────────────────────────────────

describe('Onboarding — back navigation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns to the landing screen when "Back" is clicked from sign up', () => {
    render(<Onboarding />);
    fireEvent.click(screen.getByText('Sign up with Email'));
    fireEvent.click(screen.getByText(/Back/i));
    expect(screen.getByText('PlantPatrol')).toBeInTheDocument();
    expect(screen.getByText('Continue with Google')).toBeInTheDocument();
  });
});

// ─── Firebase not configured error ───────────────────────────────────────────

describe('Onboarding — Firebase not configured', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows an error message when Google sign-in is attempted without Firebase config', () => {
    render(<Onboarding />);
    fireEvent.click(screen.getByText('Continue with Google'));
    expect(
      screen.getByText(/Firebase is not configured/i)
    ).toBeInTheDocument();
  });
});

// ─── Form validation ──────────────────────────────────────────────────────────

describe('Onboarding — form validation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows a Firebase error when submitting without config (auth is null)', async () => {
    render(<Onboarding />);
    fireEvent.click(screen.getByText('Sign up with Email'));
    
    // Find the form and submit it
    const emailInput = screen.getByPlaceholderText('you@example.com');
    const form = emailInput.closest('form')!;
    fireEvent.submit(form);
    
    expect(await screen.findByText(/Firebase is not configured/i)).toBeInTheDocument();
  });
});

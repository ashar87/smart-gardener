/**
 * Component tests for SettingsView.tsx
 * AuthContext is mocked via vi.mock with a self-contained factory.
 * motion/react is mocked so Framer Motion doesn't block renders.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// ─── Mock motion/react (must be before component import) ─────────────────────
vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, className, style, ...rest }: any) =>
      <div className={className} style={style} {...rest}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// ─── Mock AuthContext with self-contained factory ─────────────────────────────
// The factory is hoisted by Vitest, so we use globalThis to share the logout fn.
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    currentUser: {
      uid: 'u1',
      email: 'test@example.com',
      displayName: 'Alice Gardener',
    },
    logout: (globalThis as any).__mockSettingsLogout || (() => Promise.resolve()),
  }),
}));

// Set the shared logout fn (runs after hoisting, before tests)
const mockLogout = vi.fn().mockResolvedValue(undefined);
(globalThis as any).__mockSettingsLogout = mockLogout;

import SettingsView from './SettingsView';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderSettings(notificationsEnabled = false, onToggle = vi.fn()) {
  return render(
    <SettingsView
      notificationsEnabled={notificationsEnabled}
      onToggleNotifications={onToggle}
    />
  );
}

// ─── Rendering ────────────────────────────────────────────────────────────────

describe('SettingsView — rendering', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the Settings heading', () => {
    renderSettings();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('displays the user display name', () => {
    renderSettings();
    expect(screen.getByText('Alice Gardener')).toBeInTheDocument();
  });

  it('displays the current user email', () => {
    renderSettings();
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
  });

  it('renders app version and AI info text', () => {
    renderSettings();
    expect(screen.getByText(/Powered by Gemini AI/i)).toBeInTheDocument();
  });

  it('renders the Cloud Sync info', () => {
    renderSettings();
    expect(screen.getByText(/securely stored on Firebase/i)).toBeInTheDocument();
  });

  it('renders the sign out button with id="sign-out-btn"', () => {
    renderSettings();
    expect(document.getElementById('sign-out-btn')).toBeInTheDocument();
  });

  it('renders the notification toggle with id="notifications-toggle"', () => {
    renderSettings();
    expect(document.getElementById('notifications-toggle')).toBeInTheDocument();
  });
});

// ─── Notification toggle ──────────────────────────────────────────────────────

describe('SettingsView — notification toggle', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows "Watering Reminders" label', () => {
    renderSettings();
    expect(screen.getByText('Watering Reminders')).toBeInTheDocument();
  });

  it('calls onToggleNotifications when the toggle is clicked', () => {
    const onToggle = vi.fn();
    renderSettings(false, onToggle);
    fireEvent.click(document.getElementById('notifications-toggle')!);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('calls onToggleNotifications twice when clicked twice', () => {
    const onToggle = vi.fn();
    renderSettings(true, onToggle);
    const toggle = document.getElementById('notifications-toggle')!;
    fireEvent.click(toggle);
    fireEvent.click(toggle);
    expect(onToggle).toHaveBeenCalledTimes(2);
  });
});

// ─── Sign out ─────────────────────────────────────────────────────────────────

describe('SettingsView — sign out', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the "Sign Out" text', () => {
    renderSettings();
    expect(screen.getByText('Sign Out')).toBeInTheDocument();
  });

  it('calls logout when sign out button is clicked', () => {
    renderSettings();
    fireEvent.click(document.getElementById('sign-out-btn')!);
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });
});

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import BottomNav from '../components/BottomNav';
import type { Tab } from '../components/BottomNav';

// ─── BottomNav Component Tests ────────────────────────────────────────────────

describe('BottomNav', () => {
  const defaultProps = {
    activeTab: 'garden' as Tab,
    onTabChange: vi.fn(),
  };

  it('renders all 3 navigation tabs', () => {
    render(<BottomNav {...defaultProps} />);
    expect(screen.getByLabelText('Garden')).toBeInTheDocument();
    expect(screen.getByLabelText('Calendar')).toBeInTheDocument();
    expect(screen.getByLabelText('Settings')).toBeInTheDocument();
  });

  it('marks the active tab with aria-selected=true', () => {
    render(<BottomNav {...defaultProps} activeTab="calendar" />);
    expect(screen.getByLabelText('Calendar')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText('Garden')).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByLabelText('Settings')).toHaveAttribute('aria-selected', 'false');
  });

  it('calls onTabChange with "garden" when Garden tab is clicked', () => {
    const onTabChange = vi.fn();
    render(<BottomNav {...defaultProps} onTabChange={onTabChange} />);
    fireEvent.click(screen.getByLabelText('Garden'));
    expect(onTabChange).toHaveBeenCalledWith('garden');
    expect(onTabChange).toHaveBeenCalledTimes(1);
  });

  it('calls onTabChange with "calendar" when Calendar tab is clicked', () => {
    const onTabChange = vi.fn();
    render(<BottomNav {...defaultProps} onTabChange={onTabChange} />);
    fireEvent.click(screen.getByLabelText('Calendar'));
    expect(onTabChange).toHaveBeenCalledWith('calendar');
  });

  it('calls onTabChange with "settings" when Settings tab is clicked', () => {
    const onTabChange = vi.fn();
    render(<BottomNav {...defaultProps} onTabChange={onTabChange} />);
    fireEvent.click(screen.getByLabelText('Settings'));
    expect(onTabChange).toHaveBeenCalledWith('settings');
  });

  it('renders the nav element with id "bottom-nav"', () => {
    render(<BottomNav {...defaultProps} />);
    expect(document.getElementById('bottom-nav')).toBeInTheDocument();
  });

  it('renders with correct tab IDs', () => {
    render(<BottomNav {...defaultProps} />);
    expect(document.getElementById('nav-tab-garden')).toBeInTheDocument();
    expect(document.getElementById('nav-tab-calendar')).toBeInTheDocument();
    expect(document.getElementById('nav-tab-settings')).toBeInTheDocument();
  });

  it('does not crash when the same active tab is clicked again', () => {
    const onTabChange = vi.fn();
    render(<BottomNav activeTab="garden" onTabChange={onTabChange} />);
    fireEvent.click(screen.getByLabelText('Garden'));
    expect(onTabChange).toHaveBeenCalledWith('garden');
  });
});

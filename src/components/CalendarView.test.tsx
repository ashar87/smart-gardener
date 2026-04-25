/**
 * Component tests for CalendarView.tsx
 *
 * Uses fixed timestamps so watering group classification is deterministic.
 * motion/react is mocked so Framer Motion doesn't interfere with renders.
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import CalendarView from './CalendarView';
import { Plant } from '../types';

// ─── Mock framer-motion so animations don't block testing ─────────────────────
vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// ─── Fix "now" so grouping is deterministic ───────────────────────────────────
// All tests run as if today is 2024-06-15 at noon UTC
const NOW = new Date('2024-06-15T12:00:00Z').getTime();

beforeAll(() => {
  vi.setSystemTime(NOW);
});

function daysFromNow(days: number): number {
  const d = new Date(NOW);
  d.setDate(d.getDate() + days);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function makePlant(id: string, commonName: string, nextWatered: number): Plant {
  return {
    id,
    species: 'Testus plantus',
    commonName,
    image: '',
    addedAt: NOW,
    healthStatus: { status: 'healthy', assessment: 'Good', issues: [] },
    careSchedule: {
      watering: { frequency: 'Weekly', lastWatered: NOW, nextWatered },
      sunlight: 'Indirect light',
    },
    history: [],
    growthLog: [],
  };
}

// ─── Empty state ──────────────────────────────────────────────────────────────

describe('CalendarView — empty state', () => {
  it('shows "No plants added yet" when plant list is empty', () => {
    render(<CalendarView plants={[]} onWaterPlant={vi.fn()} onPlantClick={vi.fn()} />);
    expect(screen.getByText('No plants added yet')).toBeInTheDocument();
  });

  it('shows "Switch to Garden" hint when empty', () => {
    render(<CalendarView plants={[]} onWaterPlant={vi.fn()} onPlantClick={vi.fn()} />);
    expect(screen.getByText(/Switch to Garden/i)).toBeInTheDocument();
  });

  it('shows "All plants are up to date" when all are upcoming', () => {
    const plant = makePlant('p1', 'Monstera', daysFromNow(5));
    render(<CalendarView plants={[plant]} onWaterPlant={vi.fn()} onPlantClick={vi.fn()} />);
    expect(screen.getByText(/All plants are up to date/i)).toBeInTheDocument();
  });
});

// ─── Header summary ───────────────────────────────────────────────────────────

describe('CalendarView — header summary', () => {
  it('always renders the "Watering Schedule" heading', () => {
    render(<CalendarView plants={[]} onWaterPlant={vi.fn()} onPlantClick={vi.fn()} />);
    expect(screen.getByRole('heading', { name: /Watering Schedule/i })).toBeInTheDocument();
  });

  it('shows singular "1 plant needs water today" for one overdue plant', () => {
    const plant = makePlant('p1', 'Cactus', daysFromNow(-1));
    render(<CalendarView plants={[plant]} onWaterPlant={vi.fn()} onPlantClick={vi.fn()} />);
    expect(screen.getByText('1 plant needs water today')).toBeInTheDocument();
  });

  it('shows plural "3 plants need water today" for multiple due plants', () => {
    const plants = [
      makePlant('p1', 'Cactus', daysFromNow(-2)),
      makePlant('p2', 'Fern', daysFromNow(0)),
      makePlant('p3', 'Rose', daysFromNow(-1)),
    ];
    render(<CalendarView plants={plants} onWaterPlant={vi.fn()} onPlantClick={vi.fn()} />);
    expect(screen.getByText('3 plants need water today')).toBeInTheDocument();
  });
});

// ─── Group section headers ────────────────────────────────────────────────────

describe('CalendarView — group section headers', () => {
  it('renders the "Overdue" group when there are overdue plants', () => {
    const plant = makePlant('p1', 'Orchid', daysFromNow(-3));
    render(<CalendarView plants={[plant]} onWaterPlant={vi.fn()} onPlantClick={vi.fn()} />);
    expect(screen.getByText('Overdue')).toBeInTheDocument();
  });

  it('renders the "Today" group when a plant is due today', () => {
    const plant = makePlant('p1', 'Basil', daysFromNow(0));
    render(<CalendarView plants={[plant]} onWaterPlant={vi.fn()} onPlantClick={vi.fn()} />);
    expect(screen.getByText('Today')).toBeInTheDocument();
  });

  it('renders the "Tomorrow" group for plants due tomorrow', () => {
    const plant = makePlant('p1', 'Lavender', daysFromNow(1));
    render(<CalendarView plants={[plant]} onWaterPlant={vi.fn()} onPlantClick={vi.fn()} />);
    expect(screen.getByText('Tomorrow')).toBeInTheDocument();
  });

  it('renders the "Upcoming" group for plants due in 2+ days', () => {
    const plant = makePlant('p1', 'Succulent', daysFromNow(7));
    render(<CalendarView plants={[plant]} onWaterPlant={vi.fn()} onPlantClick={vi.fn()} />);
    expect(screen.getByText('Upcoming')).toBeInTheDocument();
  });

  it('does not render empty group headers', () => {
    // Only an upcoming plant — no overdue/today/tomorrow groups should appear
    const plant = makePlant('p1', 'Jade', daysFromNow(10));
    render(<CalendarView plants={[plant]} onWaterPlant={vi.fn()} onPlantClick={vi.fn()} />);
    expect(screen.queryByText('Overdue')).not.toBeInTheDocument();
    expect(screen.queryByText('Today')).not.toBeInTheDocument();
    expect(screen.queryByText('Tomorrow')).not.toBeInTheDocument();
  });
});

// ─── Plant card display ───────────────────────────────────────────────────────

describe('CalendarView — plant card content', () => {
  it('renders the plant common name', () => {
    const plant = makePlant('p1', 'Monstera Deliciosa', daysFromNow(0));
    render(<CalendarView plants={[plant]} onWaterPlant={vi.fn()} onPlantClick={vi.fn()} />);
    expect(screen.getByText('Monstera Deliciosa')).toBeInTheDocument();
  });

  it('shows "Due today" for a plant due today', () => {
    const plant = makePlant('p1', 'Fern', daysFromNow(0));
    render(<CalendarView plants={[plant]} onWaterPlant={vi.fn()} onPlantClick={vi.fn()} />);
    expect(screen.getByText('Due today')).toBeInTheDocument();
  });

  it('shows "X days overdue" for an overdue plant', () => {
    const plant = makePlant('p1', 'Cactus', daysFromNow(-3));
    render(<CalendarView plants={[plant]} onWaterPlant={vi.fn()} onPlantClick={vi.fn()} />);
    expect(screen.getByText('3 days overdue')).toBeInTheDocument();
  });

  it('shows "1 day overdue" (singular) for a plant 1 day overdue', () => {
    const plant = makePlant('p1', 'Rose', daysFromNow(-1));
    render(<CalendarView plants={[plant]} onWaterPlant={vi.fn()} onPlantClick={vi.fn()} />);
    expect(screen.getByText('1 day overdue')).toBeInTheDocument();
  });

  it('shows "In X days" for upcoming plants', () => {
    const plant = makePlant('p1', 'Aloe', daysFromNow(5));
    render(<CalendarView plants={[plant]} onWaterPlant={vi.fn()} onPlantClick={vi.fn()} />);
    expect(screen.getByText('In 5 days')).toBeInTheDocument();
  });

  it('renders a Water button with the correct aria-label', () => {
    const plant = makePlant('p1', 'Lavender', daysFromNow(0));
    render(<CalendarView plants={[plant]} onWaterPlant={vi.fn()} onPlantClick={vi.fn()} />);
    expect(screen.getByLabelText('Water Lavender')).toBeInTheDocument();
  });

  it('renders the Water button with id water-btn-{plantId}', () => {
    const plant = makePlant('abc123', 'Monstera', daysFromNow(-1));
    render(<CalendarView plants={[plant]} onWaterPlant={vi.fn()} onPlantClick={vi.fn()} />);
    expect(document.getElementById('water-btn-abc123')).toBeInTheDocument();
  });
});

// ─── Interactions ─────────────────────────────────────────────────────────────

describe('CalendarView — interactions', () => {
  it('calls onWaterPlant with the plant ID when Water button is clicked', () => {
    const onWaterPlant = vi.fn();
    const plant = makePlant('p1', 'Basil', daysFromNow(0));
    render(<CalendarView plants={[plant]} onWaterPlant={onWaterPlant} onPlantClick={vi.fn()} />);

    fireEvent.click(screen.getByLabelText('Water Basil'));

    expect(onWaterPlant).toHaveBeenCalledWith('p1');
    expect(onWaterPlant).toHaveBeenCalledTimes(1);
  });

  it('calls onPlantClick with the full plant when the card is clicked', () => {
    const onPlantClick = vi.fn();
    const plant = makePlant('p1', 'Orchid', daysFromNow(-1));
    render(<CalendarView plants={[plant]} onWaterPlant={vi.fn()} onPlantClick={onPlantClick} />);

    fireEvent.click(screen.getByText('Orchid'));

    expect(onPlantClick).toHaveBeenCalledWith(plant);
  });

  it('does NOT call onPlantClick when the Water button is clicked (stopPropagation)', () => {
    const onPlantClick = vi.fn();
    const onWaterPlant = vi.fn();
    const plant = makePlant('p1', 'Fern', daysFromNow(-1));
    render(<CalendarView plants={[plant]} onWaterPlant={onWaterPlant} onPlantClick={onPlantClick} />);

    fireEvent.click(screen.getByLabelText('Water Fern'));

    expect(onPlantClick).not.toHaveBeenCalled();
    expect(onWaterPlant).toHaveBeenCalledTimes(1);
  });
});

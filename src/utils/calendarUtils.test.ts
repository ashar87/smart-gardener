import { describe, it, expect } from 'vitest';
import {
  getDaysUntilWatering,
  getWateringGroup,
  groupPlantsByWateringSchedule,
  filterPlantsByLocation,
  parseFrequencyToDays,
  calculateNextSeasonalCareDate,
} from '../utils/calendarUtils';
import { Plant } from '../types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const NOW = new Date('2024-06-15T12:00:00Z').getTime(); // Fixed reference point

function daysFromNow(days: number): number {
  const d = new Date(NOW);
  d.setDate(d.getDate() + days);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function makePlant(
  id: string,
  nextWatered: number,
  location?: 'indoor' | 'outdoor'
): Plant {
  return {
    id,
    species: 'Testus plantus',
    commonName: 'Test Plant',
    image: '',
    addedAt: NOW,
    location,
    healthStatus: { status: 'healthy', assessment: 'Good', issues: [] },
    careSchedule: {
      watering: { frequency: 'Weekly', lastWatered: NOW, nextWatered },
      sunlight: 'Medium light',
    },
    history: [],
    growthLog: [],
  };
}

// ─── getDaysUntilWatering ────────────────────────────────────────────────────

describe('getDaysUntilWatering', () => {
  it('returns 0 for a plant due today', () => {
    const todayNoon = new Date(NOW);
    todayNoon.setHours(14, 0, 0, 0); // different time, same day
    expect(getDaysUntilWatering(todayNoon.getTime(), NOW)).toBe(0);
  });

  it('returns 1 for a plant due tomorrow', () => {
    expect(getDaysUntilWatering(daysFromNow(1), NOW)).toBe(1);
  });

  it('returns -1 for a plant overdue by 1 day', () => {
    expect(getDaysUntilWatering(daysFromNow(-1), NOW)).toBe(-1);
  });

  it('returns 7 for a plant due in a week', () => {
    expect(getDaysUntilWatering(daysFromNow(7), NOW)).toBe(7);
  });

  it('returns -5 for a plant overdue by 5 days', () => {
    expect(getDaysUntilWatering(daysFromNow(-5), NOW)).toBe(-5);
  });
});

// ─── getWateringGroup ────────────────────────────────────────────────────────

describe('getWateringGroup', () => {
  it('classifies negative days as overdue', () => {
    expect(getWateringGroup(-3)).toBe('overdue');
    expect(getWateringGroup(-1)).toBe('overdue');
  });

  it('classifies 0 days as today', () => {
    expect(getWateringGroup(0)).toBe('today');
  });

  it('classifies 1 day as tomorrow', () => {
    expect(getWateringGroup(1)).toBe('tomorrow');
  });

  it('classifies 2+ days as upcoming', () => {
    expect(getWateringGroup(2)).toBe('upcoming');
    expect(getWateringGroup(14)).toBe('upcoming');
  });
});

// ─── groupPlantsByWateringSchedule ──────────────────────────────────────────

describe('groupPlantsByWateringSchedule', () => {
  const plants = [
    makePlant('overdue-5', daysFromNow(-5)),
    makePlant('overdue-1', daysFromNow(-1)),
    makePlant('today', daysFromNow(0)),
    makePlant('tomorrow', daysFromNow(1)),
    makePlant('upcoming-3', daysFromNow(3)),
    makePlant('upcoming-10', daysFromNow(10)),
  ];

  const groups = groupPlantsByWateringSchedule(plants, NOW);

  it('places overdue plants in the overdue group', () => {
    expect(groups.overdue).toHaveLength(2);
    expect(groups.overdue.map(p => p.plant.id)).toContain('overdue-5');
    expect(groups.overdue.map(p => p.plant.id)).toContain('overdue-1');
  });

  it('sorts overdue plants most overdue first', () => {
    expect(groups.overdue[0].plant.id).toBe('overdue-5');
    expect(groups.overdue[1].plant.id).toBe('overdue-1');
  });

  it('places today plants in the today group', () => {
    expect(groups.today).toHaveLength(1);
    expect(groups.today[0].plant.id).toBe('today');
  });

  it('places tomorrow plants in the tomorrow group', () => {
    expect(groups.tomorrow).toHaveLength(1);
    expect(groups.tomorrow[0].plant.id).toBe('tomorrow');
  });

  it('places future plants in the upcoming group and sorts them', () => {
    expect(groups.upcoming).toHaveLength(2);
    expect(groups.upcoming[0].plant.id).toBe('upcoming-3');
    expect(groups.upcoming[1].plant.id).toBe('upcoming-10');
  });

  it('returns empty groups when there are no plants', () => {
    const empty = groupPlantsByWateringSchedule([], NOW);
    expect(empty.overdue).toHaveLength(0);
    expect(empty.today).toHaveLength(0);
    expect(empty.tomorrow).toHaveLength(0);
    expect(empty.upcoming).toHaveLength(0);
  });
});

// ─── filterPlantsByLocation ──────────────────────────────────────────────────

describe('filterPlantsByLocation', () => {
  const plants = [
    makePlant('a', NOW, 'indoor'),
    makePlant('b', NOW, 'indoor'),
    makePlant('c', NOW, 'outdoor'),
    makePlant('d', NOW, undefined), // untagged
  ];

  it('returns all plants for "all" filter', () => {
    expect(filterPlantsByLocation(plants, 'all')).toHaveLength(4);
  });

  it('returns only indoor plants', () => {
    const result = filterPlantsByLocation(plants, 'indoor');
    expect(result).toHaveLength(2);
    expect(result.map(p => p.id)).toEqual(['a', 'b']);
  });

  it('returns only outdoor plants', () => {
    const result = filterPlantsByLocation(plants, 'outdoor');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('c');
  });

  it('does not include untagged plants when filtering by indoor/outdoor', () => {
    const indoor = filterPlantsByLocation(plants, 'indoor');
    const outdoor = filterPlantsByLocation(plants, 'outdoor');
    expect(indoor.find(p => p.id === 'd')).toBeUndefined();
  });
});

// ─── parseFrequencyToDays ────────────────────────────────────────────────────

describe('parseFrequencyToDays', () => {
  it('extracts explicit day counts', () => {
    expect(parseFrequencyToDays('Every 3 days')).toBe(3);
    expect(parseFrequencyToDays('every 14 days')).toBe(14);
    expect(parseFrequencyToDays('Water every 5 days')).toBe(5);
  });

  it('matches week strings', () => {
    expect(parseFrequencyToDays('Twice a week')).toBe(3);
    expect(parseFrequencyToDays('Weekly')).toBe(7);
    expect(parseFrequencyToDays('Once a week')).toBe(7);
    expect(parseFrequencyToDays('Bi-weekly')).toBe(14);
    expect(parseFrequencyToDays('Every 2 weeks')).toBe(14);
  });

  it('matches month strings', () => {
    expect(parseFrequencyToDays('Monthly')).toBe(30);
    expect(parseFrequencyToDays('Once a month')).toBe(30);
  });

  it('matches daily strings', () => {
    expect(parseFrequencyToDays('Daily')).toBe(1);
    expect(parseFrequencyToDays('Water every day')).toBe(1);
  });

  it('falls back to 7 days for unparseable or empty strings', () => {
    expect(parseFrequencyToDays('Whenever the soil feels dry')).toBe(7);
    expect(parseFrequencyToDays('')).toBe(7);
    expect(parseFrequencyToDays('Unknown')).toBe(7);
  });
});

// ─── calculateNextSeasonalCareDate ──────────────────────────────────────────

describe('calculateNextSeasonalCareDate', () => {
  const activeMonths = [3, 4, 5, 6, 7, 8]; // March through August
  
  it('returns the standard next date if it falls within an active month', () => {
    // May 1st
    const lastCompleted = new Date('2024-05-01T10:00:00.000Z').getTime();
    const frequencyDays = 30;
    
    // Expected: ~May 31st
    const nextDate = new Date(calculateNextSeasonalCareDate(lastCompleted, frequencyDays, activeMonths));
    expect(nextDate.getMonth() + 1).toBe(5); // Still May, which is active
  });

  it('jumps to the next active month if the calculated date falls outside the active season', () => {
    // August 15th
    const lastCompleted = new Date('2024-08-15T10:00:00.000Z').getTime();
    const frequencyDays = 30;
    
    // Calculated date is Sept 14th. Sept (9) is not active.
    // It should jump to March 1st of the next year (2025).
    const nextDate = new Date(calculateNextSeasonalCareDate(lastCompleted, frequencyDays, activeMonths));
    
    expect(nextDate.getFullYear()).toBe(2025);
    expect(nextDate.getMonth() + 1).toBe(3); // March
    expect(nextDate.getDate()).toBe(1);
    expect(nextDate.getHours()).toBe(new Date(lastCompleted).getHours()); // preserves hour
  });

  it('jumps forward within the same year if there is a gap in active months', () => {
    // E.g., fertilize in Spring (3,4,5) and Fall (9,10,11)
    const splitSeasons = [3, 4, 5, 9, 10, 11];
    
    // May 15th + 30 days = June 14th. June (6) is not active.
    const lastCompleted = new Date('2024-05-15T10:00:00.000Z').getTime();
    
    // Next active month is September (9). So it should jump to Sept 1, 2024.
    const nextDate = new Date(calculateNextSeasonalCareDate(lastCompleted, 30, splitSeasons));
    
    expect(nextDate.getFullYear()).toBe(2024);
    expect(nextDate.getMonth() + 1).toBe(9);
    expect(nextDate.getDate()).toBe(1);
  });
  
  it('falls back to simple calculation if activeMonths is empty', () => {
    const lastCompleted = new Date('2024-05-01T10:00:00.000Z').getTime();
    const frequencyDays = 30;
    
    const nextDate = new Date(calculateNextSeasonalCareDate(lastCompleted, frequencyDays, []));
    expect(nextDate.getTime()).toBe(lastCompleted + 30 * 24 * 60 * 60 * 1000);
  });
});

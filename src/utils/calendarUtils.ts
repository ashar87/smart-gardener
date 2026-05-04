/**
 * Calendar utility functions for grouping plants by watering schedule.
 * Pure functions — no React, no Firebase. Easily testable.
 */

import { Plant } from '../types';

export type WateringGroup = 'overdue' | 'today' | 'tomorrow' | 'upcoming';

export interface PlantWithDaysUntilWater {
  plant: Plant;
  daysUntil: number;
  group: WateringGroup;
}

/**
 * Returns the number of whole calendar days between now (start of today)
 * and the nextWatered timestamp. Negative = overdue.
 */
export function getDaysUntilWatering(nextWateredTimestamp: number, now = Date.now()): number {
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const targetStart = new Date(nextWateredTimestamp);
  targetStart.setHours(0, 0, 0, 0);

  const diffMs = targetStart.getTime() - todayStart.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Classifies a day offset into a watering group label.
 */
export function getWateringGroup(daysUntil: number): WateringGroup {
  if (daysUntil < 0) return 'overdue';
  if (daysUntil === 0) return 'today';
  if (daysUntil === 1) return 'tomorrow';
  return 'upcoming';
}

/**
 * Takes an array of plants and returns them sorted and annotated
 * for the Calendar view. Overdue plants are shown first.
 */
export function groupPlantsByWateringSchedule(
  plants: Plant[],
  now = Date.now()
): Record<WateringGroup, PlantWithDaysUntilWater[]> {
  const result: Record<WateringGroup, PlantWithDaysUntilWater[]> = {
    overdue: [],
    today: [],
    tomorrow: [],
    upcoming: [],
  };

  for (const plant of plants) {
    const daysUntil = getDaysUntilWatering(plant.careSchedule.watering.nextWatered, now);
    const group = getWateringGroup(daysUntil);
    result[group].push({ plant, daysUntil, group });
  }

  // Sort each group: most overdue first, then soonest upcoming
  result.overdue.sort((a, b) => a.daysUntil - b.daysUntil);
  result.upcoming.sort((a, b) => a.daysUntil - b.daysUntil);

  return result;
}

/**
 * Filters a plant list by location tag.
 * 'all' returns the full list.
 */
export function filterPlantsByLocation(
  plants: Plant[],
  filter: 'all' | 'indoor' | 'outdoor'
): Plant[] {
  if (filter === 'all') return plants;
  return plants.filter(p => p.location === filter);
}

/**
 * Parses a natural language frequency string (e.g. from Gemini AI) into a number of days.
 * Defaults to 7 days if the string cannot be parsed.
 */
export function parseFrequencyToDays(frequencyString: string): number {
  if (!frequencyString) return 7;
  
  const lower = frequencyString.toLowerCase();

  // Explicit day counts
  const dayMatch = lower.match(/every (\d+) days?/);
  if (dayMatch && dayMatch[1]) {
    return parseInt(dayMatch[1], 10);
  }

  // Week matching - check bi-weekly first so 'weekly' doesn't greedily match it
  if (lower.includes('bi-weekly') || lower.includes('every 2 weeks') || lower.includes('every two weeks')) return 14;
  if (lower.includes('twice a week') || lower.includes('2 times a week')) return 3;
  if (lower.includes('weekly') || lower.includes('once a week') || lower.includes('every week')) return 7;
  
  // Month matching
  if (lower.includes('monthly') || lower.includes('once a month') || lower.includes('every month')) return 30;
  
  // Daily matching
  if (lower.includes('daily') || lower.includes('every day')) return 1;

  // Fallback
  return 7;
}

/**
 * Calculates the next seasonal care date (e.g. fertilizing) based on the last completed date, 
 * the frequency in days, and the active months (1-12).
 * If the calculated date falls in an active month, it returns that date.
 * If it falls in an inactive month, it fast-forwards to the 1st day of the next active month.
 */
export function calculateNextSeasonalCareDate(
  lastCompleted: number,
  frequencyDays: number,
  activeMonths: number[]
): number {
  if (!activeMonths || activeMonths.length === 0) {
    // Fallback if no active months are provided
    return lastCompleted + frequencyDays * 24 * 60 * 60 * 1000;
  }

  // Calculate the simple next date
  const nextDate = new Date(lastCompleted + frequencyDays * 24 * 60 * 60 * 1000);
  const nextMonth = nextDate.getMonth() + 1; // 1-12

  if (activeMonths.includes(nextMonth)) {
    return nextDate.getTime();
  }

  // Not in an active month, so find the *next* active month chronologically
  const sortedMonths = [...activeMonths].sort((a, b) => a - b);
  
  // Find the first active month that comes after our target month
  let targetMonth = sortedMonths.find(m => m > nextMonth);
  let targetYear = nextDate.getFullYear();

  if (targetMonth === undefined) {
    // If we're past all active months for this year (e.g., it's October, active is [3,4,5]),
    // we wrap around to the first active month of the NEXT year.
    targetMonth = sortedMonths[0];
    targetYear += 1;
  }

  // Set the date to the 1st of the target month
  const adjustedDate = new Date(targetYear, targetMonth - 1, 1);
  // Keep the same time of day as the original calculation
  adjustedDate.setHours(nextDate.getHours(), nextDate.getMinutes(), 0, 0);

  return adjustedDate.getTime();
}

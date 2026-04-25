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

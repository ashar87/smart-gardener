/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Plant, SeasonalCare } from '../types';
import { syncPlantToCloud } from '../services/cloudSync';

/**
 * Migrates a plant's legacy string-based care schedules to the new SeasonalCare objects.
 * Assumes a default 30-day frequency and year-round active months (1-12) for legacy data
 * since the AI didn't provide specific season data previously.
 */
export const migratePlantCareSchedule = (plant: Plant): Plant => {
  let migrated = false;
  const newPlant = { ...plant, careSchedule: { ...plant.careSchedule } };

  if (typeof plant.careSchedule.fertilizer === 'string') {
    const legacyText = plant.careSchedule.fertilizer;
    newPlant.careSchedule.fertilizer = {
      instructions: legacyText,
      frequencyDays: 30, // Default to monthly
      activeMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], // Default to year-round
      lastCompleted: Date.now(),
      nextScheduled: Date.now() + 30 * 24 * 60 * 60 * 1000
    };
    migrated = true;
  }

  if (typeof plant.careSchedule.pruning === 'string') {
    const legacyText = plant.careSchedule.pruning;
    newPlant.careSchedule.pruning = {
      instructions: legacyText,
      frequencyDays: 90, // Default to quarterly
      activeMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], // Default to year-round
      lastCompleted: Date.now(),
      nextScheduled: Date.now() + 90 * 24 * 60 * 60 * 1000
    };
    migrated = true;
  }

  return migrated ? newPlant : plant;
};

/**
 * Iterates through all plants for a given user and syncs any migrated ones to the cloud.
 */
export const migrateAllPlants = async (userId: string, plants: Plant[]): Promise<number> => {
  let migratedCount = 0;
  
  for (const plant of plants) {
    const migratedPlant = migratePlantCareSchedule(plant);
    if (migratedPlant !== plant) {
      await syncPlantToCloud(userId, migratedPlant);
      migratedCount++;
    }
  }

  return migratedCount;
};

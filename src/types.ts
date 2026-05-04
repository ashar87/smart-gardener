/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Plant {
  id: string;
  species: string;
  commonName: string;
  image: string;
  addedAt: number;
  location?: 'indoor' | 'outdoor';
  healthStatus: PlantHealth;
  careSchedule: CareSchedule;
  history: CareEvent[];
  growthLog: GrowthMilestone[];
  reminders?: {
    watering: boolean;
    pruningFertilizing: boolean;
    lastNotifiedAt?: number;
  };
}

export interface GrowthMilestone {
  id: string;
  image: string;
  timestamp: number;
  analysis: {
    status: string;
    description: string;
    growthDetected: boolean;
  };
}

export interface CareEvent {
  id: string;
  type: 'watering' | 'fertilizing' | 'pruning' | 'health_check';
  timestamp: number;
  note?: string;
}

export interface PlantHealth {
  status: 'healthy' | 'warning' | 'critical';
  assessment: string;
  issues: string[];
}

export interface CareSchedule {
  watering: {
    frequency: string;
    lastWatered: number;
    nextWatered: number;
  };
  sunlight: string;
  fertilizer?: string;
  pruning?: string;
}

export interface IdentificationResult {
  isPlant: boolean;
  species: string;
  commonName: string;
  confidence: number;
  location: 'indoor' | 'outdoor';
  health: PlantHealth;
  careSuggestions: Partial<CareSchedule>;
}

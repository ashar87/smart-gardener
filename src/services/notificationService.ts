/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { Plant } from '../types';

export const requestNotificationPermission = async (): Promise<boolean> => {
  if (Capacitor.isNativePlatform()) {
    const { display } = await LocalNotifications.requestPermissions();
    return display === 'granted';
  } else {
    // Web fallback
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications.');
      return false;
    }
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }
};

export const scheduleWateringNotification = async (plant: Plant, enabled: boolean) => {
  // First, always cancel any existing notification for this plant to avoid duplicates
  await cancelWateringNotification(plant.id);

  if (!enabled || !plant.reminders?.watering) return;

  const nextWaterTime = new Date(plant.careSchedule.watering.nextWatered);
  const now = new Date();

  // Only schedule if the time is in the future
  if (nextWaterTime.getTime() > now.getTime()) {
    if (Capacitor.isNativePlatform()) {
      await LocalNotifications.schedule({
        notifications: [
          {
            title: 'Watering Reminder',
            body: `Your ${plant.commonName} needs water!`,
            id: getNotificationId(plant.id, 'watering'),
            schedule: { at: nextWaterTime },
            sound: undefined,
            attachments: null,
            actionTypeId: '',
            extra: null
          }
        ]
      });
    } else {
      // Web fallback: Since web doesn't support background scheduling natively without a service worker,
      // we can simulate it with a timeout if the app is still open, or rely on the user having 
      // the app open. This is a naive web fallback.
      const delay = nextWaterTime.getTime() - now.getTime();
      if (delay < 2147483647) { // Max setTimeout delay
        setTimeout(() => {
          if (Notification.permission === 'granted') {
            new Notification('Watering Reminder', {
              body: `Your ${plant.commonName} needs water!`,
              icon: '/favicon.ico',
            });
          }
        }, delay);
      }
    }
  }
};

export const cancelWateringNotification = async (plantId: string) => {
  if (Capacitor.isNativePlatform()) {
    const id = getNotificationId(plantId, 'watering');
    await LocalNotifications.cancel({ notifications: [{ id }] });
  }
};

const getNotificationId = (plantId: string, type: 'watering' | 'fertilizing' | 'pruning'): number => {
  const baseId = plantId.charCodeAt(0) + plantId.charCodeAt(plantId.length - 1);
  if (type === 'fertilizing') return baseId + 10000;
  if (type === 'pruning') return baseId + 20000;
  return baseId; // watering
};

export const scheduleSeasonalNotification = async (plant: Plant, type: 'fertilizing' | 'pruning', enabled: boolean) => {
  await cancelSeasonalNotification(plant.id, type);

  if (!enabled || !plant.reminders?.pruningFertilizing) return;

  const seasonalCare = type === 'fertilizing' ? plant.careSchedule.fertilizer : plant.careSchedule.pruning;
  if (typeof seasonalCare !== 'object' || !seasonalCare.nextScheduled) return;

  const nextTime = new Date(seasonalCare.nextScheduled);
  const now = new Date();

  if (nextTime.getTime() > now.getTime()) {
    const title = type === 'fertilizing' ? 'Fertilizing Reminder' : 'Pruning Reminder';
    const action = type === 'fertilizing' ? 'needs fertilizer' : 'needs pruning';
    
    if (Capacitor.isNativePlatform()) {
      await LocalNotifications.schedule({
        notifications: [{
          title,
          body: `Your ${plant.commonName} ${action}!`,
          id: getNotificationId(plant.id, type),
          schedule: { at: nextTime },
        }]
      });
    } else {
      const delay = nextTime.getTime() - now.getTime();
      if (delay < 2147483647) {
        setTimeout(() => {
          if (Notification.permission === 'granted') {
            new Notification(title, { body: `Your ${plant.commonName} ${action}!`, icon: '/favicon.ico' });
          }
        }, delay);
      }
    }
  }
};

export const cancelSeasonalNotification = async (plantId: string, type: 'fertilizing' | 'pruning') => {
  if (Capacitor.isNativePlatform()) {
    const id = getNotificationId(plantId, type);
    await LocalNotifications.cancel({ notifications: [{ id }] });
  }
};


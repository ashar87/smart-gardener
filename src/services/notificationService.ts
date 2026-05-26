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
    if (display === 'granted') {
      try {
        // Register the Care Reminders notification channel with high importance
        await LocalNotifications.createChannel({
          id: 'care-reminders',
          name: 'Care Reminders',
          description: 'Notifications for watering, fertilizing, and pruning schedules.',
          importance: 4, // High importance triggers heads-up banner & system chime
          visibility: 1, // Visible on the lockscreen
          vibration: true,
        });
      } catch (e) {
        console.warn("Could not register Care Reminders channel:", e);
      }
      return true;
    }
    return false;
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
    const wateringMessage = `Time to hydrate! 💧 Your ${plant.commonName} needs some water.`;

    if (Capacitor.isNativePlatform()) {
      await LocalNotifications.schedule({
        notifications: [
          {
            title: 'Watering Reminder',
            body: wateringMessage,
            id: getNotificationId(plant.id, 'watering'),
            schedule: { at: nextWaterTime },
            channelId: 'care-reminders',
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
              body: wateringMessage,
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
    const bodyText = type === 'fertilizing'
      ? `Feed me! 🌱 Your ${plant.commonName} is ready for its fertilizer.`
      : `Time for a haircut! ✂️ Your ${plant.commonName} needs some pruning.`;
    
    if (Capacitor.isNativePlatform()) {
      await LocalNotifications.schedule({
        notifications: [{
          title,
          body: bodyText,
          id: getNotificationId(plant.id, type),
          schedule: { at: nextTime },
          channelId: 'care-reminders',
        }]
      });
    } else {
      const delay = nextTime.getTime() - now.getTime();
      if (delay < 2147483647) {
        setTimeout(() => {
          if (Notification.permission === 'granted') {
            new Notification(title, { body: bodyText, icon: '/favicon.ico' });
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


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
            id: plant.id.charCodeAt(0) + plant.id.charCodeAt(plant.id.length - 1), // Generate simple int ID
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
    const id = plantId.charCodeAt(0) + plantId.charCodeAt(plantId.length - 1);
    await LocalNotifications.cancel({ notifications: [{ id }] });
  }
};


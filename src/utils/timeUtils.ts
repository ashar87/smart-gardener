/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Takes a timestamp and a time string (e.g., "09:00") and returns a new timestamp
 * with the time set on that specific day in the local timezone.
 */
export function setTimeOnDate(timestamp: number, timeString: string): number {
  if (!timeString || !timeString.includes(':')) return timestamp;
  
  const [hours, minutes] = timeString.split(':').map(Number);
  if (isNaN(hours) || isNaN(minutes)) return timestamp;

  const date = new Date(timestamp);
  date.setHours(hours, minutes, 0, 0);
  return date.getTime();
}

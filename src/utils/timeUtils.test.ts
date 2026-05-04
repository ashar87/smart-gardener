import { describe, it, expect } from 'vitest';
import { setTimeOnDate } from '../utils/timeUtils';

describe('setTimeOnDate', () => {
  it('sets the correct time on a given date', () => {
    // 2024-06-15T12:00:00.000Z
    const baseDate = new Date('2024-06-15T12:00:00.000Z').getTime();
    
    // We expect the local time to be set to 09:30
    const updated = setTimeOnDate(baseDate, '09:30');
    const updatedDate = new Date(updated);
    
    expect(updatedDate.getHours()).toBe(9);
    expect(updatedDate.getMinutes()).toBe(30);
    expect(updatedDate.getSeconds()).toBe(0);
    expect(updatedDate.getMilliseconds()).toBe(0);
    // The day should remain the same (unless local timezone shifted it across midnight, which getHours handles implicitly)
  });

  it('handles invalid time strings gracefully', () => {
    const baseDate = new Date('2024-06-15T12:00:00.000Z').getTime();
    
    expect(setTimeOnDate(baseDate, '')).toBe(baseDate);
    expect(setTimeOnDate(baseDate, 'invalid')).toBe(baseDate);
    expect(setTimeOnDate(baseDate, '9:xx')).toBe(baseDate);
  });
});

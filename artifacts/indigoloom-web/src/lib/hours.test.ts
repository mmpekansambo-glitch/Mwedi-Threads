import { describe, expect, it } from 'vitest';
import { formatHours, hoursFromWheels, wheelsFromHours } from './hours';

describe('hours in half-hour steps', () => {
  it('reads the wheels', () => {
    expect(hoursFromWheels([12, 1])).toBe(12.5);
    expect(hoursFromWheels([3, 0])).toBe(3);
    expect(hoursFromWheels([0, 0])).toBeNull();
  });

  it('puts saved hours back on the wheels', () => {
    expect(wheelsFromHours(12.5)).toEqual([12, 1]);
    expect(wheelsFromHours(null)).toEqual([0, 0]);
  });

  it('shows hours the way people say them', () => {
    expect(formatHours(0.5)).toBe('½ hour');
    expect(formatHours(1)).toBe('1 hour');
    expect(formatHours(12.5)).toBe('12½ hours');
    expect(formatHours(40)).toBe('40 hours');
  });
});

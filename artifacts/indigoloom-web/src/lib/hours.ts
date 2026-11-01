// Hours are logged in half-hour steps: a whole-hours wheel and a half wheel.
const MAX_WHOLE_HOURS = 500;

export const hourItems = {
  whole: Array.from({ length: MAX_WHOLE_HOURS + 1 }, (_, index) => String(index)),
  half: ['+ 0', '+ ½'],
};

export function wheelsFromHours(hours: number | null): [number, number] {
  if (hours === null) return [0, 0];
  const whole = Math.min(Math.floor(hours), MAX_WHOLE_HOURS);
  return [whole, hours - whole >= 0.5 ? 1 : 0];
}

// Zero hours isn't a log, so it clears the value.
export function hoursFromWheels([whole, half]: [number, number]): number | null {
  const hours = whole + (half ? 0.5 : 0);
  return hours > 0 ? hours : null;
}

export function formatHours(hours: number): string {
  const whole = Math.floor(hours);
  const half = hours - whole >= 0.5;
  const number = `${whole === 0 && half ? '' : whole}${half ? '½' : ''}`;
  return `${number} ${hours <= 1 ? 'hour' : 'hours'}`;
}

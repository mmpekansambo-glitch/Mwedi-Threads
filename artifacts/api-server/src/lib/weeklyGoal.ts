// Week maths for the weekly crafting goal. Dates are plain YYYY-MM-DD strings
// on the maker's own calendar; weeks start on Monday.

export type Studio = "yarn" | "sewing";

const DAY_MS = 24 * 60 * 60 * 1000;

function toUtc(day: string): number {
  return Date.parse(`${day}T00:00:00Z`);
}

function fromUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function isPlainDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(toUtc(value)) && fromUtc(toUtc(value)) === value;
}

export function addDays(day: string, days: number): string {
  return fromUtc(toUtc(day) + days * DAY_MS);
}

export function mondayOf(day: string): string {
  const weekday = new Date(toUtc(day)).getUTCDay(); // 0 = Sunday
  return addDays(day, -((weekday + 6) % 7));
}

// A time zone both Node and Postgres understand, or UTC.
export function safeTimeZone(value: unknown): string {
  if (typeof value !== "string" || !value || value.length > 64 || !/^[A-Za-z0-9_+\-/]+$/.test(value)) return "UTC";
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return value;
  } catch {
    return "UTC";
  }
}

export const LOOKBACK_WEEKS = 52;

// Turns the set of crafting days into this week's squares and the run of
// weeks in a row that met the goal. Past weeks are judged against today's goal.
export function summariseWeek(activeDays: Set<string>, today: string, goal: number | null) {
  const weekStart = mondayOf(today);
  const days = Array.from({ length: 7 }, (_, index) => activeDays.has(addDays(weekStart, index)));
  const count = days.filter(Boolean).length;
  let weeksInARow = 0;
  if (goal) {
    for (let back = 1; back <= LOOKBACK_WEEKS; back += 1) {
      const start = addDays(weekStart, -7 * back);
      let met = 0;
      for (let index = 0; index < 7; index += 1) if (activeDays.has(addDays(start, index))) met += 1;
      if (met < goal) break;
      weeksInARow += 1;
    }
    if (count >= goal) weeksInARow += 1;
  }
  return { goal, weekStart, days, count, todayCounted: activeDays.has(today), weeksInARow };
}

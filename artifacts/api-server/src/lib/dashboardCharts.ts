// Builds the three dashboard charts from a maker's own rows. All dates are
// bucketed in UTC so the server and tests agree regardless of where they run.

export const projectStatuses = [
  "planning",
  "in_progress",
  "paused",
  "completed",
] as const;
export type ProjectStatus = (typeof projectStatuses)[number];

export const monthsShown = 12;
export const weeksShown = 12;
const dayMs = 24 * 60 * 60 * 1000;

function monthKey(date: Date) {
  return date.toISOString().slice(0, 7);
}

function startOfWeek(date: Date) {
  const day = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  // getUTCDay is 0 on Sunday; weeks start on Monday.
  const daysSinceMonday = (new Date(day).getUTCDay() + 6) % 7;
  return new Date(day - daysSinceMonday * dayMs);
}

/** The first moment of the oldest week the progress chart shows. */
export function progressChartStart(now: Date) {
  return new Date(startOfWeek(now).getTime() - (weeksShown - 1) * 7 * dayMs);
}

export function buildDashboardCharts(
  projects: { status: ProjectStatus; completedAt: string | null }[],
  progressDates: Date[],
  now: Date,
) {
  const projectsByStatus = projectStatuses.map((status) => ({
    status,
    count: projects.filter((project) => project.status === status).length,
  }));

  const months = Array.from({ length: monthsShown }, (_, index) =>
    monthKey(
      new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (monthsShown - 1 - index), 1)),
    ),
  );
  const completed = projects.filter((project) => project.status === "completed");
  // completed_at is a "YYYY-MM-DD" date; month-only dates are stored as the
  // 1st, so the first seven characters are always the right month.
  const completedPerMonth = months.map((month) => ({
    month,
    count: completed.filter((project) => project.completedAt?.slice(0, 7) === month).length,
  }));

  const firstWeek = progressChartStart(now);
  const progressPerWeek = Array.from({ length: weeksShown }, (_, index) => {
    const start = new Date(firstWeek.getTime() + index * 7 * dayMs);
    const end = start.getTime() + 7 * dayMs;
    return {
      weekStart: start.toISOString().slice(0, 10),
      count: progressDates.filter(
        (date) => date.getTime() >= start.getTime() && date.getTime() < end,
      ).length,
    };
  });

  return {
    projectsByStatus,
    completedPerMonth,
    completedWithoutDate: completed.filter((project) => !project.completedAt).length,
    progressPerWeek,
  };
}

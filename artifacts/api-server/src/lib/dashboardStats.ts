// Summary stats for the dashboard, worked out from a maker's own rows.
import { matchKey, tidyName } from "./yarnCatalog";

const dayMs = 24 * 60 * 60 * 1000;

/**
 * The yarn brand used on the most projects. A project counts once per brand,
 * however many colors of it the project lists. Brands match the way the yarn
 * catalog does, so "lion brand" and "Lion Brand" are one brand. Ties return
 * every tied brand, A to Z; no brands returns an empty list.
 */
export function mostUsedYarnBrands(
  yarns: { projectId: string; brand: string | null }[],
): { brands: string[]; projectCount: number } {
  const projectsByBrand = new Map<string, Set<string>>();
  const spellings = new Map<string, Map<string, number>>();
  for (const yarn of yarns) {
    const name = tidyName(yarn.brand ?? "");
    const key = matchKey(name);
    if (!key) continue;
    if (!projectsByBrand.has(key)) projectsByBrand.set(key, new Set());
    projectsByBrand.get(key)!.add(yarn.projectId);
    const counts = spellings.get(key) ?? new Map<string, number>();
    counts.set(name, (counts.get(name) ?? 0) + 1);
    spellings.set(key, counts);
  }

  let projectCount = 0;
  for (const projects of projectsByBrand.values()) {
    projectCount = Math.max(projectCount, projects.size);
  }
  if (projectCount === 0) return { brands: [], projectCount: 0 };

  // Show each brand the way the maker spells it most often. On a tie, plain
  // character order puts capitals first, so "Lion Brand" beats "lion brand".
  const brands = [...projectsByBrand.entries()]
    .filter(([, projects]) => projects.size === projectCount)
    .map(([key]) => {
      const counts = [...spellings.get(key)!.entries()];
      counts.sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
      return counts[0][0];
    })
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  return { brands, projectCount };
}

/**
 * Average whole days from start to finish across finished projects. Projects
 * missing either date are left out. Month-only dates are stored as the 1st,
 * so they count as the 1st here too. Returns null when nothing qualifies.
 */
export function averageDaysToFinish(
  projects: { status: string; startedAt: string | null; completedAt: string | null }[],
): number | null {
  const days = projects
    .filter((project) => project.status === "completed" && project.startedAt && project.completedAt)
    .map((project) => (Date.parse(project.completedAt!) - Date.parse(project.startedAt!)) / dayMs)
    .filter((value) => value >= 0);
  if (days.length === 0) return null;
  return Math.round(days.reduce((sum, value) => sum + value, 0) / days.length);
}

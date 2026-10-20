import { useState } from 'react';
import type { Project, StashYarn, YarnWeight } from '@workspace/api-client-react';

export const projectSorts = [
  { value: 'updated', label: 'Recently updated' },
  { value: 'newest', label: 'Newest added' },
  { value: 'oldest', label: 'Oldest added' },
  { value: 'name', label: 'A to Z' },
] as const;
export type ProjectSort = typeof projectSorts[number]['value'];

export const stashSorts = [
  { value: 'updated', label: 'Recently updated' },
  { value: 'brand', label: 'Brand A to Z' },
  { value: 'skeins', label: 'Most skeins left' },
  { value: 'weight', label: 'Weight, thin to thick' },
] as const;
export type StashSort = typeof stashSorts[number]['value'];

const weightOrder: YarnWeight[] = ['lace', 'fingering', 'sport', 'dk', 'worsted', 'bulky', 'super_bulky', 'jumbo'];

const byText = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true });
const byTime = (a: string, b: string) => new Date(a).getTime() - new Date(b).getTime();
// Yarn with no value sorts after yarn with one.
const lastIfMissing = (a: number | null, b: number | null) => (a === null ? 1 : 0) - (b === null ? 1 : 0);

function yarnName(yarn: Pick<StashYarn, 'brand' | 'subBrand' | 'color'>): string {
  return [yarn.brand, yarn.subBrand ?? '', yarn.color ?? ''].join(' ');
}

export function sortProjects<T extends Pick<Project, 'title' | 'createdAt' | 'updatedAt'>>(projects: T[], sort: ProjectSort): T[] {
  const sorted = [...projects];
  if (sort === 'updated') sorted.sort((a, b) => byTime(b.updatedAt, a.updatedAt));
  if (sort === 'newest') sorted.sort((a, b) => byTime(b.createdAt, a.createdAt));
  if (sort === 'oldest') sorted.sort((a, b) => byTime(a.createdAt, b.createdAt));
  if (sort === 'name') sorted.sort((a, b) => byText(a.title, b.title));
  return sorted;
}

export function sortStash<T extends Pick<StashYarn, 'brand' | 'subBrand' | 'color' | 'weight' | 'skeinsPurchased' | 'skeinsLeft' | 'updatedAt'>>(yarns: T[], sort: StashSort): T[] {
  const sorted = [...yarns];
  const left = (yarn: T) => yarn.skeinsLeft ?? yarn.skeinsPurchased;
  const weight = (yarn: T) => (yarn.weight ? weightOrder.indexOf(yarn.weight) : null);
  if (sort === 'updated') sorted.sort((a, b) => byTime(b.updatedAt, a.updatedAt));
  if (sort === 'brand') sorted.sort((a, b) => byText(yarnName(a), yarnName(b)));
  if (sort === 'skeins') sorted.sort((a, b) => lastIfMissing(left(a), left(b)) || (left(b) ?? 0) - (left(a) ?? 0) || byText(yarnName(a), yarnName(b)));
  if (sort === 'weight') sorted.sort((a, b) => lastIfMissing(weight(a), weight(b)) || (weight(a) ?? 0) - (weight(b) ?? 0) || byText(yarnName(a), yarnName(b)));
  return sorted;
}

// Remembers the chosen sort in this browser. Storage can be unavailable
// (private windows), so the default is used whenever it can't be read.
export function useSavedSort<T extends string>(key: string, options: readonly { value: T }[]): [T, (value: T) => void] {
  const [sort, setSort] = useState<T>(() => {
    try {
      const saved = window.localStorage.getItem(key);
      return options.find((option) => option.value === saved)?.value ?? options[0].value;
    } catch {
      return options[0].value;
    }
  });
  const choose = (value: T) => {
    setSort(value);
    try { window.localStorage.setItem(key, value); } catch { /* keep the choice for this visit only */ }
  };
  return [sort, choose];
}

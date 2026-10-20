import { describe, expect, it } from 'vitest';
import { sortProjects, sortStash } from './sorting';

const project = (title: string, createdAt: string, updatedAt: string) => ({ title, createdAt, updatedAt });
const yarn = (brand: string, extra: Partial<{ subBrand: string | null; color: string | null; weight: 'lace' | 'dk' | 'bulky' | null; skeinsPurchased: number | null; skeinsLeft: number | null; updatedAt: string }> = {}) => ({
  brand, subBrand: null, color: null, weight: null, skeinsPurchased: null, skeinsLeft: null, updatedAt: '2026-10-01T00:00:00Z', ...extra,
});

describe('sorting', () => {
  const projects = [
    project('juniper cardigan', '2026-10-02T00:00:00Z', '2026-10-05T00:00:00Z'),
    project('Autumn hat', '2026-10-03T00:00:00Z', '2026-10-03T00:00:00Z'),
    project('Blanket 10', '2026-10-01T00:00:00Z', '2026-10-09T00:00:00Z'),
  ];

  it('sorts projects by update, date added and name', () => {
    expect(sortProjects(projects, 'updated').map((item) => item.title)).toEqual(['Blanket 10', 'juniper cardigan', 'Autumn hat']);
    expect(sortProjects(projects, 'newest').map((item) => item.title)).toEqual(['Autumn hat', 'juniper cardigan', 'Blanket 10']);
    expect(sortProjects(projects, 'oldest').map((item) => item.title)).toEqual(['Blanket 10', 'juniper cardigan', 'Autumn hat']);
    expect(sortProjects(projects, 'name').map((item) => item.title)).toEqual(['Autumn hat', 'Blanket 10', 'juniper cardigan']);
  });

  it('sorts stash yarn by brand, skeins left and weight, with missing values last', () => {
    const stash = [
      yarn('Lion Brand', { subBrand: 'Wool-Ease', color: 'Fisherman', weight: 'bulky', skeinsPurchased: 4, skeinsLeft: 1 }),
      yarn('cascade', { subBrand: '220', weight: null, skeinsPurchased: 3, skeinsLeft: null }),
      yarn('Knit Picks', { weight: 'lace' }),
      yarn('Lion Brand', { subBrand: 'Wool-Ease', color: 'Cranberry', weight: 'dk', skeinsPurchased: 5, skeinsLeft: 5 }),
    ];
    const names = (items: typeof stash) => items.map((item) => [item.brand, item.color].filter(Boolean).join(' '));
    expect(names(sortStash(stash, 'brand'))).toEqual(['cascade', 'Knit Picks', 'Lion Brand Cranberry', 'Lion Brand Fisherman']);
    expect(names(sortStash(stash, 'skeins'))).toEqual(['Lion Brand Cranberry', 'cascade', 'Lion Brand Fisherman', 'Knit Picks']);
    expect(names(sortStash(stash, 'weight'))).toEqual(['Knit Picks', 'Lion Brand Cranberry', 'Lion Brand Fisherman', 'cascade']);
  });
});

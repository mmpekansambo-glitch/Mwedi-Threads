import { describe, expect, it } from 'vitest';
import { nameTileFont } from './name-tile';

describe('nameTileFont', () => {
  it('picks one of the two fonts for the project craft', () => {
    expect(['name-font-gluten', 'name-font-pacifico']).toContain(nameTileFont('Sunday cardigan', 'crochet'));
    expect(['name-font-silkscreen', 'name-font-rampart']).toContain(nameTileFont('Moss beanie', 'knitting'));
    expect(['name-font-special-elite', 'name-font-playfair']).toContain(nameTileFont('Linen dress', 'sewing'));
  });

  it('always gives a project the same font', () => {
    expect(nameTileFont('Gift scarf', 'knitting')).toBe(nameTileFont('Gift scarf', 'knitting'));
  });

  it('uses both fonts across a board of projects', () => {
    const names = ['Sunday cardigan', 'Granny blanket', 'Market tote', 'Baby hat', 'Coasters', 'Lichen socks'];
    expect(new Set(names.map((name) => nameTileFont(name, 'crochet'))).size).toBe(2);
  });
});

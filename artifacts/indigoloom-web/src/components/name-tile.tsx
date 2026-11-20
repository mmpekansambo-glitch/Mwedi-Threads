import type { CSSProperties } from 'react';

// When a project has no photo, its tile shows the project's name in a font
// that belongs to its craft (#118). Each craft has two fonts, and a project
// always gets the same one, picked from its name, so the board has variety
// but a project looks the same on every page.
export type NameTileCraft = 'crochet' | 'knitting' | 'sewing';

const craftFonts: Record<NameTileCraft, [string, string]> = {
  crochet: ['name-font-gluten', 'name-font-pacifico'],
  knitting: ['name-font-silkscreen', 'name-font-rampart'],
  sewing: ['name-font-special-elite', 'name-font-playfair'],
};

const tones = 4;

export function nameHash(name: string): number {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.codePointAt(0)!) >>> 0;
  return hash;
}

export function nameTileFont(name: string, craft: NameTileCraft): string {
  return craftFonts[craft][nameHash(name) % 2];
}

// Long names get a smaller size (a 0–1 scale for --name-size in CSS) so they
// still fit on two or three lines.
function sizeFor(name: string): string {
  const longestWord = Math.max(...name.split(/\s+/).map((word) => word.length), 4);
  const scale = Math.min(1, 9 / longestWord, 22 / Math.max(name.length, 10));
  return scale.toFixed(2);
}

export function NameTile({ name, craft, className = '' }: { name: string; craft: NameTileCraft; className?: string }) {
  const hash = nameHash(name);
  const style = { '--name-size': sizeFor(name) } as CSSProperties;
  return <span className={`name-tile name-tone-${(hash >> 3) % tones} ${nameTileFont(name, craft)}${className ? ` ${className}` : ''}`} style={style} aria-hidden="true">
    <span>{name}</span>
  </span>;
}

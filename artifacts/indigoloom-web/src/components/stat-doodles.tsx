export type StatDoodleKind = 'yarn' | 'hook' | 'square';

export function StatDoodle({ kind }: { kind: StatDoodleKind }) {
  return <svg className={`stat-doodle stat-doodle-${kind}`} viewBox="0 0 80 80" aria-hidden="true">
    {kind === 'yarn' && <>
      <circle cx="38" cy="38" r="24"/>
      <path d="M18 26c10 2 24 12 30 34M15 40c12-2 26 4 36 18M24 18c10 8 22 18 26 40M40 14c4 10 10 24 20 34"/>
      <path d="M60 52c6 6 6 14 0 18s-12 2-14 6"/>
    </>}
    {kind === 'hook' && <>
      <path d="M20 66 58 18c3-4 9-1 7 3l-3 4"/>
      <path d="M16 70l8-10"/>
      <path d="M30 44c-10-4-18 2-16 10s14 8 20 2 4-14-4-12"/>
    </>}
    {kind === 'square' && <>
      <rect x="12" y="12" width="56" height="56" rx="4"/>
      <rect x="24" y="24" width="32" height="32" rx="3"/>
      <circle cx="40" cy="40" r="6"/>
      <path d="M12 30h6M12 50h6M62 30h6M62 50h6M30 12v6M50 12v6M30 62v6M50 62v6"/>
    </>}
  </svg>;
}

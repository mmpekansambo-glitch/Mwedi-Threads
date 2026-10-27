export type StatDoodleKind = 'yarn' | 'hook' | 'square' | 'spool' | 'scissors' | 'swatch';

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
    {kind === 'spool' && <>
      <path d="M22 16h36M22 64h36"/>
      <path d="M28 16v48M52 16v48"/>
      <path d="M28 26l24 6M28 36l24 6M28 46l24 6M28 56l24-2"/>
      <path d="M52 30c8 2 12 10 8 18"/>
    </>}
    {kind === 'scissors' && <>
      <circle cx="22" cy="58" r="8"/>
      <circle cx="42" cy="64" r="8"/>
      <path d="M27 52 64 14M38 57 50 28"/>
      <path d="M50 28c4-6 8-10 14-14"/>
    </>}
    {kind === 'swatch' && <>
      <path d="M14 20h52v40H14z"/>
      <path d="M14 20l6 6-6 6 6 6-6 6 6 6-6 6"/>
      <path d="M30 32c6 4 12 4 18 0M30 46c6 4 12 4 18 0"/>
    </>}
  </svg>;
}

import type { SewingProject, SewingStage } from '@workspace/api-client-react';
import { fabricUnits } from '@/components/fabric-fields';

export const sewingStages: Array<{ value: SewingStage; label: string }> = [
  { value: 'prep', label: 'Prep' },
  { value: 'cut', label: 'Cut' },
  { value: 'sew', label: 'Sew' },
  { value: 'fit', label: 'Fit' },
  { value: 'finish', label: 'Finish' },
];

export function stageIndex(stage: SewingStage): number {
  return sewingStages.findIndex((item) => item.value === stage);
}

// The five stages as a track: stages before the current one are done, and a
// finished project has done them all.
export function StageTrack({ project, compact = false }: { project: Pick<SewingProject, 'stage' | 'status'>; compact?: boolean }) {
  const current = project.status === 'completed' ? sewingStages.length : stageIndex(project.stage);
  const label = project.status === 'completed' ? 'Finished' : project.status === 'planning' ? 'Not started' : `Stage: ${sewingStages[current]?.label}`;
  return <span className={`stage-track${compact ? ' stage-track-compact' : ''}`} aria-label={label} role="img">
    {sewingStages.map((item, index) => <span key={item.value} className={`stage-step${index < current ? ' done' : ''}${index === current && project.status !== 'planning' ? ' current' : ''}`}>
      <i/>{!compact && <b>{item.label}</b>}
    </span>)}
  </span>;
}

export function fabricAmount(amount: number | null, unit: SewingProject['fabrics'][number]['fabric']['unit']): string {
  if (amount === null) return '';
  const short = (fabricUnits.find((item) => item.value === unit) ?? fabricUnits[0]).amount;
  return `${amount} ${short}`;
}

// What's left of a stash fabric once a finished project's share is taken off.
export function amountLeft(amount: number, used: number): number {
  return Math.max(0, Math.round((amount - used) * 100) / 100);
}

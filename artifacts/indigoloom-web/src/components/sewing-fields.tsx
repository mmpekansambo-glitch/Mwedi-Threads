import { useEffect, useRef, useState } from 'react';
import { ChevronRight, X } from 'lucide-react';
import type { SewingNeedleSize, SewingNeedleType, SewingProject, SewingStage } from '@workspace/api-client-react';
import { Wheel } from '@/components/date-wheel-field';
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

// Tapping the current stage again unchecks it: the project steps back one
// stage, and unchecking Prep puts it back to Not started. Any other stage is
// picked as usual, which starts a project that hasn't started yet.
export function stageChange(project: Pick<SewingProject, 'stage' | 'status'>, stage: SewingStage): { stage?: SewingStage; status?: SewingProject['status'] } {
  const at = stageIndex(stage);
  if (project.status !== 'planning' && project.status !== 'completed' && project.stage === stage) {
    return at === 0 ? { status: 'planning' } : { stage: sewingStages[at - 1]!.value };
  }
  return project.status === 'planning' || project.status === 'paused' ? { stage, status: 'in_progress' } : { stage };
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

export const machineNeedleTypes: Array<{ value: SewingNeedleType; label: string }> = [
  { value: 'universal', label: 'Universal' },
  { value: 'ballpoint', label: 'Ballpoint' },
  { value: 'stretch', label: 'Stretch' },
  { value: 'jeans', label: 'Jeans' },
  { value: 'microtex', label: 'Microtex' },
  { value: 'quilting', label: 'Quilting' },
  { value: 'leather', label: 'Leather' },
  { value: 'topstitch', label: 'Topstitch' },
  { value: 'embroidery', label: 'Embroidery' },
  { value: 'metallic', label: 'Metallic' },
];

export const machineNeedleSizes: SewingNeedleSize[] = ['60/8', '65/9', '70/10', '75/11', '80/12', '90/14', '100/16', '110/18'];

export function needleLabel(project: Pick<SewingProject, 'needleType' | 'needleSize'>): string {
  return [machineNeedleTypes.find((item) => item.value === project.needleType)?.label, project.needleSize].filter(Boolean).join(' ');
}

// A form row that reads "Add" until filled; tapping it opens one or more
// scroll wheels side by side. Keeps optional details out of the way.
export function TapWheelRow({ label, shown, wheels, onDone, onClear, testId }: {
  label: string;
  shown: React.ReactNode;
  wheels: Array<{ label: string; items: string[]; index: number }>;
  onDone: (indexes: number[]) => void;
  onClear: () => void;
  testId: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<number[]>([]);
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === 'Escape' : !rowRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  return <div className="tap-row date-wheel-field" ref={rowRef}>
    <button type="button" className="tap-row-trigger" aria-haspopup="dialog" aria-expanded={open} onClick={() => { setDraft(wheels.map((wheel) => wheel.index)); setOpen(!open); }} data-testid={testId}>
      <b>{label}</b>{shown ? <span className="tap-row-value">{shown}</span> : <span className="tap-row-add">Add <ChevronRight size={15}/></span>}
    </button>
    {shown && <button type="button" className="date-wheel-clear" aria-label={`Clear ${label.toLowerCase()}`} onClick={() => { onClear(); setOpen(false); }} data-testid={`${testId}-clear`}><X size={16}/></button>}
    {open && <div className="date-wheel-panel" role="dialog" aria-label={label}>
      <div className="date-wheels" style={{ gridTemplateColumns: `repeat(${wheels.length}, 1fr)` }}>
        <div className="date-wheel-band" aria-hidden="true"/>
        {wheels.map((wheel, place) => <Wheel key={wheel.label} label={wheel.label} items={wheel.items} index={draft[place] ?? 0} onChange={(index) => setDraft((current) => current.map((value, at) => (at === place ? index : value)))} testId={`${testId}-wheel-${place}`}/>)}
      </div>
      <div className="date-wheel-actions">
        <button type="button" className="button button-outline" onClick={() => setOpen(false)}>Cancel</button>
        <button type="button" className="button button-primary" onClick={() => { onDone(draft); setOpen(false); }} data-testid={`${testId}-done`}>Done</button>
      </div>
    </div>}
  </div>;
}

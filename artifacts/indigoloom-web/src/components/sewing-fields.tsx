import { useEffect, useRef, useState } from 'react';
import { ChevronRight, Pencil, Plus, X } from 'lucide-react';
import type { SewingMachineSetting, SewingNeedleSize, SewingNeedleType, SewingPresserFoot, SewingProject, SewingStage, SewingStitch } from '@workspace/api-client-react';
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

export const machineStitches: Array<{ value: SewingStitch; label: string }> = [
  { value: 'straight', label: 'Straight' },
  { value: 'zigzag', label: 'Zigzag' },
  { value: 'three_step_zigzag', label: '3-step zigzag' },
  { value: 'stretch', label: 'Stretch' },
  { value: 'overlock', label: 'Overlock' },
  { value: 'blind_hem', label: 'Blind hem' },
  { value: 'buttonhole', label: 'Buttonhole' },
  { value: 'decorative', label: 'Decorative' },
];

export const presserFeet: Array<{ value: SewingPresserFoot; label: string }> = [
  { value: 'all_purpose', label: 'All-purpose' },
  { value: 'zipper', label: 'Zipper' },
  { value: 'walking', label: 'Walking' },
  { value: 'buttonhole', label: 'Buttonhole' },
  { value: 'blind_hem', label: 'Blind hem' },
  { value: 'rolled_hem', label: 'Rolled hem' },
  { value: 'quarter_inch', label: '1/4 inch' },
  { value: 'open_toe', label: 'Open toe' },
  { value: 'non_stick', label: 'Non-stick' },
];

// Half steps from 0 up to the limit: 0, 0.5, 1 ...
function halfSteps(max: number): number[] {
  return Array.from({ length: max * 2 + 1 }, (_, index) => index / 2);
}
export const stitchLengths = halfSteps(5);
export const stitchWidths = halfSteps(7);
export const tensions = halfSteps(9);

export const emptyMachineSetting: SewingMachineSetting = { name: null, stitch: null, stitchLength: null, stitchWidth: null, tension: null, presserFoot: null, notes: null };

export function machineSettingSummary(setting: SewingMachineSetting): string {
  return [
    machineStitches.find((item) => item.value === setting.stitch)?.label,
    setting.stitchLength !== null && `Length ${setting.stitchLength} mm`,
    setting.stitchWidth !== null && `Width ${setting.stitchWidth} mm`,
    setting.tension !== null && `Tension ${setting.tension}`,
    setting.presserFoot && `${presserFeet.find((item) => item.value === setting.presserFoot)?.label} foot`,
  ].filter(Boolean).join(' · ');
}

function hasSomething(setting: SewingMachineSetting): boolean {
  return Object.values(setting).some((value) => value !== null && value !== '');
}

function NumberRow({ label, unit, items, value, fallback, onChange, testId }: {
  label: string; unit: string; items: number[]; value: number | null; fallback: number; onChange: (value: number | null) => void; testId: string;
}) {
  return <TapWheelRow label={label} shown={value !== null && `${value}${unit}`} testId={testId}
    wheels={[{ label, items: items.map((item) => `${item}${unit}`), index: Math.max(0, items.indexOf(value ?? fallback)) }]}
    onDone={([index]) => onChange(items[index ?? 0]!)}
    onClear={() => onChange(null)}/>;
}

// Named sets of machine settings (Seams, Topstitch, Hem...). Each set folds
// down to one line once it's done; every part of a set is optional.
export function MachineSettingsField({ settings, onChange }: { settings: SewingMachineSetting[]; onChange: (settings: SewingMachineSetting[]) => void }) {
  const [editing, setEditing] = useState<number | null>(null);
  const change = (index: number, update: Partial<SewingMachineSetting>) => onChange(settings.map((item, place) => (place === index ? { ...item, ...update } : item)));
  const remove = (index: number) => { onChange(settings.filter((_, place) => place !== index)); setEditing(null); };
  // Closing a set with nothing in it drops it.
  const dropsOpen = () => editing !== null && !hasSomething(settings[editing]!);
  const close = () => { if (dropsOpen()) remove(editing!); else setEditing(null); };
  const edit = (index: number) => {
    const shifts = dropsOpen() && index > editing!;
    close();
    setEditing(shifts ? index - 1 : index);
  };

  return <>
    {settings.map((setting, index) => editing === index
      ? <div key={index} className="machine-set machine-set-open" data-testid={`machine-set-${index}`}>
        <div className="machine-set-name">
          <input maxLength={60} placeholder="Name, e.g. Seams, Topstitch or Hem" value={setting.name ?? ''} onChange={(event) => change(index, { name: event.target.value || null })} aria-label="Name of these settings" autoFocus data-testid={`input-machine-name-${index}`}/>
          <button type="button" className="icon-button" aria-label="Remove these settings" onClick={() => remove(index)} data-testid={`button-remove-machine-${index}`}><X size={15}/></button>
        </div>
        <div className="tap-rows">
          <TapWheelRow label="Stitch" shown={machineStitches.find((item) => item.value === setting.stitch)?.label} testId={`row-machine-stitch-${index}`}
            wheels={[{ label: 'Stitch', items: machineStitches.map((item) => item.label), index: Math.max(0, machineStitches.findIndex((item) => item.value === setting.stitch)) }]}
            onDone={([stitch]) => change(index, { stitch: machineStitches[stitch ?? 0]!.value })}
            onClear={() => change(index, { stitch: null })}/>
          <NumberRow label="Length" unit=" mm" items={stitchLengths} value={setting.stitchLength} fallback={2.5} onChange={(stitchLength) => change(index, { stitchLength })} testId={`row-machine-length-${index}`}/>
          <NumberRow label="Width" unit=" mm" items={stitchWidths} value={setting.stitchWidth} fallback={0} onChange={(stitchWidth) => change(index, { stitchWidth })} testId={`row-machine-width-${index}`}/>
          <NumberRow label="Tension" unit="" items={tensions} value={setting.tension} fallback={4} onChange={(tension) => change(index, { tension })} testId={`row-machine-tension-${index}`}/>
          <TapWheelRow label="Presser foot" shown={presserFeet.find((item) => item.value === setting.presserFoot)?.label} testId={`row-machine-foot-${index}`}
            wheels={[{ label: 'Presser foot', items: presserFeet.map((item) => item.label), index: Math.max(0, presserFeet.findIndex((item) => item.value === setting.presserFoot)) }]}
            onDone={([foot]) => change(index, { presserFoot: presserFeet[foot ?? 0]!.value })}
            onClear={() => change(index, { presserFoot: null })}/>
        </div>
        <input className="machine-set-note" maxLength={500} placeholder="Note (optional)" value={setting.notes ?? ''} onChange={(event) => change(index, { notes: event.target.value || null })} aria-label="Note for these settings" data-testid={`input-machine-note-${index}`}/>
        <button type="button" className="button button-outline" onClick={close} data-testid={`button-machine-done-${index}`}>Done</button>
      </div>
      : <div key={index} className="machine-set" data-testid={`machine-set-${index}`}>
        <span className="sewing-fabric-name"><b>{setting.name || 'Special machine settings'}</b><small>{machineSettingSummary(setting) || setting.notes}</small></span>
        <button type="button" className="icon-button" aria-label={`Edit ${setting.name || 'special machine settings'}`} onClick={() => edit(index)} data-testid={`button-edit-machine-${index}`}><Pencil size={15}/></button>
        <button type="button" className="icon-button" aria-label={`Remove ${setting.name || 'special machine settings'}`} onClick={() => remove(index)} data-testid={`button-remove-machine-${index}`}><X size={15}/></button>
      </div>)}
    {editing === null && settings.length < 10 && <button type="button" className="button button-outline" onClick={() => { onChange([...settings, emptyMachineSetting]); setEditing(settings.length); }} data-testid="button-add-machine-settings"><Plus size={16}/> Add special machine settings</button>}
  </>;
}

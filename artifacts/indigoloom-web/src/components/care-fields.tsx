import { useEffect, useRef, useState } from 'react';
import { ChevronRight, Plus, X } from 'lucide-react';
import { careGroups, careOption, hasCare, noCare } from '@workspace/api-client-react';
import type { CareGroup, CareShape, FabricCare } from '@workspace/api-client-react';

// One laundry care symbol, drawn from the shared shape data.
export function CareSymbol({ shape, size = 30, label }: { shape: CareShape; size?: number; label?: string }) {
  return <svg className="care-symbol" viewBox="0 0 48 48" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
    {shape.paths.map((d) => <path key={d} d={d}/>)}
    {shape.dots.map(([cx, cy]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={1.9} fill="currentColor" stroke="none"/>)}
  </svg>;
}

function CareRow({ group, value, onChange }: { group: CareGroup; value: string | null; onChange: (value: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);
  const chosen = careOption(group, value);
  const testId = `row-care-${group.key.slice(4).toLowerCase()}`;

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
    <button type="button" className="tap-row-trigger" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(!open)} data-testid={testId}>
      <b>{group.label}</b>{chosen ? <span className="tap-row-value"><CareSymbol shape={chosen.shape}/>{chosen.label}</span> : <span className="tap-row-add">Choose <ChevronRight size={15}/></span>}
    </button>
    {chosen && <button type="button" className="date-wheel-clear" aria-label={`Clear ${group.label.toLowerCase()}`} onClick={() => { onChange(null); setOpen(false); }} data-testid={`${testId}-clear`}><X size={16}/></button>}
    {open && <div className="date-wheel-panel care-panel" role="dialog" aria-label={group.label}>
      <div className="care-grid" role="radiogroup" aria-label={group.label}>
        {group.options.map((option) => <button key={option.value} type="button" role="radio" aria-checked={option.value === value} className={`care-tile${option.value === value ? ' selected' : ''}`} onClick={() => { onChange(option.value); setOpen(false); }} data-testid={`${testId}-${option.value}`}>
          <CareSymbol shape={option.shape} size={38}/><span>{option.label}</span>
        </button>)}
      </div>
    </div>}
  </div>;
}

// Optional care label for a fabric: closed behind one button until the maker
// wants it, then one row per group (Wash, Bleach, Dry, Iron, Dry clean).
export function CareField({ value, onChange }: { value: FabricCare; onChange: (care: FabricCare) => void }) {
  const [open, setOpen] = useState(() => hasCare(value));
  if (!open) return <div className="field-block field-wide"><button type="button" className="button button-outline care-add" onClick={() => setOpen(true)} data-testid="button-add-care"><Plus size={16}/> Add care instructions</button></div>;
  return <div className="field-block field-wide care-field">
    <div className="care-heading"><label id="care-label">Care instructions</label><button type="button" className="care-remove" onClick={() => { onChange(noCare); setOpen(false); }} data-testid="button-remove-care">Remove</button></div>
    <div className="tap-rows" role="group" aria-labelledby="care-label">
      {careGroups.map((group) => <CareRow key={group.key} group={group} value={value[group.key]} onChange={(next) => onChange({ ...value, [group.key]: next })}/>)}
    </div>
  </div>;
}

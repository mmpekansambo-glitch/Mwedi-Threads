import { useEffect, useRef, useState } from 'react';
import { Layers, Plus, Trash2, X } from 'lucide-react';
import { nameKey } from '@workspace/api-client-react';
import type { GeneralColor, YarnBlendPart, YarnWeight } from '@workspace/api-client-react';
import { Wheel } from '@/components/date-wheel-field';

export const yarnWeights: Array<{ value: YarnWeight; label: string }> = [
  { value: 'lace', label: '0 · Lace' },
  { value: 'fingering', label: '1 · Fingering' },
  { value: 'sport', label: '2 · Sport' },
  { value: 'dk', label: '3 · DK' },
  { value: 'worsted', label: '4 · Worsted' },
  { value: 'bulky', label: '5 · Bulky' },
  { value: 'super_bulky', label: '6 · Super bulky' },
  { value: 'jumbo', label: '7 · Jumbo' },
];

export function weightLabel(weight: YarnWeight | null | undefined): string {
  return yarnWeights.find((item) => item.value === weight)?.label ?? '';
}

export const generalColors: Array<{ value: GeneralColor; label: string; swatch: string }> = [
  { value: 'red', label: 'Red', swatch: '#C0392B' },
  { value: 'orange', label: 'Orange', swatch: '#E07B39' },
  { value: 'yellow', label: 'Yellow', swatch: '#E9C46A' },
  { value: 'green', label: 'Green', swatch: '#5B8C51' },
  { value: 'blue', label: 'Blue', swatch: '#3D6FB6' },
  { value: 'purple', label: 'Purple', swatch: '#7D5BA6' },
  { value: 'pink', label: 'Pink', swatch: '#E58FB0' },
  { value: 'brown', label: 'Brown', swatch: '#8B5E3C' },
  { value: 'black', label: 'Black', swatch: '#222222' },
  { value: 'gray', label: 'Gray', swatch: '#9AA0A6' },
  { value: 'white', label: 'White', swatch: '#FFFFFF' },
  { value: 'cream', label: 'Cream', swatch: '#F1E6CF' },
  { value: 'multi', label: 'Multicolor', swatch: 'conic-gradient(#C0392B, #E9C46A, #5B8C51, #3D6FB6, #7D5BA6, #C0392B)' },
];

export function ColorDot({ color, className = '', noun = 'yarn' }: { color: GeneralColor | null | undefined; className?: string; noun?: string }) {
  const match = generalColors.find((item) => item.value === color);
  if (!match) return null;
  return <span className={`color-dot ${className}`} style={{ background: match.swatch }} title={match.label} aria-label={`${match.label} ${noun}`} role="img"/>;
}

export function GeneralColorPicker({ value, onChange }: { value: GeneralColor | null; onChange: (value: GeneralColor | null) => void }) {
  return <div className="field-block field-wide">
    <label id="stash-general-color-label">Color family</label>
    <div className="color-picker" role="radiogroup" aria-labelledby="stash-general-color-label">
      {generalColors.map((item) => <button
        key={item.value}
        type="button"
        role="radio"
        aria-checked={value === item.value}
        aria-label={item.label}
        title={item.label}
        className={`color-choice${value === item.value ? ' selected' : ''}`}
        onClick={() => onChange(value === item.value ? null : item.value)}
        data-testid={`button-general-color-${item.value}`}
      ><span style={{ background: item.swatch }}/></button>)}
    </div>
  </div>;
}

// Picks a yarn weight with the same scroll wheel as the project dates.
export function WeightWheelField({ value, onChange }: { value: YarnWeight | null; onChange: (value: YarnWeight | null) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(0);
  const fieldRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === 'Escape' : !fieldRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  const openPicker = () => {
    setDraft(Math.max(0, yarnWeights.findIndex((item) => item.value === (value ?? 'worsted'))));
    setOpen(!open);
  };

  return <div className="field-block date-wheel-field" ref={fieldRef}>
    <label htmlFor="stash-weight">Weight</label>
    <div className="date-wheel-controls">
      <button type="button" id="stash-weight" className={`date-wheel-trigger${value ? '' : ' empty'}`} aria-haspopup="dialog" aria-expanded={open} onClick={openPicker} data-testid="input-stash-weight">
        <Layers size={17}/><span>{weightLabel(value) || 'Choose a weight'}</span>
      </button>
      {value && <button type="button" className="date-wheel-clear" aria-label="Clear weight" onClick={() => { onChange(null); setOpen(false); }} data-testid="input-stash-weight-clear"><X size={16}/></button>}
    </div>
    {open && <div className="date-wheel-panel" role="dialog" aria-label="Weight">
      <div className="date-wheels weight-wheels">
        <div className="date-wheel-band" aria-hidden="true"/>
        <Wheel label="Weight" items={yarnWeights.map((item) => item.label)} index={draft} onChange={setDraft} testId="input-stash-weight-wheel"/>
      </div>
      <div className="date-wheel-actions">
        <button type="button" className="button button-outline" onClick={() => setOpen(false)}>Cancel</button>
        <button type="button" className="button button-primary" onClick={() => { onChange(yarnWeights[draft].value); setOpen(false); }} data-testid="input-stash-weight-done">Done</button>
      </div>
    </div>}
  </div>;
}

export type BlendDraft = Array<{ fiber: string; percent: string }>;

const otherFiber = '__other__';

export function blendForApi(draft: BlendDraft): YarnBlendPart[] | string {
  const parts = draft.filter((part) => part.fiber.trim() || part.percent.trim());
  if (parts.some((part) => !part.fiber.trim())) return 'Choose a fiber for each part of the blend.';
  const blend = parts.map((part) => ({ fiber: part.fiber.trim(), percent: Number(part.percent) }));
  if (blend.some((part) => !Number.isInteger(part.percent) || part.percent < 1 || part.percent > 100)) return 'Enter each fiber as a whole percent from 1 to 100.';
  const total = blend.reduce((sum, part) => sum + part.percent, 0);
  if (blend.length && total !== 100) return `The blend adds up to ${total}%. Make it add up to 100%.`;
  return blend;
}

export function BlendFields({ value, onChange, fibers, error }: { value: BlendDraft; onChange: (value: BlendDraft) => void; fibers: string[]; error: string }) {
  const [typing, setTyping] = useState<Set<number>>(new Set());
  const update = (index: number, change: Partial<BlendDraft[number]>) => onChange(value.map((part, partIndex) => partIndex === index ? { ...part, ...change } : part));
  const total = value.reduce((sum, part) => sum + (Number(part.percent) || 0), 0);
  return <div className="field-block field-wide blend-fields">
    <label>Blend</label>
    {value.map((part, index) => {
      const known = fibers.includes(part.fiber);
      const showText = typing.has(index) || (Boolean(part.fiber) && !known);
      return <div className="blend-row" key={index}>
        {showText
          ? <input aria-label={`Fiber ${index + 1}`} placeholder="Fiber name" value={part.fiber} maxLength={40} onChange={(event) => update(index, { fiber: event.target.value })} data-testid={`input-blend-fiber-${index}`}/>
          : <select aria-label={`Fiber ${index + 1}`} value={part.fiber} onChange={(event) => {
            if (event.target.value === otherFiber) {
              setTyping(new Set(typing).add(index));
              update(index, { fiber: '' });
            } else update(index, { fiber: event.target.value });
          }} data-testid={`select-blend-fiber-${index}`}>
            <option value="">Choose a fiber</option>
            {fibers.map((fiber) => <option key={fiber} value={fiber}>{fiber}</option>)}
            <option value={otherFiber}>Another fiber…</option>
          </select>}
        <span className="blend-percent"><input aria-label={`Percent of fiber ${index + 1}`} inputMode="numeric" value={part.percent} onChange={(event) => update(index, { percent: event.target.value.replace(/[^0-9]/g, '').slice(0, 3) })} data-testid={`input-blend-percent-${index}`}/><i>%</i></span>
        <button type="button" className="blend-remove" aria-label={`Remove fiber ${index + 1}`} onClick={() => {
          onChange(value.filter((_, partIndex) => partIndex !== index));
          setTyping(new Set());
        }}><Trash2 size={15}/></button>
      </div>;
    })}
    <div className="blend-foot">
      {value.length < 6 && <button type="button" className="button button-quiet button-small" onClick={() => onChange([...value, { fiber: '', percent: value.length ? String(Math.max(0, 100 - total) || '') : '100' }])} data-testid="button-add-fiber"><Plus size={15}/> Add a fiber</button>}
      {value.length > 0 && <span className={total === 100 ? 'blend-total' : 'blend-total off'}>Total {total}%</span>}
    </div>
    {error && <span className="field-error">{error}</span>}
  </div>;
}

export function useSettledValue(value: string, delay = 300): string {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return settled;
}

// Hidden once the field already holds the suggested name.
// A maker renaming a yarn away from its old name isn't nudged back to it.
export function DidYouMean({ suggestion, typed, renamingFrom, onAccept, testId }: { suggestion: string | null | undefined; typed: string; renamingFrom?: string | null; onAccept: (value: string) => void; testId: string }) {
  if (!suggestion || suggestion === typed.trim()) return null;
  if (renamingFrom && nameKey(suggestion) === nameKey(renamingFrom) && nameKey(typed) !== nameKey(renamingFrom)) return null;
  return <button type="button" className="did-you-mean" onClick={() => onAccept(suggestion)} data-testid={testId}>Did you mean <b>{suggestion}</b>?</button>;
}

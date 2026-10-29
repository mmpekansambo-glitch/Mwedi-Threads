import { useEffect, useRef, useState } from 'react';
import { X, type LucideIcon } from 'lucide-react';
import type { FabricConstruction, FabricPrint, FabricType, FabricUnit, StashFabric } from '@workspace/api-client-react';
import { Wheel } from '@/components/date-wheel-field';

// A to Z with Other last.
export const fabricTypes: Array<{ value: FabricType; label: string }> = [
  { value: 'blend', label: 'Blend' },
  { value: 'canvas', label: 'Canvas' },
  { value: 'chambray', label: 'Chambray' },
  { value: 'chiffon', label: 'Chiffon' },
  { value: 'corduroy', label: 'Corduroy' },
  { value: 'cotton', label: 'Cotton' },
  { value: 'crepe', label: 'Crepe' },
  { value: 'denim', label: 'Denim' },
  { value: 'flannel', label: 'Flannel' },
  { value: 'fleece', label: 'Fleece' },
  { value: 'french_terry', label: 'French terry' },
  { value: 'jersey', label: 'Jersey' },
  { value: 'linen', label: 'Linen' },
  { value: 'polyester', label: 'Polyester' },
  { value: 'rib_knit', label: 'Rib knit' },
  { value: 'satin', label: 'Satin' },
  { value: 'silk', label: 'Silk' },
  { value: 'tulle', label: 'Tulle' },
  { value: 'velvet', label: 'Velvet' },
  { value: 'viscose', label: 'Viscose (rayon)' },
  { value: 'wool', label: 'Wool' },
  { value: 'other', label: 'Other' },
];

export const fabricConstructions: Array<{ value: FabricConstruction; label: string }> = [
  { value: 'woven', label: 'Woven' },
  { value: 'knit', label: 'Knit' },
];

// A to Z, so the print wheel and filters are easy to scan.
export const fabricPrints: Array<{ value: FabricPrint; label: string }> = [
  { value: 'abstract', label: 'Abstract' },
  { value: 'animal', label: 'Animal' },
  { value: 'ankara', label: 'Ankara (wax print)' },
  { value: 'batik', label: 'Batik' },
  { value: 'botanical', label: 'Botanical' },
  { value: 'camo', label: 'Camo' },
  { value: 'check', label: 'Check or plaid' },
  { value: 'chevron', label: 'Chevron' },
  { value: 'damask', label: 'Damask' },
  { value: 'dots', label: 'Dots' },
  { value: 'floral', label: 'Floral' },
  { value: 'geometric', label: 'Geometric' },
  { value: 'houndstooth', label: 'Houndstooth' },
  { value: 'ikat', label: 'Ikat' },
  { value: 'novelty', label: 'Novelty' },
  { value: 'ombre', label: 'Ombré' },
  { value: 'paisley', label: 'Paisley' },
  { value: 'solid', label: 'Solid' },
  { value: 'stripe', label: 'Stripe' },
  { value: 'tie_dye', label: 'Tie-dye' },
  { value: 'toile', label: 'Toile' },
  { value: 'other', label: 'Other' },
];

// Meters go with centimeter widths, yards with inch widths.
export const fabricUnits: Array<{ value: FabricUnit; label: string; amount: string; width: string }> = [
  { value: 'meters', label: 'Meters', amount: 'm', width: 'cm' },
  { value: 'yards', label: 'Yards', amount: 'yd', width: 'in' },
];

export const maxFabricPhotos = 4;

export function labelFor<T extends string>(options: Array<{ value: T; label: string }>, value: T | null | undefined): string {
  return options.find((item) => item.value === value)?.label ?? '';
}

export function fabricName(fabric: Pick<StashFabric, 'fabricType' | 'print'>): string {
  const print = fabric.print && fabric.print !== 'solid' ? labelFor(fabricPrints, fabric.print).toLowerCase() : '';
  return [labelFor(fabricTypes, fabric.fabricType), print].filter(Boolean).join(', ');
}

// Shows what's left once some has been used, like "1.5 of 3 m left".
export function fabricSize(fabric: Pick<StashFabric, 'amount' | 'width' | 'unit'> & { amountLeft?: number | null }): string {
  const unit = fabricUnits.find((item) => item.value === fabric.unit) ?? fabricUnits[0];
  const left = fabric.amountLeft ?? null;
  return [
    fabric.amount !== null
      ? left !== null && left !== fabric.amount ? `${left} of ${fabric.amount} ${unit.amount} left` : `${fabric.amount} ${unit.amount}`
      : '',
    fabric.width !== null ? `${fabric.width} ${unit.width} wide` : '',
  ].filter(Boolean).join(' · ');
}

export function fabricPhotoUrl(fabric: Pick<StashFabric, 'id' | 'updatedAt'>, index: number): string {
  return `/api/fabric-stash/${fabric.id}/photos/${index}?v=${encodeURIComponent(String(fabric.updatedAt))}`;
}

// Amounts and widths are typed as text and checked before saving.
export function sizeForApi(value: string): number | null | 'invalid' {
  if (!value.trim()) return null;
  const number = Number(value.replace(',', '.'));
  return Number.isFinite(number) && number >= 0 && number <= 999 ? number : 'invalid';
}

// Fabric type and print pickers are scroll wheels like the date picker.
export function OptionWheelField<T extends string>({ id, label, required, options, value, onChange, icon: Icon, placeholder, testId, error }: {
  id: string;
  label: string;
  required?: boolean;
  options: Array<{ value: T; label: string }>;
  value: T | '';
  onChange: (value: T | '') => void;
  icon: LucideIcon;
  placeholder: string;
  testId: string;
  error?: string;
}) {
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
    setDraft(Math.max(0, options.findIndex((item) => item.value === value)));
    setOpen(!open);
  };
  const shown = labelFor(options, value);

  return <div className="field-block date-wheel-field" ref={fieldRef}>
    <label htmlFor={id}>{label}{required && <> <b>*</b></>}</label>
    <div className="date-wheel-controls">
      <button type="button" id={id} className={`date-wheel-trigger${shown ? '' : ' empty'}`} aria-haspopup="dialog" aria-expanded={open} onClick={openPicker} data-testid={testId}>
        <Icon size={17}/><span>{shown || placeholder}</span>
      </button>
      {value && !required && <button type="button" className="date-wheel-clear" aria-label={`Clear ${label.toLowerCase()}`} onClick={() => { onChange(''); setOpen(false); }} data-testid={`${testId}-clear`}><X size={16}/></button>}
    </div>
    {error && <span className="field-error">{error}</span>}
    {open && <div className="date-wheel-panel" role="dialog" aria-label={label}>
      <div className="date-wheels weight-wheels">
        <div className="date-wheel-band" aria-hidden="true"/>
        <Wheel label={label} items={options.map((item) => item.label)} index={draft} onChange={setDraft} testId={`${testId}-wheel`}/>
      </div>
      <div className="date-wheel-actions">
        <button type="button" className="button button-outline" onClick={() => setOpen(false)}>Cancel</button>
        <button type="button" className="button button-primary" onClick={() => { onChange(options[draft]!.value); setOpen(false); }} data-testid={`${testId}-done`}>Done</button>
      </div>
    </div>}
  </div>;
}

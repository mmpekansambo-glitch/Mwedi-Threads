import { useEffect, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';
import { Wheel } from '@/components/date-wheel-field';
import { currencySymbol, formatSpend, parseSpend, spendDraft } from '@/lib/money';
import { formatHours, hourItems, hoursFromWheels, wheelsFromHours } from '@/lib/hours';

// The project's total spend as one detail row: tap to add or change it.
// Clearing the box and saving removes it.
export function SpendRow({ cents, currency, onSave }: {
  cents: number | null;
  currency: string;
  onSave: (cents: number | null) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) input.current?.focus(); }, [open]);

  const start = () => { setDraft(spendDraft(cents)); setError(''); setOpen(true); };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = parseSpend(draft);
    if (!parsed.ok) { setError('Enter an amount like 42.50.'); return; }
    setSaving(true);
    try {
      await onSave(parsed.cents);
      setOpen(false);
    } catch {
      setError('We couldn’t save that. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return <div className="spend-row">
    <dt>Total spend</dt>
    <dd>{open
      ? <form className="spend-edit" onSubmit={save} noValidate>
          <label className="spend-input"><span aria-hidden="true">{currencySymbol(currency)}</span>
            <input ref={input} inputMode="decimal" aria-label={`Total spend in ${currency}`} value={draft} placeholder="0.00" onChange={(event) => { setDraft(event.target.value); setError(''); }} onKeyDown={(event) => { if (event.key === 'Escape') setOpen(false); }} data-testid="input-total-spend"/>
          </label>
          <button type="button" className="icon-button" aria-label="Cancel" onClick={() => setOpen(false)}><X size={15}/></button>
          <button type="submit" className="icon-button spend-save" aria-label="Save total spend" disabled={saving} data-testid="button-save-total-spend"><Check size={15}/></button>
          {error && <span className="field-error" role="alert">{error}</span>}
        </form>
      : <button type="button" className="spend-value" onClick={start} data-testid="button-total-spend">{cents === null ? 'Add' : formatSpend(cents, currency)}</button>}
    </dd>
  </div>;
}

// Total hours as one detail row: tap to pick whole hours and an optional half.
export function HoursRow({ hours, onSave }: { hours: number | null; onSave: (hours: number | null) => Promise<unknown> }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<[number, number]>([0, 0]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === 'Escape' : !rowRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
  }, [open]);

  const save = async (value: number | null) => {
    setSaving(true);
    try {
      await onSave(value);
      setOpen(false);
    } catch {
      setError('We couldn’t save that. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return <div className="spend-row hours-row" ref={rowRef}>
    <dt>Hours</dt>
    <dd>
      <button type="button" className="spend-value" aria-haspopup="dialog" aria-expanded={open} onClick={() => { setDraft(wheelsFromHours(hours)); setError(''); setOpen(!open); }} data-testid="button-hours">{hours === null ? 'Add' : formatHours(hours)}</button>
      {open && <div className="date-wheel-panel hours-panel" role="dialog" aria-label="Hours">
        <div className="date-wheels hours-wheels">
          <div className="date-wheel-band" aria-hidden="true"/>
          <Wheel label="Hours" items={hourItems.whole} index={draft[0]} onChange={(index) => setDraft(([, half]) => [index, half])} testId="wheel-hours"/>
          <Wheel label="Half hour" items={hourItems.half} index={draft[1]} onChange={(index) => setDraft(([whole]) => [whole, index])} testId="wheel-half-hour"/>
        </div>
        {error && <p className="field-error" role="alert">{error}</p>}
        <div className="date-wheel-actions">
          {hours !== null && <button type="button" className="button button-quiet" onClick={() => void save(null)} disabled={saving} data-testid="button-clear-hours">Clear</button>}
          <button type="button" className="button button-outline" onClick={() => setOpen(false)}>Cancel</button>
          <button type="button" className="button button-primary" onClick={() => void save(hoursFromWheels(draft))} disabled={saving} data-testid="button-save-hours">Done</button>
        </div>
      </div>}
    </dd>
  </div>;
}

// Shown once, right after a project is marked finished: hours and spend
// together, each optional.
export function FinishUpPrompt({ hours, cents, currency, onSaveHours, onSaveSpend, onDone }: {
  hours: number | null;
  cents: number | null;
  currency: string;
  onSaveHours: (hours: number | null) => Promise<unknown>;
  onSaveSpend: (cents: number | null) => Promise<unknown>;
  onDone: () => void;
}) {
  return <div className="confirm-banner finish-up" data-testid="prompt-finish-up">
    <div><b>Finish up</b>
      <dl className="detail-list finish-up-list">
        <HoursRow hours={hours} onSave={onSaveHours}/>
        <SpendRow cents={cents} currency={currency} onSave={onSaveSpend}/>
      </dl>
    </div>
    <button className="button button-primary" onClick={onDone} data-testid="button-finish-up-done">Done</button>
  </div>;
}

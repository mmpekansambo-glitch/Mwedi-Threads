import { useEffect, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';
import { currencySymbol, formatSpend, parseSpend, spendDraft } from '@/lib/money';

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

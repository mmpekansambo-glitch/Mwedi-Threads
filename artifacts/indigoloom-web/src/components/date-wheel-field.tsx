import { useEffect, useRef, useState } from 'react';
import { CalendarDays, X } from 'lucide-react';

export type DatePrecision = 'month' | 'day';

const ITEM_HEIGHT = 42;
const NO_DAY = '—';
const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const pad2 = (value: number) => String(value).padStart(2, '0');
const daysIn = (year: number, monthIndex: number) => new Date(year, monthIndex + 1, 0).getDate();

type Draft = { year: number; month: number; day: number };

function draftFromValue(value: string, precision: DatePrecision): Draft {
  const [year, month, day] = value.split('-').map(Number);
  const now = new Date();
  if (!year || !month) return { year: now.getFullYear(), month: now.getMonth(), day: 0 };
  return { year, month: month - 1, day: precision === 'day' && day ? day : 0 };
}

export function formatWheelDate(value: string, precision: DatePrecision): string {
  if (!value) return '';
  const { year, month, day } = draftFromValue(value, precision);
  return day ? `${monthNames[month]} ${day}, ${year}` : `${monthNames[month]} ${year}`;
}

export function Wheel({ label, items, index, onChange, testId }: {
  label: string;
  items: string[];
  index: number;
  onChange: (index: number) => void;
  testId: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const settleTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const wheel = ref.current;
    if (!wheel) return;
    window.clearTimeout(settleTimer.current);
    if (Math.round(wheel.scrollTop / ITEM_HEIGHT) !== index) wheel.scrollTop = index * ITEM_HEIGHT;
  }, [index]);

  useEffect(() => () => window.clearTimeout(settleTimer.current), []);

  const settle = () => {
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => {
      const wheel = ref.current;
      if (!wheel) return;
      const next = Math.max(0, Math.min(items.length - 1, Math.round(wheel.scrollTop / ITEM_HEIGHT)));
      if (next !== index) onChange(next);
    }, 120);
  };

  const step = (event: React.KeyboardEvent) => {
    const moves: Record<string, number> = { ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: items.length - 1 };
    if (!(event.key in moves)) return;
    event.preventDefault();
    onChange(Math.max(0, Math.min(items.length - 1, moves[event.key])));
  };

  return <div
    ref={ref}
    className="date-wheel"
    role="listbox"
    aria-label={label}
    aria-activedescendant={`${testId}-${index}`}
    tabIndex={0}
    onScroll={settle}
    onKeyDown={step}
    data-testid={testId}
  >
    {items.map((item, itemIndex) => <div
      key={item}
      id={`${testId}-${itemIndex}`}
      role="option"
      aria-selected={itemIndex === index}
      className={itemIndex === index ? 'selected' : ''}
      onClick={() => onChange(itemIndex)}
    >{item}</div>)}
  </div>;
}

export function DateWheelField({ id, label, value, precision, onValueChange, onPrecisionChange, testId }: {
  id: string;
  label: string;
  value: string;
  precision: DatePrecision;
  onValueChange: (value: string) => void;
  onPrecisionChange: (precision: DatePrecision) => void;
  testId: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => draftFromValue(value, precision));
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

  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: 71 }, (_, offset) => thisYear - 60 + offset);
  const dayCount = daysIn(draft.year, draft.month);
  const dayItems = [NO_DAY, ...Array.from({ length: dayCount }, (_, offset) => String(offset + 1))];

  const update = (next: Partial<Draft>) => setDraft((current) => {
    const merged = { ...current, ...next };
    return { ...merged, day: Math.min(merged.day, daysIn(merged.year, merged.month)) };
  });

  const openPicker = () => {
    setDraft(draftFromValue(value, precision));
    setOpen(!open);
  };

  const save = () => {
    const monthValue = `${draft.year}-${pad2(draft.month + 1)}`;
    onPrecisionChange(draft.day ? 'day' : 'month');
    onValueChange(draft.day ? `${monthValue}-${pad2(draft.day)}` : monthValue);
    setOpen(false);
  };

  const display = formatWheelDate(value, precision);

  return <div className="field-block date-wheel-field" ref={fieldRef}>
    <label htmlFor={id}>{label}</label>
    <div className="date-wheel-controls">
      <button
        type="button"
        id={id}
        className={`date-wheel-trigger${display ? '' : ' empty'}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={openPicker}
        data-testid={testId}
      >
        <CalendarDays size={17}/><span>{display || 'Choose a date'}</span>
      </button>
      {value && <button type="button" className="date-wheel-clear" aria-label={`Clear ${label}`} onClick={() => { onValueChange(''); setOpen(false); }} data-testid={`${testId}-clear`}><X size={16}/></button>}
    </div>
    {open && <div className="date-wheel-panel" role="dialog" aria-label={label}>
      <div className="date-wheels">
        <div className="date-wheel-band" aria-hidden="true"/>
        <Wheel label="Month" items={monthNames} index={draft.month} onChange={(month) => update({ month })} testId={`${testId}-month`}/>
        <Wheel label="Day (optional)" items={dayItems} index={draft.day} onChange={(day) => update({ day })} testId={`${testId}-day`}/>
        <Wheel label="Year" items={years.map(String)} index={Math.max(0, years.indexOf(draft.year))} onChange={(yearIndex) => update({ year: years[yearIndex] })} testId={`${testId}-year`}/>
      </div>
      <div className="date-wheel-actions">
        <button type="button" className="button button-outline" onClick={() => setOpen(false)}>Cancel</button>
        <button type="button" className="button button-primary" onClick={save} data-testid={`${testId}-done`}>Done</button>
      </div>
    </div>}
  </div>;
}

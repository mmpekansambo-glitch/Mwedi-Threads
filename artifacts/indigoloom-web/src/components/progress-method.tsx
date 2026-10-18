import { Plus, X } from 'lucide-react';
import type { CreateProgress, Project, ProgressMethod, ProgressSection, UpdateProject } from '@workspace/api-client-react';

export type ProgressSettingsDraft = { method: ProgressMethod; total: string; sections: ProgressSection[] };
export type ProgressAmountDraft = { percent: string; value: string; done: number[] };

export const defaultProgressSettings: ProgressSettingsDraft = { method: 'estimate', total: '', sections: [] };

const methods: { value: ProgressMethod; label: string; hint: string }[] = [
  { value: 'estimate', label: 'About how far along', hint: 'Give a rough percentage with each note.' },
  { value: 'rows', label: 'Rows or rounds', hint: 'Say which row or round you’re on with each note.' },
  { value: 'sections', label: 'Pattern sections', hint: 'Tick off each part as you finish it.' },
  { value: 'skeins', label: 'Skeins used', hint: 'Say how many skeins you’ve used with each note.' },
];

const isHalfStep = (value: number) => Number.isInteger(value * 2);
const formatAmount = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(1));

export function progressSettingsFromProject(project: Pick<Project, 'progressMethod' | 'progressTotal' | 'progressSections'>): ProgressSettingsDraft {
  return {
    method: project.progressMethod,
    total: project.progressTotal ? String(project.progressTotal) : '',
    sections: project.progressSections,
  };
}

export function progressSettingsError(draft: ProgressSettingsDraft): string {
  const total = Number(draft.total);
  if (draft.method === 'rows' && (!(total > 0) || !Number.isInteger(total))) return 'Add how many rows or rounds the project has.';
  if (draft.method === 'skeins' && (!(total > 0) || !isHalfStep(total))) return 'Add how many skeins you plan to use, in whole or half skeins.';
  if (draft.method === 'sections' && !draft.sections.some((section) => section.name.trim())) return 'Add at least one pattern section.';
  return '';
}

export function progressSettingsForApi(draft: ProgressSettingsDraft): Pick<UpdateProject, 'progressMethod' | 'progressTotal' | 'progressSections'> {
  const usesTotal = draft.method === 'rows' || draft.method === 'skeins';
  return {
    progressMethod: draft.method,
    progressTotal: usesTotal ? Number(draft.total) : null,
    progressSections: draft.sections.filter((section) => section.name.trim()).map((section) => ({ ...section, name: section.name.trim() })),
  };
}

// Shown on the project page under the percentage, e.g. "Row 50 of 200".
export function progressDetail(project: Pick<Project, 'progressMethod' | 'progressTotal' | 'progressSections'>, latestValue: number | null | undefined): string {
  const total = project.progressTotal;
  if (project.progressMethod === 'sections' && project.progressSections.length) {
    return `${project.progressSections.filter((section) => section.done).length} of ${project.progressSections.length} sections done`;
  }
  if (latestValue == null || !total) return '';
  if (project.progressMethod === 'rows') return `Row ${formatAmount(latestValue)} of ${formatAmount(total)}`;
  if (project.progressMethod === 'skeins') return `${formatAmount(latestValue)} of ${formatAmount(total)} skeins used`;
  return '';
}

export function ProgressMethodFields({ value, onChange, prefix, error }: {
  value: ProgressSettingsDraft;
  onChange: (next: ProgressSettingsDraft) => void;
  prefix: string;
  error: string;
}) {
  const chosen = methods.find((method) => method.value === value.method) ?? methods[0];
  const choose = (method: ProgressMethod) => onChange({
    ...value,
    method,
    sections: method === 'sections' && value.sections.length === 0 ? [{ name: '', done: false }] : value.sections,
  });
  const setSection = (position: number, name: string) => onChange({
    ...value,
    sections: value.sections.map((section, index) => (index === position ? { ...section, name } : section)),
  });

  return <div className="progress-method field-wide">
    <div className="progress-method-heading"><b>Track progress by</b><span>{chosen.hint}</span></div>
    <div className="designer-mode-switch progress-method-switch" role="radiogroup" aria-label="Track progress by">
      {methods.map((method) => <button
        key={method.value}
        type="button"
        role="radio"
        aria-checked={value.method === method.value}
        className={value.method === method.value ? 'selected' : ''}
        onClick={() => choose(method.value)}
        data-testid={`button-${prefix}-progress-${method.value}`}
      >{method.label}</button>)}
    </div>
    {(value.method === 'rows' || value.method === 'skeins') && <div className="field-block progress-total-field">
      <label htmlFor={`${prefix}-progress-total`}>{value.method === 'rows' ? 'Total rows or rounds' : 'Skeins planned'}</label>
      <input
        id={`${prefix}-progress-total`}
        type="number"
        inputMode="decimal"
        min={value.method === 'rows' ? 1 : 0.5}
        step={value.method === 'rows' ? 1 : 0.5}
        value={value.total}
        onChange={(event) => onChange({ ...value, total: event.target.value })}
        data-testid={`input-${prefix}-progress-total`}
      />
    </div>}
    {value.method === 'sections' && <div className="progress-sections">
      {value.sections.map((section, position) => <div className="progress-section-row" key={position}>
        <input
          aria-label={`Section ${position + 1}`}
          maxLength={80}
          placeholder={['e.g. Back', 'e.g. Front', 'e.g. Sleeves'][position] ?? 'Section name'}
          value={section.name}
          onChange={(event) => setSection(position, event.target.value)}
          data-testid={`input-${prefix}-section-${position}`}
        />
        {value.sections.length > 1 && <button type="button" className="icon-button" aria-label={`Remove section ${position + 1}`} onClick={() => onChange({ ...value, sections: value.sections.filter((_, index) => index !== position) })}><X size={16}/></button>}
      </div>)}
      {value.sections.length < 40 && <button type="button" className="button button-outline button-small" onClick={() => onChange({ ...value, sections: [...value.sections, { name: '', done: false }] })} data-testid={`button-${prefix}-add-section`}><Plus size={15}/> Add a section</button>}
    </div>}
    {error && <span className="field-error" role="alert">{error}</span>}
  </div>;
}

export function amountDraftFor(project: Pick<Project, 'completionPercent' | 'progressSections'>, latestValue: number | null | undefined): ProgressAmountDraft {
  return {
    percent: String(project.completionPercent),
    value: latestValue == null ? '' : String(latestValue),
    done: project.progressSections.flatMap((section, position) => (section.done ? [position] : [])),
  };
}

// The part of a progress note that records how far along the project is.
export function progressAmountForApi(project: Pick<Project, 'progressMethod' | 'progressTotal'>, draft: ProgressAmountDraft): Omit<CreateProgress, 'notes'> | string {
  const value = Number(draft.value);
  switch (project.progressMethod) {
    case 'rows':
      return draft.value !== '' && Number.isInteger(value) && value >= 0 ? { progressValue: value } : 'Say which row or round you’re on.';
    case 'skeins':
      return draft.value !== '' && isHalfStep(value) && value >= 0 ? { progressValue: value } : 'Say how many skeins you’ve used, in whole or half skeins.';
    case 'sections':
      return { sectionsDone: draft.done };
    default: {
      const percent = Number(draft.percent);
      return draft.percent !== '' && Number.isInteger(percent) && percent >= 0 && percent <= 100 ? { completionPercent: percent } : 'Give a percentage from 0 to 100.';
    }
  }
}

export function ProgressAmountField({ project, value, onChange }: {
  project: Pick<Project, 'progressMethod' | 'progressTotal' | 'progressSections'>;
  value: ProgressAmountDraft;
  onChange: (next: ProgressAmountDraft) => void;
}) {
  const total = project.progressTotal ?? 0;
  const amount = Number(value.value);
  const preview = total && value.value !== '' && amount >= 0 ? Math.min(100, Math.round((amount / total) * 100)) : null;

  if (project.progressMethod === 'sections') {
    return <fieldset className="field-block progress-section-checks">
      <legend>Which sections are done?</legend>
      {project.progressSections.map((section, position) => <label key={position} className="progress-section-check">
        <input
          type="checkbox"
          checked={value.done.includes(position)}
          onChange={(event) => onChange({ ...value, done: event.target.checked ? [...value.done, position] : value.done.filter((done) => done !== position) })}
          data-testid={`checkbox-section-${position}`}
        />
        <span>{section.name}</span>
      </label>)}
    </fieldset>;
  }

  if (project.progressMethod === 'rows' || project.progressMethod === 'skeins') {
    const rows = project.progressMethod === 'rows';
    return <div className="field-block">
      <label htmlFor="progress-value">{rows ? 'Which row or round are you on?' : 'How many skeins have you used?'}</label>
      <div className="progress-value-input">
        <input
          id="progress-value"
          type="number"
          inputMode="decimal"
          min={0}
          step={rows ? 1 : 0.5}
          value={value.value}
          onChange={(event) => onChange({ ...value, value: event.target.value })}
          data-testid="input-progress-value"
        />
        <span>of {formatAmount(total)}{preview !== null && ` · ${preview}%`}</span>
      </div>
    </div>;
  }

  return <div className="field-block">
    <label htmlFor="progress-percent">About how far along are you?</label>
    <div className="percent-input">
      <input id="progress-percent" type="number" min={0} max={100} value={value.percent} onChange={(event) => onChange({ ...value, percent: event.target.value })} data-testid="input-progress-percent"/>
      <span>%</span>
    </div>
  </div>;
}

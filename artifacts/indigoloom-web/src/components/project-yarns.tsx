import { Plus, Trash2 } from 'lucide-react';
import {
  getGetStashYarnsQueryKey, getGetYarnCatalogQueryKey, useGetStashYarns, useGetYarnCatalog,
} from '@workspace/api-client-react';
import type { ProjectYarn, ProjectYarnInput, StashYarn } from '@workspace/api-client-react';
import { ColorDot, DidYouMean, useSettledValue } from '@/components/yarn-fields';

export type YarnDraft = {
  key: string;
  stashYarnId: string | null;
  brand: string; subBrand: string; color: string;
  heldTogether: boolean;
  skeinsUsed: string;
};

let nextKey = 0;
const newKey = () => `yarn-${nextKey++}`;

export function emptyYarnDraft(change: Partial<YarnDraft> = {}): YarnDraft {
  return { key: newKey(), stashYarnId: null, brand: '', subBrand: '', color: '', heldTogether: false, skeinsUsed: '', ...change };
}

export function yarnDraftsFromProject(yarns: ProjectYarn[]): YarnDraft[] {
  return yarns.map((yarn) => emptyYarnDraft({
    stashYarnId: yarn.stashYarnId, brand: yarn.brand ?? '', subBrand: yarn.subBrand ?? '', color: yarn.color ?? '',
    heldTogether: yarn.heldTogether, skeinsUsed: yarn.skeinsUsed === null ? '' : String(yarn.skeinsUsed),
  }));
}

export function yarnsForApi(drafts: YarnDraft[]): ProjectYarnInput[] | string {
  const yarns: ProjectYarnInput[] = [];
  for (const draft of drafts) {
    const brand = draft.brand.trim(); const subBrand = draft.subBrand.trim(); const color = draft.color.trim();
    if (!draft.stashYarnId && !brand && !subBrand && !color) continue;
    if (!draft.stashYarnId && !brand) return 'Add a brand for each yarn so it goes in your stash.';
    let skeinsUsed: number | null = null;
    if (draft.skeinsUsed.trim()) {
      skeinsUsed = Number(draft.skeinsUsed);
      if (!Number.isFinite(skeinsUsed) || skeinsUsed < 0 || skeinsUsed > 999 || !Number.isInteger(skeinsUsed * 2)) {
        return 'Enter skeins used in whole or half skeins, like 2 or 1.5.';
      }
    }
    yarns.push({
      stashYarnId: draft.stashYarnId, brand: brand || null, subBrand: subBrand || null, color: color || null,
      heldTogether: yarns.length > 0 && draft.heldTogether, skeinsUsed,
    });
  }
  return yarns;
}

export function describeProjectYarn(yarn: Pick<ProjectYarn, 'brand' | 'subBrand' | 'color'>): string {
  return [[yarn.brand, yarn.subBrand].filter(Boolean).join(' '), yarn.color].filter(Boolean).join(' · ');
}

function stashLabel(yarn: StashYarn): string {
  return [[yarn.brand, yarn.subBrand].filter(Boolean).join(' '), yarn.color].filter(Boolean).join(' · ');
}

function YarnRow({ draft, index, idPrefix, stash, onChange, onRemove }: {
  draft: YarnDraft; index: number; idPrefix: string; stash: StashYarn[];
  onChange: (change: Partial<YarnDraft>) => void; onRemove: () => void;
}) {
  const id = `${idPrefix}-yarn-${index}`;
  const linked = stash.find((yarn) => yarn.id === draft.stashYarnId);
  const catalogParams = {
    brand: useSettledValue(draft.brand.trim()),
    subBrand: useSettledValue(draft.subBrand.trim()),
    color: useSettledValue(draft.color.trim()),
  };
  const catalog = useGetYarnCatalog(catalogParams, {
    query: { queryKey: getGetYarnCatalogQueryKey(catalogParams), enabled: !draft.stashYarnId && Boolean(catalogParams.brand), placeholderData: (previous) => previous },
  });
  // Typing over a stash yarn's names makes it a new yarn for the stash.
  const type = (change: Partial<YarnDraft>) => onChange({ ...change, stashYarnId: null });
  const pick = (stashYarnId: string) => {
    const yarn = stash.find((item) => item.id === stashYarnId);
    if (!yarn) return onChange({ stashYarnId: null });
    onChange({ stashYarnId: yarn.id, brand: yarn.brand, subBrand: yarn.subBrand ?? '', color: yarn.color ?? '' });
  };
  const suggestions = draft.stashYarnId ? undefined : catalog.data?.suggestions;

  return <div className="project-yarn" data-testid={`project-yarn-${index}`}>
    <div className="project-yarn-head">
      <b>Yarn {index + 1}</b>
      {index > 0 && <label className="held-together"><input type="checkbox" checked={draft.heldTogether} onChange={(event) => onChange({ heldTogether: event.target.checked })} data-testid={`${id}-held`}/>Held together with yarn {index}</label>}
      <button type="button" className="icon-button" aria-label={`Remove yarn ${index + 1}`} title="Remove yarn" onClick={onRemove} data-testid={`${id}-remove`}><Trash2 size={15}/></button>
    </div>
    {stash.length > 0 && <div className="field-block">
      <label htmlFor={`${id}-stash`}>From your stash</label>
      <span className="stash-pick">
        {linked && <ColorDot color={linked.generalColor}/>}
        <select id={`${id}-stash`} value={draft.stashYarnId ?? ''} onChange={(event) => pick(event.target.value)} data-testid={`${id}-stash`}>
          <option value="">A new yarn</option>
          {stash.map((yarn) => <option key={yarn.id} value={yarn.id}>{stashLabel(yarn)}</option>)}
        </select>
      </span>
    </div>}
    <div className="yarn-trifold project-yarn-fields">
      <div className="field-block"><label htmlFor={`${id}-brand`}>Brand</label><input id={`${id}-brand`} list={`${id}-brand-options`} maxLength={80} placeholder="e.g. Cascade" value={draft.brand} onChange={(event) => type({ brand: event.target.value })} autoComplete="off" data-testid={`${id}-brand`}/><datalist id={`${id}-brand-options`}>{catalog.data?.brands.map((name) => <option key={name} value={name}/>)}</datalist><DidYouMean suggestion={suggestions?.brand} typed={draft.brand} onAccept={(brand) => type({ brand })} testId={`${id}-did-you-mean-brand`}/></div>
      <div className="field-block"><label htmlFor={`${id}-sub-brand`}>Sub brand</label><input id={`${id}-sub-brand`} list={`${id}-sub-brand-options`} maxLength={80} placeholder="e.g. 220 Superwash" value={draft.subBrand} onChange={(event) => type({ subBrand: event.target.value })} autoComplete="off" data-testid={`${id}-sub-brand`}/><datalist id={`${id}-sub-brand-options`}>{catalog.data?.subBrands.map((line) => <option key={line.name} value={line.name}/>)}</datalist><DidYouMean suggestion={suggestions?.subBrand} typed={draft.subBrand} onAccept={(subBrand) => type({ subBrand })} testId={`${id}-did-you-mean-sub-brand`}/></div>
      <div className="field-block"><label htmlFor={`${id}-color`}>Color</label><input id={`${id}-color`} list={`${id}-color-options`} maxLength={80} placeholder="e.g. Oatmeal" value={draft.color} onChange={(event) => type({ color: event.target.value })} autoComplete="off" data-testid={`${id}-color`}/><datalist id={`${id}-color-options`}>{catalog.data?.colors.map((item) => <option key={item.name} value={item.name}/>)}</datalist><DidYouMean suggestion={suggestions?.color} typed={draft.color} onAccept={(color) => type({ color })} testId={`${id}-did-you-mean-color`}/></div>
      <div className="field-block"><label htmlFor={`${id}-skeins`}>Skeins used</label><input id={`${id}-skeins`} inputMode="decimal" placeholder="e.g. 2" value={draft.skeinsUsed} onChange={(event) => onChange({ skeinsUsed: event.target.value })} data-testid={`${id}-skeins`}/></div>
    </div>
  </div>;
}

export function ProjectYarnsField({ value, onChange, idPrefix, error }: {
  value: YarnDraft[]; onChange: (value: YarnDraft[]) => void; idPrefix: string; error?: string;
}) {
  const stashQuery = useGetStashYarns({}, { query: { queryKey: getGetStashYarnsQueryKey({}) } });
  const stash = stashQuery.data ?? [];
  const rows = value.length ? value : [emptyYarnDraft({ key: 'first' })];
  const update = (index: number, change: Partial<YarnDraft>) => onChange(rows.map((row, rowIndex) => rowIndex === index ? { ...row, ...change } : row));
  const last = rows[rows.length - 1];
  return <div className="yarn-group field-wide">
    <div className="yarn-group-heading"><b>Yarn</b></div>
    {rows.map((draft, index) => <YarnRow
      key={draft.key} draft={draft} index={index} idPrefix={idPrefix} stash={stash}
      onChange={(change) => update(index, change)}
      onRemove={() => onChange(rows.filter((_, rowIndex) => rowIndex !== index))}
    />)}
    {error && <span className="field-error">{error}</span>}
    {rows.length < 12 && <div className="project-yarn-actions">
      <button type="button" className="button button-quiet button-small" onClick={() => onChange([...rows, emptyYarnDraft()])} data-testid={`${idPrefix}-add-yarn`}><Plus size={15}/> Add another yarn</button>
      {(last.brand.trim() || last.subBrand.trim()) && <button type="button" className="button button-quiet button-small" onClick={() => onChange([...rows, emptyYarnDraft({ brand: last.brand, subBrand: last.subBrand })])} data-testid={`${idPrefix}-add-color`}><Plus size={15}/> Add another color of this yarn</button>}
    </div>}
  </div>;
}

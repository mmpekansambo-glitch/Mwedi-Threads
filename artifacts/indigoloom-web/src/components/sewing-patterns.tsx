import { useState } from 'react';
import { Link } from 'wouter';
import { Plus, Search, Shirt, X } from 'lucide-react';
import {
  getGetSewingPatternsQueryKey, useGetSewingPatterns,
  type SewingPattern, type SewingPatternFormat, type SewingPatternType,
} from '@workspace/api-client-react';

// A to Z, with Other last.
export const patternTypes: Array<{ value: SewingPatternType; label: string }> = [
  { value: 'accessories', label: 'Accessories' },
  { value: 'activewear', label: 'Activewear' },
  { value: 'baby', label: 'Baby' },
  { value: 'bag', label: 'Bag' },
  { value: 'coat', label: 'Coat' },
  { value: 'costume', label: 'Costume' },
  { value: 'dress', label: 'Dress' },
  { value: 'home', label: 'Home' },
  { value: 'jacket', label: 'Jacket' },
  { value: 'jumpsuit', label: 'Jumpsuit' },
  { value: 'kids', label: 'Kids' },
  { value: 'knitwear', label: 'Knit top or sweater' },
  { value: 'lingerie', label: 'Lingerie' },
  { value: 'menswear', label: 'Menswear' },
  { value: 'quilt', label: 'Quilt' },
  { value: 'shirt', label: 'Shirt' },
  { value: 'shorts', label: 'Shorts' },
  { value: 'skirt', label: 'Skirt' },
  { value: 'sleepwear', label: 'Sleepwear' },
  { value: 'swimwear', label: 'Swimwear' },
  { value: 'top', label: 'Top' },
  { value: 'trousers', label: 'Trousers' },
  { value: 'other', label: 'Other' },
];

export const patternFormats: Array<{ value: SewingPatternFormat; label: string }> = [
  { value: 'paper', label: 'Paper' },
  { value: 'pdf', label: 'PDF' },
  { value: 'magazine', label: 'Magazine' },
  { value: 'self_drafted', label: 'Self-drafted' },
];

const label = <T extends string>(options: Array<{ value: T; label: string }>, value: T | null) =>
  options.find((item) => item.value === value)?.label;

export function patternDetails(pattern: Pick<SewingPattern, 'designer' | 'patternType' | 'format' | 'sizes'>): string {
  return [label(patternTypes, pattern.patternType), label(patternFormats, pattern.format), pattern.designer, pattern.sizes && `Sizes ${pattern.sizes}`]
    .filter(Boolean).join(' · ');
}

export function timesMadeLabel(times: number): string {
  return times === 1 ? 'Made once' : `Made ${times} times`;
}

export function patternPhotoUrl(pattern: Pick<SewingPattern, 'id' | 'updatedAt'>): string {
  return `/api/sewing-patterns/${pattern.id}/photo?v=${encodeURIComponent(String(pattern.updatedAt))}`;
}

export function PatternThumb({ pattern }: { pattern?: Pick<SewingPattern, 'id' | 'updatedAt' | 'hasPhoto'> }) {
  return <span className="tool-thumb">{pattern?.hasPhoto ? <img src={patternPhotoUrl(pattern)} alt="" loading="lazy"/> : <Shirt size={22} aria-hidden="true"/>}</span>;
}

// The pattern a project uses: one from the stash, or a new one typed here
// that the server adds to the stash when the project is saved.
export type ChosenPattern = { id: string; name: string; designer: string | null; pattern?: SewingPattern } | { id: null; name: string; designer: string | null };

export function patternForApi(chosen: ChosenPattern | null) {
  if (!chosen) return { patternId: null, patternName: null, patternDesigner: null };
  if (chosen.id) return { patternId: chosen.id };
  return { patternId: null, patternName: chosen.name, patternDesigner: chosen.designer };
}

// Lists the maker's patterns to pick from, with a short form for one that
// isn't in the stash yet.
export function SewingPatternPicker({ onPick, onClose }: { onPick: (chosen: ChosenPattern) => void; onClose: () => void }) {
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [designer, setDesigner] = useState('');
  const patterns = useGetSewingPatterns({}, { query: { queryKey: getGetSewingPatternsQueryKey({}) } });
  const term = search.trim().toLowerCase();
  const shown = (patterns.data ?? []).filter((pattern) => !term || `${pattern.name} ${pattern.designer ?? ''}`.toLowerCase().includes(term));
  const addNew = () => {
    if (!name.trim()) return;
    onPick({ id: null, name: name.trim(), designer: designer.trim() || null });
  };
  return <div className="fabric-picker" role="group" aria-label="Choose a pattern">
    <div className="fabric-picker-head"><b>Your patterns</b><button type="button" className="icon-button" onClick={onClose} aria-label="Close pattern list"><X size={16}/></button></div>
    {adding ? <div className="pattern-new">
      <input autoFocus maxLength={160} placeholder="Pattern name" value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addNew(); } }} aria-label="Pattern name" data-testid="input-new-pattern-name"/>
      <input maxLength={160} placeholder="Designer (optional)" value={designer} onChange={(event) => setDesigner(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addNew(); } }} aria-label="Designer" data-testid="input-new-pattern-designer"/>
      <div className="pattern-new-actions">
        <button type="button" className="button button-quiet button-small" onClick={() => setAdding(false)}>Back</button>
        <button type="button" className="button button-primary button-small" disabled={!name.trim()} onClick={addNew} data-testid="button-use-new-pattern">Use this pattern</button>
      </div>
    </div> : <>
      {(patterns.data?.length ?? 0) > 6 && <label className="search-box pattern-picker-search"><Search size={15}/><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search your patterns…" aria-label="Search your patterns"/></label>}
      {patterns.isLoading ? <p className="fabric-picker-note">Loading your patterns…</p>
        : shown.length ? <div className="tool-picker-list">{shown.map((pattern) => <button key={pattern.id} type="button" className="tool-pick" onClick={() => onPick({ id: pattern.id, name: pattern.name, designer: pattern.designer, pattern })} data-testid={`button-pick-pattern-${pattern.id}`}>
          <PatternThumb pattern={pattern}/><span><b>{pattern.name}</b><small>{patternDetails(pattern) || timesMadeLabel(pattern.timesMade)}</small></span>
        </button>)}</div>
        : <p className="fabric-picker-note">{patterns.data?.length ? 'No patterns match.' : 'Your pattern stash is empty.'}</p>}
      <button type="button" className="button button-outline button-small pattern-add-new" onClick={() => { setName(search.trim()); setAdding(true); }} data-testid="button-new-pattern"><Plus size={15}/> A pattern not in your stash</button>
    </>}
  </div>;
}

export function ChosenPatternRow({ chosen, onRemove }: { chosen: ChosenPattern; onRemove: () => void }) {
  const pattern = chosen.id ? chosen.pattern : undefined;
  const details = pattern ? patternDetails(pattern) : chosen.designer;
  return <div className="sewing-tool-row" data-testid="sewing-pattern-chosen">
    <PatternThumb pattern={pattern}/>
    <span className="sewing-fabric-name">
      <b>{chosen.id ? <Link href={`/sewing/patterns/${chosen.id}`}>{chosen.name}</Link> : chosen.name}</b>
      <small>{[details, !chosen.id && 'Adds to your patterns when you save'].filter(Boolean).join(' · ')}</small>
    </span>
    <button type="button" className="icon-button" aria-label={`Remove ${chosen.name}`} onClick={onRemove} data-testid="button-remove-sewing-pattern"><X size={15}/></button>
  </div>;
}

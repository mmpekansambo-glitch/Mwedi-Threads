import { useEffect, useRef, useState } from 'react';
import type { SewingTool, SewingToolCategory, SewingToolSection } from '@workspace/api-client-react';
import { Wheel } from '@/components/date-wheel-field';
import {
  Anchor, Box, Cable, Circle, CircleDot, Cog, Feather, Footprints, Grip, Hexagon, Layers, Link2, Magnet, Pin, Ribbon, Ruler, Scissors, Spool, Tag, Zap,
  Shapes, type LucideIcon,
} from 'lucide-react';

export const toolSections: Array<{ value: SewingToolSection; label: string; one: string }> = [
  { value: 'notions', label: 'Notions', one: 'notion' },
  { value: 'kit', label: 'Kit', one: 'kit' },
];

type CategoryOption = { value: SewingToolCategory; label: string; section: SewingToolSection | 'both'; group: string; icon: LucideIcon; example: string };

// Notions are grouped so the long list stays easy to scan.
export const toolCategories: CategoryOption[] = [
  { value: 'zip', label: 'Zip', section: 'notions', group: 'Closures', icon: Zap, example: 'Invisible zip' },
  { value: 'button', label: 'Buttons', section: 'notions', group: 'Closures', icon: Circle, example: 'Shell buttons' },
  { value: 'snap', label: 'Snaps', section: 'notions', group: 'Closures', icon: CircleDot, example: 'Press studs' },
  { value: 'hook_and_eye', label: 'Hooks and eyes', section: 'notions', group: 'Closures', icon: Link2, example: 'Skirt hooks' },
  { value: 'hook_and_loop', label: 'Hook and loop (Velcro)', section: 'notions', group: 'Closures', icon: Grip, example: 'Sew-on hook and loop' },
  { value: 'magnetic_clasp', label: 'Magnetic clasps', section: 'notions', group: 'Closures', icon: Magnet, example: 'Bag magnetic snaps' },
  { value: 'toggle', label: 'Toggles', section: 'notions', group: 'Closures', icon: Feather, example: 'Wooden toggles' },
  { value: 'elastic', label: 'Elastic', section: 'notions', group: 'Trims and tapes', icon: Cable, example: 'Waistband elastic' },
  { value: 'bias_tape', label: 'Bias tape', section: 'notions', group: 'Trims and tapes', icon: Ribbon, example: 'Double-fold bias tape' },
  { value: 'ribbon', label: 'Ribbon', section: 'notions', group: 'Trims and tapes', icon: Ribbon, example: 'Grosgrain ribbon' },
  { value: 'lace', label: 'Lace', section: 'notions', group: 'Trims and tapes', icon: Ribbon, example: 'Cotton lace trim' },
  { value: 'piping', label: 'Piping', section: 'notions', group: 'Trims and tapes', icon: Cable, example: 'Satin piping' },
  { value: 'cord', label: 'Cord or drawstring', section: 'notions', group: 'Trims and tapes', icon: Cable, example: 'Cotton drawstring' },
  { value: 'twill_tape', label: 'Twill or hem tape', section: 'notions', group: 'Trims and tapes', icon: Ribbon, example: 'Twill tape' },
  { value: 'buckle', label: 'Buckles and sliders', section: 'notions', group: 'Hardware', icon: Hexagon, example: 'Strap sliders' },
  { value: 'd_ring', label: 'D-rings', section: 'notions', group: 'Hardware', icon: Link2, example: 'Brass D-rings' },
  { value: 'eyelet', label: 'Eyelets and grommets', section: 'notions', group: 'Hardware', icon: CircleDot, example: 'Silver eyelets' },
  { value: 'rivet', label: 'Rivets', section: 'notions', group: 'Hardware', icon: Anchor, example: 'Jeans rivets' },
  { value: 'interfacing', label: 'Interfacing', section: 'notions', group: 'Shaping and backing', icon: Layers, example: 'Fusible interfacing' },
  { value: 'boning', label: 'Boning', section: 'notions', group: 'Shaping and backing', icon: Ruler, example: 'Spiral steel boning' },
  { value: 'batting', label: 'Batting (wadding)', section: 'notions', group: 'Shaping and backing', icon: Layers, example: 'Cotton batting' },
  { value: 'stabilizer', label: 'Stabilizer', section: 'notions', group: 'Shaping and backing', icon: Layers, example: 'Tear-away stabilizer' },
  { value: 'fusible_web', label: 'Fusible web', section: 'notions', group: 'Shaping and backing', icon: Layers, example: 'Hemming web' },
  { value: 'thread', label: 'Thread', section: 'notions', group: 'Thread and labels', icon: Spool, example: 'All-purpose thread' },
  { value: 'label', label: 'Labels', section: 'notions', group: 'Thread and labels', icon: Tag, example: 'Handmade labels' },
  { value: 'machine', label: 'Machine', section: 'kit', group: 'Kit', icon: Cog, example: 'Overlocker' },
  { value: 'presser_foot', label: 'Presser foot', section: 'kit', group: 'Kit', icon: Footprints, example: 'Walking foot' },
  { value: 'needle', label: 'Needles', section: 'kit', group: 'Kit', icon: Pin, example: 'Jersey needles' },
  { value: 'scissors', label: 'Scissors', section: 'kit', group: 'Kit', icon: Scissors, example: 'Fabric shears' },
  { value: 'ruler', label: 'Ruler', section: 'kit', group: 'Kit', icon: Ruler, example: 'Quilting ruler' },
  { value: 'other', label: 'Other', section: 'both', group: 'Other', icon: Box, example: 'Tailor’s ham' },
];

export function categoriesFor(section: SewingToolSection): CategoryOption[] {
  return toolCategories.filter((item) => item.section === section || item.section === 'both');
}

// A section's types under their group headings, in list order.
export function categoryGroupsFor(section: SewingToolSection): Array<{ group: string; options: CategoryOption[] }> {
  const groups: Array<{ group: string; options: CategoryOption[] }> = [];
  for (const option of categoriesFor(section)) {
    const last = groups[groups.length - 1];
    if (last?.group === option.group) last.options.push(option);
    else groups.push({ group: option.group, options: [option] });
  }
  return groups;
}

// One row per group, each with its types A to Z. Notions keep Other as a
// last row of its own; Kit is one list with Other at the end.
export function typeRowsFor(section: SewingToolSection): Array<{ group: string; options: CategoryOption[] }> {
  const byLabel = (a: CategoryOption, b: CategoryOption) => a.label.localeCompare(b.label);
  const other = categoryFor('other');
  if (section === 'kit') return [{ group: 'Kit', options: [...toolCategories.filter((item) => item.section === 'kit').sort(byLabel), other] }];
  return [
    ...categoryGroupsFor(section).filter(({ group }) => group !== 'Other').map(({ group, options }) => ({ group, options: [...options].sort(byLabel) })),
    { group: 'Other', options: [other] },
  ];
}

const slug = (group: string) => group.toLowerCase().replace(/[^a-z]+/g, '-');

export function categoryFor(category: SewingToolCategory): CategoryOption {
  return toolCategories.find((item) => item.value === category) ?? toolCategories[toolCategories.length - 1]!;
}

export function toolDetails(tool: Pick<SewingTool, 'category' | 'size' | 'color' | 'brand'>): string {
  return [categoryFor(tool.category).label, tool.size, tool.color, tool.brand].filter(Boolean).join(' · ');
}

export function toolPhotoUrl(tool: Pick<SewingTool, 'id' | 'updatedAt'>): string {
  return `/api/sewing-tools/${tool.id}/photo?v=${encodeURIComponent(String(tool.updatedAt))}`;
}

// Quantities are typed as text and checked before saving.
export function quantityForApi(value: string): number | null | 'invalid' {
  if (!value.trim()) return null;
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 && number <= 9999 ? number : 'invalid';
}

export function ToolThumb({ tool }: { tool: SewingTool }) {
  const Icon = categoryFor(tool.category).icon;
  return <span className="tool-thumb">{tool.hasPhoto ? <img src={toolPhotoUrl(tool)} alt="" loading="lazy"/> : <Icon size={22} aria-hidden="true"/>}</span>;
}

// Each group keeps its heading with its own scroll wheel under it, like the
// date picker. A tool has one type, so choosing in one group replaces the rest.
export function ToolTypeWheelField({ section, value, onChange, error }: {
  section: SewingToolSection;
  value: SewingToolCategory | '';
  onChange: (value: SewingToolCategory) => void;
  error?: string;
}) {
  return <div className="field-block tool-type-field">
    <span className="field-label">Type <b>*</b></span>
    {typeRowsFor(section).map(({ group, options }) => options.length === 1
      ? <OtherTypeButton key={group} option={options[0]!} selected={value === options[0]!.value} onChange={onChange}/>
      : <GroupWheelField key={group} group={group} options={options} value={value} onChange={onChange}/>)}
    {error && <span className="field-error">{error}</span>}
  </div>;
}

function OtherTypeButton({ option, selected, onChange }: { option: CategoryOption; selected: boolean; onChange: (value: SewingToolCategory) => void }) {
  return <div className="tool-type-row">
    <span className="tool-type-group">Other</span>
    <button type="button" className={`date-wheel-trigger${selected ? ' chosen' : ' empty'}`} aria-pressed={selected} onClick={() => onChange(option.value)} data-testid="select-tool-type-other">
      <Box size={17}/><span>{selected ? 'Other' : 'Not in the lists above'}</span>
    </button>
  </div>;
}

function GroupWheelField({ group, options, value, onChange }: {
  group: string;
  options: CategoryOption[];
  value: SewingToolCategory | '';
  onChange: (value: SewingToolCategory) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(0);
  const fieldRef = useRef<HTMLDivElement>(null);
  const chosenHere = options.find((item) => item.value === value);
  const testId = `select-tool-type-${slug(group)}`;

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
  const Icon = chosenHere?.icon ?? Shapes;

  return <div className="tool-type-row date-wheel-field" ref={fieldRef}>
    <span className="tool-type-group" id={`${testId}-label`}>{group}</span>
    <button type="button" className={`date-wheel-trigger${chosenHere ? ' chosen' : ' empty'}`} aria-labelledby={`${testId}-label`} aria-haspopup="dialog" aria-expanded={open} onClick={openPicker} data-testid={testId}>
      <Icon size={17}/><span>{chosenHere?.label ?? 'Choose'}</span>
    </button>
    {open && <div className="date-wheel-panel tool-type-panel" role="dialog" aria-label={group}>
      <div className="date-wheels tool-type-wheels">
        <div className="date-wheel-band" aria-hidden="true"/>
        <Wheel label={group} items={options.map((item) => item.label)} index={draft} onChange={setDraft} testId={`${testId}-wheel`}/>
      </div>
      <div className="date-wheel-actions">
        <button type="button" className="button button-outline" onClick={() => setOpen(false)}>Cancel</button>
        <button type="button" className="button button-primary" onClick={() => { onChange(options[draft]!.value); setOpen(false); }} data-testid={`${testId}-done`}>Done</button>
      </div>
    </div>}
  </div>;
}

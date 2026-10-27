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

// The wheel shows each group's types A to Z, with Other as its own last group.
export function wheelGroupsFor(section: SewingToolSection): Array<{ group: string; options: CategoryOption[] }> {
  const groups = categoryGroupsFor(section).map(({ group, options }) => ({
    group: section === 'kit' && group !== 'Other' ? 'Kit' : group,
    options: [...options].sort((a, b) => a.label.localeCompare(b.label)),
  }));
  return [...groups.filter((item) => item.group !== 'Other'), ...groups.filter((item) => item.group === 'Other')];
}

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

// Type picker as scroll wheels like the date picker: group on the left and
// its types A to Z on the right. Kit has one short list, so it gets one wheel
// with Other at the end.
export function ToolTypeWheelField({ section, value, onChange, error }: {
  section: SewingToolSection;
  value: SewingToolCategory | '';
  onChange: (value: SewingToolCategory) => void;
  error?: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ group: 0, item: 0 });
  const fieldRef = useRef<HTMLDivElement>(null);
  const groups = wheelGroupsFor(section);
  const kitItems = groups.flatMap(({ options }) => options);
  const twoWheels = section === 'notions';

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
    if (twoWheels) {
      const group = Math.max(0, groups.findIndex(({ options }) => options.some((item) => item.value === value)));
      setDraft({ group, item: Math.max(0, groups[group]!.options.findIndex((item) => item.value === value)) });
    } else {
      setDraft({ group: 0, item: Math.max(0, kitItems.findIndex((item) => item.value === value)) });
    }
    setOpen(!open);
  };
  const chosen = twoWheels ? groups[draft.group]?.options[draft.item] : kitItems[draft.item];
  const label = value ? categoryFor(value).label : '';

  return <div className="field-block date-wheel-field" ref={fieldRef}>
    <label htmlFor="tool-category">Type <b>*</b></label>
    <button type="button" id="tool-category" className={`date-wheel-trigger${label ? '' : ' empty'}`} aria-haspopup="dialog" aria-expanded={open} onClick={openPicker} data-testid="select-tool-category">
      <Shapes size={17}/><span>{label ? (twoWheels ? `${categoryFor(value as SewingToolCategory).group} · ${label}` : label) : 'Choose a type'}</span>
    </button>
    {error && <span className="field-error">{error}</span>}
    {open && <div className="date-wheel-panel tool-type-panel" role="dialog" aria-label="Type">
      <div className={`date-wheels tool-type-wheels${twoWheels ? '' : ' single'}`}>
        <div className="date-wheel-band" aria-hidden="true"/>
        {twoWheels && <Wheel label="Group" items={groups.map(({ group }) => group)} index={draft.group} onChange={(group) => setDraft({ group, item: 0 })} testId="select-tool-group-wheel"/>}
        <Wheel
          label="Type"
          items={(twoWheels ? groups[draft.group]?.options ?? [] : kitItems).map((item) => item.label)}
          index={draft.item}
          onChange={(item) => setDraft((current) => ({ ...current, item }))}
          testId="select-tool-type-wheel"
          key={twoWheels ? draft.group : 'kit'}
        />
      </div>
      <div className="date-wheel-actions">
        <button type="button" className="button button-outline" onClick={() => setOpen(false)}>Cancel</button>
        <button type="button" className="button button-primary" onClick={() => { if (chosen) onChange(chosen.value); setOpen(false); }} data-testid="select-tool-category-done">Done</button>
      </div>
    </div>}
  </div>;
}

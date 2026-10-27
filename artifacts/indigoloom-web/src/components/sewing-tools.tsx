import type { SewingTool, SewingToolCategory, SewingToolSection } from '@workspace/api-client-react';
import {
  Anchor, Box, Cable, Circle, CircleDot, Cog, Feather, Footprints, Grip, Hexagon, Layers, Link2, Magnet, Pin, Ribbon, Ruler, Scissors, Spool, Tag, Zap,
  type LucideIcon,
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

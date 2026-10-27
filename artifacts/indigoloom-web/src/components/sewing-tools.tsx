import type { SewingTool, SewingToolCategory, SewingToolSection } from '@workspace/api-client-react';
import { Box, Cable, Circle, Cog, Footprints, Layers, Pin, Ruler, Scissors, Spool, Zap, type LucideIcon } from 'lucide-react';

export const toolSections: Array<{ value: SewingToolSection; label: string; one: string }> = [
  { value: 'notions', label: 'Notions', one: 'notion' },
  { value: 'kit', label: 'Kit', one: 'kit' },
];

type CategoryOption = { value: SewingToolCategory; label: string; section: SewingToolSection | 'both'; icon: LucideIcon; example: string };

export const toolCategories: CategoryOption[] = [
  { value: 'zip', label: 'Zip', section: 'notions', icon: Zap, example: 'Invisible zip' },
  { value: 'button', label: 'Buttons', section: 'notions', icon: Circle, example: 'Shell buttons' },
  { value: 'elastic', label: 'Elastic', section: 'notions', icon: Cable, example: 'Waistband elastic' },
  { value: 'thread', label: 'Thread', section: 'notions', icon: Spool, example: 'All-purpose thread' },
  { value: 'interfacing', label: 'Interfacing', section: 'notions', icon: Layers, example: 'Fusible interfacing' },
  { value: 'machine', label: 'Machine', section: 'kit', icon: Cog, example: 'Overlocker' },
  { value: 'presser_foot', label: 'Presser foot', section: 'kit', icon: Footprints, example: 'Walking foot' },
  { value: 'needle', label: 'Needles', section: 'kit', icon: Pin, example: 'Jersey needles' },
  { value: 'scissors', label: 'Scissors', section: 'kit', icon: Scissors, example: 'Fabric shears' },
  { value: 'ruler', label: 'Ruler', section: 'kit', icon: Ruler, example: 'Quilting ruler' },
  { value: 'other', label: 'Other', section: 'both', icon: Box, example: 'Tailor’s ham' },
];

export function categoriesFor(section: SewingToolSection): CategoryOption[] {
  return toolCategories.filter((item) => item.section === section || item.section === 'both');
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

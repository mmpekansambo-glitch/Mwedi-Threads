import { CrochetHookSize, KnittingNeedleSize } from '@workspace/api-client-react';
import type { KnittingNeedleType, YarnNotionType, YarnTool, YarnToolMaterial, YarnToolSection } from '@workspace/api-client-react';
import { forwardRef } from 'react';
import {
  Box, Grid3x3, Hash, MapPin, Pin, RotateCw, Ruler, Scissors, Spline, Wind, type LucideIcon,
} from 'lucide-react';

// Lucide has no crochet hook or knitting needle, so these two are drawn in
// the same stroke style.
export const HookIcon = forwardRef<SVGSVGElement, { size?: number | string }>(({ size = 24, ...rest }, ref) => <svg ref={ref} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
  <path d="M3 21 17 7"/><path d="M17 7c1.5-1.6 3.8-1.3 4 .3.2 1.3-1 2.2-2.3 1.7"/>
</svg>) as unknown as LucideIcon;

export const NeedleIcon = forwardRef<SVGSVGElement, { size?: number | string }>(({ size = 24, ...rest }, ref) => <svg ref={ref} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
  <path d="M3 21 15.5 8.5"/><circle cx="18" cy="6" r="2.8"/>
</svg>) as unknown as LucideIcon;

export const yarnToolSections: Array<{ value: YarnToolSection; label: string; one: string; icon: LucideIcon }> = [
  { value: 'hooks', label: 'Hooks', one: 'a hook', icon: HookIcon },
  { value: 'needles', label: 'Needles', one: 'needles', icon: NeedleIcon },
  { value: 'notions', label: 'Notions', one: 'a notion', icon: Box },
];

export const hookSizes = Object.values(CrochetHookSize) as string[];
export const needleSizes = Object.values(KnittingNeedleSize) as string[];

export const yarnToolMaterials: Array<{ value: YarnToolMaterial; label: string }> = [
  { value: 'aluminium', label: 'Aluminium' },
  { value: 'steel', label: 'Steel' },
  { value: 'bamboo', label: 'Bamboo' },
  { value: 'wood', label: 'Wood' },
  { value: 'plastic', label: 'Plastic' },
  { value: 'ergonomic', label: 'Ergonomic' },
];

export const yarnNeedleTypes: Array<{ value: KnittingNeedleType; label: string }> = [
  { value: 'straight', label: 'Straight' },
  { value: 'circular', label: 'Circular' },
  { value: 'double_pointed', label: 'Double-pointed' },
  { value: 'interchangeable', label: 'Interchangeable' },
];

type NotionOption = { value: YarnNotionType; label: string; icon: LucideIcon; example: string };

export const yarnNotionTypes: NotionOption[] = [
  { value: 'stitch_markers', label: 'Stitch markers', icon: MapPin, example: 'Locking stitch markers' },
  { value: 'tapestry_needles', label: 'Tapestry needles', icon: Spline, example: 'Bent-tip darning needles' },
  { value: 'row_counter', label: 'Row counter', icon: Hash, example: 'Clicker counter' },
  { value: 'cable_needles', label: 'Cable needles', icon: Spline, example: 'U-shaped cable needles' },
  { value: 'scissors', label: 'Scissors', icon: Scissors, example: 'Stork scissors' },
  { value: 'measuring_tape', label: 'Measuring tape', icon: Ruler, example: 'Retractable tape' },
  { value: 'blocking_mats', label: 'Blocking mats', icon: Grid3x3, example: 'Foam blocking mats' },
  { value: 'blocking_pins', label: 'Blocking pins', icon: Pin, example: 'T-pins' },
  { value: 'yarn_swift', label: 'Yarn swift', icon: Wind, example: 'Umbrella swift' },
  { value: 'ball_winder', label: 'Ball winder', icon: RotateCw, example: 'Hand-crank ball winder' },
  { value: 'other', label: 'Other', icon: Box, example: 'Yarn bowl' },
];

export const needleHasCable = (type: KnittingNeedleType | '' | null | undefined) => type === 'circular' || type === 'interchangeable';

export function notionFor(type: YarnNotionType | null): NotionOption | undefined {
  return yarnNotionTypes.find((item) => item.value === type);
}

const labelOf = <T extends string>(options: Array<{ value: T; label: string }>, value: T | null) =>
  options.find((item) => item.value === value)?.label;

// Hooks and needles are shown by size, notions by name or type.
export function yarnToolTitle(tool: YarnTool): string {
  if (tool.section === 'notions') return tool.name || notionFor(tool.notionType)?.label || 'Notion';
  return tool.name || tool.size || '';
}

export function yarnToolDetails(tool: YarnTool): string {
  const needleKind = tool.needleType ? labelOf(yarnNeedleTypes, tool.needleType)! + (needleHasCable(tool.needleType) && tool.cableLength ? `, ${tool.cableLength}` : '') : '';
  const parts = tool.section === 'notions'
    ? [tool.name ? notionFor(tool.notionType)?.label : '', tool.brand]
    : [tool.name ? tool.size : '', needleKind, labelOf(yarnToolMaterials, tool.material), tool.brand];
  return parts.filter(Boolean).join(' · ');
}

// Hooks and needles go smallest first; notions A to Z by type, then name.
export function sortYarnTools(tools: YarnTool[]): YarnTool[] {
  const sizeRank = (tool: YarnTool) => (tool.section === 'hooks' ? hookSizes : needleSizes).indexOf(tool.size ?? '');
  const notionRank = (tool: YarnTool) => yarnNotionTypes.findIndex((item) => item.value === tool.notionType);
  return [...tools].sort((a, b) => a.section === 'notions'
    ? notionRank(a) - notionRank(b) || yarnToolTitle(a).localeCompare(yarnToolTitle(b))
    : sizeRank(a) - sizeRank(b) || yarnToolDetails(a).localeCompare(yarnToolDetails(b)));
}

export function yarnToolPhotoUrl(tool: Pick<YarnTool, 'id' | 'updatedAt'>): string {
  return `/api/yarn-tools/${tool.id}/photo?v=${encodeURIComponent(String(tool.updatedAt))}`;
}

export function YarnToolThumb({ tool }: { tool: YarnTool }) {
  const Icon = tool.section === 'notions' ? notionFor(tool.notionType)?.icon ?? Box : yarnToolSections.find((item) => item.value === tool.section)!.icon;
  return <span className="tool-thumb">{tool.hasPhoto ? <img src={yarnToolPhotoUrl(tool)} alt="" loading="lazy"/> : <Icon size={22} aria-hidden="true"/>}</span>;
}

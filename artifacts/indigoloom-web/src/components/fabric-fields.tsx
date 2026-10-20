import type { FabricConstruction, FabricPrint, FabricType, FabricUnit, StashFabric } from '@workspace/api-client-react';

export const fabricTypes: Array<{ value: FabricType; label: string }> = [
  { value: 'cotton', label: 'Cotton' },
  { value: 'linen', label: 'Linen' },
  { value: 'jersey', label: 'Jersey' },
  { value: 'denim', label: 'Denim' },
  { value: 'silk', label: 'Silk' },
  { value: 'wool', label: 'Wool' },
  { value: 'polyester', label: 'Polyester' },
  { value: 'blend', label: 'Blend' },
  { value: 'other', label: 'Other' },
];

export const fabricConstructions: Array<{ value: FabricConstruction; label: string }> = [
  { value: 'woven', label: 'Woven' },
  { value: 'knit', label: 'Knit' },
];

export const fabricPrints: Array<{ value: FabricPrint; label: string }> = [
  { value: 'solid', label: 'Solid' },
  { value: 'floral', label: 'Floral' },
  { value: 'stripe', label: 'Stripe' },
  { value: 'check', label: 'Check or plaid' },
  { value: 'dots', label: 'Dots' },
  { value: 'geometric', label: 'Geometric' },
  { value: 'abstract', label: 'Abstract' },
  { value: 'animal', label: 'Animal' },
  { value: 'novelty', label: 'Novelty' },
];

// Meters go with centimeter widths, yards with inch widths.
export const fabricUnits: Array<{ value: FabricUnit; label: string; amount: string; width: string }> = [
  { value: 'meters', label: 'Meters', amount: 'm', width: 'cm' },
  { value: 'yards', label: 'Yards', amount: 'yd', width: 'in' },
];

export const maxFabricPhotos = 4;

export function labelFor<T extends string>(options: Array<{ value: T; label: string }>, value: T | null | undefined): string {
  return options.find((item) => item.value === value)?.label ?? '';
}

export function fabricName(fabric: Pick<StashFabric, 'fabricType' | 'print'>): string {
  const print = fabric.print && fabric.print !== 'solid' ? labelFor(fabricPrints, fabric.print).toLowerCase() : '';
  return [labelFor(fabricTypes, fabric.fabricType), print].filter(Boolean).join(', ');
}

export function fabricSize(fabric: Pick<StashFabric, 'amount' | 'width' | 'unit'>): string {
  const unit = fabricUnits.find((item) => item.value === fabric.unit) ?? fabricUnits[0];
  return [
    fabric.amount !== null ? `${fabric.amount} ${unit.amount}` : '',
    fabric.width !== null ? `${fabric.width} ${unit.width} wide` : '',
  ].filter(Boolean).join(' · ');
}

export function fabricPhotoUrl(fabric: Pick<StashFabric, 'id' | 'updatedAt'>, index: number): string {
  return `/api/fabric-stash/${fabric.id}/photos/${index}?v=${encodeURIComponent(String(fabric.updatedAt))}`;
}

// Amounts and widths are typed as text and checked before saving.
export function sizeForApi(value: string): number | null | 'invalid' {
  if (!value.trim()) return null;
  const number = Number(value.replace(',', '.'));
  return Number.isFinite(number) && number >= 0 && number <= 999 ? number : 'invalid';
}

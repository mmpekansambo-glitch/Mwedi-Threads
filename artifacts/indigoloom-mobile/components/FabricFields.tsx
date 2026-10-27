import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/expo';
import { Image } from 'expo-image';
import { View, type ImageStyle, type StyleProp, type ViewStyle } from 'react-native';
import type { FabricConstruction, FabricPrint, FabricType, FabricUnit, StashFabric } from '@workspace/api-client-react';

// A to Z with Other last.
export const fabricTypes: Array<{ value: FabricType; label: string }> = [
  { value: 'blend', label: 'Blend' },
  { value: 'canvas', label: 'Canvas' },
  { value: 'chambray', label: 'Chambray' },
  { value: 'chiffon', label: 'Chiffon' },
  { value: 'corduroy', label: 'Corduroy' },
  { value: 'cotton', label: 'Cotton' },
  { value: 'crepe', label: 'Crepe' },
  { value: 'denim', label: 'Denim' },
  { value: 'flannel', label: 'Flannel' },
  { value: 'fleece', label: 'Fleece' },
  { value: 'french_terry', label: 'French terry' },
  { value: 'jersey', label: 'Jersey' },
  { value: 'linen', label: 'Linen' },
  { value: 'polyester', label: 'Polyester' },
  { value: 'rib_knit', label: 'Rib knit' },
  { value: 'satin', label: 'Satin' },
  { value: 'silk', label: 'Silk' },
  { value: 'tulle', label: 'Tulle' },
  { value: 'velvet', label: 'Velvet' },
  { value: 'viscose', label: 'Viscose (rayon)' },
  { value: 'wool', label: 'Wool' },
  { value: 'other', label: 'Other' },
];

export const fabricConstructions: Array<{ value: FabricConstruction; label: string }> = [
  { value: 'woven', label: 'Woven' },
  { value: 'knit', label: 'Knit' },
];

// A to Z, so the print wheel and filters are easy to scan.
export const fabricPrints: Array<{ value: FabricPrint; label: string }> = [
  { value: 'abstract', label: 'Abstract' },
  { value: 'animal', label: 'Animal' },
  { value: 'ankara', label: 'Ankara (wax print)' },
  { value: 'batik', label: 'Batik' },
  { value: 'botanical', label: 'Botanical' },
  { value: 'camo', label: 'Camo' },
  { value: 'check', label: 'Check or plaid' },
  { value: 'chevron', label: 'Chevron' },
  { value: 'damask', label: 'Damask' },
  { value: 'dots', label: 'Dots' },
  { value: 'floral', label: 'Floral' },
  { value: 'geometric', label: 'Geometric' },
  { value: 'houndstooth', label: 'Houndstooth' },
  { value: 'ikat', label: 'Ikat' },
  { value: 'novelty', label: 'Novelty' },
  { value: 'ombre', label: 'Ombré' },
  { value: 'paisley', label: 'Paisley' },
  { value: 'solid', label: 'Solid' },
  { value: 'stripe', label: 'Stripe' },
  { value: 'tie_dye', label: 'Tie-dye' },
  { value: 'toile', label: 'Toile' },
  { value: 'other', label: 'Other' },
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

// Fabric photos are private, so they load with the signed-in maker's token.
export function FabricPhoto({ fabric, index, style }: { fabric: Pick<StashFabric, 'id' | 'updatedAt'>; index: number; style: StyleProp<ImageStyle> }) {
  const { getToken } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void getToken().then((value) => {
      if (active) setToken(value ?? null);
    });
    return () => { active = false; };
  }, [getToken]);
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (!domain || !token) return <View style={style as StyleProp<ViewStyle>} />;
  return (
    <Image
      source={{
        uri: `https://${domain}/api/fabric-stash/${fabric.id}/photos/${index}?v=${encodeURIComponent(String(fabric.updatedAt))}`,
        headers: { Authorization: `Bearer ${token}` },
      }}
      style={style}
      contentFit="cover"
      accessibilityLabel={index === 0 ? 'Print close-up' : `Fabric photo ${index + 1}`}
    />
  );
}

// Amounts and widths are typed as text and checked before saving.
export function sizeForApi(value: string): number | null | 'invalid' {
  if (!value.trim()) return null;
  const number = Number(value.replace(',', '.'));
  return Number.isFinite(number) && number >= 0 && number <= 999 ? number : 'invalid';
}

import colors from '@/constants/colors';
import { useScheme } from '@/hooks/useAppearance';

/**
 * Returns the design tokens for the current color scheme, plus `radius`.
 * The scheme follows the phone, unless the maker picked Light or Dark under
 * Appearance in Settings (see hooks/useAppearance.ts).
 */
export function useColors() {
  const palette = useScheme() === 'dark' ? colors.dark : colors.light;
  return { ...palette, radius: colors.radius };
}

// The Sewing room's screens use the same tokens with its own mauve.
export function useSewingColors() {
  const dark = useScheme() === 'dark';
  return { ...useColors(), ...(dark ? colors.sewing.dark : colors.sewing.light) };
}

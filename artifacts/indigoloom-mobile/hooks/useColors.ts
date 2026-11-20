import { useSegments } from 'expo-router';
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

// The colors of whichever room the screen belongs to, worked out from the
// route, so shared pieces (buttons, chips) turn violet in the Sewing room.
const sewingRoutes = new Set(['sewing', 'sewing-projects', 'fabric', 'patterns', 'tools']);
export function useRoomColors() {
  const segments = useSegments() as string[];
  const page = segments[0] === '(tabs)' ? segments[1] : segments[0];
  const yarn = useColors();
  const sewing = useSewingColors();
  return page && sewingRoutes.has(page) ? sewing : yarn;
}

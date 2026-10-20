import { useId } from 'react';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, Path } from 'react-native-svg';

// The yarn-ball badge from the web Mark in indigoloom-web/src/App.tsx, with
// the same palette colors.
const evergreen = '#1F2F16';
const granite = '#395B50';
const slate = '#5A7684';
const powder = '#92AFD7';

export function BrandMark({ size = 40 }: { size?: number }) {
  const id = useId().replace(/:/g, '');
  const ring = `${id}-ring`;
  const ball = `${id}-ball`;
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Defs>
        <ClipPath id={ring}><Circle cx="50" cy="50" r="42" /></ClipPath>
        <ClipPath id={ball}><Circle cx="50" cy="56" r="25" /></ClipPath>
      </Defs>
      <Circle cx="50" cy="50" r="44" fill="#FFFFFF" />
      <G clipPath={`url(#${ring})`}>
        <Path d="M21.3 79.8L76.2 27.3q2.5 -3.0 5.0 -0.5" fill="none" stroke={slate} strokeWidth={4} strokeLinecap="round" />
        <Circle cx="50" cy="56" r="25" fill={granite} />
        <G clipPath={`url(#${ball})`} fill="none" stroke="#FFFFFF" strokeWidth={2.6}>
          {[7, 16, 25, 34, 43].map((rx) => (
            <Ellipse key={rx} cx="27.5" cy="56" rx={rx} ry="40" transform="rotate(-30 50 56)" />
          ))}
        </G>
        <Path d="M65.0 76.0C75.0 89.8 79.0 71.7 94 74.2" fill="none" stroke={granite} strokeWidth={2.2} strokeLinecap="round" />
      </G>
      <Circle cx="50" cy="50" r="44" fill="none" stroke={evergreen} strokeWidth={5} />
      <Circle cx="30.2" cy="22.7" r="5.5" fill={powder} />
    </Svg>
  );
}

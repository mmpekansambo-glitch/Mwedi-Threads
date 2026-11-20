import type { CSSProperties, ReactNode } from 'react';
import { nameHash } from './name-tile';

// Building blocks for the open, paper-like layouts (#119): pinned swatches
// with pinked edges, running-stitch dividers and a greeting that follows
// the time of day.

export function greetingFor(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 5) return 'Evening';
  if (hour < 12) return 'Morning';
  if (hour < 17) return 'Afternoon';
  return 'Evening';
}

// A slight tilt that stays the same for the same name, so the board doesn't
// jump around between visits.
const tilts = [-2, 1.5, -1, 2, -1.5, 0.75];
export function tiltFor(name: string): number {
  return tilts[(nameHash(name) >> 5) % tilts.length];
}

const pins = ['pin-clay', 'pin-lichen', 'pin-acc', 'pin-violet'];

export function PinnedSwatch({ children, tilt = 0, pin = 0, tone = 0, className = '', testId }: { children: ReactNode; tilt?: number; pin?: number; tone?: number; className?: string; testId?: string }) {
  const style = { '--tilt': `${tilt}deg` } as CSSProperties;
  return <div className={`pinned-swatch swatch-tone-${tone % 4}${className ? ` ${className}` : ''}`} style={style} data-testid={testId}>
    <i className={`swatch-pin ${pins[pin % pins.length]}`} aria-hidden="true"/>
    <div className="pinned-swatch-body">{children}</div>
  </div>;
}

export function StitchDivider() {
  return <hr className="stitch-divider"/>;
}

// The bar that floats at the bottom of a project page with its quick actions.
export function FloatingBar({ label, children }: { label: ReactNode; children: ReactNode }) {
  return <div className="floating-bar" data-testid="floating-bar"><span className="floating-bar-label">{label}</span><span className="floating-bar-actions">{children}</span></div>;
}

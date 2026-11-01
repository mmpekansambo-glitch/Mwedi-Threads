import { SignedInGate } from '@/components/loom';
import { SewingPatternForm } from '@/components/SewingPatterns';

export default function NewPatternScreen() {
  return <SignedInGate><SewingPatternForm /></SignedInGate>;
}

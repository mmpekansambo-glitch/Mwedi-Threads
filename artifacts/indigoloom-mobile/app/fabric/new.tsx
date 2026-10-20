import { SignedInGate } from '@/components/loom';
import { FabricForm } from '@/components/FabricForm';

export default function NewFabricScreen() {
  return <SignedInGate><FabricForm /></SignedInGate>;
}

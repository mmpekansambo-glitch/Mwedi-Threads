import { SignedInGate } from '@/components/loom';
import { StashYarnForm } from '@/components/StashYarnForm';

export default function NewStashYarnScreen() {
  return <SignedInGate><StashYarnForm /></SignedInGate>;
}

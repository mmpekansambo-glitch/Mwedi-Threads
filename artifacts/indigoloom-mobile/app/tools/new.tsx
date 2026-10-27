import { useLocalSearchParams } from 'expo-router';
import { SignedInGate } from '@/components/loom';
import { SewingToolForm } from '@/components/SewingTools';

export default function NewToolScreen() {
  const { section } = useLocalSearchParams<{ section?: string }>();
  return <SignedInGate><SewingToolForm section={section === 'kit' ? 'kit' : 'notions'} /></SignedInGate>;
}

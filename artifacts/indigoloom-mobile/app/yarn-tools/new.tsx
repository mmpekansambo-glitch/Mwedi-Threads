import { useLocalSearchParams } from 'expo-router';
import { SignedInGate } from '@/components/loom';
import { YarnToolForm } from '@/components/YarnTools';

export default function NewYarnToolScreen() {
  const { section } = useLocalSearchParams<{ section?: string }>();
  return <SignedInGate><YarnToolForm section={section === 'needles' || section === 'notions' ? section : 'hooks'} /></SignedInGate>;
}

import { useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { LoomText, fonts } from '@/components/loom';
import { useColors, useSewingColors } from '@/hooks/useColors';
import { formatSpend, parseSpend, spendDraft } from '@/lib/money';
import { formatHours, hourItems, hoursFromWheels, wheelsFromHours } from '@/lib/hours';
import { ITEM_HEIGHT, Wheel } from '@/components/ProjectDateField';

// The project's total spend as one tap row. Tapping opens a sheet with a
// number pad; Clear removes it.
export function SpendRow({ cents, currency, onSave, sewing = false }: {
  cents: number | null;
  currency: string;
  onSave: (cents: number | null) => Promise<unknown>;
  sewing?: boolean;
}) {
  const yarnColors = useColors();
  const sewingColors = useSewingColors();
  const colors = sewing ? sewingColors : yarnColors;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async (value: string) => {
    const parsed = parseSpend(value);
    if (!parsed.ok) { setError('Enter an amount like 42.50.'); return; }
    setSaving(true);
    try {
      await onSave(parsed.cents);
      setOpen(false);
    } catch {
      setError('We couldn’t save that. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Pressable accessibilityRole="button" onPress={() => { setDraft(spendDraft(cents)); setError(''); setOpen(true); }} style={[styles.row, { borderBottomColor: colors.border }]} testID="button-total-spend">
        <LoomText style={{ flex: 1, color: colors.mutedForeground, fontSize: 14 }}>Total spend</LoomText>
        {cents === null ? (
          <View style={styles.value}>
            <LoomText style={{ color: colors.primaryText, fontFamily: fonts.semibold, fontSize: 14 }}>Add</LoomText>
            <Feather name="chevron-right" size={15} color={colors.primaryText} />
          </View>
        ) : <LoomText style={{ color: colors.foreground, fontFamily: fonts.medium, fontSize: 14 }} testID="text-total-spend">{formatSpend(cents, currency)}</LoomText>}
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
          <Pressable accessibilityLabel="Close total spend" onPress={() => setOpen(false)} style={StyleSheet.absoluteFill} />
          <View style={[styles.sheet, { backgroundColor: colors.card }]}>
            <View style={styles.heading}>
              <Pressable accessibilityRole="button" onPress={() => setOpen(false)} style={styles.headingButton}>
                <LoomText style={{ color: colors.mutedForeground, fontSize: 16 }}>Cancel</LoomText>
              </Pressable>
              <LoomText serif style={{ color: colors.foreground, fontSize: 20 }}>Total spend</LoomText>
              <Pressable accessibilityRole="button" disabled={saving} onPress={() => { void save(draft); }} style={styles.headingButton} testID="button-save-total-spend">
                <LoomText style={{ color: colors.primaryText, fontFamily: fonts.semibold, fontSize: 16, textAlign: 'right' }}>Done</LoomText>
              </Pressable>
            </View>
            <View style={[styles.inputRow, { borderColor: colors.border, backgroundColor: colors.selectedWash }]}>
              <LoomText style={{ color: colors.mutedForeground, fontFamily: fonts.semibold, fontSize: 16 }}>{currency}</LoomText>
              <TextInput
                autoFocus
                value={draft}
                onChangeText={(text) => { setDraft(text); setError(''); }}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={colors.mutedForeground}
                accessibilityLabel={`Total spend in ${currency}`}
                onSubmitEditing={() => { void save(draft); }}
                style={[styles.input, { color: colors.foreground }]}
                testID="input-total-spend"
              />
            </View>
            {error ? <LoomText accessibilityRole="alert" style={{ color: colors.destructive, fontSize: 14, marginTop: 8 }}>{error}</LoomText> : null}
            {cents !== null ? (
              <Pressable accessibilityRole="button" disabled={saving} onPress={() => { void save(''); }} style={styles.clear} testID="button-clear-total-spend">
                <LoomText style={{ color: colors.destructive, fontFamily: fonts.semibold, fontSize: 15 }}>Clear total spend</LoomText>
              </Pressable>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

// Total hours as one tap row; the sheet has a whole-hours wheel and a half wheel.
export function HoursRow({ hours, onSave, sewing = false }: {
  hours: number | null;
  onSave: (hours: number | null) => Promise<unknown>;
  sewing?: boolean;
}) {
  const yarnColors = useColors();
  const sewingColors = useSewingColors();
  const colors = sewing ? sewingColors : yarnColors;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<[number, number]>([0, 0]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async (value: number | null) => {
    setSaving(true);
    try {
      await onSave(value);
      setOpen(false);
    } catch {
      setError('We couldn’t save that. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Pressable accessibilityRole="button" onPress={() => { setDraft(wheelsFromHours(hours)); setError(''); setOpen(true); }} style={[styles.row, { borderBottomColor: colors.border }]} testID="button-hours">
        <LoomText style={{ flex: 1, color: colors.mutedForeground, fontSize: 14 }}>Hours</LoomText>
        {hours === null ? (
          <View style={styles.value}>
            <LoomText style={{ color: colors.primaryText, fontFamily: fonts.semibold, fontSize: 14 }}>Add</LoomText>
            <Feather name="chevron-right" size={15} color={colors.primaryText} />
          </View>
        ) : <LoomText style={{ color: colors.foreground, fontFamily: fonts.medium, fontSize: 14 }} testID="text-hours">{formatHours(hours)}</LoomText>}
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <Pressable accessibilityLabel="Close hours" onPress={() => setOpen(false)} style={StyleSheet.absoluteFill} />
          <View style={[styles.sheet, { backgroundColor: colors.card }]}>
            <View style={styles.heading}>
              <Pressable accessibilityRole="button" onPress={() => setOpen(false)} style={styles.headingButton}>
                <LoomText style={{ color: colors.mutedForeground, fontSize: 16 }}>Cancel</LoomText>
              </Pressable>
              <LoomText serif style={{ color: colors.foreground, fontSize: 20 }}>Hours</LoomText>
              <Pressable accessibilityRole="button" disabled={saving} onPress={() => { void save(hoursFromWheels(draft)); }} style={styles.headingButton} testID="button-save-hours">
                <LoomText style={{ color: colors.primaryText, fontFamily: fonts.semibold, fontSize: 16, textAlign: 'right' }}>Done</LoomText>
              </Pressable>
            </View>
            <View style={[styles.wheels, { backgroundColor: colors.selectedWash }]}>
              <View pointerEvents="none" style={[styles.wheelBand, { borderColor: colors.accent }]} />
              <Wheel label="Hours" items={hourItems.whole} index={draft[0]} onChange={(index) => setDraft(([, half]) => [index, half])} flex={1} testID="wheel-hours" />
              <Wheel label="Half hour" items={hourItems.half} index={draft[1]} onChange={(index) => setDraft(([whole]) => [whole, index])} flex={1} testID="wheel-half-hour" />
            </View>
            {error ? <LoomText accessibilityRole="alert" style={{ color: colors.destructive, fontSize: 14, marginTop: 8 }}>{error}</LoomText> : null}
            {hours !== null ? (
              <Pressable accessibilityRole="button" disabled={saving} onPress={() => { void save(null); }} style={styles.clear} testID="button-clear-hours">
                <LoomText style={{ color: colors.destructive, fontFamily: fonts.semibold, fontSize: 15 }}>Clear hours</LoomText>
              </Pressable>
            ) : null}
          </View>
        </View>
      </Modal>
    </>
  );
}

// Shown right after a project is marked finished: hours and spend together,
// each optional.
export function FinishUpPrompt({ hours, cents, currency, onSaveHours, onSaveSpend, onDone, sewing = false }: {
  hours: number | null;
  cents: number | null;
  currency: string;
  onSaveHours: (hours: number | null) => Promise<unknown>;
  onSaveSpend: (cents: number | null) => Promise<unknown>;
  onDone: () => void;
  sewing?: boolean;
}) {
  const yarnColors = useColors();
  const sewingColors = useSewingColors();
  const colors = sewing ? sewingColors : yarnColors;
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.primary }]} testID="prompt-finish-up">
      <LoomText style={{ color: colors.foreground, fontFamily: fonts.semibold, fontSize: 16, marginBottom: 4 }}>Finish up</LoomText>
      <HoursRow hours={hours} onSave={onSaveHours} sewing={sewing} />
      <SpendRow cents={cents} currency={currency} onSave={onSaveSpend} sewing={sewing} />
      <Pressable accessibilityRole="button" onPress={onDone} style={[styles.done, { backgroundColor: colors.primary }]} testID="button-finish-up-done">
        <LoomText style={{ color: colors.primaryForeground, fontFamily: fonts.semibold, fontSize: 15 }}>Done</LoomText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wheels: { flexDirection: 'row', borderRadius: 12, overflow: 'hidden', paddingHorizontal: 6 },
  wheelBand: { position: 'absolute', left: 8, right: 8, top: ITEM_HEIGHT * 2, height: ITEM_HEIGHT, borderTopWidth: 1.5, borderBottomWidth: 1.5 },
  card: { borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 12 },
  done: { alignSelf: 'flex-end', marginTop: 12, minHeight: 40, paddingHorizontal: 20, borderRadius: 99, alignItems: 'center', justifyContent: 'center' },
  row: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: 1 },
  value: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(31, 47, 22, 0.42)' },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 34 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 10 },
  headingButton: { minWidth: 64, paddingVertical: 10 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, minHeight: 56 },
  input: { flex: 1, fontSize: 24, fontFamily: fonts.semibold, textAlign: 'right' },
  clear: { alignSelf: 'center', paddingVertical: 12, marginTop: 6 },
});

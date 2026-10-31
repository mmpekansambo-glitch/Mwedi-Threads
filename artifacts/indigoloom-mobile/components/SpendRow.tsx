import { useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { LoomText, fonts } from '@/components/loom';
import { useColors, useSewingColors } from '@/hooks/useColors';
import { formatSpend, parseSpend, spendDraft } from '@/lib/money';

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

const styles = StyleSheet.create({
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

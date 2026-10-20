import { useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { getGetStashYarnReviewsQueryKey, useCreateCatalogReview } from '@workspace/api-client-react';
import type { CatalogField, CatalogReview } from '@workspace/api-client-react';
import { LoomButton, LoomText, fonts } from '@/components/loom';
import { useColors } from '@/hooks/useColors';

const fieldLabels: Record<CatalogField, string> = { brand: 'Brand', sub_brand: 'Sub brand', color: 'Color' };

// A field label with a question-mark button for asking a reviewer to look
// at how the catalog merged this name.
export function ReviewableLabel({ children, field, canReview, open, onToggle }: {
  children: string; field: CatalogField; canReview: boolean; open: boolean; onToggle: () => void;
}) {
  const colors = useColors();
  return (
    <View style={styles.labelRow}>
      <LoomText style={{ color: colors.foreground, fontFamily: fonts.semibold, fontSize: 15 }}>{children}</LoomText>
      {canReview ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`Ask for a review of this ${fieldLabels[field].toLowerCase()} name`} accessibilityState={{ expanded: open }} onPress={onToggle} hitSlop={10} testID={`button-review-${field}`}>
          <Feather name="help-circle" size={17} color={open ? colors.primary : colors.mutedForeground} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function NameReviewForm({ yarnId, field, currentName, onDone }: { yarnId: string; field: CatalogField; currentName: string; onDone: () => void }) {
  const colors = useColors();
  const client = useQueryClient();
  const create = useCreateCatalogReview();
  const [suggestedName, setSuggestedName] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const inputStyle = [styles.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.input }];
  const send = () => {
    if (!suggestedName.trim()) { setError('Enter the name you think it should be.'); return; }
    create.mutate({ data: { stashYarnId: yarnId, field, suggestedName: suggestedName.trim(), note: note.trim() || null } }, {
      onSuccess: () => { void client.invalidateQueries({ queryKey: getGetStashYarnReviewsQueryKey(yarnId) }); onDone(); },
      onError: (failure: unknown) => setError((failure as { data?: { error?: string } })?.data?.error ?? 'We could not send that just now. Please try again.'),
    });
  };
  return (
    <View style={[styles.form, { backgroundColor: colors.selectedWash, borderColor: colors.border }]} testID={`form-review-${field}`}>
      <LoomText style={{ color: colors.foreground, fontSize: 14, lineHeight: 20 }}>The catalog saved this {fieldLabels[field].toLowerCase()} as <LoomText style={{ fontFamily: fonts.semibold, fontSize: 14 }}>{currentName}</LoomText>. What should it be?</LoomText>
      <TextInput value={suggestedName} onChangeText={(value) => { setSuggestedName(value); setError(''); }} accessibilityLabel="Name it should be" maxLength={80} autoCorrect={false} style={inputStyle} testID={`input-review-name-${field}`} />
      <TextInput value={note} onChangeText={setNote} accessibilityLabel="Anything the reviewer should know" placeholder="Anything the reviewer should know (optional)" placeholderTextColor={colors.mutedForeground} maxLength={500} multiline style={[...inputStyle, styles.note]} />
      {error ? <LoomText accessibilityRole="alert" style={{ color: colors.destructive, fontSize: 14 }}>{error}</LoomText> : null}
      <View style={styles.actions}>
        <LoomButton title="Cancel" variant="quiet" onPress={onDone} style={styles.button} />
        <LoomButton title="Ask for a review" onPress={send} busy={create.isPending} style={styles.button} testID={`button-send-review-${field}`} />
      </View>
    </View>
  );
}

const statusLabels: Record<CatalogReview['status'], string> = { open: 'Waiting for review', renamed: 'Renamed', kept: 'Kept as is' };

export function NameReviewList({ reviews }: { reviews: CatalogReview[] }) {
  const colors = useColors();
  if (!reviews.length) return null;
  return (
    <View style={styles.list}>
      {reviews.map((review) => (
        <View key={review.id}>
          <LoomText style={{ color: colors.foreground, fontSize: 14 }}>{fieldLabels[review.field]}: {review.currentName} → {review.suggestedName} · <LoomText style={{ color: review.status === 'renamed' ? colors.primary : colors.mutedForeground, fontFamily: fonts.semibold, fontSize: 14 }}>{statusLabels[review.status]}</LoomText></LoomText>
          {review.reviewerNote ? <LoomText style={{ color: colors.mutedForeground, fontSize: 14 }}>{review.reviewerNote}</LoomText> : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 7 },
  form: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 8, marginBottom: 12 },
  input: { minHeight: 44, borderWidth: 1, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 9, fontSize: 16, fontFamily: fonts.body },
  note: { minHeight: 64, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  button: { minHeight: 40, paddingHorizontal: 12 },
  list: { gap: 8, marginBottom: 14 },
});

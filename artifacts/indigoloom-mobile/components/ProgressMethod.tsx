import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import type { CreateProgress, Project, ProgressMethod, ProgressSection, UpdateProject } from '@workspace/api-client-react';
import { FormFieldLabel, LoomText, fonts } from '@/components/loom';
import { useColors } from '@/hooks/useColors';

export type ProgressSettingsDraft = { method: ProgressMethod; total: string; sections: ProgressSection[] };
export type ProgressAmountDraft = { percent: string; value: string; done: number[] };
type ProgressSettings = Pick<Project, 'progressMethod' | 'progressTotal' | 'progressSections'>;

export const defaultProgressSettings: ProgressSettingsDraft = { method: 'estimate', total: '', sections: [] };

const methods: { value: ProgressMethod; label: string; hint: string }[] = [
  { value: 'estimate', label: 'About how far along', hint: 'Give a rough percentage with each note.' },
  { value: 'rows', label: 'Rows or rounds', hint: 'Say which row or round you’re on with each note.' },
  { value: 'sections', label: 'Pattern sections', hint: 'Tick off each part as you finish it.' },
  { value: 'skeins', label: 'Skeins used', hint: 'Say how many skeins you’ve used with each note.' },
];

const isHalfStep = (value: number) => Number.isInteger(value * 2);
const formatAmount = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(1));

export function progressSettingsFromProject(project: ProgressSettings): ProgressSettingsDraft {
  return {
    method: project.progressMethod,
    total: project.progressTotal ? String(project.progressTotal) : '',
    sections: project.progressSections,
  };
}

export function progressSettingsError(draft: ProgressSettingsDraft): string {
  const total = Number(draft.total);
  if (draft.method === 'rows' && (!(total > 0) || !Number.isInteger(total))) return 'Add how many rows or rounds the project has.';
  if (draft.method === 'skeins' && (!(total > 0) || !isHalfStep(total))) return 'Add how many skeins you plan to use, in whole or half skeins.';
  if (draft.method === 'sections' && !draft.sections.some((section) => section.name.trim())) return 'Add at least one pattern section.';
  return '';
}

export function progressSettingsForApi(draft: ProgressSettingsDraft): Pick<UpdateProject, 'progressMethod' | 'progressTotal' | 'progressSections'> {
  const usesTotal = draft.method === 'rows' || draft.method === 'skeins';
  return {
    progressMethod: draft.method,
    progressTotal: usesTotal ? Number(draft.total) : null,
    progressSections: draft.sections.filter((section) => section.name.trim()).map((section) => ({ ...section, name: section.name.trim() })),
  };
}

// Shown under the percentage on the project screen, e.g. "Row 50 of 200".
export function progressDetail(project: ProgressSettings, latestValue: number | null | undefined): string {
  const total = project.progressTotal;
  if (project.progressMethod === 'sections' && project.progressSections.length) {
    return `${project.progressSections.filter((section) => section.done).length} of ${project.progressSections.length} sections done`;
  }
  if (latestValue == null || !total) return '';
  if (project.progressMethod === 'rows') return `Row ${formatAmount(latestValue)} of ${formatAmount(total)}`;
  if (project.progressMethod === 'skeins') return `${formatAmount(latestValue)} of ${formatAmount(total)} skeins used`;
  return '';
}

export function amountDraftFor(project: Pick<Project, 'completionPercent' | 'progressSections'>, latestValue: number | null | undefined): ProgressAmountDraft {
  return {
    percent: String(project.completionPercent),
    value: latestValue == null ? '' : String(latestValue),
    done: project.progressSections.flatMap((section, position) => (section.done ? [position] : [])),
  };
}

// The part of a progress note that records how far along the project is.
export function progressAmountForApi(project: Pick<Project, 'progressMethod'>, draft: ProgressAmountDraft): Omit<CreateProgress, 'notes'> | string {
  const value = Number(draft.value);
  switch (project.progressMethod) {
    case 'rows':
      return draft.value !== '' && Number.isInteger(value) && value >= 0 ? { progressValue: value } : 'Say which row or round you’re on.';
    case 'skeins':
      return draft.value !== '' && isHalfStep(value) && value >= 0 ? { progressValue: value } : 'Say how many skeins you’ve used, in whole or half skeins.';
    case 'sections':
      return { sectionsDone: draft.done };
    default: {
      const percent = Number(draft.percent);
      return draft.percent !== '' && Number.isInteger(percent) && percent >= 0 && percent <= 100 ? { completionPercent: percent } : 'Give a whole-number percentage from 0 to 100.';
    }
  }
}

export function ProgressMethodPicker({ value, onChange, error }: {
  value: ProgressSettingsDraft;
  onChange: (next: ProgressSettingsDraft) => void;
  error: string;
}) {
  const colors = useColors();
  const inputStyle = [styles.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.input }];
  const chosen = methods.find((method) => method.value === value.method) ?? methods[0];
  const choose = (method: ProgressMethod) => onChange({
    ...value,
    method,
    sections: method === 'sections' && value.sections.length === 0 ? [{ name: '', done: false }] : value.sections,
  });

  return (
    <View>
      <FormFieldLabel>Track progress by</FormFieldLabel>
      <View style={styles.methodGrid} accessibilityRole="radiogroup">
        {methods.map((method) => {
          const active = value.method === method.value;
          return (
            <Pressable
              key={method.value}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              onPress={() => choose(method.value)}
              style={[styles.method, { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.selectedWash : colors.background }]}
              testID={`button-progress-${method.value}`}
            >
              <LoomText style={{ color: active ? colors.primary : colors.mutedForeground, fontFamily: fonts.semibold, fontSize: 14, textAlign: 'center' }}>{method.label}</LoomText>
            </Pressable>
          );
        })}
      </View>
      <LoomText style={{ color: colors.mutedForeground, fontSize: 14, marginBottom: 12 }}>{chosen.hint}</LoomText>
      {value.method === 'rows' || value.method === 'skeins' ? (
        <>
          <FormFieldLabel>{value.method === 'rows' ? 'Total rows or rounds' : 'Skeins planned'}</FormFieldLabel>
          <TextInput
            value={value.total}
            onChangeText={(total) => onChange({ ...value, total })}
            keyboardType={value.method === 'rows' ? 'number-pad' : 'decimal-pad'}
            placeholder={value.method === 'rows' ? 'e.g. 120' : 'e.g. 4.5'}
            placeholderTextColor={colors.mutedForeground}
            style={inputStyle}
            testID="input-progress-total"
          />
        </>
      ) : null}
      {value.method === 'sections' ? (
        <View style={{ marginBottom: 6 }}>
          {value.sections.map((section, position) => (
            <View key={position} style={styles.sectionRow}>
              <TextInput
                value={section.name}
                onChangeText={(name) => onChange({ ...value, sections: value.sections.map((item, index) => (index === position ? { ...item, name } : item)) })}
                maxLength={80}
                placeholder={['e.g. Back', 'e.g. Front', 'e.g. Sleeves'][position] ?? 'Section name'}
                placeholderTextColor={colors.mutedForeground}
                accessibilityLabel={`Section ${position + 1}`}
                style={[...inputStyle, { flex: 1, marginBottom: 0 }]}
                testID={`input-section-${position}`}
              />
              {value.sections.length > 1 ? (
                <Pressable accessibilityRole="button" accessibilityLabel={`Remove section ${position + 1}`} onPress={() => onChange({ ...value, sections: value.sections.filter((_, index) => index !== position) })} style={styles.removeSection}>
                  <Feather name="x" size={18} color={colors.mutedForeground} />
                </Pressable>
              ) : null}
            </View>
          ))}
          {value.sections.length < 40 ? (
            <Pressable accessibilityRole="button" onPress={() => onChange({ ...value, sections: [...value.sections, { name: '', done: false }] })} style={styles.addSection} testID="button-add-section">
              <Feather name="plus" size={16} color={colors.primary} />
              <LoomText style={{ color: colors.primary, fontFamily: fonts.semibold, fontSize: 15 }}>Add a section</LoomText>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {error ? <LoomText accessibilityRole="alert" style={{ color: colors.destructive, fontSize: 15, marginBottom: 12 }}>{error}</LoomText> : null}
    </View>
  );
}

export function ProgressAmountInput({ project, value, onChange }: {
  project: ProgressSettings;
  value: ProgressAmountDraft;
  onChange: (next: ProgressAmountDraft) => void;
}) {
  const colors = useColors();
  const inputStyle = [styles.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.input }];

  if (project.progressMethod === 'sections') {
    return (
      <View style={{ marginBottom: 10 }}>
        <FormFieldLabel>Which sections are done?</FormFieldLabel>
        {project.progressSections.map((section, position) => {
          const checked = value.done.includes(position);
          return (
            <Pressable
              key={position}
              accessibilityRole="checkbox"
              accessibilityState={{ checked }}
              onPress={() => onChange({ ...value, done: checked ? value.done.filter((done) => done !== position) : [...value.done, position] })}
              style={styles.checkRow}
              testID={`checkbox-section-${position}`}
            >
              <View style={[styles.checkbox, { borderColor: checked ? colors.primary : colors.input, backgroundColor: checked ? colors.primary : colors.card }]}>
                {checked ? <Feather name="check" size={14} color={colors.card} /> : null}
              </View>
              <LoomText style={{ color: colors.foreground, fontSize: 16 }}>{section.name}</LoomText>
            </Pressable>
          );
        })}
      </View>
    );
  }

  if (project.progressMethod === 'rows' || project.progressMethod === 'skeins') {
    const rows = project.progressMethod === 'rows';
    const total = project.progressTotal ?? 0;
    const amount = Number(value.value);
    const preview = total && value.value !== '' && amount >= 0 ? Math.min(100, Math.round((amount / total) * 100)) : null;
    return (
      <>
        <FormFieldLabel>{rows ? 'Which row or round are you on?' : 'How many skeins have you used?'}</FormFieldLabel>
        <View style={styles.valueRow}>
          <TextInput
            value={value.value}
            onChangeText={(next) => onChange({ ...value, value: next })}
            keyboardType={rows ? 'number-pad' : 'decimal-pad'}
            style={[...inputStyle, { width: 110, marginBottom: 0 }]}
            testID="input-progress-value"
          />
          <LoomText style={{ color: colors.mutedForeground, fontSize: 15 }}>of {formatAmount(total)}{preview !== null ? ` · ${preview}%` : ''}</LoomText>
        </View>
      </>
    );
  }

  return (
    <>
      <FormFieldLabel>About how far along are you? (%)</FormFieldLabel>
      <TextInput value={value.percent} onChangeText={(percent) => onChange({ ...value, percent })} placeholder="0–100" placeholderTextColor={colors.mutedForeground} keyboardType="number-pad" style={inputStyle} testID="input-progress-percent" />
    </>
  );
}

const styles = StyleSheet.create({
  input: { minHeight: 45, borderWidth: 1, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, fontFamily: fonts.body, marginBottom: 14 },
  methodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  method: { flexBasis: '47%', flexGrow: 1, minHeight: 42, borderWidth: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  removeSection: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  addSection: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 8, marginBottom: 8 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 11, minHeight: 40 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  valueRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
});

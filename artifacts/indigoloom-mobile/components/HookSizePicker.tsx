import { useState } from 'react';
import { CrochetHookSize } from '@workspace/api-zod';
import { Feather } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { FormFieldLabel, LoomButton, LoomText, fonts } from '@/components/loom';
import { useColors } from '@/hooks/useColors';

export type CrochetHookSizeValue = (typeof CrochetHookSize)[keyof typeof CrochetHookSize];
const crochetHookSizes = Object.values(CrochetHookSize) as CrochetHookSizeValue[];

export function HookSizePicker({
  value,
  onChange,
  testID = 'select-crochet-hook-size',
}: {
  value: CrochetHookSizeValue | null;
  onChange: (value: CrochetHookSizeValue) => void;
  testID?: string;
}) {
  return <OptionPicker label="Hook size" placeholder="Choose a hook size" options={crochetHookSizes} value={value} onChange={onChange} testID={testID} />;
}

// Null until the maker adds a second hook; size stays null until one is picked.
export type SecondHook = { size: CrochetHookSizeValue | null } | null;

export function SecondHookField({ value, onChange, testIDPrefix }: { value: SecondHook; onChange: (value: SecondHook) => void; testIDPrefix: string }) {
  const colors = useColors();
  if (!value) {
    return <LoomButton title="Add a second hook" icon="plus" variant="quiet" onPress={() => onChange({ size: null })} testID={`${testIDPrefix}-add-second-hook`} style={styles.add} />;
  }
  return (
    <View>
      <View style={styles.heading}>
        <FormFieldLabel>Second hook</FormFieldLabel>
        <Pressable accessibilityRole="button" onPress={() => onChange(null)} testID={`${testIDPrefix}-remove-second-hook`}><LoomText style={{ color: colors.mutedForeground, fontSize: 14, textDecorationLine: 'underline' }}>Remove</LoomText></Pressable>
      </View>
      <OptionPicker label="Second hook" placeholder="Choose a hook size" options={crochetHookSizes} value={value.size} onChange={(size) => onChange({ size })} testID={`${testIDPrefix}-second-hook-size`} />
    </View>
  );
}

// A dropdown that opens in place, used for hook sizes and knitting needles.
export function OptionPicker<T extends string>({
  label,
  placeholder,
  options,
  optionLabel = (option) => option,
  value,
  onChange,
  testID,
}: {
  label: string;
  placeholder: string;
  options: readonly T[];
  optionLabel?: (option: T) => string;
  value: T | null;
  onChange: (value: T) => void;
  testID: string;
}) {
  const colors = useColors();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
        accessibilityLabel={`${label}: ${value ? optionLabel(value) : placeholder}`}
        onPress={() => setIsOpen((open) => !open)}
        style={[styles.trigger, { borderColor: colors.input, backgroundColor: colors.card }]}
        testID={testID}
      >
        <LoomText style={[styles.triggerText, { color: value ? colors.foreground : colors.mutedForeground }]}>
          {value ? optionLabel(value) : placeholder}
        </LoomText>
        <Feather name={isOpen ? 'chevron-up' : 'chevron-down'} size={17} color={colors.mutedForeground} />
      </Pressable>
      {isOpen ? (
        <View style={[styles.options, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={styles.optionList}>
            {options.map((option, index) => {
              const selected = value === option;
              return (
                <Pressable
                  key={option}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => {
                    onChange(option);
                    setIsOpen(false);
                  }}
                  style={[styles.option, { borderBottomColor: colors.border, backgroundColor: selected ? colors.selectedWash : colors.card }]}
                  testID={`${testID}-option-${index}`}
                >
                  <LoomText style={{ color: selected ? colors.primary : colors.foreground, fontFamily: selected ? fonts.semibold : fonts.body, fontSize: 15 }}>
                    {optionLabel(option)}
                  </LoomText>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  add: { alignSelf: 'flex-start', marginBottom: 14 },
  wrap: { marginBottom: 14 },
  trigger: { minHeight: 46, borderWidth: 1, borderRadius: 9, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  triggerText: { flex: 1, fontFamily: fonts.body, fontSize: 15 },
  options: { borderWidth: 1, borderRadius: 9, overflow: 'hidden', marginTop: 5 },
  optionList: { maxHeight: 250 },
  option: { minHeight: 41, paddingHorizontal: 12, justifyContent: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
});

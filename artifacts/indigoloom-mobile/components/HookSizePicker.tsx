import { useState } from 'react';
import { CrochetHookSize } from '@workspace/api-zod';
import { Feather } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { LoomText, fonts } from '@/components/loom';
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
  const colors = useColors();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
        accessibilityLabel={`Hook size: ${value || 'Choose a hook size'}`}
        onPress={() => setIsOpen((open) => !open)}
        style={[styles.trigger, { borderColor: colors.input, backgroundColor: colors.card }]}
        testID={testID}
      >
        <LoomText style={[styles.triggerText, { color: value ? colors.foreground : colors.mutedForeground }]}>
          {value || 'Choose a hook size'}
        </LoomText>
        <Feather name={isOpen ? 'chevron-up' : 'chevron-down'} size={17} color={colors.mutedForeground} />
      </Pressable>
      {isOpen ? (
        <View style={[styles.options, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={styles.optionList}>
            {crochetHookSizes.map((hookSize, index) => {
              const selected = value === hookSize;
              return (
                <Pressable
                  key={hookSize}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => {
                    onChange(hookSize);
                    setIsOpen(false);
                  }}
                  style={[styles.option, { borderBottomColor: colors.border, backgroundColor: selected ? colors.selectedWash : colors.card }]}
                  testID={`${testID}-option-${index}`}
                >
                  <LoomText style={{ color: selected ? colors.primary : colors.foreground, fontFamily: selected ? fonts.semibold : fonts.body, fontSize: 12 }}>
                    {hookSize}
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
  wrap: { marginBottom: 14 },
  trigger: { minHeight: 46, borderWidth: 1, borderRadius: 9, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  triggerText: { flex: 1, fontFamily: fonts.body, fontSize: 12 },
  options: { borderWidth: 1, borderRadius: 9, overflow: 'hidden', marginTop: 5 },
  optionList: { maxHeight: 250 },
  option: { minHeight: 41, paddingHorizontal: 12, justifyContent: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
});

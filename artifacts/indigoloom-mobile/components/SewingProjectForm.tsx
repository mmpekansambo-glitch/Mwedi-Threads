import { useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getGetSewingOverviewQueryKey, getGetSewingProjectQueryKey, getGetSewingProjectsQueryKey,
  useCreateSewingProject, useUpdateSewingProject, refreshPaths,
} from '@workspace/api-client-react';
import type { GeneralColor, ProjectStatus, SewingMachineSetting, SewingNeedleSize, SewingNeedleType, SewingProject, SewingTool } from '@workspace/api-client-react';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { FormFieldLabel, LoomButton, LoomText, fonts } from '@/components/loom';
import { sizeForApi } from '@/components/FabricFields';
import { MachineSettingsField, TapWheelRow, machineNeedleSizes, machineNeedleTypes, needleLabel } from '@/components/SewingFields';
import { SuppliesField, type SuppliesFabric } from '@/components/SewingSupplies';
import { ProjectPatternField, patternForApi, type ChosenPattern } from '@/components/SewingPatterns';
import { ColorDot, generalColors } from '@/components/YarnFields';
import { useSewingColors } from '@/hooks/useColors';

const statuses: Array<{ value: ProjectStatus; label: string }> = [
  { value: 'planning', label: 'Planning' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'paused', label: 'On pause' },
  { value: 'completed', label: 'Finished' },
];

export function SewingProjectForm({ project }: { project?: SewingProject }) {
  const colors = useSewingColors();
  const insets = useSafeAreaInsets();
  const client = useQueryClient();
  const create = useCreateSewingProject();
  const update = useUpdateSewingProject();
  const [title, setTitle] = useState(project?.title ?? '');
  const [status, setStatus] = useState<ProjectStatus>(project?.status ?? 'planning');
  const [pattern, setPattern] = useState<ChosenPattern | null>(project?.patternId && project.patternName ? { id: project.patternId, name: project.patternName, designer: project.patternDesigner } : null);
  const [sizeMade, setSizeMade] = useState(project?.sizeMade ?? '');
  const [fitChanges, setFitChanges] = useState(project?.fitChanges ?? '');
  const [notes, setNotes] = useState(project?.notes ?? '');
  const [fabrics, setFabrics] = useState<SuppliesFabric[]>(() => project?.fabrics.map((item) => ({ fabric: item.fabric, amountUsed: item.amountUsed === null ? '' : String(item.amountUsed) })) ?? []);
  const [chosenTools, setChosenTools] = useState<SewingTool[]>(project?.tools ?? []);
  const [needleType, setNeedleType] = useState<SewingNeedleType | null>(project?.needleType ?? null);
  const [needleSize, setNeedleSize] = useState<SewingNeedleSize | null>(project?.needleSize ?? null);
  const [threadColor, setThreadColor] = useState<GeneralColor | null>(project?.threadColor ?? null);
  const [machineSettings, setMachineSettings] = useState<SewingMachineSetting[]>(project?.machineSettings ?? []);
  const [message, setMessage] = useState('');
  const inputStyle = [styles.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.input }];
  const inputProps = { placeholderTextColor: colors.mutedForeground };
  const threadLabel = generalColors.find((item) => item.value === threadColor)?.label;

  const save = () => {
    setMessage('');
    if (!title.trim()) return setMessage('Give your project a name.');
    const links = fabrics.map((item) => ({ stashFabricId: item.fabric.id, amountUsed: sizeForApi(item.amountUsed) }));
    if (links.some((item) => item.amountUsed === 'invalid')) return setMessage('Enter amounts between 0 and 999, like 1.5.');
    const data = {
      title: title.trim(), status, ...patternForApi(pattern),
      sizeMade: sizeMade.trim() || null, fitChanges: fitChanges.trim() || null, notes: notes.trim() || null,
      fabrics: links as Array<{ stashFabricId: string; amountUsed: number | null }>,
      needleType, needleSize, threadColor, toolIds: chosenTools.map((tool) => tool.id), machineSettings,
    };
    const finishing = status === 'completed' && project?.status !== 'completed';
    const options = {
      onSuccess: (saved: SewingProject) => {
        client.setQueryData(getGetSewingProjectQueryKey(saved.id), saved);
        void client.invalidateQueries({ queryKey: getGetSewingProjectsQueryKey() });
        void client.invalidateQueries({ queryKey: getGetSewingOverviewQueryKey() });
        refreshPaths(client, '/api/sewing-patterns');
        // An edit goes back to the project, which offers the stash update itself
        // when it sees the project become finished.
        if (project) router.back();
        else router.replace({ pathname: '/sewing/[id]', params: { id: saved.id, ...(finishing ? { finished: '1' } : {}) } });
      },
      onError: (error: unknown) => setMessage((error as { data?: { error?: string } })?.data?.error ?? 'We could not save this project just now. Please try again.'),
    };
    if (project) update.mutate({ sewingProjectId: project.id, data }, options);
    else create.mutate({ data }, options);
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.nav, { paddingTop: insets.top + 9, borderBottomColor: colors.border }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={styles.navButton}><Feather name="arrow-left" size={19} color={colors.primaryText} /></Pressable>
        <LoomText numberOfLines={1} style={[styles.navTitle, { color: colors.foreground }]}>{project ? 'Edit project' : 'New project'}</LoomText>
        <View style={styles.navButton} />
      </View>
      <KeyboardAwareScrollViewCompat contentContainerStyle={styles.form} bottomOffset={80} keyboardShouldPersistTaps="handled">
        <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <FormFieldLabel>Project name *</FormFieldLabel>
          <TextInput {...inputProps} value={title} onChangeText={setTitle} maxLength={160} placeholder="e.g. Linen summer dress" style={inputStyle} testID="input-sewing-title" />
          <ProjectPatternField chosen={pattern} onChange={setPattern} />
          <FormFieldLabel>Size made</FormFieldLabel>
          <TextInput {...inputProps} value={sizeMade} onChangeText={setSizeMade} maxLength={60} placeholder="e.g. 12 or M" style={inputStyle} testID="input-sewing-size" />
          <FormFieldLabel>Status</FormFieldLabel>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.choices} accessibilityRole="radiogroup">
            {statuses.map((item) => {
              const selected = status === item.value;
              return <Pressable key={item.value} accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={() => setStatus(item.value)} style={[styles.choice, { backgroundColor: selected ? colors.primary : colors.card, borderColor: selected ? colors.primary : colors.input }]} testID={`button-sewing-status-${item.value}`}><LoomText style={{ color: selected ? colors.primaryForeground : colors.foreground, fontFamily: fonts.semibold, fontSize: 14 }}>{item.label}</LoomText></Pressable>;
            })}
          </ScrollView>
          <FormFieldLabel>Fit changes</FormFieldLabel>
          <TextInput {...inputProps} value={fitChanges} onChangeText={setFitChanges} maxLength={2000} multiline placeholder="e.g. Lengthened the bodice 2 cm" style={[inputStyle, styles.notes]} testID="input-sewing-fit" />
          <FormFieldLabel>Notes</FormFieldLabel>
          <TextInput {...inputProps} value={notes} onChangeText={setNotes} maxLength={2000} multiline placeholder="Optional" style={[inputStyle, styles.notes]} testID="input-sewing-notes" />

          <FormFieldLabel>Supplies</FormFieldLabel>
          <SuppliesField fabrics={fabrics} tools={chosenTools} onFabrics={setFabrics} onTools={setChosenTools} />

          <FormFieldLabel>Needle and thread</FormFieldLabel>
          <View style={[styles.tapRows, { borderColor: colors.border }]}>
            <TapWheelRow
              first
              label="Needle"
              shown={needleLabel({ needleType, needleSize }) ? <LoomText style={{ color: colors.foreground, fontSize: 15 }}>{needleLabel({ needleType, needleSize })}</LoomText> : null}
              wheels={[
                { label: 'Needle type', items: machineNeedleTypes.map((item) => item.label), index: Math.max(0, machineNeedleTypes.findIndex((item) => item.value === needleType)) },
                { label: 'Needle size', items: machineNeedleSizes, index: Math.max(0, machineNeedleSizes.indexOf(needleSize ?? '80/12')) },
              ]}
              onDone={([type, size]) => { setNeedleType(machineNeedleTypes[type ?? 0].value); setNeedleSize(machineNeedleSizes[size ?? 0]); }}
              onClear={() => { setNeedleType(null); setNeedleSize(null); }}
              testID="row-sewing-needle"
            />
            <TapWheelRow
              label="Thread color"
              shown={threadLabel ? <><ColorDot color={threadColor} noun="thread" /><LoomText style={{ color: colors.foreground, fontSize: 15 }}>{threadLabel}</LoomText></> : null}
              wheels={[{ label: 'Thread color', items: generalColors.map((item) => item.label), index: Math.max(0, generalColors.findIndex((item) => item.value === threadColor)) }]}
              onDone={([color]) => setThreadColor(generalColors[color ?? 0].value)}
              onClear={() => setThreadColor(null)}
              testID="row-sewing-thread"
            />
          </View>
          <FormFieldLabel>Special machine settings</FormFieldLabel>
          <MachineSettingsField settings={machineSettings} onChange={setMachineSettings} />
          {message ? <LoomText accessibilityRole="alert" style={[styles.error, { color: colors.destructive }]}>{message}</LoomText> : null}
          <LoomButton title={project ? 'Save changes' : 'Start project'} icon="arrow-right" onPress={save} busy={create.isPending || update.isPending} testID="button-save-sewing-project" />
        </View>
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  nav: { minHeight: 48, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1 },
  navButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  navTitle: { fontFamily: fonts.semibold, fontSize: 16, flex: 1, textAlign: 'center', marginHorizontal: 8 },
  form: { width: '100%', maxWidth: 650, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 23, paddingBottom: 40 },
  formCard: { width: '100%', borderWidth: 1, borderRadius: 18, padding: 17 },
  input: { minHeight: 45, borderWidth: 1, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, fontFamily: fonts.body, marginBottom: 14 },
  notes: { minHeight: 80, textAlignVertical: 'top' },
  choices: { gap: 7, paddingBottom: 14 },
  choice: { borderWidth: 1, borderRadius: 99, paddingHorizontal: 14, minHeight: 36, justifyContent: 'center' },
  tapRows: { borderWidth: 1, borderRadius: 12, marginBottom: 18 },
  error: { fontSize: 15, lineHeight: 22, marginBottom: 12 },
});

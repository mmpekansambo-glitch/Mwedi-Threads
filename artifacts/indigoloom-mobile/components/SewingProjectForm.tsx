import { useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getGetSewingOverviewQueryKey, getGetSewingProjectQueryKey, getGetSewingProjectsQueryKey,
  useCreateSewingProject, useGetSewingTools, useGetStashFabrics, useUpdateSewingProject,
} from '@workspace/api-client-react';
import type { GeneralColor, ProjectStatus, SewingNeedleSize, SewingNeedleType, SewingProject, SewingTool, StashFabric } from '@workspace/api-client-react';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { FormFieldLabel, LoomButton, LoomText, fonts } from '@/components/loom';
import { FabricPhoto, fabricName, fabricSize, fabricUnits, sizeForApi } from '@/components/FabricFields';
import { TapWheelRow, machineNeedleSizes, machineNeedleTypes, needleLabel } from '@/components/SewingFields';
import { ToolThumb, toolDetails } from '@/components/SewingTools';
import { ColorDot, generalColors } from '@/components/YarnFields';
import { useSewingColors } from '@/hooks/useColors';

const statuses: Array<{ value: ProjectStatus; label: string }> = [
  { value: 'planning', label: 'Planning' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'paused', label: 'On pause' },
  { value: 'completed', label: 'Finished' },
];

type FabricDraft = { fabric: StashFabric; amountUsed: string };

export function SewingProjectForm({ project }: { project?: SewingProject }) {
  const colors = useSewingColors();
  const insets = useSafeAreaInsets();
  const client = useQueryClient();
  const create = useCreateSewingProject();
  const update = useUpdateSewingProject();
  const stash = useGetStashFabrics({});
  const [title, setTitle] = useState(project?.title ?? '');
  const [status, setStatus] = useState<ProjectStatus>(project?.status ?? 'planning');
  const [patternName, setPatternName] = useState(project?.patternName ?? '');
  const [patternDesigner, setPatternDesigner] = useState(project?.patternDesigner ?? '');
  const [sizeMade, setSizeMade] = useState(project?.sizeMade ?? '');
  const [fitChanges, setFitChanges] = useState(project?.fitChanges ?? '');
  const [notes, setNotes] = useState(project?.notes ?? '');
  const [fabrics, setFabrics] = useState<FabricDraft[]>(() => project?.fabrics.map((item) => ({ fabric: item.fabric, amountUsed: item.amountUsed === null ? '' : String(item.amountUsed) })) ?? []);
  const [picking, setPicking] = useState(false);
  const tools = useGetSewingTools({});
  const [chosenTools, setChosenTools] = useState<SewingTool[]>(project?.tools ?? []);
  const [pickingTools, setPickingTools] = useState(false);
  const [needleType, setNeedleType] = useState<SewingNeedleType | null>(project?.needleType ?? null);
  const [needleSize, setNeedleSize] = useState<SewingNeedleSize | null>(project?.needleSize ?? null);
  const [threadColor, setThreadColor] = useState<GeneralColor | null>(project?.threadColor ?? null);
  const [message, setMessage] = useState('');
  const inputStyle = [styles.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.input }];
  const inputProps = { placeholderTextColor: colors.mutedForeground };
  const availableTools = tools.data?.filter((tool) => !chosenTools.some((item) => item.id === tool.id)) ?? [];
  const threadLabel = generalColors.find((item) => item.value === threadColor)?.label;
  const available = stash.data?.filter((fabric) => !fabrics.some((item) => item.fabric.id === fabric.id)) ?? [];

  const save = () => {
    setMessage('');
    if (!title.trim()) return setMessage('Give your project a name.');
    const links = fabrics.map((item) => ({ stashFabricId: item.fabric.id, amountUsed: sizeForApi(item.amountUsed) }));
    if (links.some((item) => item.amountUsed === 'invalid')) return setMessage('Enter amounts between 0 and 999, like 1.5.');
    const data = {
      title: title.trim(), status, patternName: patternName.trim() || null, patternDesigner: patternDesigner.trim() || null,
      sizeMade: sizeMade.trim() || null, fitChanges: fitChanges.trim() || null, notes: notes.trim() || null,
      fabrics: links as Array<{ stashFabricId: string; amountUsed: number | null }>,
      needleType, needleSize, threadColor, toolIds: chosenTools.map((tool) => tool.id),
    };
    const finishing = status === 'completed' && project?.status !== 'completed';
    const options = {
      onSuccess: (saved: SewingProject) => {
        client.setQueryData(getGetSewingProjectQueryKey(saved.id), saved);
        void client.invalidateQueries({ queryKey: getGetSewingProjectsQueryKey() });
        void client.invalidateQueries({ queryKey: getGetSewingOverviewQueryKey() });
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
          <FormFieldLabel>Pattern</FormFieldLabel>
          <TextInput {...inputProps} value={patternName} onChangeText={setPatternName} maxLength={160} placeholder="Optional" style={inputStyle} testID="input-sewing-pattern" />
          <FormFieldLabel>Designer</FormFieldLabel>
          <TextInput {...inputProps} value={patternDesigner} onChangeText={setPatternDesigner} maxLength={160} placeholder="Optional" style={inputStyle} testID="input-sewing-designer" />
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

          <FormFieldLabel>Fabric</FormFieldLabel>
          {fabrics.map((item, index) => {
            const unit = fabricUnits.find((option) => option.value === item.fabric.unit) ?? fabricUnits[0];
            return (
              <View key={item.fabric.id} style={[styles.fabricRow, { borderColor: colors.border }]} testID={`sewing-fabric-${index}`}>
                <FabricPhoto fabric={item.fabric} index={0} style={[styles.thumb, { backgroundColor: colors.selectedWash }]} />
                <View style={{ flex: 1, gap: 6 }}>
                  <LoomText style={{ color: colors.foreground, fontFamily: fonts.semibold, fontSize: 15 }}>{fabricName(item.fabric)}</LoomText>
                  <View style={styles.usedRow}>
                    <LoomText style={{ color: colors.mutedForeground, fontSize: 13 }}>Used</LoomText>
                    <TextInput {...inputProps} value={item.amountUsed} onChangeText={(value) => setFabrics((current) => current.map((entry, place) => (place === index ? { ...entry, amountUsed: value } : entry)))} keyboardType="decimal-pad" placeholder="e.g. 1.5" accessibilityLabel={`Amount of ${fabricName(item.fabric)} used, in ${unit.label.toLowerCase()}`} style={[inputStyle, styles.usedInput]} testID={`input-sewing-fabric-used-${index}`} />
                    <LoomText style={{ color: colors.mutedForeground, fontSize: 14, fontFamily: fonts.semibold }}>{unit.amount}</LoomText>
                  </View>
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${fabricName(item.fabric)}`} onPress={() => setFabrics((current) => current.filter((_, place) => place !== index))} style={styles.remove}><Feather name="x" size={16} color={colors.mutedForeground} /></Pressable>
              </View>
            );
          })}
          {picking ? (
            <View style={[styles.picker, { backgroundColor: colors.selectedWash, borderColor: colors.border }]}>
              {available.length ? available.map((fabric) => (
                <Pressable key={fabric.id} accessibilityRole="button" onPress={() => { setFabrics((current) => [...current, { fabric, amountUsed: '' }]); setPicking(false); }} style={[styles.pick, { backgroundColor: colors.card, borderColor: colors.border }]} testID={`button-pick-fabric-${fabric.id}`}>
                  <FabricPhoto fabric={fabric} index={0} style={[styles.pickThumb, { backgroundColor: colors.selectedWash }]} />
                  <View style={{ flex: 1 }}>
                    <LoomText style={{ color: colors.foreground, fontFamily: fonts.semibold, fontSize: 15 }}>{fabricName(fabric)}</LoomText>
                    {fabricSize(fabric) ? <LoomText style={{ color: colors.mutedForeground, fontSize: 13 }}>{fabricSize(fabric)}</LoomText> : null}
                  </View>
                </Pressable>
              )) : (
                <LoomText style={{ color: colors.mutedForeground, fontSize: 14 }}>{stash.data?.length ? 'All your fabric is on this project.' : 'Your fabric stash is empty. Add fabric in the Fabric tab first.'}</LoomText>
              )}
              <LoomButton title="Close" variant="quiet" onPress={() => setPicking(false)} />
            </View>
          ) : fabrics.length < 12 ? (
            <LoomButton title="Add fabric from your stash" icon="plus" variant="secondary" onPress={() => setPicking(true)} style={{ marginBottom: 14 }} testID="button-add-sewing-fabric" />
          ) : null}

          <FormFieldLabel>Tools</FormFieldLabel>
          {chosenTools.map((tool) => (
            <View key={tool.id} style={[styles.fabricRow, { borderColor: colors.border }]} testID={`sewing-tool-${tool.id}`}>
              <ToolThumb tool={tool} size={46} />
              <View style={{ flex: 1 }}>
                <LoomText style={{ color: colors.foreground, fontFamily: fonts.semibold, fontSize: 15 }}>{tool.name}</LoomText>
                {toolDetails(tool) ? <LoomText style={{ color: colors.mutedForeground, fontSize: 13 }}>{toolDetails(tool)}</LoomText> : null}
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${tool.name}`} onPress={() => setChosenTools((current) => current.filter((item) => item.id !== tool.id))} style={styles.remove}><Feather name="x" size={16} color={colors.mutedForeground} /></Pressable>
            </View>
          ))}
          {pickingTools ? (
            <View style={[styles.picker, { backgroundColor: colors.selectedWash, borderColor: colors.border }]}>
              {availableTools.length ? availableTools.map((tool) => (
                <Pressable key={tool.id} accessibilityRole="button" onPress={() => { setChosenTools((current) => [...current, tool]); setPickingTools(false); }} style={[styles.pick, { backgroundColor: colors.card, borderColor: colors.border }]} testID={`button-pick-tool-${tool.id}`}>
                  <ToolThumb tool={tool} size={46} />
                  <View style={{ flex: 1 }}>
                    <LoomText style={{ color: colors.foreground, fontFamily: fonts.semibold, fontSize: 15 }}>{tool.name}</LoomText>
                    {toolDetails(tool) ? <LoomText style={{ color: colors.mutedForeground, fontSize: 13 }}>{toolDetails(tool)}</LoomText> : null}
                  </View>
                </Pressable>
              )) : (
                <LoomText style={{ color: colors.mutedForeground, fontSize: 14 }}>{tools.data?.length ? 'All your tools are on this project.' : 'You have no tools saved yet. Add them in the Tools tab first.'}</LoomText>
              )}
              <LoomButton title="Close" variant="quiet" onPress={() => setPickingTools(false)} />
            </View>
          ) : chosenTools.length < 30 ? (
            <LoomButton title="Add tools" icon="plus" variant="secondary" onPress={() => setPickingTools(true)} style={{ marginBottom: 14 }} testID="button-add-sewing-tool" />
          ) : null}

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
  fabricRow: { flexDirection: 'row', alignItems: 'center', gap: 11, borderWidth: 1, borderRadius: 12, padding: 8, marginBottom: 10 },
  thumb: { width: 58, height: 58, borderRadius: 8 },
  usedRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  usedInput: { minHeight: 38, width: 90, marginBottom: 0, paddingVertical: 6 },
  remove: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  picker: { borderWidth: 1, borderRadius: 12, padding: 10, gap: 8, marginBottom: 14 },
  pick: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 10, padding: 7 },
  pickThumb: { width: 46, height: 46, borderRadius: 7 },
  tapRows: { borderWidth: 1, borderRadius: 12, marginBottom: 18 },
  error: { fontSize: 15, lineHeight: 22, marginBottom: 12 },
});

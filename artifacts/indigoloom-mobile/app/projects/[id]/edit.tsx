import { useGetProject, useUpdateProject, usePreviewDesignerWebsiteTitle, getGetDashboardQueryKey, getGetProjectQueryKey, getGetProjectsQueryKey } from '@workspace/api-client-react';
import type { UpdateProject } from '@workspace/api-client-react';
import { HookSizePicker, type CrochetHookSizeValue } from '@/components/HookSizePicker';
import { NeedleFields, emptyNeedles, needlesForApi, needlesFromProject, type NeedlesDraft } from '@/components/NeedleFields';
import { ProjectDateField, projectDateForApi, type ProjectDatePrecision } from '@/components/ProjectDateField';
import { useLocalSearchParams, router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Feather } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { FormFieldLabel, LoadingState, LoomButton, LoomText, SignedInGate, fonts } from '@/components/loom';
import { ProgressMethodPicker, defaultProgressSettings, progressSettingsError, progressSettingsForApi, progressSettingsFromProject, type ProgressSettingsDraft } from '@/components/ProgressMethod';
import { useColors } from '@/hooks/useColors';
import { useEffect, useRef, useState } from 'react';

export default function EditProjectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const client = useQueryClient();
  const query = useGetProject(id);
  const update = useUpdateProject();
  const previewTitle = usePreviewDesignerWebsiteTitle();
  const project = query.data;
  const [title, setTitle] = useState('');
  const [patternName, setPatternName] = useState('');
  const [patternDesigner, setPatternDesigner] = useState('');
  const [designerMode, setDesignerMode] = useState<'name' | 'website'>('name');
  const [designerWebsite, setDesignerWebsite] = useState('');
  const designerWebsiteRef = useRef('');
  const [designerPageTitle, setDesignerPageTitle] = useState('');
  const [designerPreviewMessage, setDesignerPreviewMessage] = useState('');
  const [yarnBrand, setYarnBrand] = useState('');
  const [yarnType, setYarnType] = useState('');
  const [yarnColor, setYarnColor] = useState('');
  const [tools, setTools] = useState('');
  const [hookSize, setHookSize] = useState<CrochetHookSizeValue | null>(null);
  const [needles, setNeedles] = useState<NeedlesDraft>(emptyNeedles);
  const [description, setDescription] = useState('');
  const [completedAt, setCompletedAt] = useState('');
  const [completedAtPrecision, setCompletedAtPrecision] = useState<ProjectDatePrecision>('day');
  const [error, setError] = useState('');
  const [progressSettings, setProgressSettings] = useState<ProgressSettingsDraft>(defaultProgressSettings);
  const [showProgressError, setShowProgressError] = useState(false);
  useEffect(() => {
    if (!project) return;
    setTitle(project.title);
    setPatternName(project.patternName || '');
    setPatternDesigner(project.patternDesigner || '');
    setDesignerWebsite(project.designerWebsite || '');
    designerWebsiteRef.current = project.designerWebsite || '';
    setDesignerPageTitle(project.designerPageTitle || '');
    setDesignerMode(project.designerWebsite ? 'website' : 'name');
    setDesignerPreviewMessage('');
    setYarnBrand(project.yarnBrand || '');
    setYarnType(project.yarnType || '');
    setYarnColor(project.yarnColor || '');
    setTools(project.tools || '');
    setHookSize(project.hookSize || null);
    setNeedles(needlesFromProject(project));
    setDescription(project.description || '');
    setCompletedAt(project.completedAt || '');
    setCompletedAtPrecision(project.completedAtPrecision);
    setProgressSettings(progressSettingsFromProject(project));
  }, [project?.id]);
  const previewDesignerTitle = () => {
    const websiteUrl = designerWebsite.trim();
    if (!websiteUrl) {
      setDesignerPreviewMessage('Enter a website link first.');
      return;
    }
    setDesignerPreviewMessage('');
    previewTitle.mutate({ data: { websiteUrl } }, {
      onSuccess: (result) => {
        if (designerWebsiteRef.current.trim() !== websiteUrl) return;
        setDesignerWebsite(result.websiteUrl);
        designerWebsiteRef.current = result.websiteUrl;
        setDesignerPageTitle(result.pageTitle || '');
        setPatternDesigner(result.designerName || '');
        setDesignerPreviewMessage(result.pageTitle ? '' : 'No page title was found. You can still save the link.');
      },
      onError: () => setDesignerPreviewMessage('We could not preview that website. Check the link and try again.'),
    });
  };
  const inputStyle = [styles.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.input }];
  const save = () => {
    if (!project || !title.trim()) {
      setError('A project name is required.');
      return;
    }
    if (progressSettingsError(progressSettings)) {
      setShowProgressError(true);
      return;
    }
    const data: UpdateProject = {
      title: title.trim(),
      patternName: patternName.trim() || null,
      patternDesigner: patternDesigner.trim() || null,
      designerWebsite: designerMode === 'website' ? designerWebsite.trim() || null : null,
      designerPageTitle: designerMode === 'website' ? designerPageTitle.trim() || null : null,
      yarnBrand: yarnBrand.trim() || null,
      yarnType: yarnType.trim() || null,
      yarnColor: yarnColor.trim() || null,
      tools: tools.trim() || null,
      hookSize: project.craft === 'crochet' ? hookSize : null,
      ...needlesForApi(needles, project.craft === 'knitting'),
      description: description.trim() || null,
      ...(project.status === 'completed' && completedAt
        ? { completedAt: projectDateForApi(completedAt, completedAtPrecision), completedAtPrecision }
        : {}),
      ...progressSettingsForApi(progressSettings),
    };
    update.mutate({ projectId: id, data }, {
      onSuccess: () => {
        void client.invalidateQueries({ queryKey: getGetProjectQueryKey(id) });
        void client.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
        void client.invalidateQueries({ queryKey: getGetProjectsQueryKey() });
        router.back();
      },
      onError: () => setError('We could not save those changes. Please try again.'),
    });
  };
  return (
    <SignedInGate>
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={[styles.nav, { paddingTop: insets.top + 7, borderBottomColor: colors.border }]}>
          <LoomButton title="Cancel" variant="quiet" onPress={() => router.back()} style={{ minHeight: 38, paddingHorizontal: 8 }} />
          <LoomText style={[styles.navTitle, { color: colors.foreground }]}>Edit project</LoomText>
          <View style={{ width: 64 }} />
        </View>
        {query.isLoading ? <LoadingState label="Loading…" /> : project ? (
          <KeyboardAwareScrollViewCompat contentContainerStyle={styles.form} bottomOffset={75} keyboardShouldPersistTaps="handled">
            <LoomText serif style={[styles.heading, { color: colors.foreground }]}>Edit details</LoomText>
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <FormFieldLabel>Project name</FormFieldLabel>
              <TextInput value={title} onChangeText={setTitle} style={inputStyle} />
              <ProgressMethodPicker value={progressSettings} onChange={setProgressSettings} error={showProgressError ? progressSettingsError(progressSettings) : ''} />
              <FormFieldLabel>Pattern name</FormFieldLabel>
              <TextInput value={patternName} onChangeText={setPatternName} placeholder="Pattern or source" placeholderTextColor={colors.mutedForeground} style={inputStyle} />
              <FormFieldLabel>Designer</FormFieldLabel>
              <View style={styles.designerRow}>
                <View style={styles.designerModeRow} accessibilityLabel="Designer entry option">
                  {(['name', 'website'] as const).map((option) => {
                    const active = designerMode === option;
                    return <Pressable key={option} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => { setDesignerMode(option); setDesignerPreviewMessage(''); }} style={[styles.designerModeButton, { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.selectedWash : colors.background }]} testID={`button-edit-designer-${option}`}>
                      <LoomText style={{ color: active ? colors.primary : colors.mutedForeground, fontSize: 14, fontFamily: fonts.semibold }}>{option === 'name' ? 'Name' : 'Website'}</LoomText>
                    </Pressable>;
                  })}
                </View>
                {designerMode === 'name'
                  ? <TextInput value={patternDesigner} onChangeText={setPatternDesigner} placeholder="Who made the pattern?" placeholderTextColor={colors.mutedForeground} style={[...inputStyle, styles.designerInput]} testID="input-edit-designer" />
                  : <TextInput value={designerWebsite} onChangeText={(value) => { designerWebsiteRef.current = value; setDesignerWebsite(value); setPatternDesigner(''); setDesignerPageTitle(''); setDesignerPreviewMessage(''); }} placeholder="https://example.com" placeholderTextColor={colors.mutedForeground} autoCapitalize="none" autoCorrect={false} keyboardType="url" style={[...inputStyle, styles.designerInput]} testID="input-edit-designer-website" />}
              </View>
              {designerMode === 'website' ? (
                <>
                  <LoomButton title="Preview page title" variant="quiet" onPress={previewDesignerTitle} busy={previewTitle.isPending} testID="button-edit-preview-designer-title" />
                  {designerPageTitle ? <View style={[styles.designerPagePreview, { backgroundColor: colors.selectedWash, borderColor: colors.border }]}><LoomText style={{ color: colors.mutedForeground, fontSize: 13, letterSpacing: 1 }}>Page title preview</LoomText><LoomText numberOfLines={2} ellipsizeMode="tail" style={[styles.designerPageTitle, { color: colors.foreground, fontFamily: fonts.semibold, fontSize: 15 }]}>{designerPageTitle}</LoomText></View> : null}
                  {designerPreviewMessage ? <LoomText accessibilityRole="alert" style={{ color: colors.mutedForeground, fontSize: 14, lineHeight: 20, marginBottom: 12 }}>{designerPreviewMessage}</LoomText> : null}
                </>
              ) : null}
              <LoomText style={{ color: colors.primary, fontSize: 15, fontFamily: fonts.semibold, marginBottom: 11 }}>Yarn</LoomText>
              <FormFieldLabel>Brand</FormFieldLabel>
              <TextInput value={yarnBrand} onChangeText={setYarnBrand} placeholder="e.g. Cascade" placeholderTextColor={colors.mutedForeground} style={inputStyle} testID="input-edit-yarn-brand" />
              <FormFieldLabel>Type</FormFieldLabel>
              <TextInput value={yarnType} onChangeText={setYarnType} placeholder="e.g. Merino DK" placeholderTextColor={colors.mutedForeground} style={inputStyle} testID="input-edit-yarn-type" />
              <FormFieldLabel>Color</FormFieldLabel>
              <TextInput value={yarnColor} onChangeText={setYarnColor} placeholder="e.g. Oatmeal" placeholderTextColor={colors.mutedForeground} style={inputStyle} testID="input-edit-yarn-color" />
              {project.yarn ? <LoomText style={{ color: colors.mutedForeground, fontSize: 14, lineHeight: 22, marginBottom: 14 }}>Saved yarn note: {project.yarn} (kept unchanged from the earlier form)</LoomText> : null}
              {project.craft === 'crochet' ? (
                <>
                  <FormFieldLabel>Hook size</FormFieldLabel>
                  <HookSizePicker value={hookSize} onChange={setHookSize} testID="select-edit-crochet-hook-size" />
                  {tools ? <LoomText style={{ color: colors.mutedForeground, fontSize: 14, lineHeight: 22, marginBottom: 14 }}>Saved tools note: {tools} (kept unchanged from the earlier form)</LoomText> : null}
                </>
              ) : (
                <>
                  <NeedleFields value={needles} onChange={setNeedles} testIDPrefix="select-edit" />
                  {tools ? <LoomText style={{ color: colors.mutedForeground, fontSize: 14, lineHeight: 22, marginBottom: 14 }}>Saved tools note: {tools} (kept unchanged from the earlier form)</LoomText> : null}
                </>
              )}
              {project?.status === 'completed' ? <ProjectDateField label="Finished on" value={completedAt} precision={completedAtPrecision} onChange={setCompletedAt} onPrecisionChange={setCompletedAtPrecision} testID="input-edit-completed-date" /> : null}
              <FormFieldLabel>Notes</FormFieldLabel>
              <TextInput value={description} onChangeText={setDescription} placeholder="What made you fall for this one?" placeholderTextColor={colors.mutedForeground} multiline numberOfLines={4} textAlignVertical="top" style={[...inputStyle, styles.multiline]} />
              {error ? <LoomText accessibilityRole="alert" style={{ color: colors.destructive, fontSize: 15, marginBottom: 12 }}>{error}</LoomText> : null}
              <LoomButton title="Save changes" icon="check" onPress={save} busy={update.isPending} disabled={!title.trim()} />
            </View>
          </KeyboardAwareScrollViewCompat>
        ) : (
          <ScrollView contentContainerStyle={styles.form}><LoomText style={{ color: colors.mutedForeground }}>This project could not be found.</LoomText></ScrollView>
        )}
      </View>
    </SignedInGate>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  nav: { minHeight: 47, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1 },
  navTitle: { fontSize: 16, fontFamily: fonts.semibold },
  form: { width: '100%', maxWidth: 650, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 22, paddingBottom: 38 },
  heading: { fontSize: 31, marginBottom: 17 },
  card: { width: '100%', maxWidth: '100%', minWidth: 0, borderWidth: 1, borderRadius: 18, padding: 17 },
  input: { minHeight: 45, borderWidth: 1, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, fontFamily: fonts.body, marginBottom: 14 },
  designerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  designerModeRow: { flexDirection: 'row', gap: 4 },
  designerModeButton: { minHeight: 45, borderWidth: 1, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  designerInput: { flex: 1, minWidth: 0, marginBottom: 0 },
  designerPagePreview: { width: '100%', maxWidth: '100%', minWidth: 0, alignSelf: 'stretch', overflow: 'hidden', gap: 5, borderWidth: 1, borderRadius: 9, padding: 11, marginBottom: 12 },
  designerPageTitle: { width: '100%', maxWidth: '100%', minWidth: 0, flexShrink: 1 },
  multiline: { minHeight: 92, paddingTop: 12 },
});

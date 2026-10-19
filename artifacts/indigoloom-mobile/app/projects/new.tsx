import { useCreateProject, usePreviewDesignerWebsiteTitle, getGetDashboardQueryKey, getGetProjectsQueryKey, getGetStashYarnsQueryKey } from '@workspace/api-client-react';
import { ProjectYarnsField, yarnsForApi, type YarnDraft } from '@/components/ProjectYarns';
import type { CreateProject } from '@workspace/api-client-react';
import { HookSizePicker, type CrochetHookSizeValue } from '@/components/HookSizePicker';
import { NeedleFields, emptyNeedles, needlesForApi, type NeedlesDraft } from '@/components/NeedleFields';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { ProjectDateField, projectDateForApi, type ProjectDatePrecision } from '@/components/ProjectDateField';
import { FormFieldLabel, LoomButton, LoomText, SignedInGate, fonts } from '@/components/loom';
import { ProgressMethodPicker, defaultProgressSettings, progressSettingsError, progressSettingsForApi, type ProgressSettingsDraft } from '@/components/ProgressMethod';
import { useColors } from '@/hooks/useColors';
import { useRef, useState } from 'react';

export default function NewProjectScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const client = useQueryClient();
  const create = useCreateProject();
  const previewTitle = usePreviewDesignerWebsiteTitle();
  const [title, setTitle] = useState('');
  const [craft, setCraft] = useState<'knitting' | 'crochet'>('knitting');
  const [patternName, setPatternName] = useState('');
  const [patternDesigner, setPatternDesigner] = useState('');
  const [designerMode, setDesignerMode] = useState<'name' | 'website'>('name');
  const [designerWebsite, setDesignerWebsite] = useState('');
  const designerWebsiteRef = useRef('');
  const [designerPageTitle, setDesignerPageTitle] = useState('');
  const [designerPreviewMessage, setDesignerPreviewMessage] = useState('');
  const [yarns, setYarns] = useState<YarnDraft[]>([]);
  const [yarnsError, setYarnsError] = useState('');
  const [hookSize, setHookSize] = useState<CrochetHookSizeValue | null>(null);
  const [needles, setNeedles] = useState<NeedlesDraft>(emptyNeedles);
  const [startedAt, setStartedAt] = useState('');
  const [startedAtPrecision, setStartedAtPrecision] = useState<ProjectDatePrecision>('day');
  const [targetDate, setTargetDate] = useState('');
  const [targetDatePrecision, setTargetDatePrecision] = useState<ProjectDatePrecision>('day');
  const [description, setDescription] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [progressSettings, setProgressSettings] = useState<ProgressSettingsDraft>(defaultProgressSettings);
  const [showProgressError, setShowProgressError] = useState(false);

  const fieldStyle = [styles.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.input }];
  const inputProps = { placeholderTextColor: colors.mutedForeground };
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
  const save = () => {
    setErrorMessage('');
    if (!title.trim()) {
      setErrorMessage('Give your project a name to get started.');
      return;
    }
    if (progressSettingsError(progressSettings)) {
      setShowProgressError(true);
      return;
    }
    const yarnList = yarnsForApi(yarns);
    setYarnsError(typeof yarnList === 'string' ? yarnList : '');
    if (typeof yarnList === 'string') return;
    const payload: CreateProject = {
      title: title.trim(),
      craft,
      status: 'planning',
      description: description.trim() || null,
      patternName: patternName.trim() || null,
      patternDesigner: patternDesigner.trim() || null,
      designerWebsite: designerMode === 'website' ? designerWebsite.trim() || null : null,
      designerPageTitle: designerMode === 'website' ? designerPageTitle.trim() || null : null,
      yarns: yarnList,
      tools: null,
      hookSize: craft === 'crochet' ? hookSize : null,
      ...needlesForApi(needles, craft === 'knitting'),
      startedAt: projectDateForApi(startedAt, startedAtPrecision),
      startedAtPrecision,
      targetDate: projectDateForApi(targetDate, targetDatePrecision),
      targetDatePrecision,
      ...progressSettingsForApi(progressSettings),
    };
    create.mutate({ data: payload }, {
      onSuccess: (project) => {
        void client.invalidateQueries({ queryKey: getGetProjectsQueryKey() });
        void client.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
        void client.invalidateQueries({ queryKey: getGetStashYarnsQueryKey() });
        router.replace({ pathname: '/projects/[id]', params: { id: project.id } });
      },
      onError: () => setErrorMessage('We could not save this project just now. Your details are still here — please try again.'),
    });
  };

  return (
    <SignedInGate>
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={[styles.nav, { paddingTop: insets.top + 9, borderBottomColor: colors.border }]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={styles.back}><Feather name="arrow-left" size={19} color={colors.primary} /></Pressable>
          <LoomText style={[styles.navTitle, { color: colors.foreground }]}>New project</LoomText>
          <View style={{ width: 38 }} />
        </View>
        <KeyboardAwareScrollViewCompat contentContainerStyle={styles.form} bottomOffset={80} keyboardShouldPersistTaps="handled">
          <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <FormFieldLabel>Project name *</FormFieldLabel>
            <TextInput {...inputProps} value={title} onChangeText={setTitle} maxLength={160} placeholder="e.g. Juniper cardigan" style={fieldStyle} testID="input-project-title" />
            <FormFieldLabel>Craft</FormFieldLabel>
            <View style={styles.choiceRow}>
              {(['knitting', 'crochet'] as const).map((item) => {
                const active = craft === item;
                return <Pressable key={item} onPress={() => setCraft(item)} style={[styles.choice, { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.selectedWash : colors.background }]}><Feather name={item === 'knitting' ? 'git-merge' : 'corner-down-right'} size={15} color={active ? colors.primary : colors.mutedForeground} /><LoomText style={{ color: active ? colors.primary : colors.mutedForeground, fontFamily: fonts.semibold, fontSize: 15 }}>{item === 'knitting' ? 'Knitting' : 'Crochet'}</LoomText></Pressable>;
              })}
            </View>
            <ProgressMethodPicker value={progressSettings} onChange={setProgressSettings} error={showProgressError ? progressSettingsError(progressSettings) : ''} />
            <View style={[styles.divider, { borderColor: colors.border }]} />
            <LoomText style={[styles.sectionLabel, { color: colors.primary }]}>Pattern and materials</LoomText>
            <FormFieldLabel>Pattern name</FormFieldLabel>
            <TextInput {...inputProps} value={patternName} onChangeText={setPatternName} placeholder="Pattern or source" style={fieldStyle} />
            <FormFieldLabel>Designer</FormFieldLabel>
            <View style={styles.designerRow}>
              <View style={styles.designerModeRow} accessibilityLabel="Designer entry option">
                {(['name', 'website'] as const).map((option) => {
                  const active = designerMode === option;
                  return <Pressable key={option} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => { setDesignerMode(option); setDesignerPreviewMessage(''); }} style={[styles.designerModeButton, { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.selectedWash : colors.background }]} testID={`button-create-designer-${option}`}>
                    <LoomText style={{ color: active ? colors.primary : colors.mutedForeground, fontSize: 14, fontFamily: fonts.semibold }}>{option === 'name' ? 'Name' : 'Website'}</LoomText>
                  </Pressable>;
                })}
              </View>
              {designerMode === 'name'
                ? <TextInput {...inputProps} value={patternDesigner} onChangeText={setPatternDesigner} placeholder="Who made the pattern?" style={[...fieldStyle, styles.designerInput]} testID="input-pattern-designer" />
                : <TextInput {...inputProps} value={designerWebsite} onChangeText={(value) => { designerWebsiteRef.current = value; setDesignerWebsite(value); setPatternDesigner(''); setDesignerPageTitle(''); setDesignerPreviewMessage(''); }} placeholder="https://example.com" autoCapitalize="none" autoCorrect={false} keyboardType="url" style={[...fieldStyle, styles.designerInput]} testID="input-create-designer-website" />}
            </View>
            {designerMode === 'website' ? (
              <>
                <LoomButton title="Preview page title" variant="quiet" onPress={previewDesignerTitle} busy={previewTitle.isPending} testID="button-create-preview-designer-title" />
                {designerPageTitle ? <View style={[styles.designerPagePreview, { backgroundColor: colors.selectedWash, borderColor: colors.border }]}><LoomText style={{ color: colors.mutedForeground, fontSize: 13, letterSpacing: 1 }}>Page title preview</LoomText><LoomText numberOfLines={2} ellipsizeMode="tail" style={[styles.designerPageTitle, { color: colors.foreground, fontFamily: fonts.semibold, fontSize: 15 }]}>{designerPageTitle}</LoomText></View> : null}
                {designerPreviewMessage ? <LoomText accessibilityRole="alert" style={{ color: colors.mutedForeground, fontSize: 14, lineHeight: 20, marginBottom: 12 }}>{designerPreviewMessage}</LoomText> : null}
              </>
            ) : null}
            <LoomText style={[styles.sectionLabel, { color: colors.primary }]}>Yarn</LoomText>
            <ProjectYarnsField value={yarns} onChange={(value) => { setYarns(value); setYarnsError(''); }} error={yarnsError} />
            {craft === 'crochet' ? (
              <>
                <FormFieldLabel>Hook size</FormFieldLabel>
                <HookSizePicker value={hookSize} onChange={setHookSize} testID="select-crochet-hook-size" />
              </>
            ) : (
              <NeedleFields value={needles} onChange={setNeedles} testIDPrefix="select" />
            )}
            <ProjectDateField label="Started on" value={startedAt} precision={startedAtPrecision} onChange={setStartedAt} onPrecisionChange={setStartedAtPrecision} testID="input-start-date" />
            <ProjectDateField label="Aiming for (optional)" value={targetDate} precision={targetDatePrecision} onChange={setTargetDate} onPrecisionChange={setTargetDatePrecision} testID="input-target-date" />
            <FormFieldLabel>Notes</FormFieldLabel>
            <TextInput {...inputProps} value={description} onChangeText={setDescription} placeholder="What made you fall for this one?" multiline numberOfLines={4} textAlignVertical="top" style={[...fieldStyle, styles.multiline]} />
            {errorMessage ? <LoomText accessibilityRole="alert" style={[styles.error, { color: colors.destructive }]}>{errorMessage}</LoomText> : null}
            <LoomButton title="Save this project" icon="arrow-right" onPress={save} busy={create.isPending} disabled={!title.trim()} testID="button-save-project" />
          </View>
        </KeyboardAwareScrollViewCompat>
      </View>
    </SignedInGate>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  nav: { minHeight: 48, paddingHorizontal: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1 },
  navTitle: { fontFamily: fonts.semibold, fontSize: 16 },
  back: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  form: { width: '100%', maxWidth: 650, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 23, paddingBottom: 40 },
  formCard: { width: '100%', maxWidth: '100%', minWidth: 0, borderWidth: 1, borderRadius: 18, padding: 17 },
  sectionLabel: { fontFamily: fonts.semibold, fontSize: 15, marginBottom: 13 },
  input: { minHeight: 45, borderWidth: 1, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, fontFamily: fonts.body, marginBottom: 14 },
  choiceRow: { flexDirection: 'row', gap: 9, marginBottom: 14 },
  designerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  designerModeRow: { flexDirection: 'row', gap: 4 },
  designerModeButton: { minHeight: 45, borderWidth: 1, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  designerInput: { flex: 1, minWidth: 0, marginBottom: 0 },
  designerPagePreview: { width: '100%', maxWidth: '100%', minWidth: 0, alignSelf: 'stretch', overflow: 'hidden', gap: 5, borderWidth: 1, borderRadius: 9, padding: 11, marginBottom: 12 },
  designerPageTitle: { width: '100%', maxWidth: '100%', minWidth: 0, flexShrink: 1 },
  choice: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 42, borderWidth: 1, borderRadius: 10 },
  divider: { borderTopWidth: 1, marginVertical: 8 },
  multiline: { minHeight: 94, paddingTop: 12 },
  error: { fontSize: 15, lineHeight: 22, marginBottom: 12 },
});

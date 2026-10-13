import { useEffect, useState } from 'react';
import { useGetProject, useUpdateProject, getGetDashboardQueryKey, getGetProjectQueryKey, getGetProjectsQueryKey } from '@workspace/api-client-react';
import type { UpdateProject } from '@workspace/api-client-react';
import { useLocalSearchParams, router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Feather } from '@expo/vector-icons';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { FormFieldLabel, LoadingState, LoomButton, LoomText, SignedInGate, fonts } from '@/components/loom';
import { useColors } from '@/hooks/useColors';

export default function EditProjectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const client = useQueryClient();
  const query = useGetProject(id);
  const update = useUpdateProject();
  const project = query.data;
  const [title, setTitle] = useState('');
  const [patternName, setPatternName] = useState('');
  const [patternDesigner, setPatternDesigner] = useState('');
  const [yarn, setYarn] = useState('');
  const [tools, setTools] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    if (!project) return;
    setTitle(project.title);
    setPatternName(project.patternName || '');
    setPatternDesigner(project.patternDesigner || '');
    setYarn(project.yarn || '');
    setTools(project.tools || '');
    setDescription(project.description || '');
  }, [project?.id]);
  const inputStyle = [styles.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.input }];
  const save = () => {
    if (!project || !title.trim()) {
      setError('A project name is required.');
      return;
    }
    const data: UpdateProject = {
      title: title.trim(),
      patternName: patternName.trim() || null,
      patternDesigner: patternDesigner.trim() || null,
      yarn: yarn.trim() || null,
      tools: tools.trim() || null,
      description: description.trim() || null,
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
        {query.isLoading ? <LoadingState label="Gathering your project…" /> : project ? (
          <KeyboardAwareScrollViewCompat contentContainerStyle={styles.form} bottomOffset={75} keyboardShouldPersistTaps="handled">
            <LoomText serif style={[styles.heading, { color: colors.foreground }]}>The details</LoomText>
            <LoomText style={[styles.intro, { color: colors.mutedForeground }]}>Update the notes you want to keep close.</LoomText>
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <FormFieldLabel>Project name</FormFieldLabel>
              <TextInput value={title} onChangeText={setTitle} style={inputStyle} />
              <FormFieldLabel>Pattern name</FormFieldLabel>
              <TextInput value={patternName} onChangeText={setPatternName} placeholder="Pattern or source" placeholderTextColor={colors.mutedForeground} style={inputStyle} />
              <FormFieldLabel>Designer</FormFieldLabel>
              <TextInput value={patternDesigner} onChangeText={setPatternDesigner} placeholder="Who made the pattern?" placeholderTextColor={colors.mutedForeground} style={inputStyle} />
              <FormFieldLabel>Yarn</FormFieldLabel>
              <TextInput value={yarn} onChangeText={setYarn} placeholder="Fiber, color, weight…" placeholderTextColor={colors.mutedForeground} style={inputStyle} />
              <FormFieldLabel>Tools</FormFieldLabel>
              <TextInput value={tools} onChangeText={setTools} placeholder="Needle or hook size…" placeholderTextColor={colors.mutedForeground} style={inputStyle} />
              <FormFieldLabel>Notes to future you</FormFieldLabel>
              <TextInput value={description} onChangeText={setDescription} placeholder="What made you fall for this one?" placeholderTextColor={colors.mutedForeground} multiline numberOfLines={4} textAlignVertical="top" style={[...inputStyle, styles.multiline]} />
              {error ? <LoomText accessibilityRole="alert" style={{ color: colors.destructive, fontSize: 12, marginBottom: 12 }}>{error}</LoomText> : null}
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
  navTitle: { fontSize: 13, fontFamily: fonts.semibold },
  form: { width: '100%', maxWidth: 650, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 22, paddingBottom: 38 },
  heading: { fontSize: 31 },
  intro: { fontSize: 13, marginTop: 5, marginBottom: 17 },
  card: { borderWidth: 1, borderRadius: 18, padding: 17 },
  input: { minHeight: 45, borderWidth: 1, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, fontFamily: fonts.body, marginBottom: 14 },
  multiline: { minHeight: 92, paddingTop: 12 },
});

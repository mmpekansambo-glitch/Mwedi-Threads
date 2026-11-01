import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/expo';
import { Feather } from '@expo/vector-icons';
import { File } from 'expo-file-system';
import { fetch as expoFetch } from 'expo/fetch';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Alert, Linking, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getGetSewingPatternQueryKey, getGetSewingPatternsQueryKey,
  requestSewingPatternPhotoUpload, useCreateSewingPattern, useDeleteSewingPattern, useGetSewingPatterns, useUpdateSewingPattern,
  refreshPaths, showRemoved, showSaved,
} from '@workspace/api-client-react';
import type { SewingPattern, SewingPatternFormat, SewingPatternType } from '@workspace/api-client-react';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { FormFieldLabel, LoomButton, LoomText, fonts } from '@/components/loom';
import { TapWheelRow } from '@/components/SewingFields';
import { useSewingColors } from '@/hooks/useColors';

// A to Z, with Other last.
export const patternTypes: Array<{ value: SewingPatternType; label: string }> = [
  { value: 'accessories', label: 'Accessories' },
  { value: 'activewear', label: 'Activewear' },
  { value: 'baby', label: 'Baby' },
  { value: 'bag', label: 'Bag' },
  { value: 'coat', label: 'Coat' },
  { value: 'costume', label: 'Costume' },
  { value: 'dress', label: 'Dress' },
  { value: 'home', label: 'Home' },
  { value: 'jacket', label: 'Jacket' },
  { value: 'jumpsuit', label: 'Jumpsuit' },
  { value: 'kids', label: 'Kids' },
  { value: 'knitwear', label: 'Knit top or sweater' },
  { value: 'lingerie', label: 'Lingerie' },
  { value: 'menswear', label: 'Menswear' },
  { value: 'quilt', label: 'Quilt' },
  { value: 'shirt', label: 'Shirt' },
  { value: 'shorts', label: 'Shorts' },
  { value: 'skirt', label: 'Skirt' },
  { value: 'sleepwear', label: 'Sleepwear' },
  { value: 'swimwear', label: 'Swimwear' },
  { value: 'top', label: 'Top' },
  { value: 'trousers', label: 'Trousers' },
  { value: 'other', label: 'Other' },
];

export const patternFormats: Array<{ value: SewingPatternFormat; label: string }> = [
  { value: 'paper', label: 'Paper' },
  { value: 'pdf', label: 'PDF' },
  { value: 'magazine', label: 'Magazine' },
  { value: 'self_drafted', label: 'Self-drafted' },
];

const labelOf = <T extends string>(options: Array<{ value: T; label: string }>, value: T | null | '') =>
  options.find((item) => item.value === value)?.label;

export function patternDetails(pattern: Pick<SewingPattern, 'designer' | 'patternType' | 'format' | 'sizes'>): string {
  return [labelOf(patternTypes, pattern.patternType), labelOf(patternFormats, pattern.format), pattern.designer, pattern.sizes && `Sizes ${pattern.sizes}`]
    .filter(Boolean).join(' · ');
}

export function timesMadeLabel(times: number): string {
  return times === 1 ? 'Made once' : `Made ${times} times`;
}

// The pattern's private cover photo, or a drawn shirt when there is none.
export function PatternThumb({ pattern, size = 56 }: { pattern?: Pick<SewingPattern, 'id' | 'updatedAt' | 'hasPhoto' | 'name'>; size?: number }) {
  const colors = useSewingColors();
  const { getToken } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const hasPhoto = Boolean(pattern?.hasPhoto);
  useEffect(() => {
    let active = true;
    if (hasPhoto) void getToken().then((value) => { if (active) setToken(value ?? null); });
    return () => { active = false; };
  }, [getToken, hasPhoto]);
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  const box = [styles.thumb, { width: size, height: size, backgroundColor: colors.selectedWash }];
  if (pattern && hasPhoto && domain && token) {
    return (
      <Image
        source={{ uri: `https://${domain}/api/sewing-patterns/${pattern.id}/photo?v=${encodeURIComponent(String(pattern.updatedAt))}`, headers: { Authorization: `Bearer ${token}` } }}
        style={box}
        contentFit="cover"
        accessibilityLabel={`${pattern.name} cover`}
      />
    );
  }
  return <View style={[box, styles.thumbIcon]}><Feather name="file-text" size={Math.round(size * 0.4)} color={colors.primaryText} /></View>;
}

// The pattern a project uses: one from the stash, or a new one typed here
// that the server adds to the stash when the project is saved.
export type ChosenPattern = { id: string; name: string; designer: string | null; pattern?: SewingPattern } | { id: null; name: string; designer: string | null };

export function patternForApi(chosen: ChosenPattern | null) {
  if (!chosen) return { patternId: null, patternName: null, patternDesigner: null };
  if (chosen.id) return { patternId: chosen.id };
  return { patternId: null, patternName: chosen.name, patternDesigner: chosen.designer };
}

// The Pattern part of the sewing project form: a tap row that opens the
// maker's patterns, with a short form for one that isn't saved yet.
export function ProjectPatternField({ chosen, onChange }: { chosen: ChosenPattern | null; onChange: (chosen: ChosenPattern | null) => void }) {
  const colors = useSewingColors();
  const [picking, setPicking] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [designer, setDesigner] = useState('');
  const patterns = useGetSewingPatterns({}, { query: { enabled: picking, queryKey: getGetSewingPatternsQueryKey({}) } });
  const inputStyle = [styles.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.input }];
  const close = () => { setPicking(false); setAdding(false); setName(''); setDesigner(''); };
  const pick = (next: ChosenPattern) => { onChange(next); close(); };

  if (chosen) {
    const details = chosen.id && chosen.pattern ? patternDetails(chosen.pattern) : chosen.designer;
    return (
      <>
      <FormFieldLabel>Pattern</FormFieldLabel>
      <View style={[styles.chosen, { borderColor: colors.border }]} testID="sewing-pattern-chosen">
        <PatternThumb pattern={chosen.id ? chosen.pattern : undefined} size={46} />
        <View style={{ flex: 1 }}>
          <LoomText style={{ color: colors.foreground, fontFamily: fonts.semibold, fontSize: 15 }}>{chosen.name}</LoomText>
          {details ? <LoomText style={{ color: colors.mutedForeground, fontSize: 13 }}>{details}</LoomText> : null}
          {!chosen.id ? <LoomText style={{ color: colors.mutedForeground, fontSize: 13 }}>Adds to your patterns when you save</LoomText> : null}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${chosen.name}`} onPress={() => onChange(null)} style={styles.remove} testID="button-remove-sewing-pattern"><Feather name="x" size={16} color={colors.mutedForeground} /></Pressable>
      </View>
      </>
    );
  }
  if (!picking) {
    return (
      <View style={[styles.tapRows, { borderColor: colors.border }]}>
        <Pressable accessibilityRole="button" onPress={() => setPicking(true)} style={styles.tapRow} testID="row-sewing-pattern">
          <LoomText style={{ flex: 1, color: colors.foreground, fontFamily: fonts.semibold, fontSize: 16 }}>Pattern</LoomText>
          <LoomText style={{ color: colors.primaryText, fontFamily: fonts.semibold, fontSize: 15 }}>Choose</LoomText>
          <Feather name="chevron-right" size={16} color={colors.primaryText} />
        </Pressable>
      </View>
    );
  }
  return (
    <>
    <FormFieldLabel>Pattern</FormFieldLabel>
    <View style={[styles.picker, { backgroundColor: colors.selectedWash, borderColor: colors.border }]}>
      {adding ? (
        <>
          <TextInput value={name} onChangeText={setName} maxLength={160} placeholder="Pattern name" placeholderTextColor={colors.mutedForeground} style={inputStyle} accessibilityLabel="Pattern name" testID="input-new-pattern-name" />
          <TextInput value={designer} onChangeText={setDesigner} maxLength={160} placeholder="Designer (optional)" placeholderTextColor={colors.mutedForeground} style={inputStyle} accessibilityLabel="Designer" testID="input-new-pattern-designer" />
          <View style={styles.actions}>
            <LoomButton title="Back" variant="quiet" onPress={() => setAdding(false)} />
            <LoomButton title="Use this pattern" disabled={!name.trim()} onPress={() => pick({ id: null, name: name.trim(), designer: designer.trim() || null })} testID="button-use-new-pattern" />
          </View>
        </>
      ) : (
        <>
          {patterns.isLoading ? <LoomText style={{ color: colors.mutedForeground, fontSize: 14 }}>Loading your patterns…</LoomText>
            : patterns.data?.length ? patterns.data.map((pattern) => (
              <Pressable key={pattern.id} accessibilityRole="button" onPress={() => pick({ id: pattern.id, name: pattern.name, designer: pattern.designer, pattern })} style={[styles.pick, { backgroundColor: colors.card, borderColor: colors.border }]} testID={`button-pick-pattern-${pattern.id}`}>
                <PatternThumb pattern={pattern} size={46} />
                <View style={{ flex: 1 }}>
                  <LoomText style={{ color: colors.foreground, fontFamily: fonts.semibold, fontSize: 15 }}>{pattern.name}</LoomText>
                  {patternDetails(pattern) ? <LoomText numberOfLines={1} style={{ color: colors.mutedForeground, fontSize: 13 }}>{patternDetails(pattern)}</LoomText> : null}
                </View>
              </Pressable>
            )) : <LoomText style={{ color: colors.mutedForeground, fontSize: 14 }}>Your pattern stash is empty.</LoomText>}
          <LoomButton title="A pattern not in your stash" icon="plus" variant="secondary" onPress={() => setAdding(true)} testID="button-new-pattern" />
          <LoomButton title="Close" variant="quiet" onPress={close} />
        </>
      )}
    </View>
    </>
  );
}

type PatternPhoto = { kind: 'kept' } | { kind: 'new'; asset: ImagePicker.ImagePickerAsset } | null;

export function SewingPatternForm({ pattern }: { pattern?: SewingPattern }) {
  const colors = useSewingColors();
  const insets = useSafeAreaInsets();
  const client = useQueryClient();
  const create = useCreateSewingPattern();
  const update = useUpdateSewingPattern();
  const remove = useDeleteSewingPattern();
  const [name, setName] = useState(pattern?.name ?? '');
  const [designer, setDesigner] = useState(pattern?.designer ?? '');
  const [patternType, setPatternType] = useState<SewingPatternType | null>(pattern?.patternType ?? null);
  const [format, setFormat] = useState<SewingPatternFormat | null>(pattern?.format ?? null);
  const [sizes, setSizes] = useState(pattern?.sizes ?? '');
  const [notes, setNotes] = useState(pattern?.notes ?? '');
  const [photo, setPhoto] = useState<PatternPhoto>(pattern?.hasPhoto ? { kind: 'kept' } : null);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const inputStyle = [styles.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.input }];
  const inputProps = { placeholderTextColor: colors.mutedForeground };
  const shownValue = (text: string | undefined) => (text ? <LoomText style={{ color: colors.foreground, fontSize: 15 }}>{text}</LoomText> : null);

  const pickPhoto = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Photo library access', 'Allow access to choose a cover photo in Settings.', [
          { text: 'Not now', style: 'cancel' },
          { text: 'Open Settings', onPress: () => { void Linking.openSettings(); } },
        ]);
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85, allowsEditing: true });
      if (!result.canceled && result.assets[0]) setPhoto({ kind: 'new', asset: result.assets[0] });
    } catch {
      setMessage('We could not open your photo library. Please try again.');
    }
  };

  const uploadPhoto = async (asset: ImagePicker.ImagePickerAsset) => {
    const file = new File(asset.uri);
    const contentType = asset.mimeType || 'image/jpeg';
    const fileSize = asset.fileSize ?? file.size;
    if (fileSize > 10 * 1024 * 1024) throw new Error('Choose a photo smaller than 10 MB.');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(contentType)) throw new Error('Choose a JPEG, PNG, or WebP photo.');
    const upload = await requestSewingPatternPhotoUpload({ name: asset.fileName || 'pattern-photo', size: Math.max(1, fileSize), contentType: contentType as 'image/jpeg' | 'image/png' | 'image/webp' });
    const response = await expoFetch(upload.uploadURL, { method: 'PUT', headers: { 'Content-Type': contentType }, body: file });
    if (!response.ok) throw new Error('Photo upload failed.');
    return upload.photoPath;
  };

  const done = (saved?: SewingPattern | void) => {
    if (saved) showSaved(client, { list: getGetSewingPatternsQueryKey(), item: getGetSewingPatternQueryKey(saved.id) }, saved);
    else if (pattern) showRemoved(client, getGetSewingPatternsQueryKey(), pattern.id);
    refreshPaths(client, '/api/sewing-projects', '/api/sewing-overview');
    router.back();
  };

  const save = async () => {
    setMessage('');
    if (!name.trim()) return setMessage('Give it a name.');
    setSaving(true);
    let photoPath: string | null | undefined = photo?.kind === 'kept' || (!photo && !pattern?.hasPhoto) ? undefined : null;
    if (photo?.kind === 'new') {
      try {
        photoPath = await uploadPhoto(photo.asset);
      } catch (error) {
        setMessage(error instanceof Error && error.message.startsWith('Choose') ? error.message : 'We could not upload that photo. Please try again.');
        setSaving(false);
        return;
      }
    }
    const data = {
      name: name.trim(), designer: designer.trim() || null, patternType, format, sizes: sizes.trim() || null, notes: notes.trim() || null,
      ...(photoPath !== undefined ? { photoPath } : {}),
    };
    const options = {
      onSuccess: done,
      onError: (error: unknown) => setMessage((error as { data?: { error?: string } })?.data?.error ?? 'We could not save this pattern just now. Please try again.'),
      onSettled: () => setSaving(false),
    };
    if (pattern) update.mutate({ sewingPatternId: pattern.id, data }, options);
    else create.mutate({ data }, options);
  };

  const deletePattern = () => pattern && remove.mutate({ sewingPatternId: pattern.id }, {
    onSuccess: () => done(),
    onError: () => setMessage('We could not remove this pattern. Please try again.'),
  });

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.nav, { paddingTop: insets.top + 9, borderBottomColor: colors.border }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={styles.navButton}><Feather name="arrow-left" size={19} color={colors.primaryText} /></Pressable>
        <LoomText numberOfLines={1} style={[styles.navTitle, { color: colors.foreground }]}>{pattern ? pattern.name : 'Add a pattern'}</LoomText>
        {pattern ? <Pressable accessibilityRole="button" accessibilityLabel="Delete pattern" onPress={() => setConfirmDelete(true)} style={styles.navButton} testID="button-delete-pattern"><Feather name="trash-2" size={18} color={colors.destructive} /></Pressable> : <View style={styles.navButton} />}
      </View>
      <KeyboardAwareScrollViewCompat contentContainerStyle={styles.form} bottomOffset={80} keyboardShouldPersistTaps="handled">
        {confirmDelete ? (
          <View style={[styles.confirm, { backgroundColor: colors.card, borderColor: colors.destructive }]}>
            <LoomText style={{ color: colors.foreground, fontFamily: fonts.semibold, fontSize: 15 }}>Remove this pattern?</LoomText>
            <LoomText style={{ color: colors.mutedForeground, fontSize: 14, marginTop: 4 }}>Projects that used it will show no pattern.</LoomText>
            <View style={styles.actions}>
              <LoomButton title="Cancel" variant="quiet" onPress={() => setConfirmDelete(false)} />
              <LoomButton title="Remove pattern" variant="danger" onPress={deletePattern} busy={remove.isPending} testID="button-confirm-delete-pattern" />
            </View>
          </View>
        ) : null}
        {pattern?.timesMade ? <LoomText style={[styles.made, { color: colors.primaryText }]} testID="pattern-times-made">{timesMadeLabel(pattern.timesMade)}</LoomText> : null}
        <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <FormFieldLabel>Name *</FormFieldLabel>
          <TextInput {...inputProps} value={name} onChangeText={setName} maxLength={160} placeholder="e.g. Wrap dress" style={inputStyle} testID="input-pattern-name" />
          <FormFieldLabel>Designer</FormFieldLabel>
          <TextInput {...inputProps} value={designer} onChangeText={setDesigner} maxLength={160} placeholder="Designer or company" style={inputStyle} testID="input-pattern-designer" />
          <View style={[styles.tapRows, { borderColor: colors.border }]}>
            <TapWheelRow
              first
              label="Type"
              shown={shownValue(labelOf(patternTypes, patternType))}
              wheels={[{ label: 'Type', items: patternTypes.map((item) => item.label), index: Math.max(0, patternTypes.findIndex((item) => item.value === patternType)) }]}
              onDone={([index]) => setPatternType(patternTypes[index ?? 0].value)}
              onClear={() => setPatternType(null)}
              testID="row-pattern-type"
            />
            <TapWheelRow
              label="Format"
              shown={shownValue(labelOf(patternFormats, format))}
              wheels={[{ label: 'Format', items: patternFormats.map((item) => item.label), index: Math.max(0, patternFormats.findIndex((item) => item.value === format)) }]}
              onDone={([index]) => setFormat(patternFormats[index ?? 0].value)}
              onClear={() => setFormat(null)}
              testID="row-pattern-format"
            />
          </View>
          <FormFieldLabel>Sizes</FormFieldLabel>
          <TextInput {...inputProps} value={sizes} onChangeText={setSizes} maxLength={80} placeholder="e.g. 6–24 or XS–XL" style={inputStyle} testID="input-pattern-sizes" />
          <FormFieldLabel>Notes</FormFieldLabel>
          <TextInput {...inputProps} value={notes} onChangeText={setNotes} maxLength={1000} multiline placeholder="Optional" style={[inputStyle, styles.notes]} testID="input-pattern-notes" />
          <FormFieldLabel>Cover photo</FormFieldLabel>
          <View style={styles.photoRow}>
            <Pressable accessibilityRole="button" accessibilityLabel={photo ? 'Change the photo' : 'Add a photo'} onPress={() => { void pickPhoto(); }} style={[styles.photo, { borderColor: colors.input, backgroundColor: colors.selectedWash }]} testID="button-pattern-photo">
              {photo?.kind === 'new' ? <Image source={{ uri: photo.asset.uri }} style={styles.photoImage} contentFit="cover" accessibilityLabel="Chosen cover photo" />
                : photo?.kind === 'kept' && pattern ? <PatternThumb pattern={pattern} size={112} />
                : <View style={styles.photoEmpty}><Feather name="camera" size={20} color={colors.primaryText} /><LoomText style={{ color: colors.primaryText, fontFamily: fonts.semibold, fontSize: 13 }}>Add a photo</LoomText></View>}
            </Pressable>
            {photo ? <LoomButton title="Remove photo" variant="quiet" onPress={() => setPhoto(null)} testID="button-remove-pattern-photo" /> : null}
          </View>
          {message ? <LoomText accessibilityRole="alert" style={[styles.error, { color: colors.destructive }]}>{message}</LoomText> : null}
          <LoomButton title={pattern ? 'Save changes' : 'Add pattern'} icon="arrow-right" onPress={() => { void save(); }} busy={saving} testID="button-save-pattern" />
        </View>
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const styles = StyleSheet.create({
  thumb: { borderRadius: 10, overflow: 'hidden' },
  thumbIcon: { alignItems: 'center', justifyContent: 'center' },
  screen: { flex: 1 },
  nav: { minHeight: 48, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1 },
  navButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  navTitle: { fontFamily: fonts.semibold, fontSize: 16, flex: 1, textAlign: 'center', marginHorizontal: 8 },
  form: { width: '100%', maxWidth: 650, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 23, paddingBottom: 40 },
  formCard: { width: '100%', borderWidth: 1, borderRadius: 18, padding: 17 },
  input: { minHeight: 45, borderWidth: 1, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, fontFamily: fonts.body, marginBottom: 14 },
  notes: { minHeight: 90, textAlignVertical: 'top' },
  tapRows: { borderWidth: 1, borderRadius: 12, marginBottom: 14 },
  tapRow: { minHeight: 52, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 6 },
  chosen: { flexDirection: 'row', alignItems: 'center', gap: 11, borderWidth: 1, borderRadius: 12, padding: 8, marginBottom: 14 },
  remove: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  picker: { borderWidth: 1, borderRadius: 12, padding: 10, gap: 8, marginBottom: 14 },
  pick: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 10, padding: 7 },
  made: { fontFamily: fonts.semibold, fontSize: 15, marginBottom: 12 },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  photo: { width: 112, height: 112, borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  photoImage: { width: '100%', height: '100%' },
  photoEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  error: { fontSize: 15, lineHeight: 22, marginBottom: 12 },
  confirm: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 14 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 4 },
});

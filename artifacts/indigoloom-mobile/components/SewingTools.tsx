import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/expo';
import { Feather } from '@expo/vector-icons';
import { File } from 'expo-file-system';
import { fetch as expoFetch } from 'expo/fetch';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getGetMyCraftsQueryKey, getGetSewingToolQueryKey, getGetSewingToolsQueryKey,
  requestSewingToolPhotoUpload, useCreateSewingTool, useDeleteSewingTool, useUpdateSewingTool,
} from '@workspace/api-client-react';
import type { SewingTool, SewingToolCategory, SewingToolSection } from '@workspace/api-client-react';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { FormFieldLabel, LoomButton, LoomText, fonts } from '@/components/loom';
import { useSewingColors } from '@/hooks/useColors';

type FeatherName = keyof typeof Feather.glyphMap;

export const toolSections: Array<{ value: SewingToolSection; label: string }> = [
  { value: 'notions', label: 'Notions' },
  { value: 'kit', label: 'Kit' },
];

type CategoryOption = { value: SewingToolCategory; label: string; section: SewingToolSection | 'both'; icon: FeatherName; example: string };

export const toolCategories: CategoryOption[] = [
  { value: 'zip', label: 'Zip', section: 'notions', icon: 'zap', example: 'Invisible zip' },
  { value: 'button', label: 'Buttons', section: 'notions', icon: 'circle', example: 'Shell buttons' },
  { value: 'elastic', label: 'Elastic', section: 'notions', icon: 'activity', example: 'Waistband elastic' },
  { value: 'thread', label: 'Thread', section: 'notions', icon: 'disc', example: 'All-purpose thread' },
  { value: 'interfacing', label: 'Interfacing', section: 'notions', icon: 'layers', example: 'Fusible interfacing' },
  { value: 'machine', label: 'Machine', section: 'kit', icon: 'settings', example: 'Overlocker' },
  { value: 'presser_foot', label: 'Presser foot', section: 'kit', icon: 'chevrons-down', example: 'Walking foot' },
  { value: 'needle', label: 'Needles', section: 'kit', icon: 'edit-2', example: 'Jersey needles' },
  { value: 'scissors', label: 'Scissors', section: 'kit', icon: 'scissors', example: 'Fabric shears' },
  { value: 'ruler', label: 'Ruler', section: 'kit', icon: 'maximize-2', example: 'Quilting ruler' },
  { value: 'other', label: 'Other', section: 'both', icon: 'box', example: 'Tailor’s ham' },
];

export function categoriesFor(section: SewingToolSection): CategoryOption[] {
  return toolCategories.filter((item) => item.section === section || item.section === 'both');
}

export function categoryFor(category: SewingToolCategory): CategoryOption {
  return toolCategories.find((item) => item.value === category) ?? toolCategories[toolCategories.length - 1]!;
}

export function toolDetails(tool: Pick<SewingTool, 'category' | 'size' | 'color' | 'brand'>): string {
  return [categoryFor(tool.category).label, tool.size, tool.color, tool.brand].filter(Boolean).join(' · ');
}

// Quantities are typed as text and checked before saving.
export function quantityForApi(value: string): number | null | 'invalid' {
  if (!value.trim()) return null;
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 && number <= 9999 ? number : 'invalid';
}

// The tool's private photo, or its type's icon when there is none.
export function ToolThumb({ tool, size = 56 }: { tool: SewingTool; size?: number }) {
  const colors = useSewingColors();
  const { getToken } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    if (tool.hasPhoto) void getToken().then((value) => { if (active) setToken(value ?? null); });
    return () => { active = false; };
  }, [getToken, tool.hasPhoto]);
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  const box = [styles.thumb, { width: size, height: size, backgroundColor: colors.selectedWash }];
  if (tool.hasPhoto && domain && token) {
    return (
      <Image
        source={{ uri: `https://${domain}/api/sewing-tools/${tool.id}/photo?v=${encodeURIComponent(String(tool.updatedAt))}`, headers: { Authorization: `Bearer ${token}` } }}
        style={box}
        contentFit="cover"
        accessibilityLabel={`${tool.name} photo`}
      />
    );
  }
  return <View style={[box, styles.thumbIcon]}><Feather name={categoryFor(tool.category).icon} size={Math.round(size * 0.4)} color={colors.primary} /></View>;
}

function Choices<T extends string>({ options, value, onChange, testID }: { options: Array<{ value: T; label: string }>; value: T | ''; onChange: (value: T) => void; testID: string }) {
  const colors = useSewingColors();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.choices} accessibilityRole="radiogroup">
      {options.map((item) => {
        const selected = value === item.value;
        return (
          <Pressable key={item.value} accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={() => onChange(item.value)} style={[styles.choice, { backgroundColor: selected ? colors.primary : colors.card, borderColor: selected ? colors.primary : colors.input }]} testID={`${testID}-${item.value}`}>
            <LoomText style={{ color: selected ? colors.primaryForeground : colors.foreground, fontFamily: fonts.semibold, fontSize: 14 }}>{item.label}</LoomText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// The photo is the saved one, a new one from the library, or none.
type ToolPhoto = { kind: 'kept' } | { kind: 'new'; asset: ImagePicker.ImagePickerAsset } | null;

export function SewingToolForm({ tool, section: startSection }: { tool?: SewingTool; section?: SewingToolSection }) {
  const colors = useSewingColors();
  const insets = useSafeAreaInsets();
  const client = useQueryClient();
  const create = useCreateSewingTool();
  const update = useUpdateSewingTool();
  const remove = useDeleteSewingTool();
  const [section, setSection] = useState<SewingToolSection>(tool?.section ?? startSection ?? 'notions');
  const [category, setCategory] = useState<SewingToolCategory | ''>(tool?.category ?? '');
  const [name, setName] = useState(tool?.name ?? '');
  const [quantity, setQuantity] = useState(tool?.quantity === null || !tool ? '' : String(tool.quantity));
  const [size, setSize] = useState(tool?.size ?? '');
  const [color, setColor] = useState(tool?.color ?? '');
  const [brand, setBrand] = useState(tool?.brand ?? '');
  const [notes, setNotes] = useState(tool?.notes ?? '');
  const [photo, setPhoto] = useState<ToolPhoto>(tool?.hasPhoto ? { kind: 'kept' } : null);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const inputStyle = [styles.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.input }];
  const inputProps = { placeholderTextColor: colors.mutedForeground };
  const example = category ? categoryFor(category).example : section === 'kit' ? 'Overlocker' : 'Invisible zip';

  const chooseSection = (next: SewingToolSection) => {
    setSection(next);
    if (category !== 'other') setCategory('');
  };

  const pickPhoto = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Photo library access', 'Allow access to choose a tool photo in Settings.', [
          { text: 'Not now', style: 'cancel' },
          { text: 'Open Settings', onPress: () => { void Linking.openSettings(); } },
        ]);
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85, allowsEditing: true, aspect: [1, 1] });
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
    const upload = await requestSewingToolPhotoUpload({ name: asset.fileName || 'tool-photo', size: Math.max(1, fileSize), contentType: contentType as 'image/jpeg' | 'image/png' | 'image/webp' });
    const response = await expoFetch(upload.uploadURL, { method: 'PUT', headers: { 'Content-Type': contentType }, body: file });
    if (!response.ok) throw new Error('Photo upload failed.');
    return upload.photoPath;
  };

  const done = () => {
    void client.invalidateQueries({ queryKey: getGetSewingToolsQueryKey() });
    void client.invalidateQueries({ queryKey: getGetMyCraftsQueryKey() });
    if (tool) void client.invalidateQueries({ queryKey: getGetSewingToolQueryKey(tool.id) });
    router.back();
  };

  const save = async () => {
    setMessage('');
    const quantityForSave = quantityForApi(quantity);
    if (!category) return setMessage('Choose what kind of tool this is.');
    if (!name.trim()) return setMessage('Give it a name.');
    if (quantityForSave === 'invalid') return setMessage('Enter a whole number for how many, like 3.');

    setSaving(true);
    let photoPath: string | null | undefined = photo?.kind === 'kept' || (!photo && !tool?.hasPhoto) ? undefined : null;
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
      section, category, name: name.trim(), quantity: quantityForSave, size: size.trim() || null,
      color: section === 'notions' ? color.trim() || null : null, brand: brand.trim() || null, notes: notes.trim() || null,
      ...(photoPath !== undefined ? { photoPath } : {}),
    };
    const options = {
      onSuccess: done,
      onError: (error: unknown) => setMessage((error as { data?: { error?: string } })?.data?.error ?? 'We could not save this tool just now. Please try again.'),
      onSettled: () => setSaving(false),
    };
    if (tool) update.mutate({ sewingToolId: tool.id, data }, options);
    else create.mutate({ data }, options);
  };

  const deleteTool = () => tool && remove.mutate({ sewingToolId: tool.id }, {
    onSuccess: done,
    onError: () => setMessage('We could not remove this tool. Please try again.'),
  });

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.nav, { paddingTop: insets.top + 9, borderBottomColor: colors.border }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={styles.navButton}><Feather name="arrow-left" size={19} color={colors.primary} /></Pressable>
        <LoomText numberOfLines={1} style={[styles.navTitle, { color: colors.foreground }]}>{tool ? tool.name : 'Add a tool'}</LoomText>
        {tool ? <Pressable accessibilityRole="button" accessibilityLabel="Delete tool" onPress={() => setConfirmDelete(true)} style={styles.navButton} testID="button-delete-tool"><Feather name="trash-2" size={18} color={colors.destructive} /></Pressable> : <View style={styles.navButton} />}
      </View>
      <KeyboardAwareScrollViewCompat contentContainerStyle={styles.form} bottomOffset={80} keyboardShouldPersistTaps="handled">
        {confirmDelete ? (
          <View style={[styles.confirm, { backgroundColor: colors.card, borderColor: colors.destructive }]}>
            <LoomText style={{ color: colors.foreground, fontFamily: fonts.semibold, fontSize: 15 }}>Remove this tool?</LoomText>
            <LoomText style={{ color: colors.mutedForeground, fontSize: 14, marginTop: 4 }}>Its photo will be deleted too.</LoomText>
            <View style={styles.confirmActions}>
              <LoomButton title="Cancel" variant="quiet" onPress={() => setConfirmDelete(false)} />
              <LoomButton title="Remove tool" variant="danger" onPress={deleteTool} busy={remove.isPending} testID="button-confirm-delete-tool" />
            </View>
          </View>
        ) : null}
        <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <FormFieldLabel>Section</FormFieldLabel>
          <Choices options={toolSections} value={section} onChange={chooseSection} testID="button-tool-section" />
          <FormFieldLabel>Type *</FormFieldLabel>
          <Choices options={categoriesFor(section)} value={category} onChange={setCategory} testID="button-tool-category" />
          <FormFieldLabel>Name *</FormFieldLabel>
          <TextInput {...inputProps} value={name} onChangeText={setName} maxLength={80} placeholder={`e.g. ${example}`} style={inputStyle} testID="input-tool-name" />
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <FormFieldLabel>How many</FormFieldLabel>
              <TextInput {...inputProps} value={quantity} onChangeText={setQuantity} keyboardType="number-pad" placeholder="Optional" style={inputStyle} testID="input-tool-quantity" />
            </View>
            <View style={{ flex: 1 }}>
              <FormFieldLabel>Size</FormFieldLabel>
              <TextInput {...inputProps} value={size} onChangeText={setSize} maxLength={40} placeholder={section === 'kit' ? 'e.g. 90/14' : 'e.g. 22 cm'} style={inputStyle} testID="input-tool-size" />
            </View>
          </View>
          {section === 'notions' ? (
            <>
              <FormFieldLabel>Color</FormFieldLabel>
              <TextInput {...inputProps} value={color} onChangeText={setColor} maxLength={40} placeholder="e.g. Navy" style={inputStyle} testID="input-tool-color" />
            </>
          ) : null}
          <FormFieldLabel>Brand</FormFieldLabel>
          <TextInput {...inputProps} value={brand} onChangeText={setBrand} maxLength={80} placeholder="Optional" style={inputStyle} testID="input-tool-brand" />
          <FormFieldLabel>Notes</FormFieldLabel>
          <TextInput {...inputProps} value={notes} onChangeText={setNotes} maxLength={1000} multiline placeholder="Optional" style={[inputStyle, styles.notes]} testID="input-tool-notes" />
          <FormFieldLabel>Photo</FormFieldLabel>
          <View style={styles.photoRow}>
            <Pressable accessibilityRole="button" accessibilityLabel={photo ? 'Change the photo' : 'Add a photo'} onPress={() => { void pickPhoto(); }} style={[styles.photo, { borderColor: colors.input, backgroundColor: colors.selectedWash }]} testID="button-tool-photo">
              {photo?.kind === 'new' ? <Image source={{ uri: photo.asset.uri }} style={styles.photoImage} contentFit="cover" accessibilityLabel="Chosen tool photo" />
                : photo?.kind === 'kept' && tool ? <ToolThumb tool={tool} size={112} />
                : <View style={styles.photoEmpty}><Feather name="camera" size={20} color={colors.primary} /><LoomText style={{ color: colors.primary, fontFamily: fonts.semibold, fontSize: 13 }}>Add a photo</LoomText></View>}
            </Pressable>
            {photo ? <LoomButton title="Remove photo" variant="quiet" onPress={() => setPhoto(null)} testID="button-remove-tool-photo" /> : null}
          </View>
          {message ? <LoomText accessibilityRole="alert" style={[styles.error, { color: colors.destructive }]}>{message}</LoomText> : null}
          <LoomButton title={tool ? 'Save changes' : 'Add tool'} icon="arrow-right" onPress={() => { void save(); }} busy={saving} testID="button-save-tool" />
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
  row: { flexDirection: 'row', gap: 10 },
  choices: { gap: 7, paddingBottom: 14 },
  choice: { borderWidth: 1, borderRadius: 99, paddingHorizontal: 14, minHeight: 36, justifyContent: 'center' },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  photo: { width: 112, height: 112, borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  photoImage: { width: '100%', height: '100%' },
  photoEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  error: { fontSize: 15, lineHeight: 22, marginBottom: 12 },
  confirm: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 14 },
  confirmActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 10 },
});

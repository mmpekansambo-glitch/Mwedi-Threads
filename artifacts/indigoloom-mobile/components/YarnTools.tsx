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
import Svg, { Circle, Path } from 'react-native-svg';
import { CrochetHookSize, KnittingNeedleSize, NeedleCableLength } from '@workspace/api-zod';
import {
  getGetMyCraftsQueryKey, getGetYarnToolQueryKey, getGetYarnToolsQueryKey,
  requestYarnToolPhotoUpload, useCreateYarnTool, useDeleteYarnTool, useUpdateYarnTool,
} from '@workspace/api-client-react';
import type { KnittingNeedleType, YarnNotionType, YarnTool, YarnToolMaterial, YarnToolSection } from '@workspace/api-client-react';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { OptionPicker } from '@/components/HookSizePicker';
import { FormFieldLabel, LoomButton, LoomText, fonts } from '@/components/loom';
import { quantityForApi } from '@/components/SewingTools';
import { useColors } from '@/hooks/useColors';

type FeatherName = keyof typeof Feather.glyphMap;
type CableLength = NonNullable<YarnTool['cableLength']>;

export const yarnToolSections: Array<{ value: YarnToolSection; label: string; one: string }> = [
  { value: 'hooks', label: 'Hooks', one: 'a hook' },
  { value: 'needles', label: 'Needles', one: 'needles' },
  { value: 'notions', label: 'Notions', one: 'a notion' },
];

const hookSizes = Object.values(CrochetHookSize) as string[];
const needleSizes = Object.values(KnittingNeedleSize) as string[];
const cableLengths = Object.values(NeedleCableLength) as CableLength[];

const materials: Array<{ value: YarnToolMaterial; label: string }> = [
  { value: 'aluminium', label: 'Aluminium' },
  { value: 'steel', label: 'Steel' },
  { value: 'bamboo', label: 'Bamboo' },
  { value: 'wood', label: 'Wood' },
  { value: 'plastic', label: 'Plastic' },
  { value: 'ergonomic', label: 'Ergonomic' },
];

const needleTypes: Array<{ value: KnittingNeedleType; label: string }> = [
  { value: 'straight', label: 'Straight' },
  { value: 'circular', label: 'Circular' },
  { value: 'double_pointed', label: 'Double-pointed' },
  { value: 'interchangeable', label: 'Interchangeable' },
];

type NotionOption = { value: YarnNotionType; label: string; icon: FeatherName; example: string };

const notionTypes: NotionOption[] = [
  { value: 'stitch_markers', label: 'Stitch markers', icon: 'map-pin', example: 'Locking stitch markers' },
  { value: 'tapestry_needles', label: 'Tapestry needles', icon: 'paperclip', example: 'Bent-tip darning needles' },
  { value: 'row_counter', label: 'Row counter', icon: 'hash', example: 'Clicker counter' },
  { value: 'cable_needles', label: 'Cable needles', icon: 'paperclip', example: 'U-shaped cable needles' },
  { value: 'scissors', label: 'Scissors', icon: 'scissors', example: 'Stork scissors' },
  { value: 'measuring_tape', label: 'Measuring tape', icon: 'maximize-2', example: 'Retractable tape' },
  { value: 'blocking_mats', label: 'Blocking mats', icon: 'grid', example: 'Foam blocking mats' },
  { value: 'blocking_pins', label: 'Blocking pins', icon: 'map-pin', example: 'T-pins' },
  { value: 'yarn_swift', label: 'Yarn swift', icon: 'wind', example: 'Umbrella swift' },
  { value: 'ball_winder', label: 'Ball winder', icon: 'rotate-cw', example: 'Hand-crank ball winder' },
  { value: 'other', label: 'Other', icon: 'box', example: 'Yarn bowl' },
];

const needleHasCable = (type: KnittingNeedleType | null) => type === 'circular' || type === 'interchangeable';
const labelOf = <T extends string>(options: Array<{ value: T; label: string }>, value: T | null) => options.find((item) => item.value === value)?.label;
const notionFor = (type: YarnNotionType | null) => notionTypes.find((item) => item.value === type);

// Hooks and needles are shown by size, notions by name or type.
export function yarnToolTitle(tool: YarnTool): string {
  if (tool.section === 'notions') return tool.name || notionFor(tool.notionType)?.label || 'Notion';
  return tool.name || tool.size || '';
}

export function yarnToolDetails(tool: YarnTool): string {
  const needleKind = tool.needleType ? labelOf(needleTypes, tool.needleType)! + (needleHasCable(tool.needleType) && tool.cableLength ? `, ${tool.cableLength}` : '') : '';
  const parts = tool.section === 'notions'
    ? [tool.name ? notionFor(tool.notionType)?.label : '', tool.brand]
    : [tool.name ? tool.size : '', needleKind, labelOf(materials, tool.material), tool.brand];
  return parts.filter(Boolean).join(' · ');
}

// Hooks and needles go smallest first; notions in list order by type, then name.
export function sortYarnTools(tools: YarnTool[]): YarnTool[] {
  const sizeRank = (tool: YarnTool) => (tool.section === 'hooks' ? hookSizes : needleSizes).indexOf(tool.size ?? '');
  const notionRank = (tool: YarnTool) => notionTypes.findIndex((item) => item.value === tool.notionType);
  return [...tools].sort((a, b) => a.section === 'notions'
    ? notionRank(a) - notionRank(b) || yarnToolTitle(a).localeCompare(yarnToolTitle(b))
    : sizeRank(a) - sizeRank(b) || yarnToolDetails(a).localeCompare(yarnToolDetails(b)));
}

// Feather has no crochet hook or knitting needle, so these are drawn.
function SectionIcon({ section, size, color }: { section: 'hooks' | 'needles'; size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      {section === 'hooks'
        ? <><Path d="M3 21 17 7" /><Path d="M17 7c1.5-1.6 3.8-1.3 4 .3.2 1.3-1 2.2-2.3 1.7" /></>
        : <><Path d="M3 21 15.5 8.5" /><Circle cx="18" cy="6" r="2.8" /></>}
    </Svg>
  );
}

// The tool's private photo, or an icon for its section or notion type.
export function YarnToolThumb({ tool, size = 56 }: { tool: YarnTool; size?: number }) {
  const colors = useColors();
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
        source={{ uri: `https://${domain}/api/yarn-tools/${tool.id}/photo?v=${encodeURIComponent(String(tool.updatedAt))}`, headers: { Authorization: `Bearer ${token}` } }}
        style={box}
        contentFit="cover"
        accessibilityLabel={`${yarnToolTitle(tool)} photo`}
      />
    );
  }
  const iconSize = Math.round(size * 0.4);
  return (
    <View style={[box, styles.thumbIcon]}>
      {tool.section === 'notions'
        ? <Feather name={notionFor(tool.notionType)?.icon ?? 'box'} size={iconSize} color={colors.primaryText} />
        : <SectionIcon section={tool.section} size={iconSize} color={colors.primaryText} />}
    </View>
  );
}

function Choices<T extends string>({ options, value, onChange, testID }: { options: Array<{ value: T; label: string }>; value: T | ''; onChange: (value: T) => void; testID: string }) {
  const colors = useColors();
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

export function YarnToolForm({ tool, section: startSection }: { tool?: YarnTool; section?: YarnToolSection }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const client = useQueryClient();
  const create = useCreateYarnTool();
  const update = useUpdateYarnTool();
  const remove = useDeleteYarnTool();
  const [section, setSection] = useState<YarnToolSection>(tool?.section ?? startSection ?? 'hooks');
  const [size, setSize] = useState<string | null>(tool?.size ?? null);
  const [needleType, setNeedleType] = useState<KnittingNeedleType | null>(tool?.needleType ?? null);
  const [cableLength, setCableLength] = useState<CableLength | null>(tool?.cableLength ?? null);
  const [material, setMaterial] = useState<YarnToolMaterial | null>(tool?.material ?? null);
  const [notionType, setNotionType] = useState<YarnNotionType | null>(tool?.notionType ?? null);
  const [name, setName] = useState(tool?.name ?? '');
  const [quantity, setQuantity] = useState(tool?.quantity === null || !tool ? '' : String(tool.quantity));
  const [brand, setBrand] = useState(tool?.brand ?? '');
  const [notes, setNotes] = useState(tool?.notes ?? '');
  const [photo, setPhoto] = useState<ToolPhoto>(tool?.hasPhoto ? { kind: 'kept' } : null);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const inputStyle = [styles.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.input }];
  const inputProps = { placeholderTextColor: colors.mutedForeground };
  const isNotion = section === 'notions';
  const example = isNotion ? notionFor(notionType)?.example ?? 'Locking stitch markers' : section === 'hooks' ? 'My favourite hook' : 'Sock set';

  // Hooks and needles use different size lists, so switching clears the size.
  const chooseSection = (next: YarnToolSection) => {
    if (next === section) return;
    setSection(next);
    setSize(null);
    setNeedleType(null);
    setCableLength(null);
    setMessage('');
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
    const upload = await requestYarnToolPhotoUpload({ name: asset.fileName || 'tool-photo', size: Math.max(1, fileSize), contentType: contentType as 'image/jpeg' | 'image/png' | 'image/webp' });
    const response = await expoFetch(upload.uploadURL, { method: 'PUT', headers: { 'Content-Type': contentType }, body: file });
    if (!response.ok) throw new Error('Photo upload failed.');
    return upload.photoPath;
  };

  const done = () => {
    void client.invalidateQueries({ queryKey: getGetYarnToolsQueryKey() });
    void client.invalidateQueries({ queryKey: getGetMyCraftsQueryKey() });
    if (tool) void client.invalidateQueries({ queryKey: getGetYarnToolQueryKey(tool.id) });
    router.back();
  };

  const save = async () => {
    setMessage('');
    const quantityForSave = quantityForApi(quantity);
    if (isNotion && !notionType) return setMessage('Choose what kind of notion this is.');
    if (!isNotion && !size) return setMessage('Choose a size.');
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
    const isNeedle = section === 'needles';
    const data = {
      section,
      size: isNotion ? null : size,
      needleType: isNeedle ? needleType : null,
      cableLength: isNeedle && needleHasCable(needleType) ? cableLength : null,
      material: isNotion ? null : material,
      notionType: isNotion ? notionType : null,
      name: name.trim() || null, quantity: quantityForSave, brand: brand.trim() || null, notes: notes.trim() || null,
      ...(photoPath !== undefined ? { photoPath } : {}),
    };
    const options = {
      onSuccess: done,
      onError: (error: unknown) => setMessage((error as { data?: { error?: string } })?.data?.error ?? 'We could not save this tool just now. Please try again.'),
      onSettled: () => setSaving(false),
    };
    if (tool) update.mutate({ yarnToolId: tool.id, data }, options);
    else create.mutate({ data }, options);
  };

  const deleteTool = () => tool && remove.mutate({ yarnToolId: tool.id }, {
    onSuccess: done,
    onError: () => setMessage('We could not remove this tool. Please try again.'),
  });

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.nav, { paddingTop: insets.top + 9, borderBottomColor: colors.border }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={styles.navButton}><Feather name="arrow-left" size={19} color={colors.primaryText} /></Pressable>
        <LoomText numberOfLines={1} style={[styles.navTitle, { color: colors.foreground }]}>{tool ? yarnToolTitle(tool) : 'Add a tool'}</LoomText>
        {tool ? <Pressable accessibilityRole="button" accessibilityLabel="Delete tool" onPress={() => setConfirmDelete(true)} style={styles.navButton} testID="button-delete-yarn-tool"><Feather name="trash-2" size={18} color={colors.destructive} /></Pressable> : <View style={styles.navButton} />}
      </View>
      <KeyboardAwareScrollViewCompat contentContainerStyle={styles.form} bottomOffset={80} keyboardShouldPersistTaps="handled">
        {confirmDelete ? (
          <View style={[styles.confirm, { backgroundColor: colors.card, borderColor: colors.destructive }]}>
            <LoomText style={{ color: colors.foreground, fontFamily: fonts.semibold, fontSize: 15 }}>Remove this tool?</LoomText>
            <LoomText style={{ color: colors.mutedForeground, fontSize: 14, marginTop: 4 }}>Its photo will be deleted too.</LoomText>
            <View style={styles.confirmActions}>
              <LoomButton title="Cancel" variant="quiet" onPress={() => setConfirmDelete(false)} />
              <LoomButton title="Remove tool" variant="danger" onPress={deleteTool} busy={remove.isPending} testID="button-confirm-delete-yarn-tool" />
            </View>
          </View>
        ) : null}
        <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <FormFieldLabel>Section</FormFieldLabel>
          <Choices options={yarnToolSections} value={section} onChange={chooseSection} testID="button-yarn-tool-section" />
          {isNotion ? (
            <>
              <FormFieldLabel>Type *</FormFieldLabel>
              <OptionPicker label="Type" placeholder="Choose a type" options={notionTypes.map((item) => item.value)} optionLabel={(value) => notionFor(value)!.label} value={notionType} onChange={setNotionType} testID="select-yarn-notion-type" />
            </>
          ) : (
            <>
              <FormFieldLabel>Size *</FormFieldLabel>
              <OptionPicker key={section} label="Size" placeholder="Choose a size" options={section === 'hooks' ? hookSizes : needleSizes} value={size} onChange={setSize} testID="select-yarn-tool-size" />
            </>
          )}
          {section === 'needles' ? (
            <>
              <FormFieldLabel>Needle type</FormFieldLabel>
              <OptionPicker label="Needle type" placeholder="Choose a type" options={needleTypes.map((item) => item.value)} optionLabel={(value) => labelOf(needleTypes, value)!} value={needleType} onChange={setNeedleType} testID="select-yarn-tool-needle-type" />
              {needleHasCable(needleType) ? (
                <>
                  <FormFieldLabel>Cable length</FormFieldLabel>
                  <OptionPicker label="Cable length" placeholder="Choose a length" options={cableLengths} value={cableLength} onChange={setCableLength} testID="select-yarn-tool-cable" />
                </>
              ) : null}
            </>
          ) : null}
          {!isNotion ? (
            <>
              <FormFieldLabel>Material</FormFieldLabel>
              <OptionPicker label="Material" placeholder="Choose a material" options={materials.map((item) => item.value)} optionLabel={(value) => labelOf(materials, value)!} value={material} onChange={setMaterial} testID="select-yarn-tool-material" />
            </>
          ) : null}
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <FormFieldLabel>How many</FormFieldLabel>
              <TextInput {...inputProps} value={quantity} onChangeText={setQuantity} keyboardType="number-pad" placeholder="Optional" style={inputStyle} testID="input-yarn-tool-quantity" />
            </View>
            <View style={{ flex: 1 }}>
              <FormFieldLabel>Brand</FormFieldLabel>
              <TextInput {...inputProps} value={brand} onChangeText={setBrand} maxLength={80} placeholder="Optional" style={inputStyle} testID="input-yarn-tool-brand" />
            </View>
          </View>
          <FormFieldLabel>Name</FormFieldLabel>
          <TextInput {...inputProps} value={name} onChangeText={setName} maxLength={80} placeholder={`e.g. ${example}`} style={inputStyle} testID="input-yarn-tool-name" />
          <FormFieldLabel>Notes</FormFieldLabel>
          <TextInput {...inputProps} value={notes} onChangeText={setNotes} maxLength={1000} multiline placeholder="Optional" style={[inputStyle, styles.notes]} testID="input-yarn-tool-notes" />
          <FormFieldLabel>Photo</FormFieldLabel>
          <View style={styles.photoRow}>
            <Pressable accessibilityRole="button" accessibilityLabel={photo ? 'Change the photo' : 'Add a photo'} onPress={() => { void pickPhoto(); }} style={[styles.photo, { borderColor: colors.input, backgroundColor: colors.selectedWash }]} testID="button-yarn-tool-photo">
              {photo?.kind === 'new' ? <Image source={{ uri: photo.asset.uri }} style={styles.photoImage} contentFit="cover" accessibilityLabel="Chosen tool photo" />
                : photo?.kind === 'kept' && tool ? <YarnToolThumb tool={tool} size={112} />
                : <View style={styles.photoEmpty}><Feather name="camera" size={20} color={colors.primaryText} /><LoomText style={{ color: colors.primaryText, fontFamily: fonts.semibold, fontSize: 13 }}>Add a photo</LoomText></View>}
            </Pressable>
            {photo ? <LoomButton title="Remove photo" variant="quiet" onPress={() => setPhoto(null)} testID="button-remove-yarn-tool-photo" /> : null}
          </View>
          {message ? <LoomText accessibilityRole="alert" style={[styles.error, { color: colors.destructive }]}>{message}</LoomText> : null}
          <LoomButton title={tool ? 'Save changes' : 'Add tool'} icon="arrow-right" onPress={() => { void save(); }} busy={saving} testID="button-save-yarn-tool" />
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

import { useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { File } from 'expo-file-system';
import { fetch as expoFetch } from 'expo/fetch';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Alert, Linking, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getGetMyCraftsQueryKey, getGetStashFabricQueryKey, getGetStashFabricsQueryKey,
  requestFabricPhotoUpload, useCreateStashFabric, useDeleteStashFabric, useUpdateStashFabric,
} from '@workspace/api-client-react';
import type { FabricConstruction, FabricPrint, FabricType, FabricUnit, GeneralColor, StashFabric } from '@workspace/api-client-react';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { FormFieldLabel, LoomButton, LoomText, fonts } from '@/components/loom';
import { GeneralColorPicker } from '@/components/YarnFields';
import { ITEM_HEIGHT, Wheel } from '@/components/ProjectDateField';
import {
  FabricPhoto, fabricConstructions, fabricName, fabricPrints, fabricTypes, fabricUnits, labelFor, maxFabricPhotos, sizeForApi,
} from '@/components/FabricFields';
import { useSewingColors } from '@/hooks/useColors';

// A photo already saved on the fabric, by its place in the list, or a new
// photo from the library waiting to upload.
type PhotoSlot = { kind: 'kept'; index: number } | { kind: 'new'; asset: ImagePicker.ImagePickerAsset };

function Choices<T extends string>({ options, value, onChange, testID }: { options: Array<{ value: T; label: string }>; value: T | null | ''; onChange: (value: T) => void; testID: string }) {
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

// Print picker as a scroll wheel like the date picker.
function PrintWheelField({ value, onChange }: { value: FabricPrint | null; onChange: (value: FabricPrint | null) => void }) {
  const colors = useSewingColors();
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState(0);
  const label = labelFor(fabricPrints, value);
  const openPicker = () => {
    setDraft(Math.max(0, fabricPrints.findIndex((item) => item.value === value)));
    setIsOpen(true);
  };
  return (
    <View style={styles.wheelField}>
      <FormFieldLabel>Print</FormFieldLabel>
      <Pressable accessibilityRole="button" accessibilityLabel={`Print: ${label || 'Choose a print'}`} onPress={openPicker} style={[styles.trigger, { backgroundColor: colors.card, borderColor: colors.input }]} testID="button-fabric-print">
        <Feather name="star" size={16} color={colors.primary} />
        <LoomText style={{ flex: 1, color: label ? colors.foreground : colors.mutedForeground, fontSize: 16 }}>{label || 'Choose a print'}</LoomText>
        <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
      </Pressable>
      <Modal visible={isOpen} transparent animationType="slide" onRequestClose={() => setIsOpen(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable accessibilityLabel="Close print picker" onPress={() => setIsOpen(false)} style={StyleSheet.absoluteFill} />
          <View style={[styles.sheet, { backgroundColor: colors.card }]}>
            <View style={styles.sheetHeading}>
              <Pressable accessibilityRole="button" onPress={() => setIsOpen(false)} style={styles.headingButton}>
                <LoomText style={{ color: colors.mutedForeground, fontSize: 16 }}>Cancel</LoomText>
              </Pressable>
              <LoomText serif style={{ color: colors.foreground, fontSize: 20 }}>Print</LoomText>
              <Pressable accessibilityRole="button" onPress={() => { onChange(fabricPrints[draft]!.value); setIsOpen(false); }} style={styles.headingButton} testID="button-fabric-print-done">
                <LoomText style={{ color: colors.primary, fontFamily: fonts.semibold, fontSize: 16, textAlign: 'right' }}>Done</LoomText>
              </Pressable>
            </View>
            <View style={[styles.wheels, { backgroundColor: colors.selectedWash }]}>
              <View pointerEvents="none" style={[styles.wheelBand, { borderColor: colors.accent }]} />
              <Wheel label="Print" items={fabricPrints.map((item) => item.label)} index={draft} onChange={setDraft} flex={1} testID="wheel-fabric-print" />
            </View>
            {value ? (
              <Pressable accessibilityRole="button" onPress={() => { onChange(null); setIsOpen(false); }} style={styles.clearButton}>
                <LoomText style={{ color: colors.destructive, fontFamily: fonts.semibold, fontSize: 15 }}>Clear print</LoomText>
              </Pressable>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

export function FabricForm({ fabric }: { fabric?: StashFabric }) {
  const colors = useSewingColors();
  const insets = useSafeAreaInsets();
  const client = useQueryClient();
  const create = useCreateStashFabric();
  const update = useUpdateStashFabric();
  const remove = useDeleteStashFabric();
  const [fabricType, setFabricType] = useState<FabricType | ''>(fabric?.fabricType ?? '');
  const [construction, setConstruction] = useState<FabricConstruction | null>(fabric?.construction ?? null);
  const [print, setPrint] = useState<FabricPrint | null>(fabric?.print ?? null);
  const [generalColor, setGeneralColor] = useState<GeneralColor | null>(fabric?.generalColor ?? null);
  const [unit, setUnit] = useState<FabricUnit>(fabric?.unit ?? 'meters');
  const [amount, setAmount] = useState(fabric?.amount === null || !fabric ? '' : String(fabric.amount));
  const [width, setWidth] = useState(fabric?.width === null || !fabric ? '' : String(fabric.width));
  const [brand, setBrand] = useState(fabric?.brand ?? '');
  const [notes, setNotes] = useState(fabric?.notes ?? '');
  const [photos, setPhotos] = useState<PhotoSlot[]>(() => Array.from({ length: fabric?.photoCount ?? 0 }, (_, index) => ({ kind: 'kept', index })));
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const unitLabels = fabricUnits.find((item) => item.value === unit) ?? fabricUnits[0];
  const inputStyle = [styles.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.input }];
  const inputProps = { placeholderTextColor: colors.mutedForeground };

  const pickPhotos = async (replaceMain: boolean) => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Photo library access', 'Allow access to choose fabric photos in Settings.', [
          { text: 'Not now', style: 'cancel' },
          { text: 'Open Settings', onPress: () => { void Linking.openSettings(); } },
        ]);
        return;
      }
      const room = maxFabricPhotos - photos.length;
      const result = await ImagePicker.launchImageLibraryAsync(replaceMain
        ? { mediaTypes: ['images'], quality: 0.85, allowsEditing: true, aspect: [1, 1] }
        : { mediaTypes: ['images'], quality: 0.85, allowsMultipleSelection: true, selectionLimit: room });
      if (result.canceled) return;
      const slots = result.assets.map((asset): PhotoSlot => ({ kind: 'new', asset }));
      setPhotos((current) => replaceMain
        ? [slots[0]!, ...current.slice(1)]
        : [...current, ...slots].slice(0, maxFabricPhotos));
    } catch {
      setMessage('We could not open your photo library. Please try again.');
    }
  };

  const done = () => {
    void client.invalidateQueries({ queryKey: getGetStashFabricsQueryKey() });
    void client.invalidateQueries({ queryKey: getGetMyCraftsQueryKey() });
    if (fabric) void client.invalidateQueries({ queryKey: getGetStashFabricQueryKey(fabric.id) });
    router.back();
  };

  const uploadPhoto = async (asset: ImagePicker.ImagePickerAsset) => {
    const file = new File(asset.uri);
    const contentType = asset.mimeType || 'image/jpeg';
    const size = asset.fileSize ?? file.size;
    if (size > 10 * 1024 * 1024) throw new Error('Choose photos smaller than 10 MB.');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(contentType)) throw new Error('Choose JPEG, PNG, or WebP photos.');
    const upload = await requestFabricPhotoUpload({ name: asset.fileName || 'fabric-photo', size: Math.max(1, size), contentType: contentType as 'image/jpeg' | 'image/png' | 'image/webp' });
    const response = await expoFetch(upload.uploadURL, { method: 'PUT', headers: { 'Content-Type': contentType }, body: file });
    if (!response.ok) throw new Error('Photo upload failed.');
    return upload.photoPath;
  };

  const save = async () => {
    setMessage('');
    const amountForSave = sizeForApi(amount);
    const widthForSave = sizeForApi(width);
    if (!photos.length) return setMessage('Add a photo of the print.');
    if (!fabricType) return setMessage('Choose the fabric type.');
    if (amountForSave === 'invalid' || widthForSave === 'invalid') return setMessage('Enter amounts between 0 and 999, like 2.5.');

    setSaving(true);
    let photoPaths: string[];
    try {
      photoPaths = await Promise.all(photos.map((slot) => slot.kind === 'kept' ? `keep:${slot.index}` : uploadPhoto(slot.asset)));
    } catch (error) {
      setMessage(error instanceof Error && error.message.startsWith('Choose') ? error.message : 'We could not upload these photos. Please try again.');
      setSaving(false);
      return;
    }
    const data = {
      fabricType, construction, print, generalColor, unit, amount: amountForSave, width: widthForSave,
      brand: brand.trim() || null, notes: notes.trim() || null, photoPaths,
    };
    const options = {
      onSuccess: done,
      onError: (error: unknown) => setMessage((error as { data?: { error?: string } })?.data?.error ?? 'We could not save this fabric just now. Please try again.'),
      onSettled: () => setSaving(false),
    };
    if (fabric) update.mutate({ fabricId: fabric.id, data }, options);
    else create.mutate({ data }, options);
  };

  const deleteFabric = () => fabric && remove.mutate({ fabricId: fabric.id }, {
    onSuccess: done,
    onError: () => setMessage('We could not remove this fabric. Please try again.'),
  });

  const photoView = (slot: PhotoSlot, style: object) => slot.kind === 'new'
    ? <Image source={{ uri: slot.asset.uri }} style={style} contentFit="cover" accessibilityLabel="Chosen fabric photo" />
    : fabric ? <FabricPhoto fabric={fabric} index={slot.index} style={style} /> : null;
  const [main, ...extras] = photos;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.nav, { paddingTop: insets.top + 9, borderBottomColor: colors.border }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={styles.navButton}><Feather name="arrow-left" size={19} color={colors.primary} /></Pressable>
        <LoomText numberOfLines={1} style={[styles.navTitle, { color: colors.foreground }]}>{fabric ? fabricName(fabric) : 'Add fabric'}</LoomText>
        {fabric ? <Pressable accessibilityRole="button" accessibilityLabel="Delete fabric" onPress={() => setConfirmDelete(true)} style={styles.navButton} testID="button-delete-fabric"><Feather name="trash-2" size={18} color={colors.destructive} /></Pressable> : <View style={styles.navButton} />}
      </View>
      <KeyboardAwareScrollViewCompat contentContainerStyle={styles.form} bottomOffset={80} keyboardShouldPersistTaps="handled">
        {confirmDelete ? (
          <View style={[styles.confirm, { backgroundColor: colors.card, borderColor: colors.destructive }]}>
            <LoomText style={{ color: colors.foreground, fontFamily: fonts.semibold, fontSize: 15 }}>Remove this fabric from your stash?</LoomText>
            <LoomText style={{ color: colors.mutedForeground, fontSize: 14, marginTop: 4 }}>Its photos will be deleted too.</LoomText>
            <View style={styles.confirmActions}>
              <LoomButton title="Cancel" variant="quiet" onPress={() => setConfirmDelete(false)} />
              <LoomButton title="Remove fabric" variant="danger" onPress={deleteFabric} busy={remove.isPending} testID="button-confirm-delete-fabric" />
            </View>
          </View>
        ) : null}
        <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <FormFieldLabel>Print close-up *</FormFieldLabel>
          <Pressable accessibilityRole="button" accessibilityLabel={main ? 'Change the print close-up' : 'Add a close-up of the print'} onPress={() => { void pickPhotos(Boolean(main)); }} style={[styles.mainPhoto, { borderColor: colors.input, backgroundColor: colors.selectedWash }]} testID="button-fabric-photo-main">
            {main ? photoView(main, styles.photo) : <View style={styles.photoEmpty}><Feather name="camera" size={24} color={colors.primary} /><LoomText style={{ color: colors.primary, fontFamily: fonts.semibold, textAlign: 'center' }}>Add a close-up of the print</LoomText></View>}
          </Pressable>
          {main ? (
            <>
              <FormFieldLabel>More photos</FormFieldLabel>
              <View style={styles.extras}>
                {extras.map((slot, place) => (
                  <View key={place} style={[styles.extra, { borderColor: colors.border }]}>
                    {photoView(slot, styles.photo)}
                    <Pressable accessibilityRole="button" accessibilityLabel={`Remove photo ${place + 2}`} onPress={() => setPhotos((current) => current.filter((_, index) => index !== place + 1))} style={styles.removePhoto} testID={`button-remove-fabric-photo-${place + 2}`}><Feather name="x" size={13} color="#FFFFFF" /></Pressable>
                  </View>
                ))}
                {photos.length < maxFabricPhotos ? (
                  <Pressable accessibilityRole="button" accessibilityLabel="Add more photos" onPress={() => { void pickPhotos(false); }} style={[styles.extra, styles.addExtra, { borderColor: colors.input, backgroundColor: colors.selectedWash }]} testID="button-fabric-photo-more">
                    <Feather name="plus" size={18} color={colors.primary} />
                    <LoomText style={{ color: colors.primary, fontFamily: fonts.semibold, fontSize: 13 }}>Add</LoomText>
                  </Pressable>
                ) : null}
              </View>
              <LoomText style={[styles.hint, { color: colors.mutedForeground }]}>Up to three more, like the full piece or the drape.</LoomText>
            </>
          ) : null}

          <FormFieldLabel>Fabric type *</FormFieldLabel>
          <Choices options={fabricTypes} value={fabricType} onChange={setFabricType} testID="button-fabric-type" />
          <FormFieldLabel>Woven or knit</FormFieldLabel>
          <Choices options={fabricConstructions} value={construction} onChange={(next) => setConstruction(construction === next ? null : next)} testID="button-construction" />
          <PrintWheelField value={print} onChange={setPrint} />
          <GeneralColorPicker value={generalColor} onChange={setGeneralColor} />
          <FormFieldLabel>Measured in</FormFieldLabel>
          <Choices options={fabricUnits} value={unit} onChange={setUnit} testID="button-unit" />
          <View style={styles.sizeRow}>
            <View style={{ flex: 1 }}>
              <FormFieldLabel>Amount ({unitLabels.amount})</FormFieldLabel>
              <TextInput {...inputProps} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="e.g. 2.5" style={inputStyle} testID="input-fabric-amount" />
            </View>
            <View style={{ flex: 1 }}>
              <FormFieldLabel>Width ({unitLabels.width})</FormFieldLabel>
              <TextInput {...inputProps} value={width} onChangeText={setWidth} keyboardType="decimal-pad" placeholder={unit === 'meters' ? 'e.g. 145' : 'e.g. 58'} style={inputStyle} testID="input-fabric-width" />
            </View>
          </View>
          <FormFieldLabel>Brand</FormFieldLabel>
          <TextInput {...inputProps} value={brand} onChangeText={setBrand} maxLength={80} placeholder="Optional" style={inputStyle} testID="input-fabric-brand" />
          <FormFieldLabel>Notes</FormFieldLabel>
          <TextInput {...inputProps} value={notes} onChangeText={setNotes} maxLength={1000} multiline placeholder="Where it's from, what it's for…" style={[inputStyle, styles.notes]} testID="input-fabric-notes" />
          {message ? <LoomText accessibilityRole="alert" style={[styles.error, { color: colors.destructive }]}>{message}</LoomText> : null}
          <LoomButton title={fabric ? 'Save changes' : 'Add to stash'} icon="arrow-right" onPress={() => { void save(); }} busy={saving} testID="button-save-fabric" />
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
  notes: { minHeight: 90, textAlignVertical: 'top' },
  mainPhoto: { width: '100%', aspectRatio: 1, maxWidth: 320, borderRadius: 14, borderWidth: 1, overflow: 'hidden', marginBottom: 14 },
  photo: { width: '100%', height: '100%' },
  photoEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 20 },
  extras: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  extra: { width: 84, height: 84, borderRadius: 10, borderWidth: 1, overflow: 'hidden' },
  addExtra: { alignItems: 'center', justifyContent: 'center', gap: 2, borderStyle: 'dashed' },
  removePhoto: { position: 'absolute', top: 5, right: 5, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(31,47,22,0.7)', alignItems: 'center', justifyContent: 'center' },
  hint: { fontSize: 13, marginTop: 6, marginBottom: 14 },
  choices: { gap: 7, paddingBottom: 14 },
  choice: { borderWidth: 1, borderRadius: 99, paddingHorizontal: 14, minHeight: 36, justifyContent: 'center' },
  sizeRow: { flexDirection: 'row', gap: 10 },
  wheelField: { marginBottom: 14 },
  trigger: { minHeight: 46, borderRadius: 9, borderWidth: 1, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(31, 47, 22, 0.42)' },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 34 },
  sheetHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 10 },
  headingButton: { minWidth: 64, paddingVertical: 10 },
  wheels: { flexDirection: 'row', borderRadius: 12, overflow: 'hidden', paddingHorizontal: 6 },
  wheelBand: { position: 'absolute', left: 8, right: 8, top: ITEM_HEIGHT * 2, height: ITEM_HEIGHT, borderTopWidth: 1.5, borderBottomWidth: 1.5 },
  clearButton: { alignSelf: 'center', paddingVertical: 12, marginTop: 6 },
  error: { fontSize: 15, lineHeight: 22, marginBottom: 12 },
  confirm: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 14 },
  confirmActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 10 },
});

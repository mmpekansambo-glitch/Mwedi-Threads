import { useEffect, useState } from 'react';
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
  requestStashPhotoUpload, useCreateStashYarn, useDeleteStashYarn, useGetStashYarnReviews, useGetYarnCatalog, useUpdateStashYarn,
  getGetStashYarnQueryKey, getGetStashYarnReviewsQueryKey, getGetStashYarnsQueryKey, getGetYarnCatalogQueryKey,
  acceptRenameOffer, findRenameOffer, getStashYarns, refreshPaths, renameOfferText, showRemoved, showSaved, skeinsLeftAfter,
} from '@workspace/api-client-react';
import type { RenameOffer } from '@workspace/api-client-react';
import type { CatalogField, GeneralColor, StashYarn, YarnWeight } from '@workspace/api-client-react';
import { NameReviewForm, NameReviewList, ReviewableLabel } from '@/components/NameReview';
import { ArchiveNudge, usedUp, useYarnArchive } from '@/components/ArchiveNudge';
import { showSignpost } from '@/components/Signpost';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { FormFieldLabel, LoomButton, LoomText, fonts } from '@/components/loom';
import {
  BlendFields, CatalogChoices, ColorDot, GeneralColorPicker, StashPhoto, WeightWheelField, blendForApi, type BlendDraft,
} from '@/components/YarnFields';
import { useColors } from '@/hooks/useColors';

function useSettledValue(value: string, delay = 300): string {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return settled;
}

function skeinsForApi(value: string): number | null | 'invalid' {
  if (!value.trim()) return null;
  const number = Number(value.replace(',', '.'));
  return Number.isFinite(number) && number >= 0 && number <= 999 && Number.isInteger(number * 2) ? number : 'invalid';
}

function isWebLink(value: string): boolean {
  return /^https?:\/\/[^\s/]+\.[^\s]+$/i.test(value);
}

export function StashYarnForm({ yarn }: { yarn?: StashYarn }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const client = useQueryClient();
  const create = useCreateStashYarn();
  const update = useUpdateStashYarn();
  const remove = useDeleteStashYarn();
  const [brand, setBrand] = useState(yarn?.brand ?? '');
  const [subBrand, setSubBrand] = useState(yarn?.subBrand ?? '');
  const [color, setColor] = useState(yarn?.color ?? '');
  const [generalColor, setGeneralColor] = useState<GeneralColor | null>(yarn?.generalColor ?? null);
  const [weight, setWeight] = useState<YarnWeight | null>(yarn?.weight ?? null);
  const [blend, setBlend] = useState<BlendDraft>(() => yarn?.blend.map((part) => ({ fiber: part.fiber, percent: String(part.percent) })) ?? []);
  const [brandLink, setBrandLink] = useState(yarn?.brandLink ?? '');
  const [skeinsPurchased, setSkeinsPurchased] = useState(yarn?.skeinsPurchased === null || !yarn ? '' : String(yarn.skeinsPurchased));
  const [skeinsLeft, setSkeinsLeft] = useState(yarn?.skeinsLeft === null || !yarn ? '' : String(yarn.skeinsLeft));
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [reviewing, setReviewing] = useState<CatalogField | null>(null);
  const toggleReview = (field: CatalogField) => setReviewing((current) => current === field ? null : field);
  const reviews = useGetStashYarnReviews(yarn?.id ?? '', { query: { enabled: Boolean(yarn), queryKey: getGetStashYarnReviewsQueryKey(yarn?.id ?? '') } });
  const [message, setMessage] = useState('');
  const [blendError, setBlendError] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [focused, setFocused] = useState<'brand' | 'subBrand' | 'color' | null>(null);

  const catalogParams = { brand: useSettledValue(brand.trim()), subBrand: useSettledValue(subBrand.trim()), color: useSettledValue(color.trim()) };
  const catalog = useGetYarnCatalog(catalogParams, { query: { queryKey: getGetYarnCatalogQueryKey(catalogParams), placeholderData: (previous) => previous } }).data;

  // Picking a sub brand or color the catalog already knows fills in what the
  // first maker saved, without overwriting anything typed here.
  useEffect(() => {
    const line = catalog?.subBrands.find((item) => item.name === subBrand);
    if (!line) return;
    setBlend((current) => current.length ? current : line.blend.map((part) => ({ fiber: part.fiber, percent: String(part.percent) })));
    setBrandLink((current) => current || line.link || '');
  }, [catalog?.subBrands, subBrand]);
  useEffect(() => {
    const match = catalog?.colors.find((item) => item.name === color);
    if (match?.generalColor) setGeneralColor((current) => current ?? match.generalColor);
  }, [catalog?.colors, color]);

  const inputStyle = [styles.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.input }];
  const inputProps = { placeholderTextColor: colors.mutedForeground };

  const pickPhoto = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Photo library access', 'Allow access to choose a yarn photo in Settings.', [
          { text: 'Not now', style: 'cancel' },
          { text: 'Open Settings', onPress: () => { void Linking.openSettings(); } },
        ]);
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85, allowsEditing: true, aspect: [1, 1] });
      if (!result.canceled && result.assets[0]) setPhoto(result.assets[0]);
    } catch {
      setMessage('We could not open your photo library. Please try again.');
    }
  };

  const [offer, setOffer] = useState<RenameOffer | null>(null);
  const [renaming, setRenaming] = useState(false);
  // A changed yarn name shows on its projects and the Overview too.
  const refreshLinked = () => refreshPaths(client, '/api/projects', '/api/dashboard', '/api/yarn-catalog');
  const done = async (saved?: StashYarn) => {
    // Archived yarn isn't added to the stash list, only updated where it's shown.
    if (saved) showSaved(client, { list: getGetStashYarnsQueryKey(), item: getGetStashYarnQueryKey(saved.id) }, saved, { insert: !saved.archivedAt });
    else if (yarn) showRemoved(client, getGetStashYarnsQueryKey(), yarn.id);
    if (saved?.restored) showSignpost(`Welcome back: ${[saved.brand, saved.subBrand, saved.color].filter(Boolean).join(' ')} was in your Archive, so it’s back in your stash with your new details.`);
    refreshLinked();
    const rename = yarn && saved && (yarn.brand !== saved.brand || yarn.subBrand !== saved.subBrand)
      ? await getStashYarns().then((stash) => findRenameOffer(yarn, saved, stash)).catch(() => null)
      : null;
    // Offer the Archive when this edit used the last of the yarn.
    const finished = yarn && saved && !saved.archivedAt && usedUp(saved) && !usedUp(yarn) ? saved : null;
    if (rename || finished) { setOffer(rename); setArchiveOffer(finished); return; }
    router.back();
  };
  const [archiveOffer, setArchiveOffer] = useState<StashYarn | null>(null);
  const answerArchive = () => {
    setArchiveOffer(null);
    if (!offer) router.back();
  };
  const { restore } = useYarnArchive();
  const [restoring, setRestoring] = useState(false);
  // Skeins left follows a change to skeins purchased until the maker types
  // their own number, with a gentle note saying what changed.
  const [leftTouched, setLeftTouched] = useState(false);
  const [leftNudge, setLeftNudge] = useState<{ from: number; to: number } | null>(null);
  const changePurchased = (value: string) => {
    setSkeinsPurchased(value);
    if (!yarn || leftTouched) return;
    const purchased = skeinsForApi(value);
    const after = typeof purchased === 'number' ? skeinsLeftAfter(yarn.skeinsPurchased, yarn.skeinsLeft, purchased) : null;
    setSkeinsLeft(after === null ? (yarn.skeinsLeft === null ? '' : String(yarn.skeinsLeft)) : String(after));
    setLeftNudge(after === null || yarn.skeinsLeft === null ? null : { from: yarn.skeinsLeft, to: after });
  };
  const answerOffer = async (rename: boolean) => {
    if (rename && offer) {
      setRenaming(true);
      try { await acceptRenameOffer(offer); } catch { setRenaming(false); setMessage('We could not rename the other yarns just now. Please try again.'); return; }
      void client.invalidateQueries({ queryKey: getGetStashYarnsQueryKey() });
      refreshPaths(client, '/api/yarn-stash/');
      refreshLinked();
    }
    setOffer(null);
    if (!archiveOffer) router.back();
  };

  const save = async () => {
    setMessage('');
    const blendForSave = blendForApi(blend);
    setBlendError(typeof blendForSave === 'string' ? blendForSave : '');
    const purchased = skeinsForApi(skeinsPurchased);
    const left = skeinsForApi(skeinsLeft);
    const link = brandLink.trim();
    if (!brand.trim()) return setMessage('Enter the yarn’s brand.');
    if (!photo && !yarn?.photoPath) return setMessage('Add a photo of this yarn.');
    if (typeof blendForSave === 'string') return;
    if (link && !isWebLink(link)) return setMessage('Enter a brand page link starting with http:// or https://.');
    if (purchased === 'invalid' || left === 'invalid') return setMessage('Enter skeins in whole or half skeins, like 3 or 2.5.');
    if (left !== null && purchased !== null && left > purchased) return setMessage('Skeins left can’t be more than skeins purchased.');

    setSaving(true);
    let photoPath = yarn?.photoPath;
    if (photo) {
      try {
        const file = new File(photo.uri);
        const contentType = photo.mimeType || 'image/jpeg';
        const size = photo.fileSize ?? file.size;
        if (size > 10 * 1024 * 1024) throw new Error('Choose a photo smaller than 10 MB.');
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(contentType)) throw new Error('Choose a JPEG, PNG, or WebP photo.');
        const upload = await requestStashPhotoUpload({ name: photo.fileName || 'yarn-photo', size: Math.max(1, size), contentType: contentType as 'image/jpeg' | 'image/png' | 'image/webp' });
        const response = await expoFetch(upload.uploadURL, { method: 'PUT', headers: { 'Content-Type': contentType }, body: file });
        if (!response.ok) throw new Error('Photo upload failed.');
        photoPath = upload.photoPath;
      } catch (error) {
        const text = error instanceof Error && error.message.startsWith('Choose') ? error.message : 'We could not upload this photo. Please try again.';
        setMessage(text);
        setSaving(false);
        return;
      }
    }
    const data = {
      brand: brand.trim(), subBrand: subBrand.trim() || null, color: color.trim() || null, generalColor, weight,
      blend: blendForSave, brandLink: link || null, photoPath: photoPath!, skeinsPurchased: purchased, skeinsLeft: left,
    };
    const options = {
      onSuccess: (saved: StashYarn) => { void done(saved); },
      onError: (error: unknown) => setMessage((error as { data?: { error?: string } })?.data?.error ?? 'We could not save this yarn just now. Please try again.'),
      onSettled: () => setSaving(false),
    };
    if (yarn) update.mutate({ yarnId: yarn.id, data }, options);
    else create.mutate({ data }, options);
  };

  const deleteYarn = () => yarn && remove.mutate({ yarnId: yarn.id }, {
    onSuccess: () => { void done(); },
    onError: () => setMessage('We could not remove this yarn. Please try again.'),
  });

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.nav, { paddingTop: insets.top + 9, borderBottomColor: colors.border }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={styles.navButton}><Feather name="arrow-left" size={19} color={colors.primary} /></Pressable>
        <LoomText numberOfLines={1} style={[styles.navTitle, { color: colors.foreground }]}>{yarn ? [yarn.brand, yarn.subBrand].filter(Boolean).join(' ') : 'Add yarn'}</LoomText>
        {yarn ? <Pressable accessibilityRole="button" accessibilityLabel="Delete yarn" onPress={() => setConfirmDelete(true)} style={styles.navButton} testID="button-delete-yarn"><Feather name="trash-2" size={18} color={colors.destructive} /></Pressable> : <View style={styles.navButton} />}
      </View>
      <KeyboardAwareScrollViewCompat contentContainerStyle={styles.form} bottomOffset={80} keyboardShouldPersistTaps="handled">
        {confirmDelete ? (
          <View style={[styles.confirm, { backgroundColor: colors.card, borderColor: colors.destructive }]}>
            <LoomText style={{ color: colors.foreground, fontFamily: fonts.semibold, fontSize: 15 }}>Remove this yarn from your stash?</LoomText>
            <LoomText style={{ color: colors.mutedForeground, fontSize: 14, marginTop: 4 }}>Its photo will be deleted too.</LoomText>
            <View style={styles.confirmActions}>
              <LoomButton title="Cancel" variant="quiet" onPress={() => setConfirmDelete(false)} />
              <LoomButton title="Remove yarn" variant="danger" onPress={deleteYarn} busy={remove.isPending} testID="button-confirm-delete-yarn" />
            </View>
          </View>
        ) : null}
        {offer ? (
          <View style={[styles.offer, { backgroundColor: colors.card, borderLeftColor: colors.primary, borderColor: colors.border }]} testID="rename-offer">
            <LoomText style={{ color: colors.foreground, fontSize: 15, lineHeight: 22 }}><LoomText style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.foreground }}>Saved. </LoomText>{renameOfferText(offer)}</LoomText>
            {message ? <LoomText accessibilityRole="alert" style={[styles.error, { color: colors.destructive, marginTop: 8 }]}>{message}</LoomText> : null}
            <View style={styles.confirmActions}>
              <LoomButton title="Keep as they are" variant="quiet" onPress={() => { void answerOffer(false); }} disabled={renaming} testID="button-keep-other-names" />
              <LoomButton title="Rename them too" onPress={() => { void answerOffer(true); }} busy={renaming} testID="button-rename-others" />
            </View>
          </View>
        ) : null}
        {archiveOffer ? <ArchiveNudge yarn={archiveOffer} onDone={answerArchive} /> : null}
        {yarn?.archivedAt && !offer && !archiveOffer ? (
          <View style={[styles.offer, { backgroundColor: colors.card, borderLeftColor: colors.primary, borderColor: colors.border }]} testID="archived-note">
            <LoomText style={{ color: colors.foreground, fontSize: 15, lineHeight: 22 }}><LoomText style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.foreground }}>In your Archive. </LoomText>This yarn is all used up. Bring it back if you have more.</LoomText>
            <View style={styles.confirmActions}>
              <LoomButton title="Move back to stash" variant="quiet" busy={restoring} onPress={() => { setRestoring(true); void restore(yarn).then(() => router.back()).catch(() => setRestoring(false)); }} testID="button-unarchive" />
            </View>
          </View>
        ) : null}
        {offer || archiveOffer ? null : <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <FormFieldLabel>Photo *</FormFieldLabel>
          <Pressable accessibilityRole="button" accessibilityLabel={photo || yarn?.photoPath ? 'Change photo' : 'Add a photo'} onPress={pickPhoto} style={[styles.photoPicker, { borderColor: colors.input, backgroundColor: colors.selectedWash }]} testID="button-stash-photo">
            {photo ? <Image source={{ uri: photo.uri }} style={styles.photo} contentFit="cover" accessibilityLabel="Chosen yarn photo" />
              : yarn?.photoPath ? <StashPhoto yarn={yarn} style={styles.photo} />
              : <View style={styles.photoEmpty}><Feather name="camera" size={22} color={colors.primary} /><LoomText style={{ color: colors.primary, fontFamily: fonts.semibold }}>Add a photo</LoomText></View>}
            <ColorDot color={generalColor} size={24} style={styles.photoDot} />
          </Pressable>
          {photo || yarn?.photoPath ? <LoomText style={[styles.changePhoto, { color: colors.primary }]} onPress={pickPhoto}>Change photo</LoomText> : null}

          <ReviewableLabel field="brand" canReview={Boolean(yarn)} open={reviewing === 'brand'} onToggle={() => toggleReview('brand')}>Brand *</ReviewableLabel>
          {yarn && reviewing === 'brand' ? <NameReviewForm yarnId={yarn.id} field="brand" currentName={yarn.brand} onDone={() => setReviewing(null)} /> : null}
          <TextInput {...inputProps} value={brand} onChangeText={setBrand} onFocus={() => setFocused('brand')} maxLength={80} placeholder="e.g. Lion Brand" style={inputStyle} autoCorrect={false} testID="input-stash-brand" />
          <CatalogChoices options={focused === 'brand' ? catalog?.brands ?? [] : []} typed={brand} suggestion={catalog?.suggestions.brand} renamingFrom={yarn?.brand} onPick={setBrand} testID="stash-brand" />
          <ReviewableLabel field="sub_brand" canReview={Boolean(yarn?.subBrand)} open={reviewing === 'sub_brand'} onToggle={() => toggleReview('sub_brand')}>Sub brand</ReviewableLabel>
          {yarn?.subBrand && reviewing === 'sub_brand' ? <NameReviewForm yarnId={yarn.id} field="sub_brand" currentName={yarn.subBrand} onDone={() => setReviewing(null)} /> : null}
          <TextInput {...inputProps} value={subBrand} onChangeText={setSubBrand} onFocus={() => setFocused('subBrand')} maxLength={80} placeholder="e.g. Wool-Ease" style={inputStyle} autoCorrect={false} testID="input-stash-sub-brand" />
          <CatalogChoices options={focused === 'subBrand' ? catalog?.subBrands.map((line) => line.name) ?? [] : []} typed={subBrand} suggestion={catalog?.suggestions.subBrand} renamingFrom={yarn?.subBrand} onPick={setSubBrand} testID="stash-sub-brand" />
          <ReviewableLabel field="color" canReview={Boolean(yarn?.color)} open={reviewing === 'color'} onToggle={() => toggleReview('color')}>Color</ReviewableLabel>
          {yarn?.color && reviewing === 'color' ? <NameReviewForm yarnId={yarn.id} field="color" currentName={yarn.color} onDone={() => setReviewing(null)} /> : null}
          <NameReviewList reviews={reviews.data ?? []} />
          <TextInput {...inputProps} value={color} onChangeText={setColor} onFocus={() => setFocused('color')} maxLength={80} placeholder="e.g. Fisherman" style={inputStyle} autoCorrect={false} testID="input-stash-color" />
          <CatalogChoices options={focused === 'color' ? catalog?.colors.map((item) => item.name) ?? [] : []} typed={color} suggestion={catalog?.suggestions.color} renamingFrom={yarn?.color} onPick={setColor} testID="stash-color" />

          <GeneralColorPicker value={generalColor} onChange={setGeneralColor} />
          <WeightWheelField value={weight} onChange={setWeight} />
          <BlendFields value={blend} onChange={(next) => { setBlend(next); setBlendError(''); }} fibers={catalog?.fibers ?? []} error={blendError} />
          <FormFieldLabel>Brand page link</FormFieldLabel>
          <TextInput {...inputProps} value={brandLink} onChangeText={setBrandLink} placeholder="https://" autoCapitalize="none" autoCorrect={false} keyboardType="url" style={inputStyle} testID="input-stash-link" />
          <View style={styles.skeinRow}>
            <View style={{ flex: 1 }}>
              <FormFieldLabel>Skeins purchased</FormFieldLabel>
              <TextInput {...inputProps} value={skeinsPurchased} onChangeText={changePurchased} keyboardType="decimal-pad" placeholder="e.g. 4" style={inputStyle} testID="input-skeins-purchased" />
            </View>
            <View style={{ flex: 1 }}>
              <FormFieldLabel>Skeins left</FormFieldLabel>
              <TextInput {...inputProps} value={skeinsLeft} onChangeText={(value) => { setLeftTouched(true); setLeftNudge(null); setSkeinsLeft(value); }} keyboardType="decimal-pad" placeholder={skeinsPurchased || 'Same'} style={inputStyle} testID="input-skeins-left" />
            </View>
          </View>
          {leftNudge ? (
            <View style={[styles.nudge, { backgroundColor: colors.selectedWash }]} testID="skeins-left-nudge">
              <LoomText style={{ color: colors.foreground, fontSize: 14, lineHeight: 20, flex: 1 }}>Skeins left is now {leftNudge.to} (was {leftNudge.from}). Look right?</LoomText>
              <LoomText accessibilityRole="button" onPress={() => setLeftNudge(null)} style={{ color: colors.primary, fontFamily: fonts.semibold, fontSize: 14 }} testID="button-skeins-left-ok">Looks right</LoomText>
            </View>
          ) : null}
          {message ? <LoomText accessibilityRole="alert" style={[styles.error, { color: colors.destructive }]}>{message}</LoomText> : null}
          <LoomButton title={yarn ? 'Save changes' : 'Add to stash'} icon="arrow-right" onPress={() => { void save(); }} busy={saving} testID="button-save-yarn" />
        </View>}
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
  photoPicker: { width: 160, height: 160, borderRadius: 14, borderWidth: 1, overflow: 'hidden', marginBottom: 6 },
  photo: { width: '100%', height: '100%' },
  photoEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  photoDot: { position: 'absolute', right: 9, bottom: 9, borderWidth: 2, borderColor: '#FFFFFF' },
  changePhoto: { fontFamily: fonts.semibold, fontSize: 14, marginBottom: 14 },
  skeinRow: { flexDirection: 'row', gap: 10 },
  error: { fontSize: 15, lineHeight: 22, marginBottom: 12 },
  confirm: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 14 },
  confirmActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 10 },
  offer: { borderWidth: 1, borderLeftWidth: 4, borderRadius: 14, padding: 14, marginBottom: 14 },
  nudge: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, marginTop: -4, marginBottom: 14 },
});

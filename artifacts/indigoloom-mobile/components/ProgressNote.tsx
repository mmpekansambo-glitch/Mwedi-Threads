import { useEffect, useState, type ReactNode } from 'react';
import { requestProgressPhotoUpload } from '@workspace/api-client-react';
import { useAuth } from '@clerk/expo';
import { Feather } from '@expo/vector-icons';
import { File } from 'expo-file-system';
import { fetch as expoFetch } from 'expo/fetch';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { Alert, Linking, Pressable, StyleSheet, View, type StyleProp, type ImageStyle } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { LoomText, fonts } from '@/components/loom';
import { useColors, useSewingColors } from '@/hooks/useColors';

const photoTypes = ['image/jpeg', 'image/png', 'image/webp'];

// Uploads a progress photo to private storage and returns the path to save on the note.
export async function uploadProgressPhoto(projectId: string, photo: ImagePicker.ImagePickerAsset): Promise<{ photoPath: string } | { error: string }> {
  const file = new File(photo.uri);
  const contentType = photo.mimeType || 'image/jpeg';
  const size = photo.fileSize ?? file.size;
  if (size > 10 * 1024 * 1024) return { error: 'Choose a photo smaller than 10 MB.' };
  if (!photoTypes.includes(contentType)) return { error: 'Choose a JPEG, PNG, or WebP photo.' };
  try {
    const upload = await requestProgressPhotoUpload(projectId, {
      name: photo.fileName || 'progress-photo',
      size: Math.max(1, size),
      contentType: contentType as 'image/jpeg' | 'image/png' | 'image/webp',
    });
    const response = await expoFetch(upload.uploadURL, { method: 'PUT', headers: { 'Content-Type': contentType }, body: file });
    if (!response.ok) throw new Error('Photo upload failed.');
    return { photoPath: upload.photoPath };
  } catch {
    return { error: 'We could not upload this photo. Please try again or remove it.' };
  }
}

// Opens the photo library. Returns null when the maker cancels or access is refused.
export async function pickProgressPhoto(): Promise<ImagePicker.ImagePickerAsset | null | { error: string }> {
  try {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photo library access', 'Allow access to choose a progress photo in Settings.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'Open Settings', onPress: () => { void Linking.openSettings(); } },
      ]);
      return null;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
    return result.canceled ? null : result.assets[0] ?? null;
  } catch {
    return { error: 'We could not open your photo library. Please try again.' };
  }
}

export function SavedProgressPhoto({ projectId, entryId, style }: { projectId: string; entryId: string; style?: StyleProp<ImageStyle> }) {
  const colors = useColors();
  const { getToken } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void getToken().then((value) => {
      if (active) setToken(value ?? null);
    });
    return () => { active = false; };
  }, [getToken]);
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (!domain || !token) return null;
  return (
    <Image
      source={{
        uri: `https://${domain}/api/projects/${projectId}/progress/${entryId}/photo`,
        headers: { Authorization: `Bearer ${token}` },
      }}
      style={[styles.savedPhoto, { backgroundColor: colors.muted }, style]}
      contentFit="cover"
      accessibilityLabel="Photo from this progress entry"
    />
  );
}

// Swipe left on a note to delete it and swipe right to edit it, as in Mail and Messages.
export function SwipeableNote({ onEdit, onDelete, testID, sewing = false, children }: {
  onEdit: () => void;
  onDelete: () => void;
  testID: string;
  sewing?: boolean;
  children: ReactNode;
}) {
  const yarnColors = useColors();
  const sewingColors = useSewingColors();
  const colors = sewing ? sewingColors : yarnColors;
  return (
    <ReanimatedSwipeable
      friction={2}
      leftThreshold={60}
      rightThreshold={60}
      overshootLeft={false}
      overshootRight={false}
      containerStyle={styles.swipeContainer}
      renderLeftActions={(_progress, _translation, methods) => (
        <Pressable accessibilityRole="button" accessibilityLabel="Edit note" onPress={() => { methods.close(); onEdit(); }} style={[styles.action, styles.leftAction, { backgroundColor: colors.primary }]} testID={`${testID}-edit`}>
          <Feather name="edit-2" size={18} color={colors.primaryForeground} />
          <LoomText style={[styles.actionText, { color: colors.primaryForeground }]}>Edit</LoomText>
        </Pressable>
      )}
      renderRightActions={(_progress, _translation, methods) => (
        <Pressable accessibilityRole="button" accessibilityLabel="Delete note" onPress={() => { methods.close(); onDelete(); }} style={[styles.action, styles.rightAction, { backgroundColor: colors.destructive }]} testID={`${testID}-delete`}>
          <Feather name="trash-2" size={18} color={colors.destructiveForeground} />
          <LoomText style={[styles.actionText, { color: colors.destructiveForeground }]}>Delete</LoomText>
        </Pressable>
      )}
    >
      <View accessibilityActions={[{ name: 'edit', label: 'Edit note' }, { name: 'delete', label: 'Delete note' }]} onAccessibilityAction={(event) => (event.nativeEvent.actionName === 'edit' ? onEdit() : onDelete())} testID={testID}>
        {children}
      </View>
    </ReanimatedSwipeable>
  );
}

// Asks before a note is deleted, with the native confirmation dialog.
export function confirmDeleteNote(onConfirm: () => void) {
  Alert.alert('Delete this note?', 'This can’t be undone.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: onConfirm },
  ]);
}

const styles = StyleSheet.create({
  savedPhoto: { width: '100%', height: 220, borderRadius: 12, marginTop: 10 },
  swipeContainer: { marginBottom: 8, borderRadius: 13 },
  action: { width: 88, alignItems: 'center', justifyContent: 'center', gap: 4 },
  leftAction: { borderTopLeftRadius: 13, borderBottomLeftRadius: 13, marginRight: -13, paddingRight: 13 },
  rightAction: { borderTopRightRadius: 13, borderBottomRightRadius: 13, marginLeft: -13, paddingLeft: 13 },
  actionText: { fontFamily: fonts.semibold, fontSize: 14 },
});

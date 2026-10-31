import { useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { File } from 'expo-file-system';
import { fetch as expoFetch } from 'expo/fetch';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useQueryClient } from '@tanstack/react-query';
import { Alert, Linking, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import {
  getGetSewingToolsQueryKey, getGetStashFabricsQueryKey, refreshPaths, requestFabricPhotoUpload,
  useCreateSewingTool, useCreateStashFabric, useGetSewingTools, useGetStashFabrics,
} from '@workspace/api-client-react';
import type { FabricType, FabricUnit, SewingTool, SewingToolCategory, SewingToolSection, StashFabric } from '@workspace/api-client-react';
import { FormFieldLabel, LoomButton, LoomText, fonts } from '@/components/loom';
import { FabricPhoto, fabricName, fabricSize, fabricTypes, fabricUnits, sizeForApi } from '@/components/FabricFields';
import { TapWheelRow } from '@/components/SewingFields';
import { Choices, ToolThumb, ToolTypeWheelField, categoryFor, toolDetails, toolSections } from '@/components/SewingTools';
import { useSewingColors } from '@/hooks/useColors';

export type SuppliesFabric = { fabric: StashFabric; amountUsed: string };

export const maxProjectFabrics = 12;
export const maxProjectTools = 30;

type Adding = 'stash-fabric' | 'stash-tools' | 'new-fabric' | 'new-tool' | null;

export function NeedsPhotoTag() {
  return (
    <View style={styles.tag}>
      <LoomText style={{ color: '#694b4b', fontFamily: fonts.semibold, fontSize: 11 }}>Needs a photo</LoomText>
    </View>
  );
}

// One list of what a sewing project needs: fabric with how much is used, and
// notions and tools. Things come from the stash or are added new here, which
// also saves them to the Fabric stash or Tools.
export function SuppliesField({ fabrics, tools, onFabrics, onTools }: {
  fabrics: SuppliesFabric[];
  tools: SewingTool[];
  onFabrics: (fabrics: SuppliesFabric[]) => void;
  onTools: (tools: SewingTool[]) => void;
}) {
  const colors = useSewingColors();
  const [menuOpen, setMenuOpen] = useState(false);
  const [adding, setAdding] = useState<Adding>(null);
  const roomForFabric = fabrics.length < maxProjectFabrics;
  const roomForTools = tools.length < maxProjectTools;
  const addFabric = (fabric: StashFabric) => { onFabrics([...fabrics, { fabric, amountUsed: '' }]); setAdding(null); };
  const addTool = (tool: SewingTool) => { onTools([...tools, tool]); setAdding(null); };
  const choose = (next: Adding) => { setMenuOpen(false); setAdding(next); };
  const inputStyle = [styles.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.input }];

  return (
    <View testID="sewing-supplies">
      {fabrics.length ? <LoomText style={[styles.group, { color: colors.primaryText }]}>FABRIC</LoomText> : null}
      {fabrics.map((item, index) => {
        const unit = fabricUnits.find((option) => option.value === item.fabric.unit) ?? fabricUnits[0];
        return (
          <View key={item.fabric.id} style={[styles.row, { borderColor: colors.border }]} testID={`sewing-fabric-${index}`}>
            <FabricPhoto fabric={item.fabric} index={0} style={[styles.thumb, { backgroundColor: colors.selectedWash }]} />
            <View style={{ flex: 1, gap: 5 }}>
              <LoomText style={{ color: colors.foreground, fontFamily: fonts.semibold, fontSize: 15 }}>{fabricName(item.fabric)}</LoomText>
              {item.fabric.photoCount === 0 ? <NeedsPhotoTag /> : null}
              <View style={styles.usedRow}>
                <TextInput placeholderTextColor={colors.mutedForeground} value={item.amountUsed} onChangeText={(value) => onFabrics(fabrics.map((entry, place) => (place === index ? { ...entry, amountUsed: value } : entry)))} keyboardType="decimal-pad" placeholder="Used" accessibilityLabel={`Amount of ${fabricName(item.fabric)} used, in ${unit.label.toLowerCase()}`} style={[inputStyle, styles.usedInput]} testID={`input-sewing-fabric-used-${index}`} />
                <LoomText style={{ color: colors.mutedForeground, fontSize: 14 }}>{unit.amount} used</LoomText>
              </View>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${fabricName(item.fabric)}`} onPress={() => onFabrics(fabrics.filter((_, place) => place !== index))} style={styles.remove}><Feather name="x" size={16} color={colors.mutedForeground} /></Pressable>
          </View>
        );
      })}
      {tools.length ? <LoomText style={[styles.group, { color: colors.primaryText }]}>NOTIONS AND TOOLS</LoomText> : null}
      {tools.map((tool) => (
        <View key={tool.id} style={[styles.row, { borderColor: colors.border }]} testID={`sewing-tool-${tool.id}`}>
          <ToolThumb tool={tool} size={46} />
          <View style={{ flex: 1 }}>
            <LoomText style={{ color: colors.foreground, fontFamily: fonts.semibold, fontSize: 15 }}>{tool.name}</LoomText>
            {toolDetails(tool) ? <LoomText style={{ color: colors.mutedForeground, fontSize: 13 }}>{toolDetails(tool)}</LoomText> : null}
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${tool.name}`} onPress={() => onTools(tools.filter((item) => item.id !== tool.id))} style={styles.remove}><Feather name="x" size={16} color={colors.mutedForeground} /></Pressable>
        </View>
      ))}

      {adding === 'stash-fabric' ? <StashFabricPicker chosen={fabrics.map((item) => item.fabric.id)} onPick={addFabric} onNew={() => setAdding('new-fabric')} onClose={() => setAdding(null)} /> : null}
      {adding === 'stash-tools' ? <SewingToolPicker chosen={tools.map((tool) => tool.id)} onPick={addTool} onNew={() => setAdding('new-tool')} onClose={() => setAdding(null)} /> : null}
      {adding === 'new-fabric' ? <QuickFabricForm onAdded={addFabric} onClose={() => setAdding(null)} /> : null}
      {adding === 'new-tool' ? <QuickToolForm onAdded={addTool} onClose={() => setAdding(null)} /> : null}
      {adding === null && (roomForFabric || roomForTools) ? (
        <LoomButton title="Add supplies" icon="plus" variant="secondary" onPress={() => setMenuOpen(true)} style={{ marginBottom: 14 }} testID="button-add-supplies" />
      ) : null}

      <Modal visible={menuOpen} transparent animationType="slide" onRequestClose={() => setMenuOpen(false)}>
        <View style={styles.backdrop}>
          <Pressable accessibilityLabel="Close add supplies" onPress={() => setMenuOpen(false)} style={StyleSheet.absoluteFill} />
          <View style={[styles.sheet, { backgroundColor: colors.card }]}>
            <View style={[styles.grab, { backgroundColor: colors.border }]} />
            <LoomText serif style={{ color: colors.foreground, fontSize: 21, marginBottom: 4 }}>Add supplies</LoomText>
            <LoomText style={[styles.group, { color: colors.primaryText }]}>FROM YOUR STASH</LoomText>
            {roomForFabric ? <MenuOption icon="layers" title="Fabric from my stash" detail="Pick pieces you already have" onPress={() => choose('stash-fabric')} testID="button-supplies-stash-fabric" /> : null}
            {roomForTools ? <MenuOption icon="scissors" title="Notions and tools I have" detail="Pick from your Tools" onPress={() => choose('stash-tools')} testID="button-supplies-stash-tools" /> : null}
            <LoomText style={[styles.group, { color: colors.primaryText, marginTop: 12 }]}>SOMETHING NEW</LoomText>
            {roomForFabric ? <MenuOption icon="plus" title="New fabric" detail="Also saved to your Fabric stash" onPress={() => choose('new-fabric')} testID="button-supplies-new-fabric" /> : null}
            {roomForTools ? <MenuOption icon="plus" title="New notion or tool" detail="Also saved to your Tools" onPress={() => choose('new-tool')} testID="button-supplies-new-tool" /> : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function MenuOption({ icon, title, detail, onPress, testID }: { icon: keyof typeof Feather.glyphMap; title: string; detail: string; onPress: () => void; testID: string }) {
  const colors = useSewingColors();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.option, { borderBottomColor: colors.border }]} testID={testID}>
      <View style={[styles.optionIcon, { backgroundColor: colors.selectedWash }]}><Feather name={icon} size={18} color={colors.primaryText} /></View>
      <View style={{ flex: 1 }}>
        <LoomText style={{ color: colors.foreground, fontFamily: fonts.semibold, fontSize: 16 }}>{title}</LoomText>
        <LoomText style={{ color: colors.mutedForeground, fontSize: 13 }}>{detail}</LoomText>
      </View>
    </Pressable>
  );
}

function Panel({ title, onClose, children, testID }: { title: string; onClose: () => void; children: React.ReactNode; testID: string }) {
  const colors = useSewingColors();
  return (
    <View style={[styles.panel, { borderColor: colors.border, backgroundColor: colors.selectedWash }]} testID={testID}>
      <View style={styles.panelHead}>
        <LoomText style={{ color: colors.foreground, fontFamily: fonts.semibold, fontSize: 16 }}>{title}</LoomText>
        <Pressable accessibilityRole="button" accessibilityLabel={`Close ${title.toLowerCase()}`} onPress={onClose} style={styles.remove}><Feather name="x" size={17} color={colors.mutedForeground} /></Pressable>
      </View>
      {children}
    </View>
  );
}

function StashFabricPicker({ chosen, onPick, onNew, onClose }: { chosen: string[]; onPick: (fabric: StashFabric) => void; onNew: () => void; onClose: () => void }) {
  const colors = useSewingColors();
  const stash = useGetStashFabrics({});
  const available = stash.data?.filter((fabric) => !chosen.includes(fabric.id)) ?? [];
  return (
    <Panel title="Your fabric stash" onClose={onClose} testID="picker-stash-fabric">
      {available.length ? available.map((fabric) => (
        <Pressable key={fabric.id} accessibilityRole="button" onPress={() => onPick(fabric)} style={[styles.pick, { backgroundColor: colors.card, borderColor: colors.border }]} testID={`button-pick-fabric-${fabric.id}`}>
          <FabricPhoto fabric={fabric} index={0} style={[styles.pickThumb, { backgroundColor: colors.selectedWash }]} />
          <View style={{ flex: 1 }}>
            <LoomText style={{ color: colors.foreground, fontFamily: fonts.semibold, fontSize: 15 }}>{fabricName(fabric)}</LoomText>
            {fabricSize(fabric) ? <LoomText style={{ color: colors.mutedForeground, fontSize: 13 }}>{fabricSize(fabric)}</LoomText> : null}
          </View>
        </Pressable>
      )) : (
        <>
          <LoomText style={{ color: colors.mutedForeground, fontSize: 14 }}>{stash.isLoading ? 'Loading your fabric…' : stash.data?.length ? 'All your fabric is on this project.' : 'Your fabric stash is empty.'}</LoomText>
          {stash.isLoading ? null : <LoomButton title="Add new fabric" icon="plus" variant="quiet" onPress={onNew} />}
        </>
      )}
    </Panel>
  );
}

function SewingToolPicker({ chosen, onPick, onNew, onClose }: { chosen: string[]; onPick: (tool: SewingTool) => void; onNew: () => void; onClose: () => void }) {
  const colors = useSewingColors();
  const tools = useGetSewingTools({});
  const available = tools.data?.filter((tool) => !chosen.includes(tool.id)) ?? [];
  return (
    <Panel title="Your notions and tools" onClose={onClose} testID="picker-stash-tools">
      {available.length ? available.map((tool) => (
        <Pressable key={tool.id} accessibilityRole="button" onPress={() => onPick(tool)} style={[styles.pick, { backgroundColor: colors.card, borderColor: colors.border }]} testID={`button-pick-tool-${tool.id}`}>
          <ToolThumb tool={tool} size={46} />
          <View style={{ flex: 1 }}>
            <LoomText style={{ color: colors.foreground, fontFamily: fonts.semibold, fontSize: 15 }}>{tool.name}</LoomText>
            {toolDetails(tool) ? <LoomText style={{ color: colors.mutedForeground, fontSize: 13 }}>{toolDetails(tool)}</LoomText> : null}
          </View>
        </Pressable>
      )) : (
        <>
          <LoomText style={{ color: colors.mutedForeground, fontSize: 14 }}>{tools.isLoading ? 'Loading your tools…' : tools.data?.length ? 'All your tools are on this project.' : 'You have no tools saved yet.'}</LoomText>
          {tools.isLoading ? null : <LoomButton title="Add a new one" icon="plus" variant="quiet" onPress={onNew} />}
        </>
      )}
    </Panel>
  );
}

// New fabric in a few taps: type and amount, with the print photo optional.
// Without a photo it shows "Needs a photo" in the Fabric stash, where the
// rest can be filled in later.
function QuickFabricForm({ onAdded, onClose }: { onAdded: (fabric: StashFabric) => void; onClose: () => void }) {
  const colors = useSewingColors();
  const client = useQueryClient();
  const create = useCreateStashFabric();
  const [fabricType, setFabricType] = useState<FabricType | ''>('');
  const [unit, setUnit] = useState<FabricUnit>('meters');
  const [amount, setAmount] = useState('');
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const unitLabel = fabricUnits.find((item) => item.value === unit) ?? fabricUnits[0];
  const typeLabel = fabricTypes.find((item) => item.value === fabricType)?.label;

  const pickPhoto = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Photo library access', 'Allow access to choose fabric photos in Settings.', [
          { text: 'Not now', style: 'cancel' },
          { text: 'Open Settings', onPress: () => { void Linking.openSettings(); } },
        ]);
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85, allowsEditing: true, aspect: [1, 1] });
      if (!result.canceled) setPhoto(result.assets[0] ?? null);
    } catch {
      setMessage('We could not open your photo library. Please try again.');
    }
  };

  const save = async () => {
    setMessage('');
    const size = sizeForApi(amount);
    if (!fabricType) return setMessage('Choose the fabric type.');
    if (size === 'invalid') return setMessage('Enter an amount between 0 and 999, like 2.5.');
    setSaving(true);
    let photoPaths: string[] = [];
    if (photo) {
      try {
        const file = new File(photo.uri);
        const contentType = photo.mimeType || 'image/jpeg';
        const fileSize = photo.fileSize ?? file.size;
        if (fileSize > 10 * 1024 * 1024) throw new Error('Choose a photo smaller than 10 MB.');
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(contentType)) throw new Error('Choose a JPEG, PNG, or WebP photo.');
        const upload = await requestFabricPhotoUpload({ name: photo.fileName || 'fabric-photo', size: Math.max(1, fileSize), contentType: contentType as 'image/jpeg' | 'image/png' | 'image/webp' });
        const response = await expoFetch(upload.uploadURL, { method: 'PUT', headers: { 'Content-Type': contentType }, body: file });
        if (!response.ok) throw new Error('Photo upload failed.');
        photoPaths = [upload.photoPath];
      } catch (error) {
        setMessage(error instanceof Error && error.message.startsWith('Choose') ? error.message : 'We could not upload that photo. Please try again, or add it later.');
        setSaving(false);
        return;
      }
    }
    create.mutate({ data: { fabricType, unit, amount: size, amountLeft: size, photoPaths, photoLater: photoPaths.length === 0, addAsNew: true } }, {
      onSuccess: (fabric) => {
        void client.invalidateQueries({ queryKey: getGetStashFabricsQueryKey() });
        refreshPaths(client, '/api/sewing-overview');
        onAdded(fabric);
      },
      onError: (error) => setMessage((error as { data?: { error?: string } })?.data?.error ?? 'We could not add this fabric just now. Please try again.'),
      onSettled: () => setSaving(false),
    });
  };

  return (
    <Panel title="New fabric" onClose={onClose} testID="quick-fabric">
      <View style={[styles.tapRows, { borderColor: colors.border, backgroundColor: colors.card }]}>
        <TapWheelRow
          first
          label="Fabric type"
          shown={typeLabel ? <LoomText style={{ color: colors.foreground, fontSize: 15 }}>{typeLabel}</LoomText> : null}
          wheels={[{ label: 'Fabric type', items: fabricTypes.map((item) => item.label), index: Math.max(0, fabricTypes.findIndex((item) => item.value === fabricType)) }]}
          onDone={([type]) => setFabricType(fabricTypes[type ?? 0].value)}
          onClear={() => setFabricType('')}
          testID="row-quick-fabric-type"
        />
      </View>
      <FormFieldLabel>Amount</FormFieldLabel>
      <View style={styles.amountRow}>
        <TextInput placeholderTextColor={colors.mutedForeground} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder={`e.g. 2 ${unitLabel.amount}`} accessibilityLabel={`Amount in ${unitLabel.label.toLowerCase()}`} style={[styles.input, styles.amountInput, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.input }]} testID="input-quick-fabric-amount" />
        <Choices options={fabricUnits.map((item) => ({ value: item.value, label: item.label }))} value={unit} onChange={setUnit} testID="button-quick-fabric-unit" />
      </View>
      <Pressable accessibilityRole="button" onPress={() => { void pickPhoto(); }} style={[styles.photo, { borderColor: colors.accent, backgroundColor: colors.card }]} testID="button-quick-fabric-photo">
        {photo ? <Image source={{ uri: photo.uri }} style={styles.photoPreview} contentFit="cover" /> : <Feather name="camera" size={17} color={colors.primaryText} />}
        <LoomText style={{ color: colors.primaryText, fontFamily: fonts.semibold, fontSize: 14 }}>{photo ? 'Change print photo' : 'Add print photo (optional now)'}</LoomText>
      </Pressable>
      <LoomText style={[styles.hint, { color: colors.mutedForeground }]}>{photo ? 'Print, color and width can be filled in later in your Fabric stash.' : 'No photo yet? It shows “Needs a photo” in your Fabric stash, where you can add it with the rest of the details.'}</LoomText>
      {message ? <LoomText accessibilityRole="alert" style={[styles.hint, { color: colors.destructive }]}>{message}</LoomText> : null}
      <LoomButton title="Add to project and stash" onPress={() => { void save(); }} busy={saving} testID="button-quick-fabric-save" />
    </Panel>
  );
}

// New notion or tool with just its section, type and name. The rest can be
// filled in later in Tools.
function QuickToolForm({ onAdded, onClose }: { onAdded: (tool: SewingTool) => void; onClose: () => void }) {
  const colors = useSewingColors();
  const client = useQueryClient();
  const create = useCreateSewingTool();
  const [section, setSection] = useState<SewingToolSection>('notions');
  const [category, setCategory] = useState<SewingToolCategory | ''>('');
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const example = category ? categoryFor(category).example : section === 'kit' ? 'Walking foot' : 'Invisible zip';

  const save = () => {
    setMessage('');
    if (!category) return setMessage('Choose a type.');
    if (!name.trim()) return setMessage('Give it a name.');
    create.mutate({ data: { section, category, name: name.trim() } }, {
      onSuccess: (tool) => {
        void client.invalidateQueries({ queryKey: getGetSewingToolsQueryKey() });
        onAdded(tool);
      },
      onError: (error) => setMessage((error as { data?: { error?: string } })?.data?.error ?? 'We could not add this just now. Please try again.'),
    });
  };

  return (
    <Panel title="New notion or tool" onClose={onClose} testID="quick-tool">
      <FormFieldLabel>Section</FormFieldLabel>
      <Choices options={toolSections.map((item) => ({ value: item.value, label: item.label }))} value={section} onChange={(value) => { setSection(value); setCategory(category === 'other' ? 'other' : ''); }} testID="button-quick-tool-section" />
      <ToolTypeWheelField section={section} value={category} onChange={setCategory} />
      <FormFieldLabel>Name *</FormFieldLabel>
      <TextInput placeholderTextColor={colors.mutedForeground} value={name} onChangeText={setName} maxLength={80} placeholder={`e.g. ${example}`} style={[styles.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.input }]} testID="input-quick-tool-name" />
      <LoomText style={[styles.hint, { color: colors.mutedForeground }]}>How many, size, color and a photo can be added later in Tools.</LoomText>
      {message ? <LoomText accessibilityRole="alert" style={[styles.hint, { color: colors.destructive }]}>{message}</LoomText> : null}
      <LoomButton title="Add to project and Tools" onPress={save} busy={create.isPending} testID="button-quick-tool-save" />
    </Panel>
  );
}

const styles = StyleSheet.create({
  group: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: 0.7, marginTop: 4, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 11, borderWidth: 1, borderRadius: 12, padding: 8, marginBottom: 10 },
  thumb: { width: 58, height: 58, borderRadius: 8 },
  usedRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { minHeight: 45, borderWidth: 1, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, fontFamily: fonts.body, marginBottom: 14 },
  usedInput: { minHeight: 38, width: 90, marginBottom: 0, paddingVertical: 6 },
  remove: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  tag: { alignSelf: 'flex-start', borderWidth: 1, borderColor: '#e8c8be', backgroundColor: '#fbefec', borderRadius: 99, paddingHorizontal: 7, paddingVertical: 1 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(31, 47, 22, 0.42)' },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 34 },
  grab: { width: 40, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: 12 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1 },
  optionIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  panel: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 8, marginBottom: 14 },
  panelHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pick: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 10, padding: 7 },
  pickThumb: { width: 46, height: 46, borderRadius: 7 },
  tapRows: { borderWidth: 1, borderRadius: 12, marginBottom: 6 },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  amountInput: { width: 120, marginBottom: 0 },
  photo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 12, padding: 12, marginTop: 10 },
  photoPreview: { width: 34, height: 34, borderRadius: 6 },
  hint: { fontSize: 13, lineHeight: 19 },
});

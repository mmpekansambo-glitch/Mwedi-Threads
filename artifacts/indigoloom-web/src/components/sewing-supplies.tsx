import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Camera, Plus, Scissors, Shirt, X } from 'lucide-react';
import {
  getGetSewingOverviewQueryKey, getGetSewingToolsQueryKey, getGetStashFabricsQueryKey, requestFabricPhotoUpload,
  useCreateSewingTool, useCreateStashFabric, useGetSewingTools, useGetStashFabrics,
} from '@workspace/api-client-react';
import type { FabricType, FabricUnit, SewingTool, SewingToolCategory, SewingToolSection, StashFabric } from '@workspace/api-client-react';
import { FabricPrintImage, OptionWheelField, fabricName, fabricSize, fabricTypes, fabricUnits, sizeForApi } from '@/components/fabric-fields';
import { fabricAmount } from '@/components/sewing-fields';
import { ToolThumb, ToolTypeWheelField, categoryFor, toolDetails, toolSections } from '@/components/sewing-tools';

export type SuppliesFabric = { fabric: StashFabric; amountUsed: string };

export const maxProjectFabrics = 12;
export const maxProjectTools = 30;

type Adding = 'menu' | 'stash-fabric' | 'stash-tools' | 'new-fabric' | 'new-tool' | null;

// One list of what a sewing project needs: fabric with how much is used, and
// notions and tools. Things can come from the stash or be added new here,
// which also saves them to the Fabric stash or Tools.
export function SuppliesField({ fabrics, tools, onFabrics, onTools, error, onAmountTyped }: {
  fabrics: SuppliesFabric[];
  tools: SewingTool[];
  onFabrics: (fabrics: SuppliesFabric[]) => void;
  onTools: (tools: SewingTool[]) => void;
  error?: string;
  onAmountTyped?: () => void;
}) {
  const [adding, setAdding] = useState<Adding>(null);
  const roomForFabric = fabrics.length < maxProjectFabrics;
  const roomForTools = tools.length < maxProjectTools;
  const addFabric = (fabric: StashFabric) => { onFabrics([...fabrics, { fabric, amountUsed: '' }]); setAdding(null); };
  const addTool = (tool: SewingTool) => { onTools([...tools, tool]); setAdding(null); };

  return <div className="supplies" data-testid="sewing-supplies">
    {fabrics.length > 0 && <h3 className="supplies-group">Fabric</h3>}
    {fabrics.map((item, index) => {
      const unit = fabricUnits.find((option) => option.value === item.fabric.unit) ?? fabricUnits[0]!;
      return <div key={item.fabric.id} className="sewing-fabric-row" data-testid={`sewing-fabric-${index}`}>
        <FabricPrintImage fabric={item.fabric} alt=""/>
        <span className="sewing-fabric-name"><b>{fabricName(item.fabric)}</b><small>{item.fabric.photoCount === 0 ? <span className="supplies-needs-photo">Needs a photo</span> : null}{fabricSize(item.fabric) || 'No amount saved'}</small></span>
        <label className="sewing-fabric-used"><span>Used</span><span className="input-with-unit"><input inputMode="decimal" placeholder="e.g. 1.5" value={item.amountUsed} onChange={(event) => { onFabrics(fabrics.map((entry, place) => (place === index ? { ...entry, amountUsed: event.target.value } : entry))); onAmountTyped?.(); }} aria-label={`Amount of ${fabricName(item.fabric)} used`} data-testid={`input-sewing-fabric-used-${index}`}/><i>{unit.amount}</i></span></label>
        <button type="button" className="icon-button" aria-label={`Remove ${fabricName(item.fabric)}`} onClick={() => onFabrics(fabrics.filter((_, place) => place !== index))} data-testid={`button-remove-sewing-fabric-${index}`}><X size={15}/></button>
      </div>;
    })}
    {error && <span className="field-error">{error}</span>}
    {tools.length > 0 && <h3 className="supplies-group">Notions and tools</h3>}
    {tools.map((tool) => <div key={tool.id} className="sewing-tool-row" data-testid={`sewing-tool-${tool.id}`}>
      <ToolThumb tool={tool}/>
      <span className="sewing-fabric-name"><b>{tool.name}</b><small>{toolDetails(tool)}</small></span>
      <button type="button" className="icon-button" aria-label={`Remove ${tool.name}`} onClick={() => onTools(tools.filter((item) => item.id !== tool.id))} data-testid={`button-remove-sewing-tool-${tool.id}`}><X size={15}/></button>
    </div>)}

    {adding === 'menu' && <div className="fabric-picker supplies-menu" role="group" aria-label="Add supplies">
      <div className="fabric-picker-head"><b>Add supplies</b><button type="button" className="icon-button" onClick={() => setAdding(null)} aria-label="Close"><X size={16}/></button></div>
      <p className="supplies-menu-group">From your stash</p>
      {roomForFabric && <SuppliesOption icon={<Shirt size={18}/>} title="Fabric from my stash" detail="Pick pieces you already have" onClick={() => setAdding('stash-fabric')} testId="button-supplies-stash-fabric"/>}
      {roomForTools && <SuppliesOption icon={<Scissors size={18}/>} title="Notions and tools I have" detail="Pick from your Tools" onClick={() => setAdding('stash-tools')} testId="button-supplies-stash-tools"/>}
      <p className="supplies-menu-group">Something new</p>
      {roomForFabric && <SuppliesOption icon={<Plus size={18}/>} title="New fabric" detail="Also saved to your Fabric stash" onClick={() => setAdding('new-fabric')} testId="button-supplies-new-fabric"/>}
      {roomForTools && <SuppliesOption icon={<Plus size={18}/>} title="New notion or tool" detail="Also saved to your Tools" onClick={() => setAdding('new-tool')} testId="button-supplies-new-tool"/>}
    </div>}
    {adding === 'stash-fabric' && <StashFabricPicker chosen={fabrics.map((item) => item.fabric.id)} onPick={addFabric} onNew={() => setAdding('new-fabric')} onClose={() => setAdding(null)}/>}
    {adding === 'stash-tools' && <SewingToolPicker chosen={tools.map((tool) => tool.id)} onPick={addTool} onNew={() => setAdding('new-tool')} onClose={() => setAdding(null)}/>}
    {adding === 'new-fabric' && <QuickFabricForm onAdded={addFabric} onClose={() => setAdding(null)}/>}
    {adding === 'new-tool' && <QuickToolForm onAdded={addTool} onClose={() => setAdding(null)}/>}
    {adding === null && (roomForFabric || roomForTools) && <button type="button" className="button button-outline" onClick={() => setAdding('menu')} data-testid="button-add-supplies"><Plus size={16}/> Add supplies</button>}
  </div>;
}

function SuppliesOption({ icon, title, detail, onClick, testId }: { icon: React.ReactNode; title: string; detail: string; onClick: () => void; testId: string }) {
  return <button type="button" className="supplies-option" onClick={onClick} data-testid={testId}>
    <span className="supplies-option-icon" aria-hidden="true">{icon}</span>
    <span><b>{title}</b><small>{detail}</small></span>
  </button>;
}

// Shows the maker's fabric stash to pick from, leaving out fabric already on the project.
function StashFabricPicker({ chosen, onPick, onNew, onClose }: { chosen: string[]; onPick: (fabric: StashFabric) => void; onNew: () => void; onClose: () => void }) {
  const stash = useGetStashFabrics({}, { query: { queryKey: getGetStashFabricsQueryKey({}) } });
  const available = stash.data?.filter((fabric) => !chosen.includes(fabric.id)) ?? [];
  return <div className="fabric-picker" role="group" aria-label="Choose fabric from your stash">
    <div className="fabric-picker-head"><b>Your fabric stash</b><button type="button" className="icon-button" onClick={onClose} aria-label="Close fabric list"><X size={16}/></button></div>
    {stash.isLoading ? <p className="fabric-picker-note">Loading your fabric…</p>
      : available.length ? <div className="fabric-picker-grid">{available.map((fabric) => <button key={fabric.id} type="button" className="fabric-pick" onClick={() => onPick(fabric)} data-testid={`button-pick-fabric-${fabric.id}`}>
        <FabricPrintImage fabric={fabric} alt=""/><span><b>{fabricName(fabric)}</b><small>{fabricSize(fabric)}</small></span>
      </button>)}</div>
      : <p className="fabric-picker-note">{stash.data?.length ? 'All your fabric is on this project.' : 'Your fabric stash is empty.'} <button type="button" className="link-button" onClick={onNew}>Add new fabric</button></p>}
  </div>;
}

// Shows a maker's Sewing room tools to pick from, leaving out tools already chosen.
function SewingToolPicker({ chosen, onPick, onNew, onClose }: { chosen: string[]; onPick: (tool: SewingTool) => void; onNew: () => void; onClose: () => void }) {
  const tools = useGetSewingTools({}, { query: { queryKey: getGetSewingToolsQueryKey({}) } });
  const available = tools.data?.filter((tool) => !chosen.includes(tool.id)) ?? [];
  return <div className="fabric-picker" role="group" aria-label="Choose from your tools">
    <div className="fabric-picker-head"><b>Your notions and tools</b><button type="button" className="icon-button" onClick={onClose} aria-label="Close tools list"><X size={16}/></button></div>
    {tools.isLoading ? <p className="fabric-picker-note">Loading your tools…</p>
      : available.length ? <div className="tool-picker-list">{available.map((tool) => <button key={tool.id} type="button" className="tool-pick" onClick={() => onPick(tool)} data-testid={`button-pick-tool-${tool.id}`}>
        <ToolThumb tool={tool}/><span><b>{tool.name}</b><small>{toolDetails(tool)}</small></span>
      </button>)}</div>
      : <p className="fabric-picker-note">{tools.data?.length ? 'All your tools are on this project.' : 'You haven’t saved any tools yet.'} <button type="button" className="link-button" onClick={onNew}>Add a new one</button></p>}
  </div>;
}

// New fabric in a few taps: type and amount, with the print photo optional.
// Without a photo it shows "Needs a photo" in the Fabric stash, where the
// rest can be filled in later.
function QuickFabricForm({ onAdded, onClose }: { onAdded: (fabric: StashFabric) => void; onClose: () => void }) {
  const client = useQueryClient();
  const create = useCreateStashFabric();
  const [fabricType, setFabricType] = useState<FabricType | ''>('');
  const [unit, setUnit] = useState<FabricUnit>('meters');
  const [amount, setAmount] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const unitLabel = fabricUnits.find((item) => item.value === unit)!;

  const save = async () => {
    const nextErrors: Record<string, string> = {};
    if (!fabricType) nextErrors.fabricType = 'Choose the fabric type.';
    const size = sizeForApi(amount);
    if (size === 'invalid') nextErrors.amount = 'Enter an amount between 0 and 999.';
    if (photo && !['image/jpeg', 'image/png', 'image/webp'].includes(photo.type)) nextErrors.photo = 'Choose a JPEG, PNG, or WebP photo.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length || !fabricType || size === 'invalid') return;
    setSaving(true);
    let photoPaths: string[] = [];
    if (photo) {
      try {
        const contentType = photo.type as 'image/jpeg' | 'image/png' | 'image/webp';
        const upload = await requestFabricPhotoUpload({ name: photo.name || 'fabric-photo', size: photo.size, contentType });
        const uploaded = await fetch(upload.uploadURL, { method: 'PUT', headers: { 'Content-Type': contentType }, body: photo });
        if (!uploaded.ok) throw new Error('The photo upload did not finish.');
        photoPaths = [upload.photoPath];
      } catch {
        setErrors({ photo: 'We couldn’t upload that photo. Please try again, or add it later.' });
        setSaving(false);
        return;
      }
    }
    create.mutate({ data: { fabricType, unit, amount: size, amountLeft: size, photoPaths, photoLater: photoPaths.length === 0, addAsNew: true } }, {
      onSuccess: (fabric) => {
        void client.invalidateQueries({ queryKey: getGetStashFabricsQueryKey() });
        void client.invalidateQueries({ queryKey: getGetSewingOverviewQueryKey() });
        onAdded(fabric);
      },
      onError: (error) => setErrors({ save: (error as { data?: { error?: string } })?.data?.error ?? 'We couldn’t add this fabric just now. Please try again.' }),
      onSettled: () => setSaving(false),
    });
  };

  return <div className="fabric-picker supplies-quick" role="group" aria-label="New fabric">
    <div className="fabric-picker-head"><b>New fabric</b><button type="button" className="icon-button" onClick={onClose} aria-label="Close new fabric"><X size={16}/></button></div>
    <OptionWheelField id="quick-fabric-type" label="Fabric type" required options={fabricTypes} value={fabricType} onChange={(value) => { setFabricType(value); setErrors(({ fabricType: _type, ...rest }) => rest); }} icon={Shirt} placeholder="Choose a type" testId="select-quick-fabric-type" error={errors.fabricType}/>
    <div className="field-block">
      <label htmlFor="quick-fabric-amount">Amount</label>
      <div className="supplies-amount">
        <span className="input-with-unit"><input id="quick-fabric-amount" inputMode="decimal" placeholder="e.g. 2" value={amount} onChange={(event) => { setAmount(event.target.value); setErrors(({ amount: _amount, ...rest }) => rest); }} data-testid="input-quick-fabric-amount"/><i>{unitLabel.amount}</i></span>
        <div className="segmented" role="radiogroup" aria-label="Measured in">{fabricUnits.map((item) => <button key={item.value} type="button" role="radio" aria-checked={unit === item.value} className={unit === item.value ? 'selected' : ''} onClick={() => setUnit(item.value)} data-testid={`button-quick-fabric-unit-${item.value}`}>{item.label}</button>)}</div>
      </div>
      {errors.amount && <span className="field-error">{errors.amount}</span>}
    </div>
    <label className="supplies-photo" htmlFor="quick-fabric-photo"><Camera size={17}/>{photo ? photo.name : 'Add print photo (optional now)'}</label>
    <input id="quick-fabric-photo" className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { setPhoto(event.target.files?.[0] ?? null); setErrors(({ photo: _photo, ...rest }) => rest); }} data-testid="input-quick-fabric-photo"/>
    {errors.photo && <span className="field-error">{errors.photo}</span>}
    {errors.save && <span className="field-error" role="alert">{errors.save}</span>}
    <p className="supplies-hint">{photo ? 'Print, color and width can be filled in later in your Fabric stash.' : 'No photo yet? It shows “Needs a photo” in your Fabric stash, where you can add it with the rest of the details.'}</p>
    <button type="button" className="button button-primary" disabled={saving} onClick={() => { void save(); }} data-testid="button-quick-fabric-save">{saving ? 'Adding…' : 'Add to project and stash'}</button>
  </div>;
}

// New notion or tool with just its section, type and name. The rest can be
// filled in later in Tools.
function QuickToolForm({ onAdded, onClose }: { onAdded: (tool: SewingTool) => void; onClose: () => void }) {
  const client = useQueryClient();
  const create = useCreateSewingTool();
  const [section, setSection] = useState<SewingToolSection>('notions');
  const [category, setCategory] = useState<SewingToolCategory | ''>('');
  const [name, setName] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const example = category ? categoryFor(category).example : section === 'kit' ? 'Walking foot' : 'Invisible zip';

  const save = () => {
    const nextErrors: Record<string, string> = {};
    if (!category) nextErrors.category = 'Choose a type.';
    if (!name.trim()) nextErrors.name = 'Give it a name.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length || !category) return;
    create.mutate({ data: { section, category, name: name.trim() } }, {
      onSuccess: (tool) => {
        void client.invalidateQueries({ queryKey: getGetSewingToolsQueryKey() });
        onAdded(tool);
      },
      onError: (error) => setErrors({ save: (error as { data?: { error?: string } })?.data?.error ?? 'We couldn’t add this just now. Please try again.' }),
    });
  };

  return <div className="fabric-picker supplies-quick" role="group" aria-label="New notion or tool">
    <div className="fabric-picker-head"><b>New notion or tool</b><button type="button" className="icon-button" onClick={onClose} aria-label="Close new notion or tool"><X size={16}/></button></div>
    <div className="field-block"><span className="field-label" id="quick-tool-section">Section</span><div className="segmented" role="radiogroup" aria-labelledby="quick-tool-section">{toolSections.map((item) => <button key={item.value} type="button" role="radio" aria-checked={section === item.value} className={section === item.value ? 'selected' : ''} onClick={() => { setSection(item.value); setCategory(category === 'other' ? 'other' : ''); }} data-testid={`button-quick-tool-section-${item.value}`}>{item.label}</button>)}</div></div>
    <ToolTypeWheelField section={section} value={category} onChange={(value) => { setCategory(value); setErrors(({ category: _category, ...rest }) => rest); }} error={errors.category}/>
    <div className="field-block"><label htmlFor="quick-tool-name">Name <b>*</b></label><input id="quick-tool-name" maxLength={80} placeholder={`e.g. ${example}`} value={name} onChange={(event) => { setName(event.target.value); setErrors(({ name: _name, ...rest }) => rest); }} data-testid="input-quick-tool-name"/>{errors.name && <span className="field-error">{errors.name}</span>}</div>
    {errors.save && <span className="field-error" role="alert">{errors.save}</span>}
    <p className="supplies-hint">How many, size, color and a photo can be added later in Tools.</p>
    <button type="button" className="button button-primary" disabled={create.isPending} onClick={save} data-testid="button-quick-tool-save">{create.isPending ? 'Adding…' : 'Add to project and Tools'}</button>
  </div>;
}

// The project page's read-only Supplies list; each item opens where it's kept.
export function SuppliesList({ fabrics, tools, projectId }: {
  fabrics: Array<{ stashFabricId: string; amountUsed: number | null; fabric: StashFabric }>;
  tools: SewingTool[];
  projectId: string;
}) {
  if (!fabrics.length && !tools.length) {
    return <p className="notes-empty">No supplies on this project yet. <Link href={`/sewing/projects/${projectId}/edit`}>Add supplies</Link></p>;
  }
  return <>{fabrics.length > 0 && <h3 className="supplies-group">Fabric</h3>}
    {fabrics.length > 0 && <div className="fabric-grid">{fabrics.map((item) => <Link key={item.stashFabricId} href={`/sewing/fabric/${item.stashFabricId}`} className="fabric-card lift" data-testid={`card-project-fabric-${item.stashFabricId}`}>
      <span className="fabric-swatch"><FabricPrintImage fabric={item.fabric} alt={`${fabricName(item.fabric)} print`} needsPhotoLabel/></span>
      <span className="fabric-card-body"><h3>{fabricName(item.fabric)}</h3>{item.amountUsed !== null && <span className="fabric-card-size">Uses {fabricAmount(item.amountUsed, item.fabric.unit)}</span>}</span>
    </Link>)}</div>}
    {tools.length > 0 && <h3 className="supplies-group">Notions and tools</h3>}
    {tools.length > 0 && <div className="tool-list">{tools.map((tool) => <Link key={tool.id} href={`/sewing/tools/${tool.id}`} className="tool-row lift" data-testid={`card-tool-${tool.id}`}>
      <ToolThumb tool={tool}/>
      <span className="tool-row-body"><b>{tool.name}</b><small>{toolDetails(tool)}</small></span>
      {tool.quantity !== null && <span className="tool-quantity" aria-label={`Quantity ${tool.quantity}`}>× {tool.quantity}</span>}
    </Link>)}</div>}
  </>;
}

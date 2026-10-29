import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Feather, MoreHorizontal, Pencil, Trash2, X } from 'lucide-react';
import { requestProgressPhotoUpload, useDeleteProgress, useUpdateProgress } from '@workspace/api-client-react';
import type { ProgressEntry, ProjectDetail, UpdateProgress } from '@workspace/api-client-react';
import { DateWheelField } from '@/components/date-wheel-field';
import { ProgressAmountField, amountDraftFor, progressAmountForApi, type ProgressAmountDraft } from '@/components/progress-method';
import { useNoteEditing, useNoteEditor } from '@/components/note-editing';

const photoTypes = ['image/jpeg', 'image/png', 'image/webp'] as const;
const pad2 = (value: number) => String(value).padStart(2, '0');
const localDay = (date: Date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

export function ProgressBar({ value }: { value: number }) {
  return <div className="progress-track" aria-label={`${value}% complete`}><span style={{ width: `${Math.min(100, Math.max(0, value))}%` }}/></div>;
}

// Uploads a progress photo to private storage and returns the path to save on the note.
export async function uploadProgressPhoto(projectId: string, photo: File): Promise<{ photoPath: string } | { error: string }> {
  if (photo.size > 10 * 1024 * 1024) return { error: 'Choose a photo smaller than 10 MB.' };
  if (!(photoTypes as readonly string[]).includes(photo.type)) return { error: 'Choose a JPEG, PNG, or WebP photo.' };
  const contentType = photo.type as typeof photoTypes[number];
  try {
    const upload = await requestProgressPhotoUpload(projectId, { name: photo.name || 'progress-photo', size: photo.size, contentType });
    const uploaded = await fetch(upload.uploadURL, { method: 'PUT', headers: { 'Content-Type': contentType }, body: photo });
    if (!uploaded.ok) throw new Error('The photo upload did not finish.');
    return { photoPath: upload.photoPath };
  } catch {
    return { error: 'We couldn’t upload that photo. Try again or save without it.' };
  }
}

// The ⋯ bubble on a journal note, with Edit and Delete.
export function NoteMenu({ entryId, onEdit, onDelete }: { entryId: string; onEdit: () => void; onDelete: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === 'Escape' : !menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [menuOpen]);

  return <div className="note-menu" ref={menuRef}>
    <button type="button" className={`note-menu-bubble${menuOpen ? ' open' : ''}`} aria-label="Note options" aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)} data-testid={`button-note-menu-${entryId}`}><MoreHorizontal size={18}/></button>
    {menuOpen && <div className="note-menu-list" role="menu">
      <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onEdit(); }} data-testid={`button-edit-note-${entryId}`}><Pencil size={16}/> Edit note</button>
      <button type="button" role="menuitem" className="danger" onClick={() => { setMenuOpen(false); onDelete(); }} data-testid={`button-delete-note-${entryId}`}><Trash2 size={16}/> Delete note</button>
    </div>}
  </div>;
}

export function ProgressEntryCard({ project, entry, isLatest, onChanged, children }: {
  project: ProjectDetail;
  entry: ProgressEntry;
  isLatest: boolean;
  onChanged: () => void;
  children?: React.ReactNode;
}) {
  const notes = useNoteEditing();
  const editing = notes.openId === entry.id;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const remove = useDeleteProgress();

  const deleteNote = () => remove.mutate({ projectId: project.id, entryId: entry.id }, { onSuccess: onChanged });

  return <article className="timeline-entry" data-testid={`entry-progress-${entry.id}`}>
    <span className="timeline-marker"><Feather size={13}/></span>
    {editing
      ? <EditProgressForm project={project} entry={entry} isLatest={isLatest} onSaved={onChanged} onClose={notes.close}/>
      : <div className="timeline-card loom-card">
        <div className="timeline-entry-top">
          <time>{new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(entry.createdAt))}</time>
          <b>{entry.completionPercent}% complete</b>
          <NoteMenu entryId={entry.id} onEdit={() => { setConfirmDelete(false); void notes.open(entry.id); }} onDelete={() => setConfirmDelete(true)}/>
        </div>
        {confirmDelete && <div className="confirm-banner note-confirm"><div><b>Delete this note?</b><span>This can’t be undone.</span></div><button type="button" className="button button-quiet" onClick={() => setConfirmDelete(false)} data-testid={`button-cancel-delete-note-${entry.id}`}>Cancel</button><button type="button" className="button button-danger" onClick={deleteNote} disabled={remove.isPending} data-testid={`button-confirm-delete-note-${entry.id}`}>{remove.isPending ? 'Deleting…' : 'Delete note'}</button></div>}
        {remove.isError && <p className="mutation-error">We couldn’t delete that note. Please try again.</p>}
        <p>{entry.notes}</p>
        {children}
        <ProgressBar value={entry.completionPercent}/>
      </div>}
  </article>;
}

function EditProgressForm({ project, entry, isLatest, onSaved, onClose }: {
  project: ProjectDetail;
  entry: ProgressEntry;
  isLatest: boolean;
  onSaved: () => void;
  onClose: () => void;
}) {
  const written = new Date(entry.createdAt);
  // Section ticks aren't stored per note, so the latest note starts from the
  // project's current ticks and older notes start with the count they recorded.
  const startingAmount = (): ProgressAmountDraft => {
    const draft = amountDraftFor({ ...project, completionPercent: entry.completionPercent }, entry.progressValue);
    if (project.progressMethod !== 'sections' || isLatest) return draft;
    const count = Math.round((entry.completionPercent / 100) * project.progressSections.length);
    return { ...draft, done: project.progressSections.slice(0, count).map((_, position) => position) };
  };
  const [initialAmount] = useState(startingAmount);
  const [notes, setNotes] = useState(entry.notes);
  const [day, setDay] = useState(localDay(written));
  const [precision, setPrecision] = useState<'day' | 'month'>('day');
  const [amount, setAmount] = useState(initialAmount);
  const [keepPhoto, setKeepPhoto] = useState(Boolean(entry.photoPath));
  const [newPhoto, setNewPhoto] = useState<File | null>(null);
  const [newPhotoPreview, setNewPhotoPreview] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const update = useUpdateProgress();

  useEffect(() => {
    if (!newPhoto) {
      setNewPhotoPreview('');
      return;
    }
    const preview = URL.createObjectURL(newPhoto);
    setNewPhotoPreview(preview);
    return () => URL.revokeObjectURL(preview);
  }, [newPhoto]);

  const amountChanged = JSON.stringify(amount) !== JSON.stringify(initialAmount);
  const dirty = () => notes !== entry.notes || day !== localDay(written) || precision !== 'day' || amountChanged || Boolean(newPhoto) || keepPhoto !== Boolean(entry.photoPath);

  // Saves the changes and says whether they went through.
  const persist = async (): Promise<boolean> => {
    const fail = (message: string) => { setError(message); return false; };
    if (!notes.trim()) return fail('Add a note about this session.');
    if (notes.length > 2000) return fail('Keep your note under 2,000 characters.');
    if (!day || precision !== 'day') return fail('Choose the day you wrote this note.');
    if (day > localDay(new Date())) return fail('The date can’t be in the future.');
    const payload: UpdateProgress = { notes: notes.trim() };
    if (amountChanged) {
      const progress = progressAmountForApi(project, amount);
      if (typeof progress === 'string') return fail(progress);
      Object.assign(payload, progress);
    }
    if (day !== localDay(written)) {
      // Keep the time of day so notes written on the same day stay in order.
      const [year, month, date] = day.split('-').map(Number);
      const moved = new Date(written);
      moved.setFullYear(year, month - 1, date);
      payload.createdAt = moved.toISOString();
    }
    setError('');
    setSaving(true);
    if (newPhoto) {
      const uploaded = await uploadProgressPhoto(project.id, newPhoto);
      if ('error' in uploaded) {
        setSaving(false);
        return fail(uploaded.error);
      }
      payload.photoPath = uploaded.photoPath;
    } else if (entry.photoPath && !keepPhoto) {
      payload.photoPath = null;
    }
    try {
      await update.mutateAsync({ projectId: project.id, entryId: entry.id, data: payload });
      onSaved();
      return true;
    } catch {
      return fail('Your changes didn’t save this time. Please try again.');
    } finally {
      setSaving(false);
    }
  };
  useNoteEditor(entry.id, { dirty, save: persist });

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (await persist()) onClose();
  };

  return <form className="progress-form note-edit-form loom-card" onSubmit={save} noValidate data-testid={`form-edit-note-${entry.id}`}>
    <div className="field-block"><label htmlFor={`edit-note-${entry.id}`}>What did you work on?</label><textarea id={`edit-note-${entry.id}`} rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} data-testid="input-edit-note"/></div>
    <DateWheelField id={`edit-note-date-${entry.id}`} label="Date" value={day} precision={precision} onValueChange={setDay} onPrecisionChange={setPrecision} testId="input-edit-note-date"/>
    <div className="field-block progress-photo-field">
      <label htmlFor={`edit-note-photo-${entry.id}`}>{entry.photoPath && keepPhoto && !newPhoto ? 'Photo' : 'Add a progress photo (optional)'}</label>
      {newPhotoPreview
        ? <div className="progress-photo-preview"><img src={newPhotoPreview} alt="New progress photo preview"/><button type="button" className="button button-quiet" onClick={() => setNewPhoto(null)}>Remove photo</button></div>
        : entry.photoPath && keepPhoto
          ? <div className="progress-photo-preview"><img src={`/api/projects/${project.id}/progress/${entry.id}/photo`} alt="Current progress photo"/><button type="button" className="button button-quiet" onClick={() => setKeepPhoto(false)} data-testid="button-edit-note-remove-photo">Remove photo <X size={14}/></button></div>
          : null}
      <input id={`edit-note-photo-${entry.id}`} type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setNewPhoto(event.target.files?.[0] ?? null)} data-testid="input-edit-note-photo"/>
    </div>
    <div className="progress-form-row"><ProgressAmountField project={project} value={amount} onChange={setAmount}/></div>
    {error && <p className="mutation-error" role="alert">{error}</p>}
    <div className="form-actions"><button type="button" className="button button-quiet" onClick={onClose} data-testid="button-cancel-edit-note">Cancel</button><button type="submit" className="button button-primary" disabled={saving} data-testid="button-save-edit-note">{saving ? 'Saving…' : 'Save changes'} <ArrowRight size={15}/></button></div>
  </form>;
}

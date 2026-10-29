import { useState } from 'react';
import { ArrowRight, Feather, Plus, X } from 'lucide-react';
import { useAddSewingProjectEntry, useDeleteSewingProjectEntry, useUpdateSewingProjectEntry } from '@workspace/api-client-react';
import type { SaveSewingProjectEntry, SewingProject, SewingProjectEntry } from '@workspace/api-client-react';
import { DateWheelField } from '@/components/date-wheel-field';
import { NEW_NOTE, NoteEditingProvider, useNoteEditing, useNoteEditor } from '@/components/note-editing';
import { NoteMenu } from '@/components/progress-entry';

const pad2 = (value: number) => String(value).padStart(2, '0');
const localDay = (date: Date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
const tooLong = 'Keep your note under 2,000 characters.';

// A sewing project's dated notes, newest first, with add, edit and delete.
export function SewingJournal({ project, onChanged }: { project: SewingProject; onChanged: () => void }) {
  return <NoteEditingProvider><Journal project={project} onChanged={onChanged}/></NoteEditingProvider>;
}

function Journal({ project, onChanged }: { project: SewingProject; onChanged: () => void }) {
  const notes = useNoteEditing();
  const adding = notes.openId === NEW_NOTE;
  return <section className="sewing-detail-fabric sewing-journal">
    <div className="progress-log-heading"><div><h2 className="serif">Notes journal</h2></div><button className="button button-primary button-small" onClick={() => { if (adding) notes.close(); else void notes.open(NEW_NOTE); }} data-testid="button-add-sewing-note">{adding ? <X size={15}/> : <Plus size={15}/>} {adding ? 'Close note' : 'Add a note'}</button></div>
    {adding && <NewNoteForm project={project} onSaved={onChanged} onClose={notes.close}/>}
    {project.entries.length
      ? <div className="timeline">{project.entries.map((entry) => <NoteCard key={entry.id} project={project} entry={entry} onChanged={onChanged}/>)}</div>
      : !adding && <div className="journal-empty"><h3>No notes yet</h3><p>Jot down what you did each time you sew.</p><button className="button button-outline" onClick={() => { void notes.open(NEW_NOTE); }} data-testid="button-first-sewing-note">Add your first note <ArrowRight size={15}/></button></div>}
  </section>;
}

function NewNoteForm({ project, onSaved, onClose }: { project: SewingProject; onSaved: () => void; onClose: () => void }) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const add = useAddSewingProjectEntry();
  const persist = async (): Promise<boolean> => {
    if (!text.trim()) { setError('Write a note first.'); return false; }
    if (text.length > 2000) { setError(tooLong); return false; }
    setError('');
    try {
      await add.mutateAsync({ sewingProjectId: project.id, data: { notes: text.trim() } });
    } catch {
      setError('Your note didn’t save this time. Please try again.');
      return false;
    }
    setText('');
    onSaved();
    return true;
  };
  useNoteEditor(NEW_NOTE, { dirty: () => Boolean(text.trim()), save: persist });
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (await persist()) onClose();
  };
  return <form className="progress-form loom-card" onSubmit={submit} noValidate data-testid="form-sewing-note">
    <div className="field-block"><label htmlFor="sewing-note">What did you work on?</label><textarea id="sewing-note" rows={3} placeholder="Cut the pieces, sewed the darts, tried on for fit…" value={text} onChange={(event) => setText(event.target.value)} data-testid="input-sewing-note"/></div>
    {error && <p className="mutation-error" role="alert">{error}</p>}
    <div className="form-actions"><button type="button" className="button button-quiet" onClick={onClose} data-testid="button-cancel-sewing-note">Cancel</button><button type="submit" className="button button-primary" disabled={add.isPending} data-testid="button-save-sewing-note">{add.isPending ? 'Saving note…' : 'Save note'} <ArrowRight size={15}/></button></div>
  </form>;
}

function NoteCard({ project, entry, onChanged }: { project: SewingProject; entry: SewingProjectEntry; onChanged: () => void }) {
  const notes = useNoteEditing();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const remove = useDeleteSewingProjectEntry();
  const deleteNote = () => remove.mutate({ sewingProjectId: project.id, entryId: entry.id }, { onSuccess: onChanged });
  return <article className="timeline-entry" data-testid={`entry-sewing-note-${entry.id}`}>
    <span className="timeline-marker"><Feather size={13}/></span>
    {notes.openId === entry.id
      ? <EditNoteForm project={project} entry={entry} onSaved={onChanged} onClose={notes.close}/>
      : <div className="timeline-card loom-card">
        <div className="timeline-entry-top">
          <time>{new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(entry.createdAt))}</time>
          <NoteMenu entryId={entry.id} onEdit={() => { setConfirmDelete(false); void notes.open(entry.id); }} onDelete={() => setConfirmDelete(true)}/>
        </div>
        {confirmDelete && <div className="confirm-banner note-confirm"><div><b>Delete this note?</b><span>This can’t be undone.</span></div><button type="button" className="button button-quiet" onClick={() => setConfirmDelete(false)} data-testid={`button-cancel-delete-note-${entry.id}`}>Cancel</button><button type="button" className="button button-danger" onClick={deleteNote} disabled={remove.isPending} data-testid={`button-confirm-delete-note-${entry.id}`}>{remove.isPending ? 'Deleting…' : 'Delete note'}</button></div>}
        {remove.isError && <p className="mutation-error">We couldn’t delete that note. Please try again.</p>}
        <p>{entry.notes}</p>
      </div>}
  </article>;
}

function EditNoteForm({ project, entry, onSaved, onClose }: { project: SewingProject; entry: SewingProjectEntry; onSaved: () => void; onClose: () => void }) {
  const written = new Date(entry.createdAt);
  const [text, setText] = useState(entry.notes);
  const [day, setDay] = useState(localDay(written));
  const [precision, setPrecision] = useState<'day' | 'month'>('day');
  const [error, setError] = useState('');
  const update = useUpdateSewingProjectEntry();
  const persist = async (): Promise<boolean> => {
    const fail = (message: string) => { setError(message); return false; };
    if (!text.trim()) return fail('Write a note first.');
    if (text.length > 2000) return fail(tooLong);
    if (!day || precision !== 'day') return fail('Choose the day you wrote this note.');
    if (day > localDay(new Date())) return fail('The date can’t be in the future.');
    const data: SaveSewingProjectEntry = { notes: text.trim() };
    if (day !== localDay(written)) {
      // Keep the time of day so notes written on the same day stay in order.
      const [year, month, date] = day.split('-').map(Number);
      const moved = new Date(written);
      moved.setFullYear(year, month - 1, date);
      data.createdAt = moved.toISOString();
    }
    setError('');
    try {
      await update.mutateAsync({ sewingProjectId: project.id, entryId: entry.id, data });
    } catch {
      return fail('Your changes didn’t save this time. Please try again.');
    }
    onSaved();
    return true;
  };
  useNoteEditor(entry.id, { dirty: () => text !== entry.notes || day !== localDay(written) || precision !== 'day', save: persist });
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (await persist()) onClose();
  };
  return <form className="progress-form note-edit-form loom-card" onSubmit={submit} noValidate data-testid={`form-edit-note-${entry.id}`}>
    <div className="field-block"><label htmlFor={`edit-sewing-note-${entry.id}`}>What did you work on?</label><textarea id={`edit-sewing-note-${entry.id}`} rows={3} value={text} onChange={(event) => setText(event.target.value)} data-testid="input-edit-note"/></div>
    <DateWheelField id={`edit-sewing-note-date-${entry.id}`} label="Date" value={day} precision={precision} onValueChange={setDay} onPrecisionChange={setPrecision} testId="input-edit-note-date"/>
    {error && <p className="mutation-error" role="alert">{error}</p>}
    <div className="form-actions"><button type="button" className="button button-quiet" onClick={onClose} data-testid="button-cancel-edit-note">Cancel</button><button type="submit" className="button button-primary" disabled={update.isPending} data-testid="button-save-edit-note">{update.isPending ? 'Saving…' : 'Save changes'} <ArrowRight size={15}/></button></div>
  </form>;
}

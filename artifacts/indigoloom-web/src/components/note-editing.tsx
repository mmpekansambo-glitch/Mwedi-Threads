import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { showSignpost } from '@/components/signpost';

// The id used for the new-note form.
export const NEW_NOTE = 'new';

export type NoteEditor = {
  dirty: () => boolean;
  // Saves the changes and says whether they went through. A note that can't
  // be saved shows its own error and stays open.
  save: () => Promise<boolean>;
};

type NoteEditing = {
  openId: string | null;
  open: (id: string) => Promise<boolean>;
  close: () => void;
  register: (id: string, editor: NoteEditor) => () => void;
};

const NoteEditingContext = createContext<NoteEditing | null>(null);

// Only one note on a page is open for editing at a time. Opening another note
// (or a new one) saves the open note's changes first, then closes it.
export function NoteEditingProvider({ children }: { children: React.ReactNode }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const openRef = useRef<string | null>(null);
  const editors = useRef(new Map<string, NoteEditor>());
  const saving = useRef(false);

  const show = useCallback((id: string | null) => {
    openRef.current = id;
    setOpenId(id);
  }, []);

  const open = useCallback(async (id: string) => {
    const current = openRef.current;
    if (current === id) return true;
    const editor = current ? editors.current.get(current) : undefined;
    if (editor?.dirty()) {
      if (saving.current) return false;
      saving.current = true;
      const saved = await editor.save().catch(() => false).finally(() => { saving.current = false; });
      if (!saved) return false;
      showSignpost('Changes saved');
    }
    show(id);
    return true;
  }, [show]);

  const close = useCallback(() => show(null), [show]);

  const register = useCallback((id: string, editor: NoteEditor) => {
    editors.current.set(id, editor);
    return () => {
      if (editors.current.get(id) === editor) editors.current.delete(id);
    };
  }, []);

  const value = useMemo(() => ({ openId, open, close, register }), [openId, open, close, register]);
  return <NoteEditingContext.Provider value={value}>{children}</NoteEditingContext.Provider>;
}

export function useNoteEditing(): NoteEditing {
  const value = useContext(NoteEditingContext);
  if (!value) throw new Error('useNoteEditing needs a NoteEditingProvider.');
  return value;
}

// Lets the page save this editor's changes when another note is opened.
export function useNoteEditor(id: string, editor: NoteEditor) {
  const { register } = useNoteEditing();
  const latest = useRef(editor);
  latest.current = editor;
  useEffect(() => register(id, {
    dirty: () => latest.current.dirty(),
    save: () => latest.current.save(),
  }), [id, register]);
}

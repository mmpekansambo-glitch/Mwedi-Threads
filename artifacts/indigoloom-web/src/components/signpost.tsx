import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

type Signpost = { id: number; text: string; actionLabel?: string; onAction?: () => void };

let current: Signpost | null = null;
let nextId = 1;
const listeners = new Set<(signpost: Signpost | null) => void>();

function publish(signpost: Signpost | null) {
  current = signpost;
  listeners.forEach((listener) => listener(signpost));
}

// A short, calm note saying what the app just did (and where to find it),
// with an optional action such as Undo. It stays across page changes and
// fades after a few seconds.
export function showSignpost(text: string, action?: { label: string; onAction: () => void }) {
  publish({ id: nextId++, text, actionLabel: action?.label, onAction: action?.onAction });
}

export function SignpostHost() {
  const [signpost, setSignpost] = useState<Signpost | null>(current);
  useEffect(() => {
    listeners.add(setSignpost);
    return () => { listeners.delete(setSignpost); };
  }, []);
  useEffect(() => {
    if (!signpost) return;
    const timer = setTimeout(() => { if (current?.id === signpost.id) publish(null); }, 8000);
    return () => clearTimeout(timer);
  }, [signpost]);
  if (!signpost) return null;
  return <div className="signpost" role="status" data-testid="signpost">
    <span>{signpost.text}</span>
    {signpost.actionLabel && <button type="button" className="signpost-action" onClick={() => { signpost.onAction?.(); publish(null); }} data-testid="button-signpost-action">{signpost.actionLabel}</button>}
    <button type="button" className="signpost-close" aria-label="Dismiss" onClick={() => publish(null)}><X size={15}/></button>
  </div>;
}

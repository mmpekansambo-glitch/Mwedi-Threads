import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Minus, Plus, RotateCcw, Undo2 } from 'lucide-react';
import { getGetProjectQueryKey, setProjectCounter } from '@workspace/api-client-react';
import type { ProjectDetail } from '@workspace/api-client-react';

const SAVE_DELAY_MS = 400;

function isTyping(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(target.tagName);
}

// A plain counter saved with the project. It never changes progress.
export function ProjectCounter({ projectId, initial }: { projectId: string; initial: number }) {
  const client = useQueryClient();
  const [count, setCount] = useState(initial);
  const [history, setHistory] = useState<number[]>([]);
  const [saveError, setSaveError] = useState(false);
  const pending = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const save = () => {
    clearTimeout(timer.current);
    const value = pending.current;
    if (value === null) return;
    pending.current = null;
    setProjectCounter(projectId, { count: value })
      .then(() => {
        setSaveError(false);
        client.setQueryData<ProjectDetail>(getGetProjectQueryKey(projectId), (old) => (old ? { ...old, counter: value } : old));
      })
      .catch(() => setSaveError(true));
  };

  const change = (next: number) => {
    const value = Math.max(0, next);
    if (value === count) return;
    setHistory((past) => [...past.slice(-49), count]);
    setCount(value);
    pending.current = value;
    clearTimeout(timer.current);
    timer.current = setTimeout(save, SAVE_DELAY_MS);
  };

  const undo = () => {
    const previous = history[history.length - 1];
    if (previous === undefined) return;
    setHistory((past) => past.slice(0, -1));
    setCount(previous);
    pending.current = previous;
    clearTimeout(timer.current);
    timer.current = setTimeout(save, SAVE_DELAY_MS);
  };

  // Save whatever is waiting when the page closes.
  useEffect(() => save, []);

  const latest = useRef(change);
  latest.current = change;
  const current = useRef(count);
  current.current = count;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || event.repeat || isTyping(event.target)) return;
      event.preventDefault();
      latest.current(current.current + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return <article className="counter-card loom-card" data-testid="card-project-counter">
    <div className="counter-count">
      <h2 className="serif">Counter</h2>
      <strong className="serif" aria-live="polite" data-testid="text-counter">{count}</strong>
    </div>
    <div className="counter-controls">
      <div className="counter-buttons">
        <button type="button" className="counter-minus" aria-label="Take one off" onClick={() => change(count - 1)} disabled={count === 0} data-testid="button-counter-minus"><Minus size={22}/></button>
        <button type="button" className="counter-plus" aria-label="Add one" onClick={() => change(count + 1)} data-testid="button-counter-plus"><Plus size={38}/></button>
      </div>
      <div className="counter-links">
        <button type="button" className="button button-quiet button-small" onClick={undo} disabled={history.length === 0} data-testid="button-counter-undo"><Undo2 size={14}/> Undo</button>
        <button type="button" className="button button-quiet button-small" onClick={() => change(0)} disabled={count === 0} data-testid="button-counter-reset"><RotateCcw size={14}/> Reset</button>
        <span className="counter-hint"><kbd>Space</kbd> adds one</span>
      </div>
      {saveError && <p className="mutation-error" role="alert">We couldn’t save the count. It will try again on your next tap.</p>}
    </div>
  </article>;
}

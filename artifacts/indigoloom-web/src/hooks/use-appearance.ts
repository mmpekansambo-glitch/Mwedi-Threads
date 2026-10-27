import { useEffect, useLayoutEffect, useState } from 'react';

// Match computer, Light or Dark, kept in this browser only.
export type AppearanceChoice = 'system' | 'light' | 'dark';
const storageKey = 'mwedi.appearance';
const darkQuery = '(prefers-color-scheme: dark)';

function savedChoice(): AppearanceChoice {
  try {
    const saved = localStorage.getItem(storageKey);
    return saved === 'light' || saved === 'dark' ? saved : 'system';
  } catch {
    return 'system';
  }
}

function systemIsDark() {
  return typeof window.matchMedia === 'function' && window.matchMedia(darkQuery).matches;
}

// Used by the signed-in app only: it puts .dark on <html> while it's shown
// and takes it off again on the way out, so the pages before sign-in stay light.
export function useAppearance() {
  const [choice, setChoice] = useState<AppearanceChoice>(savedChoice);
  const [systemDark, setSystemDark] = useState(systemIsDark);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia(darkQuery);
    const update = () => setSystemDark(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  const dark = choice === 'dark' || (choice === 'system' && systemDark);
  // A layout effect, so moving between pages doesn't flash light for a frame.
  useLayoutEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    return () => document.documentElement.classList.remove('dark');
  }, [dark]);

  const choose = (next: AppearanceChoice) => {
    setChoice(next);
    try {
      localStorage.setItem(storageKey, next);
    } catch {
      // Storage blocked: the choice lasts until the page is closed.
    }
  };
  return { choice, choose };
}

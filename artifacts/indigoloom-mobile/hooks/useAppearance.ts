import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Appearance, useColorScheme } from 'react-native';

// Match phone, Light or Dark, kept on this device only. On a phone, Light and
// Dark also override the system setting for the app, so native parts like
// the status bar and date pickers follow; the web build has no such override.
export type AppearanceChoice = 'system' | 'light' | 'dark';
const storageKey = 'mwedi.appearance';
let current: AppearanceChoice = 'system';
const listeners = new Set<(choice: AppearanceChoice) => void>();

function apply(choice: AppearanceChoice) {
  current = choice;
  if (typeof Appearance.setColorScheme === 'function') {
    Appearance.setColorScheme(choice === 'system' ? 'unspecified' : choice);
  }
  listeners.forEach((listener) => listener(choice));
}

// Runs once before the first screen shows, so a saved choice doesn't flash.
export async function loadAppearance() {
  try {
    const saved = await AsyncStorage.getItem(storageKey);
    if (saved === 'light' || saved === 'dark') apply(saved);
  } catch {
    // Nothing saved or storage unavailable: follow the phone.
  }
}

export function useAppearance() {
  const [choice, setChoice] = useState(current);
  useEffect(() => {
    listeners.add(setChoice);
    return () => { listeners.delete(setChoice); };
  }, []);
  const choose = (next: AppearanceChoice) => {
    apply(next);
    void AsyncStorage.setItem(storageKey, next).catch(() => undefined);
  };
  return { choice, choose };
}

// The scheme the app shows: the maker's choice, or the phone's setting.
export function useScheme(): 'light' | 'dark' {
  const system = useColorScheme();
  const { choice } = useAppearance();
  if (choice !== 'system') return choice;
  return system === 'dark' ? 'dark' : 'light';
}

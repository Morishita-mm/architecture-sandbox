import { useSyncExternalStore } from 'react';

export type ThemeMode = 'system' | 'light' | 'dark';
const key = 'architecture-sandbox-theme';
let mode: ThemeMode = 'system';
const listeners = new Set<() => void>();

function readMode(): ThemeMode {
  try {
    const saved = localStorage.getItem(key);
    return saved === 'light' || saved === 'dark' ? saved : 'system';
  } catch { return 'system'; }
}

function applyMode(next: ThemeMode) {
  mode = next;
  document.documentElement.dataset.theme = mode;
  // Keep color-scheme in CSS so its compiled light-dark fallback also follows
  // explicit choices. System mode continues to track live OS changes.
  listeners.forEach(listener => listener());
}

export function initializeTheme() {
  applyMode(readMode());
  window.addEventListener('storage', event => {
    if (event.key === key || event.key === null) applyMode(readMode());
  });
}

export function setThemeMode(next: 'light' | 'dark') {
  try {
    localStorage.setItem(key, next);
  } catch { /* The current page can still change themes when storage is unavailable. */ }
  applyMode(next);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  system.addEventListener('change', listener);
  return () => {
    listeners.delete(listener);
    system.removeEventListener('change', listener);
  };
}

export function useThemeMode() {
  return useSyncExternalStore(subscribe, () => mode === 'system'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    : mode, () => 'light' as const);
}

import { useSyncExternalStore } from 'react';
import { useColorScheme } from 'react-native';
import Storage from 'expo-sqlite/kv-store';
import { parseAppearancePreference, resolveAppearance, type AppearancePreference } from './appearance-model';

const KEY = 'evrida.appearance';
const listeners = new Set<() => void>();
let current: AppearancePreference = 'system';
try { current = parseAppearancePreference(Storage.getItemSync(KEY)); } catch { /* Follow the system until storage becomes available. */ }
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export function useAppearancePreference(): AppearancePreference {
  return useSyncExternalStore(subscribe, () => current, () => 'system');
}
export function useAppColorScheme(): 'light' | 'dark' {
  const system = useColorScheme();
  return resolveAppearance(useAppearancePreference(), system);
}
export function setAppearancePreference(next: AppearancePreference): void {
  if (current === next) return;
  // Only update the UI after the preference is safely persisted.
  if (next === 'system') Storage.removeItemSync(KEY); else Storage.setItemSync(KEY, next);
  current = next;
  listeners.forEach((listener) => listener());
}

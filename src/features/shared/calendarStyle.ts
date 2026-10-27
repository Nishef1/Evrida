import { useSyncExternalStore } from 'react';
import Storage from 'expo-sqlite/kv-store';
import type { CalendarStyle } from '../../domain/jalali';

const KEY = 'evrida.calendar.style';
const listeners = new Set<() => void>();
let current: CalendarStyle = 'gregorian';
/** A per-device display preference (like the weekly reminder); it is not part of the backed-up data. */
try { if (Storage.getItemSync(KEY) === 'jalali') current = 'jalali'; } catch { /* default to Gregorian */ }

export const getCalendarStyle = (): CalendarStyle => current;

export function setCalendarStyle(next: CalendarStyle): void {
  if (next === current) return;
  current = next;
  try { if (next === 'jalali') Storage.setItemSync(KEY, 'jalali'); else Storage.removeItemSync(KEY); } catch { /* still applies for this session */ }
  listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
/** Re-renders the caller when the person switches calendars. */
export const useCalendarStyle = (): CalendarStyle => useSyncExternalStore(subscribe, getCalendarStyle, getCalendarStyle);

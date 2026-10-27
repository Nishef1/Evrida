import { useMemo } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { serializeDatabase } from './serialized';

/** Share the same guarded native handle across every Evrida screen and Focus. */
export function useEvridaDatabase() {
  const raw = useSQLiteContext();
  return useMemo(() => serializeDatabase(raw), [raw]);
}

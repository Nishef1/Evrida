import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { SQLiteDatabase } from 'expo-sqlite';
import { openEvridaDatabase } from './connection';

const DatabaseContext = createContext<SQLiteDatabase | null>(null);

/** Provides the process-wide guarded handle. Startup errors reach the router ErrorBoundary. */
export function EvridaDatabaseProvider({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const [database, setDatabase] = useState<SQLiteDatabase | null>(null);
  const [failure, setFailure] = useState<unknown>(null);
  useEffect(() => {
    let mounted = true;
    openEvridaDatabase().then(
      (opened) => { if (mounted) setDatabase(opened); },
      (error) => { if (mounted) setFailure(error ?? new Error('Evrida could not open its database.')); },
    );
    return () => { mounted = false; };
  }, []);
  if (failure) throw failure;
  if (!database) return <>{fallback}</>;
  return <DatabaseContext.Provider value={database}>{children}</DatabaseContext.Provider>;
}

/** Share the same guarded native handle across every Evrida screen and Focus. */
export function useEvridaDatabase(): SQLiteDatabase {
  const database = useContext(DatabaseContext);
  if (!database) throw new Error('useEvridaDatabase must be used inside EvridaDatabaseProvider.');
  return database;
}

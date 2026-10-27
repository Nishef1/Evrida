import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import { migrateDatabase } from './database';
import { serializeDatabase } from './serialized';

const DATABASE_NAME = 'evrida.db';
let opening: Promise<SQLiteDatabase> | null = null;

/**
 * One native handle for the life of the process, never closed by React.
 *
 * An Android font-scale change relaunches MainActivity and restarts the React
 * surface. A provider that closes its connection on unmount frees the native
 * handle while Focus/dock queries are still running on SDK 57's coroutine
 * threads; the reproduced SIGSEGVs (issue #2) were statement operations on that
 * freed handle. Keeping the handle in module scope lets in-flight work finish
 * and lets the remounted tree reuse the same connection.
 *
 * A failed startup is not cached, so Retry can attempt a fresh open.
 */
export function openEvridaDatabase(): Promise<SQLiteDatabase> {
  opening ??= (async () => {
    const raw = await openDatabaseAsync(DATABASE_NAME);
    try { await migrateDatabase(raw); }
    catch (error) { await raw.closeAsync().catch(() => {}); throw error; }
    return serializeDatabase(raw);
  })().catch((error) => { opening = null; throw error; });
  return opening;
}

import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import { migrateDatabase } from './database';
import { serializeDatabase } from './serialized';

const DATABASE_NAME = 'evrida.db';
let opening: Promise<SQLiteDatabase> | null = null;

/**
 * One native handle for the life of the process, never closed by React.
 *
 * Android font-scale/theme changes can recreate the React surface. An older
 * Expo SQLite configuration reproduced native statement crashes when a provider
 * closed its handle while Focus/dock work was still in flight. SDK 58 emulator
 * stress has not reproduced that crash, but issue #2 remains open pending the
 * documented native acceptance matrix. Keeping the handle in module scope is
 * defense in depth: remounted screens reuse it and React never closes it.
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

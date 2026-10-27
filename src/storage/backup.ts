import type { SQLiteDatabase } from 'expo-sqlite';
import { BACKUP_COLUMNS, parseBackup, type Backup, type BackupRow, type BackupTable } from '../domain/backup';

export async function exportBackup(db: SQLiteDatabase): Promise<Backup> {
  const tables = {} as Backup['tables'];
  await db.withExclusiveTransactionAsync(async (tx) => {
    for (const name of Object.keys(BACKUP_COLUMNS) as BackupTable[]) {
      tables[name] = await tx.getAllAsync<BackupRow>(`SELECT ${BACKUP_COLUMNS[name].join(', ')} FROM ${name}`);
    }
  });
  return parseBackup(JSON.stringify({ format: 'evrida-backup', version: 7, schemaVersion: 13,
    createdAt: new Date().toISOString(), tables }));
}

export interface BackupMergePreview {
  incoming: number;
  missing: number;
  identical: number;
  different: number;
  differentTables: BackupTable[];
}
function rowIdentity(table: BackupTable, row: BackupRow): string {
  return table === 'board_goals' ? JSON.stringify([row.board_id, row.goal_id])
    : String(table === 'time_budgets' ? row.goal_id : row.id);
}
function sameRow(table: BackupTable, a: BackupRow, b: BackupRow): boolean {
  return BACKUP_COLUMNS[table].every((column) => a[column] === b[column]);
}
/** Read a consistent local snapshot; an ID collision does not mean equal content. */
async function countMerge(
  db: Pick<SQLiteDatabase, 'getAllAsync'>, backup: Backup,
): Promise<BackupMergePreview> {
  const summary: BackupMergePreview = { incoming: 0, missing: 0, identical: 0,
    different: 0, differentTables: [] };
  for (const table of Object.keys(BACKUP_COLUMNS) as BackupTable[]) {
    const incoming = backup.tables[table];
    summary.incoming += incoming.length;
    if (!incoming.length) continue;
    const columns = BACKUP_COLUMNS[table];
    // Bound memory and SQL variables: inspect only imported IDs, rather than
    // loading every local goal/Timebox for a small incoming backup.
    for (let offset = 0; offset < incoming.length; offset += 150) {
      const batch = incoming.slice(offset, offset + 150);
      const clause = table === 'board_goals'
        ? batch.map(() => '(board_id = ? AND goal_id = ?)').join(' OR ')
        : `${table === 'time_budgets' ? 'goal_id' : 'id'} IN (${batch.map(() => '?').join(', ')})`;
      const params = table === 'board_goals'
        ? batch.flatMap((row) => [row.board_id, row.goal_id])
        : batch.map((row) => table === 'time_budgets' ? row.goal_id : row.id);
      const saved = await db.getAllAsync<BackupRow>(
        `SELECT ${columns.join(', ')} FROM ${table} WHERE ${clause}`, params);
      const existing = new Map(saved.map((row) => [rowIdentity(table, row), row]));
      for (const row of batch) {
        const local = existing.get(rowIdentity(table, row));
        if (!local) summary.missing++;
        else if (sameRow(table, local, row)) summary.identical++;
        else {
          summary.different++;
          if (!summary.differentTables.includes(table)) summary.differentTables.push(table);
        }
      }
    }
  }
  return summary;
}
export async function previewBackupMerge(db: SQLiteDatabase, text: string): Promise<BackupMergePreview> {
  const backup = parseBackup(text);
  let result: BackupMergePreview | null = null;
  await db.withExclusiveTransactionAsync(async (tx) => {
    result = await countMerge(tx, backup);
  });
  return result!;
}

/** Add missing records atomically; existing IDs always keep their current local values. */
export async function restoreBackup(db: SQLiteDatabase, text: string,
  expected?: BackupMergePreview): Promise<number> {
  const backup = parseBackup(text);
  let added = 0;
  await db.withExclusiveTransactionAsync(async (tx) => {
    if (expected) {
      const actual = await countMerge(tx, backup);
      if (actual.incoming !== expected.incoming || actual.missing !== expected.missing ||
        actual.identical !== expected.identical || actual.different !== expected.different ||
        actual.differentTables.join('|') !== expected.differentTables.join('|')) {
        throw new Error('Local data changed after the restore preview. Preview the backup again.');
      }
    }
    await tx.execAsync('PRAGMA defer_foreign_keys = ON;');
    for (const name of Object.keys(BACKUP_COLUMNS) as BackupTable[]) {
      const columns = BACKUP_COLUMNS[name];
      for (const row of backup.tables[name]) {
        const where = name === 'board_goals' ? 'board_id = ? AND goal_id = ?' :
          name === 'time_budgets' ? 'goal_id = ?' : 'id = ?';
        const values = name === 'board_goals' ? [row.board_id, row.goal_id] :
          name === 'time_budgets' ? [row.goal_id] : [row.id];
        if (await tx.getFirstAsync(`SELECT 1 FROM ${name} WHERE ${where}`, values)) continue;
        // Do not use OR IGNORE: it would silently skip corrupt/conflicting records.
        const result = await tx.runAsync(`INSERT INTO ${name} (${columns.join(', ')})
          VALUES (${columns.map(() => '?').join(', ')})`, columns.map((key) => row[key]));
        added += result.changes;
      }
    }
    const broken = await tx.getAllAsync('PRAGMA foreign_key_check');
    if (broken.length) throw new Error('Backup relationships could not be restored. Nothing was changed.');
    // Validate the merged graph as well: individually valid backups may create a cycle through local IDs.
    const tables = {} as Backup['tables'];
    for (const name of Object.keys(BACKUP_COLUMNS) as BackupTable[]) {
      tables[name] = await tx.getAllAsync<BackupRow>(`SELECT ${BACKUP_COLUMNS[name].join(', ')} FROM ${name}`);
    }
    parseBackup(JSON.stringify({ ...backup, tables }));
    // Importing new reservations/goals invalidates any old Recovery Undo promise.
    // Keep the invalidation inside the same atomic merge and preserve it for no-op imports.
    if (added > 0) await tx.runAsync('DELETE FROM replan_checkpoint WHERE id = 1');
  });
  return added;
}

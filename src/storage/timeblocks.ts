import { randomUUID } from 'expo-crypto';
import { closeFocusInTransaction } from './focus';
import type { SQLiteDatabase } from 'expo-sqlite';
import type { Horizon } from '../domain/horizons';
import { localDayBounds, timeRangeFromInput, type BlockInput, type BlockKind, type TimeBlock } from '../domain/timeblocks';

interface TimeBlockRow {
  id: string;
  goal_id: string;
  goal_title: string;
  goal_completed: number;
  goal_horizon: Horizon;
  start_at: string;
  end_at: string;
  kind: BlockKind;
  intention: string;
  flexible: number;
  updated_at: string;
}
const SELECT = `SELECT tb.*, g.title AS goal_title, g.completed AS goal_completed, g.horizon AS goal_horizon
  FROM time_blocks tb JOIN goals g ON g.id = tb.goal_id
  WHERE g.archived_at IS NULL`;
function map(row: TimeBlockRow): TimeBlock {
  return {
    id: row.id, goalId: row.goal_id, goalTitle: row.goal_title,
    goalCompleted: row.goal_completed === 1, goalHorizon: row.goal_horizon, startAt: row.start_at, endAt: row.end_at,
    kind: row.kind, intention: row.intention, flexible: row.flexible === 1,
    updatedAt: row.updated_at,
  };
}
export async function listRangeBlocks(db: SQLiteDatabase, from: string, to: string): Promise<TimeBlock[]> {
  const rows = await db.getAllAsync<TimeBlockRow>(
    `${SELECT} AND tb.start_at < ? AND tb.end_at > ?
      ORDER BY tb.start_at ASC, tb.end_at ASC, tb.id ASC`, [to, from],
  );
  return rows.map(map);
}
export async function listDayBlocks(db: SQLiteDatabase, date: Date): Promise<TimeBlock[]> {
  const { from, to } = localDayBounds(date);
  return listRangeBlocks(db, from, to);
}
export async function listGoalBlocks(db: SQLiteDatabase, goalId: string): Promise<TimeBlock[]> {
  const rows = await db.getAllAsync<TimeBlockRow>(
    `${SELECT} AND tb.goal_id = ? ORDER BY tb.start_at ASC, tb.id ASC`, [goalId],
  );
  return rows.map(map);
}
export async function getBlock(db: SQLiteDatabase, id: string): Promise<TimeBlock | null> {
  const row = await db.getFirstAsync<TimeBlockRow>(`${SELECT} AND tb.id = ?`, [id]);
  return row ? map(row) : null;
}
export async function saveBlock(db: SQLiteDatabase, input: BlockInput, id?: string,
  expected?: TimeBlock): Promise<string> {
  const { startAt, endAt } = timeRangeFromInput(input);
  if (input.kind !== 'block' && input.kind !== 'box') throw new Error('Invalid time planning mode.');
  const newId = id ?? randomUUID();
  await db.withExclusiveTransactionAsync(async (tx) => {
    const goal = await tx.getFirstAsync<{ id: string }>(
      'SELECT id FROM goals WHERE id = ? AND completed = 0 AND archived_at IS NULL', [input.goalId],
    );
    if (!goal) throw new Error('Select an open goal.');
    if (id) {
      const existing = await tx.getFirstAsync<{
        goal_id: string; start_at: string; end_at: string; kind: BlockKind;
        flexible: number; intention: string; updated_at: string; completed: number;
      }>(`SELECT tb.goal_id, tb.start_at, tb.end_at, tb.kind, tb.flexible,
        tb.intention, tb.updated_at, g.completed FROM time_blocks tb
        JOIN goals g ON g.id = tb.goal_id WHERE tb.id = ?`, [id]);
      if (!existing) throw new Error('The scheduled block no longer exists.');
      if (existing.completed === 1) throw new Error('Reopen the completed goal before rescheduling its time.');
      if (expected && (expected.id !== id || existing.goal_id !== expected.goalId ||
        existing.start_at !== expected.startAt || existing.end_at !== expected.endAt ||
        existing.kind !== expected.kind || existing.intention !== expected.intention ||
        (existing.flexible === 1) !== expected.flexible ||
        (expected.updatedAt && existing.updated_at !== expected.updatedAt))) {
        throw new Error('This Timebox changed since you opened it. Close and reopen to review the latest version.');
      }
      const focusing = await tx.getFirstAsync<{ block_id: string }>(
        'SELECT block_id FROM focus_session WHERE id = 1 AND block_id = ?', [id],
      );
      if (focusing) throw new Error('End the active focus session before editing this Timebox.');
      const now = new Date().toISOString();
      await tx.runAsync(
        `UPDATE time_blocks SET goal_id = ?, start_at = ?, end_at = ?, kind = ?, intention = ?, flexible = ?, updated_at = ?
          WHERE id = ?`,
        [input.goalId, startAt, endAt, input.kind, input.intention.trim(), input.flexible ? 1 : 0, now, id],
      );
    } else {
      const now = new Date().toISOString();
      await tx.runAsync(
        `INSERT INTO time_blocks (id, goal_id, start_at, end_at, kind, intention, flexible, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [newId, input.goalId, startAt, endAt, input.kind, input.intention.trim(), input.flexible ? 1 : 0, now, now],
      );
    }
    // A separate manual calendar mutation makes a previous Ripple Undo unsafe.
    await tx.runAsync('DELETE FROM replan_checkpoint WHERE id = 1');
  });
  return newId;
}
export async function removeBlock(db: SQLiteDatabase, blockId: string): Promise<void> {
  await db.withExclusiveTransactionAsync(async (tx) => {
    const focusing = await tx.getFirstAsync<{ block_id: string }>(
      'SELECT block_id FROM focus_session WHERE id = 1 AND block_id = ?', [blockId],
    );
    if (focusing) await closeFocusInTransaction(tx, Date.now(), 'stopped');
    await tx.runAsync('DELETE FROM time_blocks WHERE id = ?', [blockId]);
    await tx.runAsync('DELETE FROM replan_checkpoint WHERE id = 1');
  });
}

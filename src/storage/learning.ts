import { randomUUID } from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';
import { isDateKey } from '../domain/finance';
import { MAX_SCORE, MIN_SCORE, validateCheckin, type LearnCheckin, type LearnTopic } from '../domain/learning';

export interface LearningSnapshot { topics: LearnTopic[]; checkins: LearnCheckin[] }
type Row = Record<string, any>;
type Reader = Pick<SQLiteDatabase, 'getAllAsync'>;

const now = () => new Date().toISOString();
const clean = (value: string, max: number, what: string): string => {
  const v = value.trim().replace(/\s+/g, ' ');
  if (!v || v.length > max) throw new Error(`${what} must be between 1 and ${max} characters.`);
  return v;
};

export async function loadLearning(db: Reader): Promise<LearningSnapshot> {
  const topics = await db.getAllAsync<Row>('SELECT * FROM learn_topics ORDER BY subject COLLATE NOCASE, created_at, id');
  const checkins = await db.getAllAsync<Row>('SELECT * FROM learn_checkins ORDER BY date, created_at');
  return {
    topics: topics.map((r) => ({ id: r.id, subject: r.subject, name: r.name, note: r.note, focus: !!r.focus, archived: !!r.archived_at,
      targetScore: r.target_score, targetDate: r.target_date, goalId: r.goal_id })),
    checkins: checkins.map((r) => ({
      id: r.id, topicId: r.topic_id, date: r.date, score: r.score, minutes: r.minutes, covered: r.covered, note: r.note, createdAt: r.created_at,
    })),
  };
}

export async function saveTopic(db: SQLiteDatabase, input: {
  id?: string; subject: string; name: string; note: string; targetScore?: number | null; targetDate?: string | null; goalId?: string | null;
}): Promise<string> {
  const subject = clean(input.subject, 80, 'Subject');
  const name = clean(input.name, 120, 'Topic');
  const note = input.note.trim();
  if (note.length > 2000) throw new Error('The description is too long.');
  const targetScore = input.targetScore ?? null;
  const targetDate = targetScore === null ? null : input.targetDate ?? null;
  if (targetScore !== null && (!Number.isInteger(targetScore) || targetScore < MIN_SCORE || targetScore > MAX_SCORE)) throw new Error('Choose a target score from 1 to 10.');
  if (targetDate !== null && !isDateKey(targetDate)) throw new Error('Enter the target date as YYYY-MM-DD, or leave it empty.');
  const goalId = input.goalId ?? null;
  if (goalId !== null && !(await db.getFirstAsync('SELECT 1 FROM goals WHERE id = ? AND archived_at IS NULL', [goalId]))) throw new Error('That goal is no longer available.');
  const stamp = now();
  if (input.id) {
    const result = await db.runAsync('UPDATE learn_topics SET subject = ?, name = ?, note = ?, target_score = ?, target_date = ?, goal_id = ?, updated_at = ? WHERE id = ?',
      [subject, name, note, targetScore, targetDate, goalId, stamp, input.id]);
    if (!result.changes) throw new Error('This topic no longer exists.');
    return input.id;
  }
  const id = randomUUID();
  await db.runAsync(`INSERT INTO learn_topics (id, subject, name, note, focus, target_score, target_date, goal_id, archived_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, 0, ?, ?, ?, NULL, ?, ?)`, [id, subject, name, note, targetScore, targetDate, goalId, stamp, stamp]);
  return id;
}

export async function setTopicArchived(db: SQLiteDatabase, id: string, archived: boolean): Promise<void> {
  const stamp = now();
  await db.runAsync('UPDATE learn_topics SET archived_at = ?, focus = CASE WHEN ? THEN 0 ELSE focus END, updated_at = ? WHERE id = ?',
    [archived ? stamp : null, archived ? 1 : 0, stamp, id]);
}

export async function setTopicFocus(db: SQLiteDatabase, id: string, focus: boolean): Promise<void> {
  await db.runAsync('UPDATE learn_topics SET focus = ?, updated_at = ? WHERE id = ? AND archived_at IS NULL', [focus ? 1 : 0, now(), id]);
}

export async function saveCheckin(db: SQLiteDatabase, input: {
  id?: string; topicId: string; date: string; score: number; minutes: number | null; covered: string; note: string;
}): Promise<void> {
  const covered = input.covered.trim();
  const note = input.note.trim();
  const problem = validateCheckin({ date: input.date, score: input.score, minutes: input.minutes, covered, note });
  if (problem) throw new Error(problem);
  const stamp = now();
  await db.withExclusiveTransactionAsync(async (tx) => {
    const topic = await tx.getFirstAsync<Row>('SELECT archived_at FROM learn_topics WHERE id = ?', [input.topicId]);
    if (!topic) throw new Error('This topic no longer exists.');
    if (input.id) {
      const result = await tx.runAsync(`UPDATE learn_checkins SET date = ?, score = ?, minutes = ?, covered = ?, note = ?, updated_at = ?
        WHERE id = ? AND topic_id = ?`, [input.date, input.score, input.minutes, covered, note, stamp, input.id, input.topicId]);
      if (!result.changes) throw new Error('This check-in no longer exists.');
      return;
    }
    if (topic.archived_at) throw new Error('This topic is archived. Restore it before adding a check-in.');
    await tx.runAsync(`INSERT INTO learn_checkins (id, topic_id, date, score, minutes, covered, note, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [randomUUID(), input.topicId, input.date, input.score, input.minutes, covered, note, stamp, stamp]);
  });
}

export async function deleteCheckin(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM learn_checkins WHERE id = ?', [id]);
}

export async function deleteTopic(db: SQLiteDatabase, id: string): Promise<void> {
  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync('DELETE FROM learn_checkins WHERE topic_id = ?', [id]);
    await tx.runAsync('DELETE FROM learn_topics WHERE id = ?', [id]);
  });
}

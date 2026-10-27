import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { createGoal } from '../src/storage/goals.ts';
import { migrateDatabase } from '../src/storage/database.ts';
import { exportBackup, restoreBackup } from '../src/storage/backup.ts';
import { parseBackup } from '../src/domain/backup.ts';
import {
  bandLabel, focusSuggestions, paceEstimate, historyOf, parseMinutes, parseScore, topicProgress, trendPoints, validateCheckin, weekStart, weeklyReview,
} from '../src/domain/learning.ts';
import {
  deleteCheckin, deleteTopic, loadLearning, saveCheckin, saveTopic, setTopicArchived, setTopicFocus,
} from '../src/storage/learning.ts';

function realDatabase() {
  const sqlite = new DatabaseSync(':memory:');
  const query = {
    execAsync: async (sql) => { sqlite.exec(sql); },
    getFirstAsync: async (sql, values = []) => sqlite.prepare(sql).get(...values) ?? null,
    getAllAsync: async (sql, values = []) => sqlite.prepare(sql).all(...values),
    runAsync: async (sql, values = []) => sqlite.prepare(sql).run(...values),
  };
  const db = { ...query, withExclusiveTransactionAsync: async (callback) => {
    sqlite.exec('BEGIN IMMEDIATE');
    try { await callback(query); sqlite.exec('COMMIT'); } catch (error) { sqlite.exec('ROLLBACK'); throw error; }
  } };
  db.withTransactionAsync = async (callback) => db.withExclusiveTransactionAsync(() => callback());
  return { sqlite, db };
}

test('learning keeps honest self-ratings, separates practice time, reviews weeks and round-trips a backup', async () => {
  assert.deepEqual([parseScore('4'), parseScore('10'), parseScore('0'), parseScore('11'), parseScore('x')], [4, 10, null, null, null]);
  assert.deepEqual([parseMinutes(''), parseMinutes('1,200'), parseMinutes('abc'), parseMinutes('20000')], [null, 1200, 'invalid', 'invalid']);
  assert.match(bandLabel(4), /help/);
  assert.equal(weekStart('2026-10-28'), '2026-10-26', 'weeks start on Monday');
  assert.equal(weekStart('2026-11-01'), '2026-10-26');
  assert.match(validateCheckin({ date: '2026-02-30', score: 5, minutes: null, covered: '', note: '' }), /date/);
  assert.match(validateCheckin({ date: '2026-10-28', score: 11, minutes: null, covered: '', note: '' }), /1 to 10/);

  const { sqlite, db } = realDatabase();
  const target = realDatabase();
  try {
    await migrateDatabase(db); await migrateDatabase(target.db);
    const perfect = await saveTopic(db, { subject: 'English', name: '  Past   perfect ', note: 'Confused with past simple' });
    const continuous = await saveTopic(db, { subject: 'English', name: 'Past continuous', note: '' });
    await assert.rejects(() => saveTopic(db, { subject: ' ', name: 'x', note: '' }), /Subject/);
    const entry = (topicId, date, score, minutes, covered = '') => ({ topicId, date, score, minutes, covered, note: '' });
    await saveCheckin(db, entry(perfect, '2026-10-14', 3, 60));
    await saveCheckin(db, entry(perfect, '2026-10-21', 4, 150, 'video + exercises'));
    await saveCheckin(db, entry(perfect, '2026-10-28', 4, 180));
    await saveCheckin(db, entry(continuous, '2026-10-21', 5, null));
    await assert.rejects(() => saveCheckin(db, entry(perfect, '2026-10-28', 0, null)), /1 to 10/);
    await assert.rejects(() => saveCheckin(db, entry('missing', '2026-10-28', 5, null)), /no longer exists/);

    let data = await loadLearning(db);
    assert.equal(data.topics.find((t) => t.id === perfect).name, 'Past perfect');
    const history = historyOf(perfect, data.checkins);
    const progress = topicProgress(history);
    assert.deepEqual([progress.latest.score, progress.change, progress.count, progress.minutes], [4, 0, 3, 390]);
    assert.deepEqual(trendPoints(history).map((p) => p.score), [3, 4, 4]);

    const week = weeklyReview(data.topics, data.checkins, '2026-10-26');
    assert.deepEqual([week.checkedIn, week.open, week.minutes], [1, 2, 180]);
    const row = week.rows.find((r) => r.topic.id === perfect);
    assert.equal(row.change, 0);
    assert.match(row.effortNote, /stayed the same/, 'long practice without a rise is reported, not hidden');
    assert.equal(week.rows.find((r) => r.topic.id === continuous).entry, null);
    const picks = focusSuggestions(data.topics, data.checkins, '2026-10-28');
    assert.deepEqual(picks.map((p) => p.topic.id), [perfect, continuous], 'lowest recent ratings come first, from the user\'s own numbers only');

    await saveTopic(db, { id: perfect, subject: 'English', name: 'Past perfect', note: '', targetScore: 8, targetDate: '2027-03-01' });
    assert.deepEqual([(await loadLearning(db)).topics.find((t) => t.id === perfect).targetScore, (await loadLearning(db)).topics.find((t) => t.id === perfect).targetDate], [8, '2027-03-01']);
    await assert.rejects(() => saveTopic(db, { id: perfect, subject: 'English', name: 'Past perfect', note: '', targetScore: 11 }), /1 to 10/);
    const pace = paceEstimate(historyOf(perfect, data.checkins), 8, '2026-10-28');
    assert.equal(pace.status, 'estimate');
    assert.ok(pace.late > pace.likely && pace.perWeek > 0, 'an estimate gives a likely date and a later one');
    assert.equal(paceEstimate(historyOf(perfect, data.checkins).slice(0, 2), 8, '2026-10-28').status, 'unknown', 'two ratings are not enough');
    assert.equal(paceEstimate(historyOf(perfect, data.checkins), 4, '2026-10-28').status, 'reached');
    const goal = await createGoal(db, { title: 'Reach B2 English', notes: '', horizon: 'year', periodKey: '2026' });
    await saveTopic(db, { id: perfect, subject: 'English', name: 'Past perfect', note: '', targetScore: 8, targetDate: '2027-03-01', goalId: goal });
    assert.equal((await loadLearning(db)).topics.find((t) => t.id === perfect).goalId, goal);
    await assert.rejects(() => saveTopic(db, { id: perfect, subject: 'English', name: 'Past perfect', note: '', goalId: 'missing' }), /no longer available/);
    await saveTopic(db, { id: perfect, subject: 'English', name: 'Past perfect', note: '', targetScore: 8, targetDate: '2027-03-01', goalId: goal });
    await setTopicFocus(db, perfect, true);
    assert.equal((await loadLearning(db)).topics.find((t) => t.id === perfect).focus, true);
    await setTopicArchived(db, perfect, true);
    const archived = (await loadLearning(db)).topics.find((t) => t.id === perfect);
    assert.deepEqual([archived.archived, archived.focus], [true, false], 'archiving also clears the focus');
    await assert.rejects(() => saveCheckin(db, entry(perfect, '2026-11-04', 6, null)), /archived/);
    await setTopicArchived(db, perfect, false);

    const backup = await exportBackup(db);
    assert.equal(backup.tables.learn_checkins.length, 4);
    assert.equal(await restoreBackup(target.db, JSON.stringify(backup)) > 0, true);
    assert.deepEqual((await loadLearning(target.db)).checkins.map((c) => [c.id, c.score]).sort(), data.checkins.map((c) => [c.id, c.score]).sort());
    assert.equal(await restoreBackup(target.db, JSON.stringify(backup)), 0, 'a second restore adds nothing');
    const orphan = structuredClone(backup); orphan.tables.learn_checkins[0].topic_id = 'missing';
    assert.throws(() => parseBackup(JSON.stringify(orphan)), /learning check-in/);
    const badScore = structuredClone(backup); badScore.tables.learn_checkins[0].score = 11;
    assert.throws(() => parseBackup(JSON.stringify(badScore)), /learning check-in/);
    const v6 = structuredClone(backup); v6.version = 6; v6.schemaVersion = 12;
    for (const row of v6.tables.learn_topics) delete row.goal_id;
    assert.equal(parseBackup(JSON.stringify(v6)).tables.learn_topics[0].goal_id, null, 'version 6 backups gain an empty goal link');
    const badGoal = structuredClone(backup); badGoal.tables.learn_topics[0].goal_id = 'missing';
    assert.throws(() => parseBackup(JSON.stringify(badGoal)), /learning topic/);
    const v5 = structuredClone(backup); v5.version = 5; v5.schemaVersion = 11;
    for (const row of v5.tables.learn_topics) { delete row.target_score; delete row.target_date; delete row.goal_id; }
    assert.equal(parseBackup(JSON.stringify(v5)).tables.learn_topics[0].target_score, null, 'version 5 backups gain empty targets');
    const v4 = structuredClone(backup); v4.version = 4; v4.schemaVersion = 10;
    delete v4.tables.learn_topics; delete v4.tables.learn_checkins;
    assert.equal(parseBackup(JSON.stringify(v4)).tables.learn_topics.length, 0, 'version 4 backups gain empty learning tables');

    await deleteCheckin(db, history[0].id);
    await deleteTopic(db, perfect);
    data = await loadLearning(db);
    assert.deepEqual([data.topics.length, data.checkins.length], [1, 1], 'deleting a topic removes its history only');
  } finally { sqlite.close(); target.sqlite.close(); }
});

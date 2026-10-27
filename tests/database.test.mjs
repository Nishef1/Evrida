import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { migrateDatabase } from '../src/storage/database.ts';
import { createGoal, editGoal, planGoal, setGoalCompleted, getGoal, listInboxGoals, completedGoalsSince, archiveGoal, restoreGoal, reviewPastGoal } from '../src/storage/goals.ts';
import { exportBackup, previewBackupMerge, restoreBackup } from '../src/storage/backup.ts';
import { nextOccurrence } from '../src/domain/planning.ts';
import { createBoard, addGoalToBoard, listBoardGoals } from '../src/storage/boards.ts';
import { beginFocusSession, beginQuickFocus, getFocusSession, pauseFocusSession, resumeFocusSession, stopFocusSession, listFocusHistory } from '../src/storage/focus.ts';
import { safeNativePath } from '../src/domain/links.ts';
import { previewReplan } from '../src/domain/replan.ts';
import { applyReplan, undoReplan, canUndoReplan } from '../src/storage/replan.ts';
import { saveBlock, listDayBlocks } from '../src/storage/timeblocks.ts';
import { setWeeklyCapacity, listWeeklyCapacity } from '../src/storage/capacity.ts';
import { parseBackup } from '../src/domain/backup.ts';
import { createGuidedPlan } from '../src/storage/guided-plans.ts';
import { serializeDatabase } from '../src/storage/serialized.ts';
import { checkLocalHealth } from '../src/storage/health.ts';
import { previewTimelineEdit } from '../src/domain/timeline-edit.ts';
import { applyTimelineEdit } from '../src/storage/timeline-edit.ts';

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
    try { await callback(query); sqlite.exec('COMMIT'); }
    catch (error) { sqlite.exec('ROLLBACK'); throw error; }
  }};
  db.withTransactionAsync = async (callback) => db.withExclusiveTransactionAsync(() => callback());
  return { sqlite, db };
}


function fakeDatabase(version) {
  const queries = [];
  let transactionCalls = 0;
  const db = {
    execAsync: async (sql) => { queries.push(sql); },
    getFirstAsync: async () => ({ user_version: version }),
    withTransactionAsync: async (callback) => {
      transactionCalls++;
      await callback();
    },
  };
  return { db, queries, get transactionCalls() { return transactionCalls; } };
}

test('native links reject malformed and oversized input before tolerant URI decoding', () => {
  const valid = 'evrida://calendar?goalId=abc-123';
  assert.equal(safeNativePath(valid), valid);
  const persian = '/?goalId=' + encodeURIComponent('قدم بعدی');
  assert.equal(safeNativePath(persian), persian);
  assert.equal(safeNativePath('/?goalId=%FF'.repeat(40)), '/');
  assert.equal(safeNativePath('/?goalId=%E0%A4%A'), '/');
  assert.equal(safeNativePath('/?goalId=' + '%41'.repeat(3000)), '/');
  assert.equal(safeNativePath('/?goalId=%25literal'), '/?goalId=%25literal');
});

test('newer database is rejected and SQLite gate serializes native calls', async () => {
  const fake = fakeDatabase(13);
  await assert.rejects(() => migrateDatabase(fake.db), /newer Evrida database/);
  assert.equal(fake.transactionCalls, 0);
  let inFlight = 0, maximum = 0, calls = 0;
  const handle = {
    getAllAsync: async () => {
      calls++;
      inFlight++;
      maximum = Math.max(inFlight, maximum);
      await Promise.resolve();
      await Promise.resolve();
      inFlight--;
      return [];
    },
  };
  const guarded = serializeDatabase(handle);
  assert.equal(serializeDatabase(handle), guarded);
  await Promise.all(Array.from({ length: 40 }, () => guarded.getAllAsync('SELECT 1')));
  assert.equal(calls, 40);
  assert.equal(maximum, 1);
  const eventLog = [];
  const exclusiveDb = {
    getAllAsync: async () => { eventLog.push('outside'); return []; },
    withExclusiveTransactionAsync: async (callback) => {
      eventLog.push('begin');
      await callback({
        getFirstAsync: async () => { eventLog.push('inside'); return null; },
      });
      eventLog.push('commit');
    },
  };
  const safe = serializeDatabase(exclusiveDb);
  await Promise.all([
    safe.withExclusiveTransactionAsync(async (tx) => {
      await tx.getFirstAsync('SELECT 1');
      await Promise.resolve();
    }),
    safe.getAllAsync('SELECT 2'),
  ]);
  assert.deepEqual(eventLog, ['begin', 'inside', 'commit', 'outside']);
});

test('real SQLite migrates populated v5 data to v12 without losing goals, boards or timer state', async () => {
  const { sqlite, db } = realDatabase();
  try {
    await migrateDatabase(db);
    assert.equal(sqlite.prepare('PRAGMA user_version').get().user_version, 12);
    const stamp = '2026-10-14T21:00:00.000Z';
    sqlite.prepare(`INSERT INTO goals
      (id, title, notes, horizon, period_key, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`).run('g1', 'Study', 'Keep this note', 'day', '2026-10-14', stamp, stamp);
    sqlite.prepare(`INSERT INTO boards (id, title, created_at, updated_at)
      VALUES (?, ?, ?, ?)`).run('b1', 'Work', stamp, stamp);
    sqlite.prepare(`INSERT INTO board_goals (board_id, goal_id, added_at)
      VALUES (?, ?, ?)`).run('b1', 'g1', stamp);
    sqlite.prepare(`INSERT INTO time_blocks
      (id, goal_id, start_at, end_at, kind, intention, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
      't1', 'g1', '2026-10-14T22:30:00.000Z', '2026-10-15T00:30:00.000Z',
      'box', 'Deep work', stamp, stamp,
    );
    // Emulate the exact structural difference from v5 (not a fresh v6 database).
    sqlite.exec(`
      DROP TABLE learn_checkins; DROP TABLE learn_topics;
      DROP TABLE fin_plans; DROP TABLE fin_budgets; DROP TABLE fin_allocations; DROP TABLE fin_goals; DROP TABLE fin_tx_tags;
      DROP TABLE fin_splits; DROP TABLE fin_transactions; DROP TABLE fin_tags; DROP TABLE fin_categories; DROP TABLE fin_accounts; DROP TABLE fin_settings;
      DROP TABLE replan_checkpoint;
      DROP TABLE time_budgets;
      DROP INDEX focus_history_by_goal_end;
      ALTER TABLE time_blocks DROP COLUMN flexible;
      DROP TABLE goal_activity;
      DROP INDEX goals_recurrence_source;
      DROP INDEX goals_inbox;
      ALTER TABLE goals DROP COLUMN in_inbox;
      ALTER TABLE goals DROP COLUMN due_date;
      ALTER TABLE goals DROP COLUMN repeat_rule;
      ALTER TABLE goals DROP COLUMN repeat_anchor;
      ALTER TABLE goals DROP COLUMN recurrence_from_id;
      ALTER TABLE goals DROP COLUMN reviewed_period;
      DROP TABLE focus_history;
      ALTER TABLE focus_session DROP COLUMN started_at_ms;
      ALTER TABLE focus_session DROP COLUMN elapsed_ms;
      PRAGMA user_version = 5;
    `);
    sqlite.prepare(`INSERT INTO focus_session
      (id, block_id, status, duration_ms, remaining_ms, deadline_ms, updated_at_ms)
      VALUES (1, ?, 'paused', ?, ?, ?, ?)`).run('t1', 1200000, 720000, 1500000, 1500000);
    await migrateDatabase(db);
    assert.equal(sqlite.prepare('PRAGMA user_version').get().user_version, 12);
    assert.equal(sqlite.prepare('SELECT notes FROM goals WHERE id = ?').get('g1').notes, 'Keep this note');
    assert.equal(sqlite.prepare('SELECT count(*) AS n FROM board_goals').get().n, 1);
    assert.equal(sqlite.prepare('SELECT intention FROM time_blocks WHERE id = ?').get('t1').intention, 'Deep work');
    const focus = sqlite.prepare('SELECT status, started_at_ms, elapsed_ms FROM focus_session').get();
    assert.equal(focus.status, 'paused');
    assert.equal(focus.elapsed_ms, 480000);
    assert.equal(focus.started_at_ms, 1020000);
    assert.equal(sqlite.prepare('SELECT count(*) AS n FROM focus_history').get().n, 0);
    assert.equal(sqlite.prepare('PRAGMA foreign_key_check').all().length, 0);
    await migrateDatabase(db); // Idempotent: opening again must not create extra rows.
    assert.equal(sqlite.prepare('SELECT count(*) AS n FROM goals').get().n, 1);
    // A quick-check success does not imply that foreign keys are consistent.
    sqlite.exec('PRAGMA foreign_keys = OFF');
    sqlite.prepare('INSERT INTO board_goals(board_id, goal_id, added_at) VALUES (?, ?, ?)')
      .run('b1', 'orphan-goal', stamp);
    sqlite.exec('PRAGMA foreign_keys = ON');
    const health = await checkLocalHealth(db);
    assert.equal(health.structureOkay, true);
    assert.equal(health.foreignKeysOkay, false);
    assert.equal(health.orphanRelations, 1);
  } finally {
    sqlite.close();
  }
});


test('offline planning lifecycle preserves identity, recurrence, completion history and recoverable backup graphs', async () => {
  const source = realDatabase(), target = realDatabase();
  try {
    await migrateDatabase(source.db); await migrateDatabase(target.db);
    assert.deepEqual(await checkLocalHealth(source.db), { structureOkay: true, foreignKeysOkay: true,
      structuralProblems: 0, orphanRelations: 0 });
    const createdPath = await createGuidedPlan(source.db, 'project', 'Build something useful', new Date(2026, 9, 14, 12));
    const pathRoot = await getGoal(source.db, createdPath);
    assert.equal(pathRoot.title, 'Build something useful');
    assert.equal(pathRoot.horizon, 'quarter');
    assert.equal(pathRoot.periodKey, '2026-Q4');
    const pathChildren = source.sqlite.prepare('SELECT id, in_inbox, period_key, parent_id FROM goals WHERE parent_id = ?').all(createdPath);
    assert.equal(pathChildren.length, 4);
    assert.ok(pathChildren.every((child) => child.in_inbox === 1 && child.period_key === '' && child.parent_id === createdPath));
    const beforeInvalidPlan = source.sqlite.prepare('SELECT COUNT(*) AS n FROM goals').get().n;
    await assert.rejects(() => createGuidedPlan(source.db, 'project', ' '), /needs a title/);
    await assert.rejects(() => createGuidedPlan(source.db, 'nonexistent', 'Valid'), /unavailable/);
    assert.equal(source.sqlite.prepare('SELECT COUNT(*) AS n FROM goals').get().n, beforeInvalidPlan);
    const parent = await createGoal(source.db, { title: 'My direction', notes: '', horizon: 'year', periodKey: '2026' });
    const step = await createGoal(source.db, { title: '  Read   a chapter ', notes: 'Keep this note', horizon: 'day',
      periodKey: '2026-01-31', parentId: parent, dueDate: '2026-02-02', repeatRule: 'monthly' });
    const inbox = await createGoal(source.db, { title: 'A later idea', notes: '', horizon: 'day', periodKey: '', inbox: true });
    assert.ok((await listInboxGoals(source.db)).some((item) => item.id === inbox));
    assert.equal((await getGoal(source.db, inbox)).periodKey, '');
    await assert.rejects(() => editGoal(source.db, parent, { title: 'Cycle', notes: '', horizon: 'year', periodKey: '2026', parentId: step }), /own next steps/);
    const board = await createBoard(source.db, 'Reading', 'A personal project');
    await addGoalToBoard(source.db, board, step);
    const flexibleGoal = await createGoal(source.db, { title: 'Flexible session', notes: '', horizon: 'day', periodKey: '2026-10-14' });
    const fixedGoal = await createGoal(source.db, { title: 'Protected meeting', notes: '', horizon: 'day', periodKey: '2026-10-14' });
    await saveBlock(source.db, { goalId: flexibleGoal, date: '2026-10-14', start: '13:00', end: '13:30',
      kind: 'block', intention: '', flexible: true });
    await saveBlock(source.db, { goalId: fixedGoal, date: '2026-10-14', start: '13:30', end: '14:00',
      kind: 'block', intention: '', flexible: false });
    await saveBlock(source.db, { goalId: flexibleGoal, date: '2026-10-14', start: '14:00', end: '14:30',
      kind: 'block', intention: '', flexible: true });
    const selectedDay = new Date(2026, 9, 14, 12);
    const beforeRecovery = await listDayBlocks(source.db, selectedDay);
    const proposal = previewReplan(beforeRecovery, { mode: 'recover', day: selectedDay,
      now: new Date(2026, 9, 14, 12, 50) });
    // A once-valid preview must be rejected if it expires while waiting for the DB lock.
    let clockReads = 0;
    await assert.rejects(() => applyReplan(source.db, proposal, beforeRecovery, () =>
      clockReads++ === 0 ? proposal.atMs : proposal.atMs + 120001), /expired while waiting/);
    assert.deepEqual((await listDayBlocks(source.db, selectedDay)).map((block) => block.startAt),
      beforeRecovery.map((block) => block.startAt));
    // Updating and restoring identical visible values still invalidates a frozen Recovery preview.
    const revisionTarget = beforeRecovery[0];
    source.sqlite.prepare('UPDATE time_blocks SET updated_at = ? WHERE id = ?')
      .run('2099-01-01T00:00:00.000Z', revisionTarget.id);
    await assert.rejects(() => applyReplan(source.db, proposal, beforeRecovery,
      new Date(2026, 9, 14, 12, 50).getTime()), /Calendar changed/);
    source.sqlite.prepare('UPDATE time_blocks SET updated_at = ? WHERE id = ?')
      .run(revisionTarget.updatedAt, revisionTarget.id);
    await applyReplan(source.db, proposal, beforeRecovery, new Date(2026, 9, 14, 12, 50).getTime());
    await assert.rejects(() => applyReplan(source.db, proposal, beforeRecovery, new Date(2026, 9, 14, 12, 50).getTime()), /Calendar changed/);
    assert.equal((await listDayBlocks(source.db, selectedDay)).find((b) =>
      b.id === proposal.moves[0].id).startAt, proposal.moves[0].toStart);
    assert.equal(await canUndoReplan(source.db), true);
    // A running Focus on a moved block must suppress Undo before tapping it.
    const movedId = proposal.moves[0].id;
    source.sqlite.prepare(`INSERT INTO focus_session
      (id, block_id, status, duration_ms, remaining_ms, deadline_ms, started_at_ms, elapsed_ms, updated_at_ms)
      VALUES (1, ?, 'running', ?, ?, ?, ?, 0, ?)`)
      .run(movedId, 900000, 900000, Date.now() + 900000, Date.now(), Date.now());
    assert.equal(await canUndoReplan(source.db), false);
    await assert.rejects(() => undoReplan(source.db), /End Focus before undoing/);
    source.sqlite.prepare('DELETE FROM focus_session WHERE id = 1').run();
    assert.equal(await canUndoReplan(source.db), true);
    const firstMove = proposal.moves[0];
    const originalIntention = beforeRecovery.find((block) => block.id === firstMove.id).intention;
    const checkpoint = JSON.parse(source.sqlite.prepare('SELECT after_json FROM replan_checkpoint WHERE id = 1').get().after_json);
    const applied = checkpoint.find((item) => item.id === firstMove.id);
    source.sqlite.prepare('UPDATE time_blocks SET intention = ?, updated_at = ? WHERE id = ?')
      .run('Edited after replanning', '2099-01-01T00:00:00.000Z', firstMove.id);
    await assert.rejects(() => undoReplan(source.db), /Calendar changed since replanning/);
    assert.equal(source.sqlite.prepare('SELECT intention FROM time_blocks WHERE id = ?')
      .get(firstMove.id).intention, 'Edited after replanning');
    assert.equal(await canUndoReplan(source.db), false);
    // Restore only this controlled test mutation so that the original safe Undo can complete.
    source.sqlite.prepare('UPDATE time_blocks SET intention = ?, updated_at = ? WHERE id = ?')
      .run(originalIntention, applied.appliedAt, firstMove.id);
    assert.equal(await canUndoReplan(source.db), true);
    await undoReplan(source.db);
    assert.equal(await canUndoReplan(source.db), false);
    // A manual timeline drag is an explicit, isolated move with atomic stale-preview checks.
    const sourceBlock = beforeRecovery.find((block) => block.goalId === flexibleGoal);
    const directPreview = previewTimelineEdit(sourceBlock, beforeRecovery, selectedDay, 'move', 15);
    // Editing the intent after a preview must invalidate the visual confirmation,
    // even when timestamps have not changed.
    source.sqlite.prepare('UPDATE time_blocks SET intention = ? WHERE id = ?')
      .run('Someone edited the plan', sourceBlock.id);
    await assert.rejects(() => applyTimelineEdit(source.db, directPreview), /Reservation changed/);
    source.sqlite.prepare('UPDATE time_blocks SET intention = ? WHERE id = ?')
      .run(sourceBlock.intention, sourceBlock.id);
    // A conflicting revision with unchanged visible fields must still invalidate the drag.
    source.sqlite.prepare('UPDATE time_blocks SET updated_at = ? WHERE id = ?')
      .run('2099-01-01T00:00:00.000Z', sourceBlock.id);
    await assert.rejects(() => applyTimelineEdit(source.db, directPreview), /Reservation changed/);
    source.sqlite.prepare('UPDATE time_blocks SET updated_at = ? WHERE id = ?')
      .run(sourceBlock.updatedAt, sourceBlock.id);
    await applyTimelineEdit(source.db, directPreview);
    assert.equal((await listDayBlocks(source.db, selectedDay)).find((block) => block.id === sourceBlock.id).startAt,
      directPreview.toStart);
    await assert.rejects(() => applyTimelineEdit(source.db, directPreview), /changed/);
    // A stale native time editor cannot overwrite a newer drag or another saved edit.
    await assert.rejects(() => saveBlock(source.db, {
      goalId: sourceBlock.goalId, date: '2026-10-14', start: '13:45', end: '14:15',
      kind: sourceBlock.kind, intention: sourceBlock.intention, flexible: sourceBlock.flexible,
    }, sourceBlock.id, sourceBlock), /changed since you opened/);
    const afterDirect = (await listDayBlocks(source.db, selectedDay)).find((block) => block.id === sourceBlock.id);
    const restoreDirect = previewTimelineEdit(afterDirect, await listDayBlocks(source.db, selectedDay),
      selectedDay, 'move', -15);
    await applyTimelineEdit(source.db, restoreDirect);
    assert.equal((await listDayBlocks(source.db, selectedDay)).find((block) => block.id === sourceBlock.id).startAt,
      sourceBlock.startAt);
    assert.deepEqual((await listDayBlocks(source.db, selectedDay)).map((b) => [b.id, b.startAt, b.endAt]).sort(),
      beforeRecovery.map((b) => [b.id, b.startAt, b.endAt]).sort());
    // An edit timestamp alone is meaningful even if the block content was restored.
    const savedForEditor = (await listDayBlocks(source.db, selectedDay)).find((b) => b.id === sourceBlock.id);
    source.sqlite.prepare('UPDATE time_blocks SET updated_at = ? WHERE id = ?')
      .run('2099-01-01T00:00:00.000Z', sourceBlock.id);
    await assert.rejects(() => saveBlock(source.db, {
      goalId: sourceBlock.goalId, date: '2026-10-14', start: '13:00', end: '13:30',
      kind: sourceBlock.kind, intention: 'Stale description', flexible: sourceBlock.flexible,
    }, sourceBlock.id, savedForEditor), /changed since you opened/);
    source.sqlite.prepare('UPDATE time_blocks SET updated_at = ? WHERE id = ?')
      .run(savedForEditor.updatedAt, sourceBlock.id);
    // Any manual edit invalidates the prior Recovery checkpoint, even for another item.
    const stampForUndo = new Date().toISOString();
    source.sqlite.prepare('INSERT INTO replan_checkpoint (id, before_json, after_json, created_at) VALUES (1, ?, ?, ?)')
      .run('[]', '[]', stampForUndo);
    await saveBlock(source.db, {
      goalId: sourceBlock.goalId, date: '2026-10-14', start: '13:00', end: '13:30',
      kind: sourceBlock.kind, intention: sourceBlock.intention, flexible: sourceBlock.flexible,
    }, sourceBlock.id, savedForEditor);
    assert.equal(source.sqlite.prepare('SELECT id FROM replan_checkpoint WHERE id = 1').get(), undefined);
    await setWeeklyCapacity(source.db, parent, 240);
    assert.equal((await listWeeklyCapacity(source.db, new Date(2026, 9, 12, 12)))[0].weeklyMinutes, 240);
    // Overlapping descendant reservations must count as occupied wall time, not summed durations.
    await setWeeklyCapacity(source.db, flexibleGoal, 180);
    const mergedCapacity = (await listWeeklyCapacity(source.db, new Date(2026, 9, 12, 12)))
      .find((item) => item.goalId === flexibleGoal);
    assert.equal(mergedCapacity.plannedMinutes, 60);
    await saveBlock(source.db, { goalId: flexibleGoal, date: '2026-10-14',
      start: '13:15', end: '13:45', kind: 'block', intention: 'Overlapping reservation', flexible: false });
    const uniqueCapacity = (await listWeeklyCapacity(source.db, new Date(2026, 9, 12, 12)))
      .find((item) => item.goalId === flexibleGoal);
    assert.equal(uniqueCapacity.plannedMinutes, 75);
    const nestedGoal = await createGoal(source.db, { title: 'Nested flexible work', notes: '',
      horizon: 'day', periodKey: '2026-10-14', parentId: flexibleGoal });
    await saveBlock(source.db, { goalId: nestedGoal, date: '2026-10-14',
      start: '13:30', end: '14:15', kind: 'block', intention: '', flexible: false });
    const ancestor = (await listWeeklyCapacity(source.db, new Date(2026, 9, 12, 12)))
      .find((item) => item.goalId === flexibleGoal);
    assert.equal(ancestor.plannedMinutes, 90); // Union across parent and descendant, not 120 minutes.
    // An unrelated goal's reservation doesn't affect the allocated time for this goal.
    assert.equal(ancestor.focusedMinutes, 0);
    const quick = await beginQuickFocus(source.db, step, 25);
    assert.equal(quick.durationMs, 25 * 60000);
    const blockCount = source.sqlite.prepare('SELECT count(*) AS n FROM time_blocks').get().n;
    const beforePlan = await getGoal(source.db, step);
    const reservations = source.sqlite.prepare('SELECT * FROM time_blocks WHERE goal_id = ?').all(step);
    await planGoal(source.db, step, { horizon: 'day', periodKey: '2026-02-01' });
    assert.deepEqual(await getGoal(source.db, step), { ...beforePlan, periodKey: '2026-02-01',
      updatedAt: (await getGoal(source.db, step)).updatedAt });
    assert.deepEqual(source.sqlite.prepare('SELECT * FROM time_blocks WHERE goal_id = ?').all(step), reservations);
    assert.equal(source.sqlite.prepare('SELECT repeat_anchor FROM goals WHERE id = ?').get(step).repeat_anchor, '2026-01-31');
    await assert.rejects(() => planGoal(source.db, step, { horizon: 'week', periodKey: '2026-W06' }), /daily planning date/);
    await assert.rejects(() => planGoal(source.db, step, { horizon: 'day', periodKey: '', inbox: true }), /before repeating/);
    await planGoal(source.db, inbox, { horizon: 'week', periodKey: '2026-W06' });
    assert.ok(!(await listInboxGoals(source.db)).some((item) => item.id === inbox));
    await planGoal(source.db, inbox, { horizon: 'week', periodKey: '', inbox: true });
    assert.ok((await listInboxGoals(source.db)).some((item) => item.id === inbox));
    await assert.rejects(() => planGoal(source.db, inbox, { horizon: 'day', periodKey: '2026-02-30' }), /valid planning period/);
    await assert.rejects(() => beginQuickFocus(source.db, inbox, 15), /already active/);
    assert.equal(source.sqlite.prepare('SELECT count(*) AS n FROM time_blocks').get().n, blockCount);
    await pauseFocusSession(source.db);
    assert.equal((await getFocusSession(source.db)).status, 'paused');
    await resumeFocusSession(source.db);
    await beginQuickFocus(source.db, inbox, 15, true);
    assert.equal((await listFocusHistory(source.db))[0].outcome, 'replaced');
    await stopFocusSession(source.db);
    await beginQuickFocus(source.db, step, 50);
    await archiveGoal(source.db, parent);
    await assert.rejects(() => planGoal(source.db, step, { horizon: 'day', periodKey: '2026-02-02' }), /open goal/);
    assert.equal(await getFocusSession(source.db), null);
    assert.equal((await listFocusHistory(source.db)).length, 3);
    await restoreGoal(source.db, parent);
    const completedBox = await saveBlock(source.db, { goalId: step, date: '2026-10-14',
      start: '16:00', end: '16:25', kind: 'box', intention: 'Already done', flexible: false });
    await setGoalCompleted(source.db, step, true);
    await assert.rejects(() => planGoal(source.db, step, { horizon: 'day', periodKey: '2026-02-02' }), /open goal/);
    await assert.rejects(() => saveBlock(source.db, { goalId: step, date: '2026-10-14',
      start: '16:40', end: '17:00', kind: 'box', intention: '', flexible: false }), /open goal/);
    await assert.rejects(() => beginFocusSession(source.db, completedBox), /unavailable/);
    await assert.rejects(() => saveBlock(source.db, {
      goalId: fixedGoal, date: '2026-10-14', start: '16:00', end: '16:25',
      kind: 'box', intention: 'Trying to repurpose completed time', flexible: false,
    }, completedBox), /Reopen the completed goal/);
    await setGoalCompleted(source.db, step, true); // Double delivery is idempotent.
    assert.equal(await completedGoalsSince(source.db, '2000-01-01T00:00:00.000Z'), 1);
    assert.equal((await listBoardGoals(source.db, board)).find((goal) => goal.id === step).completed, true);
    assert.equal(source.sqlite.prepare('SELECT count(*) AS n FROM goal_activity').get().n, 1);
    const next = source.sqlite.prepare('SELECT * FROM goals WHERE recurrence_from_id = ?').get(step);
    // Postponing the January occurrence into February keeps the original 31st anchor.
    assert.equal(next.period_key, '2026-03-31');
    assert.equal(next.parent_id, parent); assert.equal(next.due_date, null);
    assert.equal(next.notes, 'Keep this note');
    assert.equal(nextOccurrence('2026-02-28', 'monthly', '2026-01-31'), '2026-03-31');
    assert.equal(nextOccurrence('2025-02-28', 'yearly', '2024-02-29'), '2026-02-28');
    assert.equal(nextOccurrence('2027-02-28', 'yearly', '2024-02-29'), '2028-02-29');
    await setGoalCompleted(source.db, step, false);
    // A completed goal cannot keep its timer alive; completion closes the focus history atomically.
    await beginFocusSession(source.db, completedBox);
    assert.equal((await getFocusSession(source.db)).goalId, step);
    await setGoalCompleted(source.db, step, true);
    assert.equal(await getFocusSession(source.db), null);
    assert.equal((await listFocusHistory(source.db))[0].outcome, 'stopped');
    await setGoalCompleted(source.db, step, false);
    assert.equal(await completedGoalsSince(source.db, '2000-01-01T00:00:00.000Z'), 0);
    await setGoalCompleted(source.db, step, true);
    assert.equal(source.sqlite.prepare('SELECT count(*) AS n FROM goals WHERE recurrence_from_id = ?').get(step).n, 1);
    await reviewPastGoal(source.db, next.id, true);
    assert.equal((await getGoal(source.db, step)).dueDate, '2026-02-02');
    await archiveGoal(source.db, parent); await restoreGoal(source.db, parent);
    const snapshot = await exportBackup(source.db), text = JSON.stringify(snapshot);
    assert.equal(snapshot.version, 6);
    // The backup size contract applies to the serialized file itself, not
    // a compact validation copy followed by a larger pretty-printed export.
    assert.doesNotThrow(() => parseBackup(JSON.stringify(snapshot)));
    const longMembership = structuredClone(snapshot);
    const originalGoal = longMembership.tables.goals[0];
    const originalBoard = longMembership.tables.boards[0];
    const longGoalId = 'g'.repeat(120), longBoardId = 'b'.repeat(120);
    longMembership.tables.goals.push({ ...originalGoal, id: longGoalId,
      parent_id: null, recurrence_from_id: null });
    longMembership.tables.boards.push({ ...originalBoard, id: longBoardId });
    longMembership.tables.board_goals.push({ board_id: longBoardId,
      goal_id: longGoalId, added_at: new Date().toISOString() });
    assert.doesNotThrow(() => parseBackup(JSON.stringify(longMembership)));
    // Portable backups must not bypass the same 1-minute to 24-hour time bounds as the editor.
    const impossibleDuration = structuredClone(snapshot);
    impossibleDuration.tables.time_blocks[0].end_at =
      new Date(Date.parse(String(impossibleDuration.tables.time_blocks[0].start_at)) +
        25 * 60 * 60 * 1000).toISOString();
    assert.throws(() => parseBackup(JSON.stringify(impossibleDuration)), /invalid time block/);
    const subMinute = structuredClone(snapshot);
    subMinute.tables.time_blocks[0].end_at =
      new Date(Date.parse(String(subMinute.tables.time_blocks[0].start_at)) + 30000).toISOString();
    assert.throws(() => parseBackup(JSON.stringify(subMinute)), /invalid time block/);
    assert.equal(snapshot.tables.time_budgets.length, 2);
    assert.equal(snapshot.tables.focus_history.filter((row) => row.goal_id === step).length, 3);
    const legacy = structuredClone(snapshot);
    legacy.version = 1; legacy.schemaVersion = 7;
    for (const name of Object.keys(legacy.tables).filter((n) => n === 'time_budgets' || n.startsWith('fin_') || n.startsWith('learn_'))) delete legacy.tables[name];
    for (const row of legacy.tables.time_blocks) delete row.flexible;
    for (const row of legacy.tables.focus_history) { delete row.goal_id; delete row.block_id; }
    assert.equal(parseBackup(JSON.stringify(legacy)).tables.time_blocks.every((row) => row.flexible === 0), true);
    target.sqlite.prepare('INSERT INTO replan_checkpoint (id, before_json, after_json, created_at) VALUES (1, ?, ?, ?)')
      .run('[]', '[]', new Date().toISOString());
    const firstMerge = await previewBackupMerge(target.db, text);
    assert.equal(firstMerge.missing, firstMerge.incoming);
    assert.equal(firstMerge.different, 0);
    assert.ok(await restoreBackup(target.db, text, firstMerge) > 0);
    assert.equal(target.sqlite.prepare('SELECT id FROM replan_checkpoint WHERE id = 1').get(), undefined);
    const secondMerge = await previewBackupMerge(target.db, text);
    assert.equal(secondMerge.missing, 0);
    assert.equal(secondMerge.identical, secondMerge.incoming);
    assert.equal(await restoreBackup(target.db, text, secondMerge), 0);
    const restored = await exportBackup(target.db);
    for (const table of Object.keys(snapshot.tables)) {
      assert.deepEqual(restored.tables[table].map(JSON.stringify).sort(), snapshot.tables[table].map(JSON.stringify).sort());
    }
    const before = target.sqlite.prepare('SELECT count(*) AS n FROM goals').get().n;
    const broken = structuredClone(snapshot);
    broken.tables.goals[0].parent_id = broken.tables.goals[0].id;
    await assert.rejects(() => restoreBackup(target.db, JSON.stringify(broken)), /cycle/);
    assert.equal(target.sqlite.prepare('SELECT count(*) AS n FROM goals').get().n, before);
    // A valid standalone snapshot can conflict with a local recurrence source.
    // Even rows inserted before that SQL conflict must roll back.
    const conflicting = structuredClone(snapshot);
    conflicting.tables.goals.find((row) => row.id === next.id).id = 'conflicting-occurrence';
    for (const row of conflicting.tables.board_goals) {
      if (row.goal_id === next.id) row.goal_id = 'conflicting-occurrence';
    }
    conflicting.tables.goals.unshift({ ...snapshot.tables.goals.find((row) => row.id === inbox), id: 'must-roll-back' });
    await assert.rejects(() => restoreBackup(target.db, JSON.stringify(conflicting)), /UNIQUE constraint/);
    assert.equal(target.sqlite.prepare('SELECT count(*) AS n FROM goals').get().n, before);
    assert.equal(target.sqlite.prepare('SELECT id FROM goals WHERE id = ?').get('must-roll-back'), undefined);
    const localTitle = (await getGoal(target.db, step)).title;
    snapshot.tables.goals.find((row) => row.id === step).title = 'Do not overwrite local edits';
    const divergent = JSON.stringify(snapshot);
    const conflicts = await previewBackupMerge(target.db, divergent);
    assert.equal(conflicts.different, 1);
    assert.deepEqual(conflicts.differentTables, ['goals']);
    // A local edit after confirmation invalidates the preview.
    const stalePreview = await previewBackupMerge(target.db, text);
    target.sqlite.prepare('UPDATE boards SET description = ? WHERE id = ?')
      .run('Edited after preview', snapshot.tables.boards[0].id);
    await assert.rejects(() => restoreBackup(target.db, text, stalePreview), /Local data changed/);
    assert.equal(target.sqlite.prepare('SELECT description FROM boards WHERE id = ?')
      .get(snapshot.tables.boards[0].id).description, 'Edited after preview');
    await restoreBackup(target.db, divergent);
    assert.equal((await getGoal(target.db, step)).title, localTitle);
    // Ensure ID-only merge previews work across the 150-row SQLite parameter batch.
    const bulk = structuredClone(snapshot);
    for (const table of Object.keys(bulk.tables)) bulk.tables[table] = [];
    bulk.tables.boards = Array.from({ length: 152 }, (_, index) => ({
      ...snapshot.tables.boards[0], id: 'bulk-qa-board-' + index,
    }));
    const bulkText = JSON.stringify(bulk);
    const bulkPreview = await previewBackupMerge(target.db, bulkText);
    assert.equal(bulkPreview.missing, 152);
    assert.equal(bulkPreview.different, 0);
    assert.equal(await restoreBackup(target.db, bulkText, bulkPreview), 152);
    assert.equal(target.sqlite.prepare('PRAGMA foreign_key_check').all().length, 0);
  } finally { source.sqlite.close(); target.sqlite.close(); }
});

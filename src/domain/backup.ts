import { HORIZONS, parseDateInput } from './horizons';
import { REPEAT_RULES, validatePlanning } from './planning';
import { validateFinanceBackup } from './finance';
import { validateLearningBackup } from './learning';

const V1_COLUMNS = {
  goals: ['id', 'title', 'notes', 'horizon', 'period_key', 'parent_id', 'completed', 'created_at', 'updated_at',
    'archived_at', 'sort_rank', 'in_inbox', 'due_date', 'repeat_rule', 'repeat_anchor', 'recurrence_from_id', 'reviewed_period'],
  boards: ['id', 'title', 'description', 'created_at', 'updated_at'],
  board_goals: ['board_id', 'goal_id', 'added_at'],
  time_blocks: ['id', 'goal_id', 'start_at', 'end_at', 'kind', 'intention', 'created_at', 'updated_at'],
  focus_history: ['id', 'goal_title', 'started_at_ms', 'ended_at_ms', 'planned_ms', 'focused_ms', 'outcome'],
  goal_activity: ['id', 'goal_id', 'kind', 'occurred_at'],
} as const;
export const BACKUP_COLUMNS = {
  ...V1_COLUMNS,
  time_blocks: [...V1_COLUMNS.time_blocks, 'flexible'],
  focus_history: [...V1_COLUMNS.focus_history, 'goal_id', 'block_id'],
  time_budgets: ['goal_id', 'weekly_minutes'],
  fin_settings: ['id', 'unit', 'decimals', 'inflation_bp', 'usd_rate_x100', 'usd_rate_date', 'usd_rate_source', 'created_at', 'updated_at'],
  fin_accounts: ['id', 'name', 'kind', 'opening', 'archived_at', 'created_at', 'updated_at'],
  fin_categories: ['id', 'name', 'kind', 'group_name', 'archived_at', 'created_at', 'updated_at'],
  fin_tags: ['id', 'name', 'created_at', 'updated_at'],
  fin_transactions: ['id', 'type', 'amount', 'date', 'account_id', 'to_account_id', 'category_id', 'refund_of_id',
    'payee', 'note', 'created_at', 'updated_at'],
  fin_splits: ['id', 'tx_id', 'category_id', 'amount', 'created_at', 'updated_at'],
  fin_tx_tags: ['id', 'tx_id', 'tag_id', 'created_at', 'updated_at'],
  fin_goals: ['id', 'title', 'target', 'target_date', 'monthly', 'growth_bp', 'goal_id', 'archived_at', 'created_at', 'updated_at'],
  fin_allocations: ['id', 'fin_goal_id', 'amount', 'date', 'note', 'created_at', 'updated_at'],
  fin_budgets: ['id', 'category_id', 'amount', 'created_at', 'updated_at'],
  fin_plans: ['id', 'title', 'direction', 'amount', 'cadence', 'nature', 'due_date', 'category_id', 'account_id',
    'archived_at', 'created_at', 'updated_at'],
  learn_topics: ['id', 'subject', 'name', 'note', 'focus', 'target_score', 'target_date', 'archived_at', 'created_at', 'updated_at'],
  learn_checkins: ['id', 'topic_id', 'date', 'score', 'minutes', 'covered', 'note', 'created_at', 'updated_at'],
} as const;
const LEARNING_TABLES: BackupTable[] = ['learn_topics', 'learn_checkins'];
const FINANCE_TABLES = Object.keys(BACKUP_COLUMNS).filter((name) => name.startsWith('fin_')) as BackupTable[];
export type BackupTable = keyof typeof BACKUP_COLUMNS;
export type BackupRow = Record<string, string | number | null>;
export interface Backup {
  format: 'evrida-backup' | 'eonward-backup'; version: 2 | 3 | 4 | 5 | 6; schemaVersion: 8 | 9 | 10 | 11 | 12; createdAt: string;
  tables: Record<BackupTable, BackupRow[]>;
}
export const MAX_BACKUP_BYTES = 10 * 1024 * 1024;
const fail = (message: string): never => { throw new Error(`Invalid backup: ${message}`); };
const stamp = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value))
  && new Date(value).toISOString() === value;
const identifier = (value: unknown) => typeof value === 'string' && value.length > 0 && value.length <= 200;

/** Strict allowlist, bounded size, complete references and cycle checks before any write. */
export function parseBackup(text: string): Backup {
  if (text.length > MAX_BACKUP_BYTES) fail('file is larger than 10 MB.');
  let bytes = 0;
  for (const character of text) {
    const point = character.codePointAt(0)!;
    bytes += point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4;
    if (bytes > MAX_BACKUP_BYTES) fail('file is larger than 10 MB.');
  }
  let data: Backup;
  try { data = JSON.parse(text) as Backup; } catch { return fail('not valid JSON.'); }
  const incomingVersion: number = data?.version;
  const incomingSchema: number = data?.schemaVersion;
  if (!data || !['eonward-backup', 'evrida-backup'].includes(data.format) ||
    !((incomingVersion === 1 && incomingSchema === 7) || (incomingVersion === 2 && incomingSchema === 8)
      || (incomingVersion === 3 && incomingSchema === 9) || (incomingVersion === 4 && incomingSchema === 10)
      || (incomingVersion === 5 && incomingSchema === 11)
      || (incomingVersion === 6 && incomingSchema === 12)) ||
    !stamp(data.createdAt) || !data.tables || Array.isArray(data.tables)) fail('unsupported format or version.');
  if (incomingVersion === 1) {
    // Validate legacy row shapes before adding the new opt-in columns.
    for (const table of Object.keys(V1_COLUMNS) as (keyof typeof V1_COLUMNS)[]) {
      const rows = data.tables[table];
      const columns: readonly string[] = V1_COLUMNS[table];
      if (!Array.isArray(rows) || rows.some((row) => !row || typeof row !== 'object'
        || Object.keys(row).length !== columns.length || Object.keys(row).some((key) => !columns.includes(key)))) {
        fail('invalid legacy ' + table + ' fields.');
      }
    }
    if (Object.keys(data.tables).some((key) => !(key in V1_COLUMNS))) fail('unexpected legacy collection.');
    data = { ...data, version: 2, schemaVersion: 8, tables: {
      ...data.tables,
      time_blocks: data.tables.time_blocks.map((row) => ({ ...row, flexible: 0 })),
      focus_history: data.tables.focus_history.map((row) => ({ ...row, goal_id: null, block_id: null })),
      time_budgets: [],
    } };
  }
  if (data.version === 2) {
    // Older backups predate optional finance; they carry none of its tables.
    if (FINANCE_TABLES.some((name) => name in data.tables)) fail('unexpected collection.');
    data = { ...data, version: 4, schemaVersion: 10, tables: {
      ...data.tables, ...Object.fromEntries(FINANCE_TABLES.map((name) => [name, []])),
    } };
  }
  if (data.version === 3) {
    // Version 3 finance settings predate the optional dollar rate.
    if (!Array.isArray(data.tables.fin_settings)) fail('invalid fin_settings collection.');
    data = { ...data, version: 4, schemaVersion: 10, tables: { ...data.tables,
      fin_settings: data.tables.fin_settings.map((row) => ({ ...row, usd_rate_x100: null, usd_rate_date: null, usd_rate_source: null })) } };
  }
  if (data.version === 4) {
    // Version 4 predates the optional learning tracker.
    if (LEARNING_TABLES.some((name) => name in data.tables)) fail('unexpected collection.');
    data = { ...data, version: 5, schemaVersion: 11, tables: {
      ...data.tables, ...Object.fromEntries(LEARNING_TABLES.map((name) => [name, []])),
    } };
  }
  if (data.version === 5) {
    // Version 5 learning topics predate the optional target score and date.
    if (!Array.isArray(data.tables.learn_topics)) fail('invalid learn_topics collection.');
    data = { ...data, version: 6, schemaVersion: 12, tables: { ...data.tables,
      learn_topics: data.tables.learn_topics.map((row) => ({ ...row, target_score: null, target_date: null })) } };
  }
  if (Object.keys(data.tables).some((key) => !(key in BACKUP_COLUMNS))) fail('unexpected collection.');
  for (const table of Object.keys(BACKUP_COLUMNS) as BackupTable[]) {
    const rows = data.tables[table];
    if (!Array.isArray(rows) || rows.length > 50000) fail(`invalid ${table} collection.`);
    const ids = new Set();
    for (const row of rows) {
      if (!row || typeof row !== 'object' || Array.isArray(row)) fail(`invalid ${table} row.`);
      const columns: readonly string[] = BACKUP_COLUMNS[table];
      if (Object.keys(row).length !== columns.length || Object.keys(row).some((key) => !columns.includes(key))) fail(`unexpected ${table} fields.`);
      for (const key of columns) {
        if (!(key in row)) fail(`missing ${key}.`);
        const value = row[key];
        if (value !== null && typeof value !== 'string' && typeof value !== 'number') fail(`invalid ${key}.`);
        if (typeof value === 'number' && !Number.isSafeInteger(value)) fail(`invalid number in ${key}.`);
        if (typeof value === 'string' && value.length > 1000000) fail(`oversized ${key}.`);
        if (['created_at', 'updated_at', 'added_at', 'occurred_at'].includes(key) && !stamp(value)) fail(`invalid ${key}.`);
        if (key === 'archived_at' && value !== null && !stamp(value)) fail('invalid archive date.');
      }
      const id = table === 'board_goals' ? JSON.stringify([row.board_id, row.goal_id]) :
        table === 'time_budgets' ? row.goal_id : row.id;
      // Board membership is a pair of individually valid IDs. Its JSON tuple
      // can exceed the 200-character *single-ID* limit without either ID being invalid.
      const validKey = table === 'board_goals'
        ? identifier(row.board_id) && identifier(row.goal_id) : identifier(id);
      if (!validKey || ids.has(id)) fail(`duplicate or invalid ${table} ID.`);
      ids.add(id);
    }
  }
  const goals = new Map(data.tables.goals.map((row) => [row.id, row]));
  const boards = new Set(data.tables.boards.map((row) => row.id));
  const recurrenceSources = new Set();
  for (const row of data.tables.goals) {
    if (typeof row.title !== 'string' || !row.title.trim() || row.title.length > 180 || typeof row.notes !== 'string'
      || !HORIZONS.includes(row.horizon as never) || ![0, 1].includes(row.completed as number)
      || ![0, 1].includes(row.in_inbox as number) || typeof row.sort_rank !== 'number'
      || !REPEAT_RULES.includes(row.repeat_rule as never) || typeof row.period_key !== 'string') fail('invalid goal.');
    for (const key of ['parent_id', 'recurrence_from_id']) {
      if (row[key] !== null && (!identifier(row[key]) || !goals.has(row[key]))) fail(`missing ${key} goal.`);
    }
    if (row.archived_at !== null && !stamp(row.archived_at)) fail('invalid archive date.');
    if (row.due_date !== null && typeof row.due_date !== 'string') fail('invalid deadline.');
    if (row.reviewed_period !== null && typeof row.reviewed_period !== 'string') fail('invalid review period.');
    if (row.repeat_anchor !== null && (typeof row.repeat_anchor !== 'string' || !parseDateInput(row.repeat_anchor))) fail('invalid repeat anchor.');
    if (row.in_inbox === 1 && row.period_key !== '') fail('Inbox must have no planning period.');
    validatePlanning({ horizon: row.horizon as never, periodKey: row.period_key as string,
      inbox: row.in_inbox === 1, dueDate: row.due_date as string | null, repeatRule: row.repeat_rule as never });
    if (row.recurrence_from_id !== null) {
      if (recurrenceSources.has(row.recurrence_from_id) || row.recurrence_from_id === row.id) fail('duplicate recurrence occurrence.');
      recurrenceSources.add(row.recurrence_from_id);
    }
  }
  // Visiting each node at most twice avoids quadratic validation of a long chain.
  for (const relation of ['parent_id', 'recurrence_from_id']) {
    const finished = new Set();
    for (const row of goals.values()) {
      const path = new Set(); let cursor: BackupRow | undefined = row;
      while (cursor && !finished.has(cursor.id)) {
        if (path.has(cursor.id)) fail(`cycle in ${relation}.`);
        path.add(cursor.id); cursor = goals.get(cursor[relation]);
      }
      for (const id of path) finished.add(id);
    }
  }
  for (const row of data.tables.boards) {
    if (typeof row.title !== 'string' || !row.title.trim() || row.title.length > 100 || typeof row.description !== 'string') fail('invalid board.');
  }
  for (const row of data.tables.board_goals) {
    if (!goals.has(row.goal_id) || !boards.has(row.board_id)) fail('missing board membership target.');
  }
  for (const row of data.tables.time_blocks) {
    if (!goals.has(row.goal_id) || !stamp(row.start_at) || !stamp(row.end_at)
      || (Date.parse(String(row.end_at)) - Date.parse(String(row.start_at))) < 60000
      || (Date.parse(String(row.end_at)) - Date.parse(String(row.start_at))) > 86400000
      || !['block', 'box'].includes(String(row.kind))
      || typeof row.intention !== 'string' || ![0, 1].includes(row.flexible as number)) fail('invalid time block.');
  }
  for (const row of data.tables.goal_activity) {
    if (!goals.has(row.goal_id) || !['completed', 'reopened'].includes(String(row.kind))) fail('invalid goal activity.');
  }
  for (const row of data.tables.focus_history) {
    if (typeof row.goal_title !== 'string' || !['completed', 'stopped', 'replaced'].includes(String(row.outcome))
      || ['started_at_ms', 'ended_at_ms', 'planned_ms', 'focused_ms'].some((key) => typeof row[key] !== 'number' || row[key] < 0)
      || Number(row.planned_ms) <= 0 || Number(row.focused_ms) > Number(row.planned_ms)
      || Number(row.ended_at_ms) < Number(row.started_at_ms)) fail('invalid focus history.');
  }
  for (const row of data.tables.time_budgets) {
    if (!goals.has(row.goal_id) || !Number.isInteger(row.weekly_minutes)
      || Number(row.weekly_minutes) < 30 || Number(row.weekly_minutes) > 10080) fail('invalid weekly time budget.');
  }
  validateFinanceBackup(data.tables, new Set(goals.keys()));
  validateLearningBackup(data.tables);
  for (const row of data.tables.focus_history) {
    if ((row.goal_id !== null && !identifier(row.goal_id)) ||
      (row.block_id !== null && !identifier(row.block_id))) fail('invalid focus attribution.');
  }
  return data;
}

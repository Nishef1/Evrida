import type { SQLiteDatabase } from 'expo-sqlite';

const INITIAL_SCHEMA = `
  CREATE TABLE IF NOT EXISTS goals (
    id TEXT PRIMARY KEY NOT NULL,
    title TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    horizon TEXT NOT NULL CHECK (horizon IN ('day', 'week', 'month', 'quarter', 'year', 'decade', 'life')),
    period_key TEXT NOT NULL,
    parent_id TEXT REFERENCES goals(id) ON DELETE SET NULL,
    completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0, 1)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS goals_horizon_period
    ON goals (horizon, period_key, completed, created_at);
  CREATE INDEX IF NOT EXISTS goals_parent ON goals (parent_id);
`;

const V2_SCHEMA = `
  ALTER TABLE goals ADD COLUMN archived_at TEXT;
  ALTER TABLE goals ADD COLUMN sort_rank INTEGER NOT NULL DEFAULT 0;
  CREATE INDEX IF NOT EXISTS goals_archive ON goals (archived_at);
`;

const V3_SCHEMA = `
  CREATE TABLE IF NOT EXISTS boards (
    id TEXT PRIMARY KEY NOT NULL,
    title TEXT NOT NULL CHECK (length(trim(title)) > 0),
    description TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS board_goals (
    board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
    added_at TEXT NOT NULL,
    PRIMARY KEY (board_id, goal_id)
  );
  CREATE INDEX IF NOT EXISTS board_goals_by_goal ON board_goals(goal_id);
`;

const V4_SCHEMA = `
  CREATE TABLE IF NOT EXISTS time_blocks (
    id TEXT PRIMARY KEY NOT NULL,
    goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
    start_at TEXT NOT NULL,
    end_at TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'block' CHECK (kind IN ('block', 'box')),
    intention TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CHECK (end_at > start_at)
  );
  CREATE INDEX IF NOT EXISTS time_blocks_by_start ON time_blocks(start_at, end_at);
  CREATE INDEX IF NOT EXISTS time_blocks_by_goal ON time_blocks(goal_id, start_at);
`;

const V5_SCHEMA = `
  CREATE TABLE IF NOT EXISTS focus_session (
    id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
    block_id TEXT NOT NULL REFERENCES time_blocks(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('running', 'paused')),
    duration_ms INTEGER NOT NULL CHECK (duration_ms > 0),
    remaining_ms INTEGER NOT NULL CHECK (remaining_ms >= 0),
    deadline_ms INTEGER NOT NULL,
    updated_at_ms INTEGER NOT NULL
  );
`;

const V6_SCHEMA = `
  ALTER TABLE focus_session ADD COLUMN started_at_ms INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE focus_session ADD COLUMN elapsed_ms INTEGER NOT NULL DEFAULT 0;
  -- v5 records the remaining time at every pause, so duration - remaining
  -- reconstructs earlier active segments even when the timer was resumed.
  UPDATE focus_session SET
    started_at_ms = MAX(0, updated_at_ms - (duration_ms - remaining_ms)),
    elapsed_ms = MAX(0, duration_ms - remaining_ms);
  CREATE TABLE IF NOT EXISTS focus_history (
    id TEXT PRIMARY KEY NOT NULL,
    goal_title TEXT NOT NULL,
    started_at_ms INTEGER NOT NULL,
    ended_at_ms INTEGER NOT NULL,
    planned_ms INTEGER NOT NULL CHECK (planned_ms > 0),
    focused_ms INTEGER NOT NULL CHECK (focused_ms >= 0 AND focused_ms <= planned_ms),
    outcome TEXT NOT NULL CHECK (outcome IN ('completed', 'stopped', 'replaced'))
  );
  CREATE INDEX IF NOT EXISTS focus_history_by_end ON focus_history (ended_at_ms DESC);
`;

const V7_SCHEMA = `
  ALTER TABLE goals ADD COLUMN in_inbox INTEGER NOT NULL DEFAULT 0 CHECK (in_inbox IN (0, 1));
  ALTER TABLE goals ADD COLUMN due_date TEXT;
  ALTER TABLE goals ADD COLUMN repeat_rule TEXT NOT NULL DEFAULT 'none'
    CHECK (repeat_rule IN ('none', 'daily', 'weekly', 'monthly', 'yearly'));
  ALTER TABLE goals ADD COLUMN repeat_anchor TEXT;
  ALTER TABLE goals ADD COLUMN recurrence_from_id TEXT REFERENCES goals(id) ON DELETE SET NULL;
  ALTER TABLE goals ADD COLUMN reviewed_period TEXT;
  CREATE UNIQUE INDEX goals_recurrence_source ON goals(recurrence_from_id)
    WHERE recurrence_from_id IS NOT NULL;
  CREATE INDEX goals_inbox ON goals(in_inbox, archived_at);
  CREATE TABLE goal_activity (
    id TEXT PRIMARY KEY NOT NULL,
    goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('completed', 'reopened')),
    occurred_at TEXT NOT NULL
  );
  CREATE INDEX goal_activity_by_time ON goal_activity(occurred_at, goal_id);
`;

const V8_SCHEMA = `
  -- Old reservations remain protected until a user explicitly makes them flexible.
  ALTER TABLE time_blocks ADD COLUMN flexible INTEGER NOT NULL DEFAULT 0 CHECK (flexible IN (0, 1));
  -- Old focus rows remain unattributed; never guess identities from a title.
  ALTER TABLE focus_history ADD COLUMN goal_id TEXT;
  ALTER TABLE focus_history ADD COLUMN block_id TEXT;
  CREATE INDEX focus_history_by_goal_end ON focus_history(goal_id, ended_at_ms);
  CREATE TABLE time_budgets (
    goal_id TEXT PRIMARY KEY NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
    weekly_minutes INTEGER NOT NULL CHECK (weekly_minutes >= 30 AND weekly_minutes <= 10080)
  );
  -- One reversible replan, never included in a portable backup.
  CREATE TABLE replan_checkpoint (
    id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
    before_json TEXT NOT NULL,
    after_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`;

const V9_SCHEMA = `
  -- Optional personal finance. Amounts are integers in the smallest displayed unit of one
  -- reporting unit; percentages are basis points. Nothing here is required by planning.
  CREATE TABLE IF NOT EXISTS fin_settings (
    id TEXT PRIMARY KEY NOT NULL CHECK (id = 'main'),
    unit TEXT NOT NULL CHECK (length(trim(unit)) > 0),
    decimals INTEGER NOT NULL CHECK (decimals IN (0, 2)),
    inflation_bp INTEGER,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS fin_accounts (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL CHECK (length(trim(name)) > 0),
    kind TEXT NOT NULL CHECK (kind IN ('cash', 'bank', 'wallet', 'liability')),
    opening INTEGER NOT NULL DEFAULT 0,
    archived_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS fin_categories (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL CHECK (length(trim(name)) > 0),
    kind TEXT NOT NULL CHECK (kind IN ('income', 'expense')),
    group_name TEXT NOT NULL,
    archived_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS fin_tags (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE CHECK (length(trim(name)) > 0),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS fin_transactions (
    id TEXT PRIMARY KEY NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer', 'adjustment')),
    amount INTEGER NOT NULL CHECK (amount <> 0),
    date TEXT NOT NULL,
    account_id TEXT NOT NULL REFERENCES fin_accounts(id) ON DELETE RESTRICT,
    to_account_id TEXT REFERENCES fin_accounts(id) ON DELETE RESTRICT,
    category_id TEXT REFERENCES fin_categories(id) ON DELETE RESTRICT,
    refund_of_id TEXT REFERENCES fin_transactions(id) ON DELETE SET NULL,
    payee TEXT NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS fin_tx_by_date ON fin_transactions(date, created_at);
  CREATE INDEX IF NOT EXISTS fin_tx_by_account ON fin_transactions(account_id);
  CREATE TABLE IF NOT EXISTS fin_splits (
    id TEXT PRIMARY KEY NOT NULL,
    tx_id TEXT NOT NULL REFERENCES fin_transactions(id) ON DELETE CASCADE,
    category_id TEXT NOT NULL REFERENCES fin_categories(id) ON DELETE RESTRICT,
    amount INTEGER NOT NULL CHECK (amount > 0),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS fin_splits_by_tx ON fin_splits(tx_id);
  CREATE TABLE IF NOT EXISTS fin_tx_tags (
    id TEXT PRIMARY KEY NOT NULL,
    tx_id TEXT NOT NULL REFERENCES fin_transactions(id) ON DELETE CASCADE,
    tag_id TEXT NOT NULL REFERENCES fin_tags(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (tx_id, tag_id)
  );
  CREATE TABLE IF NOT EXISTS fin_goals (
    id TEXT PRIMARY KEY NOT NULL,
    title TEXT NOT NULL CHECK (length(trim(title)) > 0),
    target INTEGER NOT NULL CHECK (target > 0),
    target_date TEXT,
    monthly INTEGER NOT NULL DEFAULT 0 CHECK (monthly >= 0),
    growth_bp INTEGER,
    goal_id TEXT REFERENCES goals(id) ON DELETE SET NULL,
    archived_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  -- Only explicit allocations count toward a money goal; tagging a purchase never does.
  CREATE TABLE IF NOT EXISTS fin_allocations (
    id TEXT PRIMARY KEY NOT NULL,
    fin_goal_id TEXT NOT NULL REFERENCES fin_goals(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL CHECK (amount <> 0),
    date TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS fin_alloc_by_goal ON fin_allocations(fin_goal_id, date);
  CREATE TABLE IF NOT EXISTS fin_budgets (
    id TEXT PRIMARY KEY NOT NULL,
    category_id TEXT REFERENCES fin_categories(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL CHECK (amount > 0),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  -- Planned items are forecasts. Confirming one records a real transaction.
  CREATE TABLE IF NOT EXISTS fin_plans (
    id TEXT PRIMARY KEY NOT NULL,
    title TEXT NOT NULL CHECK (length(trim(title)) > 0),
    direction TEXT NOT NULL CHECK (direction IN ('income', 'expense')),
    amount INTEGER NOT NULL CHECK (amount > 0),
    cadence TEXT NOT NULL CHECK (cadence IN ('monthly', 'yearly')),
    nature TEXT NOT NULL CHECK (nature IN ('fixed', 'flexible', 'irregular')),
    due_date TEXT NOT NULL,
    category_id TEXT REFERENCES fin_categories(id) ON DELETE SET NULL,
    account_id TEXT REFERENCES fin_accounts(id) ON DELETE SET NULL,
    archived_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`;

const V10_SCHEMA = `
  -- An optional, dated exchange rate (units of the reporting currency per 1 USD, times 100)
  -- used only to show amounts in dollars. It never changes any stored amount.
  ALTER TABLE fin_settings ADD COLUMN usd_rate_x100 INTEGER;
  ALTER TABLE fin_settings ADD COLUMN usd_rate_date TEXT;
  ALTER TABLE fin_settings ADD COLUMN usd_rate_source TEXT;
`;

const V11_SCHEMA = `
  -- Optional learning tracker. Scores are the user's own self-ratings (1-10); minutes practised
  -- are stored separately because time spent is not mastery.
  CREATE TABLE IF NOT EXISTS learn_topics (
    id TEXT PRIMARY KEY NOT NULL,
    subject TEXT NOT NULL CHECK (length(trim(subject)) > 0),
    name TEXT NOT NULL CHECK (length(trim(name)) > 0),
    note TEXT NOT NULL DEFAULT '',
    focus INTEGER NOT NULL DEFAULT 0 CHECK (focus IN (0, 1)),
    archived_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS learn_checkins (
    id TEXT PRIMARY KEY NOT NULL,
    topic_id TEXT NOT NULL REFERENCES learn_topics(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    score INTEGER NOT NULL CHECK (score BETWEEN 1 AND 10),
    minutes INTEGER CHECK (minutes IS NULL OR (minutes >= 0 AND minutes <= 10080)),
    covered TEXT NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS learn_checkins_by_topic_date ON learn_checkins(topic_id, date);
`;
const V12_SCHEMA = `
  -- Optional personal target for a learning topic: the score the user wants and an optional date.
  ALTER TABLE learn_topics ADD COLUMN target_score INTEGER CHECK (target_score IS NULL OR (target_score BETWEEN 1 AND 10));
  ALTER TABLE learn_topics ADD COLUMN target_date TEXT;
`;
const V13_SCHEMA = `
  -- A learning topic can support one planning goal. Optional; the goal is never copied.
  ALTER TABLE learn_topics ADD COLUMN goal_id TEXT REFERENCES goals(id) ON DELETE SET NULL;
`;
export const SCHEMA_VERSION = 13;

export async function migrateDatabase(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
  const result = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const version = result?.user_version ?? 0;
  if (version > SCHEMA_VERSION) throw new Error('This app version cannot read a newer Evrida database.');
  if (version === SCHEMA_VERSION) return;

  // Startup runs on the single process-wide connection. Opening an exclusive
  // second connection here can contend with initialization on Android.
  await db.withTransactionAsync(async () => {
    const tx = db;
    if (version === 0) await tx.execAsync(INITIAL_SCHEMA);
    if (version <= 1) await tx.execAsync(V2_SCHEMA);
    if (version <= 2) await tx.execAsync(V3_SCHEMA);
    if (version <= 3) await tx.execAsync(V4_SCHEMA);
    if (version <= 4) await tx.execAsync(V5_SCHEMA);
    if (version <= 5) await tx.execAsync(V6_SCHEMA);
    if (version <= 6) await tx.execAsync(V7_SCHEMA);
    if (version <= 7) await tx.execAsync(V8_SCHEMA);
    if (version <= 8) await tx.execAsync(V9_SCHEMA);
    if (version <= 9) await tx.execAsync(V10_SCHEMA);
    if (version <= 10) await tx.execAsync(V11_SCHEMA);
    if (version <= 11) await tx.execAsync(V12_SCHEMA);
    if (version <= 12) await tx.execAsync(V13_SCHEMA);
    await tx.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION};`);
  });
}

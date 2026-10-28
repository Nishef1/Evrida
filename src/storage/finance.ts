import { randomUUID } from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';
import {
  ACCOUNT_KINDS, CADENCES, DEFAULT_CATEGORIES, NATURES, addMonthsToDate, isDateKey, unallocatedFunds, validateTx,
  type AllocationBucket, type IncomeAllocation, type AccountKind, type Cadence, type FinAccount, type FinAllocation, type FinBudget, type FinCategory,
  type FinGoal, type FinPlan, type FinSettings, type FinTx, type Nature, type TxType,
} from '../domain/finance';

export interface FinTag { id: string; name: string }
export interface FinanceSnapshot {
  settings: FinSettings;
  accounts: FinAccount[]; categories: FinCategory[]; tags: FinTag[]; txs: FinTx[];
  goals: FinGoal[]; allocations: FinAllocation[]; budgets: FinBudget[]; plans: FinPlan[];
  incomeAllocation: IncomeAllocation | null; categoryPurposes: Record<string, AllocationBucket>;
}
type Row = Record<string, any>;
type Reader = Pick<SQLiteDatabase, 'getFirstAsync' | 'getAllAsync'>;

const now = () => new Date().toISOString();
const clean = (value: string, max: number, what: string): string => {
  const v = value.trim().replace(/\s+/g, ' ');
  if (!v || v.length > max) throw new Error(`${what} must be between 1 and ${max} characters.`);
  return v;
};

/** Finance is optional: null until the user chooses to set it up. */
export async function loadFinance(db: Reader): Promise<FinanceSnapshot | null> {
  const s = await db.getFirstAsync<{ unit: string; decimals: 0 | 2; inflation_bp: number | null;
    usd_rate_x100: number | null; usd_rate_date: string | null; usd_rate_source: string | null }>(
  "SELECT unit, decimals, inflation_bp, usd_rate_x100, usd_rate_date, usd_rate_source FROM fin_settings WHERE id = 'main'");
  if (!s) return null;
  const accounts = await db.getAllAsync<Row>('SELECT * FROM fin_accounts ORDER BY created_at, id');
  const categories = await db.getAllAsync<Row>('SELECT * FROM fin_categories ORDER BY kind, group_name, name');
  const tags = await db.getAllAsync<FinTag>('SELECT id, name FROM fin_tags ORDER BY name COLLATE NOCASE');
  const txRows = await db.getAllAsync<Row>('SELECT * FROM fin_transactions ORDER BY date DESC, created_at DESC');
  const splits = await db.getAllAsync<Row>('SELECT tx_id, category_id, amount FROM fin_splits ORDER BY created_at, id');
  const links = await db.getAllAsync<Row>('SELECT tx_id, tag_id FROM fin_tx_tags');
  const goals = await db.getAllAsync<Row>('SELECT * FROM fin_goals ORDER BY created_at, id');
  const allocations = await db.getAllAsync<Row>('SELECT * FROM fin_allocations ORDER BY date, created_at');
  const budgets = await db.getAllAsync<Row>('SELECT * FROM fin_budgets');
  const plans = await db.getAllAsync<Row>('SELECT * FROM fin_plans ORDER BY due_date, title');
  const incomeAllocation = await db.getFirstAsync<IncomeAllocation>("SELECT needs, wants, future FROM fin_allocation_plan WHERE id = 'main'");
  const purposes = await db.getAllAsync<{ id: string; bucket: AllocationBucket }>('SELECT id, bucket FROM fin_category_purpose');
  const splitsBy = new Map<string, { categoryId: string; amount: number }[]>();
  for (const r of splits) splitsBy.set(r.tx_id, [...(splitsBy.get(r.tx_id) ?? []), { categoryId: r.category_id, amount: r.amount }]);
  const tagsBy = new Map<string, string[]>();
  for (const r of links) tagsBy.set(r.tx_id, [...(tagsBy.get(r.tx_id) ?? []), r.tag_id]);
  return {
    settings: { unit: s.unit, decimals: s.decimals, inflationBp: s.inflation_bp,
      usdRateX100: s.usd_rate_x100, usdRateDate: s.usd_rate_date, usdRateSource: s.usd_rate_source },
    accounts: accounts.map((r) => ({ id: r.id, name: r.name, kind: r.kind, opening: r.opening, archived: !!r.archived_at })),
    categories: categories.map((r) => ({ id: r.id, name: r.name, kind: r.kind, group: r.group_name, archived: !!r.archived_at })),
    tags, incomeAllocation: incomeAllocation ? { needs: incomeAllocation.needs, wants: incomeAllocation.wants, future: incomeAllocation.future } : null, categoryPurposes: Object.fromEntries(purposes.map((p) => [p.id, p.bucket])),
    txs: txRows.map((r) => ({
      id: r.id, type: r.type, amount: r.amount, date: r.date, accountId: r.account_id, toAccountId: r.to_account_id,
      categoryId: r.category_id, refundOfId: r.refund_of_id, payee: r.payee, note: r.note,
      tagIds: tagsBy.get(r.id) ?? [], splits: splitsBy.get(r.id) ?? [],
    })),
    goals: goals.map((r) => ({
      id: r.id, title: r.title, target: r.target, targetDate: r.target_date, monthly: r.monthly,
      growthBp: r.growth_bp, linkedGoalId: r.goal_id, archived: !!r.archived_at,
    })),
    allocations: allocations.map((r) => ({ id: r.id, goalId: r.fin_goal_id, amount: r.amount, date: r.date, note: r.note })),
    budgets: budgets.map((r) => ({ id: r.id, categoryId: r.category_id, amount: r.amount })),
    plans: plans.map((r) => ({
      id: r.id, title: r.title, direction: r.direction, amount: r.amount, cadence: r.cadence, nature: r.nature,
      dueDate: r.due_date, categoryId: r.category_id, accountId: r.account_id, archived: !!r.archived_at,
    })),
  };
}

/** Save a deliberate, editable plan. Percentages are whole numbers totaling 100. */
export async function setAllocationPlan(db: SQLiteDatabase, plan: IncomeAllocation): Promise<void> {
  if (![plan.needs, plan.wants, plan.future].every((n) => Number.isInteger(n) && n >= 0 && n <= 100) ||
      plan.needs + plan.wants + plan.future !== 100) throw new Error('Percentages must be whole numbers that add up to 100.');
  await db.withExclusiveTransactionAsync(async (tx) => {
    if (!await tx.getFirstAsync("SELECT id FROM fin_settings WHERE id = 'main'")) throw new Error('Set up Money first.');
    await tx.runAsync(`INSERT INTO fin_allocation_plan (id, needs, wants, future) VALUES ('main', ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET needs = excluded.needs, wants = excluded.wants, future = excluded.future`,
      [plan.needs, plan.wants, plan.future]);
  });
}
export async function setCategoryPurpose(db: SQLiteDatabase, categoryId: string, bucket: AllocationBucket | null): Promise<void> {
  if (bucket !== null && !['needs', 'wants', 'future'].includes(bucket)) throw new Error('Choose a valid group.');
  await db.withExclusiveTransactionAsync(async (tx) => {
    const category = await tx.getFirstAsync<{ kind: string }>('SELECT kind FROM fin_categories WHERE id = ?', [categoryId]);
    if (!category || category.kind !== 'expense') throw new Error('Choose an expense category.');
    if (bucket === null) await tx.runAsync('DELETE FROM fin_category_purpose WHERE id = ?', [categoryId]);
    else await tx.runAsync(`INSERT INTO fin_category_purpose (id, bucket) VALUES (?, ?)
      ON CONFLICT(id) DO UPDATE SET bucket = excluded.bucket`, [categoryId, bucket]);
  });
}

/** Choose the reporting unit once. Decimals are fixed afterwards so stored amounts keep their meaning. */
export async function setupFinance(db: SQLiteDatabase, input: { unit: string; decimals: 0 | 2; accountName: string; opening: number }): Promise<void> {
  const unit = clean(input.unit, 16, 'Currency or unit');
  const accountName = clean(input.accountName, 80, 'Account name');
  if (!Number.isSafeInteger(input.opening)) throw new Error('Enter a valid opening balance.');
  const stamp = now();
  await db.withExclusiveTransactionAsync(async (tx) => {
    if (await tx.getFirstAsync('SELECT 1 FROM fin_settings')) throw new Error('Money is already set up.');
    await tx.runAsync('INSERT INTO fin_settings (id, unit, decimals, inflation_bp, created_at, updated_at) VALUES (?, ?, ?, NULL, ?, ?)',
      ['main', unit, input.decimals, stamp, stamp]);
    for (const group of DEFAULT_CATEGORIES) {
      for (const name of group.names) {
        await tx.runAsync(`INSERT INTO fin_categories (id, name, kind, group_name, archived_at, created_at, updated_at)
          VALUES (?, ?, ?, ?, NULL, ?, ?)`, [randomUUID(), name, group.kind, group.group, stamp, stamp]);
      }
    }
    await tx.runAsync(`INSERT INTO fin_accounts (id, name, kind, opening, archived_at, created_at, updated_at)
      VALUES (?, ?, 'bank', ?, NULL, ?, ?)`, [randomUUID(), accountName, input.opening, stamp, stamp]);
  });
}

export async function updateFinanceSettings(db: SQLiteDatabase, input: {
  unit: string; inflationBp: number | null; usdRateX100: number | null; usdRateDate: string | null; usdRateSource: string | null;
}): Promise<void> {
  if (input.usdRateX100 !== null && (!Number.isSafeInteger(input.usdRateX100) || input.usdRateX100 <= 0 || !input.usdRateDate || !isDateKey(input.usdRateDate))) {
    throw new Error('A dollar rate needs a positive value and the date it applies to.');
  }
  const unit = clean(input.unit, 16, 'Currency or unit');
  if (input.inflationBp !== null && (!Number.isSafeInteger(input.inflationBp) || input.inflationBp < 0 || input.inflationBp > 1000000)) {
    throw new Error('Enter an inflation rate between 0% and 10,000%.');
  }
  await db.withExclusiveTransactionAsync(async (tx) => {
    const current = await tx.getFirstAsync<{ unit: string; usd_rate_x100: number | null; usd_rate_date: string | null }>(
      "SELECT unit, usd_rate_x100, usd_rate_date FROM fin_settings WHERE id = 'main'");
    if (!current) throw new Error('Set up Money first.');
    const unitChanged = current.unit.trim().toLowerCase() !== unit.trim().toLowerCase();
    const reusedOldRate = input.usdRateX100 !== null && input.usdRateX100 === current.usd_rate_x100
      && input.usdRateDate === current.usd_rate_date;
    const clearRate = unitChanged && reusedOldRate;
    const rate = clearRate ? null : input.usdRateX100;
    const dated = rate === null;
    await tx.runAsync(`UPDATE fin_settings SET unit = ?, inflation_bp = ?, usd_rate_x100 = ?, usd_rate_date = ?, usd_rate_source = ?, updated_at = ?
      WHERE id = 'main'`, [unit, input.inflationBp, rate, dated ? null : input.usdRateDate,
      dated ? null : (input.usdRateSource ?? '').slice(0, 80) || null, now()]);
  });
}

export async function saveAccount(db: SQLiteDatabase, input: { id?: string; name: string; kind: AccountKind; opening: number }): Promise<string> {
  const name = clean(input.name, 80, 'Account name');
  if (!ACCOUNT_KINDS.includes(input.kind) || !Number.isSafeInteger(input.opening)) throw new Error('Check the account details.');
  const stamp = now();
  const id = input.id ?? randomUUID();
  await db.withExclusiveTransactionAsync(async (tx) => {
    if (input.id) {
      const current = await tx.getFirstAsync<{ kind: AccountKind; opening: number }>('SELECT kind, opening FROM fin_accounts WHERE id = ?', [input.id]);
      if (!current) throw new Error('This account no longer exists.');
      const hasTransactions = await tx.getFirstAsync('SELECT 1 FROM fin_transactions WHERE account_id = ? OR to_account_id = ? LIMIT 1', [input.id, input.id]);
      const hasPlans = await tx.getFirstAsync('SELECT 1 FROM fin_plans WHERE account_id = ? LIMIT 1', [input.id]);
      if (hasTransactions && current.opening !== input.opening) {
        throw new Error('Opening balance is locked after transactions exist. Add an adjustment to correct the balance.');
      }
      if (current.kind !== input.kind && (hasTransactions || hasPlans)) {
        throw new Error('Account type is locked after it is used. Create a new account with the correct type and transfer the balance instead.');
      }
      await tx.runAsync('UPDATE fin_accounts SET name = ?, kind = ?, opening = ?, updated_at = ? WHERE id = ?',
        [name, input.kind, input.opening, stamp, input.id]);
      return;
    }
    await tx.runAsync(`INSERT INTO fin_accounts (id, name, kind, opening, archived_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, NULL, ?, ?)`, [id, name, input.kind, input.opening, stamp, stamp]);
  });
  return id;
}
export async function setAccountArchived(db: SQLiteDatabase, id: string, archived: boolean): Promise<void> {
  await db.runAsync('UPDATE fin_accounts SET archived_at = ?, updated_at = ? WHERE id = ?', [archived ? now() : null, now(), id]);
}

export async function saveCategory(db: SQLiteDatabase, input: { id?: string; name: string; kind: 'income' | 'expense'; group: string }): Promise<string> {
  const name = clean(input.name, 80, 'Category name');
  const group = clean(input.group || name, 80, 'Group');
  const stamp = now();
  if (input.id) {
    await db.runAsync('UPDATE fin_categories SET name = ?, group_name = ?, updated_at = ? WHERE id = ?', [name, group, stamp, input.id]);
    return input.id;
  }
  const id = randomUUID();
  await db.runAsync(`INSERT INTO fin_categories (id, name, kind, group_name, archived_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, NULL, ?, ?)`, [id, name, input.kind, group, stamp, stamp]);
  return id;
}
export async function setCategoryArchived(db: SQLiteDatabase, id: string, archived: boolean): Promise<void> {
  await db.runAsync('UPDATE fin_categories SET archived_at = ?, updated_at = ? WHERE id = ?', [archived ? now() : null, now(), id]);
}

export interface TxInput {
  type: TxType; amount: number; date: string; accountId: string; toAccountId: string | null;
  categoryId: string | null; refundOfId: string | null; payee: string; note: string;
  tagNames: string[]; splits: { categoryId: string; amount: number }[];
}

type Writer = Pick<SQLiteDatabase, 'getFirstAsync' | 'getAllAsync' | 'runAsync'>;
type CategoryLine = { categoryId: string; amount: number };

async function storedLines(tx: Writer, id: string, amount: number, categoryId: string | null): Promise<CategoryLine[]> {
  const splits = await tx.getAllAsync<{ category_id: string; amount: number }>(
    'SELECT category_id, amount FROM fin_splits WHERE tx_id = ?', [id]);
  return splits.length ? splits.map((s) => ({ categoryId: s.category_id, amount: s.amount }))
    : categoryId ? [{ categoryId, amount }] : [];
}
function inputLines(input: TxInput): CategoryLine[] {
  return input.splits.length ? input.splits.map((s) => ({ categoryId: s.categoryId, amount: s.amount }))
    : input.categoryId ? [{ categoryId: input.categoryId, amount: input.amount }] : [];
}
async function existingRefunds(tx: Writer, originalId: string, exceptId?: string): Promise<{ total: number; lines: CategoryLine[] }> {
  const rows = await tx.getAllAsync<{ id: string; amount: number; category_id: string | null }>(
    exceptId
      ? 'SELECT id, amount, category_id FROM fin_transactions WHERE refund_of_id = ? AND id <> ?'
      : 'SELECT id, amount, category_id FROM fin_transactions WHERE refund_of_id = ?',
    exceptId ? [originalId, exceptId] : [originalId]);
  const result = { total: 0, lines: [] as CategoryLine[] };
  for (const row of rows) {
    result.total += row.amount;
    const lines = await storedLines(tx, row.id, row.amount, row.category_id);
    if (lines.reduce((sum, line) => sum + line.amount, 0) !== row.amount) {
      throw new Error('An existing refund has invalid category details. Review the ledger before changing it.');
    }
    result.lines.push(...lines);
  }
  return result;
}
function assertRefundDistribution(originalLines: CategoryLine[], refundLines: CategoryLine[]): void {
  const capacity = new Map<string, number>();
  for (const line of originalLines) capacity.set(line.categoryId, (capacity.get(line.categoryId) ?? 0) + line.amount);
  const used = new Map<string, number>();
  for (const line of refundLines) {
    if (!capacity.has(line.categoryId)) throw new Error('A refund must use the original expense categories.');
    const next = (used.get(line.categoryId) ?? 0) + line.amount;
    if (next > capacity.get(line.categoryId)!) throw new Error('Refunds cannot exceed the original amount in each category.');
    used.set(line.categoryId, next);
  }
}
function prepareTransaction(input: TxInput, accountCount: number): string[] {
  const tagNames = [...new Map(input.tagNames.map((n) => n.trim().replace(/\s+/g, ' ')).filter(Boolean)
    .map((n) => [n.toLowerCase(), n])).values()];
  if (tagNames.some((n) => n.length > 40)) throw new Error('Tags can be up to 40 characters.');
  const problem = validateTx({ ...input, tagIds: [] }, accountCount);
  if (problem) throw new Error(problem);
  if (input.payee.length > 200 || input.note.length > 2000) throw new Error('Payee or note is too long.');
  return tagNames;
}

async function writeTransaction(tx: Writer, input: TxInput, tagNames: string[], id?: string): Promise<string> {
  const stamp = now();
  const txId = id ?? randomUUID();
  const category = input.splits.length ? null : input.categoryId;
  const account = await tx.getFirstAsync('SELECT 1 FROM fin_accounts WHERE id = ? AND archived_at IS NULL', [input.accountId]);
  if (!account) throw new Error('Choose an active account.');
  if (input.type === 'transfer') {
    const destination = await tx.getFirstAsync('SELECT 1 FROM fin_accounts WHERE id = ? AND archived_at IS NULL', [input.toAccountId]);
    if (!destination) throw new Error('Choose an active destination account.');
  }
  if (input.type === 'income' || input.type === 'expense') {
    const expectedKind = input.refundOfId ? 'expense' : input.type;
    for (const line of inputLines(input)) {
      const row = await tx.getFirstAsync<{ kind: string }>('SELECT kind FROM fin_categories WHERE id = ?', [line.categoryId]);
      if (row?.kind !== expectedKind) throw new Error(`Choose a valid ${expectedKind} category.`);
    }
  }
  if (input.refundOfId) {
    if (id && input.refundOfId === id) throw new Error('A transaction cannot be a refund of itself.');
    const original = await tx.getFirstAsync<{ id: string; type: string; amount: number; category_id: string | null }>(
      'SELECT id, type, amount, category_id FROM fin_transactions WHERE id = ?', [input.refundOfId]);
    if (original?.type !== 'expense') throw new Error('A refund must refer to an expense.');
    const prior = await existingRefunds(tx, input.refundOfId, id);
    if (prior.total + input.amount > original.amount) throw new Error('Refunds cannot exceed the original expense.');
    const originalLines = await storedLines(tx, original.id, original.amount, original.category_id);
    if (originalLines.reduce((sum, line) => sum + line.amount, 0) !== original.amount) {
      throw new Error('The original expense has invalid category details. Review it before recording a refund.');
    }
    assertRefundDistribution(originalLines, [...prior.lines, ...inputLines(input)]);
  }
  if (id) {
    const current = await tx.getFirstAsync<{ type: string; amount: number; category_id: string | null }>(
      'SELECT type, amount, category_id FROM fin_transactions WHERE id = ?', [id]);
    if (!current) throw new Error('This transaction no longer exists.');
    const refunds = await existingRefunds(tx, id);
    if (refunds.total > 0) {
      if (input.type !== 'expense' || input.amount < refunds.total) {
        throw new Error('This expense has refunds. Keep it as an expense and do not reduce it below the total refunded amount.');
      }
      const revisedLines = inputLines(input);
      if (revisedLines.reduce((sum, line) => sum + line.amount, 0) !== input.amount) {
        throw new Error('This expense has refunds. Keep its category details valid.');
      }
      assertRefundDistribution(revisedLines, refunds.lines);
    }
    const changed = await tx.runAsync(`UPDATE fin_transactions SET type = ?, amount = ?, date = ?, account_id = ?, to_account_id = ?,
      category_id = ?, refund_of_id = ?, payee = ?, note = ?, updated_at = ? WHERE id = ?`,
    [input.type, input.amount, input.date, input.accountId, input.toAccountId, category,
      input.refundOfId, input.payee.trim(), input.note.trim(), stamp, id]);
    if (!changed.changes) throw new Error('This transaction no longer exists.');
    await tx.runAsync('DELETE FROM fin_splits WHERE tx_id = ?', [id]);
    await tx.runAsync('DELETE FROM fin_tx_tags WHERE tx_id = ?', [id]);
  } else {
    await tx.runAsync(`INSERT INTO fin_transactions (id, type, amount, date, account_id, to_account_id, category_id, refund_of_id,
      payee, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [txId, input.type, input.amount, input.date, input.accountId, input.toAccountId, category,
      input.refundOfId, input.payee.trim(), input.note.trim(), stamp, stamp]);
  }
  for (const split of input.splits) {
    await tx.runAsync('INSERT INTO fin_splits (id, tx_id, category_id, amount, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [randomUUID(), txId, split.categoryId, split.amount, stamp, stamp]);
  }
  for (const name of tagNames) {
    let tag = await tx.getFirstAsync<{ id: string }>('SELECT id FROM fin_tags WHERE name = ?', [name]);
    if (!tag) {
      tag = { id: randomUUID() };
      await tx.runAsync('INSERT INTO fin_tags (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)', [tag.id, name, stamp, stamp]);
    }
    await tx.runAsync('INSERT INTO fin_tx_tags (id, tx_id, tag_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [randomUUID(), txId, tag.id, stamp, stamp]);
  }
  return txId;
}

const activeAccounts = async (db: Reader): Promise<number> =>
  (await db.getFirstAsync<{ n: number }>('SELECT count(*) AS n FROM fin_accounts WHERE archived_at IS NULL'))?.n ?? 0;

/** Insert or replace one transaction with its splits and tags atomically. Tags are created on first use. */
export async function saveTransaction(db: SQLiteDatabase, input: TxInput, id?: string): Promise<string> {
  const tagNames = prepareTransaction(input, await activeAccounts(db));
  let txId = id ?? '';
  await db.withExclusiveTransactionAsync(async (tx) => { txId = await writeTransaction(tx, input, tagNames, id); });
  return txId;
}
export async function deleteTransaction(db: SQLiteDatabase, id: string): Promise<void> {
  // Check and delete in the same exclusive transaction so a concurrent refund cannot race this guard.
  await db.withExclusiveTransactionAsync(async (tx) => {
    if (await tx.getFirstAsync('SELECT 1 FROM fin_transactions WHERE refund_of_id = ? LIMIT 1', [id])) {
      throw new Error('This expense has a refund. Delete the refund first.');
    }
    const deleted = await tx.runAsync('DELETE FROM fin_transactions WHERE id = ?', [id]);
    if (!deleted.changes) throw new Error('This transaction no longer exists.');
  });
}

export interface FinGoalInput {
  id?: string; title: string; target: number; targetDate: string | null; monthly: number;
  growthBp: number | null; linkedGoalId: string | null;
}
export async function saveFinGoal(db: SQLiteDatabase, input: FinGoalInput): Promise<string> {
  const title = clean(input.title, 120, 'Goal name');
  if (!Number.isSafeInteger(input.target) || input.target <= 0) throw new Error('Enter a target amount.');
  if (!Number.isSafeInteger(input.monthly) || input.monthly < 0) throw new Error('Monthly contribution cannot be negative.');
  if (input.targetDate !== null && !isDateKey(input.targetDate)) throw new Error('Choose a valid target date.');
  if (input.growthBp !== null && (!Number.isSafeInteger(input.growthBp) || input.growthBp < -5000 || input.growthBp > 1000000)) {
    throw new Error('Enter a price growth between −50% and 10,000%.');
  }
  const stamp = now();
  if (input.id) {
    await db.runAsync(`UPDATE fin_goals SET title = ?, target = ?, target_date = ?, monthly = ?, growth_bp = ?, goal_id = ?, updated_at = ? WHERE id = ?`,
      [title, input.target, input.targetDate, input.monthly, input.growthBp, input.linkedGoalId, stamp, input.id]);
    return input.id;
  }
  const id = randomUUID();
  await db.runAsync(`INSERT INTO fin_goals (id, title, target, target_date, monthly, growth_bp, goal_id, archived_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`, [id, title, input.target, input.targetDate, input.monthly, input.growthBp, input.linkedGoalId, stamp, stamp]);
  return id;
}
export async function setFinGoalArchived(db: SQLiteDatabase, id: string, archived: boolean): Promise<void> {
  await db.runAsync('UPDATE fin_goals SET archived_at = ?, updated_at = ? WHERE id = ?', [archived ? now() : null, now(), id]);
}

/** Explicitly move money into (positive) or out of (negative) a goal; never more than is unallocated or allocated. */
export async function allocate(db: SQLiteDatabase, goalId: string, amount: number, date: string, note = ''): Promise<void> {
  if (!Number.isSafeInteger(amount) || amount === 0) throw new Error('Enter an amount.');
  if (!isDateKey(date)) throw new Error('Choose a valid date.');
  await db.withExclusiveTransactionAsync(async (tx) => {
    const snapshot = await loadFinance(tx);
    if (!snapshot) throw new Error('Set up Money first.');
    const current = snapshot.allocations.filter((a) => a.goalId === goalId).reduce((sum, a) => sum + a.amount, 0);
    if (amount < 0 && current + amount < 0) throw new Error('You cannot release more than is allocated to this goal.');
    const free = unallocatedFunds(snapshot.accounts, snapshot.txs, snapshot.allocations);
    if (amount > 0 && amount > free) throw new Error('Only the unallocated part of your balances can be assigned to a goal.');
    const stamp = now();
    await tx.runAsync('INSERT INTO fin_allocations (id, fin_goal_id, amount, date, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [randomUUID(), goalId, amount, date, note.trim().slice(0, 500), stamp, stamp]);
  });
}

export async function setBudget(db: SQLiteDatabase, categoryId: string | null, amount: number | null): Promise<void> {
  if (amount !== null && (!Number.isSafeInteger(amount) || amount <= 0)) throw new Error('Enter a budget greater than zero.');
  await db.withExclusiveTransactionAsync(async (tx) => {
    if (categoryId !== null) {
      const category = await tx.getFirstAsync<{ kind: string }>('SELECT kind FROM fin_categories WHERE id = ?', [categoryId]);
      if (category?.kind !== 'expense') throw new Error('A budget can only use a spending category.');
    }
    const row = await tx.getFirstAsync<{ id: string }>(
      categoryId === null ? 'SELECT id FROM fin_budgets WHERE category_id IS NULL' : 'SELECT id FROM fin_budgets WHERE category_id = ?',
      categoryId === null ? [] : [categoryId]);
    const stamp = now();
    if (amount === null) { if (row) await tx.runAsync('DELETE FROM fin_budgets WHERE id = ?', [row.id]); return; }
    if (row) await tx.runAsync('UPDATE fin_budgets SET amount = ?, updated_at = ? WHERE id = ?', [amount, stamp, row.id]);
    else await tx.runAsync('INSERT INTO fin_budgets (id, category_id, amount, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [randomUUID(), categoryId, amount, stamp, stamp]);
  });
}

export interface PlanInput {
  id?: string; title: string; direction: 'income' | 'expense'; amount: number; cadence: Cadence; nature: Nature;
  dueDate: string; categoryId: string | null; accountId: string | null;
}
export async function savePlan(db: SQLiteDatabase, input: PlanInput): Promise<string> {
  const title = clean(input.title, 120, 'Name');
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0) throw new Error('Enter an amount.');
  if (!isDateKey(input.dueDate) || !CADENCES.includes(input.cadence) || !NATURES.includes(input.nature)
    || (input.direction !== 'income' && input.direction !== 'expense')) throw new Error('Check the planned item details.');
  const stamp = now();
  const id = input.id ?? randomUUID();
  await db.withExclusiveTransactionAsync(async (tx) => {
    if (input.categoryId !== null) {
      const category = await tx.getFirstAsync<{ kind: string }>('SELECT kind FROM fin_categories WHERE id = ?', [input.categoryId]);
      if (category?.kind !== input.direction) throw new Error('Choose a category matching the planned item direction.');
    }
    if (input.accountId !== null) {
      const account = await tx.getFirstAsync('SELECT 1 FROM fin_accounts WHERE id = ?', [input.accountId]);
      if (!account) throw new Error('Choose an existing account.');
    }
    if (input.id) {
      const changed = await tx.runAsync(`UPDATE fin_plans SET title = ?, direction = ?, amount = ?, cadence = ?, nature = ?, due_date = ?,
        category_id = ?, account_id = ?, updated_at = ? WHERE id = ?`,
      [title, input.direction, input.amount, input.cadence, input.nature, input.dueDate, input.categoryId, input.accountId, stamp, input.id]);
      if (!changed.changes) throw new Error('This planned item no longer exists.');
      return;
    }
    await tx.runAsync(`INSERT INTO fin_plans (id, title, direction, amount, cadence, nature, due_date, category_id, account_id, archived_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
    [id, title, input.direction, input.amount, input.cadence, input.nature, input.dueDate, input.categoryId, input.accountId, stamp, stamp]);
  });
  return id;
}
export async function setPlanArchived(db: SQLiteDatabase, id: string, archived: boolean): Promise<void> {
  await db.runAsync('UPDATE fin_plans SET archived_at = ?, updated_at = ? WHERE id = ?', [archived ? now() : null, now(), id]);
}

/** Confirming a planned item records one real transaction and advances the due date exactly once. */
export async function confirmPlan(db: SQLiteDatabase, plan: FinPlan, accountId: string, date: string, amount?: number): Promise<void> {
  if (amount !== undefined && (!Number.isSafeInteger(amount) || amount <= 0)) throw new Error('Enter an amount greater than zero.');
  await db.withExclusiveTransactionAsync(async (tx) => {
    const current = await tx.getFirstAsync<{
      title: string; direction: 'income' | 'expense'; amount: number; cadence: Cadence; nature: Nature;
      due_date: string; category_id: string | null; account_id: string | null; archived_at: string | null;
    }>('SELECT title, direction, amount, cadence, nature, due_date, category_id, account_id, archived_at FROM fin_plans WHERE id = ?', [plan.id]);
    if (!current || current.archived_at) throw new Error('This planned item no longer exists or is archived.');
    if (current.due_date !== plan.dueDate || current.title !== plan.title || current.direction !== plan.direction
      || current.amount !== plan.amount || current.cadence !== plan.cadence || current.nature !== plan.nature
      || current.category_id !== plan.categoryId || current.account_id !== plan.accountId) {
      throw new Error('This planned item has changed or was already confirmed. Refresh it before confirming again.');
    }
    if (!current.category_id) throw new Error('Choose a category for this item before confirming it.');
    const input: TxInput = {
      type: current.direction, amount: amount ?? current.amount, date, accountId, toAccountId: null,
      categoryId: current.category_id, refundOfId: null, payee: '', note: current.title, tagNames: [], splits: [],
    };
    const tagNames = prepareTransaction(input, await activeAccounts(tx));
    await writeTransaction(tx, input, tagNames);
    const changed = await tx.runAsync('UPDATE fin_plans SET due_date = ?, updated_at = ? WHERE id = ? AND due_date = ?',
      [addMonthsToDate(current.due_date, current.cadence === 'yearly' ? 12 : 1), now(), plan.id, current.due_date]);
    if (!changed.changes) throw new Error('This planned item changed during confirmation. No transaction was recorded.');
  });
}

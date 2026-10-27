import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { migrateDatabase } from '../src/storage/database.ts';
import { exportBackup, restoreBackup } from '../src/storage/backup.ts';
import { parseBackup } from '../src/domain/backup.ts';
import {
  accountBalance, categoryChange, categoryTotals, coveredMonths, forecastGoal, formatMoney, monthSummary, netWorth,
  groupDigits, parseAmount, pendingBudgetAlerts, parseRate, tagTotals, toUsd, unallocatedFunds, validateTx,
} from '../src/domain/finance.ts';
import {
  allocate, confirmPlan, deleteTransaction, loadFinance, saveAccount, saveFinGoal, savePlan, saveTransaction, setBudget, setupFinance, updateFinanceSettings,
} from '../src/storage/finance.ts';

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

const tx = (over) => ({ id: over.id ?? Math.random().toString(36), type: 'expense', amount: 0, date: '2026-10-05', accountId: 'a', toAccountId: null,
  categoryId: 'food', refundOfId: null, payee: '', note: '', tagIds: [], splits: [], ...over });

test('finance math keeps transfers, refunds, splits, history gaps, inflation and forecasts honest', () => {
  assert.equal(parseAmount('۱٬۲۵۰٬۰۰۰', 0), 1250000);
  assert.equal(parseAmount('12.5', 0), null, 'a fraction is rejected when the unit has no decimals');
  assert.equal(parseAmount('12.50', 2), 1250);
  assert.equal(formatMoney(1250000, { unit: 'Toman', decimals: 0 }), '1,250,000 Toman');
  assert.equal(groupDigits('۴۰۰۰۰۰۰', 0), '4,000,000');
  assert.equal(groupDigits('1234567.891', 2), '1,234,567.89');
  assert.equal(groupDigits('-0042', 0, true), '-42');
  const dollar = { unit: 'Toman', decimals: 0, usdRateX100: parseRate('160,000') };
  assert.equal(toUsd(4000000, dollar), 25, '4 million Toman at 160,000 per dollar is $25');
  assert.equal(toUsd(4000000, { ...dollar, usdRateX100: null }), null);
  assert.equal(toUsd(10, { unit: 'USD', decimals: 2, usdRateX100: 100 }), null, 'no conversion note when the unit already is dollars');

  const accounts = [{ id: 'a', name: 'Bank', kind: 'bank', opening: 1000, archived: false },
    { id: 'b', name: 'Cash', kind: 'cash', opening: 0, archived: false }];
  const rows = [
    tx({ id: 'salary', type: 'income', amount: 5000, categoryId: 'salary' }),
    tx({ id: 'rent', amount: 1500, categoryId: 'rent', tagIds: ['fixed'] }),
    tx({ id: 'groc', amount: 600, categoryId: 'food', tagIds: ['trip'] }),
    tx({ id: 'move', type: 'transfer', amount: 800, toAccountId: 'b', categoryId: null }),
    tx({ id: 'refund', type: 'income', amount: 100, categoryId: 'food', refundOfId: 'groc' }),
    tx({ id: 'mixed', amount: 300, categoryId: null, splits: [{ categoryId: 'food', amount: 200 }, { categoryId: 'health', amount: 100 }], tagIds: ['trip'] }),
  ];
  const summary = monthSummary(rows, '2026-10');
  assert.deepEqual([summary.income, summary.spent, summary.net], [5000, 2300, 2700], 'transfer is neutral; refund lowers spending, not income');
  const byCategory = categoryTotals(rows, '2026-10');
  assert.equal(byCategory.get('food'), 700);
  assert.equal(byCategory.get('health'), 100);
  const splitRefund = tx({ id: 'split-refund', type: 'income', amount: 100, categoryId: null, refundOfId: 'mixed',
    splits: [{ categoryId: 'food', amount: 70 }, { categoryId: 'health', amount: 30 }] });
  const afterSplitRefund = categoryTotals([...rows, splitRefund], '2026-10');
  assert.equal(afterSplitRefund.get('food'), 630, 'a split refund reduces the correct food amount');
  assert.equal(afterSplitRefund.get('health'), 70, 'a split refund reduces the correct health amount');
  assert.equal(tagTotals(rows, '2026-10').get('trip'), 900);
  const taggedRefund = tx({ id: 'tagged-refund', type: 'income', amount: 100, categoryId: 'food', refundOfId: 'groc', tagIds: ['trip'] });
  assert.equal(tagTotals([...rows, taggedRefund], '2026-10').get('trip'), 800, 'a tagged refund reduces the same tag total');
  assert.equal(accountBalance(accounts[0], rows, accounts) + accountBalance(accounts[1], rows, accounts), 1000 + 5000 - 2100 - 300 + 100, 'transfer moves money without changing the total');
  assert.equal(netWorth(accounts, rows), 3700);
  const hiddenAccounts = [
    { id: 'hidden-cash', name: 'Hidden cash', kind: 'bank', opening: 1000, archived: true },
    { id: 'hidden-debt', name: 'Hidden debt', kind: 'liability', opening: 200, archived: true },
  ];
  assert.equal(netWorth(hiddenAccounts, []), 800, 'hiding accounts does not erase assets or debts from net worth');
  assert.equal(unallocatedFunds(hiddenAccounts, [], []), 1000, 'hidden asset balances remain in available funds');
  assert.equal(unallocatedFunds(accounts, rows, [{ id: 'x', goalId: 'g', amount: 1000, date: '2026-10-06', note: '' }]), 2700);

  const card = { id: 'card', name: 'Credit card', kind: 'liability', opening: 1000, archived: false };
  const cardRows = [
    tx({ id: 'card-purchase', accountId: 'card', amount: 200, categoryId: 'food' }),
    tx({ id: 'card-payment', type: 'transfer', amount: 300, accountId: 'a', toAccountId: 'card', categoryId: null }),
    tx({ id: 'cash-advance', type: 'transfer', amount: 100, accountId: 'card', toAccountId: 'a', categoryId: null }),
  ];
  assert.equal(accountBalance(card, cardRows, [accounts[0], card]), 1000, 'credit purchases increase debt, payments reduce it, and advances increase it');
  assert.equal(accountBalance(accounts[0], cardRows, [accounts[0], card]), 800, 'payments and advances move the asset balance correctly');
  assert.equal(netWorth([accounts[0], card], cardRows), -200, 'transfers do not change net worth; the purchase does');
  const secondCard = { id: 'card-2', name: 'Second credit card', kind: 'liability', opening: 0, archived: false };
  const balanceTransfer = [tx({ id: 'balance-transfer', type: 'transfer', amount: 300, accountId: 'card', toAccountId: 'card-2', categoryId: null })];
  assert.equal(accountBalance(card, balanceTransfer, [card, secondCard]), 700, 'a liability-to-liability transfer reduces the source debt');
  assert.equal(accountBalance(secondCard, balanceTransfer, [card, secondCard]), 300, 'a liability-to-liability transfer increases the destination debt');
  assert.equal(netWorth([card, secondCard], balanceTransfer), -1000, 'moving debt between liabilities does not change net worth');

  assert.match(validateTx({ ...tx({ type: 'transfer', amount: 5, toAccountId: 'a', categoryId: null }) }), /different destination/);
  assert.match(validateTx({ ...tx({ amount: 300, categoryId: null, splits: [{ categoryId: 'food', amount: 100 }, { categoryId: 'x', amount: 100 }] }) }), /add up/);
  assert.equal(validateTx(tx({ type: 'adjustment', amount: -50, categoryId: null })), null);

  // A month with no records is a gap, not zero spending; a trend needs three earlier covered months.
  const budgets = [{ id: 'bo', categoryId: null, amount: 1000 }, { id: 'bf', categoryId: 'food', amount: 500 }];
  const cats = [{ id: 'food', name: 'Food', kind: 'expense', group: 'Home', archived: false }];
  const spent = [tx({ amount: 850, categoryId: 'food', date: '2026-10-05' })];
  const first = pendingBudgetAlerts(budgets, cats, spent, '2026-10', new Set());
  assert.deepEqual(first.map((a) => [a.key, a.state]), [['2026-10:bo:near', 'near'], ['2026-10:bf:over', 'over']]);
  assert.match(first[1].label, /Food is over/);
  assert.ok(first.every((a) => !/\d{3}/.test(a.label)), 'alert text never carries amounts');
  assert.deepEqual(pendingBudgetAlerts(budgets, cats, spent, '2026-10', new Set(first.map((a) => a.key))), [], 'each level is announced once');
  assert.deepEqual(pendingBudgetAlerts(budgets, cats, spent, '2026-11', new Set(first.map((a) => a.key))), [], 'a new month with no spending is quiet');
  const history = [['2026-06', 400], ['2026-08', 500], ['2026-09', 600], ['2026-10', 900]].map(([month, amount]) =>
    tx({ date: `${month}-10`, amount, categoryId: 'food' }));
  assert.deepEqual(coveredMonths(history), ['2026-06', '2026-08', '2026-09', '2026-10']);
  assert.equal(categoryChange(history.slice(1), 'food', '2026-10'), null, 'only two earlier months of data');
  const change = categoryChange(history, 'food', '2026-10');
  assert.deepEqual([change.average, change.pct, change.windowMonths.length], [500, 80, 3]);

  const base = { target: 120000, saved: 20000, monthly: 10000, today: '2026-10-27', targetDate: '2027-10-27', growthBp: null, inflationBp: null, historyMonths: 6 };
  const plain = forecastGoal(base);
  assert.deepEqual([plain.status, plain.etaMonths, plain.etaDate, plain.requiredMonthly], ['on-track', 10, '2027-08-27', 8334]);
  assert.equal(plain.realFutureTarget, null, 'no inflation scenario, no purchasing-power figure');
  const priced = forecastGoal({ ...base, growthBp: 1000, inflationBp: 2000 });
  assert.equal(priced.futureTarget, 132000, 'target-specific growth moves the nominal target');
  assert.equal(priced.realFutureTarget, 110000, 'general inflation deflates it for purchasing power');
  assert.equal(forecastGoal({ ...base, inflationBp: 5000 }).futureTarget, plain.futureTarget, 'inflation does not alter the target price');
  assert.equal(forecastGoal({ ...base, monthly: 0 }).etaDate, null);
  assert.equal(forecastGoal({ ...base, monthly: 0 }).status, 'no-contribution');
  assert.equal(forecastGoal({ ...base, monthly: 100, growthBp: 100000 }).status, 'unreachable', 'a target outrunning the contribution gets no date');
  assert.equal(forecastGoal({ ...base, historyMonths: 1 }).provisional, true);
  assert.ok(plain.scenarios.length === 3 && plain.scenarios[0].months < plain.scenarios[2].months);
});

test('finance storage records a ledger atomically and backs up, validates and restores every finance table', async () => {
  const source = realDatabase(), target = realDatabase(), legacy = realDatabase();
  try {
    for (const { db } of [source, target, legacy]) await migrateDatabase(db);
    await assert.rejects(() => saveTransaction(source.db, { type: 'expense', amount: 5, date: '2026-10-01', accountId: 'nope',
      toAccountId: null, categoryId: null, refundOfId: null, payee: '', note: '', tagNames: [], splits: [] }), /what this money was for|account/);
    await setupFinance(source.db, { unit: 'Toman', decimals: 0, accountName: 'Main', opening: 10000000 });
    await assert.rejects(() => setupFinance(source.db, { unit: 'USD', decimals: 2, accountName: 'x', opening: 0 }), /already set up/);
    let data = await loadFinance(source.db);
    const [main] = data.accounts;
    const cash = await saveAccount(source.db, { name: 'Wallet', kind: 'wallet', opening: 0 });
    const cat = (name) => data.categories.find((c) => c.name === name).id;
    const spend = (extra) => ({ type: 'expense', amount: 1, date: '2026-10-02', accountId: main.id, toAccountId: null, categoryId: cat('Groceries'),
      refundOfId: null, payee: '', note: '', tagNames: [], splits: [], ...extra });
    await assert.rejects(() => saveTransaction(source.db, spend({ type: 'income', amount: 100, categoryId: cat('Groceries') })), /valid income category/);
    await assert.rejects(() => savePlan(source.db, { title: 'Bad category', direction: 'income', amount: 100, cadence: 'monthly',
      nature: 'fixed', dueDate: '2026-10-31', categoryId: cat('Groceries'), accountId: main.id }), /category matching/);
    await assert.rejects(() => setBudget(source.db, cat('Salary'), 1000), /spending category/);
    const salary = await saveTransaction(source.db, spend({ type: 'income', amount: 30000000, categoryId: cat('Salary') }));
    const groceries = await saveTransaction(source.db, spend({ amount: 2000000, tagNames: ['Work week', 'work week'] }));
    await saveTransaction(source.db, spend({ type: 'income', amount: 500000, refundOfId: groceries }));
    await assert.rejects(() => saveTransaction(source.db, spend({ type: 'income', amount: 1600000, refundOfId: groceries })), /Refunds cannot exceed/);
    await assert.rejects(() => saveTransaction(source.db, spend({ type: 'income', amount: 100000, categoryId: cat('Health'), refundOfId: groceries })), /original expense categories/);
    await assert.rejects(() => saveTransaction(source.db, spend({ amount: 400000 }), groceries), /has refunds/);
    await assert.rejects(() => saveTransaction(source.db, spend({ amount: 2000000, categoryId: cat('Health') }), groceries), /original expense categories/);
    const mixed = await saveTransaction(source.db, spend({ amount: 900000, categoryId: null,
      splits: [{ categoryId: cat('Groceries'), amount: 600000 }, { categoryId: cat('Health'), amount: 300000 }] }));
    await saveTransaction(source.db, spend({ type: 'income', amount: 100000, categoryId: cat('Groceries'), refundOfId: mixed }));
    await saveTransaction(source.db, spend({ type: 'income', amount: 400000, categoryId: null, refundOfId: mixed,
      splits: [{ categoryId: cat('Groceries'), amount: 100000 }, { categoryId: cat('Health'), amount: 300000 }] }));
    await assert.rejects(() => saveTransaction(source.db, spend({ type: 'income', amount: 100000, categoryId: cat('Health'), refundOfId: mixed })),
      /original amount in each category/);
    await saveTransaction(source.db, spend({ type: 'transfer', amount: 1000000, toAccountId: cash, categoryId: null }));
    await assert.rejects(() => saveAccount(source.db, { id: cash, name: 'Wallet', kind: 'liability', opening: 0 }), /type is locked/);
    await assert.rejects(() => saveAccount(source.db, { id: main.id, name: 'Main', kind: 'bank', opening: 9999999 }), /opening balance is locked/i);
    await assert.rejects(() => saveTransaction(source.db, spend({ type: 'income', amount: 5, refundOfId: salary })), /refund must refer to an expense/);
    await assert.rejects(() => saveTransaction(source.db, spend({ amount: 10, categoryId: null, splits: [{ categoryId: cat('Groceries'), amount: 4 }, { categoryId: cat('Health'), amount: 4 }] })), /add up/);
    await setBudget(source.db, cat('Groceries'), 3000000);
    await setBudget(source.db, null, 20000000);
    await setBudget(source.db, null, 25000000);

    data = await loadFinance(source.db);
    assert.equal(data.tags.length, 1, 'tags are case-insensitive and created on first use');
    assert.equal(data.budgets.length, 2);
    const summary = monthSummary(data.txs, '2026-10');
    assert.deepEqual([summary.income, summary.spent], [30000000, 2000000 - 500000 + 900000 - 100000 - 400000]);
    const goalId = await saveFinGoal(source.db, { title: 'Car repair reserve', target: 8000000, targetDate: '2027-04-01', monthly: 500000, growthBp: 2500, linkedGoalId: null });
    await assert.rejects(() => allocate(source.db, goalId, 999999999, '2026-10-03'), /unallocated/);
    await allocate(source.db, goalId, 3000000, '2026-10-03');
    await assert.rejects(() => allocate(source.db, goalId, -3000001, '2026-10-04'), /cannot release/);
    await assert.rejects(() => source.db.runAsync('DELETE FROM fin_accounts WHERE id = ?', [main.id]), /FOREIGN KEY/);

    const rent = await savePlan(source.db, { title: 'Rent', direction: 'expense', amount: 4000000, cadence: 'monthly', nature: 'fixed', dueDate: '2026-10-31', categoryId: cat('Rent'), accountId: main.id });
    const rentPlan = (await loadFinance(source.db)).plans.find((p) => p.id === rent);
    await confirmPlan(source.db, rentPlan, main.id, '2026-10-31');
    await assert.rejects(() => confirmPlan(source.db, rentPlan, main.id, '2026-10-31'), /changed or was already confirmed/);
    data = await loadFinance(source.db);
    assert.equal(data.plans[0].dueDate, '2026-11-30', 'a confirmed monthly item moves to the next month end-safely');
    assert.equal(data.txs.filter((t) => t.note === 'Rent').length, 1);

    const backup = await exportBackup(source.db);
    assert.equal(backup.version, 7);
    await updateFinanceSettings(source.db, { unit: 'Toman', inflationBp: 3500, usdRateX100: 16000000, usdRateDate: '2026-10-27', usdRateSource: 'Entered by you' });
    const withRate = await exportBackup(source.db);
    assert.equal(withRate.tables.fin_settings[0].usd_rate_x100, 16000000);
    const v3 = structuredClone(withRate);
    v3.version = 3; v3.schemaVersion = 9;
    delete v3.tables.learn_topics; delete v3.tables.learn_checkins;
    for (const row of v3.tables.fin_settings) { delete row.usd_rate_x100; delete row.usd_rate_date; delete row.usd_rate_source; }
    assert.equal(parseBackup(JSON.stringify(v3)).tables.fin_settings[0].usd_rate_x100, null, 'version 3 backups gain an empty rate');
    const badRate = structuredClone(withRate);
    badRate.tables.fin_settings[0].usd_rate_date = null;
    assert.throws(() => parseBackup(JSON.stringify(badRate)), /dollar rate/);
    const badRefundCategory = structuredClone(withRate);
    const groceriesRefund = badRefundCategory.tables.fin_transactions.find((row) => row.refund_of_id === groceries);
    groceriesRefund.category_id = cat('Health');
    assert.throws(() => parseBackup(JSON.stringify(badRefundCategory)), /refund category/);
    const overRefundedBackup = structuredClone(withRate);
    overRefundedBackup.tables.fin_transactions.find((row) => row.refund_of_id === groceries).amount = 2100000;
    assert.throws(() => parseBackup(JSON.stringify(overRefundedBackup)), /refund totals|refund category totals/);
    assert.equal(backup.tables.fin_transactions.length, data.txs.length);
    assert.equal(await restoreBackup(target.db, JSON.stringify(backup)) > 0, true);
    const restored = await loadFinance(target.db);
    assert.deepEqual(restored.txs.map((t) => [t.id, t.amount, t.tagIds.length, t.splits.length]).sort(),
      data.txs.map((t) => [t.id, t.amount, t.tagIds.length, t.splits.length]).sort());
    assert.equal(restored.allocations.length, 1);
    assert.equal(restored.settings.unit, 'Toman');
    assert.equal(await restoreBackup(target.db, JSON.stringify(backup)), 0, 'a second restore adds nothing');

    const tampered = structuredClone(backup);
    tampered.tables.fin_splits[0].amount += 1;
    assert.throws(() => parseBackup(JSON.stringify(tampered)), /split/);
    const orphan = structuredClone(backup);
    orphan.tables.fin_allocations[0].fin_goal_id = 'missing';
    assert.throws(() => parseBackup(JSON.stringify(orphan)), /allocation/);
    const older = structuredClone(backup);
    older.version = 2; older.schemaVersion = 8;
    for (const name of Object.keys(older.tables).filter((n) => n.startsWith('fin_') || n.startsWith('learn_'))) delete older.tables[name];
    assert.equal(parseBackup(JSON.stringify(older)).tables.fin_transactions.length, 0, 'pre-finance backups still restore');
    await restoreBackup(legacy.db, JSON.stringify(older));
    assert.equal(await loadFinance(legacy.db), null, 'finance stays off unless it was set up');

    await assert.rejects(() => deleteTransaction(source.db, groceries), /refund/);
  } finally {
    source.sqlite.close(); target.sqlite.close(); legacy.sqlite.close();
  }
});

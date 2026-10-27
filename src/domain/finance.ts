/**
 * Personal finance domain: pure, offline arithmetic with no storage or UI.
 * Amounts are integers in the smallest displayed unit of one reporting currency/unit
 * (see FinSettings.decimals). Percentages are stored as basis points (3500 = 35.00%).
 * Nothing here predicts the future: forecasts are arithmetic on stated assumptions.
 */

export const TX_TYPES = ['income', 'expense', 'transfer', 'adjustment'] as const;
export type TxType = typeof TX_TYPES[number];
export const ACCOUNT_KINDS = ['cash', 'bank', 'wallet', 'liability'] as const;
export type AccountKind = typeof ACCOUNT_KINDS[number];
export const CADENCES = ['monthly', 'yearly'] as const;
export type Cadence = typeof CADENCES[number];
export const NATURES = ['fixed', 'flexible', 'irregular'] as const;
export type Nature = typeof NATURES[number];

export interface FinSettings {
  unit: string; decimals: 0 | 2; inflationBp: number | null;
  /** Units of the reporting currency per 1 USD, times 100; null until the user sets or fetches one. */
  usdRateX100: number | null; usdRateDate: string | null; usdRateSource: string | null;
}
export interface FinAccount { id: string; name: string; kind: AccountKind; opening: number; archived: boolean }
export interface FinCategory { id: string; name: string; kind: 'income' | 'expense'; group: string; archived: boolean }
export interface FinTx {
  id: string; type: TxType; amount: number; date: string; accountId: string; toAccountId: string | null;
  categoryId: string | null; refundOfId: string | null; payee: string; note: string;
  tagIds: string[]; splits: { categoryId: string; amount: number }[];
}
export interface FinGoal {
  id: string; title: string; target: number; targetDate: string | null; monthly: number;
  growthBp: number | null; linkedGoalId: string | null; archived: boolean;
}
export interface FinAllocation { id: string; goalId: string; amount: number; date: string; note: string }
export interface FinBudget { id: string; categoryId: string | null; amount: number }
export interface FinPlan {
  id: string; title: string; direction: 'income' | 'expense'; amount: number; cadence: Cadence;
  nature: Nature; dueDate: string; categoryId: string | null; accountId: string | null; archived: boolean;
}

export const DEFAULT_CATEGORIES: { kind: 'income' | 'expense'; group: string; names: string[] }[] = [
  { kind: 'expense', group: 'Housing', names: ['Rent', 'Utilities', 'Maintenance'] },
  { kind: 'expense', group: 'Food', names: ['Groceries', 'Restaurants'] },
  { kind: 'expense', group: 'Transportation', names: ['Fuel', 'Public transport', 'Car repair'] },
  { kind: 'expense', group: 'Health', names: ['Health'] },
  { kind: 'expense', group: 'Education', names: ['Education'] },
  { kind: 'expense', group: 'Shopping', names: ['Shopping'] },
  { kind: 'expense', group: 'Subscriptions', names: ['Subscriptions'] },
  { kind: 'expense', group: 'Leisure', names: ['Leisure'] },
  { kind: 'expense', group: 'Family', names: ['Family'] },
  { kind: 'expense', group: 'Fees & taxes', names: ['Fees & taxes'] },
  { kind: 'expense', group: 'Other', names: ['Other expense'] },
  { kind: 'income', group: 'Income', names: ['Salary', 'Other income'] },
];

/* ---------- dates ---------- */

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
export function isDateKey(value: string): boolean {
  const m = DATE.exec(value);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}
export const monthOf = (date: string): string => date.slice(0, 7);
export function addMonthsToMonth(month: string, delta: number): string {
  const total = Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1 + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}
export function addMonthsToDate(date: string, delta: number): string {
  const month = addMonthsToMonth(monthOf(date), delta);
  const last = new Date(Date.UTC(+month.slice(0, 4), +month.slice(5, 7), 0)).getUTCDate();
  return `${month}-${String(Math.min(Number(date.slice(8, 10)), last)).padStart(2, '0')}`;
}
/** Whole-and-fractional months from a to b (a day counts as 1/30 of a month). */
export function monthsBetween(a: string, b: string): number {
  return (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + (Number(b.slice(5, 7)) - Number(a.slice(5, 7)))
    + (Number(b.slice(8, 10)) - Number(a.slice(8, 10))) / 30;
}

/* ---------- amounts ---------- */

const DIGITS: Record<string, string> = {};
'۰۱۲۳۴۵۶۷۸۹'.split('').forEach((c, i) => { DIGITS[c] = String(i); });
'٠١٢٣٤٥٦٧٨٩'.split('').forEach((c, i) => { DIGITS[c] = String(i); });

/** Parse typed money (Latin, Persian or Arabic digits; grouping marks ignored) into integer units. */
export function parseAmount(text: string, decimals: 0 | 2): number | null {
  const clean = text.replace(/[۰-۹٠-٩]/g, (c) => DIGITS[c]).replace(/[\s,،٬_']/g, '').replace('٫', '.');
  if (!/^-?\d+(\.\d+)?$/.test(clean)) return null;
  const [whole, fraction = ''] = clean.replace('-', '').split('.');
  if (fraction.length > decimals) return null;
  const value = Number(whole) * 10 ** decimals + Number(fraction.padEnd(decimals, '0') || 0);
  if (!Number.isSafeInteger(value) || value > 1e15) return null;
  return clean.startsWith('-') ? -value : value;
}
export function formatAmount(amount: number, settings: Pick<FinSettings, 'decimals'>): string {
  const sign = amount < 0 ? '−' : '';
  const abs = Math.abs(amount);
  const unit = 10 ** settings.decimals;
  const whole = Math.floor(abs / unit).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return sign + whole + (settings.decimals ? '.' + String(abs % unit).padStart(settings.decimals, '0') : '');
}
export const formatMoney = (amount: number, settings: Pick<FinSettings, 'decimals' | 'unit'>): string =>
  `${formatAmount(amount, settings)} ${settings.unit}`;
/** Compact form for dense rows: 1.2M, 340K. */
export function compactAmount(amount: number, settings: Pick<FinSettings, 'decimals'>): string {
  const value = Math.abs(amount) / 10 ** settings.decimals;
  const sign = amount < 0 ? '−' : '';
  if (value >= 1e9) return `${sign}${+(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `${sign}${+(value / 1e6).toFixed(1)}M`;
  if (value >= 1e4) return `${sign}${+(value / 1e3).toFixed(0)}K`;
  return formatAmount(amount, settings);
}
/** Group the integer part by thousands while typing; Persian/Arabic digits become Latin, extra characters are dropped. */
export function groupDigits(text: string, decimals: 0 | 2, allowNegative = false): string {
  const latin = text.replace(/[۰-۹٠-٩]/g, (c) => DIGITS[c]).replace(/[٫،٬]/g, (c) => (c === '٫' ? '.' : ','));
  const negative = allowNegative && latin.trimStart().startsWith('-');
  let [whole, ...rest] = latin.replace(/[^\d.]/g, '').split('.');
  whole = whole.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const fraction = decimals && rest.length ? '.' + rest.join('').slice(0, decimals) : '';
  return (negative ? '-' : '') + whole + fraction;
}
/** The amount in dollars, or null when no rate is set or the reporting unit already is USD. */
export function toUsd(amount: number, s: Pick<FinSettings, 'decimals' | 'usdRateX100' | 'unit'>): number | null {
  if (!s.usdRateX100 || s.unit.trim().toUpperCase() === 'USD') return null;
  return (amount / 10 ** s.decimals) / (s.usdRateX100 / 100);
}
export function formatUsd(usd: number): string {
  const abs = Math.abs(usd);
  const text = abs >= 100 ? Math.round(abs).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    : abs.toFixed(2);
  return `${usd < 0 ? '−' : ''}$${text}`;
}
export function parseRate(text: string): number | null {
  const clean = text.replace(/[۰-۹٠-٩]/g, (c) => DIGITS[c]).replace(/[\s,،٬]/g, '').replace('٫', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  const x100 = Math.round(Number(clean) * 100);
  return x100 > 0 && x100 <= 1e13 ? x100 : null;
}
export const bpToPercent = (bp: number): string => `${+(bp / 100).toFixed(2)}%`;
export function parsePercent(text: string): number | null {
  const clean = text.replace(/[۰-۹٠-٩]/g, (c) => DIGITS[c]).replace('٫', '.').replace('%', '').trim();
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  const bp = Math.round(Number(clean) * 100);
  return bp <= 1000000 ? bp : null;
}

/* ---------- transactions ---------- */

export function validateTx(tx: Omit<FinTx, 'id'>, accountCount = 2): string | null {
  if (!Number.isSafeInteger(tx.amount)) return 'Enter an amount.';
  if (tx.type === 'adjustment' ? tx.amount === 0 : tx.amount <= 0) return 'Enter an amount greater than zero.';
  if (!isDateKey(tx.date)) return 'Choose a valid date.';
  if (!tx.accountId) return 'Choose an account.';
  if (tx.type === 'transfer') {
    if (accountCount < 2) return 'A transfer needs a second account.';
    if (!tx.toAccountId || tx.toAccountId === tx.accountId) return 'Choose a different destination account.';
  } else if (tx.toAccountId) return 'Only transfers have a destination account.';
  if (tx.type === 'income' || tx.type === 'expense') {
    if (!tx.categoryId && tx.splits.length === 0) return 'Choose what this money was for.';
  } else if (tx.categoryId || tx.splits.length || tx.refundOfId) return 'Transfers and adjustments have no category.';
  if (tx.refundOfId && tx.type !== 'income') return 'Only income can be a refund.';
  if (tx.splits.length) {
    if (tx.splits.length < 2 || tx.splits.some((s) => !s.categoryId || !Number.isSafeInteger(s.amount) || s.amount <= 0)) {
      return 'A split needs at least two categories with amounts.';
    }
    if (tx.splits.reduce((sum, s) => sum + s.amount, 0) !== tx.amount) return 'Split amounts must add up to the total.';
  }
  return null;
}

/** The category lines of a transaction: its splits, or one line for the whole amount. */
export function categoryLines(tx: FinTx): { categoryId: string; amount: number }[] {
  if (tx.type !== 'income' && tx.type !== 'expense') return [];
  return tx.splits.length ? tx.splits : tx.categoryId ? [{ categoryId: tx.categoryId, amount: tx.amount }] : [];
}
export const isRefund = (tx: FinTx): boolean => tx.type === 'income' && !!tx.refundOfId;
/** Net effect on spending: an expense adds, a refund subtracts, everything else is neutral. */
const spendSign = (tx: FinTx): 1 | -1 | 0 => tx.type === 'expense' ? 1 : isRefund(tx) ? -1 : 0;

export interface MonthSummary { income: number; spent: number; net: number; savingsRate: number | null; count: number }
export function monthSummary(txs: FinTx[], month: string): MonthSummary {
  let income = 0, spent = 0, count = 0;
  for (const tx of txs) {
    if (monthOf(tx.date) !== month) continue;
    if (tx.type === 'income' && !isRefund(tx)) { income += tx.amount; count++; }
    else if (tx.type === 'expense') { spent += tx.amount; count++; }
    else if (isRefund(tx)) { spent -= tx.amount; count++; }
  }
  const net = income - spent;
  return { income, spent, net, savingsRate: income > 0 ? net / income : null, count };
}

/** Net spending per category for a month. Transfers and adjustments never appear. */
export function categoryTotals(txs: FinTx[], month: string): Map<string, number> {
  const totals = new Map<string, number>();
  for (const tx of txs) {
    const sign = spendSign(tx);
    if (!sign || monthOf(tx.date) !== month) continue;
    for (const line of categoryLines(tx)) totals.set(line.categoryId, (totals.get(line.categoryId) ?? 0) + sign * line.amount);
  }
  return totals;
}
export function tagTotals(txs: FinTx[], month: string): Map<string, number> {
  const totals = new Map<string, number>();
  for (const tx of txs) {
    const sign = spendSign(tx);
    if (!sign || monthOf(tx.date) !== month) continue;
    for (const tag of tx.tagIds) totals.set(tag, (totals.get(tag) ?? 0) + sign * tx.amount);
  }
  return totals;
}

export function accountBalance(account: FinAccount, txs: FinTx[], accounts: FinAccount[]): number {
  let balance = account.opening;
  for (const tx of txs) {
    if (tx.type === 'transfer') {
      const sourceKind = accounts.find((a) => a.id === tx.accountId)?.kind;
      const destinationKind = accounts.find((a) => a.id === tx.toAccountId)?.kind;
      if (tx.accountId === account.id) {
        // Moving a balance from one liability to another reduces the source debt;
        // a cash advance from a liability to an asset increases the source debt.
        balance += account.kind === 'liability'
          ? destinationKind === 'liability' ? -tx.amount : tx.amount
          : -tx.amount;
      }
      if (tx.toAccountId === account.id) {
        // A payment from an asset reduces debt; a liability-to-liability transfer
        // increases the destination debt while reducing the source debt.
        balance += account.kind === 'liability'
          ? sourceKind === 'liability' ? tx.amount : -tx.amount
          : tx.amount;
      }
    } else if (tx.accountId === account.id) {
      if (account.kind === 'liability') {
        // A purchase on credit increases debt; income/refunds reduce it.
        balance += tx.type === 'expense' ? tx.amount : tx.type === 'income' ? -tx.amount : tx.amount;
      } else {
        balance += tx.type === 'expense' ? -tx.amount : tx.amount;
      }
    }
  }
  return balance;
}
/** Net worth counts liabilities as negative; a credit balance on a liability account is an asset. */
export function netWorth(accounts: FinAccount[], txs: FinTx[]): number | null {
  if (!accounts.length) return null;
  // Archiving hides an account from pickers; it does not erase the asset or debt from net worth.
  return accounts.reduce((sum, a) => sum + (a.kind === 'liability' ? -accountBalance(a, txs, accounts) : accountBalance(a, txs, accounts)), 0);
}

/** Cash held in asset accounts that is not yet explicitly allocated to a money goal. */
export function unallocatedFunds(accounts: FinAccount[], txs: FinTx[], allocations: FinAllocation[]): number {
  // Hidden accounts still contain real money and remain part of the user's total balances.
  const assets = accounts.filter((a) => a.kind !== 'liability')
    .reduce((sum, a) => sum + accountBalance(a, txs, accounts), 0);
  return assets - allocations.reduce((sum, a) => sum + a.amount, 0);
}
export const allocatedTo = (goalId: string, allocations: FinAllocation[]): number =>
  allocations.filter((a) => a.goalId === goalId).reduce((sum, a) => sum + a.amount, 0);

/* ---------- history, trends, observations ---------- */

/** A month is "covered" only if it holds real income/expense records; a missing month is not zero spending. */
export function coveredMonths(txs: FinTx[]): string[] {
  return [...new Set(txs.filter((t) => t.type === 'income' || t.type === 'expense').map((t) => monthOf(t.date)))].sort();
}
export interface TrendPoint { month: string; income: number; spent: number; covered: boolean }
export function trend(txs: FinTx[], endMonth: string, span: 3 | 6 | 12): { points: TrendPoint[]; coveredCount: number; enough: boolean } {
  const covered = new Set(coveredMonths(txs));
  const points: TrendPoint[] = [];
  for (let i = span - 1; i >= 0; i--) {
    const month = addMonthsToMonth(endMonth, -i);
    const s = monthSummary(txs, month);
    points.push({ month, income: s.income, spent: s.spent, covered: covered.has(month) });
  }
  const coveredCount = points.filter((p) => p.covered).length;
  return { points, coveredCount, enough: coveredCount >= 3 };
}
export interface CategoryChange { current: number; average: number; pct: number; windowMonths: string[] }
/** Compare a month with the average of up to three earlier covered months; never from a single month. */
export function categoryChange(txs: FinTx[], categoryId: string, month: string): CategoryChange | null {
  const covered = new Set(coveredMonths(txs));
  const window: string[] = [];
  for (let i = 1; i <= 6 && window.length < 3; i++) {
    const m = addMonthsToMonth(month, -i);
    if (covered.has(m)) window.push(m);
  }
  if (window.length < 3 || !covered.has(month)) return null;
  const current = categoryTotals(txs, month).get(categoryId) ?? 0;
  const average = Math.round(window.reduce((sum, m) => sum + (categoryTotals(txs, m).get(categoryId) ?? 0), 0) / window.length);
  if (average <= 0) return null;
  return { current, average, pct: Math.round(((current - average) / average) * 100), windowMonths: window };
}
/** Average monthly net over covered months (never below zero), for a suggested contribution. */
export function suggestedContribution(txs: FinTx[], endMonth: string): { amount: number; months: number } | null {
  const covered = coveredMonths(txs).filter((m) => m < endMonth).slice(-6);
  if (!covered.length) return null;
  const total = covered.reduce((sum, m) => sum + monthSummary(txs, m).net, 0);
  return { amount: Math.max(0, Math.round(total / covered.length)), months: covered.length };
}

/* ---------- budgets and planned items ---------- */

export type BudgetState = 'ok' | 'near' | 'over';
export function budgetState(spent: number, budget: number): BudgetState {
  return spent > budget ? 'over' : spent >= budget * 0.8 ? 'near' : 'ok';
}
export interface BudgetAlert { key: string; state: 'near' | 'over'; label: string }
/** Budgets that crossed 80% or went over this month and have not been announced yet (`sent` holds already-announced keys). */
export function pendingBudgetAlerts(budgets: FinBudget[], categories: FinCategory[], txs: FinTx[], month: string, sent: Set<string>): BudgetAlert[] {
  const byCategory = categoryTotals(txs, month);
  const overall = monthSummary(txs, month).spent;
  const out: BudgetAlert[] = [];
  for (const b of budgets) {
    const spent = b.categoryId === null ? overall : byCategory.get(b.categoryId) ?? 0;
    const state = budgetState(spent, b.amount);
    if (state === 'ok') continue;
    const key = `${month}:${b.id}:${state}`;
    if (sent.has(key) || (state === 'near' && sent.has(`${month}:${b.id}:over`))) continue;
    const name = b.categoryId === null ? 'Overall spending' : categories.find((c) => c.id === b.categoryId)?.name ?? 'A category';
    out.push({ key, state, label: `${name} ${state === 'over' ? 'is over its monthly budget' : 'has used more than 80% of its monthly budget'}` });
  }
  return out;
}
/** Monthly money to set aside for a planned expense; yearly items become a sinking fund. */
export function monthlyReserve(plan: Pick<FinPlan, 'amount' | 'cadence'>): number {
  return plan.cadence === 'yearly' ? Math.ceil(plan.amount / 12) : plan.amount;
}
export function nextDue(plan: Pick<FinPlan, 'dueDate' | 'cadence'>): string {
  return addMonthsToDate(plan.dueDate, plan.cadence === 'yearly' ? 12 : 1);
}

/* ---------- inflation and forecasts ---------- */

export const growthFactor = (bp: number, years: number): number => Math.pow(1 + bp / 10000, years);
/** Nominal price of a target after `years` of its own price growth (not general inflation). */
export const futureNominal = (price: number, growthBp: number | null, years: number): number =>
  Math.round(price * (growthBp === null ? 1 : growthFactor(growthBp, years)));
/** Express a future nominal amount in today's purchasing power using a general-inflation scenario. */
export const realValue = (nominal: number, inflationBp: number, years: number): number =>
  Math.round(nominal / growthFactor(inflationBp, years));

export interface ForecastInput {
  target: number; saved: number; monthly: number; today: string;
  targetDate: string | null; growthBp: number | null; inflationBp: number | null; historyMonths: number;
}
export type ForecastStatus = 'reached' | 'on-track' | 'no-contribution' | 'unreachable';
export interface ScenarioResult { label: string; monthly: number; months: number | null; date: string | null }
export interface Forecast {
  status: ForecastStatus;
  remainingToday: number;
  etaMonths: number | null; etaDate: string | null;
  requiredMonthly: number | null;
  futureTarget: number; realFutureTarget: number | null; horizonDate: string | null;
  scenarios: ScenarioResult[];
  provisional: boolean; assumptions: string[]; missing: string[];
}
const MAX_MONTHS = 1200;

/** First whole month at which saved funds reach the (possibly rising) target; null if never within 100 years. */
function monthsToTarget(saved: number, monthly: number, target: number, growthBp: number | null): number | null {
  if (saved >= target) return 0;
  if (monthly <= 0) return null;
  for (let m = 1; m <= MAX_MONTHS; m++) {
    if (saved + monthly * m >= futureNominal(target, growthBp, m / 12)) return m;
  }
  return null;
}

export function forecastGoal(input: ForecastInput): Forecast {
  const { target, saved, monthly, today, targetDate, growthBp, inflationBp } = input;
  const remainingToday = Math.max(0, target - saved);
  const months = monthsToTarget(saved, monthly, target, growthBp);
  const etaDate = months === null ? null : addMonthsToDate(today, months);
  const status: ForecastStatus = saved >= target ? 'reached' : monthly <= 0 ? 'no-contribution'
    : months === null ? 'unreachable' : 'on-track';
  const horizonMonths = targetDate ? Math.max(0, monthsBetween(today, targetDate)) : months;
  const futureTarget = futureNominal(target, growthBp, (horizonMonths ?? 0) / 12);
  let requiredMonthly: number | null = null;
  if (targetDate && horizonMonths !== null && horizonMonths > 0) {
    requiredMonthly = Math.max(0, Math.ceil((futureTarget - saved) / Math.max(1, Math.ceil(horizonMonths))));
  }
  const scenarios: ScenarioResult[] = [];
  if (monthly > 0 && saved < target) {
    const make = (label: string, m: number, g: number | null) => {
      const n = monthsToTarget(saved, m, target, g);
      scenarios.push({ label, monthly: m, months: n, date: n === null ? null : addMonthsToDate(today, n) });
    };
    make('Faster · +20% saved', Math.round(monthly * 1.2), growthBp);
    make('Base · as planned', monthly, growthBp);
    make(growthBp === null ? 'Slower · −20% saved' : 'Slower · −20% saved, price +2 pts',
      Math.round(monthly * 0.8), growthBp === null ? null : growthBp + 200);
  }
  const missing: string[] = [];
  if (input.historyMonths < 3) missing.push('Fewer than 3 months of recorded income and spending.');
  if (growthBp === null) missing.push('No price-growth assumption for this target (treated as 0%).');
  if (inflationBp === null) missing.push('No general-inflation scenario, so purchasing-power value is not shown.');
  if (monthly <= 0 && saved < target) missing.push('No planned monthly contribution.');
  const assumptions = [
    'Cash earns no return unless you enter one.',
    growthBp === null ? 'Target price stays at today’s price.' : `Target price grows ${bpToPercent(growthBp)} a year (target-specific).`,
    inflationBp === null ? 'General inflation not set.' : `General inflation scenario ${bpToPercent(inflationBp)} a year, used only for purchasing power.`,
  ];
  const years = (horizonMonths ?? 0) / 12;
  return {
    status, remainingToday, etaMonths: months, etaDate, requiredMonthly,
    futureTarget, realFutureTarget: inflationBp === null ? null : realValue(futureTarget, inflationBp, years),
    horizonDate: targetDate ?? etaDate,
    scenarios, provisional: input.historyMonths < 3 || growthBp === null, assumptions, missing,
  };
}

/* ---------- backup validation ---------- */

type Row = Record<string, string | number | null>;
const bad = (what: string): never => { throw new Error(`Invalid backup: ${what}.`); };
const int = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v);
const text = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max;

/** Row-level and relational checks for every finance table, run before any restore write. */
export function validateFinanceBackup(t: Record<string, Row[]>, goalIds: Set<unknown>): void {
  const ids = (rows: Row[]) => new Set(rows.map((r) => r.id));
  const accounts = ids(t.fin_accounts), categories = ids(t.fin_categories), tags = ids(t.fin_tags),
    txs = ids(t.fin_transactions), finGoals = ids(t.fin_goals);
  const categoryRows = new Map<unknown, Row>();
  for (const row of t.fin_categories) categoryRows.set(row.id, row);
  const transactionRows = new Map<unknown, Row>();
  for (const row of t.fin_transactions) transactionRows.set(row.id, row);
  for (const r of t.fin_settings) {
    if ((r.usd_rate_x100 !== null && (!int(r.usd_rate_x100) || r.usd_rate_x100 <= 0))
      || (r.usd_rate_date !== null && !isDateKey(String(r.usd_rate_date))) || (r.usd_rate_source !== null && !text(r.usd_rate_source, 80))
      || (r.usd_rate_x100 === null) !== (r.usd_rate_date === null)) bad('dollar rate');
    if (r.id !== 'main' || !text(r.unit, 16) || !String(r.unit).trim() || ![0, 2].includes(r.decimals as number)
      || (r.inflation_bp !== null && (!int(r.inflation_bp) || r.inflation_bp < 0 || r.inflation_bp > 1000000))) bad('finance settings');
  }
  for (const r of t.fin_accounts) {
    if (!text(r.name, 80) || !String(r.name).trim() || !ACCOUNT_KINDS.includes(r.kind as never) || !int(r.opening)) bad('account');
  }
  for (const r of t.fin_categories) {
    if (!text(r.name, 80) || !String(r.name).trim() || !['income', 'expense'].includes(String(r.kind)) || !text(r.group_name, 80)) bad('category');
  }
  for (const r of t.fin_tags) if (!text(r.name, 40) || !String(r.name).trim()) bad('tag');

  for (const r of t.fin_transactions) {
    const type = r.type as TxType;
    if (!TX_TYPES.includes(type) || !int(r.amount) || (type === 'adjustment' ? r.amount === 0 : (r.amount as number) <= 0)
      || !isDateKey(String(r.date)) || !accounts.has(r.account_id) || !text(r.payee, 200) || !text(r.note, 2000)) bad('transaction');
    if (type === 'transfer' ? !accounts.has(r.to_account_id) || r.to_account_id === r.account_id : r.to_account_id !== null) bad('transfer');
    if (r.category_id !== null && !categories.has(r.category_id)) bad('transaction category');
    if ((type === 'transfer' || type === 'adjustment') && (r.category_id !== null || r.refund_of_id !== null)) bad('uncategorized type');
    if (r.refund_of_id !== null) {
      const original = transactionRows.get(r.refund_of_id);
      if (type !== 'income' || !original || original.type !== 'expense' || r.refund_of_id === r.id) bad('refund link');
      if (r.category_id !== null && categoryRows.get(r.category_id)?.kind !== 'expense') bad('refund category');
    } else if ((type === 'income' || type === 'expense') && r.category_id !== null
      && categoryRows.get(r.category_id)?.kind !== type) bad('transaction category kind');
  }

  const splitRows = new Map<unknown, { categoryId: unknown; amount: number }[]>();
  const splitSum = new Map<unknown, { sum: number; n: number }>();
  for (const r of t.fin_splits) {
    const tx = transactionRows.get(r.tx_id);
    const category = categoryRows.get(r.category_id);
    const expectedKind = tx?.refund_of_id !== null ? 'expense' : tx?.type;
    if (!txs.has(r.tx_id) || !category || !int(r.amount) || (r.amount as number) <= 0
      || (expectedKind !== 'income' && expectedKind !== 'expense') || category.kind !== expectedKind) bad('split');
    const s = splitSum.get(r.tx_id) ?? { sum: 0, n: 0 };
    splitSum.set(r.tx_id, { sum: s.sum + (r.amount as number), n: s.n + 1 });
    splitRows.set(r.tx_id, [...(splitRows.get(r.tx_id) ?? []), { categoryId: r.category_id, amount: r.amount as number }]);
  }

  const linesFor = (tx: Row): { categoryId: unknown; amount: number }[] => {
    const split = splitRows.get(tx.id) ?? [];
    if (split.length) {
      if (tx.category_id !== null) bad('split totals');
      return split;
    }
    return tx.category_id !== null ? [{ categoryId: tx.category_id, amount: Number(tx.amount) }] : [];
  };
  const refundsByOriginal = new Map<unknown, { total: number; lines: { categoryId: unknown; amount: number }[] }>();
  for (const tx of t.fin_transactions) {
    const split = splitSum.get(tx.id);
    if (split && (split.n < 2 || split.sum !== tx.amount || (tx.type !== 'income' && tx.type !== 'expense'))) bad('split totals');
    if (tx.type === 'income' || tx.type === 'expense') {
      const lines = linesFor(tx);
      if (!lines.length || lines.reduce((sum, line) => sum + line.amount, 0) !== tx.amount) bad('transaction category lines');
    }
    if (tx.refund_of_id !== null) {
      const original = transactionRows.get(tx.refund_of_id)!;
      const group = refundsByOriginal.get(tx.refund_of_id) ?? { total: 0, lines: [] };
      group.total += Number(tx.amount);
      group.lines.push(...linesFor(tx));
      if (group.total > Number(original.amount)) bad('refund totals');
      refundsByOriginal.set(tx.refund_of_id, group);
    }
  }
  for (const [originalId, refunds] of refundsByOriginal) {
    const original = transactionRows.get(originalId)!;
    const originalLines = linesFor(original);
    if (!originalLines.length || originalLines.reduce((sum, line) => sum + line.amount, 0) !== original.amount) bad('refund original category lines');
    const capacity = new Map<unknown, number>();
    for (const line of originalLines) capacity.set(line.categoryId, (capacity.get(line.categoryId) ?? 0) + line.amount);
    const used = new Map<unknown, number>();
    for (const line of refunds.lines) {
      if (!capacity.has(line.categoryId)) bad('refund category');
      const next = (used.get(line.categoryId) ?? 0) + line.amount;
      if (next > capacity.get(line.categoryId)!) bad('refund category totals');
      used.set(line.categoryId, next);
    }
  }

  const pairs = new Set<string>();
  for (const r of t.fin_tx_tags) {
    const key = JSON.stringify([r.tx_id, r.tag_id]);
    if (!txs.has(r.tx_id) || !tags.has(r.tag_id) || pairs.has(key)) bad('tag link');
    pairs.add(key);
  }
  for (const r of t.fin_goals) {
    if (!text(r.title, 120) || !String(r.title).trim() || !int(r.target) || (r.target as number) <= 0 || !int(r.monthly) || (r.monthly as number) < 0
      || (r.target_date !== null && !isDateKey(String(r.target_date)))
      || (r.growth_bp !== null && (!int(r.growth_bp) || r.growth_bp < -5000 || r.growth_bp > 1000000))
      || (r.goal_id !== null && !goalIds.has(r.goal_id))) bad('money goal');
  }
  for (const r of t.fin_allocations) {
    if (!finGoals.has(r.fin_goal_id) || !int(r.amount) || r.amount === 0 || !isDateKey(String(r.date)) || !text(r.note, 500)) bad('allocation');
  }
  for (const r of t.fin_budgets) {
    if (!int(r.amount) || (r.amount as number) <= 0 || (r.category_id !== null && (!categories.has(r.category_id)
      || categoryRows.get(r.category_id)?.kind !== 'expense'))) bad('budget');
  }
  for (const r of t.fin_plans) {
    if (!text(r.title, 120) || !String(r.title).trim() || !['income', 'expense'].includes(String(r.direction)) || !int(r.amount) || (r.amount as number) <= 0
      || !CADENCES.includes(r.cadence as never) || !NATURES.includes(r.nature as never) || !isDateKey(String(r.due_date))
      || (r.category_id !== null && (!categories.has(r.category_id) || categoryRows.get(r.category_id)?.kind !== r.direction))
      || (r.account_id !== null && !accounts.has(r.account_id))) bad('planned item');
  }
}

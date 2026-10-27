import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useEvridaDatabase } from '../../storage/use-database';
import {
  loadFinance, saveAccount, setAccountArchived, setupFinance, updateFinanceSettings, type FinanceSnapshot,
} from '../../storage/finance';
import {
  ACCOUNT_KINDS, accountBalance, addMonthsToMonth, bpToPercent, categoryChange, categoryTotals, compactAmount, coveredMonths,
  formatAmount, formatMoney, formatUsd, groupDigits, monthOf, monthSummary, netWorth, parseAmount, parsePercent, parseRate, tagTotals, toUsd, trend, type AccountKind, type FinAccount, type FinTx,
} from '../../domain/finance';
import { periodKey } from '../../domain/horizons';
import { colors, radius, spacing, withAlpha, type Palette } from '../../theme/tokens';
import { fonts, type } from '../../theme/type';
import { useDockInset } from '../shell/DockInset';
import { EmptyState } from '../shared/EmptyState';
import { TransactionSheet, type TxPreset } from './TransactionSheet';
import { GoalsPanel } from './GoalsPanel';
import { PlanPanel } from './PlanPanel';
import { Bar, Card, Chip, ChipRow, Field, Label, PrimaryButton, Segments, Sheet, TextButton, dateName, monthName, useBusy } from './ui';
import { fetchUsdRate } from './rates';
import { CategoriesSheet } from './CategoriesSheet';
import { budgetAlertsOn, checkBudgetAlerts, setBudgetAlerts } from './alerts';
import { Calendar, ChevronLeft, ChevronRight, Plus, Receipt, Settings2, Target, TrendUp, Wallet } from '../../theme/icons';

type Tab = 'overview' | 'ledger' | 'goals' | 'plan';
const monthLabel = monthName;
const KIND_LABEL: Record<AccountKind, string> = { cash: 'Cash', bank: 'Bank', wallet: 'Wallet', liability: 'Debt' };
const UNITS: { unit: string; decimals: 0 | 2 }[] = [
  { unit: 'Toman', decimals: 0 }, { unit: 'Rial', decimals: 0 }, { unit: 'USD', decimals: 2 }, { unit: 'EUR', decimals: 2 },
];

export function MoneyScreen() {
  const db = useEvridaDatabase();
  const router = useRouter();
  const dockInset = useDockInset();
  const palette = useColorScheme() === 'dark' ? colors.dark : colors.light;
  const [data, setData] = useState<FinanceSnapshot | null | undefined>(undefined);
  const [failure, setFailure] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [month, setMonth] = useState(() => monthOf(periodKey('day', new Date())));
  const [editing, setEditing] = useState<{ tx: FinTx | null; preset?: TxPreset } | null>(null);
  const [account, setAccount] = useState<FinAccount | 'new' | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);

  const reload = useCallback(() => {
    loadFinance(db).then((value) => { setData(value); setFailure(null); if (value) void checkBudgetAlerts(value, periodKey('day', new Date())); },
      (error) => setFailure(error instanceof Error ? error.message : 'Money could not be loaded.'));
  }, [db]);
  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  const header = (right?: React.ReactNode) => <View style={styles.top}>
    <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/insights')} accessibilityRole="button" accessibilityLabel="Back"
      style={[styles.round, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      <ChevronLeft size={21} color={palette.foreground} />
    </Pressable>
    <Text style={[type.display, { color: palette.foreground, flex: 1, fontSize: 32 }]} accessibilityRole="header">Money</Text>
    {right}
  </View>;

  if (failure) return <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: palette.background }]}>
    <View style={styles.page}>{header()}<Text style={{ color: palette.foreground }}>{failure}</Text><TextButton label="Retry" onPress={reload} palette={palette} /></View>
  </SafeAreaView>;
  if (data === undefined) return <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: palette.background }]}>
    <View style={styles.page}>{header()}<ActivityIndicator color={palette.accent} style={{ marginTop: 40 }} /></View>
  </SafeAreaView>;
  if (data === null) return <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: palette.background }]}>
    <ScrollView contentContainerStyle={[styles.page, { paddingBottom: 40 + dockInset }]} keyboardShouldPersistTaps="handled">
      {header()}<Setup palette={palette} onDone={reload} onSkip={() => router.canGoBack() ? router.back() : router.replace('/')} />
    </ScrollView>
  </SafeAreaView>;

  const openAdd = () => setEditing({ tx: null });
  return <SafeAreaView edges={['top', 'left', 'right']} style={[styles.screen, { backgroundColor: palette.background }]}>
    <ScrollView contentContainerStyle={[styles.page, { paddingBottom: 48 + dockInset }]} keyboardShouldPersistTaps="handled">
      {header(<>
        <Pressable onPress={() => setSettingsOpen(true)} accessibilityRole="button" accessibilityLabel="Money settings"
          style={[styles.round, { backgroundColor: palette.surface, borderColor: palette.border }]}><Settings2 size={20} color={palette.foreground} strokeWidth={1.8} /></Pressable>
        <Pressable onPress={openAdd} accessibilityRole="button" accessibilityLabel="Add a record"
          style={[styles.round, { backgroundColor: palette.accent, borderColor: palette.accent }]}><Plus size={22} color={palette.onAccent} strokeWidth={1.9} /></Pressable>
      </>)}
      <Segments palette={palette} value={tab} onChange={setTab}
        options={[{ id: 'overview', label: 'Overview', icon: TrendUp }, { id: 'ledger', label: 'Ledger', icon: Receipt }, { id: 'goals', label: 'Goals', icon: Target }, { id: 'plan', label: 'Plan', icon: Calendar }]} />
      {tab === 'overview' || tab === 'ledger' ? <MonthNav month={month} onChange={setMonth} palette={palette} /> : null}
      {tab === 'overview' ? <Overview data={data} month={month} palette={palette} onAdd={openAdd} onAccount={setAccount} /> : null}
      {tab === 'ledger' ? <Ledger data={data} month={month} palette={palette} onEdit={(tx) => setEditing({ tx })} onAdd={openAdd} /> : null}
      {tab === 'goals' ? <GoalsPanel data={data} palette={palette} onChanged={reload} /> : null}
      {tab === 'plan' ? <PlanPanel data={data} month={month} palette={palette} onChanged={reload} /> : null}
      <Text style={[type.caption, { color: palette.muted, marginTop: 8 }]}>
        Stored only on this device and included in your Evrida backup. Projections are arithmetic on your assumptions, not predictions or financial advice.
      </Text>
    </ScrollView>

    <TransactionSheet visible={!!editing} data={data} initial={editing?.tx ?? null} preset={editing?.preset} palette={palette}
      onClose={() => setEditing(null)} onChanged={reload}
      onRefund={(tx) => setEditing({ tx: null, preset: { type: 'income', refundOfId: tx.id, categoryId: tx.splits.length ? undefined : tx.categoryId ?? undefined, splits: tx.splits, amount: tx.amount, accountId: tx.accountId, note: 'Refund' } })} />
    <AccountSheet data={data} target={account} palette={palette} onClose={() => setAccount(null)} onChanged={reload} />
    <SettingsSheet data={data} visible={settingsOpen} palette={palette} onClose={() => setSettingsOpen(false)} onChanged={reload}
      onCategories={() => { setSettingsOpen(false); setCategoriesOpen(true); }} />
    <CategoriesSheet data={data} visible={categoriesOpen} palette={palette} onClose={() => setCategoriesOpen(false)} onChanged={reload} />
  </SafeAreaView>;
}

function MonthNav({ month, onChange, palette }: { month: string; onChange: (m: string) => void; palette: Palette }) {
  return <View style={styles.monthNav}>
    <Pressable onPress={() => onChange(addMonthsToMonth(month, -1))} accessibilityRole="button" accessibilityLabel="Previous month" style={styles.navBtn}><ChevronLeft size={22} color={palette.foreground} /></Pressable>
    <Text style={[type.heading, { color: palette.foreground }]}>{monthLabel(month)}</Text>
    <Pressable onPress={() => onChange(addMonthsToMonth(month, 1))} accessibilityRole="button" accessibilityLabel="Next month" style={styles.navBtn}><ChevronRight size={22} color={palette.foreground} /></Pressable>
  </View>;
}

function Setup({ palette, onDone, onSkip }: { palette: Palette; onDone: () => void; onSkip: () => void }) {
  const db = useEvridaDatabase();
  const { busy, run } = useBusy();
  const [unit, setUnit] = useState('Toman');
  const [custom, setCustom] = useState('');
  const [decimals, setDecimals] = useState<0 | 2>(0);
  const [name, setName] = useState('Main account');
  const [opening, setOpening] = useState('');
  const [error, setError] = useState<string | null>(null);
  const finalUnit = unit === 'Other' ? custom.trim() : unit;
  async function start() {
    const value = opening.trim() ? parseAmount(opening, decimals) : 0;
    if (value === null) { setError(`Enter your balance with up to ${decimals} decimals.`); return; }
    if (!finalUnit) { setError('Name your currency or unit.'); return; }
    await run(async () => { await setupFinance(db, { unit: finalUnit, decimals, accountName: name, opening: value }); onDone(); }, setError);
  }
  return <View style={{ gap: 12 }}>
    <EmptyState Icon={Wallet} palette={palette} title="A personal accountant, on your phone."
      copy="Track what you have and spend, see where it goes, and estimate when a goal becomes reachable. It stays on this device, and you can skip it." />
    <Label palette={palette}>CURRENCY OR UNIT</Label>
    <ChipRow>
      {UNITS.map((u) => <Chip key={u.unit} label={u.unit} selected={unit === u.unit} palette={palette} onPress={() => { setUnit(u.unit); setDecimals(u.decimals); }} />)}
      <Chip label="Other" selected={unit === 'Other'} palette={palette} onPress={() => setUnit('Other')} />
    </ChipRow>
    {unit === 'Other' ? <Field label="Name" value={custom} onChangeText={setCustom} palette={palette} maxLength={16} placeholder="e.g. GBP" /> : null}
    <Text style={[type.caption, { color: palette.muted }]}>
      Rial and Toman differ by a factor of ten. Evrida never converts between them, so use the one you think in. It cannot be changed after you start.
    </Text>
    <Label palette={palette}>DECIMALS</Label>
    <Segments palette={palette} value={String(decimals) as '0' | '2'} onChange={(v) => setDecimals(v === '2' ? 2 : 0)}
      options={[{ id: '0', label: 'None' }, { id: '2', label: 'Two (cents)' }]} />
    <Field label="First account" value={name} onChangeText={setName} palette={palette} maxLength={80} />
    <Field label="What it holds today (optional)" value={opening} onChangeText={setOpening} palette={palette} keyboardType="decimal-pad" suffix={finalUnit || undefined} money={{ unit: finalUnit, decimals, inflationBp: null, usdRateX100: null, usdRateDate: null, usdRateSource: null }}
      hint="Your starting balance. Later records adjust it, and you can correct it any time." />
    {error ? <Text style={{ color: '#C0392B', fontSize: 13 }}>{error}</Text> : null}
    <PrimaryButton label={busy ? 'Starting…' : 'Start tracking'} onPress={() => void start()} palette={palette} disabled={busy} />
    <TextButton label="Not now" onPress={onSkip} palette={palette} muted />
  </View>;
}

function Overview({ data, month, palette, onAdd, onAccount }: {
  data: FinanceSnapshot; month: string; palette: Palette; onAdd: () => void; onAccount: (a: FinAccount | 'new') => void;
}) {
  const { settings, txs, categories, accounts } = data;
  const summary = useMemo(() => monthSummary(txs, month), [txs, month]);
  const byCategory = useMemo(() => [...categoryTotals(txs, month)].filter(([, v]) => v !== 0).sort((a, b) => b[1] - a[1]), [txs, month]);
  const byTag = useMemo(() => [...tagTotals(txs, month)].sort((a, b) => b[1] - a[1]).slice(0, 8), [txs, month]);
  const history = useMemo(() => trend(txs, month, 6), [txs, month]);
  const worth = netWorth(accounts, txs);
  const money = (v: number) => formatMoney(v, settings);
  const name = (id: string) => categories.find((c) => c.id === id)?.name ?? 'Category';
  const topTotal = byCategory.reduce((sum, [, v]) => sum + Math.max(0, v), 0) || 1;
  const observations = byCategory.slice(0, 4).map(([id]) => ({ id, change: categoryChange(txs, id, month) }))
    .filter((o) => o.change && Math.abs(o.change.pct) >= 10);
  const peak = Math.max(1, ...history.points.map((p) => Math.max(p.income, p.spent)));
  const covered = coveredMonths(txs);

  return <>
    <Card palette={palette}>
      <Text style={[type.overline, { color: palette.muted }]}>NET CASH FLOW · {monthLabel(month).toUpperCase()}</Text>
      <Text style={[type.numeral, { fontSize: 34, lineHeight: 40, color: summary.net < 0 ? palette.horizon.week : palette.foreground }]} accessibilityLabel={`Net cash flow ${money(summary.net)}`}>
        {summary.net > 0 ? '+' : ''}{formatAmount(summary.net, settings)} <Text style={{ fontSize: 15, color: palette.muted, fontFamily: undefined }}>{settings.unit}</Text>
      </Text>
      <View style={styles.row}>
        <View style={{ flex: 1 }}><Text style={[type.caption, { color: palette.muted }]}>Income</Text><Text style={[type.numeral, { fontSize: 18, color: palette.foreground }]}>{formatAmount(summary.income, settings)}</Text></View>
        <View style={{ flex: 1 }}><Text style={[type.caption, { color: palette.muted }]}>Spent (net of refunds)</Text><Text style={[type.numeral, { fontSize: 18, color: palette.foreground }]}>{formatAmount(summary.spent, settings)}</Text></View>
      </View>
      <Text style={[type.caption, { color: palette.muted }]}>
        {summary.count === 0 ? `No income or spending recorded for ${monthLabel(month)}. This month is a gap, not zero spending.`
          : summary.savingsRate === null ? `${summary.count} record${summary.count === 1 ? "" : "s"}. Add income to see a savings rate.`
          : `${summary.count} record${summary.count === 1 ? "" : "s"} · you kept ${Math.round(summary.savingsRate * 100)}% of income. Transfers are not counted.`}
      </Text>
      {summary.count === 0 ? <TextButton label="Add the first record" onPress={onAdd} palette={palette} /> : null}
    </Card>

    <Card palette={palette}>
      <View style={styles.row}><Text style={[type.heading, { color: palette.foreground, flex: 1 }]}>Accounts</Text><TextButton label="＋ Account" onPress={() => onAccount('new')} palette={palette} /></View>
      {accounts.filter((a) => !a.archived).map((a) => <Pressable key={a.id} accessibilityRole="button" accessibilityLabel={`${a.name}, ${money(accountBalance(a, txs, accounts))}`} onPress={() => onAccount(a)} style={styles.listRow}>
        <View style={{ flex: 1 }}><Text style={{ color: palette.foreground, fontSize: 15, fontWeight: '600' }}>{a.name}</Text><Text style={[type.caption, { color: palette.muted }]}>{KIND_LABEL[a.kind]}</Text></View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[type.numeral, { color: palette.foreground, fontSize: 16 }]}>{formatAmount(accountBalance(a, txs, accounts), settings)}</Text>
          {toUsd(accountBalance(a, txs, accounts), settings) !== null ? <Text style={[type.caption, { color: palette.muted }]}>≈ {formatUsd(toUsd(accountBalance(a, txs, accounts), settings)!)}</Text> : null}
        </View>
      </Pressable>)}
      {worth !== null && accounts.filter((a) => !a.archived).length > 1 ? <View style={[styles.listRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.border }]}>
        <Text style={{ color: palette.muted, flex: 1 }}>Net worth (debts subtracted)</Text><View style={{ alignItems: 'flex-end' }}><Text style={[type.numeral, { color: palette.foreground, fontSize: 16 }]}>{formatAmount(worth, settings)}</Text>
        {toUsd(worth, settings) !== null ? <Text style={[type.caption, { color: palette.muted }]}>≈ {formatUsd(toUsd(worth, settings)!)}</Text> : null}</View></View> : null}
    </Card>

    <Card palette={palette}>
      <Text style={[type.heading, { color: palette.foreground }]}>Where it went</Text>
      {byCategory.length === 0 ? <Text style={[type.body, { color: palette.muted }]}>Spending by category appears here once you record an expense.</Text> : byCategory.slice(0, 7).map(([id, value]) => (
        <View key={id} style={{ gap: 6 }}>
          <View style={styles.row}><Text style={{ color: palette.foreground, flex: 1, fontSize: 14 }}>{name(id)}</Text>
            <Text style={{ color: palette.muted, fontSize: 12 }}>{Math.round((Math.max(0, value) / topTotal) * 100)}%</Text>
            <Text style={[type.numeral, { color: palette.foreground, fontSize: 15, minWidth: 84, textAlign: 'right' }]}>{formatAmount(value, settings)}</Text></View>
          <Bar value={Math.max(0, value) / topTotal} color={palette.accent} palette={palette} />
        </View>))}
      {byTag.length ? <><Label palette={palette}>BY TAG</Label><ChipRow>
        {byTag.map(([id, value]) => <View key={id} style={[styles.tag, { backgroundColor: palette.inset }]}>
          <Text style={{ color: palette.foreground, fontSize: 12 }}>#{data.tags.find((t) => t.id === id)?.name ?? ''}</Text>
          <Text style={{ color: palette.muted, fontSize: 12 }}>{compactAmount(value, settings)}</Text></View>)}
      </ChipRow></> : null}
    </Card>

    <Card palette={palette}>
      <Text style={[type.heading, { color: palette.foreground }]}>Observations</Text>
      {observations.length ? observations.map(({ id, change }) => <Text key={id} style={[type.body, { color: palette.foreground }]}>
        {name(id)} is {Math.abs(change!.pct)}% {change!.pct > 0 ? 'above' : 'below'} its average of {formatAmount(change!.average, settings)} over {change!.windowMonths.length} earlier months
        ({change!.windowMonths.slice().reverse().map((m) => monthLabel(m, true)).join(', ')}).</Text>)
        : <Text style={[type.body, { color: palette.muted }]}>{covered.length < 4 ? `Comparisons need records in at least three earlier months. You have ${Math.max(0, covered.length - (covered.includes(month) ? 1 : 0))} so far.` : 'Nothing moved by more than 10% against your recent months.'}</Text>}
    </Card>

    <Card palette={palette}>
      <Text style={[type.heading, { color: palette.foreground }]}>Last 6 months</Text>
      <View style={styles.trend} accessibilityLabel="Income and spending per month">
        {history.points.map((p) => <View key={p.month} style={styles.trendCol}>
          <View style={styles.trendBars}>
            <View style={{ width: 9, height: Math.max(3, (p.income / peak) * 70), borderRadius: 4, backgroundColor: p.covered ? palette.accent : palette.border }} />
            <View style={{ width: 9, height: Math.max(3, (p.spent / peak) * 70), borderRadius: 4, backgroundColor: p.covered ? withAlpha(palette.horizon.week, 0.85) : palette.border }} />
          </View>
          <Text style={{ color: palette.muted, fontSize: 10 }}>{monthLabel(p.month, true)}</Text>
          {!p.covered ? <Text style={{ color: palette.muted, fontSize: 9 }}>no data</Text> : null}
        </View>)}
      </View>
      <Text style={[type.caption, { color: palette.muted }]}>
        <Text style={{ color: palette.accent }}>■</Text> income  <Text style={{ color: palette.horizon.week }}>■</Text> spent. {history.enough ? `Based on ${history.coveredCount} months with records; grey months have none and are not counted as zero.`
          : 'A trend needs records in at least three of these months.'}</Text>
    </Card>
  </>;
}

function Ledger({ data, month, palette, onEdit, onAdd }: { data: FinanceSnapshot; month: string; palette: Palette; onEdit: (tx: FinTx) => void; onAdd: () => void }) {
  const { settings } = data;
  const rows = data.txs.filter((t) => monthOf(t.date) === month);
  if (!rows.length) return <EmptyState Icon={Wallet} palette={palette} title="Nothing recorded this month."
    copy="Add a salary, a grocery run or a transfer. Records stay editable, and totals update immediately." actionLabel="Add a record" onAction={onAdd} />;
  const label = (tx: FinTx) => tx.type === 'transfer'
    ? `${data.accounts.find((a) => a.id === tx.accountId)?.name} → ${data.accounts.find((a) => a.id === tx.toAccountId)?.name}`
    : tx.type === 'adjustment' ? 'Balance adjustment'
    : tx.splits.length ? `Split · ${tx.splits.map((s) => data.categories.find((c) => c.id === s.categoryId)?.name).join(', ')}`
    : data.categories.find((c) => c.id === tx.categoryId)?.name ?? 'Uncategorized';
  let lastDate = '';
  return <Card palette={palette}>
    {rows.map((tx) => {
      const head = tx.date !== lastDate; lastDate = tx.date;
      const sign = tx.type === 'expense' ? -1 : tx.type === 'income' ? 1 : tx.type === 'adjustment' ? Math.sign(tx.amount) : 0;
      const tags = tx.tagIds.map((id) => data.tags.find((t) => t.id === id)?.name).filter(Boolean).map((n) => `#${n}`).join(' ');
      return <View key={tx.id}>
        {head ? <Text style={[type.overline, { color: palette.muted, marginTop: 6, marginBottom: 2 }]}>{tx.date.slice(8)} {monthLabel(tx.date.slice(0, 7), true).toUpperCase()}</Text> : null}
        <Pressable accessibilityRole="button" onPress={() => onEdit(tx)}
          accessibilityLabel={`${label(tx)}, ${sign < 0 ? 'spent' : sign > 0 ? 'received' : 'moved'} ${formatMoney(Math.abs(tx.amount), settings)}`} style={styles.listRow}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: palette.foreground, fontSize: 15, fontWeight: '600' }} numberOfLines={1}>{label(tx)}{tx.refundOfId ? ' · refund' : ''}</Text>
            <Text style={[type.caption, { color: palette.muted }]} numberOfLines={1}>
              {[(tx.payee || tx.note) === label(tx) ? '' : tx.payee || tx.note, data.accounts.find((a) => a.id === tx.accountId)?.name, tags].filter(Boolean).join(' · ')}</Text>
          </View>
          <Text style={[type.numeral, { fontSize: 16, color: sign > 0 ? palette.accent : sign < 0 ? palette.foreground : palette.muted }]}>
            {sign > 0 ? '+' : sign < 0 ? '−' : ''}{formatAmount(Math.abs(tx.amount), settings)}</Text>
        </Pressable>
      </View>;
    })}
  </Card>;
}

function AccountSheet({ data, target, palette, onClose, onChanged }: { data: FinanceSnapshot; target: FinAccount | 'new' | null; palette: Palette; onClose: () => void; onChanged: () => void }) {
  const db = useEvridaDatabase();
  const { busy, run } = useBusy();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<AccountKind>('bank');
  const [opening, setOpening] = useState('');
  const [error, setError] = useState<string | null>(null);
  const existing = target && target !== 'new' ? target : null;
  const { settings } = data;
  const typeLocked = !!existing && (data.txs.some((tx) => tx.accountId === existing.id || tx.toAccountId === existing.id)
    || data.plans.some((plan) => plan.accountId === existing.id));
  useEffect(() => {
    setError(null);
    setName(existing?.name ?? ''); setKind(existing?.kind ?? 'bank');
    setOpening(existing ? formatAmount(existing.opening, settings).replace(/,/g, '') : '');
  }, [target]); // eslint-disable-line react-hooks/exhaustive-deps
  async function save() {
    const value = opening.trim() ? parseAmount(opening, settings.decimals) : 0;
    if (value === null) { setError(`Enter the balance with up to ${settings.decimals} decimals.`); return; }
    await run(async () => { await saveAccount(db, { id: existing?.id, name, kind, opening: value }); onChanged(); onClose(); }, setError);
  }
  function archive() {
    if (!existing) return;
    Alert.alert('Hide this account?', 'Its records stay in your history and totals. It just disappears from the account list and pickers.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Hide', onPress: () => void run(async () => { await setAccountArchived(db, existing.id, true); onChanged(); onClose(); }, setError) },
    ]);
  }
  return <Sheet visible={!!target} title={existing ? 'Edit account' : 'New account'} palette={palette} onClose={onClose}
    footer={<>{error ? <Text style={{ color: '#C0392B', fontSize: 13, marginBottom: 6 }}>{error}</Text> : null}
      <PrimaryButton label={busy ? 'Saving…' : 'Save account'} onPress={() => void save()} palette={palette} disabled={busy || !name.trim()} />
      {existing ? <TextButton label="Hide account" onPress={archive} palette={palette} muted /> : null}</>}>
    <Field label="Name" value={name} onChangeText={setName} palette={palette} maxLength={80} placeholder="e.g. Savings" />
    <Label palette={palette}>TYPE</Label>
    {typeLocked
      ? <Text style={[type.caption, { color: palette.muted }]}>Type is locked because this account is used by transactions or planned items. Create a new account with the correct type if needed.</Text>
      : <ChipRow>{ACCOUNT_KINDS.map((k) => <Chip key={k} label={KIND_LABEL[k]} selected={kind === k} palette={palette} onPress={() => setKind(k)} />)}</ChipRow>}
    <Field label={kind === 'liability' ? 'Amount owed at the start' : 'Balance at the start'} value={opening} onChangeText={setOpening} palette={palette}
      keyboardType="decimal-pad" suffix={settings.unit} money={settings} negative hint="Records you add later change the balance. To fix a wrong balance, add an adjustment rather than editing history." />
  </Sheet>;
}

function SettingsSheet({ data, visible, palette, onClose, onChanged, onCategories }: { data: FinanceSnapshot; visible: boolean; palette: Palette; onClose: () => void; onChanged: () => void; onCategories: () => void }) {
  const db = useEvridaDatabase();
  const { busy, run } = useBusy();
  const [unit, setUnit] = useState('');
  const [inflation, setInflation] = useState('');
  const [rate, setRate] = useState('');
  const [rateMeta, setRateMeta] = useState<{ date: string; source: string } | null>(null);
  const [fetching, setFetching] = useState(false);
  const [alerts, setAlerts] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const s = data.settings;
  useEffect(() => {
    if (!visible) return;
    setUnit(s.unit); setInflation(s.inflationBp === null ? '' : String(s.inflationBp / 100)); setError(null);
    setRate(s.usdRateX100 === null ? '' : groupDigits(String(s.usdRateX100 / 100), 2));
    setRateMeta(s.usdRateDate ? { date: s.usdRateDate, source: s.usdRateSource ?? 'Entered by you' } : null);
    void budgetAlertsOn().then(setAlerts);
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps
  const isUsd = unit.trim().toUpperCase() === 'USD';
  async function fetchRate() {
    setFetching(true); setError(null);
    try {
      const fetched = await fetchUsdRate(unit);
      setRate(groupDigits(String(fetched.x100 / 100), 2)); setRateMeta({ date: fetched.date, source: fetched.source });
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not fetch the rate.'); }
    finally { setFetching(false); }
  }
  async function save() {
    const bp = inflation.trim() ? parsePercent(inflation) : null;
    if (inflation.trim() && bp === null) { setError('Enter the yearly rate as a percentage, for example 35 or 4.5.'); return; }
    const x100 = rate.trim() && !isUsd ? parseRate(rate) : null;
    if (rate.trim() && !isUsd && x100 === null) { setError('Enter the dollar price as a number, for example 160000.'); return; }
    // Typing clears the metadata, so a typed rate is dated today; a fetched or untouched one keeps its own date and source.
    const meta = x100 === null ? null : rateMeta ?? { date: periodKey('day', new Date()), source: 'Entered by you' };
    await run(async () => {
      await updateFinanceSettings(db, { unit, inflationBp: bp, usdRateX100: x100, usdRateDate: meta?.date ?? null, usdRateSource: meta?.source ?? null });
      onChanged(); onClose();
    }, setError);
  }
  return <Sheet visible={visible} title="Money settings" palette={palette} onClose={onClose}
    footer={<>{error ? <Text accessibilityLiveRegion="polite" style={{ color: '#C0392B', fontSize: 13, marginBottom: 6 }}>{error}</Text> : null}
      <PrimaryButton label={busy ? 'Saving…' : 'Save'} onPress={() => void save()} palette={palette} disabled={busy || fetching} /></>}>
    <Field label="Currency or unit label" value={unit} onChangeText={setUnit} palette={palette} maxLength={16}
      hint={`Amounts use ${s.decimals} decimals. Changing the label does not convert any amount.`} />
    {isUsd ? <Text style={[type.caption, { color: palette.muted }]}>Your amounts are already in dollars, so no dollar rate is needed.</Text> : <>
      <Field label={`Price of 1 US dollar (in ${unit.trim() || 'your unit'})`} value={rate} onChangeText={(t) => { setRate(groupDigits(t, 2)); setRateMeta(null); }} palette={palette}
        keyboardType="decimal-pad" suffix={unit.trim() || undefined}
        hint={rateMeta ? `${rateMeta.source} · ${dateName(rateMeta.date)}. Amounts show a dollar value using this rate; stored amounts never change.`
          : 'Optional. Type the rate you trust. Leave it empty and no dollar values are shown.'} />
      <TextButton label={fetching ? 'Fetching…' : 'Suggest a rate from the internet'} onPress={() => void fetchRate()} palette={palette} />
      {rate ? <TextButton label="Remove the rate (hide dollar values)" onPress={() => { setRate(''); setRateMeta(null); }} palette={palette} muted /> : null}
      <Text style={[type.caption, { color: palette.muted }]}>
        Only a request for the public rate is sent; none of your records leave this device. For Toman and Rial the rate is the market price of a dollar-pegged token (USDT) on a public exchange, which tracks the open-market dollar but may be wrong or out of date. A fetched number only fills the box; nothing changes until you press Save, and you can overwrite it with your own.</Text>
    </>}
    <TextButton label="Manage categories" onPress={onCategories} palette={palette} />
    <TextButton label={alerts ? 'Budget alerts: on (tap to turn off)' : 'Turn on budget alerts'} palette={palette} muted={alerts}
      onPress={() => void run(async () => { await setBudgetAlerts(!alerts); setAlerts(!alerts); }, setError)} />
    <Text style={[type.caption, { color: palette.muted }]}>
      Optional. One notification the first time a budget passes 80% or goes over in a month. It names the category but never shows amounts.</Text>
    <Field label="General inflation scenario (per year)" value={inflation} onChangeText={setInflation} palette={palette} keyboardType="decimal-pad" suffix="%"
      hint={s.inflationBp === null ? 'Optional. Your own assumption, used only to express future amounts in today’s purchasing power. Evrida does not look up inflation figures.'
        : `Currently ${bpToPercent(s.inflationBp)} a year. This is a scenario you entered, not observed inflation.`} />
  </Sheet>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  page: { padding: spacing.gutter, gap: 14 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52 },
  round: { width: 48, height: 48, borderWidth: 1, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 6 },
  tag: { flexDirection: 'row', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.full },
  trend: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', minHeight: 110 },
  trendCol: { alignItems: 'center', gap: 3, flex: 1 },
  trendBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 72 },
});
void fonts;

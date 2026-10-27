import { useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { useEvridaDatabase } from '../../storage/use-database';
import { confirmPlan, savePlan, setBudget, setPlanArchived, type FinanceSnapshot } from '../../storage/finance';
import {
  CADENCES, NATURES, budgetState, categoryTotals, formatAmount, formatMoney, monthSummary, monthlyReserve, parseAmount,
  type Cadence, type FinBudget, type FinPlan, type Nature,
} from '../../domain/finance';
import { periodKey } from '../../domain/horizons';
import { type Palette } from '../../theme/tokens';
import { type } from '../../theme/type';
import { DateTimeField } from '../shared/DateTimeField';
import { Bar, Card, Chip, ChipRow, Field, Label, PrimaryButton, Segments, Sheet, TextButton, dateName, monthName, useBusy } from './ui';

const NATURE_LABEL: Record<Nature, string> = { fixed: 'Fixed', flexible: 'Flexible', irregular: 'Irregular' };
const NATURE_HINT: Record<Nature, string> = {
  fixed: 'Same amount on a schedule, like rent.', flexible: 'Recurring but varies, like groceries.', irregular: 'Predictable but not monthly, like car repairs.',
};

export function PlanPanel({ data, month, palette, onChanged }: { data: FinanceSnapshot; month: string; palette: Palette; onChanged: () => void }) {
  const { settings } = data;
  const [budget, setBudgetTarget] = useState<{ categoryId: string | null } | null>(null);
  const [plan, setPlan] = useState<FinPlan | 'new' | null>(null);
  const spentByCategory = categoryTotals(data.txs, month);
  const spent = monthSummary(data.txs, month).spent;
  const overall = data.budgets.find((b) => b.categoryId === null);
  const perCategory = data.budgets.filter((b) => b.categoryId !== null);
  const plans = data.plans.filter((p) => !p.archived);
  const money = (n: number) => formatMoney(n, settings);
  const reserve = plans.filter((p) => p.direction === 'expense' && (p.cadence === 'yearly' || p.nature === 'irregular'))
    .reduce((sum, p) => sum + monthlyReserve(p), 0);
  const flexible = plans.filter((p) => p.direction === 'expense' && p.nature === 'flexible' && p.cadence === 'monthly').reduce((sum, p) => sum + p.amount, 0);
  const commitments = plans.filter((p) => p.direction === 'expense' && p.nature === 'fixed' && p.cadence === 'monthly').reduce((sum, p) => sum + p.amount, 0);
  const expectedIncome = plans.filter((p) => p.direction === 'income').reduce((sum, p) => sum + monthlyReserve(p), 0);

  const row = (label: string, b: FinBudget, value: number) => {
    const state = budgetState(value, b.amount);
    const color = state === 'over' ? palette.horizon.week : state === 'near' ? palette.horizon.day : palette.accent;
    return <View key={b.id} style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Text style={{ color: palette.foreground, flex: 1, fontSize: 14, fontWeight: '600' }}>{label}</Text>
        <Text style={[type.caption, { color: palette.muted }]}>{formatAmount(Math.max(0, value), settings)} / {formatAmount(b.amount, settings)}</Text>
      </View>
      <Bar value={value / b.amount} color={color} palette={palette} />
      <Text style={[type.caption, { color: state === 'ok' ? palette.muted : color, fontWeight: state === 'ok' ? '400' : '700' }]}>
        {state === 'over' ? `${money(value - b.amount)} over this month’s budget` : state === 'near' ? `${money(b.amount - value)} left, more than 80% used` : `${money(b.amount - value)} left`}
      </Text>
    </View>;
  };

  return <>
    <Card palette={palette}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={[type.heading, { color: palette.foreground, flex: 1 }]}>Budgets · {monthName(month)}</Text>
        <TextButton label="＋ Budget" palette={palette} onPress={() => setBudgetTarget({ categoryId: '' })} />
      </View>
      {!overall && perCategory.length === 0 ? <Text style={[type.body, { color: palette.muted }]}>Optional. Set a monthly spending target, overall or for a category, and see how much is left.</Text> : null}
      {overall ? row('Overall spending', overall, spent) : null}
      {perCategory.map((b) => row(data.categories.find((c) => c.id === b.categoryId)?.name ?? 'Category', b, spentByCategory.get(b.categoryId!) ?? 0))}
      {overall || perCategory.length ? <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {overall ? <TextButton label="Edit overall" palette={palette} onPress={() => setBudgetTarget({ categoryId: null })} /> : null}
        {perCategory.map((b) => <TextButton key={b.id} palette={palette} muted label={`Edit ${data.categories.find((c) => c.id === b.categoryId)?.name ?? ''}`} onPress={() => setBudgetTarget({ categoryId: b.categoryId })} />)}
      </View> : null}
    </Card>

    <Card palette={palette}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={[type.heading, { color: palette.foreground, flex: 1 }]}>Planned items</Text>
        <TextButton label="＋ Item" palette={palette} onPress={() => setPlan('new')} />
      </View>
      {plans.length === 0 ? <Text style={[type.body, { color: palette.muted }]}>Salary, rent, subscriptions, or a yearly cost like car service. These are forecasts: nothing is recorded until you confirm it.</Text>
        : NATURES.map((nature) => {
          const list = plans.filter((p) => p.direction === 'expense' && p.nature === nature);
          if (!list.length) return null;
          return <View key={nature} style={{ gap: 4 }}>
            <Label palette={palette}>{NATURE_LABEL[nature].toUpperCase()}</Label>
            {list.map((p) => <PlanRow key={p.id} plan={p} palette={palette} money={money} amount={formatAmount(p.amount, settings)} onPress={() => setPlan(p)} />)}
          </View>;
        })}
      {plans.some((p) => p.direction === 'income') ? <View style={{ gap: 4 }}>
        <Label palette={palette}>EXPECTED INCOME</Label>
        {plans.filter((p) => p.direction === 'income').map((p) => <PlanRow key={p.id} plan={p} palette={palette} money={money} amount={formatAmount(p.amount, settings)} onPress={() => setPlan(p)} />)}
      </View> : null}
      {plans.length ? <View style={{ gap: 4, borderTopWidth: 1, borderTopColor: palette.border, paddingTop: 10 }}>
        <Text style={[type.caption, { color: palette.muted }]}>Monthly picture from your planned items (a forecast)</Text>
        {expectedIncome > 0 ? <Text style={{ color: palette.foreground, fontSize: 14 }}>Expected income {money(expectedIncome)}</Text> : null}
        <Text style={{ color: palette.foreground, fontSize: 14 }}>Fixed commitments {money(commitments)}</Text>
        {flexible > 0 ? <Text style={{ color: palette.foreground, fontSize: 14 }}>Planned flexible spending {money(flexible)}</Text> : null}
        <Text style={{ color: palette.foreground, fontSize: 14 }}>Set aside for yearly and irregular costs {money(reserve)}</Text>
        {expectedIncome > 0 ? <Text style={[type.cardTitle, { color: expectedIncome - commitments - reserve - flexible < 0 ? palette.horizon.week : palette.foreground }]}>
          Left over {money(expectedIncome - commitments - reserve - flexible)}</Text> : <Text style={[type.caption, { color: palette.muted }]}>Add expected income to see what is left after commitments.</Text>}
        <Text style={[type.caption, { color: palette.muted }]}>Reserves are planning amounts. They are not recorded as spending until a real cost happens.</Text>
      </View> : null}
    </Card>

    <BudgetSheet data={data} target={budget} palette={palette} onClose={() => setBudgetTarget(null)} onChanged={onChanged} />
    <PlanSheet data={data} target={plan} palette={palette} onClose={() => setPlan(null)} onChanged={onChanged} />
  </>;
}

function PlanRow({ plan, palette, money, amount, onPress }: { plan: FinPlan; palette: Palette; money: (n: number) => string; amount: string; onPress: () => void }) {
  const due = plan.dueDate <= periodKey('day', new Date());
  return <Pressable accessibilityRole="button" onPress={onPress} accessibilityLabel={`${plan.title}, ${money(plan.amount)} ${plan.cadence}, next ${plan.dueDate}`}
    style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56, paddingVertical: 6 }}>
    <View style={{ flex: 1, gap: 2 }}>
      <Text style={{ color: palette.foreground, fontSize: 15, fontWeight: '600' }} numberOfLines={1}>{plan.title}</Text>
      <Text style={[type.caption, { color: due ? palette.horizon.day : palette.muted, fontWeight: due ? '700' : '400' }]}>
        {due ? 'Due ' : 'Next '}{dateName(plan.dueDate)} · {plan.cadence}{plan.cadence === 'yearly' && plan.direction === 'expense' ? ` · ${money(monthlyReserve(plan))}/mo reserve` : ''}</Text>
    </View>
    <Text style={[type.numeral, { color: palette.foreground, fontSize: 15 }]}>{amount}</Text>
  </Pressable>;
}

function BudgetSheet({ data, target, palette, onClose, onChanged }: { data: FinanceSnapshot; target: { categoryId: string | null } | null; palette: Palette; onClose: () => void; onChanged: () => void }) {
  const db = useEvridaDatabase();
  const { busy, run } = useBusy();
  const { settings } = data;
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!target) return;
    setError(null);
    const id = target.categoryId === '' ? '' : target.categoryId;
    setCategoryId(id as string | null);
    const current = data.budgets.find((b) => b.categoryId === (id === '' ? undefined : id));
    setAmount(current ? formatAmount(current.amount, settings).replace(/,/g, '') : '');
  }, [target]); // eslint-disable-line react-hooks/exhaustive-deps
  const existing = data.budgets.find((b) => b.categoryId === categoryId);
  const choosing = target?.categoryId === '';
  async function save(remove = false) {
    const value = remove ? null : parseAmount(amount, settings.decimals);
    if (!remove && !value) { setError('Enter a budget greater than zero.'); return; }
    if (categoryId === '') { setError('Choose a category.'); return; }
    await run(async () => { await setBudget(db, categoryId, value); onChanged(); onClose(); }, setError);
  }
  return <Sheet visible={!!target} title={choosing ? 'Monthly budget' : categoryId === null ? 'Overall monthly budget' : 'Category budget'} palette={palette} onClose={onClose}
    footer={<>{error ? <Text style={{ color: '#C0392B', fontSize: 13, marginBottom: 6 }}>{error}</Text> : null}
      <PrimaryButton label={busy ? 'Saving…' : 'Save budget'} onPress={() => void save()} palette={palette} disabled={busy} />
      {existing ? <TextButton label="Remove budget" palette={palette} muted onPress={() => void save(true)} /> : null}</>}>
    {choosing ? <><Label palette={palette}>CATEGORY</Label><ChipRow>
      {data.categories.filter((c) => !c.archived && c.kind === 'expense').map((c) => <Chip key={c.id} label={c.name} selected={categoryId === c.id} palette={palette}
        onPress={() => { setCategoryId(c.id); const cur = data.budgets.find((b) => b.categoryId === c.id); setAmount(cur ? formatAmount(cur.amount, settings).replace(/,/g, '') : ''); }} />)}
      <Chip label="All spending" selected={categoryId === null} palette={palette} onPress={() => { setCategoryId(null); const cur = data.budgets.find((b) => b.categoryId === null); setAmount(cur ? formatAmount(cur.amount, settings).replace(/,/g, '') : ''); }} />
    </ChipRow></> : null}
    <Field label="Monthly amount" value={amount} onChangeText={setAmount} palette={palette} keyboardType="decimal-pad" suffix={settings.unit} money={settings}
      hint="Budgets compare against recorded spending, net of refunds. Unused amounts don’t carry over." />
  </Sheet>;
}

function PlanSheet({ data, target, palette, onClose, onChanged }: { data: FinanceSnapshot; target: FinPlan | 'new' | null; palette: Palette; onClose: () => void; onChanged: () => void }) {
  const db = useEvridaDatabase();
  const { busy, run } = useBusy();
  const { settings } = data;
  const existing = target && target !== 'new' ? target : null;
  const accounts = data.accounts.filter((a) => !a.archived);
  const [title, setTitle] = useState('');
  const [direction, setDirection] = useState<'income' | 'expense'>('expense');
  const [amount, setAmount] = useState('');
  const [cadence, setCadence] = useState<Cadence>('monthly');
  const [nature, setNature] = useState<Nature>('fixed');
  const [due, setDue] = useState(periodKey('day', new Date()));
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!target) return;
    setError(null);
    setTitle(existing?.title ?? ''); setDirection(existing?.direction ?? 'expense');
    setAmount(existing ? formatAmount(existing.amount, settings).replace(/,/g, '') : ''); setCadence(existing?.cadence ?? 'monthly');
    setNature(existing?.nature ?? 'fixed'); setDue(existing?.dueDate ?? periodKey('day', new Date()));
    setCategoryId(existing?.categoryId ?? null); setAccountId(existing?.accountId ?? accounts[0]?.id ?? null);
  }, [target]); // eslint-disable-line react-hooks/exhaustive-deps
  const categories = data.categories.filter((c) => !c.archived && c.kind === direction);
  const value = parseAmount(amount, settings.decimals);

  async function save() {
    if (!value) { setError('Enter an amount greater than zero.'); return; }
    await run(async () => {
      await savePlan(db, { id: existing?.id, title, direction, amount: value, cadence: nature === 'irregular' && cadence === 'monthly' ? 'yearly' : cadence, nature, dueDate: due, categoryId, accountId });
      onChanged(); onClose();
    }, setError);
  }
  async function confirm() {
    if (!existing) return;
    if (!categoryId || !accountId) { setError('Choose a category and an account first.'); return; }
    await run(async () => {
      await savePlan(db, { id: existing.id, title, direction, amount: value ?? existing.amount, cadence, nature, dueDate: due, categoryId, accountId });
      await confirmPlan(db, { ...existing, categoryId, accountId, amount: value ?? existing.amount, dueDate: due, cadence }, accountId, periodKey('day', new Date()));
      onChanged(); onClose();
    }, setError);
  }
  function archive() {
    if (!existing) return;
    Alert.alert('Remove this planned item?', 'Records you already confirmed stay in your ledger.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', onPress: () => void run(async () => { await setPlanArchived(db, existing.id, true); onChanged(); onClose(); }, setError) },
    ]);
  }
  return <Sheet visible={!!target} title={existing ? 'Planned item' : 'New planned item'} palette={palette} onClose={onClose}
    footer={<>{error ? <Text style={{ color: '#C0392B', fontSize: 13, marginBottom: 6 }}>{error}</Text> : null}
      <PrimaryButton label={busy ? 'Saving…' : 'Save'} onPress={() => void save()} palette={palette} disabled={busy || !title.trim()} />
      {existing ? <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <TextButton label={direction === 'income' ? 'Mark as received' : 'Mark as paid'} palette={palette} onPress={() => void confirm()} />
        <TextButton label="Remove" palette={palette} muted onPress={archive} />
      </View> : null}</>}>
    <Segments palette={palette} value={direction} onChange={(d) => { setDirection(d); setCategoryId(null); if (d === 'income') setNature('fixed'); }}
      options={[{ id: 'expense', label: 'Expense' }, { id: 'income', label: 'Income' }]} />
    <Field label="Name" value={title} onChangeText={setTitle} palette={palette} maxLength={120} placeholder={direction === 'income' ? 'Salary' : 'Rent'} />
    <Field label="Amount" value={amount} onChangeText={setAmount} palette={palette} keyboardType="decimal-pad" suffix={settings.unit} money={settings} />
    {direction === 'expense' ? <>
      <Label palette={palette}>KIND</Label>
      <ChipRow>{NATURES.map((n) => <Chip key={n} label={NATURE_LABEL[n]} selected={nature === n} palette={palette} onPress={() => { setNature(n); if (n === 'irregular') setCadence('yearly'); }} />)}</ChipRow>
      <Text style={[type.caption, { color: palette.muted }]}>{NATURE_HINT[nature]}</Text>
    </> : null}
    <Label palette={palette}>REPEATS</Label>
    <ChipRow>{CADENCES.map((c) => <Chip key={c} label={c === 'monthly' ? 'Every month' : 'Every year'} selected={cadence === c} palette={palette} onPress={() => setCadence(c)} />)}</ChipRow>
    {cadence === 'yearly' && direction === 'expense' && value ? <Text style={[type.caption, { color: palette.accent }]}>
      Setting aside {formatMoney(monthlyReserve({ amount: value, cadence }), settings)} a month covers it. The reserve is not spending.</Text> : null}
    <Label palette={palette}>NEXT DUE</Label>
    <DateTimeField value={due} onChange={setDue} label="Next due date" />
    <Label palette={palette}>CATEGORY</Label>
    <ChipRow>{categories.map((c) => <Chip key={c.id} label={c.name} selected={categoryId === c.id} palette={palette} onPress={() => setCategoryId(c.id)} />)}</ChipRow>
    <Label palette={palette}>ACCOUNT</Label>
    <ChipRow>{accounts.map((a) => <Chip key={a.id} label={a.name} selected={accountId === a.id} palette={palette} onPress={() => setAccountId(a.id)} />)}</ChipRow>
  </Sheet>;
}

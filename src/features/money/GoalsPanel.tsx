import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { useEvridaDatabase } from '../../storage/use-database';
import { allocate, saveFinGoal, setFinGoalArchived, type FinanceSnapshot } from '../../storage/finance';
import {
  allocatedTo, bpToPercent, coveredMonths, forecastGoal, formatAmount, formatMoney, monthOf, parseAmount, parsePercent,
  suggestedContribution, unallocatedFunds, type FinGoal, type Forecast,
} from '../../domain/finance';
import { periodKey } from '../../domain/horizons';
import { type Palette } from '../../theme/tokens';
import { type } from '../../theme/type';
import { DateTimeField } from '../shared/DateTimeField';
import { EmptyState } from '../shared/EmptyState';
import Target from 'lucide-react-native/icons/target';
import { GoalPicker } from '../shared/GoalPicker';
import { Bar, Card, Chip, ChipRow, Field, Label, PrimaryButton, Sheet, TextButton, dateName, useBusy } from './ui';

const dateLabel = dateName;

function headline(f: Forecast, monthly: number, money: (n: number) => string): string {
  if (f.status === 'reached') return 'Reached with the money assigned to it.';
  if (f.status === 'on-track') return `About ${dateLabel(f.etaDate!)} at ${money(monthly)} a month.`;
  if (f.status === 'no-contribution') return 'No date yet. Set a monthly amount to get an estimate.';
  return 'At this amount the target price rises faster than you save, so no date can be given.';
}

export function ForecastView({ forecast: f, monthly, goal, settings, palette }: {
  forecast: Forecast; monthly: number; goal: Pick<FinGoal, 'target' | 'targetDate'>; settings: FinanceSnapshot['settings']; palette: Palette;
}) {
  const money = (n: number) => formatMoney(n, settings);
  const [open, setOpen] = useState(false);
  return <View style={{ gap: 8 }}>
    <Text style={[type.cardTitle, { color: palette.foreground }]} accessibilityLiveRegion="polite">{headline(f, monthly, money)}</Text>
    {f.provisional ? <Text style={[type.caption, { color: palette.horizon.day, fontWeight: '700' }]}>PROVISIONAL ESTIMATE</Text> : null}
    <Line palette={palette} label="Still needed at today’s price" value={money(f.remainingToday)} />
    {goal.targetDate ? <Line palette={palette} label={`Target price on ${dateLabel(goal.targetDate)}`} value={money(f.futureTarget)} /> : null}
    {goal.targetDate && f.realFutureTarget !== null ? <Line palette={palette} label="…in today’s purchasing power" value={money(f.realFutureTarget)} /> : null}
    {f.requiredMonthly !== null && f.status !== 'reached' ? <Line palette={palette} label={`To finish by ${dateLabel(goal.targetDate!)}, set aside`} value={`${money(f.requiredMonthly)} / mo`} /> : null}
    {f.scenarios.length ? <View style={{ gap: 4, marginTop: 4 }}>
      <Label palette={palette}>IF THINGS GO DIFFERENTLY</Label>
      {f.scenarios.map((s) => <Line key={s.label} palette={palette} label={s.label} value={s.date ? dateLabel(s.date) : 'no date'} />)}
    </View> : null}
    <Pressable accessibilityRole="button" onPress={() => setOpen(!open)} style={{ minHeight: 44, justifyContent: 'center' }}>
      <Text style={{ color: palette.accent, fontWeight: '700', fontSize: 13 }}>{open ? 'Hide assumptions' : 'Show assumptions and what is missing'}</Text>
    </Pressable>
    {open ? <View style={{ gap: 4 }}>
      {f.assumptions.map((a) => <Text key={a} style={[type.caption, { color: palette.muted }]}>• {a}</Text>)}
      {f.missing.map((a) => <Text key={a} style={[type.caption, { color: palette.horizon.day }]}>• {a}</Text>)}
      <Text style={[type.caption, { color: palette.muted }]}>Scenarios change only the monthly amount (±20%); the slower one also raises the price growth by two points when you set one. This is arithmetic, not a prediction.</Text>
    </View> : null}
  </View>;
}
const Line = ({ label, value, palette }: { label: string; value: string; palette: Palette }) => (
  <View style={{ flexDirection: 'row', gap: 10, alignItems: 'baseline' }}>
    <Text style={[type.caption, { color: palette.muted, flex: 1 }]}>{label}</Text>
    <Text style={[type.numeral, { color: palette.foreground, fontSize: 15 }]}>{value}</Text>
  </View>
);

export function GoalsPanel({ data, palette, onChanged }: { data: FinanceSnapshot; palette: Palette; onChanged: () => void }) {
  const { settings } = data;
  const [edit, setEdit] = useState<FinGoal | 'new' | null>(null);
  const [move, setMove] = useState<{ goal: FinGoal; release: boolean } | null>(null);
  const today = periodKey('day', new Date());
  const free = unallocatedFunds(data.accounts, data.txs, data.allocations);
  const months = coveredMonths(data.txs).length;
  const goals = data.goals.filter((g) => !g.archived);
  return <>
    <Card palette={palette}>
      <Text style={[type.caption, { color: palette.muted }]}>Not assigned to any goal</Text>
      <Text style={[type.numeral, { fontSize: 24, color: palette.foreground }]}>{formatMoney(free, settings)}</Text>
      <Text style={[type.caption, { color: palette.muted }]}>A goal only counts money you assign to it, and the same money can’t sit in two goals.</Text>
      {free < 0 ? <Text style={[type.caption, { color: palette.horizon.week, fontWeight: '700' }]}>
        Your goal allocations exceed the current balances of your asset accounts by {formatMoney(-free, settings)}. Review or release allocations before relying on goal forecasts.
      </Text> : null}
    </Card>
    {goals.length === 0 ? <EmptyState Icon={Target} palette={palette} title="Name something worth saving for."
      copy="A home, a car, a repair fund. Assign money to it and see when it becomes reachable, with every assumption shown." actionLabel="Add a money goal" onAction={() => setEdit('new')} />
      : <>
        {goals.map((g) => {
          const saved = allocatedTo(g.id, data.allocations);
          const f = forecastGoal({ target: g.target, saved, monthly: g.monthly, today, targetDate: g.targetDate, growthBp: g.growthBp, inflationBp: settings.inflationBp, historyMonths: months });
          return <Card key={g.id} palette={palette} onPress={() => setEdit(g)} label={`${g.title}, ${formatMoney(saved, settings)} of ${formatMoney(g.target, settings)}`}>
            <Text style={[type.cardTitle, { color: palette.foreground }]}>{g.title}</Text>
            <Bar value={saved / g.target} color={palette.accent} palette={palette} height={8} />
            <Text style={[type.caption, { color: palette.muted }]}>{formatAmount(saved, settings)} of {formatMoney(g.target, settings)} · {Math.min(100, Math.floor((saved / g.target) * 100))}%</Text>
            <Text style={{ color: palette.foreground, fontSize: 14 }}>{headline(f, g.monthly, (n) => formatMoney(n, settings))}{f.provisional && f.status === 'on-track' ? ' (provisional)' : ''}</Text>
          </Card>;
        })}
        <PrimaryButton label="Add a money goal" onPress={() => setEdit('new')} palette={palette} />
      </>}
    <GoalSheet data={data} target={edit} today={today} palette={palette} onClose={() => setEdit(null)} onChanged={onChanged}
      onMove={(goal, release) => { setEdit(null); setMove({ goal, release }); }} />
    <MoveSheet data={data} move={move} today={today} palette={palette} onClose={() => setMove(null)} onChanged={onChanged} />
  </>;
}

function GoalSheet({ data, target, today, palette, onClose, onChanged, onMove }: {
  data: FinanceSnapshot; target: FinGoal | 'new' | null; today: string; palette: Palette; onClose: () => void; onChanged: () => void;
  onMove: (goal: FinGoal, release: boolean) => void;
}) {
  const db = useEvridaDatabase();
  const { busy, run } = useBusy();
  const { settings } = data;
  const existing = target && target !== 'new' ? target : null;
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [monthly, setMonthly] = useState('');
  const [growth, setGrowth] = useState('');
  const [linked, setLinked] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const plain = (n: number) => formatAmount(n, settings).replace(/,/g, '');
  useEffect(() => {
    if (!target) return;
    setError(null);
    setTitle(existing?.title ?? ''); setAmount(existing ? plain(existing.target) : ''); setDate(existing?.targetDate ?? '');
    setMonthly(existing && existing.monthly ? plain(existing.monthly) : ''); setGrowth(existing?.growthBp != null ? String(existing.growthBp / 100) : ''); setLinked(existing?.linkedGoalId ?? null);
  }, [target]); // eslint-disable-line react-hooks/exhaustive-deps

  const suggestion = useMemo(() => suggestedContribution(data.txs, monthOf(today)), [data.txs, today]);
  const parsed = {
    target: parseAmount(amount, settings.decimals), monthly: monthly.trim() ? parseAmount(monthly, settings.decimals) : 0,
    growth: growth.trim() ? parsePercent(growth.replace('-', '')) : null,
  };
  const growthBp = growth.trim() ? (parsed.growth === null ? null : growth.trim().startsWith('-') ? -parsed.growth : parsed.growth) : null;
  const saved = existing ? allocatedTo(existing.id, data.allocations) : 0;
  const forecast = parsed.target && parsed.target > 0 && parsed.monthly !== null && !(growth.trim() && growthBp === null)
    ? forecastGoal({ target: parsed.target, saved, monthly: parsed.monthly, today, targetDate: date || null, growthBp, inflationBp: settings.inflationBp, historyMonths: coveredMonths(data.txs).length })
    : null;

  async function save() {
    if (parsed.target === null || parsed.monthly === null) { setError(`Enter amounts with up to ${settings.decimals} decimals.`); return; }
    if (growth.trim() && growthBp === null) { setError('Enter price growth as a percentage per year, for example 20 or −5.'); return; }
    await run(async () => {
      await saveFinGoal(db, { id: existing?.id, title, target: parsed.target!, targetDate: date || null, monthly: parsed.monthly!, growthBp, linkedGoalId: linked });
      onChanged(); onClose();
    }, setError);
  }
  function archive() {
    if (!existing) return;
    Alert.alert('Archive this goal?', 'Money assigned to it is released back to “not assigned”.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Archive', onPress: () => void run(async () => {
        if (saved > 0) await allocate(db, existing.id, -saved, today, 'Goal archived');
        await setFinGoalArchived(db, existing.id, true); onChanged(); onClose();
      }, setError) },
    ]);
  }
  return <Sheet visible={!!target} title={existing ? 'Money goal' : 'New money goal'} palette={palette} onClose={onClose}
    footer={<>{error ? <Text style={{ color: '#C0392B', fontSize: 13, marginBottom: 6 }}>{error}</Text> : null}
      <PrimaryButton label={busy ? 'Saving…' : 'Save goal'} onPress={() => void save()} palette={palette} disabled={busy || !title.trim()} />
      {existing ? <TextButton label="Archive goal" onPress={archive} palette={palette} muted /> : null}</>}>
    {existing ? <Card palette={palette}>
      <Text style={[type.caption, { color: palette.muted }]}>Assigned to this goal</Text>
      <Text style={[type.numeral, { fontSize: 22, color: palette.foreground }]}>{formatMoney(saved, settings)}</Text>
      <View style={{ flexDirection: 'row' }}>
        <TextButton label="Assign money" palette={palette} onPress={() => onMove(existing, false)} />
        <TextButton label="Release money" palette={palette} muted onPress={() => onMove(existing, true)} />
      </View>
    </Card> : null}
    <Field label="Name" value={title} onChangeText={setTitle} palette={palette} maxLength={120} placeholder="e.g. Car repair reserve" />
    <Field label="Target at today’s price" value={amount} onChangeText={setAmount} palette={palette} keyboardType="decimal-pad" suffix={settings.unit} money={settings} />
    <Label palette={palette}>TARGET DATE (OPTIONAL)</Label>
    <DateTimeField value={date} onChange={setDate} onClear={() => setDate('')} label="Target date" placeholder="No fixed date" />
    <Field label="Planned monthly amount" value={monthly} onChangeText={setMonthly} palette={palette} keyboardType="decimal-pad" suffix={settings.unit} money={settings} />
    {suggestion ? <ChipRow><Chip palette={palette} selected={false} label={`Use your recent average: ${formatAmount(suggestion.amount, settings)}`}
      onPress={() => setMonthly(plain(suggestion.amount))} /></ChipRow> : null}
    {suggestion ? <Text style={[type.caption, { color: palette.muted }]}>Average net saving over the last {suggestion.months} month{suggestion.months === 1 ? '' : 's'} with records. It is a starting point, not a promise.</Text> : null}
    <Field label="This target’s own price growth per year (optional)" value={growth} onChangeText={setGrowth} palette={palette} keyboardType="numbers-and-punctuation" suffix="%"
      hint={`Separate from general inflation${settings.inflationBp === null ? ' (not set in Money settings)' : ` (${bpToPercent(settings.inflationBp)} scenario)`}. Use it for prices that move on their own, like housing or cars.`} />
    <GoalPicker label="Supports a planning goal (optional)" value={linked} onChange={setLinked} palette={palette} active={!!target} />
    <Label palette={palette}>ESTIMATE</Label>
    {forecast && parsed.target ? <Card palette={palette}><ForecastView forecast={forecast} monthly={parsed.monthly ?? 0} goal={{ target: parsed.target, targetDate: date || null }} settings={settings} palette={palette} /></Card> : null}
    {!forecast ? <Text style={[type.caption, { color: palette.muted }]}>Enter a target to see an estimate.</Text> : null}
  </Sheet>;
}

function MoveSheet({ data, move, today, palette, onClose, onChanged }: {
  data: FinanceSnapshot; move: { goal: FinGoal; release: boolean } | null; today: string; palette: Palette; onClose: () => void; onChanged: () => void;
}) {
  const db = useEvridaDatabase();
  const { busy, run } = useBusy();
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { setAmount(''); setError(null); }, [move]);
  const { settings } = data;
  const free = unallocatedFunds(data.accounts, data.txs, data.allocations);
  const held = move ? allocatedTo(move.goal.id, data.allocations) : 0;
  async function save() {
    const value = parseAmount(amount, settings.decimals);
    if (!value || value <= 0 || !move) { setError('Enter an amount greater than zero.'); return; }
    await run(async () => { await allocate(db, move.goal.id, move.release ? -value : value, today); onChanged(); onClose(); }, setError);
  }
  return <Sheet visible={!!move} title={move?.release ? 'Release money' : 'Assign money'} palette={palette} onClose={onClose}
    footer={<>{error ? <Text style={{ color: '#C0392B', fontSize: 13, marginBottom: 6 }}>{error}</Text> : null}
      <PrimaryButton label={busy ? 'Saving…' : move?.release ? 'Release' : 'Assign'} onPress={() => void save()} palette={palette} disabled={busy} /></>}>
    <Text style={[type.body, { color: palette.foreground }]}>{move?.goal.title}</Text>
    <Text style={[type.caption, { color: palette.muted }]}>
      {move?.release ? `${formatMoney(held, settings)} is assigned to this goal. Released money becomes available for other goals.`
        : `${formatMoney(free, settings)} is not assigned to any goal. This does not move money between accounts.`}
    </Text>
    <Field label="Amount" value={amount} onChangeText={setAmount} palette={palette} keyboardType="decimal-pad" suffix={settings.unit} money={settings} />
    <ChipRow><Chip palette={palette} selected={false} label={move?.release ? 'All of it' : 'All available'}
      onPress={() => setAmount(formatAmount(move?.release ? held : Math.max(0, free), settings).replace(/,/g, ''))} /></ChipRow>
  </Sheet>;
}

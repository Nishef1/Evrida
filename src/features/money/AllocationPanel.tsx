import { useEffect, useRef, useState } from 'react';
import { Alert, Linking, Text, View } from 'react-native';
import { allocationSummary, formatMoney, type AllocationBucket, type IncomeAllocation } from '../../domain/finance';
import { normalizeDigits } from '../../domain/jalali';
import { setAllocationPlan, setCategoryPurpose, type FinanceSnapshot } from '../../storage/finance';
import { useEvridaDatabase } from '../../storage/use-database';
import { colors, semantic, withAlpha, type Palette } from '../../theme/tokens';
import { type } from '../../theme/type';
import { Bar, Card, Chip, ChipRow, Field, PrimaryButton, Sheet, TextButton } from './ui';

const BUCKETS: { id: AllocationBucket; label: string; explanation: string }[] = [
  { id: 'needs', label: 'Needs', explanation: 'Essential spending' },
  { id: 'wants', label: 'Wants', explanation: 'Discretionary spending' },
  { id: 'future', label: 'Savings & debt', explanation: 'A goal for your future' },
];
const EXAMPLE: IncomeAllocation = { needs: 50, wants: 30, future: 20 };

export function AllocationPanel({ data, month, palette, onChanged }: {
  data: FinanceSnapshot; month: string; palette: Palette; onChanged: () => Promise<void>;
}) {
  const db = useEvridaDatabase();
  const [editor, setEditor] = useState(false);
  const [classifying, setClassifying] = useState(false);
  const [draft, setDraft] = useState({ needs: '50', wants: '30', future: '20' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const originalDraft = useRef('');
  const actual = allocationSummary(data.txs, month, data.categoryPurposes);
  const plan = data.incomeAllocation;
  const goalAssignments = data.allocations.filter((entry) => entry.date.slice(0, 7) === month)
    .reduce((sum, entry) => sum + entry.amount, 0);
  const tones = palette === colors.dark ? semantic.finance.dark : semantic.finance.light;
  const categoryList = data.categories.filter((category) => category.kind === 'expense' &&
    (!category.archived || data.categoryPurposes[category.id] || data.txs.some((tx) =>
      tx.categoryId === category.id || tx.splits.some((split) => split.categoryId === category.id))));
  const percent = (amount: number) => actual.income > 0 ? `${Math.round(amount / actual.income * 100)}% of recorded income` : 'Income not recorded';
  function openEditor() {
    const values = plan ?? EXAMPLE;
    const next = { needs: String(values.needs), wants: String(values.wants), future: String(values.future) };
    setDraft(next); originalDraft.current = JSON.stringify(next);
    setError(''); setEditor(true);
  }
  function closeEditor() {
    if (busy) return;
    if (JSON.stringify(draft) === originalDraft.current) { setEditor(false); return; }
    Alert.alert('Discard changes?', 'Your saved allocation plan will stay the same.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard changes', style: 'destructive', onPress: () => setEditor(false) },
    ]);
  }
  async function save() {
    if (locked.current) return;
    const values = { needs: Number(draft.needs), wants: Number(draft.wants), future: Number(draft.future) };
    if (Object.values(draft).some((v) => !/^\d{1,3}$/.test(v.trim())) ||
        Object.values(values).some((v) => v < 0 || v > 100) || values.needs + values.wants + values.future !== 100) {
      setError('Enter whole percentages between 0 and 100 that add up to 100.'); return;
    }
    locked.current = true; setBusy(true);
    try { await setAllocationPlan(db, values); await onChanged(); setEditor(false); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save.'); }
    finally { locked.current = false; setBusy(false); }
  }
  async function classify(id: string, bucket: AllocationBucket | null) {
    if (locked.current) return;
    locked.current = true; setBusy(true);
    try { await setCategoryPurpose(db, id, bucket); await onChanged(); }
    catch (cause) { Alert.alert('Could not update category', cause instanceof Error ? cause.message : 'Try again.'); }
    finally { locked.current = false; setBusy(false); }
  }
  useEffect(() => { setError(''); }, [month]);
  return <>
    <Card palette={palette}>
      <Text style={[type.body, { color: palette.muted }]}>Compare classified spending with percentages you choose. The 50/30/20 example is optional.</Text>
      <TextButton label="About the 50/30/20 example" palette={palette} icon={null} onPress={() => {
        void Linking.openURL('https://files.consumerfinance.gov/f/201603_cfpb_rules-to-live-by_my-spending-rule-to-live-by.pdf')
          .catch(() => Alert.alert('Could not open the guide', 'Please try again.'));
      }} />
      {plan ? <TextButton label="Edit percentages" palette={palette} onPress={openEditor} icon={null} />
        : <PrimaryButton label="Choose percentages" palette={palette} onPress={openEditor} icon={null} />}
    </Card>
    <Card palette={palette}>
      <Text style={[type.heading, { color: palette.foreground }]}>Recorded income</Text>
      {actual.income > 0 ? <Text style={[type.numeral, { color: palette.foreground, fontSize: 25 }]}>{formatMoney(actual.income, data.settings)}</Text>
        : <Text style={[type.body, { color: palette.muted }]}>No income recorded this month. Add income to compare amounts and percentages.</Text>}
      <Text style={[type.caption, { color: palette.muted }]}>Uses income you recorded for this month. The 50/30/20 example uses take-home income. Refunds and transfers are excluded. Missing records make this picture incomplete.</Text>
    </Card>
    <Card palette={palette}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={[type.heading, { color: palette.foreground, flex: 1 }]}>Unclassified spending</Text>
        <Text style={{ color: palette.foreground, fontWeight: '700' }}>{formatMoney(actual.unclassified, data.settings)}</Text>
      </View>
      <Text style={[type.caption, { color: palette.muted }]}>Amounts are net of refunds. Categories start unclassified. Changing a group changes how all months are displayed.</Text>
      <TextButton label={classifying ? 'Done classifying' : 'Classify categories'} palette={palette} onPress={() => setClassifying((v) => !v)} icon={null} />
      {classifying ? categoryList.map((category) => <View key={category.id} style={{ gap: 8, borderTopWidth: 1, borderTopColor: palette.border, paddingTop: 12 }}>
        <Text style={[type.cardTitle, { color: palette.foreground }]}>{category.name}{category.archived ? ' · Archived' : ''}</Text>
        <ChipRow>
          {BUCKETS.map((b) => <Chip key={b.id} label={b.label} selected={data.categoryPurposes[category.id] === b.id}
            disabled={busy} palette={palette} onPress={() => { void classify(category.id, b.id); }} />)}
          <Chip label="Unclassified" selected={!data.categoryPurposes[category.id]} disabled={busy} palette={palette} onPress={() => { void classify(category.id, null); }} />
        </ChipRow>
      </View>) : null}
    </Card>
    {BUCKETS.map(({ id, label, explanation }) => <Card key={id} palette={palette}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: tones[id] }} />
        <View style={{ flex: 1 }}><Text style={[type.cardTitle, { color: palette.foreground }]}>{label}</Text>
          <Text style={[type.caption, { color: palette.muted }]}>{explanation}</Text></View>
        <Text style={{ color: palette.foreground, fontWeight: '700' }}>{plan ? `${plan[id]}% target` : 'No target'}</Text>
      </View>
      {plan && actual.income > 0 ? <>
        <Bar value={plan[id] / 100} color={tones[id]} palette={palette} height={8} />
        <Text style={[type.caption, { color: palette.muted }]}>Target: {formatMoney(Math.round(actual.income * plan[id] / 100), data.settings)}</Text>
      </> : null}
      <Text style={{ color: palette.foreground, fontSize: 14 }}>Classified spending after refunds: {formatMoney(actual[id], data.settings)}</Text>
      {actual.income > 0 ? <>
        <Bar value={actual[id] / actual.income} color={withAlpha(tones[id], 0.65)} palette={palette} height={6} />
        <Text style={[type.caption, { color: palette.muted }]}>{percent(actual[id])}</Text>
      </> : null}
      {id === 'future' ? <>
        <Text style={{ color: palette.foreground, fontSize: 14 }}>Net assigned to goals this month: {formatMoney(goalAssignments, data.settings)}</Text>
        <Text style={[type.caption, { color: palette.muted }]}>Goal assignments are separate from spending and are not automatically tied to this month's income. Transfers and investments are not automatically included.</Text>
      </> : null}
    </Card>)}
    <Text style={[type.caption, { color: palette.muted }]}>Targets are a plan, not personalized investment advice. This view applies your current targets and category choices to the selected month. It does not move money.</Text>
    <Sheet visible={editor} title="Choose percentages" palette={palette} onClose={closeEditor}
      footer={<PrimaryButton label={busy ? 'Saving…' : 'Save plan'} onPress={() => { void save(); }} palette={palette} disabled={busy} icon={null} />}>
      <Text style={[type.body, { color: palette.muted }]}>The example is 50 / 30 / 20. Adjust it to fit your circumstances; the total must be 100%.</Text>
      {BUCKETS.map((bucket) => <Field key={bucket.id} label={bucket.label} value={draft[bucket.id]} onChangeText={(value) => setDraft((old) => ({ ...old, [bucket.id]: normalizeDigits(value) }))} palette={palette} keyboardType="number-pad" suffix="%" maxLength={3} />)}
      {error ? <Text accessibilityRole="alert" style={{ color: palette.foreground }}>{error}</Text> : null}
    </Sheet>
  </>;
}

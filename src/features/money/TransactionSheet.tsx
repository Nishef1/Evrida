import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, Text, TextInput, View } from 'react-native';
import { useEvridaDatabase } from '../../storage/use-database';
import { deleteTransaction, saveCategory, saveTransaction, type FinanceSnapshot } from '../../storage/finance';
import { formatAmount, formatMoney, parseAmount, validateTx, type FinTx, type TxType } from '../../domain/finance';
import { periodKey } from '../../domain/horizons';
import { DateTimeField } from '../shared/DateTimeField';
import { type Palette } from '../../theme/tokens';
import { type } from '../../theme/type';
import { Chip, ChipRow, Field, Label, PrimaryButton, Segments, Sheet, TextButton, useBusy } from './ui';

export interface TxPreset { type?: TxType; refundOfId?: string; categoryId?: string; amount?: number; accountId?: string; date?: string; note?: string; splits?: { categoryId: string; amount: number }[]; tags?: string[] }
interface SplitRow { categoryId: string; amount: string }

const TYPES: { id: TxType; label: string }[] = [
  { id: 'expense', label: 'Expense' }, { id: 'income', label: 'Income' },
  { id: 'transfer', label: 'Transfer' }, { id: 'adjustment', label: 'Adjust' },
];

export function TransactionSheet({ visible, data, initial, preset, palette, onClose, onChanged, onRefund }: {
  visible: boolean; data: FinanceSnapshot; initial: FinTx | null; preset?: TxPreset; palette: Palette;
  onClose: () => void; onChanged: () => void; onRefund: (tx: FinTx) => void;
}) {
  const db = useEvridaDatabase();
  const { busy, run } = useBusy();
  const { settings } = data;
  const accounts = data.accounts.filter((a) => !a.archived);
  const [type, setType] = useState<TxType>('expense');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => periodKey('day', new Date()));
  const [accountId, setAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [payee, setPayee] = useState('');
  const [note, setNote] = useState('');
  const [refundOfId, setRefundOfId] = useState<string | null>(null);
  const [splitting, setSplitting] = useState(false);
  const [splits, setSplits] = useState<SplitRow[]>([]);
  const [newCategory, setNewCategory] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setError(null); setTagInput(''); setNewCategory(null);
    const tagNames = (ids: string[]) => ids.map((id) => data.tags.find((t) => t.id === id)?.name).filter(Boolean) as string[];
    if (initial) {
      setType(initial.type); setAmount(formatAmount(Math.abs(initial.amount), settings).replace(/,/g, ''));
      setDate(initial.date); setAccountId(initial.accountId); setToAccountId(initial.toAccountId ?? '');
      const original = initial.refundOfId ? data.txs.find((t) => t.id === initial.refundOfId) : null;
      setCategoryId(initial.categoryId ?? original?.categoryId ?? original?.splits[0]?.categoryId ?? null); setTags(tagNames(initial.tagIds)); setPayee(initial.payee); setNote(initial.note);
      setRefundOfId(initial.refundOfId); setSplitting(initial.splits.length > 0);
      setSplits(initial.splits.map((s) => ({ categoryId: s.categoryId, amount: formatAmount(s.amount, settings).replace(/,/g, '') })));
      if (initial.type === 'adjustment' && initial.amount < 0) setAmount('-' + formatAmount(-initial.amount, settings).replace(/,/g, ''));
    } else {
      setType(preset?.type ?? 'expense');
      setAmount(preset?.amount ? formatAmount(preset.amount, settings).replace(/,/g, '') : '');
      setDate(preset?.date ?? periodKey('day', new Date()));
      setAccountId(preset?.accountId ?? accounts[0]?.id ?? ''); setToAccountId('');
      const original = preset?.refundOfId ? data.txs.find((t) => t.id === preset.refundOfId) : null;
      setCategoryId(preset?.categoryId ?? original?.categoryId ?? original?.splits[0]?.categoryId ?? null); setTags(preset?.tags ?? []); setPayee(''); setNote(preset?.note ?? '');
      setRefundOfId(preset?.refundOfId ?? null); setSplitting(!!preset?.splits?.length);
      setSplits((preset?.splits ?? []).map((s) => ({ categoryId: s.categoryId, amount: formatAmount(s.amount, settings).replace(/,/g, '') })));
    }
  }, [visible, initial?.id, preset?.refundOfId]); // eslint-disable-line react-hooks/exhaustive-deps

  const refunded = refundOfId ? data.txs.find((t) => t.id === refundOfId) : null;
  const refundCategoryIds = new Set(refunded ? (refunded.splits.length ? refunded.splits.map((s) => s.categoryId)
    : refunded.categoryId ? [refunded.categoryId] : []) : []);
  const categories = data.categories.filter((c) => refundOfId
    ? c.kind === 'expense' && refundCategoryIds.has(c.id)
    : !c.archived && c.kind === (type === 'income' ? 'income' : 'expense'));
  const total = parseAmount(amount, settings.decimals);
  const splitTotal = splits.reduce((sum, s) => sum + (parseAmount(s.amount, settings.decimals) ?? 0), 0);
  const categoryName = (id: string | null) => data.categories.find((c) => c.id === id)?.name ?? 'Category';
  const suggestions = useMemo(() => data.tags.filter((t) => !tags.some((n) => n.toLowerCase() === t.name.toLowerCase())).slice(0, 12), [data.tags, tags]);

  function addTag() {
    const name = tagInput.trim().replace(/^#/, '');
    if (name && !tags.some((n) => n.toLowerCase() === name.toLowerCase())) setTags([...tags, name]);
    setTagInput('');
  }
  function toggleSplit(on: boolean) {
    if (on) {
      setSplitting(true);
      if (splits.length < 2) {
        const firstCategory = categoryId ?? (refundOfId ? refunded?.categoryId ?? refunded?.splits[0]?.categoryId : null) ?? '';
        setSplits([{ categoryId: firstCategory, amount }, { categoryId: '', amount: '' }]);
      }
      return;
    }
    if (refundOfId) setCategoryId(splits.find((s) => s.categoryId)?.categoryId
      ?? refunded?.categoryId ?? refunded?.splits[0]?.categoryId ?? null);
    setSplitting(false);
  }
  async function addCategory() {
    if (!newCategory?.trim()) return;
    await run(async () => {
      const id = await saveCategory(db, { name: newCategory, kind: type === 'income' ? 'income' : 'expense', group: newCategory });
      setNewCategory(null); onChanged(); setCategoryId(id);
    }, setError);
  }

  async function save() {
    const parsed = parseAmount(amount, settings.decimals);
    const rows = splitting ? splits.map((s) => ({ categoryId: s.categoryId, amount: parseAmount(s.amount, settings.decimals) ?? 0 })) : [];
    if (parsed === null) { setError(`Enter the amount using up to ${settings.decimals} decimals.`); return; }
    const draft = { type, amount: parsed, date, accountId, toAccountId: type === 'transfer' ? toAccountId || null : null,
      categoryId: type === 'income' || type === 'expense' ? categoryId : null, refundOfId: type === 'income' ? refundOfId : null,
      payee, note, tagIds: [], splits: type === 'income' || type === 'expense' ? rows : [] };
    const problem = validateTx(draft, accounts.length);
    if (problem) { setError(problem); return; }
    await run(async () => {
      await saveTransaction(db, { ...draft, tagNames: type === 'transfer' || type === 'adjustment' ? [] : tags }, initial?.id);
      onChanged(); onClose();
    }, setError);
  }
  function confirmDelete() {
    if (!initial) return;
    Alert.alert('Delete this record?', 'Balances and totals will be recalculated. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void run(async () => {
        await deleteTransaction(db, initial.id); onChanged(); onClose();
      }, (m) => Alert.alert('Could not delete', m)) },
    ]);
  }

  const verb = initial ? 'Save changes' : type === 'transfer' ? 'Record transfer' : type === 'adjustment' ? 'Record adjustment'
    : refundOfId ? 'Record refund' : type === 'income' ? 'Add income' : 'Add expense';
  return <Sheet visible={visible} palette={palette} onClose={onClose} title={initial ? 'Edit record' : refundOfId ? 'Refund' : 'New record'}
    footer={<>
      {error ? <Text accessibilityLiveRegion="polite" style={{ color: '#C0392B', fontSize: 13, marginBottom: 6 }}>{error}</Text> : null}
      <PrimaryButton label={busy ? 'Saving…' : verb} onPress={() => void save()} palette={palette} disabled={busy} />
      {initial ? <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {initial.type === 'expense' ? <TextButton label="Record a refund" onPress={() => onRefund(initial)} palette={palette} /> : <View />}
        <TextButton label="Delete" onPress={confirmDelete} palette={palette} muted />
      </View> : null}
    </>}>
    {!initial || initial.type !== 'income' || !refundOfId ? <Segments options={TYPES} value={type} palette={palette}
      onChange={(next) => { setType(next); setCategoryId(null); setSplitting(false); setRefundOfId(null); }} /> : null}
    {type === 'transfer' ? <Text style={[type_.caption, { color: palette.muted }]}>Moves money between your own accounts. It is not income or spending.</Text> : null}
    {type === 'adjustment' ? <Text style={[type_.caption, { color: palette.muted }]}>Use a negative amount to lower a balance. Adjustments are never counted as spending or income.</Text> : null}
    {refunded ? <Text style={[type_.caption, { color: palette.muted }]}>
      Refund of {formatMoney(refunded.amount, settings)} · {refunded.splits.length ? 'multiple categories' : categoryName(refunded.categoryId)}. It lowers the original category totals instead of counting as income.</Text> : null}

    <Field label="Amount" value={amount} onChangeText={setAmount} palette={palette} keyboardType="decimal-pad" suffix={settings.unit} money={settings} negative={type === 'adjustment'}
      placeholder={settings.decimals ? '0.00' : '0'} />
    <DateTimeField value={date} onChange={setDate} label="Date" />

    <Label palette={palette}>{type === 'transfer' ? 'FROM' : 'ACCOUNT'}</Label>
    <ChipRow>{accounts.map((a) => <Chip key={a.id} label={a.name} selected={accountId === a.id} palette={palette} onPress={() => setAccountId(a.id)} />)}</ChipRow>
    {type === 'transfer' ? <>
      <Label palette={palette}>TO</Label>
      <ChipRow>{accounts.filter((a) => a.id !== accountId).map((a) => <Chip key={a.id} label={a.name} selected={toAccountId === a.id} palette={palette} onPress={() => setToAccountId(a.id)} />)}</ChipRow>
      {accounts.length < 2 ? <Text style={[type_.caption, { color: palette.muted }]}>Add a second account in Money to record a transfer.</Text> : null}
    </> : null}

    {type === 'income' || type === 'expense' ? <>
      <Label palette={palette}>{type === 'income' ? 'WHAT KIND OF INCOME' : 'WHAT WAS IT FOR'}</Label>
      {splitting ? <>
        {splits.map((row, i) => <View key={i} style={{ gap: 6 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {categories.map((c) => <Chip key={c.id} label={c.name} selected={row.categoryId === c.id} palette={palette}
              onPress={() => setSplits(splits.map((r, j) => j === i ? { ...r, categoryId: c.id } : r))} />)}
          </ScrollView>
          <Field label={`Part ${i + 1}`} value={row.amount} palette={palette} keyboardType="decimal-pad" suffix={settings.unit} money={settings}
            onChangeText={(v) => setSplits(splits.map((r, j) => j === i ? { ...r, amount: v } : r))} />
        </View>)}
        <Text style={[type_.caption, { color: total !== null && splitTotal === total ? palette.accent : palette.muted }]}>
          {total === null ? 'Enter the total first.' : splitTotal === total ? 'Parts match the total.'
            : `${formatMoney(Math.abs(total - splitTotal), settings)} ${splitTotal < total ? 'left to place' : 'too much'}.`}
        </Text>
        <View style={{ flexDirection: 'row' }}>
          <TextButton label="＋ Add part" palette={palette} onPress={() => setSplits([...splits, { categoryId: '', amount: '' }])} />
          <TextButton label={refundOfId ? 'Use one category' : 'Remove split'} palette={palette} muted onPress={() => toggleSplit(false)} />
        </View>
      </> : <>
        <ChipRow>
          {categories.map((c) => <Chip key={c.id} label={c.group !== c.name ? `${c.group} · ${c.name}` : c.name} selected={categoryId === c.id}
            palette={palette} onPress={() => setCategoryId(c.id)} />)}
          {!refundOfId ? <Chip label="＋ New" selected={newCategory !== null} palette={palette} onPress={() => setNewCategory(newCategory === null ? '' : null)} /> : null}
        </ChipRow>
        {newCategory !== null ? <View style={{ gap: 6 }}>
          <Field label="New category" value={newCategory} onChangeText={setNewCategory} palette={palette} maxLength={80} placeholder="e.g. Pets" />
          <PrimaryButton label="Create category" palette={palette} onPress={() => void addCategory()} disabled={!newCategory.trim() || busy} />
        </View> : null}
        {(!refundOfId || refundCategoryIds.size > 1) ? <TextButton label={refundOfId ? 'Split refund' : 'Split between categories'} palette={palette} onPress={() => toggleSplit(true)} /> : null}
      </>}

      <Label palette={palette}>TAGS (OPTIONAL)</Label>
      <ChipRow>{tags.map((t) => <Chip key={t} label={`#${t} ✕`} selected palette={palette} onPress={() => setTags(tags.filter((x) => x !== t))} />)}</ChipRow>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <View style={{ flex: 1 }}><TextInput value={tagInput} onChangeText={setTagInput} onSubmitEditing={addTag} onBlur={addTag} maxLength={40}
          placeholder="Add a tag, e.g. trip" placeholderTextColor={palette.muted} accessibilityLabel="Add a tag" returnKeyType="done"
          style={{ minHeight: 48, borderWidth: 1, borderColor: palette.border, borderRadius: 14, paddingHorizontal: 14, color: palette.foreground, backgroundColor: palette.surface, fontSize: 15 }} /></View>
        <TextButton label="Add" onPress={addTag} palette={palette} />
      </View>
      {suggestions.length ? <ChipRow>{suggestions.map((t) => <Chip key={t.id} label={`#${t.name}`} selected={false} palette={palette} onPress={() => setTags([...tags, t.name])} />)}</ChipRow> : null}
      <Text style={[type_.caption, { color: palette.muted }]}>Tags add context across categories, such as a trip or a goal. They never change goal progress.</Text>
      <Field label="Payee (optional)" value={payee} onChangeText={setPayee} palette={palette} maxLength={200} />
    </> : null}
    <Field label="Note (optional)" value={note} onChangeText={setNote} palette={palette} multiline maxLength={2000} />
  </Sheet>;
}
const type_ = type;

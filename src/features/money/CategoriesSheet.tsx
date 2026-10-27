import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useEvridaDatabase } from '../../storage/use-database';
import { saveCategory, setCategoryArchived, type FinanceSnapshot } from '../../storage/finance';
import type { FinCategory } from '../../domain/finance';
import type { Palette } from '../../theme/tokens';
import { type } from '../../theme/type';
import { Field, Label, PrimaryButton, Segments, Sheet, TextButton, useBusy } from './ui';

type Kind = 'expense' | 'income';

/** Rename, regroup, hide and add categories. Hiding keeps every past record and report intact; it only removes the category from pickers. */
export function CategoriesSheet({ data, visible, palette, onClose, onChanged }: {
  data: FinanceSnapshot; visible: boolean; palette: Palette; onClose: () => void; onChanged: () => void;
}) {
  const db = useEvridaDatabase();
  const { busy, run } = useBusy();
  const [kind, setKind] = useState<Kind>('expense');
  const [editing, setEditing] = useState<FinCategory | 'new' | null>(null);
  const [name, setName] = useState('');
  const [group, setGroup] = useState('');
  const [error, setError] = useState<string | null>(null);

  const open = (target: FinCategory | 'new') => {
    setEditing(target); setError(null);
    setName(target === 'new' ? '' : target.name); setGroup(target === 'new' ? '' : target.group);
  };
  const close = () => { setEditing(null); onClose(); };
  const list = data.categories.filter((c) => c.kind === kind);
  const groups = [...new Set(list.map((c) => c.group))];

  const save = () => void run(async () => {
    await saveCategory(db, { id: editing === 'new' || !editing ? undefined : editing.id, name, kind: editing && editing !== 'new' ? editing.kind : kind, group });
    setEditing(null); onChanged();
  }, setError);
  const toggle = (category: FinCategory) => void run(async () => {
    await setCategoryArchived(db, category.id, !category.archived); setEditing(null); onChanged();
  }, setError);

  if (editing) return <Sheet visible={visible} title={editing === 'new' ? 'New category' : 'Edit category'} onClose={() => setEditing(null)} palette={palette}
    footer={<><PrimaryButton label={busy ? 'Saving…' : 'Save'} onPress={save} palette={palette} disabled={busy} />
      {editing !== 'new' ? <TextButton label={editing.archived ? 'Show in pickers again' : 'Hide from pickers'} muted onPress={() => toggle(editing)} palette={palette} /> : null}</>}>
    {error ? <Text style={{ color: '#C0392B' }} accessibilityLiveRegion="polite">{error}</Text> : null}
    <Field label="Name" value={name} onChangeText={setName} palette={palette} maxLength={80} />
    <Field label="Group" value={group} onChangeText={setGroup} palette={palette} maxLength={80} placeholder={groups[0] ?? 'For example: Home'}
      hint="Groups only organise the list. Leave it empty to use the name." />
    {editing !== 'new' ? <Text style={[type.caption, { color: palette.muted }]}>
      Renaming applies to every past record that uses this category. Hiding keeps past records and reports unchanged.</Text> : null}
  </Sheet>;

  return <Sheet visible={visible} title="Categories" onClose={close} palette={palette}
    footer={<PrimaryButton label="Add a category" onPress={() => open('new')} palette={palette} />}>
    {error ? <Text style={{ color: '#C0392B' }}>{error}</Text> : null}
    <Segments palette={palette} value={kind} onChange={setKind} options={[{ id: 'expense', label: 'Spending' }, { id: 'income', label: 'Income' }]} />
    {groups.map((g) => <View key={g} style={{ gap: 6 }}>
      <Label palette={palette}>{g.toUpperCase()}</Label>
      {list.filter((c) => c.group === g).map((c) => <Pressable key={c.id} accessibilityRole="button" accessibilityLabel={`Edit ${c.name}`} onPress={() => open(c)}
        style={{ minHeight: 48, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: palette.border }}>
        <Text style={{ color: c.archived ? palette.muted : palette.foreground, fontSize: 15 }}>{c.name}{c.archived ? '  ·  hidden' : ''}</Text>
      </Pressable>)}
    </View>)}
  </Sheet>;
}

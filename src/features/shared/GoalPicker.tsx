import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { useEvridaDatabase } from '../../storage/use-database';
import { listAllGoals } from '../../storage/goals';
import type { Goal } from '../../domain/goals';
import type { Palette } from '../../theme/tokens';
import { type } from '../../theme/type';
import { Chip, ChipRow, Label } from '../money/ui';

/** Choose one open planning goal (or none). Reads the existing goals; it never copies or creates them. */
export function GoalPicker({ label, value, onChange, palette, active }: {
  label: string; value: string | null; onChange: (id: string | null) => void; palette: Palette; active: boolean;
}) {
  const db = useEvridaDatabase();
  const [goals, setGoals] = useState<Goal[] | null>(null);
  useEffect(() => {
    if (!active) return;
    let live = true;
    listAllGoals(db).then((all) => { if (live) setGoals(all.filter((g) => !g.completed && !g.inbox)); }, () => { if (live) setGoals([]); });
    return () => { live = false; };
  }, [db, active]);
  const shown = (goals ?? []).slice(0, 14);
  const selected = value ? (goals ?? []).find((g) => g.id === value) : null;
  const options = selected && !shown.some((g) => g.id === selected.id) ? [selected, ...shown] : shown;
  return <>
    <Label palette={palette}>{label.toUpperCase()}</Label>
    {goals === null ? <Text style={[type.caption, { color: palette.muted }]}>Loading goals…</Text>
      : options.length === 0 ? <Text style={[type.caption, { color: palette.muted }]}>No open goals yet. Add one in Plan, then link it here.</Text>
        : <ChipRow>{options.map((g) => <Chip key={g.id} label={g.title.length > 28 ? `${g.title.slice(0, 27)}…` : g.title} selected={value === g.id}
          onPress={() => onChange(value === g.id ? null : g.id)} palette={palette} />)}</ChipRow>}
  </>;
}

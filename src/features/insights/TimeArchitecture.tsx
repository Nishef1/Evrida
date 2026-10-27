import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useEvridaDatabase } from '../../storage/use-database';
import type { FocusHistory } from '../../domain/focus';
import type { Goal } from '../../domain/goals';
import { startOfWeek } from '../../domain/horizons';
import { listAllGoals } from '../../storage/goals';
import { listWeeklyCapacity, setWeeklyCapacity, type WeeklyCapacity } from '../../storage/capacity';
import { colors, semantic, type Palette } from '../../theme/tokens';


const format = (minutes: number) => {
  const rounded = Math.max(0, Math.round(minutes));
  return rounded >= 60
    ? `${Math.floor(rounded / 60)}h${rounded % 60 ? ` ${rounded % 60}m` : ''}`
    : `${rounded}m`;
};
interface Props { palette: Palette; history: FocusHistory[]; refreshKey: number }
export function TimeArchitecture({ palette, history, refreshKey }: Props) {
  const db = useEvridaDatabase();
  const router = useRouter();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [budgets, setBudgets] = useState<WeeklyCapacity[]>([]);
  const [chooser, setChooser] = useState(false);
  const [goalId, setGoalId] = useState('');
  const [hours, setHours] = useState('4');
  const [filter, setFilter] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localRevision, setLocalRevision] = useState(0);
  useFocusEffect(useCallback(() => {
    let mounted = true;
    void Promise.all([listAllGoals(db), listWeeklyCapacity(db, startOfWeek(new Date()))])
      .then(([all, allocations]) => {
        if (mounted) { setGoals(all.filter((g) => !g.archivedAt)); setBudgets(allocations); setError(null); }
      }).catch((cause: unknown) => {
        if (mounted) setError(cause instanceof Error ? cause.message : 'Could not load your allocations.');
      });
    return () => { mounted = false; };
  }, [db, refreshKey, localRevision, history]));
  const minutesByGoal = new Map<string, number>();
  for (const entry of history) {
    if (entry.goalId) minutesByGoal.set(entry.goalId, (minutesByGoal.get(entry.goalId) ?? 0) + entry.focusedMs / 60000);
  }
  const impact = [...minutesByGoal.entries()].map(([id, minutes]) => ({
    goal: goals.find((g) => g.id === id), minutes,
  })).filter((item) => item.goal).sort((a, b) => b.minutes - a.minutes).slice(0, 5);
  const selected = goals.find((g) => g.id === goalId);
  const available = goals.find((g) => !g.completed);
  const openGoals = goals.filter((g) => !g.completed && g.title.toLowerCase().includes(filter.toLowerCase().trim())).slice(0, 40);
  function pick(goal: Goal) {
    setGoalId(goal.id);
    setHours(String((budgets.find((b) => b.goalId === goal.id)?.weeklyMinutes ?? 240) / 60));
    setChooser(true);
  }
  async function save() {
    if (busy || !selected) return;
    const number = Number(hours.trim());
    if (!Number.isFinite(number) || number < 0 || number > 168 || (number > 0 && number < 0.5)
      || !Number.isInteger(number * 60)) {
      Alert.alert('Invalid time budget', 'Enter 0 to remove, or 0.5–168 hours using whole minutes.');
      return;
    }
    setBusy(true);
    try {
      await setWeeklyCapacity(db, selected.id, number * 60);
      setChooser(false);
      setLocalRevision((n) => n + 1);
    } catch (cause) {
      Alert.alert('Could not save capacity', cause instanceof Error ? cause.message : 'Try again.');
    } finally { setBusy(false); }
  }
  return <View style={styles.section}>
    <Text style={[styles.title, { color: palette.foreground }]}>Goal impact</Text>
    <Text style={[styles.caption, { color: palette.muted }]}>
      Recorded Focus tied to your goals this week. Parent paths reflect today's hierarchy.
    </Text>
    {impact.length ? impact.map((item) => <View key={item.goal!.id}
      style={[styles.row, { borderBottomColor: palette.border }]}>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={{ color: palette.foreground, fontWeight: '600' }} numberOfLines={1}>{item.goal!.title}</Text>
        {item.goal!.parentTitle ? <Text style={[styles.caption, { color: palette.muted }]} numberOfLines={1}>
          ↳ {item.goal!.parentTitle}
        </Text> : null}
      </View>
      <Text style={{ color: palette.accent, fontWeight: '700' }}>{format(item.minutes)}</Text>
    </View>) : <Text style={[styles.caption, { color: palette.muted }]}>
      Start and finish Focus for a goal to see its actual time here.
    </Text>}
    <View style={[styles.head, { marginTop: 15 }]}>
      <Text style={[styles.title, { color: palette.foreground }]}>Weekly time budget</Text>
      <Pressable accessibilityRole="button" disabled={!available}
        accessibilityState={{ disabled: !available }}
        onPress={() => {
          if (available) { pick(available); setChooser(true); setFilter(''); }
        }} style={[styles.add, { opacity: available ? 1 : 0.45 }]}>
        <Text style={{ color: palette.accent, fontWeight: '700' }}>+ Allocate</Text>
      </Pressable>
    </View>
    <Text style={[styles.caption, { color: palette.muted }]}>
      Define a weekly time budget for a meaningful goal. Planned reservations and recorded Focus are shown separately.
      Nested goals count toward their parent's allocation.
    </Text>
    {error ? <Text style={{ color: palette.foreground }}>{error}</Text> : null}
    {budgets.length ? budgets.map((b) => <View key={b.goalId}
      style={[styles.budget, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      <View style={styles.head}>
        <Text numberOfLines={2} style={{ color: palette.foreground, fontWeight: '700', flex: 1 }}>{b.title}</Text>
        <Text style={{ color: palette.accent, fontWeight: '700' }}>{format(b.weeklyMinutes)} / week</Text>
      </View>
      <View style={[styles.track, { backgroundColor: palette.inset }]}>
        <View style={{ backgroundColor: palette.accent, width: `${Math.min(100, b.plannedMinutes / b.weeklyMinutes * 100)}%`, height: 7, borderRadius: 5 }} />
      </View>
      <View style={[styles.track, { backgroundColor: palette.inset }]}>
        <View style={{ backgroundColor: semantic.timeline.timebox, width: `${Math.min(100, b.focusedMinutes / b.weeklyMinutes * 100)}%`, height: 7, borderRadius: 5 }} />
      </View>
      <View style={styles.head}>
        <Text style={[styles.caption, { color: palette.muted }]}>Reserved {format(b.plannedMinutes)}</Text>
        <Text style={[styles.caption, { color: palette.muted }]}>Focused {format(b.focusedMinutes)}</Text>
      </View>
      <Text style={[styles.caption, { color: palette.muted }]}>
        {b.plannedMinutes > b.weeklyMinutes
          ? `${format(b.plannedMinutes - b.weeklyMinutes)} reserved above your weekly target. Consider reducing or redistributing time.`
          : b.plannedMinutes === 0
            ? 'Nothing reserved yet. You can schedule the first session without filling your whole week.'
            : `${format(b.weeklyMinutes - b.plannedMinutes)} of your target is not reserved. Leaving it free is also an option.`}
      </Text>
      <View style={styles.head}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Edit weekly hours for ${b.title}`}
          onPress={() => { const goal = goals.find((g) => g.id === b.goalId); if (goal) pick(goal); }}
          style={styles.add}>
          <Text style={{ color: palette.muted, fontWeight: '700' }}>Adjust budget</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`Reserve time for ${b.title} in Calendar`}
          onPress={() => router.push({ pathname: '/calendar', params: { goalId: b.goalId } })}
          style={styles.add}>
          <Text style={{ color: palette.accent, fontWeight: '700' }}>Plan time →</Text>
        </Pressable>
      </View>
    </View>) : <Text style={[styles.caption, { color: palette.muted }]}>No weekly allocations yet. Select a goal to get started.</Text>}
    {chooser ? <View style={[styles.editor, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      <Text style={[styles.title, { color: palette.foreground }]}>Weekly allocation</Text>
      <TextInput value={filter} onChangeText={setFilter} placeholder="Find a goal…" placeholderTextColor={palette.muted}
        accessibilityLabel="Find a goal to allocate time" style={[styles.input, { color: palette.foreground, borderColor: palette.border }]} />
      <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="always" style={{ maxHeight: 190 }}>
        {openGoals.map((g) => <Pressable key={g.id} accessibilityRole="radio"
          accessibilityState={{ checked: goalId === g.id }} onPress={() => pick(g)} style={styles.choice}>
          <Text numberOfLines={1} style={{ color: goalId === g.id ? palette.accent : palette.foreground }}>
            {goalId === g.id ? '✓ ' : '○ '}{g.title}
          </Text>
        </Pressable>)}
      </ScrollView>
      <Text style={[styles.caption, { color: palette.muted }]}>Weekly hours for {selected?.title ?? 'selected goal'} (0 removes allocation)</Text>
      <TextInput keyboardType="decimal-pad" value={hours} onChangeText={setHours}
        accessibilityLabel="Hours per week" style={[styles.input, { color: palette.foreground, borderColor: palette.border }]} />
      <View style={styles.head}>
        <Pressable accessibilityRole="button" onPress={() => setChooser(false)} style={styles.add}>
          <Text style={{ color: palette.muted }}>Cancel</Text>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={busy || !selected} onPress={() => { void save(); }}
          style={[styles.save, { backgroundColor: palette.accent, opacity: busy ? 0.4 : 1 }]}>
          <Text style={{ color: palette.onAccent, fontWeight: '700' }}>{busy ? 'Saving…' : 'Save allocation'}</Text>
        </Pressable>
      </View>
    </View> : null}
  </View>;
}
const styles = StyleSheet.create({
  section: { gap: 11, marginTop: 18 },
  title: { fontSize: 18, fontWeight: '700', letterSpacing: -0.3 },
  caption: { fontSize: 12, lineHeight: 19 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 48, paddingVertical: 7, gap: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  add: { minHeight: 48, minWidth: 48, justifyContent: 'center', paddingHorizontal: 5 },
  budget: { gap: 9, borderWidth: 1, borderRadius: 15, padding: 15 },
  track: { height: 7, borderRadius: 5, overflow: 'hidden' },
  editor: { borderWidth: 1, borderRadius: 15, padding: 15, gap: 10 },
  choice: { minHeight: 44, justifyContent: 'center' },
  input: { minHeight: 47, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12 },
  save: { minHeight: 48, borderRadius: 11, paddingHorizontal: 17, justifyContent: 'center' },
});

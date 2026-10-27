import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, AppState, Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEvridaDatabase } from '../../storage/use-database';
import type { FocusHistory } from '../../domain/focus';
import type { Goal } from '../../domain/goals';
import { periodKey, startOfWeek } from '../../domain/horizons';
import { localDayKey, shiftLocalDay } from '../../domain/timeblocks';
import { listFocusHistory, listFocusHistorySince } from '../../storage/focus';
import { archiveGoal, completedGoalsSince, listOpenPastGoals, reviewPastGoal } from '../../storage/goals';
import { colors, depth } from '../../theme/tokens';
import RefreshCw from 'lucide-react-native/icons/refresh-cw';
import Sprout from 'lucide-react-native/icons/sprout';
import { useFocusSession } from '../focus/FocusProvider';
import { TimeArchitecture } from './TimeArchitecture';

function duration(ms: number): string {
  const minutes = Math.floor(ms / 60000), hours = Math.floor(minutes / 60);
  return minutes < 1 ? ms > 0 ? '<1m' : '0m' : hours ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
}
const shortDay = (date: Date) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);

export function InsightsScreen() {
  const focus = useFocusSession();
  const db = useEvridaDatabase(), router = useRouter();
  const palette = useColorScheme() === 'dark' ? colors.dark : colors.light;
  const [weekHistory, setWeekHistory] = useState<FocusHistory[]>([]);
  const [recent, setRecent] = useState<FocusHistory[]>([]);
  const [past, setPast] = useState<Goal[]>([]);
  const [completed, setCompleted] = useState(0);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0), [todayKey, setTodayKey] = useState(() => localDayKey(new Date()));
  const locked = useRef(false);
  useEffect(() => {
    const update = () => { setTodayKey(localDayKey(new Date())); setRevision((n) => n + 1); };
    const interval = setInterval(() => setTodayKey(localDayKey(new Date())), 60000);
    const listener = AppState.addEventListener('change', (state) => { if (state === 'active') update(); });
    return () => { clearInterval(interval); listener.remove(); };
  }, []);
  useFocusEffect(useCallback(() => {
    let live = true;
    const monday = startOfWeek(new Date()); monday.setHours(0, 0, 0, 0);
    setLoading(true);
    void Promise.all([listFocusHistorySince(db, monday.getTime()), listFocusHistory(db), listOpenPastGoals(db), completedGoalsSince(db, monday.toISOString())])
      .then(([week, log, open, done]) => {
        if (!live) return;
        setWeekHistory(week); setRecent(log); setPast(open); setCompleted(done); setError(null);
      }).catch((reason: unknown) => { if (live) setError(reason instanceof Error ? reason.message : 'Could not load your review.'); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [db, revision, todayKey, focus.session?.blockId, focus.session?.startedAtMs]));
  async function decide(goal: Goal, action: 'keep' | 'move' | 'archive') {
    if (locked.current) return;
    locked.current = true; setBusy(true);
    try {
      if (action === 'archive') { await archiveGoal(db, goal.id); void focus.refresh().catch(() => {}); }
      else await reviewPastGoal(db, goal.id, action === 'move');
      setRevision((n) => n + 1);
    } catch (reason) { Alert.alert('Could not update goal', reason instanceof Error ? reason.message : 'Try again.'); }
    finally { locked.current = false; setBusy(false); }
  }
  function confirmArchive(goal: Goal) {
    Alert.alert('Archive this goal?', 'Its active next steps are archived together. Restore them from Plan → tools → Archive.', [
      { text: 'Cancel', style: 'cancel' }, { text: 'Archive', onPress: () => { void decide(goal, 'archive'); } },
    ]);
  }
  const monday = startOfWeek(new Date());
  const days = Array.from({ length: 7 }, (_, i) => shiftLocalDay(monday, i));
  const totals = days.map((day) => weekHistory.filter((row) => localDayKey(new Date(row.endedAtMs)) === localDayKey(day))
    .reduce((sum, row) => sum + row.focusedMs, 0));
  const weekMs = totals.reduce((sum, ms) => sum + ms, 0), max = Math.max(...totals, 60000);
  const hasProgress = weekMs > 0 || completed > 0;
  return <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: palette.background }}>
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={{ flex: 1, gap: 6 }}><Text style={[styles.brand, { color: palette.muted }]}>EVRIDA</Text><Text style={[styles.title, { color: palette.foreground }]}>This week</Text><Text style={[styles.muted, { color: palette.muted }]}>{shortDay(monday)} – {shortDay(days[6])}</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel="Refresh weekly review" onPress={() => setRevision((n) => n + 1)} style={styles.icon}><RefreshCw size={21} color={palette.foreground} strokeWidth={1.8} /></Pressable>
      </View>
      {loading ? <ActivityIndicator color={palette.accent} /> : error ? <View style={styles.section}>
        <Text style={{ color: palette.foreground }}>{error}</Text><Pressable accessibilityRole="button" style={styles.icon} onPress={() => setRevision((n) => n + 1)}><Text style={{ color: palette.accent }}>Try again</Text></Pressable>
      </View> : <>
        {hasProgress ? <>
          <View style={styles.stats}>
            <View style={{ flex: 1 }}><Text style={[styles.number, { color: palette.foreground }]}>{duration(weekMs)}</Text><Text style={[styles.muted, { color: palette.muted }]}>recorded focus</Text></View>
            <View style={{ flex: 1 }}><Text style={[styles.number, { color: palette.foreground }]}>{completed}</Text><Text style={[styles.muted, { color: palette.muted }]}>completed steps</Text></View>
          </View>
          {weekMs > 0 ? <View style={[styles.chart, { borderBottomColor: palette.border }]}>
            {days.map((day, i) => <Pressable key={localDayKey(day)} accessibilityRole="button"
              accessibilityLabel={`${localDayKey(day)}: ${duration(totals[i])} recorded focus`}
              onPress={() => Alert.alert(localDayKey(day), `${duration(totals[i])} of recorded focus. A timer ending does not complete a goal.`)}
              style={styles.day}>
              <View style={styles.track}>{totals[i] > 0 ? <View style={{ height: Math.max(5, totals[i] / max * 78), backgroundColor: palette.accent, width: 18, borderRadius: 4 }} /> : <View style={{ height: 3, width: 18, backgroundColor: palette.border }} />}</View>
              <Text style={{ color: palette.muted, fontSize: 10 }}>{new Intl.DateTimeFormat('en-US', { weekday: 'narrow' }).format(day)}</Text>
              <Text style={{ color: palette.foreground, fontSize: 11 }}>{day.getDate()}</Text>
            </Pressable>)}
          </View> : null}
          <Text style={[styles.caption, { color: palette.muted }]}>Sessions crossing midnight are credited to the day they end, not split between days. Reopened goals are excluded; earlier completions may not appear.</Text>
        </> : <View style={[styles.card, { borderColor: palette.border, backgroundColor: palette.surface, boxShadow: palette === colors.dark ? depth.dark.card : depth.light.card }]}>
          <View style={[styles.emptyEmblem, { backgroundColor: palette.accentSoft }]}><Sprout size={25} color={palette.accent} strokeWidth={1.5} /></View>
          <Text style={[styles.sectionTitle, { color: palette.foreground }]}>Progress starts with one step.</Text>
          <Text style={[styles.muted, { color: palette.muted }]}>Complete a goal or finish a focus session. Your recorded progress will appear here.</Text>
          <Pressable accessibilityRole="button" onPress={() => router.navigate('/')} style={styles.action}><Text style={{ color: palette.accent, fontWeight: '700' }}>Open your plan →</Text></Pressable>
        </View>}
        <TimeArchitecture palette={palette} history={weekHistory} refreshKey={revision} />
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: palette.foreground }]}>Still open from earlier periods</Text>
          <Text style={[styles.muted, { color: palette.muted }]}>Keep the original plan, move it forward, or archive it. Deadlines and reserved calendar times stay as you set them.</Text>
        </View>
        {past.length === 0 ? <Text style={[styles.muted, { color: palette.muted }]}>Nothing needs a decision right now.</Text> : past.map((goal) => <View key={goal.id} style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Open ${goal.title}`} onPress={() => router.push({ pathname: '/', params: { goalId: goal.id } })} style={styles.goalTitle}>
            <Text style={{ color: palette.foreground, fontWeight: '700', fontSize: 15 }}>{goal.title}</Text>
            <Text style={[styles.caption, { color: palette.muted }]}>Planned {goal.periodKey}{goal.dueDate ? ` · Deadline ${goal.dueDate}` : ''}</Text>
          </Pressable>
          <View style={styles.decisions}>
            <Pressable accessibilityRole="button" disabled={busy} accessibilityLabel={`Keep original period for ${goal.title}`} onPress={() => { void decide(goal, 'keep'); }} style={styles.action}><Text style={{ color: palette.accent }}>Keep</Text></Pressable>
            <Pressable accessibilityRole="button" disabled={busy} accessibilityLabel={`Move ${goal.title} to current period`} onPress={() => { void decide(goal, 'move'); }} style={styles.action}><Text style={{ color: palette.accent }}>Move to now</Text></Pressable>
            <Pressable accessibilityRole="button" disabled={busy} accessibilityLabel={`Archive ${goal.title}`} onPress={() => confirmArchive(goal)} style={styles.action}><Text style={{ color: palette.muted }}>Archive</Text></Pressable>
          </View>
        </View>)}
        {recent.length ? <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: palette.foreground }]}>Recent focus</Text>
          {recent.map((row) => <View key={row.id} style={[styles.log, { borderBottomColor: palette.border }]}>
            <View style={{ flex: 1, gap: 5 }}><Text style={{ color: palette.foreground, fontSize: 14 }}>{row.goalTitle}</Text>
              <Text style={[styles.caption, { color: palette.muted }]}>{new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(row.endedAtMs))} · {row.outcome === 'completed' ? 'Time limit reached' : row.outcome === 'replaced' ? 'Switched' : 'Stopped'}</Text>
            </View><Text style={{ color: palette.accent, fontWeight: '700' }}>{duration(row.focusedMs)}</Text>
          </View>)}
        </View> : null}
      </>}
    </ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 32, gap: 16 }, header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 10 },
  brand: { fontSize: 10, fontWeight: '600', letterSpacing: 2.3, marginBottom: 7 },
  emptyEmblem: { width: 48, height: 48, borderRadius: 15, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  title: { fontSize: 32, fontWeight: '700', letterSpacing: -1.2 }, muted: { fontSize: 13, lineHeight: 21 }, caption: { fontSize: 11, lineHeight: 18 },
  icon: { minHeight: 48, minWidth: 48, justifyContent: 'center', alignItems: 'center' }, stats: { flexDirection: 'row', gap: 20, marginVertical: 10 },
  number: { fontSize: 34, fontWeight: '700', letterSpacing: -1 }, section: { gap: 9, marginTop: 10 }, sectionTitle: { fontSize: 18, fontWeight: '700' },
  card: { padding: 18, borderWidth: 1, borderRadius: 16, gap: 8 }, goalTitle: { minHeight: 48, gap: 6, justifyContent: 'center' },
  decisions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 5 }, action: { minHeight: 48, minWidth: 48, justifyContent: 'center', paddingHorizontal: 5 },
  chart: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, paddingBottom: 12 }, day: { flex: 1, minHeight: 120, alignItems: 'center', gap: 5 },
  track: { height: 80, justifyContent: 'flex-end' }, log: { flexDirection: 'row', gap: 10, alignItems: 'center', minHeight: 68, borderBottomWidth: 1, paddingVertical: 10 },
});

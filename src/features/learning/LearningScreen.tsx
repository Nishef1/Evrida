import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useEvridaDatabase } from '../../storage/use-database';
import {
  deleteCheckin, deleteTopic, loadLearning, saveCheckin, saveTopic, setTopicArchived, setTopicFocus, type LearningSnapshot,
} from '../../storage/learning';
import {
  MAX_SCORE, MIN_SCORE, addDays, bandLabel, daysBetween, focusSuggestions, paceEstimate, groupBySubject, historyOf, parseMinutes, topicProgress,
  trendPoints, weekStart, weeklyReview, type LearnCheckin, type LearnTopic,
} from '../../domain/learning';
import { parseDateText } from '../../domain/jalali';
import { createGoal, listAllGoals } from '../../storage/goals';
import { saveBlock } from '../../storage/timeblocks';
import { GoalPicker } from '../shared/GoalPicker';
import { periodKey } from '../../domain/horizons';
import { colors, radius, spacing, type Palette } from '../../theme/tokens';
import { type } from '../../theme/type';
import { useDockInset } from '../shell/DockInset';
import { EmptyState } from '../shared/EmptyState';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import Plus from 'lucide-react-native/icons/plus';
import BookOpenCheck from 'lucide-react-native/icons/book-open-check';
import { REMINDER_HOURS, WEEKDAYS, getReminder, reminderText, resyncReminder, setReminder, type ReminderPref } from './reminder';
import { Card, Chip, ChipRow, Field, Label, PrimaryButton, Segments, Sheet, TextButton, dateName, useBusy } from '../money/ui';

type Tab = 'topics' | 'week';
const hours = (minutes: number) => minutes >= 60 ? `${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${minutes % 60} min` : ''}` : `${minutes} min`;
/** One honest sentence about the user's own goal for a topic, or null when no target is set. */
function targetLine(topic: LearnTopic, history: LearnCheckin[], today: string): string | null {
  if (topic.targetScore === null) return null;
  const head = `Target ${topic.targetScore}/10${topic.targetDate ? ` by ${dateName(topic.targetDate)}` : ''}`;
  const pace = paceEstimate(history, topic.targetScore, today);
  if (pace.status === 'reached') return `${head}. Reached by your own rating.`;
  if (pace.status === 'unknown') return `${head}. ${pace.reason}`;
  const late = topic.targetDate && pace.likely! > topic.targetDate ? ' That is after your target date.' : '';
  return `${head}. At about ${pace.perWeek!.toFixed(1)} points a week you could get there around ${dateName(pace.likely!)}, possibly as late as ${dateName(pace.late!)}.${late} ${pace.reason}`;
}
const changeText = (change: number | null) => change === null ? null : change > 0 ? `▲ +${change}` : change < 0 ? `▼ ${change}` : '＝ same';

/** Scores over time, one bar per check-in on a fixed 1–10 scale so a small change is not exaggerated. */
function Trend({ history, palette }: { history: LearnCheckin[]; palette: Palette }) {
  const points = trendPoints(history);
  if (points.length < 2) return null;
  return <View accessible accessibilityLabel={`Scores over time: ${points.map((p) => `${p.score} on ${p.date}`).join(', ')}`}
    style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 76, marginTop: 8 }}>
    {points.map((p, i) => <View key={`${p.date}-${i}`} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
      <Text style={{ color: palette.muted, fontSize: 10 }}>{p.score}</Text>
      <View style={{ width: '70%', height: 4 + (p.score / MAX_SCORE) * 48, borderRadius: 4, backgroundColor: i === points.length - 1 ? palette.accent : palette.border }} />
    </View>)}
  </View>;
}

export function LearningScreen() {
  const db = useEvridaDatabase();
  const router = useRouter();
  const dockInset = useDockInset();
  const palette = useColorScheme() === 'dark' ? colors.dark : colors.light;
  const [data, setData] = useState<LearningSnapshot | undefined>(undefined);
  const [failure, setFailure] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('topics');
  const today = periodKey('day', new Date());
  const [week, setWeek] = useState(() => weekStart(today));
  const [topicSheet, setTopicSheet] = useState<LearnTopic | 'new' | null>(null);
  const [checkin, setCheckin] = useState<{ topic: LearnTopic; entry: LearnCheckin | null } | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [reminder, setReminderState] = useState<ReminderPref | null>(null);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [session, setSession] = useState<LearnTopic | null>(null);
  const [goalTitles, setGoalTitles] = useState<Map<string, string>>(new Map());

  const reload = useCallback(() => {
    loadLearning(db).then((value) => { setData(value); setFailure(null); },
      (error) => setFailure(error instanceof Error ? error.message : 'Learning could not be loaded.'));
  }, [db]);
  useFocusEffect(useCallback(() => { listAllGoals(db).then((all) => setGoalTitles(new Map(all.map((g) => [g.id, g.title]))), () => {}); reload(); void resyncReminder().then(getReminder).then(setReminderState); }, [reload, db]));

  const open = useMemo(() => (data?.topics ?? []).filter((t) => !t.archived), [data]);
  const review = useMemo(() => data ? weeklyReview(data.topics, data.checkins, week) : null, [data, week]);
  const suggestions = useMemo(() => data ? focusSuggestions(data.topics, data.checkins, today) : [], [data, today]);

  const header = (right?: React.ReactNode) => <View style={styles.top}>
    <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/insights')} accessibilityRole="button" accessibilityLabel="Back"
      style={[styles.round, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      <ChevronLeft size={21} color={palette.foreground} />
    </Pressable>
    <Text style={[type.display, { color: palette.foreground, flex: 1, fontSize: 32 }]} accessibilityRole="header">Learning</Text>
    {right}
  </View>;

  if (failure) return <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: palette.background }]}>
    <View style={styles.page}>{header()}<Text style={{ color: palette.foreground }}>{failure}</Text><TextButton label="Retry" onPress={reload} palette={palette} /></View>
  </SafeAreaView>;
  if (!data || !review) return <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: palette.background }]}>
    <View style={styles.page}>{header()}<ActivityIndicator color={palette.accent} style={{ marginTop: 40 }} /></View>
  </SafeAreaView>;

  const addButton = <Pressable onPress={() => setTopicSheet('new')} accessibilityRole="button" accessibilityLabel="Add a topic"
    style={[styles.round, { backgroundColor: palette.accent, borderColor: palette.accent }]}><Plus size={21} color={palette.onAccent} /></Pressable>;

  const topicCard = (topic: LearnTopic) => {
    const history = historyOf(topic.id, data.checkins);
    const p = topicProgress(history);
    const age = p.latest ? daysBetween(p.latest.date, today) : null;
    return <Card key={topic.id} palette={palette} onPress={() => setDetail(topic.id)} label={`${topic.name}, open history`}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: palette.foreground, fontSize: 16, fontWeight: '700' }}>{topic.name}{topic.focus ? '  ·  focus' : ''}</Text>
          <Text style={[type.caption, { color: palette.muted }]}>
            {p.latest ? `Rated ${age === 0 ? 'today' : age === 1 ? 'yesterday' : `${age} days ago`}${p.minutes ? ` · ${hours(p.minutes)} practised in total` : ''}` : 'Not rated yet'}</Text>
        </View>
        {p.latest ? <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ color: palette.foreground, fontSize: 24, fontWeight: '700' }}>{p.latest.score}<Text style={{ fontSize: 13, color: palette.muted }}>/10</Text></Text>
          {changeText(p.change) ? <Text style={[type.caption, { color: p.change! > 0 ? palette.accent : palette.muted }]}>{changeText(p.change)}</Text> : null}
        </View> : null}
      </View>
      {p.latest ? <Text style={[type.caption, { color: palette.muted }]}>{bandLabel(p.latest.score)}</Text> : null}
      <Trend history={history} palette={palette} />
      {targetLine(topic, history, today) ? <Text style={[type.caption, { color: palette.muted }]}>{targetLine(topic, history, today)}</Text> : null}
      {topic.goalId && goalTitles.get(topic.goalId) ? <Text style={[type.caption, { color: palette.muted }]}>Supports: {goalTitles.get(topic.goalId)}</Text> : null}
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
        <TextButton label={p.latest ? 'Check in' : 'Rate it'} onPress={() => setCheckin({ topic, entry: null })} palette={palette} />
      </View>
    </Card>;
  };

  return <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: palette.background }]}>
    <ScrollView contentContainerStyle={[styles.page, { paddingBottom: 40 + dockInset }]} keyboardShouldPersistTaps="handled">
      {header(addButton)}
      <Segments palette={palette} value={tab} onChange={setTab} options={[{ id: 'topics', label: 'Topics' }, { id: 'week', label: 'Weekly review' }]} />

      {tab === 'topics' ? (open.length === 0
        ? <EmptyState Icon={BookOpenCheck} title="Track what you are learning" palette={palette}
          copy="Add a topic, such as Past perfect, and rate how well you know it from 1 to 10. Evrida keeps the history and shows your trend. Only you rate yourself."
          actionLabel="Add a topic" onAction={() => setTopicSheet('new')} />
        : groupBySubject(open).map((group) => <View key={group.subject} style={{ gap: 10 }}>
          <Label palette={palette}>{group.subject.toUpperCase()}</Label>
          {group.topics.map(topicCard)}
        </View>)) : <>
        <View style={styles.weekNav}>
          <Pressable accessibilityRole="button" accessibilityLabel="Previous week" onPress={() => setWeek(addDays(week, -7))} style={styles.navBtn}><ChevronLeft size={20} color={palette.foreground} /></Pressable>
          <Text style={{ color: palette.foreground, fontSize: 16, fontWeight: '700' }}>{dateName(week)} – {dateName(addDays(week, 6))}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Next week" onPress={() => setWeek(addDays(week, 7))} style={styles.navBtn}><ChevronRight size={20} color={palette.foreground} /></Pressable>
        </View>
        <Card palette={palette} onPress={() => setReminderOpen(true)} label="Weekly review reminder">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ color: palette.foreground, fontSize: 15, fontWeight: '700' }}>Weekly reminder</Text>
              <Text style={[type.caption, { color: palette.muted }]}>{reminder ? `Every ${reminderText(reminder)}` : 'Off. Get a nudge to rate your topics once a week.'}</Text>
            </View>
            <Text style={{ color: palette.accent, fontWeight: '700' }}>{reminder ? 'Change' : 'Set up'}</Text>
          </View>
        </Card>
        {review.open === 0 ? <Text style={{ color: palette.muted }}>Add a topic first, then review it here each week.</Text> : <>
          <Card palette={palette}>
            <Text style={{ color: palette.foreground, fontSize: 16, fontWeight: '700' }}>{review.checkedIn} of {review.open} topics rated this week</Text>
            <Text style={[type.caption, { color: palette.muted }]}>{review.minutes ? `${hours(review.minutes)} practised. ` : ''}Practice time and mastery are tracked separately; time spent is not proof of progress.</Text>
          </Card>
          {review.rows.map((row) => <Card key={row.topic.id} palette={palette}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ color: palette.foreground, fontSize: 15, fontWeight: '700' }}>{row.topic.name}</Text>
                <Text style={[type.caption, { color: palette.muted }]}>{row.topic.subject}</Text>
              </View>
              {row.entry ? <Text style={{ color: palette.foreground, fontSize: 20, fontWeight: '700' }}>{row.entry.score}/10{changeText(row.change) ? <Text style={{ fontSize: 12, color: palette.muted }}>  {changeText(row.change)}</Text> : null}</Text> : null}
            </View>
            {row.entry ? <>
              {row.minutes ? <Text style={[type.caption, { color: palette.muted }]}>{hours(row.minutes)} practised</Text> : null}
              {row.entry.covered ? <Text style={{ color: palette.foreground, fontSize: 13 }}>Covered: {row.entry.covered}</Text> : null}
              {row.entry.note ? <Text style={{ color: palette.muted, fontSize: 13 }}>{row.entry.note}</Text> : null}
              {row.effortNote ? <Text style={[type.caption, { color: palette.muted }]}>{row.effortNote}</Text> : null}
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}><TextButton label="Edit" onPress={() => setCheckin({ topic: row.topic, entry: row.entry })} palette={palette} /></View>
            </> : <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={[type.caption, { color: palette.muted, flex: 1 }]}>{row.before !== null ? `Not rated this week (last: ${row.before}/10)` : 'Not rated this week'}</Text>
              <TextButton label="Rate now" onPress={() => setCheckin({ topic: row.topic, entry: null })} palette={palette} />
            </View>}
          </Card>)}
          <Label palette={palette}>NEXT WEEK'S FOCUS</Label>
          {open.filter((t) => t.focus).map((t) => <Card key={t.id} palette={palette}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ color: palette.foreground, fontSize: 15, fontWeight: '700', flex: 1 }}>{t.name}</Text>
              <TextButton label="Remove" muted onPress={() => void setTopicFocus(db, t.id, false).then(reload)} palette={palette} />
            </View>
          </Card>)}
          {suggestions.length ? <Text style={[type.caption, { color: palette.muted }]}>Suggestions come only from your own ratings and dates, not from an assessment.</Text> : null}
          {suggestions.map(({ topic, reason }) => <Card key={topic.id} palette={palette}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: palette.foreground, fontSize: 15, fontWeight: '700' }}>{topic.name}</Text>
                <Text style={[type.caption, { color: palette.muted }]}>{reason}</Text>
              </View>
              <TextButton label="Focus on it" onPress={() => void setTopicFocus(db, topic.id, true).then(reload)} palette={palette} />
            </View>
          </Card>)}
          {!suggestions.length && !open.some((t) => t.focus) ? <Text style={{ color: palette.muted }}>Nothing stands out. You can mark any topic as a focus from its history.</Text> : null}
        </>}
      </>}
    </ScrollView>

    <SessionSheet topic={session} today={today} palette={palette} onClose={() => setSession(null)} onPlanned={() => setSession(null)} />
    <ReminderSheet visible={reminderOpen} current={reminder} palette={palette} onClose={() => setReminderOpen(false)}
      onSaved={(pref) => { setReminderState(pref); setReminderOpen(false); }} />
    <TopicSheet visible={topicSheet !== null} topic={topicSheet === 'new' ? null : topicSheet} subjects={[...new Set(data.topics.map((t) => t.subject))]}
      palette={palette} onClose={() => setTopicSheet(null)} onSaved={() => { setTopicSheet(null); reload(); }} />
    <CheckinSheet state={checkin} data={data} today={today} palette={palette} onClose={() => setCheckin(null)} onSaved={() => { setCheckin(null); reload(); }} />
    <DetailSheet topicId={detail} data={data} today={today} palette={palette} onClose={() => setDetail(null)}
      onSession={(topic) => { setDetail(null); setSession(topic); }} onEdit={(topic) => { setDetail(null); setTopicSheet(topic); }} onCheckin={(topic, entry) => { setDetail(null); setCheckin({ topic, entry }); }} onChanged={reload} />
  </SafeAreaView>;
}

/** Turn a topic into a study goal on a chosen day (under its linked goal, if any), with an optional time reservation. */
function SessionSheet({ topic, today, palette, onClose, onPlanned }: {
  topic: LearnTopic | null; today: string; palette: Palette; onClose: () => void; onPlanned: () => void;
}) {
  const db = useEvridaDatabase();
  const router = useRouter();
  const { busy, run } = useBusy();
  const [date, setDate] = useState(today);
  const [start, setStart] = useState('18:00');
  const [end, setEnd] = useState('18:30');
  const [reserve, setReserve] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shownFor, setShownFor] = useState<string | null>(null);
  const key = topic?.id ?? null;
  if (key !== shownFor) { setShownFor(key); if (topic) { setDate(today); setStart('18:00'); setEnd('18:30'); setReserve(true); setError(null); } }
  const plan = () => void run(async () => {
    if (!topic) return;
    const day = parseDateText(date);
    if (!day) throw new Error('Enter the date as YYYY-MM-DD (or the Shamsi form, like 1405/08/05).');
    const goalId = await createGoal(db, { title: `Study: ${topic.name}`.slice(0, 180), notes: topic.note, horizon: 'day', periodKey: day, parentId: topic.goalId });
    if (reserve) {
      try { await saveBlock(db, { goalId, date: day, start, end, kind: 'block', intention: topic.name }); }
      catch (reason) { throw new Error(`The study goal was added for ${dateName(day)}, but the time could not be reserved: ${reason instanceof Error ? reason.message : 'check the times'}.`); }
    }
    onPlanned();
    Alert.alert('Study session planned', reserve ? `Added to ${dateName(day)}, ${start}–${end}. Find it in Plan or Calendar.` : `Added to your plan for ${dateName(day)}.`,
      [{ text: 'OK' }, { text: 'Open Calendar', onPress: () => router.push('/calendar' as never) }]);
  }, setError);
  return <Sheet visible={!!topic} title="Plan a study session" onClose={onClose} palette={palette}
    footer={<PrimaryButton label={busy ? 'Planning…' : 'Add to my plan'} onPress={plan} palette={palette} disabled={busy} />}>
    <Text style={{ color: palette.foreground, fontSize: 18, fontWeight: '700' }}>{topic?.name}</Text>
    {error ? <Text style={{ color: '#C0392B' }} accessibilityLiveRegion="polite">{error}</Text> : null}
    <Field label="Date" value={date} onChangeText={setDate} palette={palette} placeholder="YYYY-MM-DD" maxLength={10} />
    <ChipRow><Chip label="Reserve a time on the calendar" selected={reserve} onPress={() => setReserve(!reserve)} palette={palette} /></ChipRow>
    {reserve ? <>
      <Field label="From (HH:mm)" value={start} onChangeText={setStart} palette={palette} maxLength={5} placeholder="18:00" />
      <Field label="To (HH:mm)" value={end} onChangeText={setEnd} palette={palette} maxLength={5} placeholder="18:30" />
    </> : null}
    <Text style={[type.caption, { color: palette.muted }]}>
      {topic?.goalId ? 'It is added under the goal this topic supports. ' : ''}You can move or edit it later in Plan or Calendar.</Text>
  </Sheet>;
}

function ReminderSheet({ visible, current, palette, onClose, onSaved }: {
  visible: boolean; current: ReminderPref | null; palette: Palette; onClose: () => void; onSaved: (pref: ReminderPref | null) => void;
}) {
  const { busy, run } = useBusy();
  const [weekday, setWeekday] = useState(1);
  const [hour, setHour] = useState(20);
  const [error, setError] = useState<string | null>(null);
  const [shown, setShown] = useState(false);
  if (visible !== shown) { setShown(visible); if (visible) { setWeekday(current?.weekday ?? 1); setHour(current?.hour ?? 20); setError(null); } }
  const apply = (pref: ReminderPref | null) => void run(async () => { await setReminder(pref); onSaved(pref); }, setError);
  return <Sheet visible={visible} title="Weekly reminder" onClose={onClose} palette={palette}
    footer={<><PrimaryButton label={busy ? 'Saving…' : 'Remind me weekly'} onPress={() => apply({ weekday, hour })} palette={palette} disabled={busy} />
      {current ? <TextButton label="Turn reminder off" muted onPress={() => apply(null)} palette={palette} /> : null}</>}>
    {error ? <Text style={{ color: '#C0392B' }} accessibilityLiveRegion="polite">{error}</Text> : null}
    <Label palette={palette}>DAY</Label>
    <ChipRow>{WEEKDAYS.map((d) => <Chip key={d.weekday} label={d.label} selected={weekday === d.weekday} onPress={() => setWeekday(d.weekday)} palette={palette} />)}</ChipRow>
    <Label palette={palette}>TIME</Label>
    <ChipRow>{REMINDER_HOURS.map((h) => <Chip key={h} label={`${String(h).padStart(2, '0')}:00`} selected={hour === h} onPress={() => setHour(h)} palette={palette} />)}</ChipRow>
    <Text style={[type.caption, { color: palette.muted }]}>
      A notification repeats every week at this time, even when Evrida is closed. Your phone decides exact delivery, and battery saving or turned-off notifications can delay or block it. It contains no study data.</Text>
  </Sheet>;
}

function TopicSheet({ visible, topic, subjects, palette, onClose, onSaved }: {
  visible: boolean; topic: LearnTopic | null; subjects: string[]; palette: Palette; onClose: () => void; onSaved: () => void;
}) {
  const db = useEvridaDatabase();
  const { busy, run } = useBusy();
  const [subject, setSubject] = useState('');
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [target, setTarget] = useState<number | null>(null);
  const [targetDate, setTargetDate] = useState('');
  const [goalId, setGoalId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shownFor, setShownFor] = useState<string | null | undefined>(undefined);
  const key = visible ? (topic?.id ?? 'new') : null;
  if (key !== shownFor) { // reset the form whenever the sheet opens for a different topic
    setShownFor(key);
    if (key) { setSubject(topic?.subject ?? ''); setName(topic?.name ?? ''); setNote(topic?.note ?? ''); setTarget(topic?.targetScore ?? null); setTargetDate(topic?.targetDate ?? ''); setGoalId(topic?.goalId ?? null); setError(null); }
  }
  const save = () => void run(async () => {
    const targetDay = targetDate.trim() ? parseDateText(targetDate) : null;
    if (targetDate.trim() && !targetDay) throw new Error('Enter the target date as YYYY-MM-DD (or the Shamsi form), or leave it empty.');
    await saveTopic(db, { id: topic?.id, subject, name, note, targetScore: target, targetDate: targetDay, goalId });
    onSaved();
  }, setError);
  const remove = () => Alert.alert('Delete this topic?', 'Its whole rating history is deleted too. Archive it instead to keep the history.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: () => void run(async () => { await deleteTopic(db, topic!.id); onSaved(); }, setError) },
  ]);
  return <Sheet visible={visible} title={topic ? 'Edit topic' : 'New topic'} onClose={onClose} palette={palette}
    footer={<><PrimaryButton label={busy ? 'Saving…' : 'Save'} onPress={save} palette={palette} disabled={busy} />
      {topic ? <>
        <PrimaryButton label={topic.archived ? 'Restore topic' : 'Archive topic'} tone="danger" palette={palette} disabled={busy}
          onPress={() => void run(async () => { await setTopicArchived(db, topic.id, !topic.archived); onSaved(); }, setError)} />
        <TextButton label="Delete topic and history" muted onPress={remove} palette={palette} /></> : null}</>}>
    {error ? <Text style={{ color: '#C0392B' }} accessibilityLiveRegion="polite">{error}</Text> : null}
    <Field label="Subject" value={subject} onChangeText={setSubject} palette={palette} maxLength={80} placeholder="For example: English" />
    {subjects.length ? <ChipRow>{subjects.map((s) => <Chip key={s} label={s} selected={s === subject} onPress={() => setSubject(s)} palette={palette} />)}</ChipRow> : null}
    <Field label="Topic" value={name} onChangeText={setName} palette={palette} maxLength={120} placeholder="For example: Past perfect" />
    <Field label="Notes (optional)" value={note} onChangeText={setNote} palette={palette} multiline maxLength={2000}
      hint="What you want to be able to do, what confuses you, or where to find material." />
    <Label palette={palette}>YOUR TARGET SCORE (OPTIONAL)</Label>
    <ChipRow>{Array.from({ length: MAX_SCORE }, (_, i) => i + 1).map((n) => <Chip key={n} label={String(n)} selected={target === n} onPress={() => setTarget(target === n ? null : n)} palette={palette} />)}</ChipRow>
    {target !== null ? <Field label="Target date (optional)" value={targetDate} onChangeText={setTargetDate} palette={palette} placeholder="YYYY-MM-DD" maxLength={10}
      hint="Once you have three ratings over two weeks, Evrida shows a rough date from your own pace." /> : null}
    <GoalPicker label="Supports a goal (optional)" value={goalId} onChange={setGoalId} palette={palette} active={visible} />
  </Sheet>;
}

function CheckinSheet({ state, data, today, palette, onClose, onSaved }: {
  state: { topic: LearnTopic; entry: LearnCheckin | null } | null; data: LearningSnapshot; today: string; palette: Palette; onClose: () => void; onSaved: () => void;
}) {
  const db = useEvridaDatabase();
  const { busy, run } = useBusy();
  const [score, setScore] = useState<number | null>(null);
  const [minutes, setMinutes] = useState('');
  const [covered, setCovered] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(today);
  const [error, setError] = useState<string | null>(null);
  const [shownFor, setShownFor] = useState<string | null>(null);
  const key = state ? `${state.topic.id}:${state.entry?.id ?? 'new'}` : null;
  if (key !== shownFor) {
    setShownFor(key);
    if (state) {
      const last = historyOf(state.topic.id, data.checkins).slice(-1)[0];
      setScore(state.entry?.score ?? last?.score ?? null); setMinutes(state.entry?.minutes?.toString() ?? ''); setCovered(state.entry?.covered ?? '');
      setNote(state.entry?.note ?? ''); setDate(state.entry?.date ?? today); setError(null);
    }
  }
  if (!state) return <Sheet visible={false} title="" onClose={onClose} palette={palette}>{null}</Sheet>;
  const previous = historyOf(state.topic.id, data.checkins).filter((c) => c.id !== state.entry?.id).slice(-1)[0];
  const save = () => void run(async () => {
    if (score === null) throw new Error('Choose a mastery score from 1 to 10.');
    const mins = parseMinutes(minutes);
    if (mins === 'invalid') throw new Error('Enter the minutes practised as a whole number, or leave it empty.');
    const day = parseDateText(date);
    if (!day) throw new Error('Enter the date as YYYY-MM-DD (or the Shamsi form, like 1405/08/05).');
    await saveCheckin(db, { id: state.entry?.id, topicId: state.topic.id, date: day, score, minutes: mins, covered, note });
    onSaved();
  }, setError);
  const remove = () => Alert.alert('Delete this check-in?', 'The rating is removed from the history.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: () => void run(async () => { await deleteCheckin(db, state.entry!.id); onSaved(); }, setError) },
  ]);
  const range = Array.from({ length: MAX_SCORE - MIN_SCORE + 1 }, (_, i) => MIN_SCORE + i);
  return <Sheet visible title={state.entry ? 'Edit check-in' : 'Check in'} onClose={onClose} palette={palette}
    footer={<><PrimaryButton label={busy ? 'Saving…' : 'Save'} onPress={save} palette={palette} disabled={busy} />
      {state.entry ? <TextButton label="Delete this check-in" muted onPress={remove} palette={palette} /> : null}</>}>
    <Text style={{ color: palette.foreground, fontSize: 18, fontWeight: '700' }}>{state.topic.name}</Text>
    {error ? <Text style={{ color: '#C0392B' }} accessibilityLiveRegion="polite">{error}</Text> : null}
    <Label palette={palette}>HOW WELL DO YOU KNOW IT NOW?</Label>
    <ChipRow>{range.map((n) => <Chip key={n} label={String(n)} selected={score === n} onPress={() => setScore(n)} palette={palette} />)}</ChipRow>
    <Text style={[type.caption, { color: palette.muted }]} accessibilityLiveRegion="polite">
      {score !== null ? `${score}/10: ${bandLabel(score)}.` : 'Rate yourself honestly. This scale is for you, not an exam.'}
      {previous ? ` Last time: ${previous.score}/10 on ${dateName(previous.date)}.` : ''}</Text>
    <Field label="Minutes practised (optional)" value={minutes} onChangeText={(t) => setMinutes(t.replace(/\D/g, ''))} palette={palette} keyboardType="number-pad" suffix="min"
      hint="Time spent and mastery are separate. A long session may not change your score, and that is fine." />
    <Field label="What did you cover? (optional)" value={covered} onChangeText={setCovered} palette={palette} multiline maxLength={1000}
      hint="For example: video on past perfect, exercises 1–5, ten example sentences." />
    <Field label="Notes (optional)" value={note} onChangeText={setNote} palette={palette} multiline maxLength={2000}
      hint="What improved, what is still hard, what to do next." />
    <Field label="Date" value={date} onChangeText={setDate} palette={palette} placeholder="YYYY-MM-DD" maxLength={10} />
  </Sheet>;
}

function DetailSheet({ topicId, data, today, palette, onClose, onEdit, onCheckin, onSession, onChanged }: {
  topicId: string | null; today: string; onSession: (topic: LearnTopic) => void; data: LearningSnapshot; palette: Palette; onClose: () => void;
  onEdit: (topic: LearnTopic) => void; onCheckin: (topic: LearnTopic, entry: LearnCheckin | null) => void; onChanged: () => void;
}) {
  const db = useEvridaDatabase();
  const topic = data.topics.find((t) => t.id === topicId) ?? null;
  const history = topic ? historyOf(topic.id, data.checkins) : [];
  const p = topicProgress(history);
  return <Sheet visible={!!topic} title={topic?.name ?? ''} onClose={onClose} palette={palette}
    footer={topic ? <><PrimaryButton label="Check in" onPress={() => onCheckin(topic, null)} palette={palette} />
      <TextButton label="Plan a study session" onPress={() => onSession(topic)} palette={palette} />
      <TextButton label={topic.focus ? 'Remove from next week’s focus' : 'Make it next week’s focus'} onPress={() => void setTopicFocus(db, topic.id, !topic.focus).then(onChanged)} palette={palette} />
      <TextButton label="Edit topic" muted onPress={() => onEdit(topic)} palette={palette} /></> : undefined}>
    {topic ? <>
      <Text style={[type.caption, { color: palette.muted }]}>{topic.subject}</Text>
      {topic.note ? <Text style={{ color: palette.foreground, fontSize: 14 }}>{topic.note}</Text> : null}
      {p.latest ? <Text style={{ color: palette.foreground, fontSize: 28, fontWeight: '700' }}>{p.latest.score}<Text style={{ fontSize: 14, color: palette.muted }}>/10 now{changeText(p.change) ? `  ${changeText(p.change)}` : ''}</Text></Text> : null}
      <Trend history={history} palette={palette} />
      {targetLine(topic, history, today) ? <Text style={{ color: palette.foreground, fontSize: 13 }}>{targetLine(topic, history, today)}</Text> : null}
      {p.minutes ? <Text style={[type.caption, { color: palette.muted }]}>{hours(p.minutes)} practised across {p.count} check-ins. Time is shown for context, not as proof of mastery.</Text> : null}
      <Label palette={palette}>HISTORY</Label>
      {history.length === 0 ? <Text style={{ color: palette.muted }}>No check-ins yet.</Text> : [...history].reverse().map((c) => <Pressable key={c.id} accessibilityRole="button"
        accessibilityLabel={`Edit check-in from ${dateName(c.date)}`} onPress={() => onCheckin(topic, c)}
        style={[styles.entry, { borderColor: palette.border, backgroundColor: palette.surface }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ color: palette.muted, fontSize: 12, flex: 1 }}>{dateName(c.date)}{c.minutes ? ` · ${hours(c.minutes)}` : ''}</Text>
          <Text style={{ color: palette.foreground, fontSize: 16, fontWeight: '700' }}>{c.score}/10</Text>
        </View>
        {c.covered ? <Text style={{ color: palette.foreground, fontSize: 13 }}>{c.covered}</Text> : null}
        {c.note ? <Text style={{ color: palette.muted, fontSize: 13 }}>{c.note}</Text> : null}
      </Pressable>)}
    </> : null}
  </Sheet>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, page: { padding: spacing.lg, gap: 14 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 6 },
  round: { width: 48, height: 48, borderRadius: radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  weekNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  entry: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 4 },
});

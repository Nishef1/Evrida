import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import type { Goal } from '../../domain/goals';
import { localClock, localDayKey, timeRangeFromInput, type BlockInput, type BlockKind, type TimeBlock } from '../../domain/timeblocks';
import { colors, radius, spacing, semantic, type Palette, scrim } from '../../theme/tokens';
import { DateTimeField } from '../shared/DateTimeField';
import { useReducedMotion } from '../../theme/useReducedMotion';
import Check from 'lucide-react-native/icons/check';
import X from 'lucide-react-native/icons/x';



interface Props {
  visible: boolean;
  date: Date;
  goals: Goal[];
  initial: TimeBlock | null;
  suggestedGoalId: string | null;
  suggestedStartHour: number | null;
  palette: Palette;
  saving: boolean;
  activeBlockId: string | null;
  onCancel: () => void;
  onSave: (input: BlockInput) => Promise<void>;
  onStartFocus: (block: TimeBlock) => void;
}
export function TimeBlockEditor({ visible, date, goals, initial, suggestedGoalId, suggestedStartHour, palette, saving, activeBlockId, onCancel, onSave, onStartFocus }: Props) {
  const reducedMotion = useReducedMotion();
  const [goalId, setGoalId] = useState<string | null>(null);
  const [showGoals, setShowGoals] = useState(false);
  const [search, setSearch] = useState('');
  const [dayText, setDayText] = useState('');
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('10:00');
  const [endsNextDay, setEndsNextDay] = useState(false);
  const [kind, setKind] = useState<BlockKind>('block');
  const [flexible, setFlexible] = useState(false);
  const [intention, setIntention] = useState('');
  const originalDraft = useRef('');
  useEffect(() => {
    if (!visible) return;
    const begin = initial ? new Date(initial.startAt) : date;
    setGoalId(initial?.goalId ?? suggestedGoalId ?? null);
    setDayText(localDayKey(begin));
    const hour = suggestedStartHour ?? 9;
    setStart(initial ? localClock(new Date(initial.startAt)) : `${String(hour).padStart(2, '0')}:00`);
    setEnd(initial ? localClock(new Date(initial.endAt)) :
      hour === 23 ? '00:00' : `${String(hour + 1).padStart(2, '0')}:00`);
    setEndsNextDay(initial
      ? localDayKey(new Date(initial.endAt)) !== localDayKey(new Date(initial.startAt))
      : hour === 23);
    setKind(initial?.kind ?? 'block');
    setFlexible(initial?.flexible ?? false);
    setIntention(initial?.intention ?? '');
    setShowGoals(false);
    setSearch('');
    originalDraft.current = JSON.stringify([initial?.goalId ?? suggestedGoalId ?? null, localDayKey(begin),
      initial ? localClock(new Date(initial.startAt)) : `${String(hour).padStart(2, '0')}:00`,
      initial ? localClock(new Date(initial.endAt)) : hour === 23 ? '00:00' : `${String(hour + 1).padStart(2, '0')}:00`,
      initial ? localDayKey(new Date(initial.endAt)) !== localDayKey(begin) : hour === 23,
      initial?.kind ?? 'block', initial?.intention ?? '', initial?.flexible ?? false]);
  }, [visible, initial?.id, suggestedGoalId, suggestedStartHour, date.getTime()]);
  function requestCancel() {
    if (saving) return;
    const draft = JSON.stringify([goalId, dayText, start, end, endsNextDay, kind, intention, flexible]);
    if (draft === originalDraft.current) onCancel();
    else Alert.alert('Discard these changes?', 'Your saved calendar stays as it is.', [
      { text: 'Keep editing', style: 'cancel' }, { text: 'Discard changes', style: 'destructive', onPress: onCancel },
    ]);
  }
  const filtered = useMemo(() => goals.filter((goal) =>
    (!goal.completed || goal.id === initial?.goalId) &&
    goal.title.toLowerCase().includes(search.toLowerCase().trim())).slice(0, 25), [goals, search, initial?.goalId]);
  const goal = goals.find((g) => g.id === goalId);
  let validation: string | null = null;
  try { timeRangeFromInput({ date: dayText, start, end, endsNextDay }); }
  catch (error) { validation = error instanceof Error ? error.message : 'Invalid time.'; }
  const editingActive = !!initial && initial.id === activeBlockId;
  let changed = !initial;
  if (initial) {
    // The editor has minute precision; merely opening an instant-based quick
    // session must not round its seconds or falsely create unsaved changes.
    changed = dayText !== localDayKey(new Date(initial.startAt)) || start !== localClock(new Date(initial.startAt)) ||
      end !== localClock(new Date(initial.endAt)) ||
      endsNextDay !== (localDayKey(new Date(initial.startAt)) !== localDayKey(new Date(initial.endAt))) || goalId !== initial.goalId ||
      kind !== initial.kind || intention.trim() !== initial.intention || flexible !== initial.flexible;
  }
  const valid = !!goalId && !goal?.completed && !initial?.goalCompleted && !validation && !saving && !editingActive && changed;

  return (
    <Modal visible={visible} animationType={reducedMotion ? 'none' : 'slide'} transparent statusBarTranslucent navigationBarTranslucent onRequestClose={requestCancel}>
      <SafeAreaProvider>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable style={StyleSheet.absoluteFill} onPress={requestCancel} accessibilityLabel="Close time editor" />
          <View style={[styles.sheet, { backgroundColor: palette.background }]}>
            <View style={[styles.grabber, { backgroundColor: palette.border }]} />
            <View style={styles.header}>
              <View style={styles.headerText}>
                <Text style={[styles.eyebrow, { color: palette.accent }]}>MAKE TIME FOR WHAT MATTERS</Text>
                <Text style={[styles.heading, { color: palette.foreground }]}>
                  {initial ? 'Edit time block' : 'Plan a time block'}
                </Text>
              </View>
              <Pressable style={styles.close} onPress={requestCancel} accessibilityRole="button" accessibilityLabel="Close">
                <X size={21} color={palette.muted} strokeWidth={1.8} />
              </Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={styles.form}>
              <Text style={[styles.label, { color: palette.muted }]}>GOAL</Text>
              <Pressable onPress={() => setShowGoals(!showGoals)} accessibilityRole="button"
                style={[styles.select, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                <Text numberOfLines={2} style={[styles.selectText, { color: palette.foreground }]}>
                  {goal?.title ?? 'Choose a goal'}
                </Text>
                <Text style={{ color: palette.muted }}>{showGoals ? '⌃' : '⌄'}</Text>
              </Pressable>
              {showGoals ? (
                <View style={[styles.choices, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                  <TextInput value={search} onChangeText={setSearch}
                    placeholder="Search existing goals" placeholderTextColor={palette.muted}
                    style={[styles.input, { color: palette.foreground, borderColor: palette.border }]} />
                  {filtered.length ? filtered.map((item) => (
                    <Pressable key={item.id} accessibilityRole="button" style={styles.choice}
                      onPress={() => { setGoalId(item.id); setShowGoals(false); }}>
                      <Text numberOfLines={1} style={[styles.choiceText, { color: palette.foreground }]}>
                        {item.id === goalId ? '✓  ' : '○  '}{item.title}
                      </Text>
                    </Pressable>
                  )) : <Text style={[styles.hint, { color: palette.muted }]}>No matching goals. Create one in Plan or Boards first.</Text>}
                </View>
              ) : null}
              <Text style={[styles.label, { color: palette.muted }]}>PLANNING STYLE</Text>
              <View style={[styles.switch, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                {(['block', 'box'] as const).map((item) => (
                  <Pressable key={item} onPress={() => setKind(item)} accessibilityRole="button"
                    accessibilityState={{ selected: kind === item }}
                    style={[styles.switchButton, kind === item && { backgroundColor: palette.foreground }]}>
                    <Text style={[styles.switchText, { color: kind === item ? palette.background : palette.muted }]}>
                      {item === 'block' ? 'Time Block' : 'Timebox'}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={[styles.hint, { color: palette.muted }]}>
                {kind === 'box' ? 'A fixed work limit. Stop or reassess when it ends.' :
                  'A planned reservation. Turn on Flexible below only if Recovery may propose moving it.'}
              </Text>
              <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: flexible }}
                onPress={() => setFlexible((current) => !current)}
                style={[styles.overnight, { borderColor: palette.border, backgroundColor: palette.surface }]}>
                <View style={[styles.check, { backgroundColor: flexible ? palette.accent : 'transparent',
                  borderColor: flexible ? palette.accent : palette.muted }]}>
                  {flexible ? <Check size={15} color={palette.onAccent} /> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.overnightTitle, { color: palette.foreground }]}>Flexible reservation</Text>
                  <Text style={[styles.hint, { color: palette.muted }]}>
                    Recovery may suggest moving this time only after you approve a preview. Off keeps it protected.
                  </Text>
                </View>
              </Pressable>
              <Text style={[styles.label, { color: palette.muted }]}>DATE</Text>
              <DateTimeField value={dayText} onChange={setDayText} label="Scheduled date" />
              <View style={styles.times}>
                <View style={styles.half}>
                  <Text style={[styles.label, { color: palette.muted }]}>START</Text>
                  <DateTimeField mode="time" value={start} onChange={setStart} label="Start time" />
                </View>
                <View style={styles.half}>
                  <Text style={[styles.label, { color: palette.muted }]}>END</Text>
                  <DateTimeField mode="time" value={end} onChange={setEnd} label="End time" />
                </View>
              </View>
              <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: endsNextDay }}
                accessibilityLabel="End time is on the next day"
                onPress={() => setEndsNextDay((current) => !current)}
                style={[styles.overnight, { borderColor: palette.border, backgroundColor: palette.surface }]}>
                <View style={[styles.check, { backgroundColor: endsNextDay ? palette.accent : 'transparent',
                  borderColor: endsNextDay ? palette.accent : palette.muted }]}>
                  {endsNextDay ? <Check size={15} color={palette.onAccent} /> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.overnightTitle, { color: palette.foreground }]}>End on the next day</Text>
                  <Text style={[styles.hint, { color: palette.muted }]}>For late-night work crossing midnight</Text>
                </View>
              </Pressable>
              <Text style={[styles.label, { color: palette.muted }]}>
                {kind === 'box' ? 'WHAT SHOULD BE DONE BEFORE TIME IS UP?' : 'FOCUS (OPTIONAL)'}
              </Text>
              <TextInput value={intention} onChangeText={setIntention} multiline maxLength={500}
                placeholder={kind === 'box' ? 'Define an outcome for this timebox…' : 'What will you focus on?'}
                placeholderTextColor={palette.muted} accessibilityLabel="Time block intention"
                style={[styles.input, styles.notes, { backgroundColor: palette.surface, borderColor: palette.border, color: palette.foreground }]} />
              {validation ? <Text style={[styles.validation, { color: palette === colors.dark ? semantic.dark.danger : semantic.light.danger }]}>{validation}</Text> : null}
              {(goal?.completed || initial?.goalCompleted) ? <Text style={[styles.validation, { color: palette.muted }]}>
                This goal is complete. Reopen it in Plan before scheduling new time.
              </Text> : null}
              {editingActive ? <Text style={styles.validation}>
                End the active Focus session before editing this Timebox.
              </Text> : null}
            </ScrollView>
            <SafeAreaView edges={['bottom']} style={[styles.footer, { borderTopColor: palette.border, backgroundColor: palette.background }]}>
              {initial?.kind === 'box' && kind === 'box' && !editingActive && !goal?.completed && !initial?.goalCompleted ? (
                <Pressable accessibilityRole="button" disabled={saving || changed}
                  accessibilityState={{ disabled: saving || changed }}
                  onPress={() => { if (!saving && !changed) onStartFocus(initial); }}
                  style={[styles.focusAction, {
                    backgroundColor: palette.surface, borderColor: palette.border,
                    opacity: saving || changed ? 0.5 : 1,
                  }]}>
                  <Text style={[styles.focusActionText, { color: palette.accent }]}>
                    {changed ? 'Save edits before starting Focus' : '◷  Start saved timebox'}
                  </Text>
                </Pressable>
              ) : null}
              <Pressable disabled={!valid} accessibilityRole="button" accessibilityState={{ disabled: !valid }}
                onPress={() => { if (valid && goalId) void onSave({ goalId, date: dayText, start, end, endsNextDay, kind, intention, flexible }); }}
                style={[styles.save, { backgroundColor: palette.accent, opacity: valid ? 1 : 0.45 }]}>
                <Text style={[styles.saveText, { color: palette.onAccent }]}>{saving ? 'Saving…' : initial ? 'Save changes' : 'Schedule time'}</Text>
              </Pressable>
            </SafeAreaView>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaProvider>
    </Modal>
  );
}
const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: scrim },
  sheet: { maxHeight: '94%', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 12, overflow: 'hidden' },
  grabber: { height: 4, width: 38, borderRadius: 8, alignSelf: 'center', marginBottom: 13 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg },
  headerText: { flex: 1, gap: 6 },
  eyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 1.3 },
  heading: { fontSize: 23, fontWeight: '700', letterSpacing: -0.5 },
  close: { width: 48, minHeight: 48, justifyContent: 'center', alignItems: 'center' },
  form: { gap: 13, paddingHorizontal: spacing.lg, paddingTop: 20, paddingBottom: 22 },
  label: { fontSize: 10, fontWeight: '700', letterSpacing: 1.2, marginTop: 8 },
  select: { borderRadius: radius.lg, borderWidth: 1, minHeight: 55, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 15 },
  selectText: { flex: 1, fontSize: 15, fontWeight: '600' },
  choices: { borderWidth: 1, borderRadius: radius.lg, padding: 9, maxHeight: 300 },
  input: { borderWidth: 1, minHeight: 49, borderRadius: radius.md, paddingHorizontal: 13, fontSize: 15 },
  choice: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 10 },
  choiceText: { fontSize: 13 },
  switch: { borderWidth: 1, padding: 5, flexDirection: 'row', gap: 6, borderRadius: radius.full },
  switchButton: { flex: 1, minHeight: 48, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  switchText: { fontSize: 13, fontWeight: '700' },
  hint: { fontSize: 12, lineHeight: 19 },
  overnight: { flexDirection: 'row', alignItems: 'center', gap: 13, minHeight: 66, paddingHorizontal: 13,
    borderWidth: 1, borderRadius: radius.lg },
  check: { width: 24, height: 24, borderWidth: 1, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  overnightTitle: { fontSize: 13, fontWeight: '700', marginBottom: 2 },
  times: { flexDirection: 'row', gap: 12 },
  half: { flex: 1, gap: 8 },
  notes: { height: 85, paddingTop: 13, textAlignVertical: 'top' },
  validation: { fontSize: 12 },
  footer: { borderTopWidth: 1, paddingTop: 12, paddingHorizontal: spacing.lg, paddingBottom: 8 },
  focusAction: { minHeight: 50, borderRadius: radius.lg, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 9 },
  focusActionText: { fontSize: 14, fontWeight: '700' },
  save: { minHeight: 54, borderRadius: radius.lg, justifyContent: 'center', alignItems: 'center' },
  saveText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});

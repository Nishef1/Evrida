import { useEffect, useMemo, useRef, useState } from 'react';
import { periodText } from '../shared/dates';
import type { ComponentRef } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { dateFromPeriodKey, HORIZONS, HORIZON_TITLES, parseDateInput, periodKey, shiftPeriod, type Horizon } from '../../domain/horizons';
import type { Goal, GoalInput } from '../../domain/goals';
import { REPEAT_LABELS, REPEAT_RULES, type RepeatRule } from '../../domain/planning';
import { colors, radius, spacing, type Palette, scrim } from '../../theme/tokens';
import { DateTimeField } from '../shared/DateTimeField';
import { useReducedMotion } from '../../theme/useReducedMotion';
import { type } from '../../theme/type';
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Inbox, Layers3, X } from '../../theme/icons';



interface GoalEditorProps {
  visible: boolean;
  initial: Goal | null;
  parent: Goal | null;
  parentOptions: Goal[];
  defaultHorizon: Horizon;
  anchorDate: Date;
  palette: Palette;
  saving: boolean;
  onDismiss: () => void;
  onSave: (input: GoalInput) => Promise<void>;
  defaultInbox?: boolean;
  draftTitle?: string;
}

export function GoalEditor({
  visible, initial, parent, parentOptions, defaultHorizon, anchorDate, palette, saving, onDismiss, onSave, defaultInbox = false, draftTitle = '',
}: GoalEditorProps) {
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const isStep = !initial && parent !== null;
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [horizon, setHorizon] = useState<Horizon>(defaultHorizon);
  const [date, setDate] = useState(() => new Date());
  const [dateText, setDateText] = useState('');
  const [parentId, setParentId] = useState<string | null>(null);
  const [showParents, setShowParents] = useState(false);
  const [parentSearch, setParentSearch] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [inbox, setInbox] = useState(false);
  const [dueDate, setDueDate] = useState('');
  const [repeatRule, setRepeatRule] = useState<RepeatRule>('none');
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const notesRef = useRef<ComponentRef<typeof TextInput>>(null);
  const anchorTime = anchorDate.getTime();
  const originalDraft = useRef('');

  useEffect(() => {
    if (!visible) return;
    const initialHorizon = initial?.horizon ?? defaultHorizon;
    const initialDate = initial
      ? dateFromPeriodKey(initial.horizon, initial.periodKey, anchorDate)
      : new Date(anchorTime);
    setTitle(initial?.title ?? draftTitle);
    setNotes(initial?.notes ?? '');
    setHorizon(initialHorizon);
    setDate(initialDate);
    setDateText(periodKey('day', initialDate));
    setParentId(initial?.parentId ?? parent?.id ?? null);
    setParentSearch('');
    setShowParents(false);
    setInbox(initial?.inbox ?? defaultInbox);
    setDueDate(initial?.dueDate ?? '');
    setRepeatRule(initial?.repeatRule ?? 'none');
    setExpanded(false);
    originalDraft.current = JSON.stringify([initial?.title ?? draftTitle, initial?.notes ?? '', initialHorizon,
      (initial?.inbox ?? defaultInbox) ? '' : periodKey(initialHorizon, initialDate),
      initial?.parentId ?? parent?.id ?? null, initial?.inbox ?? defaultInbox, initial?.dueDate ?? '', initial?.repeatRule ?? 'none']);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [visible, initial?.id, defaultHorizon, parent?.id, anchorTime, defaultInbox, draftTitle]);

  const validDate = inbox || horizon !== 'day' || parseDateInput(dateText) !== null;
  const chosenDate = horizon === 'day' ? parseDateInput(dateText) ?? date : date;
  const selectedKey = periodKey(horizon, chosenDate);
  const isValid = title.trim().length > 0 && title.trim().length <= 180 && validDate && (!dueDate || !!parseDateInput(dueDate));
  const currentParent = parentOptions.find((choice) => choice.id === parentId) ?? (parent?.id === parentId ? parent : null);
  const filteredParents = useMemo(() => parentOptions.filter((goal) =>
    goal.title.toLowerCase().includes(parentSearch.trim().toLowerCase()),
  ).slice(0, 12), [parentOptions, parentSearch]);

  function movePeriod(delta: number) {
    const base = horizon === 'day' ? parseDateInput(dateText) ?? date : date;
    const next = shiftPeriod(horizon, base, delta);
    setDate(next);
    setDateText(periodKey('day', next));
  }

  function changeHorizon(next: Horizon) {
    setHorizon(next);
    if (next !== 'day') setRepeatRule('none');
    if (horizon === 'day') {
      const selected = parseDateInput(dateText);
      if (selected) setDate(selected);
    }
  }

  function submit() {
    if (!isValid || saving) return;
    void onSave({ title, notes, horizon, periodKey: inbox ? '' : selectedKey, parentId, inbox,
      dueDate: dueDate || null, repeatRule: !inbox && horizon === 'day' ? repeatRule : 'none' });
  }

  function requestDismiss() {
    if (saving) return;
    const draft = JSON.stringify([title, notes, horizon, inbox ? '' : selectedKey, parentId, inbox, dueDate, repeatRule]);
    if (draft === originalDraft.current) onDismiss();
    else Alert.alert('Discard this draft?', 'Your saved goals stay as they are.', [
      { text: 'Keep editing', style: 'cancel' }, { text: 'Discard draft', style: 'destructive', onPress: onDismiss },
    ]);
  }

  return (
    <Modal visible={visible} animationType={reducedMotion ? 'none' : 'slide'} transparent statusBarTranslucent navigationBarTranslucent onRequestClose={requestDismiss}>
      <SafeAreaProvider>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={StyleSheet.absoluteFill} onPress={requestDismiss} accessibilityLabel="Dismiss editor" />
        <View style={[styles.sheet, { backgroundColor: palette.background, marginTop: insets.top + 12 }]}>
          <View style={[styles.grabber, { backgroundColor: palette.border }]} />
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={[styles.heading, { color: palette.foreground }]}>
                {initial ? 'Edit your goal' : isStep ? 'A smaller step' : 'Create a goal'}
              </Text>
            </View>
            <Pressable onPress={requestDismiss} accessibilityRole="button" accessibilityLabel="Close" style={styles.closeButton}>
              <X size={21} color={palette.muted} strokeWidth={1.8} />
            </Pressable>
          </View>
          <ScrollView ref={scrollRef} style={styles.formScroll} keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'none'}
            automaticallyAdjustKeyboardInsets={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.form} showsVerticalScrollIndicator={false}>
            {isStep ? <View style={[styles.parentContext, { backgroundColor: palette.accentSoft, borderColor: palette.border }]}>
              <Layers3 size={18} color={palette.accent} strokeWidth={1.7} />
              <View style={{ flex: 1, gap: 5 }}>
                <Text style={[styles.contextLabel, { color: palette.accent }]}>PART OF</Text>
                <Text style={[styles.contextTitle, { color: palette.foreground }]} numberOfLines={3}>{parent.title}</Text>
              </View>
            </View> : null}
            <Text style={[styles.label, { color: palette.muted }]}>{isStep ? 'YOUR NEXT STEP' : 'GOAL'}</Text>
            <TextInput
              autoFocus={false}
              placeholder={isStep ? 'What is one small action?' : 'What would you like to achieve?'}
              placeholderTextColor={palette.muted}
              value={title}
              onChangeText={setTitle}
              maxLength={180}
              style={[styles.titleInput, { backgroundColor: palette.surface, borderColor: palette.border, color: palette.foreground }]}
              accessibilityLabel="Goal name"
              returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => notesRef.current?.focus()}
            />
            <View style={styles.labelRow}>
              <Text style={[styles.label, { color: palette.muted }]}>NOTES</Text>
              <Text style={[styles.optional, { color: palette.muted }]}>optional</Text>
            </View>
            <TextInput ref={notesRef} placeholder="Anything that makes this easier to start…" placeholderTextColor={palette.muted}
              value={notes} onChangeText={setNotes} multiline scrollEnabled textAlignVertical="top"
              style={[styles.notesInput, { backgroundColor: palette.surface, borderColor: palette.border, color: palette.foreground }]}
              accessibilityLabel="Goal notes" />
            <Pressable accessibilityRole="button" accessibilityLabel={`Planning options: ${inbox ? 'Inbox, no date yet' : periodText(horizon, chosenDate)}`} accessibilityState={{ expanded }}
              onPress={() => setExpanded(!expanded)} style={[styles.planningSummary, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              {inbox ? <Inbox size={20} color={palette.accent} strokeWidth={1.7} /> : <CalendarDays size={20} color={palette.accent} strokeWidth={1.7} />}
              <View style={{ flex: 1, gap: 5 }}>
                <Text style={[styles.summaryTitle, { color: palette.foreground }]}>{inbox ? 'Inbox · no date yet' : periodText(horizon, chosenDate)}</Text>
                <Text style={[styles.summaryDetail, { color: palette.muted }]}>
                  {[inbox ? 'Plan when you are ready' : HORIZON_TITLES[horizon],
                    dueDate ? `Due ${dueDate}` : '', !inbox && repeatRule !== 'none' ? REPEAT_LABELS[repeatRule] : '',
                    !isStep && currentParent ? `Part of ${currentParent.title}` : ''].filter(Boolean).join(' · ')}
                </Text>
              </View>
              {expanded ? <ChevronUp size={18} color={palette.muted} /> : <ChevronDown size={18} color={palette.muted} />}
            </Pressable>
            {expanded ? <>
            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: inbox }} onPress={() => { setInbox(!inbox); setRepeatRule('none'); }} style={styles.inboxChoice}>
              <View style={[styles.checkbox, { backgroundColor: inbox ? palette.accent : 'transparent', borderColor: inbox ? palette.accent : palette.muted }]}>
                {inbox ? <Check size={14} color={palette.onAccent} strokeWidth={2.3} /> : null}
              </View>
              <Text style={{ color: palette.foreground, fontSize: 14, flex: 1 }}>Keep in Inbox without a date</Text>
            </Pressable>
            {!inbox ? <>
            <Text style={[styles.label, { color: palette.muted }]}>TIME HORIZON</Text>
            <View style={styles.chips}>
              {HORIZONS.map((item) => {
                const active = horizon === item;
                return (
                  <Pressable
                    key={item}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    onPress={() => changeHorizon(item)}
                    style={[styles.chip, { backgroundColor: active ? palette.foreground : palette.surface, borderColor: active ? palette.foreground : palette.border }]}
                  >
                    <Text style={[styles.chipText, { color: active ? palette.background : palette.foreground }]}>{HORIZON_TITLES[item]}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={[styles.label, { color: palette.muted }]}>WHEN</Text>
            <View style={[styles.periodRow, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              {horizon !== 'life' ? <Pressable accessibilityRole="button" accessibilityLabel="Previous planning period"
                style={styles.periodAction} onPress={() => movePeriod(-1)}>
                <ChevronLeft size={21} color={palette.foreground} />
              </Pressable> : null}
              <View style={styles.periodMiddle}>
                <Text style={[styles.periodTitle, { color: palette.foreground }]} numberOfLines={2}>{periodText(horizon, chosenDate)}</Text>
                {horizon !== 'life' ? <Pressable onPress={() => { const now = new Date(); setDate(now); setDateText(periodKey('day', now)); }}
                  accessibilityRole="button" accessibilityLabel="Use current period" style={styles.currentPeriod}>
                  <Text style={[styles.now, { color: palette.accent }]}>Go to current period</Text>
                </Pressable> : null}
              </View>
              {horizon !== 'life' ? <Pressable accessibilityRole="button" accessibilityLabel="Next planning period"
                style={styles.periodAction} onPress={() => movePeriod(1)}>
                <ChevronRight size={21} color={palette.foreground} />
              </Pressable> : null}
            </View>
            {horizon === 'day' ? (
              <>
                <DateTimeField value={dateText} label="Planning date" onChange={(value) => {
                    setDateText(value);
                    const parsed = parseDateInput(value);
                    if (parsed) setDate(parsed);
                  }} />
                {!validDate ? <Text style={styles.validation}>Enter an existing date, for example 2026-10-14.</Text> : null}
              </>
            ) : null}
            </> : null}
            <Text style={[styles.label, { color: palette.muted }]}>DEADLINE (OPTIONAL)</Text>
            <DateTimeField value={dueDate} onChange={setDueDate} onClear={() => setDueDate('')} label="Deadline" placeholder="No deadline" />
            {dueDate && !parseDateInput(dueDate) ? <Text style={styles.validation}>Enter a real deadline as YYYY-MM-DD.</Text> : null}
            {!inbox && horizon === 'day' ? <>
              <Text style={[styles.label, { color: palette.muted }]}>REPEAT THIS STEP</Text>
              <View style={styles.chips}>
                {REPEAT_RULES.map((rule) => <Pressable key={rule} accessibilityRole="button" accessibilityState={{ selected: repeatRule === rule }}
                  onPress={() => setRepeatRule(rule)} style={[styles.chip, { borderColor: palette.border, backgroundColor: repeatRule === rule ? palette.foreground : palette.surface }]}>
                  <Text style={{ color: repeatRule === rule ? palette.background : palette.foreground }}>{REPEAT_LABELS[rule]}</Text>
                </Pressable>)}
              </View>
              {repeatRule !== 'none' ? <Text style={[styles.dateHelp, { color: palette.muted }]}>Completing this step creates the next occurrence. Its notes and board links carry over; deadlines, time blocks and child steps do not.</Text> : null}
            </> : null}
            {!isStep ? <><View style={styles.labelRow}>
              <Text style={[styles.label, { color: palette.muted }]}>PART OF</Text>
              <Text style={[styles.optional, { color: palette.muted }]}>optional</Text>
            </View>
            <Pressable
              onPress={() => setShowParents((value) => !value)}
              disabled={parentOptions.length === 0 && !currentParent}
              accessibilityRole="button"
              accessibilityState={{ disabled: parentOptions.length === 0 && !currentParent }}
              accessibilityLabel="Select parent goal"
              style={[styles.parentSelect, { backgroundColor: palette.surface, borderColor: palette.border }]}
            >
              <Text style={[styles.parentLabel, { color: palette.foreground }]} numberOfLines={1}>{currentParent?.title ?? 'Independent goal'}</Text>
              {showParents ? <ChevronUp size={18} color={palette.muted} /> : <ChevronDown size={18} color={palette.muted} />}
            </Pressable>
            {showParents ? (
              <View style={[styles.parentOptions, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                <TextInput value={parentSearch} onChangeText={setParentSearch} placeholder="Search your goals" accessibilityLabel="Search parent goals"
                  placeholderTextColor={palette.muted} style={[styles.search, { color: palette.foreground, borderColor: palette.border }]} />
                <Pressable style={styles.parentChoice} accessibilityRole="button" onPress={() => { setParentId(null); setShowParents(false); }}>
                  <View style={styles.optionIcon}>{parentId === null ? <Check size={17} color={palette.accent} /> : null}</View>
                  <Text style={[styles.parentOptionText, { color: palette.foreground }]}>Independent goal</Text>
                </Pressable>
                {filteredParents.map((option) => (
                  <Pressable key={option.id} style={styles.parentChoice} accessibilityRole="button" onPress={() => { setParentId(option.id); setShowParents(false); }}>
                    <View style={styles.optionIcon}>{option.id === parentId ? <Check size={17} color={palette.accent} /> : <Layers3 size={17} color={palette.muted} />}</View>
                    <Text style={[styles.parentOptionText, { color: palette.foreground }]} numberOfLines={2}>
                      {option.title}
                    </Text>
                  </Pressable>
                ))}
                {filteredParents.length === 0 && parentSearch.trim().length > 0 ? (
                  <Text style={[styles.dateHelp, { color: palette.muted }]}>No matching goals</Text>
                ) : null}
              </View>
            ) : null}</> : null}
            </> : null}
          </ScrollView>
          <SafeAreaView edges={['bottom']} style={[styles.saveFooter, { backgroundColor: palette.background, borderTopColor: palette.border }]}>
            <Pressable accessibilityRole="button" accessibilityState={{ disabled: !isValid || saving }}
              disabled={!isValid || saving} onPress={submit}
              style={[styles.save, { backgroundColor: palette.accent, opacity: isValid && !saving ? 1 : 0.45 }]}>
              <Text style={[styles.saveText, { color: palette.onAccent }]}>{saving ? 'Saving…' : initial ? 'Save changes' : isStep ? 'Add step' : 'Create goal'}</Text>
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
  sheet: { flex: 1, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 10, overflow: 'hidden' },
  grabber: { height: 4, width: 36, alignSelf: 'center', borderRadius: 10, marginBottom: 18 },
  header: { paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerCopy: { flex: 1, gap: 5 },
  heading: { ...type.title },
  closeButton: { minHeight: 48, minWidth: 48, justifyContent: 'center', alignItems: 'center' },
  formScroll: { flex: 1 },
  form: { paddingHorizontal: spacing.lg, paddingBottom: 22, paddingTop: spacing.lg, gap: spacing.md },
  label: { fontSize: 11, letterSpacing: 1.15, fontWeight: '700' },
  titleInput: { borderWidth: 1, borderRadius: radius.lg, fontSize: 16, padding: spacing.md, minHeight: 56 },
  notesInput: { borderWidth: 1, borderRadius: radius.lg, fontSize: 15, padding: spacing.md, height: 120 },
  chips: { gap: spacing.sm, paddingVertical: 1, flexDirection: 'row', flexWrap: 'wrap' },
  chip: { borderWidth: 1, paddingVertical: 12, paddingHorizontal: 15, borderRadius: radius.md, minHeight: 48, justifyContent: 'center' },
  chipText: { fontSize: 13, fontWeight: '600' },
  periodRow: { minHeight: 83, borderWidth: 1, borderRadius: radius.lg, flexDirection: 'row', alignItems: 'center' },
  periodAction: { width: 48, minHeight: 70, alignItems: 'center', justifyContent: 'center' },
  periodMiddle: { flex: 1, gap: 6, alignItems: 'center' },
  periodTitle: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  now: { fontSize: 12, fontWeight: '600' },
  currentPeriod: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 8 },
  dateHelp: { fontSize: 12, marginTop: -7 },
  validation: { color: '#B34F4F', fontSize: 12 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  optional: { fontSize: 11, fontWeight: '400', letterSpacing: 0 },
  parentSelect: { minHeight: 52, borderWidth: 1, borderRadius: radius.lg, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, gap: spacing.sm },
  parentLabel: { fontSize: 14, fontWeight: '600', flex: 1 },
  parentOptions: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.sm, gap: 2 },
  search: { borderBottomWidth: 1, minHeight: 44, paddingHorizontal: 8 },
  parentChoice: { minHeight: 48, alignItems: 'center', flexDirection: 'row', gap: 10, paddingHorizontal: 10, paddingVertical: 8 },
  parentOptionText: { fontSize: 14, flex: 1 },
  optionIcon: { width: 18, alignItems: 'center' },
  inboxChoice: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12 },
  checkbox: { width: 22, height: 22, borderWidth: 1.5, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  parentContext: { padding: 14, borderWidth: 1, borderRadius: radius.md, gap: 12, flexDirection: 'row', alignItems: 'center' },
  contextLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.1 },
  contextTitle: { fontSize: 14, fontWeight: '600' },
  planningSummary: { minHeight: 72, padding: 14, borderWidth: 1, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', gap: 12 },
  summaryTitle: { fontSize: 14, fontWeight: '600' },
  summaryDetail: { fontSize: 12 },
  saveFooter: { borderTopWidth: 1, paddingHorizontal: spacing.lg, paddingTop: 12, paddingBottom: 10 },
  save: { minHeight: 54, paddingVertical: 14, paddingHorizontal: 16, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  saveText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});

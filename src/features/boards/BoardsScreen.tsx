import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from '../../theme/useReducedMotion';
import { useFocusEffect, useRouter } from 'expo-router';
import { Alert, ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useColorScheme, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useEvridaDatabase } from '../../storage/use-database';
import { colors, depth, radius, spacing, semantic } from '../../theme/tokens';
import Check from 'lucide-react-native/icons/check';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import Circle from 'lucide-react-native/icons/circle';
import Clock3 from 'lucide-react-native/icons/clock-3';
import FolderOpen from 'lucide-react-native/icons/folder-open';
import Plus from 'lucide-react-native/icons/plus';
import X from 'lucide-react-native/icons/x';
import { HORIZON_TITLES } from '../../domain/horizons';
import { createGoal, listAllGoals, setGoalCompleted } from '../../storage/goals';
import type { Goal, GoalInput } from '../../domain/goals';
import { GoalEditor } from '../horizons/GoalEditor';
import { useFocusSession } from '../focus/FocusProvider';
import {
  addGoalToBoard, createBoard, deleteBoard, editBoard, getBoard, listBoardGoals,
  listBoards, removeGoalFromBoard, type Board, type BoardGoal,
} from '../../storage/boards';

export function BoardsScreen() {
  const reducedMotion = useReducedMotion();
  const db = useEvridaDatabase();
  const focus = useFocusSession();
  const router = useRouter();
  const palette = useColorScheme() === 'dark' ? colors.dark : colors.light;
  const [boards, setBoards] = useState<Board[]>([]);
  const [current, setCurrent] = useState<Board | null>(null);
  const [items, setItems] = useState<BoardGoal[]>([]);
  const [boardLens, setBoardLens] = useState<'open' | 'scheduled' | 'done' | 'all'>('open');
  const [candidates, setCandidates] = useState<Goal[]>([]);
  const [goalOptions, setGoalOptions] = useState<Goal[]>([]);
  const [addingGoal, setAddingGoal] = useState(false);
  const [goalAnchor, setGoalAnchor] = useState(() => new Date());
  const [query, setQuery] = useState('');
  const [picker, setPicker] = useState(false);
  const [editing, setEditing] = useState(false);
  const [boardTitle, setBoardTitle] = useState('');
  const [boardDescription, setBoardDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const writeLock = useRef(false);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  const refresh = useCallback(() => setRevision((value) => value + 1), []);

  useFocusEffect(useCallback(() => {
    refresh();
  }, [refresh]));

  useEffect(() => {
    let active = true;
    setLoading(true);
    void Promise.all([
      listBoards(db),
      current ? getBoard(db, current.id) : Promise.resolve(null),
      current ? listBoardGoals(db, current.id) : Promise.resolve([]),
    ]).then(([allBoards, latestBoard, boardGoals]) => {
      if (!active) return;
      setBoards(allBoards);
      if (current) setCurrent(latestBoard);
      setItems(boardGoals);
      setFailure(null);
    }).catch((err: unknown) => {
      if (active) setFailure(err instanceof Error ? err.message : 'Unable to load boards.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [db, current?.id, revision]);

  async function write(task: () => Promise<void>) {
    if (writeLock.current) return;
    writeLock.current = true;
    setBusy(true);
    try {
      await task();
      refresh();
    } catch (err) {
      Alert.alert('Could not save', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      writeLock.current = false;
      setBusy(false);
    }
  }

  function startCreate() {
    setBoardTitle('');
    setBoardDescription('');
    setEditing(true);
  }

  function startEdit() {
    if (!current) return;
    setBoardTitle(current.title);
    setBoardDescription(current.description);
    setEditing(true);
  }

  async function saveBoard() {
    if (!boardTitle.trim() || busy) return;
    await write(async () => {
      if (editorWasOpenedForCurrent && current) {
        await editBoard(db, current.id, boardTitle, boardDescription);
      } else {
        const id = await createBoard(db, boardTitle, boardDescription);
        const created = await getBoard(db, id);
        if (created) setCurrent(created);
      }
      setEditing(false);
      setEditorWasOpenedForCurrent(false);
    });
  }

  const [editorWasOpenedForCurrent, setEditorWasOpenedForCurrent] = useState(false);

  function createFromList() {
    setEditorWasOpenedForCurrent(false);
    startCreate();
  }

  function editCurrent() {
    setEditorWasOpenedForCurrent(true);
    startEdit();
  }

  function confirmDelete() {
    if (!current) return;
    const board = current;
    Alert.alert('Delete this board?', 'Only the board will be deleted. All goals will remain in Horizons.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete board', style: 'destructive', onPress: () => void write(async () => {
        await deleteBoard(db, board.id);
        setCurrent(null);
        setItems([]);
      }) },
    ]);
  }

  async function startNewGoal() {
    if (!current) return;
    setGoalAnchor(new Date());
    try {
      setGoalOptions(await listAllGoals(db));
      setAddingGoal(true);
    } catch (err) {
      Alert.alert('Cannot open editor', err instanceof Error ? err.message : 'Please try again.');
    }
  }

  async function saveNewGoal(input: GoalInput) {
    if (!current || busy) return;
    const boardId = current.id;
    await write(async () => {
      await createGoal(db, input, boardId);
      setAddingGoal(false);
    });
  }

  async function startPicker() {
    if (!current) return;
    try {
      const goals = await listAllGoals(db);
      setCandidates(goals.filter((goal) => !items.some((item) => item.id === goal.id)));
      setQuery('');
      setPicker(true);
    } catch (err) {
      Alert.alert('Cannot load goals', err instanceof Error ? err.message : 'Please try again.');
    }
  }

  const matches = useMemo(() => candidates.filter((goal) => {
    const text = `${goal.title} ${HORIZON_TITLES[goal.horizon]}`.toLowerCase();
    return text.includes(query.toLowerCase().trim());
  }), [candidates, query]);

  function attach(goal: Goal) {
    if (!current) return;
    const boardId = current.id;
    void write(async () => {
      await addGoalToBoard(db, boardId, goal.id);
      setCandidates((all) => all.filter((candidate) => candidate.id !== goal.id));
    });
  }

  function detach(goal: BoardGoal) {
    if (!current) return;
    const boardId = current.id;
    Alert.alert('Remove from board?', 'The goal will stay in Horizons and other boards.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', onPress: () => void write(async () => {
        await removeGoalFromBoard(db, boardId, goal.id);
      }) },
    ]);
  }

  const lensItems = items.filter((goal) =>
    boardLens === 'all' ? true : boardLens === 'done' ? goal.completed :
    boardLens === 'scheduled' ? !goal.completed && !!goal.nextBlockAt : !goal.completed);
  const lensOptions = [
    { id: 'open', title: 'Open', count: items.filter((goal) => !goal.completed).length },
    { id: 'scheduled', title: 'Scheduled', count: items.filter((goal) => !goal.completed && !!goal.nextBlockAt).length },
    { id: 'done', title: 'Done', count: items.filter((goal) => goal.completed).length },
    { id: 'all', title: 'All', count: items.length },
  ] as const;
  const controlColor = palette.foreground;
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.screen, { backgroundColor: palette.background }]}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <View style={styles.topRow}>
          <Text style={[styles.brand, { color: palette.muted }]}>EVRIDA</Text>
          {current ? <Pressable onPress={() => { setCurrent(null); setBoardLens('open'); }}
            accessibilityRole="button" accessibilityLabel="Back to boards"
            style={[styles.back, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <ChevronLeft size={21} color={controlColor} />
          </Pressable> : null}
        </View>

        <Text style={[styles.heading, { color: palette.foreground }]}>{current ? current.title : 'Boards'}</Text>
        <Text style={[styles.subtitle, { color: palette.muted }]}>
          {current ? current.description || 'Keep related goals together, across every horizon.' :
            'A home for projects, topics and plans beyond a single date.'}
        </Text>

        {failure ? (
          <View style={[styles.notice, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <Text style={{ color: palette.foreground }}>{failure}</Text>
            <Pressable onPress={refresh} style={styles.action} accessibilityRole="button">
              <Text style={{ color: palette.accent }}>Retry</Text>
            </Pressable>
          </View>
        ) : loading ? <ActivityIndicator color={palette.accent} style={styles.loading} /> : current ? (
          <>
            <View style={styles.boardTools}>
              <Text style={[styles.count, { color: palette.muted }]}>
                {items.length} goals · {items.filter((goal) => goal.completed).length} completed
              </Text>
              <Pressable onPress={editCurrent} accessibilityRole="button" style={styles.smallAction}>
                <Text style={[styles.actionText, { color: palette.accent }]}>Edit</Text>
              </Pressable>
              <Pressable onPress={confirmDelete} accessibilityRole="button" style={styles.smallAction}>
                <Text style={[styles.deleteText, { color: palette === colors.dark ? semantic.dark.danger : semantic.light.danger }]}>Delete</Text>
              </Pressable>
            </View>
            <View style={styles.boardEntryActions}>
              <Pressable onPress={() => void startNewGoal()} accessibilityRole="button"
                style={[styles.boardPrimaryAction, { backgroundColor: palette.accent }]}>
                <Plus size={18} color={palette.onAccent} /><Text style={[styles.primaryText, { color: palette.onAccent }]}>New goal</Text>
              </Pressable>
              <Pressable onPress={() => void startPicker()} accessibilityRole="button"
                style={[styles.boardSecondaryAction, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                <Text style={[styles.actionText, { color: palette.accent }]}>Link existing</Text>
              </Pressable>
            </View>
            <View accessibilityRole="tablist" style={[styles.lensBar, { backgroundColor: palette.inset }]}>
              {lensOptions.map((lens) => (
                <Pressable key={lens.id} accessibilityRole="tab"
                  accessibilityLabel={`${lens.title}, ${lens.count} goals`}
                  accessibilityState={{ selected: boardLens === lens.id }}
                  onPress={() => setBoardLens(lens.id)}
                  style={[styles.lensTab, boardLens === lens.id && { backgroundColor: palette.surface }]}>
                  <Text style={[styles.lensLabel, { color: boardLens === lens.id ? palette.foreground : palette.muted,
                    fontWeight: boardLens === lens.id ? '700' : '500' }]}>{lens.title}</Text>
                  <Text style={{ color: boardLens === lens.id ? palette.accent : palette.muted, fontSize: 10 }}>{lens.count}</Text>
                </Pressable>
              ))}
            </View>
            {items.length === 0 ? (
              <View style={[styles.notice, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                <Text style={[styles.noticeTitle, { color: palette.foreground }]}>Start building this board</Text>
                <Text style={[styles.noticeText, { color: palette.muted }]}>
                  Add goals from different horizons. The originals remain in place.
                </Text>
              </View>
            ) : lensItems.length === 0 ? (
              <View style={[styles.notice, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                <Text style={[styles.noticeTitle, { color: palette.foreground }]}>
                  {boardLens === 'done' ? 'No completed goals yet' : boardLens === 'scheduled' ?
                    'Nothing is scheduled' : 'No goals in this view'}
                </Text>
                <Text style={[styles.noticeText, { color: palette.muted }]}>
                  {boardLens === 'scheduled' ? 'Reserve time in Calendar to see upcoming work here.' :
                    'Try a different view or add a goal to this board.'}
                </Text>
              </View>
            ) : lensItems.map((goal) => (
              <View key={goal.id} style={[styles.goalCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: goal.completed }}
                  accessibilityLabel={`${goal.completed ? 'Reopen' : 'Complete'} ${goal.title}`}
                  disabled={busy}
                  style={styles.checkbox}
                  onPress={() => void write(async () => {
                    await setGoalCompleted(db, goal.id, !goal.completed);
                    await focus.refresh();
                  })}>
                  {goal.completed ? <Check size={20} color={palette.accent} /> : <Circle size={20} color={palette.muted} strokeWidth={1.4} />}
                </Pressable>
                <Pressable style={styles.goalCopy} accessibilityRole="button"
                  accessibilityLabel={`Open ${goal.title} in Horizons`}
                  onPress={() => router.push({ pathname: '/', params: { goalId: goal.id } })}>
                  <Text style={[styles.goalTitle, { color: palette.foreground, textDecorationLine: goal.completed ? 'line-through' : 'none' }]}
                    numberOfLines={2}>{goal.title}</Text>
                  <Text style={[styles.goalMeta, { color: palette.muted }]} numberOfLines={1}>
                    {goal.inbox ? 'Inbox · not yet planned' : HORIZON_TITLES[goal.horizon] + ' · ' + goal.periodKey}{goal.parentTitle ? ` · ↳ ${goal.parentTitle}` : ''}
                  </Text>
                  {goal.nextBlockAt ? (
                    <Text style={[styles.goalMeta, { color: palette.accent }]} numberOfLines={1}>
                      ◷ {new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(goal.nextBlockAt))}
                    </Text>
                  ) : null}
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={`Schedule ${goal.title}`}
                  onPress={() => router.push({ pathname: '/calendar', params: { goalId: goal.id } })}
                  style={styles.schedule}>
                  <Clock3 size={20} color={palette.accent} strokeWidth={1.8} />
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${goal.title} from board`}
                  onPress={() => detach(goal)} style={styles.remove}>
                  <X size={19} color={palette.muted} strokeWidth={1.8} />
                </Pressable>
              </View>
            ))}
          </>
        ) : (
          <>
            <Pressable onPress={createFromList} accessibilityRole="button"
              style={[styles.primary, { backgroundColor: palette.accent }]}>
              <Plus size={19} color={palette.onAccent} /><Text style={[styles.primaryText, { color: palette.onAccent }]}>Create a board</Text>
            </Pressable>
            {boards.length === 0 ? (
              <View style={[styles.notice, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                <Text style={[styles.noticeTitle, { color: palette.foreground }]}>Every project needs a space.</Text>
                <Text style={[styles.noticeText, { color: palette.muted }]}>
                  Create a board, then add related goals without moving or duplicating them.
                </Text>
              </View>
            ) : boards.map((board) => (
              <Pressable key={board.id} accessibilityRole="button" accessibilityLabel={`Open board ${board.title}`}
                onPress={() => setCurrent(board)} style={[styles.boardCard, { backgroundColor: palette.surface, borderColor: palette.border, boxShadow: palette === colors.dark ? depth.dark.card : depth.light.card }]}>
                <View style={[styles.boardEmblem, { backgroundColor: palette.accentSoft }]}><FolderOpen size={23} color={palette.accent} strokeWidth={1.5} /></View>
                <View style={styles.boardCopy}>
                  <Text style={[styles.boardTitle, { color: palette.foreground }]} numberOfLines={1}>{board.title}</Text>
                  <Text style={[styles.goalMeta, { color: palette.muted }]} numberOfLines={2}>
                    {board.description || `${board.goalCount} goals`}
                  </Text>
                  <Text style={[styles.count, { color: palette.accent }]}>
                    {board.goalCount} goals · {board.completedCount} done
                  </Text>
                </View>
                <ChevronRight size={20} color={palette.muted} strokeWidth={1.8} />
              </Pressable>
            ))}
          </>
        )}
      </ScrollView>

      <GoalEditor
        visible={addingGoal}
        initial={null}
        parent={null}
        parentOptions={goalOptions}
        defaultInbox
        defaultHorizon="week"
        anchorDate={goalAnchor}
        palette={palette}
        saving={busy}
        onDismiss={() => { if (!busy) setAddingGoal(false); }}
        onSave={saveNewGoal}
      />

      <Modal visible={editing} transparent animationType={reducedMotion ? 'none' : 'slide'} navigationBarTranslucent statusBarTranslucent
        onRequestClose={() => setEditing(false)}>
        <SafeAreaProvider>
          <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setEditing(false)} />
            <SafeAreaView edges={['bottom']} style={[styles.sheet, { backgroundColor: palette.background }]}>
              <Text style={[styles.sheetHeading, { color: palette.foreground }]}>
                {editorWasOpenedForCurrent ? 'Edit board' : 'New board'}
              </Text>
              <TextInput value={boardTitle} onChangeText={setBoardTitle} placeholder="Board name"
                placeholderTextColor={palette.muted} maxLength={100} accessibilityLabel="Board name"
                style={[styles.field, { backgroundColor: palette.surface, borderColor: palette.border, color: palette.foreground }]} />
              <TextInput value={boardDescription} onChangeText={setBoardDescription} placeholder="Optional description"
                multiline placeholderTextColor={palette.muted} accessibilityLabel="Board description"
                style={[styles.field, styles.multi, { backgroundColor: palette.surface, borderColor: palette.border, color: palette.foreground }]} />
              <Pressable disabled={busy || !boardTitle.trim()} accessibilityRole="button" onPress={() => void saveBoard()}
                style={[styles.primary, { backgroundColor: palette.accent, opacity: !boardTitle.trim() || busy ? .45 : 1 }]}>
                <Text style={[styles.primaryText, { color: palette.onAccent }]}>{busy ? 'Saving…' : 'Save board'}</Text>
              </Pressable>
              <Pressable onPress={() => setEditing(false)} accessibilityRole="button" style={styles.cancel}>
                <Text style={[styles.actionText, { color: palette.muted }]}>Cancel</Text>
              </Pressable>
            </SafeAreaView>
          </KeyboardAvoidingView>
        </SafeAreaProvider>
      </Modal>

      <Modal visible={picker} transparent animationType={reducedMotion ? 'none' : 'slide'} statusBarTranslucent navigationBarTranslucent
        onRequestClose={() => setPicker(false)}>
        <SafeAreaProvider>
          <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setPicker(false)} />
            <SafeAreaView edges={['bottom']} style={[styles.pickerSheet, { backgroundColor: palette.background }]}>
              <View style={styles.pickerHeading}>
                <Text style={[styles.sheetHeading, { color: palette.foreground }]}>Add goals</Text>
                <Pressable onPress={() => setPicker(false)} accessibilityRole="button" accessibilityLabel="Close selector" style={styles.remove}>
                  <X size={21} color={palette.muted} strokeWidth={1.8} />
                </Pressable>
              </View>
              <TextInput placeholder="Search your goals" placeholderTextColor={palette.muted} value={query}
                onChangeText={setQuery} accessibilityLabel="Search goals"
                style={[styles.field, { backgroundColor: palette.surface, borderColor: palette.border, color: palette.foreground }]} />
              <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.pickerItems}>
                {matches.length === 0 ? (
                  <Text style={[styles.noticeText, { color: palette.muted }]}>
                    {candidates.length === 0 ? 'No available goals. Create one in Horizons first.' : 'No matching goals.'}
                  </Text>
                ) : matches.map((goal) => (
                  <Pressable key={goal.id} disabled={busy} accessibilityRole="button"
                    accessibilityLabel={`Add ${goal.title}`} onPress={() => attach(goal)}
                    style={[styles.choice, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                    <View style={{ flex: 1, gap: 5 }}>
                      <Text style={[styles.goalTitle, { color: palette.foreground }]} numberOfLines={2}>{goal.title}</Text>
                      <Text style={[styles.goalMeta, { color: palette.muted }]}>
                        {goal.inbox ? 'Inbox · not yet planned' : HORIZON_TITLES[goal.horizon] + ' · ' + goal.periodKey}
                      </Text>
                    </View>
                    <Text style={[styles.actionText, { color: palette.accent }]}>＋ Add</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </SafeAreaView>
          </KeyboardAvoidingView>
        </SafeAreaProvider>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  page: { padding: 20, paddingBottom: 40, gap: 12 },
  topRow: { flexDirection: 'row', alignItems: 'center', minHeight: 20 },
  back: { width: 48, height: 48, borderWidth: 1, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  brand: { fontSize: 10, letterSpacing: 2.3, fontWeight: '600', flex: 1 },
  heading: { fontSize: 32, letterSpacing: -1.2, fontWeight: '700' },
  subtitle: { fontSize: 13, lineHeight: 21, marginBottom: 10 },
  primary: { minHeight: 53, borderRadius: radius.md, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 15, marginBottom: 9 },
  primaryText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  boardTools: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  boardEntryActions: { flexDirection: 'row', gap: 9, marginBottom: 11 },
  boardPrimaryAction: { flex: 1, minHeight: 53, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md },
  boardSecondaryAction: { flex: 1, minHeight: 53, alignItems: 'center', justifyContent: 'center', borderRadius: radius.lg, borderWidth: 1 },
  smallAction: { minHeight: 48, paddingHorizontal: 9, justifyContent: 'center' },
  lensBar: { flexDirection: 'row', borderRadius: 15, padding: 4, gap: 3, marginBottom: 4 },
  lensTab: { flex: 1, minHeight: 48, borderRadius: 11, alignItems: 'center', justifyContent: 'center', gap: 3 },
  lensLabel: { fontSize: 11 },
  actionText: { fontSize: 13, fontWeight: '700' },
  deleteText: { fontSize: 13, fontWeight: '700' },
  count: { fontSize: 12, fontWeight: '600' },
  boardCard: { borderWidth: 1, borderRadius: radius.lg, flexDirection: 'row', gap: 13, alignItems: 'center', padding: 16, minHeight: 112 },
  boardEmblem: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  boardCopy: { flex: 1, gap: 8 },
  boardTitle: { fontSize: 16, fontWeight: '600', letterSpacing: -.2 },
  goalMeta: { fontSize: 12 },
  goalCard: { borderWidth: 1, borderRadius: radius.lg, minHeight: 77, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 4 },
  checkbox: { minHeight: 48, minWidth: 48, alignItems: 'center', justifyContent: 'center' },
  goalCopy: { flex: 1, gap: 5, paddingVertical: 10 },
  goalTitle: { fontSize: 15, fontWeight: '600' },
  schedule: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  remove: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  notice: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.lg, gap: 10 },
  noticeTitle: { fontSize: 17, fontWeight: '700' },
  noticeText: { fontSize: 13, lineHeight: 21 },
  loading: { marginTop: 35 },
  action: { minHeight: 48, justifyContent: 'center' },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(9,22,18,0.45)' },
  sheet: { borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: spacing.lg, gap: 12 },
  pickerSheet: { maxHeight: '88%', borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: spacing.lg, gap: 12 },
  sheetHeading: { fontSize: 24, fontWeight: '700', marginBottom: 9 },
  field: { borderWidth: 1, borderRadius: radius.lg, minHeight: 54, padding: 14, fontSize: 15 },
  multi: { minHeight: 84, textAlignVertical: 'top' },
  cancel: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  pickerHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pickerItems: { gap: 8, paddingBottom: 15 },
  choice: { borderWidth: 1, borderRadius: radius.lg, minHeight: 68, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 10 },
});

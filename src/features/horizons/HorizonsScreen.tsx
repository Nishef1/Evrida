import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentRef } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, AppState, Keyboard, Modal, Pressable, ScrollView, SectionList, StyleSheet, Text, TextInput, useColorScheme, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useEvridaDatabase } from '../../storage/use-database';
import { dateFromPeriodKey, HORIZONS, HORIZON_TITLES, periodKey, periodLabel, shiftPeriod, type Horizon } from '../../domain/horizons';
import { availableGoalParents, type Goal, type GoalInput } from '../../domain/goals';
import { buildPerspectiveSections } from '../../domain/perspective';
import { archiveGoal, createGoal, editGoal, getGoal, listAllGoals, listArchivedGoals, listChildGoals, listGoalAncestors, listGoals, listInboxGoals, listPerspectiveGoals, moveGoal, planGoal, restoreGoal, setGoalCompleted } from '../../storage/goals';
import { colors, depth, radius, spacing, semantic, type Palette, scrim } from '../../theme/tokens';
import Archive from 'lucide-react-native/icons/archive';
import Check from 'lucide-react-native/icons/check';
import ChevronDown from 'lucide-react-native/icons/chevron-down';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import Clock3 from 'lucide-react-native/icons/clock-3';
import Inbox from 'lucide-react-native/icons/inbox';
import Layers3 from 'lucide-react-native/icons/layers';
import MoreHorizontal from 'lucide-react-native/icons/ellipsis';
import Plus from 'lucide-react-native/icons/plus';
import Search from 'lucide-react-native/icons/search';
import Settings2 from 'lucide-react-native/icons/settings-2';
import X from 'lucide-react-native/icons/x';
import { HorizonSpectrum } from '../shared/HorizonSpectrum';
import { GoalDetails } from './GoalDetails';
import { GoalCard } from './GoalCard';
import { GoalEditor } from './GoalEditor';
import { GuidedPlansSheet } from './GuidedPlansSheet';
import { createGuidedPlan } from '../../storage/guided-plans';
import BookOpenCheck from 'lucide-react-native/icons/book-open-check';
import { PerspectiveView } from './PerspectiveView';
import { ArchiveView } from './ArchiveView';
import { useFocusSession } from '../focus/FocusProvider';
import { useReducedMotion } from '../../theme/useReducedMotion';
import { type } from '../../theme/type';
import { useDockInset } from '../shell/DockInset';


export function HorizonsScreen() {
  const reducedMotion = useReducedMotion();
  const dockInset = useDockInset();
  const db = useEvridaDatabase();
  const router = useRouter();
  const focus = useFocusSession();
  const { goalId } = useLocalSearchParams<{ goalId?: string }>();
  const openedFromBoard = useRef<string | null>(null);
  const palette = useColorScheme() === 'dark' ? colors.dark : colors.light;
  const [horizon, setHorizon] = useState<Horizon>('day');
  const [view, setView] = useState<'focus' | 'perspective' | 'archive' | 'inbox'>('focus');
  const [anchor, setAnchor] = useState(() => new Date());
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loadedReadKey, setLoadedReadKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [perspectiveRevision, setPerspectiveRevision] = useState(0);
  const [perspectiveGoals, setPerspectiveGoals] = useState<Goal[]>([]);
  const [perspectiveLoading, setPerspectiveLoading] = useState(false);
  const [perspectiveError, setPerspectiveError] = useState<string | null>(null);
  const [archivedGoals, setArchivedGoals] = useState<Goal[]>([]);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archiveRevision, setArchiveRevision] = useState(0);
  const [working, setWorking] = useState(false);
  const writeLock = useRef(false);
  const [quickTitle, setQuickTitle] = useState('');
  const [captureNotice, setCaptureNotice] = useState<{ context: string; label: string } | null>(null);
  const [expandedCompletedFor, setExpandedCompletedFor] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [toolsVisible, setToolsVisible] = useState(false);
  const [guidedVisible, setGuidedVisible] = useState(false);
  const [horizonsVisible, setHorizonsVisible] = useState(false);
  const [search, setSearch] = useState('');
  const quickInput = useRef<ComponentRef<typeof TextInput>>(null);
  const [clockDay, setClockDay] = useState(() => periodKey('day', new Date()));
  useEffect(() => {
    const update = () => { setClockDay(periodKey('day', new Date())); setRevision((n) => n + 1); };
    const timer = setInterval(() => setClockDay(periodKey('day', new Date())), 60000);
    const listener = AppState.addEventListener('change', (state) => { if (state === 'active') update(); });
    return () => { clearInterval(timer); listener.remove(); };
  }, []);
  const [organizing, setOrganizing] = useState<Goal | null>(null);
  const [detailStack, setDetailStack] = useState<Goal[]>([]);
  const detailRequest = useRef(0);
  const details = detailStack[detailStack.length - 1] ?? null;
  const [parentOptions, setParentOptions] = useState<Goal[]>([]);
  const [children, setChildren] = useState<Goal[]>([]);
  const [ancestors, setAncestors] = useState<Goal[]>([]);
  const [editorVisible, setEditorVisible] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [editorDraftTitle, setEditorDraftTitle] = useState('');
  const editorReturnPath = useRef<Goal[]>([]);
  const [parent, setParent] = useState<Goal | null>(null);
  const [editorContext, setEditorContext] = useState<{ horizon: Horizon; anchor: Date; inbox: boolean }>(
    () => ({ horizon: 'week', anchor: new Date(), inbox: false }),
  );
  const key = periodKey(horizon, anchor);
  const caption = periodLabel(horizon, anchor);
  const goalReadKey = `${view}:${horizon}:${key}:${searching ? search : 'no-search'}:${searching}`;
  const waitingForList = loadedReadKey !== goalReadKey || (loading && goals.length === 0);
  const openGoals = useMemo(() => goals.filter((goal) => !goal.completed), [goals]);
  const doneGoals = useMemo(() => goals.filter((goal) => goal.completed), [goals]);
  const listContext = `${view}:${horizon}:${key}`;
  const showCompleted = expandedCompletedFor === listContext;

  // The same goal can be rescheduled or completed in Calendar or Boards.
  // Re-read SQLite when returning to Horizons instead of showing stale cards.
  useFocusEffect(useCallback(() => {
    setRevision((value) => value + 1);
  }, []));

  const perspectiveSections = useMemo(
    () => buildPerspectiveSections(
      HORIZONS.map((item) => ({
        horizon: item,
        key: periodKey(item, anchor),
        label: periodLabel(item, anchor),
      })),
      perspectiveGoals,
    ),
    [anchor, perspectiveGoals],
  );

  useEffect(() => {
    let active = true;
    setLoading(true);
    setFailure(null);
    const read = searching ? listAllGoals(db) : view === 'inbox' ? listInboxGoals(db) : listGoals(db, horizon, key);
    void read.then((result) => {
      const normalize = (value: string) => value.normalize('NFKC').toLocaleLowerCase().replace(/ي/g, 'ی').replace(/ك/g, 'ک');
      const query = normalize(search.trim());
      if (searching && query) result = result.filter((goal) => normalize(goal.title + ' ' + goal.notes + ' ' + (goal.parentTitle ?? '')).includes(query));
      if (!active) return;
      setGoals(result);
      setLoadedReadKey(goalReadKey);
      setFailure(null);
    }).catch((error: unknown) => {
      if (!active) return;
      setGoals([]);
      setLoadedReadKey(goalReadKey);
      setFailure(error instanceof Error ? error.message : 'Unable to load your goals.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [db, horizon, key, revision, view, searching, search, clockDay, goalReadKey]);

  useEffect(() => {
    if (view !== 'perspective') return;
    let active = true;
    setPerspectiveLoading(true);
    void listPerspectiveGoals(db, anchor).then((result) => {
      if (!active) return;
      setPerspectiveGoals(result);
      setPerspectiveError(null);
    }).catch((error: unknown) => {
      if (!active) return;
      setPerspectiveError(error instanceof Error ? error.message : 'Unable to load the bigger picture.');
    }).finally(() => {
      if (active) setPerspectiveLoading(false);
    });
    return () => { active = false; };
  }, [db, anchor, revision, perspectiveRevision, view]);

  useEffect(() => {
    if (view !== 'archive') return;
    let active = true;
    setArchiveLoading(true);
    void listArchivedGoals(db).then((items) => {
      if (!active) return;
      setArchivedGoals(items);
      setArchiveError(null);
    }).catch((error: unknown) => {
      if (active) setArchiveError(error instanceof Error ? error.message : 'Unable to load your archive.');
    }).finally(() => {
      if (active) setArchiveLoading(false);
    });
    return () => { active = false; };
  }, [db, view, revision, archiveRevision]);

  async function perform(action: () => Promise<void>): Promise<void> {
    if (writeLock.current) return;
    writeLock.current = true;
    setWorking(true);
    try {
      await action();
      setRevision((value) => value + 1);
    } catch (error) {
      Alert.alert('Could not save', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      writeLock.current = false;
      setWorking(false);
    }
  }

  async function openEditor(initial: Goal | null, selectedParent: Goal | null, targetHorizon: Horizon = horizon, draftTitle = '') {
    try {
      const options = await listAllGoals(db);
      setParentOptions(availableGoalParents(options, initial?.id ?? null));
      setEditing(initial);
      setEditorDraftTitle(draftTitle);
      setParent(selectedParent);
      editorReturnPath.current = initial || selectedParent ? [...detailStack] : [];
      setEditorContext({ horizon: selectedParent ? 'day' : targetHorizon,
        anchor: selectedParent ? new Date() : new Date(anchor.getTime()), inbox: selectedParent ? true : view === 'inbox' });
      detailRequest.current++;
      setDetailStack([]);
      setEditorVisible(true);
    } catch (error) {
      Alert.alert('Cannot open editor', error instanceof Error ? error.message : 'Please try again.');
    }
  }

  function openCreate() {
    Keyboard.dismiss();
    void openEditor(null, null, view === 'perspective' ? 'day' : horizon, quickTitle);
  }

  function openCreateForHorizon(target: Horizon) {
    void openEditor(null, null, target);
  }

  function focusHorizon(target: Horizon) {
    setHorizon(target);
    setView('focus');
    setSearching(false);
  }

  async function openDetails(goal: Goal, nested = false, returnPath?: Goal[]) {
    const request = ++detailRequest.current;
    try {
      const [latest, nextSteps, parentPath] = await Promise.all([
        getGoal(db, goal.id),
        listChildGoals(db, goal.id),
        listGoalAncestors(db, goal.id),
      ]);
      if (request !== detailRequest.current) return;
      if (!latest) {
        Alert.alert('Goal unavailable', 'This goal may have been deleted.');
        return;
      }
      setDetailStack((current) => returnPath ? [...returnPath, latest] : nested ? [...current, latest] : [latest]);
      setChildren(nextSteps);
      setAncestors(parentPath);
    } catch (error) {
      if (request === detailRequest.current) {
        Alert.alert('Could not load goal', error instanceof Error ? error.message : 'Please try again.');
      }
    }
  }

  // Board goals reuse the same original Goal detail sheet, not a copied board record.
  useEffect(() => {
    if (!goalId) {
      openedFromBoard.current = null;
      return;
    }
    if (openedFromBoard.current === goalId) return;
    openedFromBoard.current = goalId;
    void getGoal(db, goalId).then((goal) => {
      router.setParams({ goalId: undefined });
      if (goal) void openDetails(goal);
    }).catch(() => {
      Alert.alert('Goal unavailable', 'This goal could not be opened.');
    });
  }, [db, goalId]);

  function closeDetails() {
    detailRequest.current++;
    setDetailStack([]);
    setAncestors([]);
    setChildren([]);
  }

  function focusSelected(minutes: number) {
    if (!details || focus.busy) return;
    startGoalFocus(details, minutes);
  }

  function startGoalFocus(goal: Goal, minutes: number) {
    if (focus.busy) return;
    const start = (replace = false) => {
      void focus.beginQuick(goal.id, minutes, replace).then(() => {
        setOrganizing(null); closeDetails(); setRevision((n) => n + 1);
      }).catch((error: unknown) => Alert.alert('Could not start focus', error instanceof Error ? error.message : 'Please try again.'));
    };
    if (focus.session) Alert.alert('Switch your focus?', 'The current session will be recorded before this one starts.', [
      { text: 'Keep focusing', style: 'cancel' }, { text: 'Switch', onPress: () => start(true) },
    ]);
    else start();
  }

  function backToParent() {
    const request = ++detailRequest.current;
    const parentGoal = detailStack[detailStack.length - 2];
    if (!parentGoal) {
      closeDetails();
      return;
    }
    setDetailStack((items) => items.slice(0, -1));
    void Promise.all([listChildGoals(db, parentGoal.id), listGoalAncestors(db, parentGoal.id)])
      .then(([steps, path]) => {
        if (request === detailRequest.current) {
          setChildren(steps);
          setAncestors(path);
        }
      })
      .catch(() => {
        if (request === detailRequest.current) Alert.alert('Could not load parent goal', 'Please try again.');
      });
  }

  async function saveGoal(input: GoalInput) {
    if (working) return;
    await perform(async () => {
      if (editing) {
        await editGoal(db, editing.id, input);
      } else {
        await createGoal(db, input);
        setQuickTitle((current) => current === editorDraftTitle ? '' : current);
      }
      // Detail editing returns to its original path. Standalone capture shows its destination.
      if (editorReturnPath.current.length === 0) {
        if (input.inbox) setView('inbox');
        else if (view === 'inbox' || (view === 'focus' && (input.horizon !== horizon || input.periodKey !== key))) {
          setView('focus');
          setAnchor(dateFromPeriodKey(input.horizon, input.periodKey, anchor));
          setHorizon(input.horizon);
        }
      }
      closeEditor();
    });
  }

  function closeEditor() {
    const path = editorReturnPath.current;
    editorReturnPath.current = [];
    setEditorVisible(false);
    if (path.length) void openDetails(path[path.length - 1], false, path.slice(0, -1));
  }

  function editSelected() {
    if (details) void openEditor(details, null);
  }

  function addChild() {
    if (details) void openEditor(null, details);
  }

  async function toggle(goal: Goal) {
    if (working) return;
    const completed = !goal.completed;
    await perform(async () => {
      await setGoalCompleted(db, goal.id, completed);
      // Goal completion may atomically end its active Focus timer.
      await focus.refresh();
      setDetailStack((items) => items.map((item) => item.id === goal.id ? { ...item, completed } : item));
      setChildren((items) => items.map((item) => item.id === goal.id ? { ...item, completed } : item));
    });
  }

  function confirmArchive(goal: Goal = details!) {
    if (!goal) return;
    Alert.alert(
      'Archive this goal?',
      'The goal and its active next steps will be saved in Archive. You can restore them later.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          onPress: () => void perform(async () => {
            await archiveGoal(db, goal.id);
            void focus.refresh().catch(() => {});
            closeDetails();
          }),
        },
      ],
    );
  }

  const organizeIndex = organizing ? goals.findIndex((item) => item.id === organizing.id) : -1;
  const canReorder = !searching && view === 'focus';
  const canMoveUp = canReorder && organizeIndex > 0 && goals[organizeIndex - 1].completed === organizing?.completed;
  const canMoveDown = canReorder && organizeIndex >= 0 && organizeIndex < goals.length - 1
    && goals[organizeIndex + 1].completed === organizing?.completed;

  const today = new Date();
  const tomorrow = shiftPeriod('day', today, 1);
  const planningChoices = organizing && !organizing.completed ? [
    { label: 'Today', horizon: 'day' as Horizon, periodKey: periodKey('day', today), inbox: false },
    { label: 'Tomorrow', horizon: 'day' as Horizon, periodKey: periodKey('day', tomorrow), inbox: false },
    ...(organizing.repeatRule === 'none' ? [
      { label: 'This week', horizon: 'week' as Horizon, periodKey: periodKey('week', today), inbox: false },
      { label: 'Inbox · no date', horizon: organizing.horizon, periodKey: '', inbox: true },
    ] : []),
  ].filter((choice) => choice.inbox !== organizing.inbox || (!choice.inbox
    && (choice.horizon !== organizing.horizon || choice.periodKey !== organizing.periodKey))) : [];

  function planSelected(destination: (typeof planningChoices)[number]) {
    const goal = organizing;
    if (!goal) return;
    void perform(async () => {
      await planGoal(db, goal.id, destination);
      setOrganizing(null);
      setSearching(false);
      setView(destination.inbox ? 'inbox' : 'focus');
      setHorizon(destination.horizon);
      if (!destination.inbox) setAnchor(dateFromPeriodKey(destination.horizon, destination.periodKey, new Date()));
    });
  }

  function moveSelected(direction: -1 | 1) {
    const goal = organizing;
    setOrganizing(null);
    if (!goal) return;
    void perform(async () => { await moveGoal(db, goal.id, direction); });
  }

  function archiveSelectedFromMenu() {
    const goal = organizing;
    setOrganizing(null);
    if (!goal) return;
    void perform(async () => { await archiveGoal(db, goal.id); void focus.refresh().catch(() => {}); });
  }

  function restoreSelected(goal: Goal) {
    void perform(async () => { await restoreGoal(db, goal.id); });
  }

  async function quickCreate() {
    if (!quickTitle.trim() || writeLock.current) return;
    const capturedTitle = quickTitle;
    await perform(async () => {
      await createGoal(db, { title: capturedTitle, notes: '', horizon, periodKey: view === 'inbox' ? '' : key, inbox: view === 'inbox' });
      setCaptureNotice({ context: listContext, label: `Added to ${view === 'inbox' ? 'Inbox' : caption}.` });
      setQuickTitle((current) => current === capturedTitle ? '' : current);
      quickInput.current?.focus();
    });
  }

  function tools() {
    setToolsVisible(true);
  }
  const showingList = searching || view === 'focus' || view === 'inbox';
  const header = (
    <View>
      <View style={styles.topBar}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.pageTitle, { color: palette.foreground }]}>
            {searching ? 'Search your plans' : view === 'inbox' ? 'Inbox' : view === 'perspective' ? 'Your horizons' : view === 'archive' ? 'Archive' : horizon === 'day' && key === clockDay ? 'Today' : HORIZON_TITLES[horizon]}
          </Text>
          {!searching ? <Text style={[styles.caption, { color: palette.muted }]}>
            {view === 'inbox' ? 'Capture now. Decide when later.' : view === 'perspective' ? 'Daily steps. Longer-term direction.' : view === 'archive' ? 'Saved for another season.' : openGoals.length ? `${caption} · ${openGoals.length} open` : caption}
          </Text> : null}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={searching ? 'Close search' : 'Search all goals and notes'}
          onPress={() => { setSearching(!searching); setSearch(''); }} style={styles.utility}>
          {searching ? <X size={21} color={palette.foreground} strokeWidth={1.8} /> : <Search size={21} color={palette.foreground} strokeWidth={1.8} />}
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Plan tools, archive and data settings" onPress={tools} style={styles.utility}>
          <MoreHorizontal size={23} color={palette.foreground} strokeWidth={1.8} />
        </Pressable>
      </View>
      {!searching ? <View style={styles.spectrum}><HorizonSpectrum palette={palette} active={view === 'focus' ? horizon : undefined}
          onSelect={(target) => { setView('focus'); setHorizon(target); }} /></View> : null}
      {searching ? <TextInput autoFocus value={search} onChangeText={setSearch} placeholder="Search goals, notes or parent goals"
        accessibilityLabel="Search goals and notes" placeholderTextColor={palette.muted}
        style={[styles.searchInput, { color: palette.foreground, backgroundColor: palette.surface, borderColor: palette.border }]} /> : <>
        <View style={[styles.modes, { backgroundColor: palette.inset }]}>
          {(['focus', 'perspective', 'inbox'] as const).map((mode) => <Pressable key={mode} accessibilityRole="tab"
            accessibilityState={{ selected: view === mode }} onPress={() => setView(mode)}
            style={[styles.modeTab, view === mode && { backgroundColor: palette.surface, boxShadow: palette === colors.dark ? depth.dark.control : depth.light.control }]}>
            <Text style={{ color: view === mode ? palette.foreground : palette.muted, fontSize: 13, fontWeight: view === mode ? '600' : '500' }}>
              {mode === 'focus' ? 'Your plan' : mode === 'perspective' ? 'Horizons' : 'Inbox'}
            </Text>
          </Pressable>)}
        </View>
        {view === 'focus' ? <>
          <View style={styles.periodRow}>
            <Pressable accessibilityRole="button" accessibilityLabel={`Planning horizon: ${HORIZON_TITLES[horizon]}. Change horizon`}
              onPress={() => setHorizonsVisible(true)} style={[styles.horizonSelect, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: palette.horizon[horizon] }} />
              <Text style={[styles.horizonChipText, { color: palette.foreground }]}>{HORIZON_TITLES[horizon]}</Text>
              <ChevronDown size={14} color={palette.muted} />
            </Pressable>
            <View style={{ flex: 1 }} />
            {horizon !== 'life' ? <><Pressable accessibilityRole="button" accessibilityLabel="Previous period"
              onPress={() => setAnchor((date) => shiftPeriod(horizon, date, -1))} style={styles.utility}>
              <ChevronLeft size={21} color={palette.foreground} strokeWidth={1.8} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Next period"
              onPress={() => setAnchor((date) => shiftPeriod(horizon, date, 1))} style={styles.utility}>
              <ChevronRight size={21} color={palette.foreground} strokeWidth={1.8} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Return to current period" onPress={() => setAnchor(new Date())} style={styles.utility}>
              <Text style={{ color: palette.accent, fontSize: 12, fontWeight: '700' }}>Now</Text>
            </Pressable></> : null}
          </View>
        </> : null}
      </>}
      {showingList && !searching && !waitingForList && !failure && goals.length > 0 && openGoals.length === 0 ?
        <View style={[styles.planSummary, { borderColor: palette.border }]}>
          <Text style={[styles.summaryText, { color: palette.foreground }]}>Room to breathe.</Text>
          <Text style={[styles.summaryDetail, { color: palette.muted }]}>Everything planned here is done. Leave some space for yourself.</Text>
        </View> : null}
      {!showingList && view === 'perspective' ? <PerspectiveView sections={perspectiveSections} palette={palette}
        loading={perspectiveLoading} error={perspectiveError} onRetry={() => setPerspectiveRevision((n) => n + 1)}
        onOpenHorizon={focusHorizon} onOpenGoal={(goal) => void openDetails(goal)} onAddGoal={openCreateForHorizon} />
      : !showingList ? <ArchiveView items={archivedGoals} palette={palette} loading={archiveLoading} error={archiveError} disabled={working}
        onRestore={restoreSelected} onRetry={() => setArchiveRevision((n) => n + 1)} /> : null}
    </View>
  );

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: palette.background, paddingBottom: dockInset }]} edges={['top', 'left', 'right']}>
      <SectionList
        sections={!showingList || waitingForList || failure || goals.length === 0 ? [] : searching ? [{ title: 'Matching goals', completed: false, data: goals }] : [
          ...(openGoals.length ? [{ title: view === 'inbox' ? 'To sort when you’re ready' : 'Next up', completed: false, data: openGoals }] : []),
          ...(doneGoals.length ? [{ title: 'Completed', completed: true, data: showCompleted ? doneGoals : [] }] : []),
        ]}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => section.completed ? (
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: showCompleted }}
            accessibilityLabel={`${showCompleted ? 'Hide' : 'Show'} ${doneGoals.length} completed goals`}
            onPress={() => setExpandedCompletedFor(showCompleted ? null : listContext)}
            style={[styles.completedHeader, { borderTopColor: palette.border }]}>
            <Check size={17} color={palette.accent} />
            <Text style={[styles.sectionTitle, { color: palette.muted, flex: 1 }]}>Completed · {doneGoals.length}</Text>
            {showCompleted ? <ChevronDown size={18} color={palette.muted} /> : <ChevronRight size={18} color={palette.muted} />}
          </Pressable>
        ) : section.data.length && view === 'inbox' ? <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: palette.foreground }]}>{section.title}</Text>
          <Text style={[styles.sectionCount, { color: palette.muted }]}>{section.data.length}</Text>
        </View> : null}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <GoalCard
            goal={item}
            palette={palette}
            disabled={working}
            revision={revision}
            showContext={searching}
            onOpen={(goal) => void openDetails(goal)}
            onToggle={(goal) => void toggle(goal)}
            onOrganize={() => { Keyboard.dismiss(); setOrganizing(item); }}
          />
        )}
        ListHeaderComponent={header}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={!showingList ? undefined : (
          waitingForList ? (
            <ActivityIndicator color={palette.accent} size="large" style={styles.wait} />
          ) : failure ? (
            <View style={styles.empty}>
              {!searching ? <View style={[styles.emptyEmblem, { backgroundColor: palette.accentSoft }]}>
                {view === 'inbox' ? <Inbox size={28} color={palette.accent} strokeWidth={1.8} /> : <Layers3 size={28} color={palette.accent} strokeWidth={1.8} />}
              </View> : null}
              <Text style={[styles.emptyTitle, { color: palette.foreground }]}>Couldn't load this horizon</Text>
              <Text style={[styles.emptyBody, { color: palette.muted }]}>{failure}</Text>
              <Pressable onPress={() => setRevision((value) => value + 1)} accessibilityRole="button">
                <Text style={[styles.retry, { color: palette.accent }]}>Try again</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.empty}>
              {!searching ? <View style={[styles.emptyEmblem, { backgroundColor: palette.accentSoft }]}>{view === 'inbox' ? <Inbox size={28} color={palette.accent} strokeWidth={1.8} /> : <Layers3 size={28} color={palette.accent} strokeWidth={1.8} />}</View> : null}
              <Text style={[styles.emptyTitle, { color: palette.foreground }]}>{searching ? 'No matching goals.' : view === 'inbox' ? 'A place for your next idea.' : 'A clear space to begin.'}</Text>
              <Text style={[styles.emptyBody, { color: palette.muted }]}>{searching ? 'Try another word from a title or note.' : 'Add one goal below. You can add the details later.'}</Text>
              {!searching && view === 'focus' ? <Pressable accessibilityRole="button"
                accessibilityLabel="Choose an editable guided plan to start your goals"
                onPress={() => setGuidedVisible(true)}
                style={[styles.guidedPrompt, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                <BookOpenCheck size={19} color={palette.accent} strokeWidth={1.8} />
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={{ color: palette.foreground, fontWeight: '700', fontSize: 13 }}>Start with a guided plan</Text>
                  <Text style={{ color: palette.muted, fontSize: 11, lineHeight: 17 }}>
                    A meaningful goal with flexible steps you can edit or schedule.
                  </Text>
                </View>
                <ChevronRight size={17} color={palette.accent} />
              </Pressable> : null}
            </View>
          )
        )}
      />
      {showingList && !searching ? <View>
        {captureNotice?.context === listContext || view === 'inbox' || !(horizon === 'day' && key === clockDay) ?
          <Text accessibilityLiveRegion="polite" style={[styles.captureContext, { color: palette.muted }]}>{captureNotice?.context === listContext ? captureNotice.label : (view === 'inbox' ? 'INBOX · no date needed' : `ADDING TO · ${caption}`)}</Text> : null}
        <View style={[styles.quickBar, { borderColor: palette.border, backgroundColor: palette.surface, boxShadow: palette === colors.dark ? depth.dark.float : depth.light.float }]}>
          <TextInput ref={quickInput} value={quickTitle} onChangeText={(value) => { setQuickTitle(value); setCaptureNotice(null); }} maxLength={180}
            placeholder={view === 'inbox' ? 'Get it off your mind…' : 'One thing for now…'}
            placeholderTextColor={palette.muted} accessibilityLabel="Quick goal title" returnKeyType="done" blurOnSubmit={false}
            onSubmitEditing={() => { void quickCreate(); }} style={[styles.quickField, { color: palette.foreground }]} />
          <Pressable accessibilityRole="button" accessibilityLabel="Save quick goal" accessibilityState={{ disabled: working || !quickTitle.trim() }} disabled={working || !quickTitle.trim()}
            onPress={() => { void quickCreate(); }} style={styles.quickSave}>
            <View style={[styles.quickSaveIcon, { backgroundColor: quickTitle.trim() && !working ? palette.accent : palette.inset }]}>
              <Plus size={21} color={quickTitle.trim() && !working ? palette.onAccent : palette.muted} strokeWidth={1.8} />
            </View>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Create goal with details" onPress={openCreate} style={styles.detailsAction}>
            <Text style={{ color: palette.accent, fontSize: 12, fontWeight: '600' }}>Details</Text>
          </Pressable>
        </View>
      </View> : null}
      <Modal visible={horizonsVisible} transparent statusBarTranslucent navigationBarTranslucent animationType={reducedMotion ? 'none' : 'fade'} onRequestClose={() => setHorizonsVisible(false)}>
        <SafeAreaProvider><View style={styles.organizeOverlay}>
          <Pressable style={StyleSheet.absoluteFill} accessibilityLabel="Close horizon selection" onPress={() => setHorizonsVisible(false)} />
          <SafeAreaView edges={['bottom']} style={[styles.organizePanel, { backgroundColor: palette.background }]}>
            <View style={[styles.grabber, { backgroundColor: palette.border }]} />
            <Text style={[styles.organizeTitle, { color: palette.foreground }]}>Choose your horizon</Text>
            {HORIZONS.map((item) => <Pressable key={item} accessibilityRole="button" accessibilityState={{ selected: horizon === item }}
              onPress={() => { setHorizon(item); setHorizonsVisible(false); }}
              style={[styles.horizonOption, { backgroundColor: horizon === item ? palette.accentSoft : palette.surface, borderColor: horizon === item ? palette.accent : palette.border }]}>
              <Text style={{ color: palette.foreground, fontSize: 15, fontWeight: '600', minWidth: 70 }}>{HORIZON_TITLES[item]}</Text>
              <Text style={{ color: palette.muted, fontSize: 12, flex: 1 }}>{periodLabel(item, anchor)}</Text>
              {horizon === item ? <Check size={18} color={palette.accent} /> : <ChevronRight size={17} color={palette.muted} />}
            </Pressable>)}
          </SafeAreaView>
        </View></SafeAreaProvider>
      </Modal>
      <Modal visible={toolsVisible} transparent statusBarTranslucent navigationBarTranslucent animationType={reducedMotion ? 'none' : 'fade'} onRequestClose={() => setToolsVisible(false)}>
        <SafeAreaProvider><View style={styles.organizeOverlay}>
          <Pressable style={StyleSheet.absoluteFill} accessibilityLabel="Close Plan tools" onPress={() => setToolsVisible(false)} />
          <SafeAreaView edges={['bottom']} style={[styles.organizePanel, { backgroundColor: palette.background }]}>
            <View style={[styles.grabber, { backgroundColor: palette.border }]} />
            <Text style={[styles.organizeTitle, { color: palette.foreground }]}>Your workspace</Text>
            <Pressable accessibilityRole="button" onPress={() => { setToolsVisible(false); router.push('/settings'); }} style={[styles.organizeAction, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <Settings2 size={20} color={palette.accent} strokeWidth={1.8} />
              <Text style={[styles.organizeActionText, { color: palette.foreground }]}>Your data & settings</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => { setToolsVisible(false); setGuidedVisible(true); }}
              style={[styles.organizeAction, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <BookOpenCheck size={20} color={palette.accent} strokeWidth={1.8} />
              <Text style={[styles.organizeActionText, { color: palette.foreground }]}>Guided plans · start a path</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => { setToolsVisible(false); setSearching(false); setView('archive'); }} style={[styles.organizeAction, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <Archive size={20} color={palette.muted} strokeWidth={1.8} />
              <Text style={[styles.organizeActionText, { color: palette.foreground }]}>Archived goals</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => setToolsVisible(false)} style={styles.organizeCancel}><Text style={[styles.organizeCancelText, { color: palette.muted }]}>Close</Text></Pressable>
          </SafeAreaView>
        </View></SafeAreaProvider>
      </Modal>
      <Modal visible={organizing !== null} transparent statusBarTranslucent navigationBarTranslucent animationType={reducedMotion ? 'none' : 'fade'}
        onRequestClose={() => setOrganizing(null)}>
        <SafeAreaProvider>
        <View style={styles.organizeOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOrganizing(null)}
            accessibilityLabel="Close organization menu" />
          <SafeAreaView edges={['bottom']} style={[styles.organizePanel, { backgroundColor: palette.background, maxHeight: '90%' }]}>
            <ScrollView contentContainerStyle={{ gap: 10 }}>
            <Text style={[styles.organizeTitle, { color: palette.foreground }]}>Organize goal</Text>
            <Text numberOfLines={2} style={[styles.organizeSubtitle, { color: palette.muted }]}>
              {organizing?.title}
            </Text>
            {planningChoices.length ? <>
              <Text style={{ color: palette.muted, fontSize: 13 }}>Move plan · deadlines and calendar times stay as set</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {planningChoices.map((choice) => <Pressable key={choice.label} accessibilityRole="button"
                  accessibilityLabel={`Move plan to ${choice.label}`} disabled={working}
                  onPress={() => planSelected(choice)} style={[styles.organizeAction, { flexBasis: '47%', flexGrow: 1,
                    backgroundColor: palette.surface, borderColor: palette.border }]}>
                  <Text style={[styles.organizeActionText, { color: palette.foreground }]}>{choice.label}</Text>
                </Pressable>)}
              </View>
            </> : null}
            {organizing && !organizing.completed ? <Pressable accessibilityRole="button" disabled={working || focus.busy}
              onPress={() => { if (organizing) startGoalFocus(organizing, 25); }}
              style={[styles.organizeAction, { backgroundColor: palette.accentSoft, borderColor: palette.border }]}>
              <Clock3 size={20} color={palette.accent} /><Text style={[styles.organizeActionText, { color: palette.accent }]}>Focus · 25 min</Text>
            </Pressable> : null}
            {canMoveUp ? (
              <Pressable accessibilityRole="button" onPress={() => moveSelected(-1)}
                style={[styles.organizeAction, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                <Text style={[styles.organizeActionText, { color: palette.foreground }]}>↑  Move up</Text>
              </Pressable>
            ) : null}
            {canMoveDown ? (
              <Pressable accessibilityRole="button" onPress={() => moveSelected(1)}
                style={[styles.organizeAction, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                <Text style={[styles.organizeActionText, { color: palette.foreground }]}>↓  Move down</Text>
              </Pressable>
            ) : null}
            <Pressable accessibilityRole="button" onPress={archiveSelectedFromMenu}
              style={[styles.organizeAction, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <Text style={[styles.organizeActionText, { color: palette === colors.dark ? semantic.dark.danger : semantic.light.danger }]}>↘  Archive goal and next steps</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => setOrganizing(null)}
              style={styles.organizeCancel}>
              <Text style={[styles.organizeCancelText, { color: palette.muted }]}>Cancel</Text>
            </Pressable>
            </ScrollView>
          </SafeAreaView>
        </View>
        </SafeAreaProvider>
      </Modal>
      <GoalDetails
        goal={details}
        children={children}
        ancestors={ancestors}
        palette={palette}
        onClose={closeDetails}
        onBack={backToParent}
        canGoBack={detailStack.length > 1}
        onOpenChild={(child) => void openDetails(child, true)}
        onOpenAncestor={(goal) => void openDetails(goal)}
        onEdit={editSelected}
        onAddStep={addChild}
        onToggle={(goal) => void toggle(goal)}
        onArchive={() => confirmArchive()}
        onSchedule={() => {
          if (!details) return;
          const goalId = details.id;
          closeDetails();
          router.push({ pathname: '/calendar', params: { goalId } });
        }}
        onFocus={focusSelected}
        focusing={focus.busy}
      />
      <GuidedPlansSheet visible={guidedVisible} palette={palette} busy={working}
        onClose={() => { if (!working) setGuidedVisible(false); }}
        onCreate={(templateId, title) => {
          void perform(async () => {
            const rootId = await createGuidedPlan(db, templateId, title);
            const root = await getGoal(db, rootId);
            if (!root) throw new Error('Could not open the created guided plan.');
            setGuidedVisible(false);
            setSearching(false);
            setView('focus');
            setHorizon(root.horizon);
            setAnchor(new Date());
            await openDetails(root);
          });
        }} />
      <GoalEditor
        visible={editorVisible}
        initial={editing}
        draftTitle={editorDraftTitle}
        parent={parent}
        parentOptions={parentOptions}
        defaultInbox={editorContext.inbox}
        defaultHorizon={editorContext.horizon}
        anchorDate={editorContext.anchor}
        palette={palette}
        saving={working}
        onDismiss={() => { if (!writeLock.current) closeEditor(); }}
        onSave={saveGoal}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  guidedPrompt: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 70,
    padding: 14, borderRadius: radius.lg, borderWidth: 1, marginTop: 10 },
  organizeOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: scrim },
  organizePanel: { padding: spacing.lg, paddingBottom: 35, borderTopLeftRadius: 28, borderTopRightRadius: 28, gap: 10 },
  grabber: { width: 36, height: 4, borderRadius: 4, alignSelf: 'center', marginBottom: 10 },
  horizonOption: { minHeight: 54, borderWidth: 1, borderRadius: radius.md, flexDirection: 'row', gap: 10, alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8 },
  organizeTitle: { ...type.title },
  organizeSubtitle: { fontSize: 13, lineHeight: 20, marginBottom: 12 },
  organizeAction: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingVertical: 12, borderRadius: radius.lg, borderWidth: 1 },
  organizeActionText: { fontSize: 15, fontWeight: '600', flexShrink: 1 },
  organizeCancel: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 5 },
  organizeCancelText: { fontSize: 14, fontWeight: '600' },
  screen: { flex: 1 },
  listContent: { paddingHorizontal: 20, paddingBottom: 28, flexGrow: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 0, paddingTop: 12, paddingBottom: 16 },
  pageTitle: { ...type.display },
  spectrum: { marginBottom: 4, marginTop: -8 },
  caption: { fontSize: 13, lineHeight: 20, marginTop: 6 },
  utility: { minHeight: 48, minWidth: 48, alignItems: 'center', justifyContent: 'center' },
  modes: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 20, marginBottom: 16 },
  modeTab: { flex: 1, minHeight: 48, justifyContent: 'center', alignItems: 'center', borderRadius: 16, paddingHorizontal: 8, paddingVertical: 8 },
  horizonSelect: { minHeight: 48, paddingHorizontal: 14, borderRadius: radius.full, alignItems: 'center', flexDirection: 'row', gap: 8, borderWidth: 1 },
  horizonChipText: { fontSize: 13, fontWeight: '600' },
  periodRow: { flexDirection: 'row', alignItems: 'center', gap: 0, paddingVertical: 2, marginBottom: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginTop: 14, marginBottom: 14 },
  sectionTitle: { ...type.label },
  planSummary: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 16, paddingBottom: 4, gap: 4 },
  summaryText: { fontSize: 17, lineHeight: 25, fontWeight: '600', letterSpacing: -.25 },
  summaryDetail: { fontSize: 13, lineHeight: 20 },
  completedHeader: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 9, borderTopWidth: StyleSheet.hairlineWidth, marginTop: 14, paddingVertical: 12 },
  captureContext: { fontSize: 11, lineHeight: 17, marginHorizontal: 24, marginTop: 8 },
  detailsAction: { minWidth: 48, minHeight: 48, paddingHorizontal: 8, justifyContent: 'center', alignItems: 'center' },
  sectionCount: { fontSize: 12 },
  searchInput: { borderWidth: 1, borderRadius: radius.md, minHeight: 50, paddingHorizontal: 14, marginBottom: 8 },
  quickBar: { flexDirection: 'row', alignItems: 'center', gap: 2, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.full, marginHorizontal: 20, marginBottom: 12, marginTop: 8, paddingLeft: 16, paddingRight: 5, paddingVertical: 4 },
  quickField: { flex: 1, minWidth: 0, minHeight: 48, fontSize: 14 },
  quickSave: { minWidth: 48, minHeight: 48, justifyContent: 'center', alignItems: 'center' },
  quickSaveIcon: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
  empty: { paddingTop: 36, paddingBottom: 25, alignItems: 'center', gap: 13, paddingHorizontal: spacing.md },
  emptyEmblem: { width: 72, height: 72, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 5 },
  emptyTitle: { ...type.heading, textAlign: 'center' },
  emptyBody: { fontSize: 13, lineHeight: 21, textAlign: 'center', maxWidth: 270 },
  wait: { marginTop: 60 },
  retry: { padding: 10, fontWeight: '700', fontSize: 14 },
});

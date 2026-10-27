import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'expo-router';
import { useEvridaDatabase } from '../../storage/use-database';
import { getGoalPath } from '../../storage/goals';
import { AppState, Alert, Keyboard, Linking, Modal, Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { getFocusRemainingMs, formatFocusTime } from '../../domain/focus';
import { useFocusSession } from '../focus/FocusProvider';
import { motion } from '../../theme/motion';
import { colors, radius, semantic, scrim } from '../../theme/tokens';
import { useReducedMotion } from '../../theme/useReducedMotion';
import CalendarDays from 'lucide-react-native/icons/calendar-days';
import ChartNoAxesCombined from 'lucide-react-native/icons/chart-no-axes-combined';
import LayoutGrid from 'lucide-react-native/icons/layout-grid';
import ListTodo from 'lucide-react-native/icons/list-todo';
import Timer from 'lucide-react-native/icons/timer';
import Pause from 'lucide-react-native/icons/pause';
import Play from 'lucide-react-native/icons/play';

const routes = [
  { path: '/', label: 'Plan', icon: ListTodo },
  { path: '/calendar', label: 'Calendar', icon: CalendarDays },
  { path: '/boards', label: 'Boards', icon: LayoutGrid },
  { path: '/insights', label: 'Review', icon: ChartNoAxesCombined },
] as const;

/** The selected destination's pill grows in from the center instead of switching on. */
function NavPill({ selected, color, reduced }: { selected: boolean; color: string; reduced: boolean }) {
  const progress = useSharedValue(selected ? 1 : 0);
  useEffect(() => { progress.value = reduced ? (selected ? 1 : 0) : withTiming(selected ? 1 : 0, { duration: motion.base }); }, [selected, reduced, progress]);
  const style = useAnimatedStyle(() => ({ opacity: progress.value, transform: [{ scaleX: 0.55 + 0.45 * progress.value }] }));
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: color, borderRadius: 16 }, style]} />;
}

export function AppDock() {
  const reducedMotion = useReducedMotion();
  const router = useRouter();
  const db = useEvridaDatabase();
  const pathname = usePathname();
  const palette = useColorScheme() === 'dark' ? colors.dark : colors.light;
  const { session, busy, error, notificationNotice, pause, resume, finish, refresh } = useFocusSession();
  const [clock, setClock] = useState(() => Date.now());
  const [expanded, setExpanded] = useState(false);
  const [goalPath, setGoalPath] = useState<string[]>([]);
  const [typing, setTyping] = useState(() => Keyboard.isVisible());
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setTyping(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setTyping(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  useEffect(() => {
    setClock(Date.now());
    if (!session || session.status !== 'running') return;
    const timer = setInterval(() => setClock(Date.now()), 1000);
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') setClock(Date.now());
    });
    return () => { clearInterval(timer); listener.remove(); };
  }, [session?.status, session?.deadlineMs, session?.blockId]);
  useEffect(() => { if (!session) setExpanded(false); }, [session]);
  useEffect(() => {
    if (!session?.goalId) { setGoalPath([]); return; }
    let mounted = true;
    void getGoalPath(db, session.goalId).then((path) => {
      if (mounted) setGoalPath(path);
    }).catch(() => { if (mounted) setGoalPath([]); });
    return () => { mounted = false; };
  }, [db, session?.goalId]);
  // A block may be removed or its goal archived from another page.
  useEffect(() => {
    void refresh().catch(() => {});
  }, [pathname, refresh]);
  const remaining = session ? getFocusRemainingMs(session, clock) : 0;
  const finished = !!session && remaining <= 0;

  function onStop() {
    Alert.alert('End this focus session?', 'This stops the timer. Your original goal and scheduled Timebox stay unchanged.', [
      { text: 'Keep focusing', style: 'cancel' },
      { text: 'End session', style: 'destructive', onPress: () => {
        void finish().then(() => setExpanded(false))
          .catch((error: unknown) => Alert.alert('Could not end session', error instanceof Error ? error.message : 'Try again.'));
      } },
    ]);
  }
  function run(action: () => Promise<void>) {
    void action().catch((error: unknown) =>
      Alert.alert('Focus timer', error instanceof Error ? error.message : 'Try again.'));
  }

  return (
    <>
      <SafeAreaView edges={['bottom']} style={[styles.dock, { backgroundColor: palette.surface, borderTopColor: palette.border }, typing && { display: 'none' }]}>
        {error ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Retry loading focus timer"
            onPress={() => { void refresh().catch(() => {}); }}
            style={[styles.loadError, { borderColor: palette.border, backgroundColor: palette.surface }]}>
            <Text numberOfLines={1} style={[styles.loadErrorText, { color: palette.foreground }]}>
              Focus unavailable · Tap to retry
            </Text>
          </Pressable>
        ) : null}
        {!error && session ? (
          <Pressable accessibilityRole="button" accessibilityLabel={`Open focus timer for ${session.goalTitle}`}
            onPress={() => setExpanded(true)}
            style={[styles.miniTimer, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <View style={[styles.timerIcon, { backgroundColor: palette.accentSoft }]}><Timer size={20} color={palette.accent} strokeWidth={1.8} /></View>
            <View style={styles.sessionCopy}>
              <Text numberOfLines={1} style={[styles.miniTitle, { color: palette.foreground }]}>
                {finished ? "Time's up · " : session.status === 'paused' ? 'Paused · ' : 'Focusing · '}{session.goalTitle}
              </Text>
              <Text numberOfLines={1} style={[styles.miniCaption, { color: palette.muted }]}>
                {notificationNotice && session.status === 'running' && !finished ? 'Background alert unavailable' :
                  finished ? 'Review your progress' : session.status === 'paused' ? 'Tap to resume or end' : 'Tap to pause or end'}
              </Text>
            </View>
            <Text style={[styles.miniClock, { color: finished ? (palette === colors.dark ? semantic.dark.warning : semantic.light.warning) : palette.accent }]}>
              {formatFocusTime(remaining)}
            </Text>
          </Pressable>
        ) : null}
        <View style={styles.navigation}>
          {routes.map((route) => {
            const selected = pathname === route.path || (route.path === '/' && pathname === '/settings');
            return (
              <Pressable key={route.path} accessibilityRole="tab"
                accessibilityState={{ selected }}
                accessibilityLabel={route.label}
                onPress={() => { if (pathname !== route.path) router.navigate(route.path); }}
                style={styles.navItem}>
                <View style={styles.navIndicator}>
                  <NavPill selected={selected} color={palette.accentSoft} reduced={reducedMotion} />
                  <route.icon size={22} strokeWidth={selected ? 2 : 1.7} color={selected ? palette.accent : palette.muted} />
                </View>
                <Text style={[styles.navLabel, { color: selected ? palette.foreground : palette.muted, fontWeight: selected ? '700' : '500' }]}>
                  {route.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </SafeAreaView>
      <Modal visible={expanded && !!session} transparent animationType={reducedMotion ? 'none' : 'fade'}
        statusBarTranslucent navigationBarTranslucent onRequestClose={() => setExpanded(false)}>
        <SafeAreaProvider>
          <View style={styles.overlay}>
            <Pressable style={StyleSheet.absoluteFill} accessibilityLabel="Close focus details" onPress={() => setExpanded(false)} />
            <SafeAreaView edges={['bottom']} style={[styles.panel, { backgroundColor: palette.background }]}>
              <View style={[styles.grabber, { backgroundColor: palette.border }]} />
              <Text style={[styles.eyebrow, { color: palette.accent }]}>YOUR FOCUS SESSION</Text>
              <Text numberOfLines={2} style={[styles.goalTitle, { color: palette.foreground }]}>{session?.goalTitle}</Text>
              {goalPath.length > 1 ? <Text numberOfLines={2} style={[styles.goalPath, { color: palette.muted }]}>
                {goalPath.slice(0, -1).join('  /  ')}  →  {session?.goalTitle}
              </Text> : null}
              {session?.goalId ? <Pressable accessibilityRole="button"
                accessibilityLabel="Open focus goal and its long-term path in Plan"
                onPress={() => {
                  setExpanded(false);
                  router.push({ pathname: '/', params: { goalId: session.goalId } });
                }} style={styles.pathAction}>
                <Text style={{ color: palette.accent, fontWeight: '700', fontSize: 12 }}>
                  See this step in your goal path →
                </Text>
              </Pressable> : null}
              <Text style={[styles.clock, { color: finished ? (palette === colors.dark ? semantic.dark.warning : semantic.light.warning) : palette.foreground }]}>
                {formatFocusTime(remaining)}
              </Text>
              <Text style={[styles.explainer, { color: palette.muted }]}>
                {finished ? 'Your timebox has ended. Decide whether to mark the goal complete in Plan.' :
                  session?.status === 'paused' ? 'Time is paused. Resume when you are ready.' :
                    'Focus is saved across app restarts. Manual device-clock changes can affect timing; the OS may delay background alerts.'}
              </Text>
              {notificationNotice && !finished && session?.status === 'running' ? (
                <View style={styles.noticeSection}>
                  <Text style={[styles.warning, { color: palette === colors.dark ? semantic.dark.warning : semantic.light.warning }]}>{notificationNotice}</Text>
                  <Pressable accessibilityRole="button" accessibilityLabel="Open system app settings"
                    onPress={() => { void Linking.openSettings().catch(() =>
                      Alert.alert('Settings unavailable', 'Open your device settings and choose Evrida → Notifications.')); }}
                    style={[styles.settingsButton, { borderColor: palette.border }]}>
                    <Text style={[styles.settingsText, { color: palette.accent }]}>Open app settings</Text>
                  </Pressable>
                </View>
              ) : null}
              <View style={styles.controls}>
                {!finished ? (
                  <Pressable disabled={busy} accessibilityRole="button"
                    accessibilityLabel={session?.status === 'paused' ? 'Resume focus timer' : 'Pause focus timer'}
                    onPress={() => run(session?.status === 'paused' ? resume : pause)}
                    style={[styles.primary, { backgroundColor: palette.accent }]}>
                    {session?.status === 'paused' ? <Play size={18} color={palette.onAccent} /> : <Pause size={18} color={palette.onAccent} />}
                    <Text style={[styles.primaryText, { color: palette.onAccent }]}>{session?.status === 'paused' ? 'Resume' : 'Pause'}</Text>
                  </Pressable>
                ) : null}
                <Pressable disabled={busy} accessibilityRole="button" onPress={finished ? () => run(finish) : onStop}
                  style={[styles.secondary, { borderColor: palette.border, backgroundColor: palette.surface }]}>
                  <Text style={[styles.secondaryText, { color: palette.foreground }]}>
                    {finished ? 'Finish session' : 'End'}
                  </Text>
                </Pressable>
              </View>
              <Pressable accessibilityRole="button" onPress={() => setExpanded(false)} style={styles.close}>
                <Text style={[styles.closeText, { color: palette.muted }]}>Back to planning</Text>
              </Pressable>
            </SafeAreaView>
          </View>
        </SafeAreaProvider>
      </Modal>
    </>
  );
}
const styles = StyleSheet.create({
  dock: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8 },
  timerIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  loadError: { marginHorizontal: 13, marginBottom: 6, borderRadius: radius.md, minHeight: 48,
    paddingHorizontal: 13, borderWidth: 1, justifyContent: 'center' },
  loadErrorText: { fontSize: 12, fontWeight: '600' },
  miniTimer: { minHeight: 58, marginHorizontal: 13, marginBottom: 6, paddingHorizontal: 14, borderRadius: radius.lg, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  sessionCopy: { flex: 1, gap: 4 },
  miniTitle: { fontSize: 13, fontWeight: '700' },
  miniCaption: { fontSize: 11 },
  miniClock: { fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] },
  navigation: { minHeight: 63, flexDirection: 'row', alignItems: 'center' },
  navItem: { flex: 1, minHeight: 58, alignItems: 'center', justifyContent: 'center', gap: 3 },
  navIndicator: { width: 64, height: 32, borderRadius: 16, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  navLabel: { fontSize: 11, marginTop: 2, fontWeight: '600' },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: scrim },
  panel: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 25, paddingTop: 15, paddingBottom: 12 },
  grabber: { width: 38, height: 4, alignSelf: 'center', borderRadius: 3, marginBottom: 24 },
  eyebrow: { fontSize: 10, letterSpacing: 1.5, fontWeight: '800', marginBottom: 10 },
  goalTitle: { fontSize: 20, fontWeight: '700', lineHeight: 27 },
  goalPath: { fontSize: 12, lineHeight: 20, marginTop: 6 },
  pathAction: { minHeight: 48, alignItems: 'flex-start', justifyContent: 'center' },
  clock: { fontSize: 58, fontWeight: '800', textAlign: 'center', marginTop: 24, fontVariant: ['tabular-nums'], letterSpacing: -1.4 },
  explainer: { fontSize: 13, lineHeight: 21, textAlign: 'center', marginVertical: 21 },
  noticeSection: { alignItems: 'center', marginBottom: 13, gap: 4 },
  warning: { fontSize: 12, lineHeight: 18, textAlign: 'center' },
  settingsButton: { minHeight: 48, minWidth: 140, borderWidth: 1, borderRadius: radius.full,
    paddingHorizontal: 14, justifyContent: 'center', alignItems: 'center' },
  settingsText: { fontSize: 12, fontWeight: '700' },
  controls: { flexDirection: 'row', gap: 10 },
  primary: { flex: 1, minHeight: 55, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  primaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  secondary: { flex: 1, minHeight: 55, borderRadius: radius.lg, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontSize: 15, fontWeight: '700' },
  close: { minHeight: 49, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  closeText: { fontSize: 13, fontWeight: '600' },
});

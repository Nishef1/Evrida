import { useEffect, useMemo, useState } from 'react';
import { AppState, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { colors, type Palette, scrim } from '../../theme/tokens';
import { localClock, type TimeBlock } from '../../domain/timeblocks';
import { previewReplan, type ReplanPreview } from '../../domain/replan';
import { useReducedMotion } from '../../theme/useReducedMotion';
import RefreshCw from 'lucide-react-native/icons/refresh-cw';


interface Props {
  visible: boolean; day: Date; blocks: TimeBlock[]; palette: Palette; busy: boolean; activeBlockId: string | null;
  onClose: () => void; onApply: (preview: ReplanPreview) => void;
}
const clock = (value: string) => localClock(new Date(value));

export function RecoverySheet({ visible, day, blocks, palette, busy, activeBlockId, onClose, onApply }: Props) {
  const reducedMotion = useReducedMotion();
  const [now, setNow] = useState(() => new Date());
  const [clockMs, setClockMs] = useState(() => Date.now());
  const [mode, setMode] = useState<'recover' | 'extend'>('recover');
  const [targetId, setTargetId] = useState('');
  const [minutes, setMinutes] = useState<15 | 30>(15);
  useEffect(() => {
    if (!visible) return;
    setNow(new Date()); setClockMs(Date.now()); setMode('recover'); setTargetId('');
    const interval = setInterval(() => setClockMs(Date.now()), 10000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setClockMs(Date.now());
    });
    return () => { clearInterval(interval); subscription.remove(); };
  }, [visible]);
  const expired = clockMs - now.getTime() > 110000 || clockMs < now.getTime() - 2000;
  const eligible = blocks.filter((b) => b.flexible && b.id !== activeBlockId && !b.goalCompleted && Date.parse(b.endAt) > now.getTime());
  const selected = eligible.find((b) => b.id === targetId) ?? eligible[0];
  const result = useMemo(() => {
    try {
      return { value: previewReplan(blocks, { mode, day, now,
        targetId: selected?.id, extraMinutes: minutes, lockedBlockId: activeBlockId ?? undefined }), error: '' };
    } catch (error) {
      return { value: null, error: error instanceof Error ? error.message : 'Cannot preview this day.' };
    }
  }, [blocks, mode, day, now, selected?.id, minutes, activeBlockId]);
  // Fit the visual shift strip to all affected reservations, not an arbitrary
  // twenty-four hour scale where a 15-minute difference would be invisible.
  const window = useMemo(() => {
    const moves = result.value?.moves ?? [];
    if (!moves.length) return null;
    const earliest = Math.min(...moves.flatMap((item) => [Date.parse(item.fromStart), Date.parse(item.toStart)]));
    const latest = Math.max(...moves.flatMap((item) => [Date.parse(item.fromEnd), Date.parse(item.toEnd)]));
    return { start: earliest - 15 * 60000, end: latest + 15 * 60000 };
  }, [result.value]);
  function bar(startIso: string, endIso: string) {
    if (!window) return { left: '0%' as const, width: '0%' as const };
    const span = window.end - window.start;
    const left = Math.max(0, (Date.parse(startIso) - window.start) / span * 100);
    const width = Math.max(1.8, (Date.parse(endIso) - Date.parse(startIso)) / span * 100);
    return { left: `${left}%` as const, width: `${Math.min(width, 100 - left)}%` as const };
  }
  return <Modal visible={visible} transparent animationType={reducedMotion ? 'none' : 'slide'}
    statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
    <SafeAreaProvider>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => { if (!busy) onClose(); }}
          accessibilityLabel="Close recovery preview" />
        <View style={[styles.sheet, { backgroundColor: palette.background }]}>
          <SafeAreaView edges={['bottom']}>
            <ScrollView contentContainerStyle={styles.content}>
              <Text style={[styles.kicker, { color: palette.accent }]}>TIME · IN MOTION</Text>
              <Text style={[styles.title, { color: palette.foreground }]}>Recover your day</Text>
              <Text style={[styles.caption, { color: palette.muted }]}>
                All changes are previews. Protected reservations, completed work and past time stay untouched.
                Only blocks you've marked Flexible can move.
              </Text>
              <View style={styles.row}>
                {(['recover', 'extend'] as const).map((item) => <Pressable key={item} accessibilityRole="button"
                  accessibilityState={{ selected: mode === item }} onPress={() => setMode(item)}
                  style={[styles.chip, { borderColor: palette.border,
                    backgroundColor: mode === item ? palette.accentSoft : palette.surface }]}>
                  <Text style={{ color: mode === item ? palette.accent : palette.foreground, fontWeight: '700' }}>
                    {item === 'recover' ? 'Reflow today' : 'Extend time'}
                  </Text>
                </Pressable>)}
              </View>
              {mode === 'extend' ? <>
                <Text style={[styles.kicker, { color: palette.muted }]}>CHOOSE A FLEXIBLE BLOCK</Text>
                {!eligible.length ? <Text style={{ color: palette.muted }}>No eligible flexible block. Mark one Flexible in its editor first.</Text> :
                  eligible.map((b) => <Pressable key={b.id} accessibilityRole="radio"
                    accessibilityState={{ checked: selected?.id === b.id }} onPress={() => setTargetId(b.id)}
                    style={[styles.option, { borderColor: selected?.id === b.id ? palette.accent : palette.border,
                      backgroundColor: palette.surface }]}>
                    <Text numberOfLines={2} style={{ color: palette.foreground, flex: 1 }}>{b.goalTitle}</Text>
                    <Text style={{ color: palette.muted, fontSize: 11 }}>{clock(b.startAt)}–{clock(b.endAt)}</Text>
                  </Pressable>)}
                <View style={styles.row}>
                  {([15, 30] as const).map((value) => <Pressable key={value} accessibilityRole="button"
                    accessibilityState={{ selected: minutes === value }} onPress={() => setMinutes(value)}
                    style={[styles.chip, { borderColor: palette.border,
                      backgroundColor: minutes === value ? palette.accentSoft : palette.surface }]}>
                    <Text style={{ color: palette.foreground }}>+{value} min</Text>
                  </Pressable>)}
                </View>
              </> : <Text style={[styles.caption, { color: palette.muted }]}>
                Reflow flexible blocks after a 15-minute buffer, respecting fixed time and existing order.
              </Text>}
              <View style={[styles.preview, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                <View style={[styles.row, { alignItems: 'center', justifyContent: 'space-between' }]}>
                  <Text style={[styles.kicker, { color: palette.muted }]}>
                    {expired ? 'PREVIEW EXPIRED' : result.value?.moves.length ? 'PROPOSED CHANGES · NOT SAVED' : 'PREVIEW · NO CHANGE'}
                  </Text>
                  <Pressable accessibilityRole="button" accessibilityLabel="Refresh recovery preview with current time"
                    disabled={busy} onPress={() => { setNow(new Date()); setClockMs(Date.now()); }}
                    style={styles.refresh}>
                    <RefreshCw size={14} color={palette.accent} strokeWidth={1.8} />
                    <Text style={{ color: palette.accent, fontWeight: '700', fontSize: 12 }}>Refresh</Text>
                  </Pressable>
                </View>
                {expired ? <Text style={[styles.caption, { color: palette.muted }]}>
                  This preview is no longer current. Refresh before applying; past time stays protected.
                </Text> : null}
                {window && result.value?.moves.length ? <View style={styles.visualLegend}>
                  <Text style={[styles.legendText, { color: palette.muted }]}>
                    Before <Text style={{ color: palette.foreground }}>━</Text>   Proposed <Text style={{ color: palette.accent }}>━</Text>
                  </Text>
                  <View style={styles.legendBounds}>
                    <Text style={[styles.caption, { color: palette.muted }]}>
                      {clock(new Date(window.start).toISOString())}
                    </Text>
                    <Text style={[styles.caption, { color: palette.muted }]}>
                      {clock(new Date(window.end).toISOString())}
                    </Text>
                  </View>
                </View> : null}
                {result.error ? <Text style={{ color: palette.foreground }}>{result.error}</Text>
                  : result.value?.moves.length ? result.value.moves.map((move) => <View key={move.id}
                    style={[styles.move, { borderBottomColor: palette.border }]}>
                    <View style={styles.row}>
                      <Text numberOfLines={2} style={{ color: palette.foreground, flex: 1, fontWeight: '700' }}>
                        {blocks.find((b) => b.id === move.id)?.goalTitle}
                      </Text>
                      <Text style={{ color: palette.muted, fontSize: 12 }}>{clock(move.fromStart)} → {clock(move.toStart)}</Text>
                    </View>
                    <View accessible accessibilityRole="summary"
                      accessibilityLabel={`${blocks.find((b) => b.id === move.id)?.goalTitle ?? 'Block'} changes from
                        ${clock(move.fromStart)}–${clock(move.fromEnd)} to ${clock(move.toStart)}–${clock(move.toEnd)}`}
                      style={styles.dualTrack}>
                      <View style={[styles.track, { backgroundColor: palette.inset }]}>
                        <View style={[styles.trackBar, bar(move.fromStart, move.fromEnd),
                          { backgroundColor: palette.muted, opacity: 0.65 }]} />
                      </View>
                      <View style={[styles.track, { backgroundColor: palette.accentSoft }]}>
                        <View style={[styles.trackBar, bar(move.toStart, move.toEnd),
                          { backgroundColor: palette.accent }]} />
                      </View>
                    </View>
                    <Text style={[styles.caption, { color: palette.muted }]}>
                      Proposed {clock(move.toStart)}–{clock(move.toEnd)} · Nothing saved yet
                    </Text>
                  </View>) : <Text style={{ color: palette.muted }}>No changes needed or no flexible blocks to move.</Text>}
                {result.value ? <Text style={[styles.caption, { color: palette.muted }]}>
                  {result.value.protectedCount} protected blocks · ~{result.value.availableMinutes} free min remaining
                </Text> : null}
              </View>
              <View style={styles.row}>
                <Pressable accessibilityRole="button" disabled={busy} onPress={onClose}
                  style={[styles.action, { borderWidth: 1, borderColor: palette.border }]}>
                  <Text style={{ color: palette.foreground, fontWeight: '700' }}>Cancel</Text>
                </Pressable>
                <Pressable accessibilityRole="button" disabled={busy || expired || !result.value?.moves.length}
                  accessibilityState={{ disabled: busy || expired || !result.value?.moves.length }}
                  onPress={() => { if (result.value) onApply(result.value); }}
                  style={[styles.action, { backgroundColor: palette.accent,
                    opacity: busy || expired || !result.value?.moves.length ? 0.4 : 1 }]}>
                  <Text style={{ color: palette.onAccent, fontWeight: '700' }}>{busy ? 'Saving…' : 'Apply preview'}</Text>
                </Pressable>
              </View>
            </ScrollView>
          </SafeAreaView>
        </View>
      </View>
    </SafeAreaProvider>
  </Modal>;
}
const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: scrim },
  sheet: { maxHeight: '94%', borderTopLeftRadius: 27, borderTopRightRadius: 27, overflow: 'hidden' },
  content: { padding: 21, gap: 14, paddingBottom: 20 },
  kicker: { fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  title: { fontSize: 26, fontWeight: '700', letterSpacing: -0.7 },
  caption: { fontSize: 12, lineHeight: 20 },
  row: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  refresh: { minHeight: 48, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 6, paddingHorizontal: 6 },
  chip: { borderWidth: 1, borderRadius: 14, minHeight: 48, paddingHorizontal: 15, justifyContent: 'center' },
  option: { minHeight: 48, borderWidth: 1, borderRadius: 12, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  preview: { borderRadius: 17, padding: 14, borderWidth: 1, gap: 12 },
  move: { minHeight: 86, gap: 8, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth },
  visualLegend: { gap: 3 },
  legendText: { fontSize: 11, fontWeight: '700' },
  legendBounds: { flexDirection: 'row', justifyContent: 'space-between' },
  dualTrack: { gap: 4 },
  track: { height: 9, borderRadius: 5, position: 'relative', overflow: 'hidden' },
  trackBar: { position: 'absolute', height: 9, borderRadius: 5 },
  action: { flex: 1, minHeight: 52, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
});

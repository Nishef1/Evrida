import { useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentRef } from 'react';
import { Alert, AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { blockClockRangeForDay, layoutBlocks, localClock, localDayBounds, localDayKey, peakOverlap, type TimeBlock } from '../../domain/timeblocks';
import { colors, radius, semantic, withAlpha, type Palette } from '../../theme/tokens';
import { getFocusElapsedMs, type FocusSession } from '../../domain/focus';
import { pixelsToQuarterHours, previewTimelineEdit, type TimelineEditMode, type TimelineEditPreview } from '../../domain/timeline-edit';
import ChevronsDown from 'lucide-react-native/icons/chevrons-down';
import GripVertical from 'lucide-react-native/icons/grip-vertical';
import Info from 'lucide-react-native/icons/info';
import Lock from 'lucide-react-native/icons/lock';
import Timer from 'lucide-react-native/icons/timer';



const ZOOM_LEVELS = [56, 76, 104] as const;
const GUTTER = 62;
const HOURS = Array.from({ length: 25 }, (_, i) => i);
/** A block wears the hue of its goal's horizon, so the day reads in the same colors as Plan.
 * Time range, icons and the Timebox outline carry the status; color never does alone. */
function blockTone(block: TimeBlock, palette: Palette): string {
  if (block.goalCompleted) return palette.muted;
  return palette.horizon[block.goalHorizon ?? 'day'];
}
function blockMinutes(block: TimeBlock): string {
  const minutes = Math.round((Date.parse(block.endAt) - Date.parse(block.startAt)) / 60000);
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours}h${minutes % 60 ? ` ${minutes % 60}m` : ''}` : `${minutes}m`;
}
function clockLabel(iso: string) {
  return localClock(new Date(iso));
}
function minOfDay(date: Date) {
  return date.getHours() * 60 + date.getMinutes();
}

interface Props {
  date: Date;
  blocks: TimeBlock[];
  palette: Palette;
  onEdit: (block: TimeBlock) => void;
  onQuickAdd: (hour: number) => void;
  onOpenGoal: (goalId: string) => void;
  actualByBlock: Record<string, number>;
  activeSession: FocusSession | null;
  busy: boolean;
  onApplyTimeEdit: (preview: TimelineEditPreview, onSaved: () => void) => void;
  /** True once the reader scrolls down into the day; false when they scroll back up. */
  onChromeHidden?: (hidden: boolean) => void;
}
export function DayTimeline({ date, blocks, palette, onEdit, onQuickAdd, onOpenGoal, actualByBlock, activeSession, busy, onApplyTimeEdit, onChromeHidden }: Props) {
  const ref = useRef<ComponentRef<typeof ScrollView>>(null);
  const didScroll = useRef<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [zoomIndex, setZoomIndex] = useState(1);
  const hourHeight = ZOOM_LEVELS[zoomIndex];
  const zoomedHeight = useRef<number>(hourHeight);
  const scrollOffset = useRef(0);
  const userScrolled = useRef(false);
  const travel = useRef(0);
  const dragOriginY = useRef(0);
  const [draft, setDraft] = useState<{ id: string; mode: TimelineEditMode; delta: number; sourceRevision?: string } | null>(null);
  const dateKey = localDayKey(date);
  const isToday = localDayKey(now) === dateKey;
  const offset = now.getTimezoneOffset();
  useEffect(() => {
    setNow(new Date());
    const interval = setInterval(() => setNow(new Date()), 60000);
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') setNow(new Date());
    });
    return () => { clearInterval(interval); listener.remove(); };
  }, []);

  const positioned = useMemo(
    () => layoutBlocks(blocks, hourHeight, date),
    [blocks, dateKey, hourHeight, offset],
  );
  const visibleRange = (block: TimeBlock) => blockClockRangeForDay(block, date);
  const editing = draft && blocks.find((block) => block.id === draft.id);
  const candidate = useMemo(() => {
    if (!draft || !editing) return { preview: null as TimelineEditPreview | null, error: '' };
    if (editing.updatedAt !== draft.sourceRevision)
      return { preview: null, error: 'This reservation changed while your preview was open. Cancel and start again.' };
    if (activeSession?.blockId === draft.id) return { preview: null, error: 'End Focus before changing its reserved time.' };
    try {
      return { preview: previewTimelineEdit(editing, blocks, date, draft.mode, draft.delta), error: '' };
    } catch (err) {
      return { preview: null, error: err instanceof Error ? err.message : 'Unable to preview this change.' };
    }
  }, [draft, editing, blocks, dateKey, activeSession?.blockId]);
  useEffect(() => {
    setDraft(null);
    // A fresh day starts with its own programmatic scroll; only a finger counts as reading.
    userScrolled.current = false;
    scrollOffset.current = 0;
  }, [dateKey]);
  const ghost = useMemo(() => {
    if (!candidate.preview || !editing || draft?.delta === 0) return null;
    const proposed = { ...editing, startAt: candidate.preview.toStart, endAt: candidate.preview.toEnd };
    // The proposed placement must reflect existing collisions, not show a misleading full-width block.
    return layoutBlocks([...blocks.filter((block) => block.id !== editing.id), proposed],
      hourHeight, date).find((item) => item.block.id === editing.id) ?? null;
  }, [candidate.preview?.toStart, candidate.preview?.toEnd, editing, blocks, hourHeight, dateKey]);
  function beginDrag(block: TimeBlock, mode: TimelineEditMode, pageY: number) {
    dragOriginY.current = pageY;
    setDraft({ id: block.id, mode, delta: 0, sourceRevision: block.updatedAt });
  }
  function continueDrag(block: TimeBlock, mode: TimelineEditMode, pageY: number) {
    const delta = pixelsToQuarterHours(pageY - dragOriginY.current, hourHeight);
    setDraft((previous) => previous?.id === block.id && previous.mode === mode && previous.delta === delta
      ? previous : { id: block.id, mode, delta, sourceRevision: previous?.id === block.id ? previous.sourceRevision : block.updatedAt });
  }
  const firstHour = positioned.length
    ? Math.max(0, Math.floor(Math.min(...positioned.map((item) => item.top / hourHeight)) - 1))
    : isToday ? Math.max(0, Math.floor(minOfDay(now) / 60) - 2) : 8;

  function jumpToHour(hour: number) {
    ref.current?.scrollTo({ y: Math.max(0, (hour - 0.5) * hourHeight), animated: true });
  }
  function jumpToNow() {
    const minute = minOfDay(new Date());
    ref.current?.scrollTo({ y: Math.max(0, (minute / 60 - 1.25) * hourHeight), animated: true });
    setNow(new Date());
  }

  const ribbon = useMemo(() => {
    const { from, to } = localDayBounds(date);
    const begin = Date.parse(from), end = Date.parse(to), span = end - begin;
    if (span !== 86400000) return null; // DST days use exact List mode rather than misleading compression.
    const laneEnds = [begin, begin, begin];
    return [...blocks].sort((a, b) => a.startAt.localeCompare(b.startAt)).map((block) => {
      const start = Math.max(begin, Date.parse(block.startAt));
      const finish = Math.min(end, Date.parse(block.endAt));
      if (finish <= start) return null;
      let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start);
      if (lane === -1) lane = laneEnds.indexOf(Math.min(...laneEnds));
      laneEnds[lane] = finish;
      return { id: block.id, left: (start - begin) / span * 100,
        width: (finish - start) / span * 100, lane, tone: blockTone(block, palette) };
    }).filter((entry): entry is NonNullable<typeof entry> => entry !== null);
  }, [blocks, dateKey, offset, palette]);
  const dayBounds = localDayBounds(date);
  const ribbonPeak = peakOverlap(blocks, Date.parse(dayBounds.from), Date.parse(dayBounds.to));
  const upcoming = isToday ? [...blocks]
    .filter((block) => Date.parse(block.endAt) > now.getTime())
    .sort((a, b) => a.startAt.localeCompare(b.startAt))[0] : null;
  const recordedMs = Object.values(actualByBlock).reduce((sum, value) => sum + value, 0) +
    (activeSession && blocks.some((b) => b.id === activeSession.blockId)
      ? getFocusElapsedMs(activeSession, now.getTime()) : 0);
  const shade = palette === colors.dark ? 'rgba(130,180,159,0.055)' : 'rgba(88,122,109,0.055)';
  const gridLine = palette === colors.dark ? 'rgba(174,191,179,0.12)' : 'rgba(100,121,111,0.13)';
  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        <Pressable accessibilityRole="button" accessibilityLabel="How to use the timeline"
          onPress={() => Alert.alert('Your timeline', 'Tap an empty hour to reserve time. Tap a block to edit, or hold it to adjust its schedule in 15-minute steps. Long blocks also have drag and resize grips. Nothing moves until you confirm.')}
          style={[styles.toolbarCopy, { minHeight: 48, justifyContent: 'center' }]}>
          <View style={styles.summaryLine}>
            <Text style={[styles.heading, { color: palette.foreground }]}>
              {blocks.length ? `${blocks.length} ${blocks.length === 1 ? 'block' : 'blocks'}` : 'Open day'}
              {recordedMs >= 60000 ? ` · ${Math.floor(recordedMs / 60000)}m focused` : ''}
            </Text>
            <Info size={15} color={palette.muted} strokeWidth={1.8} />
          </View>
        </Pressable>
        <View style={[styles.zoom, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Zoom out of day timeline"
            accessibilityState={{ disabled: zoomIndex === 0 }}
            disabled={zoomIndex === 0}
            onPress={() => setZoomIndex((value) => Math.max(0, value - 1))}
            style={styles.zoomButton}>
            <Text style={[styles.zoomGlyph, { color: zoomIndex === 0 ? palette.muted : palette.foreground }]}>−</Text>
          </Pressable>
          <Text style={[styles.zoomCenter, { color: palette.muted }]}>{zoomIndex + 1}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Zoom in to day timeline"
            accessibilityState={{ disabled: zoomIndex === ZOOM_LEVELS.length - 1 }}
            disabled={zoomIndex === ZOOM_LEVELS.length - 1}
            onPress={() => setZoomIndex((value) => Math.min(ZOOM_LEVELS.length - 1, value + 1))}
            style={styles.zoomButton}>
            <Text style={[styles.zoomGlyph, { color: zoomIndex === ZOOM_LEVELS.length - 1 ? palette.muted : palette.foreground }]}>＋</Text>
          </Pressable>
        </View>
        {isToday ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Jump to the current time"
            onPress={jumpToNow} style={[styles.nowButton, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <View style={[styles.nowDot, { backgroundColor: semantic.timeline.now }]} />
            <Text style={[styles.nowText, { color: palette.foreground }]}>Now</Text>
          </Pressable>
        ) : null}
      </View>

      {ribbon ? <View style={styles.ribbonRegion}>
        {ribbonPeak > 3 ? <Text accessibilityRole="summary"
          style={[styles.ribbonSummary, { color: palette.foreground }]}>
          Peak: {ribbonPeak} simultaneous plans · strip displays 3 layers. Open the full timeline for every overlap.
        </Text> : null}
        {upcoming ? <Text numberOfLines={1} style={[styles.ribbonSummary, { color: palette.muted }]}>
          {`${Date.parse(upcoming.startAt) <= now.getTime() ? 'Happening now' : 'Next up'} · ${upcoming.goalTitle}`}
        </Text> : null}
        <View style={[styles.ribbonTrack, { backgroundColor: palette.inset }]}>
          {ribbon.map((item) => <View pointerEvents="none" key={item.id}
            style={[styles.ribbonBlock, {
              left: `${item.left}%`, width: `${item.width}%`,
              top: 2 + item.lane * 8, backgroundColor: item.tone,
            }]} />)}
          {isToday ? <View pointerEvents="none" style={[styles.ribbonNow, {
            left: `${Math.min(100, minOfDay(now) / 1440 * 100)}%`,
          }]} /> : null}
          {[0, 6, 12, 18].map((hour) => <Pressable key={hour} accessibilityRole="button"
            accessibilityLabel={`Jump to ${String(hour).padStart(2, '0')}:00 in the day timeline`}
            onPress={() => jumpToHour(hour)}
            style={[styles.ribbonJump, { left: `${hour / 24 * 100}%` }]} />)}
        </View>
      </View> : null}
      {draft ? <View style={[styles.adjustPanel, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <View style={styles.adjustTop}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text numberOfLines={1} style={[styles.adjustTitle, { color: palette.foreground }]}>
              {editing?.goalTitle ?? 'Time adjustment'} · {draft.mode === 'move' ? 'Move' : 'Resize'}
            </Text>
            <Text style={[styles.adjustHint, { color: palette.muted }]}>
              {candidate.preview ?
                `${clockLabel(candidate.preview.toStart)}–${clockLabel(candidate.preview.toEnd)}
                ${candidate.preview.conflicts ? ' · ' + candidate.preview.conflicts + ' overlapping' : ' · No collisions'}`
                : candidate.error}
            </Text>
          </View>
          {editing ? <Pressable accessibilityRole="button"
            accessibilityLabel={`Open ${editing.goalTitle} in Plan`}
            onPress={() => { setDraft(null); onOpenGoal(editing.goalId); }}
            style={styles.adjustGoalLink}>
            <Text style={{ color: palette.accent, fontSize: 12, fontWeight: '700' }}>Open goal ↗</Text>
          </Pressable> : null}
          <Pressable accessibilityRole="button" accessibilityLabel="Cancel timeline time adjustment"
            onPress={() => setDraft(null)} style={styles.adjustClose}>
            <Text style={{ color: palette.foreground, fontSize: 20 }}>×</Text>
          </Pressable>
        </View>
        <View style={styles.adjustActions}>
          <Pressable accessibilityRole="button" accessibilityLabel="Change adjustment to move the whole block"
            accessibilityState={{ selected: draft.mode === 'move' }}
            onPress={() => setDraft({ ...draft, mode: 'move', delta: 0 })}
            style={[styles.adjustMode, { backgroundColor: draft.mode === 'move' ? palette.accentSoft : palette.background }]}>
            <Text style={{ color: draft.mode === 'move' ? palette.accent : palette.muted, fontWeight: '700' }}>Move</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Change adjustment to resize the end time"
            accessibilityState={{ selected: draft.mode === 'resize' }}
            onPress={() => setDraft({ ...draft, mode: 'resize', delta: 0 })}
            style={[styles.adjustMode, { backgroundColor: draft.mode === 'resize' ? palette.accentSoft : palette.background }]}>
            <Text style={{ color: draft.mode === 'resize' ? palette.accent : palette.muted, fontWeight: '700' }}>Resize</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Move proposed time 15 minutes earlier"
            onPress={() => setDraft((prev) => prev ? { ...prev, delta: prev.delta - 15 } : null)}
            style={[styles.adjustStep, { borderColor: palette.border }]}>
            <Text style={[styles.adjustStepLabel, { color: palette.foreground }]}>−15</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Move proposed time 15 minutes later"
            onPress={() => setDraft((prev) => prev ? { ...prev, delta: prev.delta + 15 } : null)}
            style={[styles.adjustStep, { borderColor: palette.border }]}>
            <Text style={[styles.adjustStepLabel, { color: palette.foreground }]}>+15</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Confirm timeline schedule change"
            accessibilityState={{ disabled: busy || !candidate.preview || draft.delta === 0 }}
            disabled={busy || !candidate.preview || draft.delta === 0}
            onPress={() => { if (candidate.preview) onApplyTimeEdit(candidate.preview, () => setDraft(null)); }}
            style={[styles.adjustApply, { backgroundColor: palette.accent,
              opacity: busy || !candidate.preview || draft.delta === 0 ? 0.4 : 1 }]}>
            <Text style={{ color: palette.onAccent, fontWeight: '700' }}>{busy ? 'Saving' : 'Apply'}</Text>
          </Pressable>
        </View>
        <Text style={[styles.adjustFooter, { color: palette.muted }]}>
          Preview only · Fixed commitments never move automatically. Existing overlaps are shown, not hidden.
        </Text>
      </View> : null}
      <View style={[styles.canvasFrame, { borderColor: palette.border, backgroundColor: palette.surface }]}>
        <ScrollView key={dateKey} ref={ref} nestedScrollEnabled showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.canvasScrollContent, { minHeight: hourHeight * 24 + 10 }]}
          scrollEventThrottle={32}
          onScrollBeginDrag={() => { userScrolled.current = true; travel.current = 0; }}
          onScroll={(event) => {
            const y = event.nativeEvent.contentOffset.y;
            const delta = y - scrollOffset.current;
            scrollOffset.current = y;
            if (!userScrolled.current || !onChromeHidden) return;
            // Accumulate travel in one direction so a small wobble never flips the header.
            travel.current = Math.sign(delta) === Math.sign(travel.current) ? travel.current + delta : delta;
            if (travel.current > 36 && y > 60) onChromeHidden(true);
            else if (travel.current < -36 || y < 8) onChromeHidden(false);
          }}
          onContentSizeChange={() => {
            if (didScroll.current !== dateKey) {
              didScroll.current = dateKey;
              zoomedHeight.current = hourHeight;
              ref.current?.scrollTo({ y: firstHour * hourHeight, animated: false });
            } else if (zoomedHeight.current !== hourHeight) {
              const previous = zoomedHeight.current;
              zoomedHeight.current = hourHeight;
              ref.current?.scrollTo({ y: scrollOffset.current * hourHeight / previous, animated: false });
            }
          }}>
          <View style={[styles.canvas, { height: hourHeight * 24 + 10 }]}>
            <View pointerEvents="none" style={[styles.workHours, {
              top: 8 * hourHeight, height: 10 * hourHeight,
              backgroundColor: shade,
            }]} />
            {HOURS.map((hour) => (
              <View key={hour} pointerEvents="none"
                style={[styles.hourMark, { top: hour * hourHeight }]}>
                <Text style={[styles.hourLabel, { color: palette.muted }]}>
                  {String(hour).padStart(2, '0')}:00
                </Text>
                <View style={[styles.hourRule, { backgroundColor: gridLine }]} />
              </View>
            ))}
            {HOURS.slice(0, 24).map((hour) => (
              <View key={`half-${hour}`} pointerEvents="none"
                style={[styles.halfRule, {
                  top: (hour + 0.5) * hourHeight,
                  backgroundColor: gridLine,
                }]} />
            ))}
            {HOURS.slice(0, 24).map((hour) => (
              <Pressable key={`add-${hour}`} accessibilityRole="button"
                accessibilityLabel={`Plan time at ${String(hour).padStart(2, '0')}:00`}
                onPress={() => onQuickAdd(hour)}
                style={[styles.emptyHour, { top: hour * hourHeight, height: hourHeight }]}>
                <Text style={[styles.plusHint, { color: palette.muted }]}>+</Text>
              </Pressable>
            ))}
            <View pointerEvents="box-none" style={styles.events}>
              {positioned.map(({ block, top, height, lane, lanes }) => {
                // Three or more side-by-side blocks have no room for a full range or icons.
                const crowded = lanes >= 3;
                const compact = height < 52;
                const veryCompact = height < 39;
                const tone = blockTone(block, palette);
                const isDark = palette === colors.dark;
                const past = isToday && Date.parse(block.endAt) <= now.getTime();
                const strength = (block.kind === 'box' ? 1.5 : 1) * (past ? 0.7 : 1);
                const fill = block.goalCompleted ? palette.inset
                  : withAlpha(tone, (isDark ? 0.18 : 0.13) * strength);
                const ink = block.goalCompleted ? palette.muted : palette.foreground;
                const focusedMs = (actualByBlock[block.id] ?? 0) +
                  (activeSession?.blockId === block.id ? getFocusElapsedMs(activeSession, now.getTime()) : 0);
                const plannedMs = Date.parse(block.endAt) - Date.parse(block.startAt);
                const progress = plannedMs > 0 ? Math.min(1, focusedMs / plannedMs) : 0;
                return (
                  <Pressable key={block.id} accessibilityRole="button"
                    accessibilityLabel={`${block.goalTitle}, ${visibleRange(block)}, ${block.kind === 'box' ? 'Timebox' : 'time reservation'}, ${block.flexible ? 'flexible' : 'fixed'}, ${block.goalCompleted ? 'completed' : 'open'}. Tap to edit, hold to adjust.`}
                    onPress={() => onEdit(block)}
                    onLongPress={() => setDraft({ id: block.id, mode: 'move', delta: 0, sourceRevision: block.updatedAt })}
                    hitSlop={compact ? 5 : 0}
                    style={[styles.event, {
                      top: top + 1, height: Math.max(21, height - 3),
                      left: `${100 * lane / lanes}%`, width: `${100 / lanes}%`,
                      backgroundColor: palette.surface,
                      borderColor: block.kind === 'box' && !block.goalCompleted ? tone : 'transparent',
                    }]}>
                    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: fill }]} />
                    {veryCompact ? (
                      <Text numberOfLines={1} style={[styles.microTitle, { color: ink }]}>
                        {visibleRange(block).split(' – ')[0]} · {block.goalTitle}
                      </Text>
                    ) : (
                      <>
                        <View style={styles.eventHead}>
                          <View style={[styles.eventDot, { backgroundColor: tone }]} />
                          <Text numberOfLines={1} style={[styles.eventTime, { color: palette.muted }]}>
                            {crowded ? visibleRange(block).split(' – ')[0] : visibleRange(block)}
                          </Text>
                          {crowded ? null : block.kind === 'box' ? <Timer size={12} color={tone} strokeWidth={2.2} /> : null}
                          {!crowded && !block.flexible ? <Lock size={11} color={palette.muted} strokeWidth={2.4} /> : null}
                          {height >= 52 && !crowded ? <Text style={[styles.eventDuration, { color: palette.muted }]}>{blockMinutes(block)}</Text> : null}
                        </View>
                        <Text numberOfLines={height < 75 ? 1 : 2}
                          style={[styles.eventTitle, { color: ink }, block.goalCompleted && styles.doneTitle]}>
                          {block.goalTitle}
                        </Text>
                        {height > 70 && focusedMs > 0 ? (
                          <View accessibilityLabel={`${Math.floor(focusedMs / 60000)} minutes Focus recorded`}
                            style={[styles.progressTrack, { backgroundColor: withAlpha(tone, 0.22) }]}>
                            <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: tone }]} />
                          </View>
                        ) : null}
                        {height > 114 && block.intention ? (
                          <Text numberOfLines={2} style={[styles.eventIntention, { color: palette.muted }]}>{block.intention}</Text>
                        ) : null}
                      </>
                    )}
                    {height >= 98 && lanes === 1 && !block.goalCompleted &&
                      activeSession?.blockId !== block.id ? (
                      <View accessibilityRole="adjustable"
                        accessibilityLabel={`Drag ${block.goalTitle} to move its time in 15-minute increments`}
                        onStartShouldSetResponder={() => true}
                        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
                        onAccessibilityAction={(e) => setDraft({
                          id: block.id, mode: 'move', delta: e.nativeEvent.actionName === 'increment' ? 15 : -15,
                          sourceRevision: block.updatedAt,
                        })}
                        onResponderGrant={(e) => beginDrag(block, 'move', e.nativeEvent.pageY)}
                        onResponderMove={(e) => continueDrag(block, 'move', e.nativeEvent.pageY)}
                        style={[styles.dragGrip, { backgroundColor: withAlpha(tone, 0.16) }]}>
                        <GripVertical size={20} color={tone} strokeWidth={2.2} />
                      </View>
                    ) : null}
                    {height >= 177 && lanes === 1 && !block.goalCompleted &&
                      activeSession?.blockId !== block.id ? (
                      <View accessibilityRole="adjustable"
                        accessibilityLabel={`Drag bottom of ${block.goalTitle} to resize its end`}
                        onStartShouldSetResponder={() => true}
                        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
                        onAccessibilityAction={(e) => setDraft({
                          id: block.id, mode: 'resize', delta: e.nativeEvent.actionName === 'increment' ? 15 : -15,
                          sourceRevision: block.updatedAt,
                        })}
                        onResponderGrant={(e) => beginDrag(block, 'resize', e.nativeEvent.pageY)}
                        onResponderMove={(e) => continueDrag(block, 'resize', e.nativeEvent.pageY)}
                        style={[styles.resizeGrip, { backgroundColor: withAlpha(tone, 0.16) }]}>
                        <ChevronsDown size={20} color={tone} strokeWidth={2.2} />
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
              {ghost ? <View pointerEvents="none"
                accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
                style={[styles.ghost, {
                  top: ghost.top + 1, height: Math.max(30, ghost.height - 3),
                  left: `${100 * ghost.lane / ghost.lanes}%`, width: `${100 / ghost.lanes}%`,
                  borderColor: palette.accent,
                  backgroundColor: palette.accentSoft,
                }]}>
                <Text numberOfLines={2} style={[styles.ghostTitle, { color: palette.accent }]}>
                  {ghost.block.goalTitle} · Proposed
                </Text>
                <Text style={[styles.ghostClock, { color: palette.accent }]}>
                  {candidate.preview ? `${clockLabel(candidate.preview.toStart)}–${clockLabel(candidate.preview.toEnd)}` : ''}
                </Text>
              </View> : null}
            </View>
            {isToday ? (
              <View pointerEvents="none"
                style={[styles.presentLine, { top: minOfDay(now) / 60 * hourHeight }]}>
                <View style={styles.nowPill}>
                  <Text style={styles.nowPillText}>{localClock(now)}</Text>
                </View>
                <View style={styles.nowLine} />
              </View>
            ) : null}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 250 },
  ribbonRegion: { paddingTop: 2, paddingBottom: 8, gap: 6 },
  ribbonSummary: { fontSize: 12, fontWeight: '600' },
  ribbonLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  ribbonLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 0.7 },
  ribbonTrack: { height: 25, borderRadius: 7, overflow: 'visible', position: 'relative' },
  ribbonBlock: { position: 'absolute', height: 6, borderRadius: 3, opacity: 0.95 },
  ribbonNow: { position: 'absolute', top: -4, bottom: -4, width: 2, borderRadius: 2, backgroundColor: semantic.timeline.now },
  ribbonJump: { position: 'absolute', width: '25%', top: -11, height: 48 },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingVertical: 4, flexWrap: 'wrap' },
  toolbarCopy: { flex: 1, gap: 4 },
  summaryLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heading: { fontSize: 17, fontWeight: '700', letterSpacing: -0.4 },
  zoom: { height: 44, flexDirection: 'row', alignItems: 'center', borderRadius: radius.full, borderWidth: 1 },
  zoomButton: { minWidth: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  zoomGlyph: { fontSize: 18, fontWeight: '700' },
  zoomCenter: { fontSize: 10, fontWeight: '800', minWidth: 13, textAlign: 'center' },
  nowButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderRadius: radius.full, paddingHorizontal: 13 },
  nowDot: { height: 7, width: 7, borderRadius: 4 },
  nowText: { fontSize: 12, fontWeight: '700' },
  canvasFrame: { flex: 1, overflow: 'hidden', borderWidth: 1, borderRadius: radius.xl },
  canvasScrollContent: { flexGrow: 1 },
  canvas: { position: 'relative' },
  workHours: { position: 'absolute', left: GUTTER, right: 0 },
  hourMark: { position: 'absolute', left: 0, right: 0, height: 18, flexDirection: 'row', alignItems: 'center' },
  hourLabel: { width: GUTTER - 8, paddingLeft: 11, fontSize: 10, textAlign: 'right', fontWeight: '600', fontVariant: ['tabular-nums'] },
  hourRule: { flex: 1, height: 1, marginHorizontal: 8 },
  halfRule: { position: 'absolute', left: GUTTER + 7, right: 9, height: StyleSheet.hairlineWidth, opacity: 0.5 },
  emptyHour: { position: 'absolute', left: GUTTER, right: 6, justifyContent: 'center', alignItems: 'flex-end', paddingRight: 10 },
  plusHint: { fontSize: 13, opacity: 0.24 },
  events: { position: 'absolute', top: 0, bottom: 0, left: GUTTER + 2, right: 7 },
  event: { position: 'absolute', borderRadius: 14, borderWidth: 1.5, paddingHorizontal: 11, paddingVertical: 6, overflow: 'hidden' },
  eventDot: { width: 7, height: 7, borderRadius: 4 },
  eventHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  eventDuration: { marginLeft: 'auto', fontSize: 11, fontWeight: '600', fontVariant: ['tabular-nums'] },
  dragGrip: { position: 'absolute', top: 2, right: 0, width: 46, height: 48,
    justifyContent: 'center', alignItems: 'center', borderRadius: 11 },
  resizeGrip: { position: 'absolute', bottom: 0, right: 0, width: 46, height: 48,
    justifyContent: 'center', alignItems: 'center', borderRadius: 11 },
  dragGlyph: { fontSize: 20, color: '#FFFFFF', fontWeight: '800' },
  ghost: { position: 'absolute', borderWidth: 2, borderStyle: 'dashed', borderRadius: 12,
    zIndex: 10, justifyContent: 'center', padding: 10, opacity: 0.92 },
  ghostTitle: { fontSize: 13, fontWeight: '800' },
  ghostClock: { fontSize: 12, fontWeight: '600', marginTop: 4 },
  adjustPanel: { gap: 7, borderWidth: 1, borderRadius: 15, padding: 10, marginBottom: 10 },
  adjustTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  adjustTitle: { fontSize: 13, fontWeight: '800' },
  adjustHint: { fontSize: 12, lineHeight: 18 },
  adjustClose: { minWidth: 48, minHeight: 48, justifyContent: 'center', alignItems: 'center' },
  adjustGoalLink: { minHeight: 48, paddingHorizontal: 7, justifyContent: 'center', alignItems: 'center' },
  adjustActions: { flexDirection: 'row', gap: 4, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' },
  adjustMode: { minHeight: 48, minWidth: 56, paddingHorizontal: 7, alignItems: 'center', justifyContent: 'center', borderRadius: 11 },
  adjustStep: { minHeight: 48, minWidth: 48, paddingHorizontal: 5, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  adjustStepLabel: { fontSize: 12, fontWeight: '800' },
  adjustApply: { minHeight: 48, minWidth: 61, paddingHorizontal: 6, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center' },
  adjustFooter: { fontSize: 11, lineHeight: 16 },
  eventTime: { fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
  eventTitle: { fontSize: 15, fontWeight: '700', marginTop: 2, letterSpacing: -0.1 },
  doneTitle: { textDecorationLine: 'line-through' },
  eventIntention: { fontSize: 11, marginTop: 7 },
  microTitle: { fontSize: 11, fontWeight: '700' },
  progressTrack: { height: 4, borderRadius: 4, marginTop: 7, overflow: 'hidden' },
  progressFill: { height: 4, borderRadius: 4 },
  presentLine: { position: 'absolute', left: 0, right: 0, height: 22, flexDirection: 'row', alignItems: 'center', zIndex: 12, transform: [{ translateY: -11 }] },
  nowPill: { marginLeft: 5, width: 49, borderRadius: 7, height: 23, backgroundColor: semantic.timeline.now, justifyContent: 'center', alignItems: 'center' },
  nowPillText: { fontSize: 10, fontWeight: '700', color: '#FFFFFF', fontVariant: ['tabular-nums'] },
  nowLine: { flex: 1, height: 2, marginRight: 8, backgroundColor: semantic.timeline.now },
});

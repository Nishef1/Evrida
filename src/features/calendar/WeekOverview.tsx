import { ScrollView, Pressable, StyleSheet, Text, View } from 'react-native';
import { shortDayText, weekdayText } from '../shared/dates';
import { analyzeDayLoad, blockClockRangeForDay, blockOverlapsRange, localDayBounds, localDayKey, type TimeBlock } from '../../domain/timeblocks';
import { colors, radius, spacing, semantic, type Palette } from '../../theme/tokens';

interface Props {
  days: Date[];
  blocks: TimeBlock[];
  selectedDay: string;
  palette: Palette;
  onSelectDay: (day: Date) => void;
  onAdd: (day: Date) => void;
  onEdit: (block: TimeBlock) => void;
}
const duration = (minutes: number) => {
  const rounded = Math.round(minutes), h = Math.floor(rounded / 60), m = rounded % 60;
  return h ? `${h}h${m ? ` ${m}m` : ''}` : `${m}m`;
};
export function WeekOverview({ days, blocks, selectedDay, palette, onSelectDay, onAdd, onEdit }: Props) {
  const today = localDayKey(new Date());
  const summaries = days.map((day) => {
    const bounds = localDayBounds(day), from = Date.parse(bounds.from), to = Date.parse(bounds.to);
    const entries = blocks.filter((block) => blockOverlapsRange(block, from, to))
      .sort((a, b) => a.startAt.localeCompare(b.startAt));
    return { day, entries, from, to, load: analyzeDayLoad(entries, day) };
  });
  // Exclude future days entirely; today remains an estimate until the user changes it.
  const elapsed = summaries.filter(({ day }) => localDayKey(day) <= today);
  const occupied = elapsed.reduce((sum, item) => sum + item.load.occupiedMinutes, 0);
  const activities = new Map<string, { title: string; minutes: number }>();
  for (const { entries, from, to } of elapsed) for (const block of entries) {
    const key = block.goalTitle.trim().toLocaleLowerCase();
    const value = activities.get(key) ?? { title: block.goalTitle, minutes: 0 };
    value.minutes += Math.max(0, Math.min(to, Date.parse(block.endAt)) - Math.max(from, Date.parse(block.startAt))) / 60000;
    activities.set(key, value);
  }
  const ranked = [...activities.values()].sort((a, b) => b.minutes - a.minutes);
  return <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
    <View style={styles.intro}>
      <Text style={[styles.title, { color: palette.foreground }]}>Your week</Text>
      <Text style={[styles.caption, { color: palette.muted }]}>Add a block, then tap it to change the time as your day unfolds.</Text>
    </View>
    {summaries.map(({ day, entries, load }) => {
      const key = localDayKey(day), selected = key === selectedDay;
      return <View key={key} style={[styles.card, { backgroundColor: palette.surface, borderColor: selected ? palette.accent : palette.border }]}>
        <View style={styles.cardTop}>
          <Pressable accessibilityRole="button" accessibilityLabel={`${weekdayText(day)}, open day timeline`} onPress={() => onSelectDay(day)} style={styles.dayHeading}>
            <Text style={[styles.dayName, { color: palette.foreground }]}>{shortDayText(day)}</Text>
            <Text style={[styles.caption, { color: palette.muted }]}>{key === today ? 'Today · ' : ''}{duration(load.occupiedMinutes)} scheduled</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`Add time on ${weekdayText(day)}`} onPress={() => onAdd(day)} style={styles.action}>
            <Text style={{ color: palette.accent, fontWeight: '700' }}>+ Add</Text>
          </Pressable>
        </View>
        {entries.length ? entries.map((block) => <Pressable key={block.id} accessibilityRole="button"
          accessibilityLabel={`Edit ${block.goalTitle}, ${blockClockRangeForDay(block, day)}`} onPress={() => onEdit(block)}
          style={[styles.entry, { borderTopColor: palette.border }]}>
          <Text style={[styles.time, { color: palette.accent }]}>{blockClockRangeForDay(block, day)}</Text>
          <Text numberOfLines={2} style={[styles.entryTitle, { color: palette.foreground }]}>{block.goalTitle}</Text>
          <Text style={{ color: palette.muted }}>›</Text>
        </Pressable>) : null}
        {load.overlapMinutes > 0 ? <Text style={[styles.caption, { color: palette === colors.dark ? semantic.dark.warning : semantic.light.warning }]}>{duration(load.overlapMinutes)} overlapping time</Text> : null}
      </View>;
    })}
    <View style={[styles.report, { borderColor: palette.border, backgroundColor: palette.surface }]}>
      <Text style={[styles.dayName, { color: palette.foreground }]}>Week so far</Text>
      {elapsed.length ? <Text style={[styles.caption, { color: palette.muted }]}>{duration(occupied)} scheduled · {duration(occupied / elapsed.length)} per day across {elapsed.length} day{elapsed.length === 1 ? '' : 's'}</Text> : <Text style={[styles.caption, { color: palette.muted }]}>This week has not started yet.</Text>}
      {ranked.map((item) => <View key={item.title.toLocaleLowerCase()} style={styles.reportRow}>
        <Text style={{ color: palette.foreground, flex: 1 }} numberOfLines={2}>{item.title}</Text>
        <Text style={{ color: palette.foreground, fontWeight: '700' }}>{duration(item.minutes)}</Text>
      </View>)}
      <Text style={[styles.caption, { color: palette.muted }]}>Based on your calendar blocks through today, including today's estimates. Future days are excluded. Empty days may mean time was not recorded. Overlapping activities are counted in each activity; the total counts shared time once.</Text>
    </View>
  </ScrollView>;
}
const styles = StyleSheet.create({
  scroll: { flex: 1 }, content: { paddingHorizontal: spacing.md, paddingTop: 12, paddingBottom: 40, gap: 8 },
  intro: { gap: 5, paddingBottom: 4 }, title: { fontSize: 20, fontWeight: '800' }, caption: { fontSize: 12, lineHeight: 18 },
  card: { borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: 14, paddingVertical: 3, gap: 2 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 }, dayHeading: { flex: 1, minHeight: 48, justifyContent: 'center', gap: 3 },
  dayName: { fontSize: 15, fontWeight: '700' }, action: { minHeight: 48, minWidth: 48, justifyContent: 'center', alignItems: 'center' },
  entry: { minHeight: 48, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  time: { fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] }, entryTitle: { flex: 1, fontSize: 14 },
  report: { borderWidth: 1, borderRadius: radius.lg, padding: 14, gap: 10, marginTop: 6 }, reportRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});

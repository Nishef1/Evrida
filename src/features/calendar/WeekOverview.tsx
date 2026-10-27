import { ScrollView, Pressable, StyleSheet, Text, View } from 'react-native';
import { weekdayText } from '../shared/dates';
import { analyzeDayLoad, blockOverlapsRange, localDayBounds, localDayKey, type TimeBlock } from '../../domain/timeblocks';
import { colors, radius, spacing, semantic, type Palette } from '../../theme/tokens';


interface Props {
  days: Date[];
  blocks: TimeBlock[];
  selectedDay: string;
  palette: Palette;
  onSelectDay: (day: Date) => void;
}
const hourText = (ms: number): string => {
  const minutes = Math.round(ms / 60000);
  const h = Math.floor(minutes / 60);
  return h ? h + 'h' + (minutes % 60 ? ' ' + (minutes % 60) + 'm' : '') : minutes + 'm';
};
export function WeekOverview({ days, blocks, selectedDay, palette, onSelectDay }: Props) {
  const summaries = days.map((day) => {
    const { from, to } = localDayBounds(day);
    const fromMs = Date.parse(from);
    const toMs = Date.parse(to);
    const entries = blocks.filter((block) =>
      blockOverlapsRange(block, fromMs, toMs),
    ).sort((a, b) => a.startAt.localeCompare(b.startAt));
    const load = analyzeDayLoad(entries, day);
    const planned = load.occupiedMinutes * 60000;
    let collisions = 0;
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        if (Date.parse(entries[i].startAt) < Date.parse(entries[j].endAt) &&
            Date.parse(entries[j].startAt) < Date.parse(entries[i].endAt)) collisions++;
      }
    }
    return { day, entries, planned, collisions, overlapMinutes: load.overlapMinutes };
  });
  const max = Math.max(60 * 60 * 1000, ...summaries.map((d) => d.planned));
  const weeklyTotal = summaries.reduce((sum, d) => sum + d.planned, 0);
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.eyebrow, { color: palette.accent }]}>PLAN THE WEEK</Text>
          <Text style={[styles.title, { color: palette.foreground }]}>Seven days, one view.</Text>
        </View>
        <Text style={[styles.weekTotal, { color: palette.accent }]}>{hourText(weeklyTotal)}</Text>
      </View>
      {summaries.map(({ day, entries, planned, collisions, overlapMinutes }) => {
        const selected = localDayKey(day) === selectedDay;
        return (
          <Pressable key={localDayKey(day)} accessibilityRole="button"
            accessibilityLabel={day.toDateString() + ', ' + entries.length + ' planned blocks. Open day timeline.'}
            onPress={() => onSelectDay(day)}
            style={[styles.card, { backgroundColor: palette.surface,
              borderColor: selected ? palette.accent : palette.border }]}>
            <View style={styles.cardTop}>
              <View style={[styles.dayBubble, { backgroundColor: selected ? palette.accent : palette.background }]}>
                <Text style={[styles.dayNumber, { color: selected ? palette.onAccent : palette.foreground }]}>
                  {day.getDate()}
                </Text>
              </View>
              <View style={styles.cardTitleGroup}>
                <Text style={[styles.dayName, { color: palette.foreground }]}>
                  {weekdayText(day)}
                </Text>
                <Text numberOfLines={1} style={[styles.preview, { color: palette.muted }]}>
                  {entries.length ? entries.slice(0, 2).map((item) => item.goalTitle).join(' · ') +
                    (entries.length > 2 ? ' + ' + (entries.length - 2) + ' more' : '') : 'An open day'}
                </Text>
              </View>
              <View style={styles.trailing}>
                <Text style={[styles.time, { color: palette.foreground }]}>{hourText(planned)}</Text>
                <Text style={[styles.blocks, { color: palette.muted }]}>
                  {entries.length} {entries.length === 1 ? 'block' : 'blocks'}
                </Text>
              </View>
            </View>
            <View style={[styles.rail, { backgroundColor: palette.background }]}>
              {planned > 0 ? <View style={[styles.progress, {
                width: `${100 * planned / max}%` as const, backgroundColor: selected ? semantic.timeline.timebox : palette.accent,
              }]} /> : null}
            </View>
            {collisions > 0 ? (
              <Text style={[styles.conflict, { color: palette === colors.dark ? semantic.dark.warning : semantic.light.warning }]}>◇ {hourText(overlapMinutes * 60000)} overlaps · {collisions} conflicting pair{collisions === 1 ? '' : 's'}</Text>
            ) : null}
          </Pressable>
        );
      })}
      <Text style={[styles.footer, { color: palette.muted }]}>
        Tap a day to inspect its timeline. Bars show uniquely occupied time, so overlapping blocks are never counted twice.
      </Text>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingHorizontal: spacing.md, paddingTop: 20, paddingBottom: 40, gap: 11 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 8 },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginBottom: 8 },
  title: { fontSize: 20, fontWeight: '800', letterSpacing: -0.6 },
  weekTotal: { fontSize: 17, fontWeight: '800', fontVariant: ['tabular-nums'] },
  card: { borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: 14, paddingVertical: 13, gap: 12 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dayBubble: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  dayNumber: { fontSize: 17, fontWeight: '800' },
  cardTitleGroup: { flex: 1, gap: 5 },
  dayName: { fontSize: 14, fontWeight: '800' },
  preview: { fontSize: 11 },
  trailing: { alignItems: 'flex-end', gap: 4 },
  time: { fontSize: 14, fontWeight: '800', fontVariant: ['tabular-nums'] },
  blocks: { fontSize: 11 },
  rail: { height: 5, borderRadius: 3, overflow: 'hidden' },
  progress: { height: 5, borderRadius: 3 },
  conflict: { fontSize: 12, fontWeight: '700' },
  footer: { fontSize: 11, lineHeight: 17, marginTop: 3 },
});

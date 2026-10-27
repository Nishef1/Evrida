import { StyleSheet, Text, View } from 'react-native';
import type { Palette } from '../../theme/tokens';
import { type } from '../../theme/type';

/** Counts explicit completions in this collection, never mastery or time spent. */
export function CompletionProgress({ label, completed, total, palette, color = palette.accent }: {
  label: string;
  completed: number;
  total: number;
  palette: Palette;
  color?: string;
}) {
  if (total === 0) return null;
  return <View accessible accessibilityRole="progressbar" accessibilityLabel={label}
    accessibilityValue={{ min: 0, max: total, now: completed, text: `${completed} of ${total} completed` }}
    style={styles.group}>
    <View style={styles.labels}>
      <Text style={[styles.label, { color: palette.foreground }]}>{label}</Text>
      <Text style={[styles.count, { color: palette.muted }]}>{completed} / {total} done</Text>
    </View>
    <View style={[styles.track, { backgroundColor: palette.inset }]}>
      <View style={[styles.fill, { backgroundColor: color, width: `${completed / total * 100}%` }]} />
    </View>
  </View>;
}

const styles = StyleSheet.create({
  group: { gap: 9 },
  labels: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', columnGap: 12, rowGap: 4 },
  label: { ...type.label, flexShrink: 1 },
  count: { ...type.caption, fontVariant: ['tabular-nums'] },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
});

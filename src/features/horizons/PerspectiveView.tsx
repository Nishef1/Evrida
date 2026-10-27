import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { HORIZON_TITLES, type Horizon } from '../../domain/horizons';
import type { Goal } from '../../domain/goals';
import type { PerspectiveSection } from '../../domain/perspective';
import { colors, depth, radius, type Palette } from '../../theme/tokens';
import Check from 'lucide-react-native/icons/check';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import Circle from 'lucide-react-native/icons/circle';
import Plus from 'lucide-react-native/icons/plus';



interface Props {
  sections: readonly PerspectiveSection[];
  palette: Palette;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onOpenHorizon: (horizon: Horizon) => void;
  onOpenGoal: (goal: Goal) => void;
  onAddGoal: (horizon: Horizon) => void;
}

export function PerspectiveView({ sections, palette, loading, error, onRetry, onOpenHorizon, onOpenGoal, onAddGoal }: Props) {
  if (loading) return <ActivityIndicator style={{ marginVertical: 28 }} color={palette.accent} />;
  if (error) return <View style={styles.error}>
    <Text style={{ color: palette.foreground }}>Could not load your horizons.</Text>
    <Text style={{ color: palette.muted }}>{error}</Text>
    <Pressable accessibilityRole="button" onPress={onRetry} style={styles.action}><Text style={{ color: palette.accent }}>Try again</Text></Pressable>
  </View>;
  return <View style={styles.container}>
    <View style={[styles.rail, { backgroundColor: palette.border }]} />
    {sections.map((section) => <View key={section.horizon} style={[styles.card, { borderColor: palette.border, backgroundColor: palette.surface, boxShadow: palette === colors.dark ? depth.dark.card : depth.light.card }]}>
      <View style={[styles.railDot, { backgroundColor: section.total ? palette.accent : palette.border, borderColor: palette.background }]} />
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Open ${HORIZON_TITLES[section.horizon]}, ${section.total} goals`}
          onPress={() => onOpenHorizon(section.horizon)} style={styles.headerCopy}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: palette.foreground }]}>{HORIZON_TITLES[section.horizon]}</Text>
            {section.total ? <Text style={[styles.count, { color: palette.muted }]}>{section.total - section.completed} open</Text> : null}
          </View>
          <Text numberOfLines={1} style={[styles.caption, { color: palette.muted }]}>{section.label}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`Add goal to ${HORIZON_TITLES[section.horizon]}`}
          onPress={() => onAddGoal(section.horizon)} style={styles.action}>
          <Plus size={19} color={palette.accent} strokeWidth={1.8} />
        </Pressable>
      </View>
      {section.preview.map((goal) => <Pressable key={goal.id} accessibilityRole="button" onPress={() => onOpenGoal(goal)}
        accessibilityLabel={`Open ${goal.title}`} style={[styles.preview, { borderTopColor: palette.border }]}>
        {goal.completed ? <Check size={15} color={palette.accent} /> : <Circle size={13} color={palette.muted} strokeWidth={1.8} />}
        <View style={{ flex: 1, gap: 4 }}>
          <Text numberOfLines={2} style={{ color: palette.foreground, fontSize: 14, textDecorationLine: goal.completed ? 'line-through' : 'none' }}>{goal.title}</Text>
          {goal.parentTitle ? <Text numberOfLines={1} style={[styles.caption, { color: palette.muted }]}>↳ {goal.parentTitle}</Text> : null}
        </View>
        <ChevronRight size={15} color={palette.muted} />
      </Pressable>)}
    </View>)}
  </View>;
}
const styles = StyleSheet.create({
  container: { paddingTop: 4, paddingBottom: 16, paddingLeft: 18, gap: 12 },
  rail: { position: 'absolute', width: 1, left: 4, top: 35, bottom: 50 },
  railDot: { position: 'absolute', width: 12, height: 12, borderRadius: 6, borderWidth: 3, left: -20, top: 26 },
  card: { borderWidth: 1, borderRadius: radius.lg }, header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14 },
  headerCopy: { flex: 1, minHeight: 72, justifyContent: 'center', gap: 4, paddingVertical: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }, title: { fontSize: 16, fontWeight: '600', letterSpacing: -.2 },
  count: { fontSize: 11 }, caption: { fontSize: 12, lineHeight: 18 }, action: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  preview: { minHeight: 54, marginHorizontal: 14, paddingVertical: 12, flexDirection: 'row', gap: 10, alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth },
  error: { paddingVertical: 20, gap: 10 },
});

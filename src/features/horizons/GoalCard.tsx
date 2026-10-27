import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Check from 'lucide-react-native/icons/check';
import ChevronDown from 'lucide-react-native/icons/chevron-down';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import Clock3 from 'lucide-react-native/icons/clock-3';
import Layers3 from 'lucide-react-native/icons/layers';
import MoreHorizontal from 'lucide-react-native/icons/ellipsis';
import type { Goal } from '../../domain/goals';
import { HORIZON_TITLES, dateFromPeriodKey, periodLabel } from '../../domain/horizons';
import { listChildGoals } from '../../storage/goals';
import { useEvridaDatabase } from '../../storage/use-database';
import { colors, depth, radius, type Palette } from '../../theme/tokens';

function planningLabel(goal: Goal) {
  return goal.inbox ? 'Inbox · not yet planned' : `${HORIZON_TITLES[goal.horizon]} · ${periodLabel(goal.horizon, dateFromPeriodKey(goal.horizon, goal.periodKey, new Date()))}`;
}

export function GoalCard({ goal, palette, revision, showContext, disabled, onOpen, onToggle, onOrganize }: {
  goal: Goal;
  palette: Palette;
  revision: number;
  showContext: boolean;
  disabled: boolean;
  onOpen: (goal: Goal) => void;
  onToggle: (goal: Goal) => void;
  onOrganize: () => void;
}) {
  const db = useEvridaDatabase();
  const [expanded, setExpanded] = useState(false);
  const [steps, setSteps] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!expanded || !goal.childrenCount) return;
    let active = true;
    setLoading(true);
    setFailed(false);
    void listChildGoals(db, goal.id).then((items) => {
      if (active) setSteps(items);
    }).catch(() => {
      if (active) setFailed(true);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [db, expanded, goal.id, goal.childrenCount, revision, retry]);

  function checkbox(item: Goal) {
    return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: item.completed, disabled }}
      accessibilityLabel={`${item.completed ? 'Reopen' : 'Complete'} ${item.title}`} disabled={disabled}
      onPress={() => onToggle(item)} style={styles.checkboxTouch}>
      <View style={[styles.checkbox, { borderColor: item.completed ? palette.accent : palette.horizon[item.horizon],
        backgroundColor: item.completed ? palette.accent : 'transparent' }]}>
        {item.completed ? <Check size={15} color={palette.onAccent} strokeWidth={2.75} /> : null}
      </View>
    </Pressable>;
  }

  return <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border,
    boxShadow: palette === colors.dark ? depth.dark.card : depth.light.card }]}>
    <View style={styles.row}>
      {checkbox(goal)}
      <Pressable style={styles.content} onPress={() => onOpen(goal)} accessibilityRole="button" accessibilityLabel={`Open ${goal.title}`}>
        {goal.parentTitle ? <View style={[styles.parent, styles.parentPill, { backgroundColor: palette.accentSoft }]}>
          <Layers3 size={12} color={palette.accent} strokeWidth={1.8} />
          <Text numberOfLines={1} style={[styles.meta, { color: palette.accent, fontWeight: '600' }]}>{goal.parentTitle}</Text>
        </View> : null}
        <Text numberOfLines={3} style={[styles.title, { color: goal.completed ? palette.muted : palette.foreground,
          textDecorationLine: goal.completed ? 'line-through' : 'none' }]}>{goal.title}</Text>
        {goal.notes ? <Text numberOfLines={1} style={[styles.meta, { color: palette.muted }]}>{goal.notes}</Text> : null}
        {showContext ? <Text style={[styles.meta, { color: palette.muted }]}>{planningLabel(goal)}</Text> : null}
        {goal.dueDate ? <Text style={[styles.meta, { color: palette.muted }]}>Deadline · {goal.dueDate}</Text> : null}
        {goal.repeatRule !== 'none' ? <Text style={[styles.meta, { color: palette.accent }]}>Repeats {goal.repeatRule}</Text> : null}
        {goal.nextBlockAt ? <View style={styles.parent}>
          <Clock3 size={12} color={palette.accent} />
          <Text style={[styles.meta, { color: palette.accent }]}>
            {new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(goal.nextBlockAt))}
          </Text>
        </View> : null}
      </Pressable>
      <Pressable onPress={onOrganize} disabled={disabled} accessibilityRole="button"
        accessibilityLabel={`Organize ${goal.title}`} style={styles.checkboxTouch}>
        <MoreHorizontal size={20} color={palette.muted} strokeWidth={1.8} />
      </Pressable>
    </View>
    {goal.childrenCount > 0 ? <>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded }}
        accessibilityLabel={`${expanded ? 'Hide' : 'Show'} ${goal.childrenCount} next steps for ${goal.title}`}
        onPress={() => setExpanded((value) => !value)} style={[styles.stepsToggle, { borderTopColor: palette.border }]}>
        {expanded ? <ChevronDown size={16} color={palette.accent} /> : <ChevronRight size={16} color={palette.accent} />}
        <Text style={[styles.stepCount, { color: palette.accent }]}>{goal.childrenCount} next step{goal.childrenCount === 1 ? '' : 's'}</Text>
      </Pressable>
      {expanded ? <View style={[styles.steps, { borderTopColor: palette.border }]}>
        {loading ? <ActivityIndicator style={styles.loading} color={palette.accent} accessibilityLabel="Loading next steps" /> : failed ?
          <Pressable accessibilityRole="button" onPress={() => setRetry((value) => value + 1)} style={styles.stepsToggle}>
            <Text style={[styles.meta, { color: palette.accent }]}>Couldn’t load steps. Tap to retry.</Text>
          </Pressable> : steps.slice(0, 3).map((step) => <View key={step.id} style={styles.row}>
            {checkbox(step)}
            <Pressable accessibilityRole="button" accessibilityLabel={`Open next step ${step.title}`}
              onPress={() => onOpen(step)} style={styles.content}>
              <Text style={[styles.stepTitle, { color: step.completed ? palette.muted : palette.foreground,
                textDecorationLine: step.completed ? 'line-through' : 'none' }]}>{step.title}</Text>
              <Text style={[styles.meta, { color: palette.muted }]}>{planningLabel(step)}</Text>
            </Pressable>
            <ChevronRight size={16} color={palette.muted} style={styles.stepArrow} />
          </View>)}
        {!loading && !failed && steps.length > 3 ? <Pressable accessibilityRole="button"
          accessibilityLabel={`View all ${steps.length} next steps for ${goal.title}`} onPress={() => onOpen(goal)} style={styles.stepsToggle}>
          <Text style={[styles.stepCount, { color: palette.accent }]}>View all {steps.length} steps</Text>
          <ChevronRight size={16} color={palette.accent} />
        </Pressable> : null}
      </View> : null}
    </> : null}
  </View>;
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, minHeight: 72 },
  checkboxTouch: { minHeight: 48, width: 48, alignItems: 'center', justifyContent: 'center' },
  checkbox: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  content: { flex: 1, minHeight: 48, justifyContent: 'center', paddingVertical: 14, gap: 5 },
  title: { fontSize: 16.5, lineHeight: 23, fontWeight: '600', letterSpacing: -.2 },
  meta: { fontSize: 12, lineHeight: 18, flexShrink: 1 },
  parent: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  parentPill: { alignSelf: 'flex-start', borderRadius: radius.full, paddingHorizontal: 9, paddingVertical: 3, maxWidth: '100%' },
  stepsToggle: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
  stepCount: { fontSize: 12, lineHeight: 18, fontWeight: '600', flexShrink: 1 },
  steps: { borderTopWidth: StyleSheet.hairlineWidth, marginHorizontal: 12 },
  stepTitle: { fontSize: 14, lineHeight: 21 },
  stepArrow: { marginHorizontal: 12 },
  loading: { padding: 16 },
});

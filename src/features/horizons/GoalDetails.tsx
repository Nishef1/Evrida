import { useState } from 'react';
import { periodText } from '../shared/dates';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { dateFromPeriodKey, HORIZON_TITLES } from '../../domain/horizons';
import type { Goal } from '../../domain/goals';
import { colors, radius, spacing, semantic, type Palette, scrim } from '../../theme/tokens';
import { useReducedMotion } from '../../theme/useReducedMotion';
import { type } from '../../theme/type';
import { CompletionProgress } from '../shared/CompletionProgress';
import { CalendarDays, Check, ChevronLeft, ChevronRight, Circle, Layers3, Play, Plus, X } from '../../theme/icons';



interface GoalDetailsProps {
  goal: Goal | null;
  children: Goal[];
  ancestors: Goal[];
  canGoBack: boolean;
  palette: Palette;
  onClose: () => void;
  onBack: () => void;
  onEdit: () => void;
  onAddStep: () => void;
  onOpenChild: (child: Goal) => void;
  onOpenAncestor: (ancestor: Goal) => void;
  onToggle: (goal: Goal) => void;
  onArchive: () => void;
  onSchedule: () => void;
  onFocus: (minutes: number) => void;
  focusing: boolean;
}

export function GoalDetails({
  goal, children, ancestors, canGoBack, palette, onClose, onBack, onEdit, onAddStep, onOpenChild, onOpenAncestor, onToggle, onArchive, onSchedule, onFocus, focusing,
}: GoalDetailsProps) {
  const reducedMotion = useReducedMotion();
  const [minutes, setMinutes] = useState(25);
  return (
    <Modal visible={goal !== null} animationType={reducedMotion ? 'none' : 'slide'} transparent statusBarTranslucent navigationBarTranslucent onRequestClose={canGoBack ? onBack : onClose}>
      <SafeAreaProvider>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close details" />
        <SafeAreaView edges={['bottom']} style={[styles.sheet, { backgroundColor: palette.background }]}>
          <View style={[styles.grabber, { backgroundColor: palette.border }]} />
          <View style={styles.header}>
            {canGoBack ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Back to parent goal" onPress={onBack} style={styles.headerAction}>
                <ChevronLeft size={23} color={palette.foreground} strokeWidth={1.8} />
              </Pressable>
            ) : null}
            <Text style={[styles.eyebrow, { color: palette.muted }]}>
              {goal?.inbox ? 'INBOX' : goal ? HORIZON_TITLES[goal.horizon].toUpperCase() + ' HORIZON' : ''}
            </Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close details" style={styles.headerAction} onPress={onClose}>
              <X size={21} color={palette.muted} strokeWidth={1.8} />
            </Pressable>
          </View>
          {goal ? (
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
              <Text style={[styles.title, { color: palette.foreground }]}>{goal.title}</Text>
              <Text style={[styles.period, { color: palette.muted }]}>{goal.inbox ? 'Not yet planned' : periodText(goal.horizon, dateFromPeriodKey(goal.horizon, goal.periodKey, new Date()))}</Text>
              {ancestors.length > 0 ? (
                <View style={[styles.pathPanel, { backgroundColor: palette.accentSoft }]}>
                  <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}><Layers3 size={13} color={palette.accent} />
                    <Text style={[styles.pathLabel, { color: palette.accent }]}>CONNECTED TO</Text></View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pathTrail}>
                    {ancestors.map((ancestor, index) => (
                      <View key={ancestor.id} style={styles.pathItem}>
                        {index > 0 ? <Text style={[styles.pathArrow, { color: palette.muted }]}>›</Text> : null}
                        <Pressable
                          onPress={() => onOpenAncestor(ancestor)}
                          accessibilityRole="button"
                          accessibilityLabel={`Open parent goal ${ancestor.title}`}
                          style={styles.pathChip}
                        >
                          <Text style={[styles.pathHorizon, { color: palette.muted }]}>
                            {ancestor.inbox ? 'Inbox' : HORIZON_TITLES[ancestor.horizon]}
                          </Text>
                          <Text style={[styles.pathTitle, { color: palette.foreground }]} numberOfLines={1}>
                            {ancestor.title}
                          </Text>
                        </Pressable>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              ) : null}
              {goal.dueDate ? <Text style={[styles.period, { color: palette.foreground }]}>Deadline · {goal.dueDate}</Text> : null}
              {goal.repeatRule !== 'none' ? <Text style={[styles.period, { color: palette.accent }]}>Repeats {goal.repeatRule} after completion</Text> : null}
              {goal.notes ? (
                <Text style={[styles.description, { color: palette.muted }]}>{goal.notes}</Text>
              ) : null}
              <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: goal.completed }}
                onPress={() => onToggle(goal)}
                style={[styles.complete, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                <View style={[styles.check, { borderColor: goal.completed ? palette.accent : palette.muted, backgroundColor: goal.completed ? palette.accent : 'transparent' }]}>
                  {goal.completed ? <Check size={15} color={palette.onAccent} /> : null}
                </View>
                <Text style={[styles.completeText, { color: palette.foreground }]}>
                  {goal.completed ? 'Completed · tap to reopen' : 'Mark this goal complete'}
                </Text>
              </Pressable>
              <View style={styles.stepsHeading}>
                {children.length ? <CompletionProgress label="Next steps" completed={children.filter((child) => child.completed).length}
                  total={children.length} palette={palette} color={palette.horizon[goal.horizon]} /> :
                  <Text style={[styles.sectionTitle, { color: palette.foreground }]}>Next steps</Text>}
              </View>
              {children.length === 0 ? (
                <Text style={[styles.empty, { color: palette.muted }]}>Break a big goal into one small, actionable step.</Text>
              ) : children.map((child) => (
                <View key={child.id} style={[styles.child, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                  <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: child.completed }}
                    accessibilityLabel={child.completed ? `Reopen ${child.title}` : `Complete ${child.title}`}
                    onPress={() => onToggle(child)} style={styles.childCheckTouch}>
                    {child.completed ? <Check size={20} color={palette.accent} /> : <Circle size={19} color={palette.muted} strokeWidth={1.8} />}
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel={`Open ${child.title}`}
                    onPress={() => onOpenChild(child)} style={styles.childContent}>
                    <Text style={[styles.childTitle, { color: palette.foreground, textDecorationLine: child.completed ? 'line-through' : 'none' }]} numberOfLines={2}>{child.title}</Text>
                    <Text style={[styles.childHorizon, { color: palette.muted }]}>{child.inbox ? 'Inbox · not yet planned' : HORIZON_TITLES[child.horizon] + ' · ' + periodText(child.horizon, dateFromPeriodKey(child.horizon, child.periodKey, new Date()))}</Text>
                  </Pressable>
                  <Pressable style={styles.childNavigate} onPress={() => onOpenChild(child)}
                    accessibilityRole="button" accessibilityLabel={`View details for ${child.title}`}>
                    <ChevronRight size={20} color={palette.muted} />
                  </Pressable>
                </View>
              ))}
              <Pressable accessibilityRole="button" onPress={onAddStep} style={[styles.addStep, { borderColor: palette.border }]}>
                <Plus size={18} color={palette.accent} /><Text style={[styles.addStepText, { color: palette.accent }]}>Add next step</Text>
              </Pressable>
              {!goal.completed ? <View style={[styles.focusPanel, { borderColor: palette.border, backgroundColor: palette.inset }]}>
                <Text style={[styles.focusHeading, { color: palette.foreground }]}>Make room for this step</Text>
                <View style={styles.focusDurations}>
                  {[15, 25, 50].map((value) => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: minutes === value }}
                    accessibilityLabel={`${value} minutes of focus`} disabled={focusing} onPress={() => setMinutes(value)}
                    style={[styles.focusDuration, { backgroundColor: minutes === value ? palette.accentSoft : palette.surface, borderColor: minutes === value ? palette.accent : palette.border }]}>
                    <Text style={{ color: minutes === value ? palette.accent : palette.foreground, fontSize: 13, fontWeight: minutes === value ? '600' : '400' }}>{value} min</Text>
                  </Pressable>)}
                </View>
                <Pressable accessibilityRole="button" disabled={focusing} onPress={() => onFocus(minutes)}
                  style={[styles.focusStart, { backgroundColor: palette.accent, opacity: focusing ? .5 : 1 }]}>
                  <Play size={17} color={palette.onAccent} strokeWidth={1.8} />
                  <Text style={{ color: palette.onAccent, fontWeight: '700' }}>{focusing ? 'Starting…' : `Start ${minutes} min focus`}</Text>
                </Pressable>
              </View> : null}
              <Pressable accessibilityRole="button" onPress={onSchedule}
                style={[styles.planTime, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                <CalendarDays size={18} color={palette.accent} strokeWidth={1.8} /><Text style={[styles.planTimeText, { color: palette.accent }]}>Plan time in Calendar</Text><ChevronRight size={17} color={palette.accent} />
              </Pressable>
              <View style={styles.actions}>
                <Pressable accessibilityRole="button" onPress={onEdit} style={[styles.actionButton, { backgroundColor: palette.accent }]}>
                  <Text style={[styles.primaryAction, { color: palette.onAccent }]}>Edit goal</Text>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={onArchive} style={[styles.actionButton, { backgroundColor: palette.surface, borderColor: palette.border, borderWidth: 1 }]}>
                  <Text style={[styles.removeText, { color: palette === colors.dark ? semantic.dark.danger : semantic.light.danger }]}>Archive</Text>
                </Pressable>
              </View>
            </ScrollView>
          ) : null}
        </SafeAreaView>
      </View>
      </SafeAreaProvider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  focusPanel: { borderWidth: 1, borderRadius: radius.lg, padding: 14, gap: 10 },
  focusHeading: { fontSize: 14, fontWeight: '600' }, focusDurations: { flexDirection: 'row', gap: 6 },
  focusDuration: { flex: 1, minHeight: 48, justifyContent: 'center', alignItems: 'center', borderRadius: radius.md, borderWidth: 1 },
  focusStart: { minHeight: 50, justifyContent: 'center', alignItems: 'center', borderRadius: radius.md, flexDirection: 'row', gap: 8 },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: scrim },
  sheet: { maxHeight: '88%', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 11 },
  grabber: { height: 4, width: 38, borderRadius: 10, alignSelf: 'center', marginBottom: 12 },
  header: { paddingHorizontal: spacing.md, justifyContent: 'space-between', flexDirection: 'row', alignItems: 'center' },
  eyebrow: { flex: 1, textAlign: 'left', fontSize: 10, fontWeight: '700', letterSpacing: 1.4, marginLeft: 8 },
  headerAction: { minHeight: 48, minWidth: 48, justifyContent: 'center', alignItems: 'center' },
  content: { paddingHorizontal: spacing.lg, paddingBottom: 38, paddingTop: spacing.sm, gap: spacing.md },
  pathPanel: { borderRadius: radius.md, padding: 12, gap: 4, marginBottom: 4 },
  pathLabel: { fontSize: 10, letterSpacing: 1.2, fontWeight: '700' },
  pathTrail: { alignItems: 'center', gap: 8, paddingRight: 3 },
  pathItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pathArrow: { fontSize: 19 },
  pathChip: { minHeight: 48, maxWidth: 184, minWidth: 102, paddingRight: 8, paddingVertical: 6, gap: 4, justifyContent: 'center' },
  pathHorizon: { fontSize: 10, fontWeight: '700' },
  pathTitle: { fontSize: 12, fontWeight: '600' },
  title: { ...type.title, fontSize: 27, lineHeight: 34 },
  period: { fontSize: 12, fontWeight: '600', marginTop: -8 },
  description: { fontSize: 15, lineHeight: 24 },
  complete: { minHeight: 56, borderWidth: 1, borderRadius: radius.lg, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, gap: spacing.md, marginTop: spacing.sm },
  check: { width: 22, height: 22, borderWidth: 1.3, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  completeText: { fontSize: 14, fontWeight: '600', flex: 1 },
  stepsHeading: { marginTop: spacing.sm },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  empty: { fontSize: 14, lineHeight: 22 },
  child: { minHeight: 70, borderWidth: 1, padding: spacing.sm, borderRadius: radius.md, flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  childCheckTouch: { minHeight: 48, minWidth: 48, alignItems: 'center', justifyContent: 'center' },
  childContent: { flex: 1, gap: 5, paddingVertical: 10 },
  childTitle: { fontSize: 14, fontWeight: '600' },
  childHorizon: { fontSize: 11 },
  childNavigate: { width: 48, minHeight: 48, justifyContent: 'center', alignItems: 'center' },
  addStep: { minHeight: 50, borderRadius: radius.md, borderWidth: 1, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  addStepText: { fontSize: 14, fontWeight: '700' },
  planTime: { minHeight: 52, borderRadius: radius.md, borderWidth: 1, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  planTimeText: { fontWeight: '700', fontSize: 14 },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  actionButton: { flex: 1, minHeight: 52, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  primaryAction: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  removeText: { fontSize: 14, fontWeight: '700' },
});

import type { ComponentType } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { radius, type Palette } from '../../theme/tokens';
import { fonts, type } from '../../theme/type';

interface Props {
  Icon: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  title: string;
  /** What this place is for and why it is empty. */
  copy: string;
  actionLabel?: string;
  onAction?: () => void;
  palette: Palette;
}

/** One empty-state shape for every list: what it is, why it is empty, the next step. */
export function EmptyState({ Icon, title, copy, actionLabel, onAction, palette }: Props) {
  return (
    <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      <View style={[styles.badge, { backgroundColor: palette.accentSoft }]}>
        <Icon size={26} color={palette.accent} strokeWidth={1.6} />
      </View>
      <Text style={[styles.title, { color: palette.foreground }]}>{title}</Text>
      <Text style={[styles.copy, { color: palette.muted }]}>{copy}</Text>
      {actionLabel && onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction}
          style={[styles.action, { borderColor: palette.border }]}>
          <Text style={[styles.actionLabel, { color: palette.accent }]}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.xl, padding: 24, gap: 10, alignItems: 'flex-start' },
  badge: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  title: { ...type.heading, fontFamily: fonts.display },
  copy: { ...type.body },
  action: { minHeight: 48, paddingHorizontal: 18, borderRadius: radius.full, borderWidth: 1, justifyContent: 'center', marginTop: 6 },
  actionLabel: { fontSize: 14, fontWeight: '700' },
});

import { useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type KeyboardTypeOptions } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { radius, scrim, spacing, type Palette } from '../../theme/tokens';
import { fonts, type } from '../../theme/type';
import { useReducedMotion } from '../../theme/useReducedMotion';
import X from 'lucide-react-native/icons/x';
import { formatAmount, formatUsd, groupDigits, parseAmount, toUsd, type FinSettings } from '../../domain/finance';

/** Bottom sheet with a fixed footer, shared by every Money editor. */
export function Sheet({ visible, title, onClose, palette, children, footer }: {
  visible: boolean; title: string; onClose: () => void; palette: Palette; children: ReactNode; footer?: ReactNode;
}) {
  const reduced = useReducedMotion();
  return <Modal visible={visible} transparent animationType={reduced ? 'none' : 'slide'} navigationBarTranslucent statusBarTranslucent onRequestClose={onClose}>
    <SafeAreaProvider>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <SafeAreaView edges={['bottom']} style={[styles.sheet, { backgroundColor: palette.background }]}>
          <View style={styles.sheetHead}>
            <Text style={[styles.sheetTitle, { color: palette.foreground }]} accessibilityRole="header">{title}</Text>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" style={styles.close}>
              <X size={21} color={palette.muted} strokeWidth={1.8} />
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.sheetBody}>{children}</ScrollView>
          {footer ? <View style={[styles.footer, { borderTopColor: palette.border }]}>{footer}</View> : null}
        </SafeAreaView>
      </KeyboardAvoidingView>
    </SafeAreaProvider>
  </Modal>;
}

export function Label({ children, palette }: { children: string; palette: Palette }) {
  return <Text style={[type.overline, { color: palette.muted, marginTop: 6 }]}>{children}</Text>;
}

/** A money amount: thousands separators appear as you type, and the dollar value shows when a rate is set. */
export function usdNote(value: string, settings: FinSettings): string | null {
  const parsed = parseAmount(value, settings.decimals);
  const usd = parsed === null ? null : toUsd(parsed, settings);
  if (usd === null || !settings.usdRateX100 || !settings.usdRateDate) return null;
  return `≈ ${formatUsd(usd)} at ${formatAmount(settings.usdRateX100, { decimals: 2 }).replace(/\.00$/, '')} ${settings.unit} per $ · ${dateName(settings.usdRateDate)}`;
}

export function Field({ label, value, onChangeText, palette, placeholder, keyboardType, multiline, suffix, maxLength, hint, money, negative }: {
  label: string; value: string; onChangeText: (text: string) => void; palette: Palette; placeholder?: string;
  keyboardType?: KeyboardTypeOptions; multiline?: boolean; suffix?: string; maxLength?: number; hint?: string;
  money?: FinSettings; negative?: boolean;
}) {
  const shown = money ? groupDigits(value, money.decimals, negative) : value;
  const note = money ? usdNote(value, money) : null;
  return <View style={{ gap: 6 }}>
    <Label palette={palette}>{label.toUpperCase()}</Label>
    <View style={[styles.field, multiline && { minHeight: 84, alignItems: 'flex-start' }, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      <TextInput value={shown} onChangeText={money ? (text) => onChangeText(groupDigits(text, money.decimals, negative)) : onChangeText} placeholder={placeholder} placeholderTextColor={palette.muted}
        keyboardType={keyboardType} multiline={multiline} maxLength={maxLength} accessibilityLabel={label}
        style={[styles.input, { color: palette.foreground }, multiline && { textAlignVertical: 'top' }]} />
      {suffix ? <Text style={{ color: palette.muted, fontSize: 13 }}>{suffix}</Text> : null}
    </View>
    {note ? <Text accessibilityLiveRegion="polite" style={[type.caption, { color: palette.accent, fontWeight: '600' }]}>{note}</Text> : null}
    {hint ? <Text style={[type.caption, { color: palette.muted }]}>{hint}</Text> : null}
  </View>;
}

export function Chip({ label, selected, onPress, palette, dot, disabled }: {
  label: string; selected: boolean; onPress: () => void; palette: Palette; dot?: string; disabled?: boolean;
}) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected, disabled }} disabled={disabled} onPress={onPress}
    style={[styles.chip, { borderColor: selected ? palette.accent : palette.border, backgroundColor: selected ? palette.accentSoft : palette.surface, opacity: disabled ? 0.45 : 1 }]}>
    {dot ? <View style={[styles.dot, { backgroundColor: dot }]} /> : null}
    <Text style={{ color: selected ? palette.accent : palette.foreground, fontSize: 13, fontWeight: selected ? '700' : '500' }}>{label}</Text>
  </Pressable>;
}
export const ChipRow = ({ children }: { children: ReactNode }) => <View style={styles.chips}>{children}</View>;

/** Equal-width segmented control. */
export function Segments<T extends string>({ options, value, onChange, palette }: {
  options: { id: T; label: string }[]; value: T; onChange: (id: T) => void; palette: Palette;
}) {
  return <View accessibilityRole="tablist" style={[styles.segments, { backgroundColor: palette.inset }]}>
    {options.map((o) => <Pressable key={o.id} accessibilityRole="tab" accessibilityState={{ selected: value === o.id }} onPress={() => onChange(o.id)}
      style={[styles.segment, value === o.id && { backgroundColor: palette.surface }]}>
      <Text style={{ color: value === o.id ? palette.foreground : palette.muted, fontSize: 13, fontWeight: value === o.id ? '700' : '500' }}>{o.label}</Text>
    </Pressable>)}
  </View>;
}

export function Card({ palette, children, onPress, label }: { palette: Palette; children: ReactNode; onPress?: () => void; label?: string }) {
  const style = [styles.card, { backgroundColor: palette.surface, borderColor: palette.border }];
  return onPress
    ? <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={style}>{children}</Pressable>
    : <View style={style}>{children}</View>;
}

export function PrimaryButton({ label, onPress, palette, disabled, tone }: { label: string; onPress: () => void; palette: Palette; disabled?: boolean; tone?: 'danger' }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress}
    style={[styles.primary, { backgroundColor: tone === 'danger' ? 'transparent' : palette.accent, borderWidth: tone === 'danger' ? 1 : 0, borderColor: palette.border, opacity: disabled ? 0.45 : 1 }]}>
    <Text style={{ color: tone === 'danger' ? '#C0392B' : palette.onAccent, fontSize: 15, fontWeight: '700' }}>{label}</Text>
  </Pressable>;
}
export function TextButton({ label, onPress, palette, muted }: { label: string; onPress: () => void; palette: Palette; muted?: boolean }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={styles.textButton}>
    <Text style={{ color: muted ? palette.muted : palette.accent, fontSize: 14, fontWeight: '700' }}>{label}</Text>
  </Pressable>;
}

/** Thin proportional bar; `value` is 0..1 and the track stays visible so an empty bar is not mistaken for a gap. */
export function Bar({ value, color, palette, height = 6 }: { value: number; color: string; palette: Palette; height?: number }) {
  return <View style={{ height, borderRadius: height, backgroundColor: palette.inset, overflow: 'hidden' }}>
    <View style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, height, backgroundColor: color, borderRadius: height }} />
  </View>;
}

/** Holds the editing state of a sheet's `busy` flag so a double tap cannot write twice. */
export function useBusy() {
  const [busy, setBusy] = useState(false);
  return { busy, run: async (task: () => Promise<void>, onError: (message: string) => void) => {
    if (busy) return;
    setBusy(true);
    try { await task(); } catch (error) { onError(error instanceof Error ? error.message : 'Please try again.'); } finally { setBusy(false); }
  } };
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: scrim },
  sheet: { maxHeight: '92%', borderTopLeftRadius: 25, borderTopRightRadius: 25 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', paddingLeft: spacing.lg, paddingRight: 8, paddingTop: 12 },
  sheetTitle: { ...type.title, flex: 1 },
  close: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  sheetBody: { padding: spacing.lg, paddingTop: 8, gap: 12 },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, padding: spacing.md, paddingHorizontal: spacing.lg, gap: 4 },
  field: { borderWidth: 1, borderRadius: radius.md, minHeight: 52, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { flex: 1, fontSize: 16, paddingVertical: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 44, paddingHorizontal: 14, borderRadius: radius.full, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  segments: { flexDirection: 'row', borderRadius: 15, padding: 4, gap: 3 },
  segment: { flex: 1, minHeight: 44, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  card: { borderWidth: 1, borderRadius: radius.lg, padding: 16, gap: 10 },
  primary: { minHeight: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  textButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
});
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "Oct 2026", or just "Oct" when `short`. */
export const monthName = (month: string, short = false) => `${MONTH_NAMES[Number(month.slice(5, 7)) - 1]}${short ? '' : ' ' + month.slice(0, 4)}`;
/** "Oct 27, 2026" from a YYYY-MM-DD key; never routes through UTC. */
export const dateName = (key: string) => `${MONTH_NAMES[Number(key.slice(5, 7)) - 1]} ${Number(key.slice(8, 10))}, ${key.slice(0, 4)}`;
export const numeral = { ...type.numeral, fontFamily: fonts.numeral } as const;

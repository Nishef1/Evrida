import { useState } from 'react';
import { Platform, Pressable, Text, View, useColorScheme } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { parseDateInput, periodKey } from '../../domain/horizons';
import { fullDateText } from './dates';
import { colors, radius } from '../../theme/tokens';
import { CalendarDays, ChevronDown, Clock3, X } from '../../theme/icons';

/** Native civil-date/time selection. Never converts a planning date through UTC. */
export function DateTimeField({ value, mode = 'date', label, placeholder = 'Choose a date', onChange, onClear, variant = 'field', displayValue }: {
  value: string; mode?: 'date' | 'time'; label: string; placeholder?: string;
  onChange: (value: string) => void; onClear?: () => void;
  variant?: 'field' | 'inline'; displayValue?: string;
}) {
  const dark = useColorScheme() === 'dark', palette = dark ? colors.dark : colors.light;
  const [open, setOpen] = useState(false);
  const selected = mode === 'date' ? parseDateInput(value) ?? new Date() : new Date();
  if (mode === 'time' && /^\d{2}:\d{2}$/.test(value)) selected.setHours(Number(value.slice(0, 2)), Number(value.slice(3)), 0, 0);
  const choose = (date: Date) => onChange(mode === 'date' ? periodKey('day', date)
    : `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`);
  const display = displayValue ?? (!value ? placeholder : mode === 'time' ? value
    : fullDateText(selected));
  return <View style={{ gap: 8 }}>
    <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${display}`} accessibilityHint="Opens the system picker"
        onPress={() => {
          if (Platform.OS === 'android') DateTimePickerAndroid.open({ value: selected, mode, is24Hour: true,
            onChange: (event, date) => { if (event.type === 'set' && date) choose(date); } });
          else setOpen(!open);
        }} style={{ flex: 1, minHeight: 52, borderWidth: variant === 'inline' ? 0 : 1, borderColor: palette.border,
          backgroundColor: variant === 'inline' ? 'transparent' : palette.surface,
          borderRadius: radius.md, padding: variant === 'inline' ? 0 : 13, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {variant !== 'inline' ? (mode === 'time' ? <Clock3 size={18} color={palette.muted} strokeWidth={1.6} /> : <CalendarDays size={18} color={palette.muted} strokeWidth={1.6} />) : null}
        <Text style={{ color: value ? palette.foreground : palette.muted, fontSize: variant === 'inline' ? 18 : 15,
          fontWeight: variant === 'inline' ? '600' : '400', flex: 1 }}>{display}</Text><ChevronDown size={15} color={palette.muted} />
      </Pressable>
      {value && onClear ? <Pressable accessibilityRole="button" accessibilityLabel={`Clear ${label}`} onPress={onClear}
        style={{ minHeight: 48, minWidth: 48, justifyContent: 'center', alignItems: 'center' }}>
        <X size={19} color={palette.muted} strokeWidth={1.8} />
      </Pressable> : null}
    </View>
    {open && Platform.OS === 'ios' ? <View>
      <DateTimePicker value={selected} mode={mode} display="spinner" themeVariant={dark ? 'dark' : 'light'}
        onChange={(_, date) => { if (date) choose(date); }} />
      <Pressable accessibilityRole="button" onPress={() => setOpen(false)} style={{ minHeight: 48, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: palette.accent, fontWeight: '700' }}>Done</Text>
      </Pressable>
    </View> : null}
  </View>;
}

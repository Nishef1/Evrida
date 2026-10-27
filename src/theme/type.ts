import { I18nManager, type TextStyle } from 'react-native';

// Fraunces gives titles and the focus clock a warm, editorial voice that matches the
// paper palette. Everything else stays on the system family for legibility and
// script coverage; Persian and other scripts fall back to the system font.
export const fonts = {
  display: 'Fraunces_700Bold',
  numeral: 'Fraunces_600SemiBold',
} as const;

/** Negative tracking breaks cursive joining in Arabic-script text, so it is dropped in RTL. */
export const tracking = (value: number): number => (I18nManager.isRTL ? 0 : value);

// One scale for the whole app. Custom-family styles carry no fontWeight because
// Android picks the weight from the font file, not from the weight prop.
export const type = {
  display: { fontFamily: fonts.display, fontSize: 36, lineHeight: 42, letterSpacing: tracking(-0.6) },
  title: { fontFamily: fonts.display, fontSize: 25, lineHeight: 31, letterSpacing: tracking(-0.3) },
  numeral: { fontFamily: fonts.numeral, fontVariant: ['lining-nums', 'tabular-nums'] },
  heading: { fontSize: 18, lineHeight: 24, fontWeight: '700', letterSpacing: tracking(-0.2) },
  cardTitle: { fontSize: 16.5, lineHeight: 23, fontWeight: '600', letterSpacing: tracking(-0.2) },
  body: { fontSize: 15, lineHeight: 23, fontWeight: '400' },
  label: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  caption: { fontSize: 12, lineHeight: 18, fontWeight: '400' },
  overline: { fontSize: 11, lineHeight: 16, fontWeight: '600', letterSpacing: 1.2 },
} satisfies Record<string, TextStyle>;

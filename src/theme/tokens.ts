// Shared Daybreak foundation: warm paper by day, ink-blue night, and one
// sunrise-to-midnight spectrum that gives each planning horizon its color.
// See docs/DESIGN_SYSTEM.md.
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  gutter: 20,
} as const;

export const radius = {
  timeline: 8,
  timeBlock: 6,
  md: 14,
  lg: 20,
  xl: 28,
  full: 999,
} as const;

export const colors = {
  light: {
    background: '#FAF7F2',
    surface: '#FFFFFF',
    foreground: '#1F1B16',
    muted: '#6B6358',
    accent: '#0E7670',
    onAccent: '#FFFFFF',
    border: '#E9E2D7',
    inset: '#F1ECE4',
    accentSoft: '#E3F2EF',
    horizon: {
      day: '#D9722A', week: '#D6455D', month: '#B83C86', quarter: '#8444C0',
      year: '#5654D4', decade: '#2F6FB5', life: '#1F3A5F',
    },
  },
  dark: {
    background: '#0E1118',
    surface: '#1F2433',
    foreground: '#F2EFE9',
    muted: '#A7A9B8',
    accent: '#5FD3C4',
    onAccent: '#06302C',
    border: '#2C3243',
    inset: '#161A25',
    accentSoft: '#12332F',
    horizon: {
      day: '#FFA45E', week: '#FF7D8F', month: '#E477BC', quarter: '#B58AF0',
      year: '#8C8CFF', decade: '#6FA8E8', life: '#6283BE',
    },
  },
} as const;

// Acrylic tints laid over the blurred content behind the dock.
export const glass = { light: 'rgba(250, 247, 242, 0.74)', dark: 'rgba(23, 27, 38, 0.72)' } as const;

// Modal backdrop shared by every sheet: neutral ink, not a tinted overlay.
export const scrim = 'rgba(14, 17, 24, 0.5)';

// Small layered shadows define surfaces; dark mode uses borders for separation.
export const depth = {
  light: {
    card: '0 1px 2px rgba(54, 38, 14, 0.04), 0 6px 18px rgba(54, 38, 14, 0.05)',
    control: '0 1px 3px rgba(54, 38, 14, 0.10), 0 0 0 1px rgba(54, 38, 14, 0.03)',
    float: '0 2px 4px rgba(54, 38, 14, 0.05), 0 12px 28px rgba(54, 38, 14, 0.12)',
  },
  dark: { card: '0 1px 2px rgba(0, 0, 0, 0.12)', control: '0 1px 3px rgba(0, 0, 0, 0.25)', float: '0 2px 4px rgba(0, 0, 0, 0.2), 0 14px 30px rgba(0, 0, 0, 0.45)' },
} as const;

// One semantic palette for schedule/status surfaces shared by all Calendar views.
// Text labels always accompany these tones; colors alone never communicate status.
export const semantic = {
  timeline: {
    planned: '#3F6C65',
    timebox: '#956C3F',
    completed: '#66716E',
    now: '#9B5F30',
    timeboxEdge: '#E6B579',
  },
  light: { warning: '#865A29', danger: '#A33C3C' },
  dark: { warning: '#E6B579', danger: '#FF9B99' },
} as const;

/** `#RRGGBB` plus an opacity, for tinted surfaces built from a palette hue. */
export function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

export type Palette = (typeof colors)[keyof typeof colors];

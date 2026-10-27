import { formatJalali, type CalendarStyle } from './jalali';

export const HORIZONS = ['day', 'week', 'month', 'quarter', 'year', 'decade', 'life'] as const;

export type Horizon = (typeof HORIZONS)[number];

export const HORIZON_TITLES: Record<Horizon, string> = {
  day: 'Day',
  week: 'Week',
  month: 'Month',
  quarter: 'Quarter',
  year: 'Year',
  decade: 'Decade',
  life: 'Life',
};

const pad = (value: number) => String(value).padStart(2, '0');

function noon(year: number, month: number, day: number): Date {
  return new Date(year, month, day, 12, 0, 0, 0);
}

export function startOfWeek(date: Date): Date {
  const day = noon(date.getFullYear(), date.getMonth(), date.getDate());
  day.setDate(day.getDate() - ((day.getDay() + 6) % 7));
  return day;
}

// ISO weeks are calculated with UTC calendar components to avoid DST errors.
export function isoWeekKey(date: Date): string {
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  utc.setUTCDate(utc.getUTCDate() + 4 - (utc.getUTCDay() || 7));
  const isoYear = utc.getUTCFullYear();
  const first = new Date(Date.UTC(isoYear, 0, 1));
  const week = Math.ceil(((utc.getTime() - first.getTime()) / 86400000 + 1) / 7);
  return `${isoYear}-W${pad(week)}`;
}

export function periodKey(horizon: Horizon, date: Date): string {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  switch (horizon) {
    case 'day': return `${y}-${pad(m)}-${pad(date.getDate())}`;
    case 'week': return isoWeekKey(date);
    case 'month': return `${y}-${pad(m)}`;
    case 'quarter': return `${y}-Q${Math.floor((m - 1) / 3) + 1}`;
    case 'year': return String(y);
    case 'decade': return String(Math.floor(y / 10) * 10);
    case 'life': return 'life';
  }
}

export function shiftPeriod(horizon: Horizon, date: Date, delta: number): Date {
  const y = date.getFullYear();
  const m = date.getMonth();
  const d = date.getDate();
  switch (horizon) {
    case 'day': return noon(y, m, d + delta);
    case 'week': return noon(y, m, d + delta * 7);
    case 'month': return noon(y, m + delta, 1);
    case 'quarter': return noon(y, Math.floor(m / 3) * 3 + delta * 3, 1);
    case 'year': return noon(y + delta, 0, 1);
    case 'decade': return noon(Math.floor(y / 10) * 10 + delta * 10, 0, 1);
    case 'life': return noon(y, m, d);
  }
}

/** Day and week captions can use the Shamsi calendar; a month, quarter or year is still a Gregorian planning period. */
export function periodLabel(horizon: Horizon, date: Date, style: CalendarStyle = 'gregorian'): string {
  const y = date.getFullYear();
  const shamsi = style === 'jalali';
  switch (horizon) {
    case 'day':
      if (shamsi) return formatJalali(y, date.getMonth() + 1, date.getDate(), { weekday: true, year: false });
      return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(date);
    case 'week': {
      const start = startOfWeek(date);
      const end = noon(start.getFullYear(), start.getMonth(), start.getDate() + 6);
      const short = (d: Date) => shamsi ? formatJalali(d.getFullYear(), d.getMonth() + 1, d.getDate(), { year: false })
        : new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(d);
      const first = short(start);
      const last = short(end);
      return `${first} – ${last}`;
    }
    case 'month': return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(date);
    case 'quarter': return `Quarter ${Math.floor(date.getMonth() / 3) + 1}, ${y}`;
    case 'year': return String(y);
    case 'decade': return `${Math.floor(y / 10) * 10}s`;
    case 'life': return 'The bigger picture';
  }
}

/**
 * Resolve a saved period back to a local date at noon, avoiding midnight DST
 * boundaries and retaining the original period while editing/rescheduling.
 */
export function dateFromPeriodKey(horizon: Horizon, key: string, fallback: Date): Date {
  let match: RegExpMatchArray | null;
  switch (horizon) {
    case 'day': {
      match = key.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!match) break;
      const year = Number(match[1]);
      const month = Number(match[2]);
      const day = Number(match[3]);
      const candidate = noon(year, month - 1, day);
      if (candidate.getFullYear() === year && candidate.getMonth() === month - 1 && candidate.getDate() === day) return candidate;
      break;
    }
    case 'week': {
      match = key.match(/^(\d{4})-W(\d{2})$/);
      if (!match) break;
      const isoYear = Number(match[1]);
      const week = Number(match[2]);
      if (week < 1 || week > 53) break;
      const fourth = noon(isoYear, 0, 4);
      const monday = startOfWeek(fourth);
      monday.setDate(monday.getDate() + (week - 1) * 7);
      if (isoWeekKey(monday) === key) return monday;
      break;
    }
    case 'month': {
      match = key.match(/^(\d{4})-(\d{2})$/);
      if (!match) break;
      const m = Number(match[2]);
      if (m >= 1 && m <= 12) return noon(Number(match[1]), m - 1, 1);
      break;
    }
    case 'quarter': {
      match = key.match(/^(\d{4})-Q([1-4])$/);
      if (match) return noon(Number(match[1]), (Number(match[2]) - 1) * 3, 1);
      break;
    }
    case 'year':
    case 'decade': {
      match = key.match(/^\d{4}$/);
      if (match) return noon(Number(key), 0, 1);
      break;
    }
    case 'life':
      return new Date(fallback.getTime());
  }
  return new Date(fallback.getTime());
}

/** Parse YYYY-MM-DD as a real local calendar date, not as UTC midnight. */
export function parseDateInput(value: string): Date | null {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  const date = noon(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

import { JALALI_WEEKDAYS, formatJalali, formatJalaliKey } from '../../domain/jalali';
import { periodLabel, type Horizon } from '../../domain/horizons';
import { getCalendarStyle } from './calendarStyle';

const en = (options: Intl.DateTimeFormatOptions, date: Date) => new Intl.DateTimeFormat('en-US', options).format(date);
const jalali = (date: Date, options?: { weekday?: boolean; year?: boolean }) =>
  formatJalali(date.getFullYear(), date.getMonth() + 1, date.getDate(), options);

/** "Oct 27, 2026" or "۵ آبان ۱۴۰۵" from a stored YYYY-MM-DD key, following the chosen calendar. */
export const keyText = (key: string): string => {
  if (getCalendarStyle() === 'jalali') return formatJalaliKey(key);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[Number(key.slice(5, 7)) - 1]} ${Number(key.slice(8, 10))}, ${key.slice(0, 4)}`;
};

/** "Tue, Oct 27" style short heading. */
export const shortDayText = (date: Date): string =>
  getCalendarStyle() === 'jalali' ? jalali(date, { weekday: true, year: false }) : en({ weekday: 'short', month: 'short', day: 'numeric' }, date);
/** "Oct 27" without the weekday. */
export const monthDayText = (date: Date): string =>
  getCalendarStyle() === 'jalali' ? jalali(date, { year: false }) : en({ month: 'short', day: 'numeric' }, date);
/** "Tuesday, October 27" (year added when it is not the current year). */
export const longDayText = (date: Date): string => {
  const otherYear = date.getFullYear() !== new Date().getFullYear();
  return getCalendarStyle() === 'jalali' ? jalali(date, { weekday: true, year: otherYear })
    : en({ weekday: 'long', month: 'long', day: 'numeric', year: otherYear ? 'numeric' : undefined }, date);
};
/** "Oct 27, 2026" from a Date. */
export const fullDateText = (date: Date): string =>
  getCalendarStyle() === 'jalali' ? jalali(date) : en({ month: 'short', day: 'numeric', year: 'numeric' }, date);
/** Weekday name only. */
export const weekdayText = (date: Date): string =>
  getCalendarStyle() === 'jalali' ? JALALI_WEEKDAYS[date.getDay()] : en({ weekday: 'long' }, date);
/** "Oct 27, 6:00 PM" for a timestamp. */
export const dayTimeText = (value: number | string): string => {
  const date = new Date(value);
  if (getCalendarStyle() !== 'jalali') return en({ month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }, date);
  return `${monthDayText(date)}، ${en({ hour: 'numeric', minute: '2-digit' }, date)}`;
};
/** Planning period caption; day and week follow the chosen calendar, months/quarters/years stay Gregorian periods. */
export const periodText = (horizon: Horizon, date: Date): string => periodLabel(horizon, date, getCalendarStyle());

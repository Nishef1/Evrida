/**
 * Shamsi (Jalali / Solar Hijri) calendar display and input helpers.
 *
 * Storage never changes: every date in the database stays a Gregorian YYYY-MM-DD key. These helpers only convert at
 * the edges (showing a date, or reading a date the person typed). The arithmetic is the 33-year-cycle algorithm used by
 * the jalaali-js project, valid for Jalali years -61 to 3177.
 */
export type CalendarStyle = 'gregorian' | 'jalali';

export const JALALI_MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'] as const;
/** Indexed by JavaScript's `Date.getDay()` (Sunday = 0). */
export const JALALI_WEEKDAYS = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'] as const;

const BREAKS = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];
const div = (a: number, b: number) => Math.trunc(a / b);
const mod = (a: number, b: number) => a - Math.trunc(a / b) * b;

function jalCal(jy: number) {
  if (jy < BREAKS[0] || jy >= BREAKS[BREAKS.length - 1]) throw new Error(`Jalali year ${jy} is out of range.`);
  const gy = jy + 621;
  let leapJ = -14, jp = BREAKS[0], jump = 0;
  for (let i = 1; i < BREAKS.length; i++) {
    const jm = BREAKS[i];
    jump = jm - jp;
    if (jy < jm) break;
    leapJ += div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }
  let n = jy - jp;
  leapJ += div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;
  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
  let leap = mod(mod(n + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;
  return { leap, gy, march };
}

function g2d(gy: number, gm: number, gd: number) {
  let d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4) + div(153 * mod(gm + 9, 12) + 2, 5) + gd - 34840408;
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  return d;
}
function d2g(jdn: number) {
  let j = 4 * jdn + 139361631;
  j += div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const gd = div(mod(i, 153), 5) + 1;
  const gm = mod(div(i, 153), 12) + 1;
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
  return { gy, gm, gd };
}

export interface JalaliDate { jy: number; jm: number; jd: number }

export const isJalaliLeap = (jy: number) => jalCal(jy).leap === 0;
export function jalaliMonthLength(jy: number, jm: number): number {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return isJalaliLeap(jy) ? 30 : 29;
}
export function isValidJalali(jy: number, jm: number, jd: number): boolean {
  return Number.isInteger(jy) && Number.isInteger(jm) && Number.isInteger(jd) && jy >= 1 && jy <= 3000
    && jm >= 1 && jm <= 12 && jd >= 1 && jd <= jalaliMonthLength(jy, jm);
}

export function toJalali(gy: number, gm: number, gd: number): JalaliDate {
  const jdn = g2d(gy, gm, gd);
  let jy = d2g(jdn).gy - 621;
  const r = jalCal(jy);
  const jdn1f = g2d(r.gy, 3, r.march);
  let k = jdn - jdn1f;
  if (k >= 0) {
    if (k <= 185) return { jy, jm: 1 + div(k, 31), jd: mod(k, 31) + 1 };
    k -= 186;
  } else {
    jy -= 1;
    k += 179;
    if (r.leap === 1) k += 1;
  }
  return { jy, jm: 7 + div(k, 30), jd: mod(k, 30) + 1 };
}

export function toGregorian(jy: number, jm: number, jd: number): { gy: number; gm: number; gd: number } {
  const r = jalCal(jy);
  return d2g(g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1);
}

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
export const toPersianDigits = (value: string | number) => String(value).replace(/\d/g, (digit) => PERSIAN_DIGITS[Number(digit)]);
/** Persian (۰-۹) and Arabic-Indic (٠-٩) digits to ASCII, so typed dates and amounts parse the same. */
export const normalizeDigits = (text: string) => text
  .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x06f0))
  .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660));

const pad = (value: number) => String(value).padStart(2, '0');
const isoKey = (y: number, m: number, d: number) => `${String(y).padStart(4, '0')}-${pad(m)}-${pad(d)}`;
const realGregorian = (y: number, m: number, d: number) => {
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
};

/**
 * Turn typed text into a Gregorian YYYY-MM-DD key, or null. A year of 1200-1699 is read as Shamsi (Gregorian years in
 * that range are never planning dates), so people can type either calendar. Accepts `-`, `/` or `.` as separators and
 * Persian digits. Returns null for anything that is not a real date.
 */
export function parseDateText(text: string): string | null {
  const match = normalizeDigits(text.trim()).match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (!match) return null;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (y >= 1200 && y <= 1699) {
    if (!isValidJalali(y, m, d)) return null;
    const g = toGregorian(y, m, d);
    return isoKey(g.gy, g.gm, g.gd);
  }
  return realGregorian(y, m, d) ? isoKey(y, m, d) : null;
}

const RLI = '⁧', PDI = '⁩';
/** "۴ آبان ۱۴۰۵", wrapped as a right-to-left run so surrounding English text cannot reorder it. */
export function formatJalali(gy: number, gm: number, gd: number, options: { weekday?: boolean; year?: boolean } = {}): string {
  const j = toJalali(gy, gm, gd);
  const parts: string[] = [];
  if (options.weekday) parts.push(`${JALALI_WEEKDAYS[new Date(Date.UTC(gy, gm - 1, gd)).getUTCDay()]}،`);
  parts.push(toPersianDigits(j.jd), JALALI_MONTHS[j.jm - 1]);
  if (options.year !== false) parts.push(toPersianDigits(j.jy));
  return `${RLI}${parts.join(' ')}${PDI}`;
}
/** Same, from a Gregorian YYYY-MM-DD key. */
export const formatJalaliKey = (key: string, options?: { weekday?: boolean; year?: boolean }) =>
  formatJalali(Number(key.slice(0, 4)), Number(key.slice(5, 7)), Number(key.slice(8, 10)), options);

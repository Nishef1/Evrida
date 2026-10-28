import { calendarSwipeDirection } from '../src/domain/calendar-swipe.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import { isoWeekKey, periodKey, shiftPeriod, startOfWeek, periodLabel, dateFromPeriodKey, parseDateInput } from '../src/domain/horizons.ts';
import { toJalali, toGregorian, isJalaliLeap, jalaliMonthLength, parseDateText, formatJalaliKey, normalizeDigits } from '../src/domain/jalali.ts';
import { normalizeGoalTitle, availableGoalParents } from '../src/domain/goals.ts';
import { buildPerspectiveSections } from '../src/domain/perspective.ts';
import { analyzeDayLoad, clockWithUtcOffset, analyzeRangeLoad, peakOverlap, blockOverlapsRange, blockClockRangeForDay, layoutBlocks, localDayBounds, localDayKey, monthGridDays, timeRangeFromInput } from '../src/domain/timeblocks.ts';
import { formatFocusTime, getFocusDurationMs, getFocusRemainingMs, getFocusElapsedMs } from '../src/domain/focus.ts';
import { previewReplan } from '../src/domain/replan.ts';
import { semantic } from '../src/theme/tokens.ts';
import { pixelsToQuarterHours, previewTimelineEdit } from '../src/domain/timeline-edit.ts';

test('all seven horizon keys use independent periods', () => {
  const date = new Date(2026, 9, 14, 12);
  assert.equal(periodKey('day', date), '2026-10-14');
  assert.equal(periodKey('week', date), '2026-W42');
  assert.equal(periodKey('month', date), '2026-10');
  assert.equal(periodKey('quarter', date), '2026-Q4');
  assert.equal(periodKey('year', date), '2026');
  assert.equal(periodKey('decade', date), '2020');
  assert.equal(periodKey('life', date), 'life');
});

test('week boundaries, ISO week-year and period navigation stay on the right calendar day', () => {
  assert.equal(isoWeekKey(new Date(2020, 11, 31, 12)), '2020-W53');
  assert.equal(isoWeekKey(new Date(2021, 0, 1, 12)), '2020-W53');
  assert.equal(isoWeekKey(new Date(2021, 0, 4, 12)), '2021-W01');
  const endOfMonth = new Date(2024, 0, 31, 12);
  assert.equal(periodKey('month', shiftPeriod('month', endOfMonth, 1)), '2024-02');
  assert.equal(periodKey('quarter', shiftPeriod('quarter', endOfMonth, 1)), '2024-Q2');
  assert.equal(periodKey('year', shiftPeriod('year', endOfMonth, 1)), '2025');
  assert.equal(periodKey('decade', shiftPeriod('decade', endOfMonth, 1)), '2030');
  assert.equal(periodKey('day', shiftPeriod('day', endOfMonth, 1)), '2024-02-01');
  const date = new Date(2026, 9, 18, 12);
  const start = startOfWeek(date);
  assert.equal(periodKey('day', start), '2026-10-12');
  assert.equal(periodKey('day', date), '2026-10-18');
  assert.match(periodLabel('week', date), /Oct 12/);
});

test('names and strict dates reject empty, overlong and impossible input', () => {
  assert.equal(periodKey('day', parseDateInput('2024-02-29')), '2024-02-29');
  assert.equal(parseDateInput('2025-02-29'), null);
  // Shamsi calendar: anchors are the Nowruz dates, a leap year, and a full-range round trip
  assert.deepEqual(toJalali(2026, 3, 21), { jy: 1405, jm: 1, jd: 1 });
  assert.deepEqual(toJalali(2025, 3, 21), { jy: 1404, jm: 1, jd: 1 });
  assert.deepEqual(toJalali(2024, 3, 20), { jy: 1403, jm: 1, jd: 1 });
  assert.deepEqual(toJalali(2025, 3, 20), { jy: 1403, jm: 12, jd: 30 }, '1403 is a leap year with 30 Esfand');
  assert.deepEqual(toJalali(2026, 10, 27), { jy: 1405, jm: 8, jd: 5 });
  assert.deepEqual(toGregorian(1405, 8, 5), { gy: 2026, gm: 10, gd: 27 });
  assert.ok(isJalaliLeap(1403) && !isJalaliLeap(1404));
  assert.deepEqual([jalaliMonthLength(1405, 6), jalaliMonthLength(1405, 7), jalaliMonthLength(1403, 12), jalaliMonthLength(1404, 12)], [31, 30, 30, 29]);
  for (let day = new Date(Date.UTC(1990, 0, 1)); day < new Date(Date.UTC(2060, 0, 1)); day = new Date(day.getTime() + 86400000 * 7)) {
    const [y, m, d] = [day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate()], j = toJalali(y, m, d), back = toGregorian(j.jy, j.jm, j.jd);
    assert.deepEqual([back.gy, back.gm, back.gd], [y, m, d]);
  }
  assert.equal(parseDateText('2026-10-27'), '2026-10-27');
  assert.equal(parseDateText('1405/08/05'), '2026-10-27', 'a Shamsi year is read as Shamsi');
  assert.equal(parseDateText('۱۴۰۵-۰۸-۰۵'), '2026-10-27', 'Persian digits are accepted');
  assert.equal(parseDateText('1404/12/30'), null, '1404 is not a leap year');
  assert.equal(parseDateText('1405/13/01'), null);
  assert.equal(parseDateText('2025-02-29'), null);
  assert.equal(normalizeDigits('٢٠٢٦ ۱۴۰۵'), '2026 1405');
  assert.match(formatJalaliKey('2026-10-27'), /^⁧۵ آبان ۱۴۰۵⁩$/);
  assert.match(formatJalaliKey('2026-10-27', { weekday: true, year: false }), /سه‌شنبه، ۵ آبان/);
  assert.match(periodLabel('day', new Date(2026, 9, 27, 12), 'jalali'), /۵ آبان/);
  assert.match(periodLabel('week', new Date(2026, 9, 27, 12), 'jalali'), /۴ آبان.*۱۰ آبان/s, 'a Monday-based week renders as Shamsi dates');
  assert.match(periodLabel('month', new Date(2026, 9, 27, 12), 'jalali'), /October 2026/, 'months stay Gregorian planning periods');
  assert.equal(parseDateInput('2026-13-01'), null);
  assert.equal(parseDateInput('2026-04-31'), null);
  assert.equal(parseDateInput('2026/10/14'), null);
  assert.equal(normalizeGoalTitle('  Learn   to build  '), 'Learn to build');
  assert.throws(() => normalizeGoalTitle('   '), /needs a title/);
  assert.throws(() => normalizeGoalTitle('x'.repeat(181)), /180 characters/);
});

test('saved period can be recovered accurately for editing', () => {
  const fallback = new Date(2026, 9, 14, 12);
  for (const horizon of ['day', 'week', 'month', 'quarter', 'year', 'decade']) {
    const key = periodKey(horizon, fallback);
    assert.equal(periodKey(horizon, dateFromPeriodKey(horizon, key, new Date(2031, 2, 8))), key);
  }
  assert.equal(periodKey('week', dateFromPeriodKey('week', '2020-W53', fallback)), '2020-W53');
  assert.equal(periodKey('week', dateFromPeriodKey('week', '2021-W01', fallback)), '2021-W01');
});

test('parent choices cannot contain the edited goal or any descendants', () => {
  const goal = (id, parentId) => ({ id, parentId, title: id });
  const items = [goal('root', null), goal('child', 'root'), goal('grandchild', 'child'), goal('other', null)];
  assert.deepEqual(availableGoalParents(items, 'root').map((x) => x.id), ['other']);
  assert.deepEqual(availableGoalParents(items, 'child').map((x) => x.id), ['root', 'other']);
});

test('multi-horizon overview groups unique saved goals and limits previews', () => {
  const periods = [
    { horizon: 'day', key: '2026-10-14', label: 'Today' },
    { horizon: 'year', key: '2026', label: '2026' },
    { horizon: 'life', key: 'life', label: 'Life' },
  ];
  const goal = (id, horizon, periodKey, completed, createdAt) => ({
    id, title: id, horizon, periodKey, completed, createdAt, childrenCount: 0,
  });
  const goals = [
    goal('a', 'day', '2026-10-14', false, '2026-10-12T12:00:00Z'),
    goal('b', 'day', '2026-10-14', false, '2026-10-13T12:00:00Z'),
    goal('c', 'day', '2026-10-14', true, '2026-10-14T12:00:00Z'),
    goal('not-this-day', 'day', '2026-10-13', false, '2026-10-14T12:00:00Z'),
    goal('d', 'life', 'life', false, '2026-10-11T12:00:00Z'),
  ];
  const sections = buildPerspectiveSections(periods, goals);
  assert.deepEqual(sections.map((section) => section.total), [3, 0, 1]);
  assert.deepEqual(sections.map((section) => section.completed), [1, 0, 0]);
  assert.deepEqual(sections[0].preview.map((item) => item.id), ['b', 'a']);
  assert.deepEqual(sections[1].preview, []);
  assert.equal(new Set(sections.flatMap((section) => section.preview.map((item) => item.id))).size, 3);
});

test('time blocks validate local day and ordering without confusing calendar with horizon', () => {
  const date = '2026-10-14';
  const first = timeRangeFromInput({ date, start: '09:00', end: '10:30' });
  assert.equal(localDayKey(new Date(first.startAt)), date);
  assert.equal((new Date(first.endAt) - new Date(first.startAt)) / 60000, 90);
  assert.throws(() => timeRangeFromInput({ date: '2026-02-30', start: '09:00', end: '10:00' }));
  assert.throws(() => timeRangeFromInput({ date, start: '25:00', end: '26:00' }));
  assert.throws(() => timeRangeFromInput({ date, start: '10:00', end: '09:00' }));
  const bounds = localDayBounds(new Date(2026, 9, 14, 12));
  assert.equal(localDayKey(new Date(bounds.from)), date);
  assert.equal(localDayKey(new Date(bounds.to)), '2026-10-15');
  const sample = { id: 'planned-1', goalId: 'sample', goalTitle: 'Design', goalCompleted: false,
    flexible: false, kind: 'box', intention: '', startAt: first.startAt, endAt: first.endAt };
  assert.equal(pixelsToQuarterHours(38, 76), 30);
  assert.equal(pixelsToQuarterHours(-38, 76), -30);
  assert.equal(pixelsToQuarterHours(0, 56), 0);
  const moved = previewTimelineEdit(sample, [], new Date(2026, 9, 14, 12), 'move', 15);
  assert.equal((Date.parse(moved.toStart) - Date.parse(sample.startAt)) / 60000, 15);
  assert.equal((Date.parse(moved.toEnd) - Date.parse(sample.endAt)) / 60000, 15);
  const resized = previewTimelineEdit(sample, [], new Date(2026, 9, 14, 12), 'resize', -15);
  assert.equal(resized.toStart, sample.startAt);
  assert.equal((Date.parse(resized.toEnd) - Date.parse(sample.endAt)) / 60000, -15);
  assert.throws(() => previewTimelineEdit(sample, [], new Date(2026, 9, 14, 12), 'resize', -90), /15 minutes/);
  assert.throws(() => previewTimelineEdit(sample, [], new Date(2026, 9, 14, 12), 'move', 11), /15-minute/);
  const month = monthGridDays(new Date(2026, 9, 14, 12));
  assert.equal(month.length, 35);
  assert.equal(localDayKey(month[0]), '2026-09-28');
  assert.equal(localDayKey(month.at(-1)), '2026-11-01');
  assert.equal(monthGridDays(new Date(2026, 7, 10, 12)).length, 42);
});

test('overlapping time blocks split their timeline lanes, consecutive blocks reuse width', () => {
  assert.equal(calendarSwipeDirection(-90, 15), 1);
  assert.equal(calendarSwipeDirection(90, 15), -1);
  assert.equal(calendarSwipeDirection(40, 0), 0);
  assert.equal(calendarSwipeDirection(90, 75), 0);

  const instant = (hours, minutes) => new Date(2026, 9, 14, hours, minutes).toISOString();
  const make = (id, startAt, endAt) => ({ id, startAt, endAt });
  const blocks = [
    make('a', instant(9, 0), instant(10, 0)),
    make('b', instant(9, 30), instant(10, 30)),
    make('c', instant(11, 0), instant(12, 0)),
  ];
  const placed = layoutBlocks(blocks);
  assert.deepEqual(placed.map((b) => b.lanes), [2, 2, 1]);
  assert.deepEqual(placed.map((b) => b.lane), [0, 1, 0]);
  assert.equal(placed[0].top, 9 * 64);
  // At compact zoom, 15-minute cards are taller than their scheduled slot.
  // Side-by-side lanes keep neighboring cards tappable rather than covering them.
  const short = [0, 15, 30].map((minute, i) => make(
    'short-' + i, instant(13, minute), instant(13, minute + 15),
  ));
  const compressed = layoutBlocks(short, 56);
  assert.deepEqual(compressed.map((item) => item.lane), [0, 1, 2]);
  assert.deepEqual(compressed.map((item) => item.lanes), [3, 3, 3]);
  assert.ok(compressed.every((item) => item.height >= 30));
  const load = analyzeDayLoad([
    { startAt: instant(9, 0), endAt: instant(10, 0) },
    { startAt: instant(9, 30), endAt: instant(10, 30) },
  ], new Date(2026, 9, 14, 12));
  const offsetClock = clockWithUtcOffset(new Date(2026, 9, 14, 9, 30));
  assert.ok(/^09:30 UTC[+-][0-9]{2}:[0-9]{2}$/.test(offsetClock));
  assert.deepEqual([load.reservedMinutes, load.occupiedMinutes, load.overlapMinutes, load.dayMinutes],
    [120, 90, 30, 1440]);
  const from = Date.parse(instant(9, 0)), to = Date.parse(instant(11, 0));
  const calendar = [
    { startAt: instant(8, 30), endAt: instant(10, 0) },
    { startAt: instant(9, 30), endAt: instant(10, 30) },
    { startAt: instant(13, 0), endAt: instant(14, 0) },
  ];
  const range = analyzeRangeLoad(calendar, from, to);
  assert.deepEqual(range, { reservedMinutes: 120, occupiedMinutes: 90, overlapMinutes: 30 });
  assert.equal(blockOverlapsRange(calendar[0], from, to), true);
  assert.equal(blockOverlapsRange(calendar[2], from, to), false);
  const dense = [
    ...Array.from({ length: 4 }, (_, index) => ({ startAt: instant(9, index * 5), endAt: instant(10, 0) })),
    { startAt: instant(10, 0), endAt: instant(11, 0) },
  ];
  assert.equal(peakOverlap(dense, from, to), 4);
  assert.equal(peakOverlap([], from, to), 0);
  assert.deepEqual(analyzeRangeLoad([], from, to), {
    reservedMinutes: 0, occupiedMinutes: 0, overlapMinutes: 0,
  });
  assert.throws(() => analyzeRangeLoad(calendar, to, from), /valid time range/);
  // Semantic timeline surfaces retain readable white text in both themes.
  const luminance = (hex) => {
    const channels = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
    const linear = channels.map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  };
  for (const ink of [semantic.timeline.planned, semantic.timeline.timebox,
    semantic.timeline.completed, semantic.timeline.now]) {
    assert.ok((1.05 / (luminance(ink) + 0.05)) >= 4.5, ink + ' lacks white-text contrast');
  }

  // A real recovery proposal must preserve fixed time and move only opted-in blocks.
  const local = (h, m) => new Date(2026, 9, 14, h, m).toISOString();
  const sample = [
    { id: 'flex-a', goalId: 'ga', goalTitle: 'Write', goalCompleted: false, flexible: true,
      startAt: local(13, 0), endAt: local(13, 30), kind: 'block', intention: '' },
    { id: 'fixed', goalId: 'gf', goalTitle: 'Meeting', goalCompleted: false, flexible: false,
      startAt: local(13, 30), endAt: local(14, 0), kind: 'block', intention: '' },
    { id: 'flex-b', goalId: 'gb', goalTitle: 'Build', goalCompleted: false, flexible: true,
      startAt: local(14, 0), endAt: local(14, 30), kind: 'block', intention: '' },
  ];
  const day = new Date(2026, 9, 14, 12);
  const recovered = previewReplan(sample, { day, now: new Date(2026, 9, 14, 12, 50), mode: 'recover' });
  assert.deepEqual(recovered.moves.map((move) => move.id), ['flex-a', 'flex-b']);
  assert.equal(recovered.moves[0].toStart, local(14, 0));
  assert.equal(recovered.moves[1].toStart, local(14, 30));
  assert.equal(recovered.protectedCount, 1);
  assert.equal(sample[0].startAt, local(13, 0)); // preview cannot modify its input
  assert.throws(() => previewReplan(sample, { day, now: new Date(2026, 9, 14, 12, 50),
    mode: 'extend', targetId: 'flex-a', extraMinutes: 30 }), /conflicts/);
});

test('focus time uses an absolute deadline and stays correct after delayed ticks or app suspension', () => {
  const session = { status: 'running', deadlineMs: 185000, remainingMs: 65000 };
  assert.equal(getFocusRemainingMs(session, 120000), 65000);
  assert.equal(getFocusRemainingMs(session, 10000), 65000); // Manual clock rollback cannot add minutes.
  assert.equal(getFocusRemainingMs(session, 170001), 14999);
  assert.equal(getFocusRemainingMs(session, 190000), 0);
  assert.equal(getFocusRemainingMs({ ...session, status: 'paused', remainingMs: 32000 }, 300000), 32000);
  assert.equal(formatFocusTime(65000), '01:05');
  assert.equal(formatFocusTime(3_661_000), '1:01:01');
  assert.equal(formatFocusTime(0), '00:00');
});

test('timebox duration matches the actual scheduled instants and rejects invalid limits', () => {
  assert.equal(getFocusDurationMs('2026-10-14T09:00:00.000Z', '2026-10-14T10:30:00.000Z'), 90 * 60000);
  assert.throws(() => getFocusDurationMs('2026-10-14T10:00:00.000Z', '2026-10-14T09:00:00.000Z'));
  assert.throws(() => getFocusDurationMs('bad', '2026-10-14T09:00:00.000Z'));
  assert.throws(() => getFocusDurationMs('2026-10-14T09:00:00.000Z', '2026-10-16T09:00:00.000Z'));
});

test('focus history counts only active seconds across pause and restart, capped at timebox length', () => {
  const base = { status: 'running', durationMs: 600000, remainingMs: 600000,
    elapsedMs: 0, deadlineMs: 1600000 };
  assert.equal(getFocusElapsedMs(base, 1060000), 60000);
  const paused = { ...base, status: 'paused', remainingMs: 540000, elapsedMs: 60000 };
  assert.equal(getFocusElapsedMs(paused, 1800000), 60000);
  const resumed = { ...paused, status: 'running', deadlineMs: 2340000 };
  assert.equal(getFocusElapsedMs(resumed, 1920000), 180000);
  assert.equal(getFocusElapsedMs(resumed, 3000000), 600000);
});

test('overnight blocks preserve local clock and show only the segment visible on each day', () => {
  const range = timeRangeFromInput({
    date: '2026-10-14', start: '23:30', end: '00:30', endsNextDay: true,
  });
  assert.equal((Date.parse(range.endAt) - Date.parse(range.startAt)) / 60000, 60);
  const block = { id: 'night', goalId: 'g', goalTitle: 'Study', startAt: range.startAt, endAt: range.endAt };
  const first = layoutBlocks([block], 60, new Date(2026, 9, 14, 12))[0];
  const next = layoutBlocks([block], 60, new Date(2026, 9, 15, 12))[0];
  assert.equal(first.top, 23.5 * 60);
  assert.equal(first.height, 30);
  assert.equal(next.top, 0);
  assert.equal(next.height, 30);
  assert.equal(blockClockRangeForDay(block, new Date(2026, 9, 14, 12)), '23:30 – 24:00');
  assert.equal(blockClockRangeForDay(block, new Date(2026, 9, 15, 12)), '00:00 – 00:30');
  assert.equal(blockClockRangeForDay(block, new Date(2026, 9, 16, 12)), '');
  assert.deepEqual(layoutBlocks([block], 60, new Date(2026, 9, 16, 12)), []);
  assert.throws(() => timeRangeFromInput({
    date: '2026-10-14', start: '23:30', end: '00:30',
  }), /Next day/);
});

test('invalid and repeated local DST hours are rejected without silently changing time', () => {
  const previousTimezone = process.env.TZ;
  process.env.TZ = 'America/New_York';
  try {
    assert.throws(() => timeRangeFromInput({
      date: '2026-03-08', start: '02:30', end: '04:00',
    }), /does not exist/);
    assert.throws(() => timeRangeFromInput({
      date: '2026-11-01', start: '01:30', end: '03:00',
    }), /occurs twice/);
    const normal = timeRangeFromInput({ date: '2026-11-01', start: '03:00', end: '04:00' });
    assert.equal((Date.parse(normal.endAt) - Date.parse(normal.startAt)) / 60000, 60);
    const spring = localDayBounds(new Date(2026, 2, 8, 12));
    const autumn = localDayBounds(new Date(2026, 10, 1, 12));
    assert.equal((Date.parse(spring.to) - Date.parse(spring.from)) / 3600000, 23);
    assert.equal((Date.parse(autumn.to) - Date.parse(autumn.from)) / 3600000, 25);
  } finally {
    if (previousTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = previousTimezone;
  }
});

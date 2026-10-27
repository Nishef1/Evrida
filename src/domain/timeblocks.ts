import type { Horizon } from './horizons';

/** Calendar blocks are scheduled occurrences, separate from a goal's Horizon. */
export type BlockKind = 'block' | 'box';
export interface BlockInput {
  goalId: string;
  date: string; // local YYYY-MM-DD
  start: string; // local HH:mm
  end: string;
  endsNextDay?: boolean; // explicitly allow scheduling into the following local date
  kind: BlockKind;
  intention: string;
  flexible?: boolean; // opt-in: only these reservations may be moved by Recovery
}
export interface TimeBlock {
  id: string;
  goalId: string;
  goalTitle: string;
  goalCompleted: boolean;
  goalHorizon?: Horizon; // colors the block; absent only in synthetic read models
  startAt: string; // UTC ISO instant, display in device local timezone
  endAt: string;
  kind: BlockKind;
  intention: string;
  flexible: boolean;
  updatedAt?: string; // Saved revision for optimistic editing; missing only in synthetic read models.
}
export function localDayKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
export function localClock(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
/** Include absolute UTC offset on clock-change dates where local times repeat. */
export function clockWithUtcOffset(date: Date): string {
  const east = -date.getTimezoneOffset();
  const sign = east >= 0 ? '+' : '-';
  const abs = Math.abs(east);
  return localClock(date) + ' UTC' + sign + String(Math.floor(abs / 60)).padStart(2, '0') +
    ':' + String(abs % 60).padStart(2, '0');
}
export function parseLocalDay(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0, 0);
  return Number(match[1]) === date.getFullYear()
    && Number(match[2]) === date.getMonth() + 1
    && Number(match[3]) === date.getDate() ? date : null;
}
export function shiftLocalDay(date: Date, days: number): Date {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  next.setDate(next.getDate() + days);
  return next;
}
export function timeRangeFromInput(input: Pick<BlockInput, 'date' | 'start' | 'end' | 'endsNextDay'>): { startAt: string; endAt: string } {
  const day = parseLocalDay(input.date);
  if (!day) throw new Error('Enter a valid date (YYYY-MM-DD).');
  const parseClock = (value: string) => {
    const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
    if (!m) throw new Error('Enter a 24-hour time, e.g. 09:30.');
    return [Number(m[1]), Number(m[2])] as const;
  };
  const make = (value: string, nextDay: boolean) => {
    const [h, m] = parseClock(value);
    const target = nextDay ? shiftLocalDay(day, 1) : day;
    const result = new Date(target.getFullYear(), target.getMonth(), target.getDate(), h, m);
    // Reject nonexistent clock times when clocks jump forward.
    if (result.getHours() !== h || result.getMinutes() !== m || localDayKey(result) !== localDayKey(target)) {
      throw new Error('That clock time does not exist on this date because of a time-zone change.');
    }
    // In a fall-back transition a clock time can map to two instants.
    // Reject ambiguous input instead of silently choosing the wrong occurrence.
    const before = shiftLocalDay(target, -1);
    const after = shiftLocalDay(target, 1);
    const offsetShiftMinutes = Math.abs(
      new Date(after.getFullYear(), after.getMonth(), after.getDate(), 12).getTimezoneOffset() -
      new Date(before.getFullYear(), before.getMonth(), before.getDate(), 12).getTimezoneOffset()
    );
    if (offsetShiftMinutes > 0) {
      const alternative = new Date(result.getTime() + offsetShiftMinutes * 60000);
      if (localDayKey(alternative) === localDayKey(target) &&
          alternative.getHours() === h && alternative.getMinutes() === m) {
        throw new Error('That clock time occurs twice on this date. Choose an unambiguous time.');
      }
    }
    return result;
  };
  const start = make(input.start, false);
  const end = make(input.end, input.endsNextDay === true);
  if (end.getTime() <= start.getTime()) {
    throw new Error('End time must follow start time. Enable "Next day" for an overnight block.');
  }
  if (end.getTime() - start.getTime() > 24 * 60 * 60 * 1000) {
    throw new Error('A scheduled block cannot exceed 24 hours.');
  }
  return { startAt: start.toISOString(), endAt: end.toISOString() };
}
/** Local-time label for the portion of a block visible on a selected day. */
export function blockClockRangeForDay(block: Pick<TimeBlock, 'startAt' | 'endAt'>, day: Date): string {
  const { from, to } = localDayBounds(day);
  const lower = Date.parse(from);
  const upper = Date.parse(to);
  const startMs = Date.parse(block.startAt);
  const endMs = Date.parse(block.endAt);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) ||
      startMs >= upper || endMs <= lower || endMs <= startMs) return '';
  return (startMs < lower ? '00:00' : localClock(new Date(startMs))) +
    ' – ' + (endMs >= upper ? '24:00' : localClock(new Date(endMs)));
}

export function localDayBounds(day: Date): { from: string; to: string } {
  const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0);
  const next = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1, 0, 0);
  return { from: start.toISOString(), to: next.toISOString() };
}
/** The month grid includes leading/trailing days from adjacent months, not just the numbered month. */
export function monthGridDays(anchor: Date): Date[] {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1, 12);
  const leading = (first.getDay() + 6) % 7;
  const gridStart = shiftLocalDay(first, -leading);
  const cells = Math.ceil((leading +
    new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate()) / 7) * 7;
  return Array.from({ length: cells }, (_, index) => shiftLocalDay(gridStart, index));
}

/** Peak simultaneous reservations inside an absolute interval. Adjacent end/start
 * at the same instant are not treated as overlapping. */
export function peakOverlap(blocks: readonly Pick<TimeBlock, 'startAt' | 'endAt'>[],
  from: number, to: number): number {
  const boundaries: { time: number; delta: -1 | 1 }[] = [];
  for (const block of blocks) {
    const start = Math.max(from, Date.parse(block.startAt));
    const end = Math.min(to, Date.parse(block.endAt));
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
    boundaries.push({ time: start, delta: 1 }, { time: end, delta: -1 });
  }
  boundaries.sort((a, b) => a.time - b.time || a.delta - b.delta);
  let active = 0, peak = 0;
  for (const point of boundaries) { active += point.delta; peak = Math.max(peak, active); }
  return peak;
}

/** Shared interval inclusion predicate for query-derived calendar views. */
export function blockOverlapsRange(block: Pick<TimeBlock, 'startAt' | 'endAt'>, from: number, to: number): boolean {
  return Date.parse(block.startAt) < to && Date.parse(block.endAt) > from;
}

export interface PlacedBlock {
  block: TimeBlock;
  top: number;
  height: number;
  lane: number;
  lanes: number;
}
/** Each overlapping group shares horizontal space; split overnight blocks at local-day boundaries. */
export function layoutBlocks(blocks: readonly TimeBlock[], hourHeight = 64, day?: Date): PlacedBlock[] {
  const bounds = day ? localDayBounds(day) : null;
  const dayFrom = bounds ? Date.parse(bounds.from) : -Infinity;
  const dayTo = bounds ? Date.parse(bounds.to) : Infinity;
  const ordered = [...blocks].sort((a, b) =>
    a.startAt.localeCompare(b.startAt) || a.endAt.localeCompare(b.endAt) || a.id.localeCompare(b.id));
  const result: PlacedBlock[] = [];
  let group: PlacedBlock[] = [];
  let groupEnd = -Infinity;
  let active: { end: number; lane: number }[] = [];
  function flush() {
    const lanes = Math.max(1, ...group.map((item) => item.lane + 1));
    for (const item of group) item.lanes = lanes;
    group = [];
    active = [];
  }
  for (const block of ordered) {
    const rawStart = Date.parse(block.startAt);
    const rawEnd = Date.parse(block.endAt);
    const startMs = Math.max(rawStart, dayFrom);
    const endMs = Math.min(rawEnd, dayTo);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) continue;
    const start = new Date(startMs);
    const end = new Date(endMs);
    const beginMinutes = start.getHours() * 60 + start.getMinutes();
    // A local midnight end belongs at 24:00 on the *displayed* day.
    const endMinutes = day && endMs === dayTo ? 1440 : end.getHours() * 60 + end.getMinutes();
    const visualDuration = day ? Math.max(0, endMinutes - beginMinutes) : (endMs - startMs) / 60000;
    const top = beginMinutes / 60 * hourHeight;
    const height = Math.max(30, visualDuration / 60 * hourHeight);
    // Avoid covering adjacent short blocks: their minimum *rendered* height may
    // overlap even when their actual scheduled times do not.
    if (top >= groupEnd && group.length) flush();
    active = active.filter((item) => item.end > top);
    const occupied = new Set(active.map((item) => item.lane));
    let lane = 0;
    while (occupied.has(lane)) lane++;
    active.push({ end: top + height, lane });
    groupEnd = Math.max(groupEnd, top + height);
    const placement: PlacedBlock = {
      block, top, height,
      lane, lanes: 1,
    };
    group.push(placement);
    result.push(placement);
  }
  if (group.length) flush();
  return result;
}

/** Sum the union of timestamp intervals, never double-counting overlapping commitments. */
export function occupiedMilliseconds(intervals: readonly { start: number; end: number }[]): number {
  const ordered = intervals.filter((slot) =>
    Number.isFinite(slot.start) && Number.isFinite(slot.end) && slot.end > slot.start)
    .sort((a, b) => a.start - b.start || a.end - b.end);
  let occupied = 0, coveredUntil = -Infinity;
  for (const slot of ordered) {
    occupied += Math.max(0, slot.end - Math.max(slot.start, coveredUntil));
    coveredUntil = Math.max(coveredUntil, slot.end);
  }
  return occupied;
}

/** SSOT for clipped time accounting across Day, Week, Month and budget summaries.
 * "reserved" sums blocks; "occupied" unions intervals, excluding double-counted overlaps. */
export function analyzeRangeLoad(
  blocks: readonly Pick<TimeBlock, 'startAt' | 'endAt'>[],
  from: number,
  to: number,
) {
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) {
    throw new Error('Choose a valid time range.');
  }
  const slots = blocks.map((block) => ({
    start: Math.max(from, Date.parse(block.startAt)),
    end: Math.min(to, Date.parse(block.endAt)),
  })).filter(({ start, end }) => Number.isFinite(start) && Number.isFinite(end) && end > start);
  const reservedMs = slots.reduce((total, slot) => total + slot.end - slot.start, 0);
  const occupiedMs = occupiedMilliseconds(slots);
  return {
    reservedMinutes: Math.round(reservedMs / 60000),
    occupiedMinutes: Math.round(occupiedMs / 60000),
    overlapMinutes: Math.round((reservedMs - occupiedMs) / 60000),
  };
}

export function analyzeDayLoad(blocks: readonly Pick<TimeBlock, 'startAt' | 'endAt'>[], day: Date) {
  const bounds = localDayBounds(day);
  const from = Date.parse(bounds.from), to = Date.parse(bounds.to);
  return { ...analyzeRangeLoad(blocks, from, to), dayMinutes: Math.round((to - from) / 60000) };
}

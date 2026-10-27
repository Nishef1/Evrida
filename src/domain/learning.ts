import { isDateKey } from './finance';

/**
 * Learning topics are tracked by the user's own honest self-rating (1–10). Evrida keeps the history and shows
 * the trend; it never judges mastery, and time practised is stored separately from the score.
 */
export interface LearnTopic {
  id: string; subject: string; name: string; note: string; focus: boolean; archived: boolean;
  targetScore: number | null; targetDate: string | null; goalId: string | null;
}
export interface LearnCheckin {
  id: string; topicId: string; date: string; score: number; minutes: number | null; covered: string; note: string; createdAt: string;
}

export const MIN_SCORE = 1;
export const MAX_SCORE = 10;
export const SCORE_BANDS: { from: number; to: number; text: string }[] = [
  { from: 1, to: 2, text: 'Barely know it or hardly remember it' },
  { from: 3, to: 4, text: 'Partly understand it; I need help to use it' },
  { from: 5, to: 6, text: 'I can use it, but still make many mistakes' },
  { from: 7, to: 8, text: 'Usually correct; I need a little help' },
  { from: 9, to: 10, text: 'Nearly independent and natural, even in new situations' },
];
export const bandLabel = (score: number): string => SCORE_BANDS.find((b) => score >= b.from && score <= b.to)?.text ?? '';

const DAY_MS = 86400000;
const utc = (key: string) => { const [y, m, d] = key.split('-').map(Number); return Date.UTC(y, m - 1, d); };
export const daysBetween = (from: string, to: string): number => Math.round((utc(to) - utc(from)) / DAY_MS);
const keyOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const addDays = (key: string, days: number): string => keyOf(utc(key) + days * DAY_MS);
/** Monday of the week containing `key`. */
export function weekStart(key: string): string {
  const day = new Date(utc(key)).getUTCDay();
  return addDays(key, -((day + 6) % 7));
}

const normalizeNumericDigits = (text: string) => text
  .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x06f0))
  .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660));

export function parseScore(text: string): number | null {
  const t = normalizeNumericDigits(text.trim());
  if (!/^\d{1,2}$/.test(t)) return null;
  const n = Number(t);
  return n >= MIN_SCORE && n <= MAX_SCORE ? n : null;
}
export function parseMinutes(text: string): number | null | 'invalid' {
  const t = normalizeNumericDigits(text).replace(/[,،٬\s]/g, '');
  if (!t) return null;
  if (!/^\d{1,5}$/.test(t)) return 'invalid';
  const n = Number(t);
  return n <= 10080 ? n : 'invalid';
}

export function validateCheckin(c: { date: string; score: number; minutes: number | null; covered: string; note: string }): string | null {
  if (!isDateKey(c.date)) return 'Choose a valid date.';
  if (!Number.isInteger(c.score) || c.score < MIN_SCORE || c.score > MAX_SCORE) return 'Give a mastery score from 1 to 10.';
  if (c.minutes !== null && (!Number.isInteger(c.minutes) || c.minutes < 0 || c.minutes > 10080)) return 'Minutes practised must be between 0 and 10,080.';
  if (c.covered.length > 1000 || c.note.length > 2000) return 'That text is too long.';
  return null;
}

const byTime = (a: LearnCheckin, b: LearnCheckin) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt);
export const historyOf = (topicId: string, all: LearnCheckin[]): LearnCheckin[] => all.filter((c) => c.topicId === topicId).sort(byTime);

export interface TopicProgress { latest: LearnCheckin | null; previous: LearnCheckin | null; change: number | null; count: number; minutes: number }
export function topicProgress(history: LearnCheckin[]): TopicProgress {
  const latest = history[history.length - 1] ?? null;
  const previous = history.length > 1 ? history[history.length - 2] : null;
  return { latest, previous, change: latest && previous ? latest.score - previous.score : null, count: history.length,
    minutes: history.reduce((sum, c) => sum + (c.minutes ?? 0), 0) };
}
export const trendPoints = (history: LearnCheckin[], limit = 12): { date: string; score: number }[] =>
  history.slice(-limit).map((c) => ({ date: c.date, score: c.score }));

export const groupBySubject = (topics: LearnTopic[]): { subject: string; topics: LearnTopic[] }[] => {
  const map = new Map<string, LearnTopic[]>();
  for (const t of topics) map.set(t.subject, [...(map.get(t.subject) ?? []), t]);
  return [...map].map(([subject, list]) => ({ subject, topics: list }));
};

export interface WeekRow {
  topic: LearnTopic; entry: LearnCheckin | null; before: number | null; change: number | null; minutes: number; effortNote: string | null;
}
/** What happened to each open topic in the week starting `weekKey` (Monday). Only the user's recorded numbers are used. */
export function weeklyReview(topics: LearnTopic[], checkins: LearnCheckin[], weekKey: string): { rows: WeekRow[]; checkedIn: number; open: number; minutes: number } {
  const end = addDays(weekKey, 6);
  const rows = topics.filter((t) => !t.archived).map((topic): WeekRow => {
    const history = historyOf(topic.id, checkins);
    const inWeek = history.filter((c) => c.date >= weekKey && c.date <= end);
    const entry = inWeek[inWeek.length - 1] ?? null;
    const earlier = history.filter((c) => c.date < weekKey);
    const before = earlier.length ? earlier[earlier.length - 1].score : null;
    const change = entry && before !== null ? entry.score - before : null;
    const minutes = inWeek.reduce((sum, c) => sum + (c.minutes ?? 0), 0);
    const effortNote = entry && change !== null && change <= 0 && minutes >= 120
      ? `${minutes} min practised, but your score ${change === 0 ? 'stayed the same' : 'dropped'}. That is useful to know; it may mean a different approach.` : null;
    return { topic, entry, before, change, minutes, effortNote };
  });
  return { rows, checkedIn: rows.filter((r) => r.entry).length, open: rows.length, minutes: rows.reduce((s, r) => s + r.minutes, 0) };
}

export interface Suggestion { topic: LearnTopic; reason: string }
/** Candidates for next week's focus, derived only from the user's own scores and dates; never an assessment. */
export function focusSuggestions(topics: LearnTopic[], checkins: LearnCheckin[], today: string, limit = 3): Suggestion[] {
  const out: (Suggestion & { rank: number })[] = [];
  for (const topic of topics.filter((t) => !t.archived && !t.focus)) {
    const { latest } = topicProgress(historyOf(topic.id, checkins));
    if (!latest) { out.push({ topic, reason: 'Not rated yet', rank: 0 }); continue; }
    const age = daysBetween(latest.date, today);
    if (age >= 14) out.push({ topic, reason: `Last rated ${age} days ago (${latest.score}/10)`, rank: 1 + latest.score / 100 });
    else if (latest.score <= 5) out.push({ topic, reason: `Rated ${latest.score}/10`, rank: 2 + latest.score / 100 });
  }
  return out.sort((a, b) => a.rank - b.rank).slice(0, limit).map(({ topic, reason }) => ({ topic, reason }));
}

export interface PaceEstimate {
  status: 'reached' | 'estimate' | 'unknown'; perWeek: number | null; likely: string | null; late: string | null; reason: string;
}
/**
 * A rough projection from the user's own last ratings (least-squares slope over up to six check-ins).
 * It needs at least three ratings spanning two weeks, is always provisional, and says why when it cannot estimate.
 */
export function paceEstimate(history: LearnCheckin[], targetScore: number, today: string): PaceEstimate {
  const latest = history[history.length - 1];
  if (!latest) return { status: 'unknown', perWeek: null, likely: null, late: null, reason: 'Rate this topic to start a trend.' };
  if (latest.score >= targetScore) return { status: 'reached', perWeek: null, likely: null, late: null, reason: 'You rated yourself at or above your target.' };
  const recent = history.slice(-6);
  const span = daysBetween(recent[0].date, recent[recent.length - 1].date);
  if (recent.length < 3 || span < 14) return { status: 'unknown', perWeek: null, likely: null, late: null, reason: 'Needs at least three ratings over two weeks before a date can be estimated.' };
  const xs = recent.map((c) => daysBetween(recent[0].date, c.date));
  const meanX = xs.reduce((a, b) => a + b, 0) / xs.length;
  const meanY = recent.reduce((a, c) => a + c.score, 0) / recent.length;
  const denominator = xs.reduce((a, x) => a + (x - meanX) ** 2, 0);
  const slope = denominator === 0 ? 0 : xs.reduce((a, x, i) => a + (x - meanX) * (recent[i].score - meanY), 0) / denominator;
  if (slope < 0.01) return { status: 'unknown', perWeek: slope * 7, likely: null, late: null, reason: 'Your recent ratings have not been rising, so no date can be estimated.' };
  const days = (targetScore - latest.score) / slope;
  return { status: 'estimate', perWeek: slope * 7, likely: addDays(today, Math.ceil(days)), late: addDays(today, Math.ceil(days * 2)),
    reason: 'A rough projection from your own recent ratings. Progress often slows near the top, so treat it as a guide.' };
}

type Row = Record<string, unknown>;
const bad = (what: string): never => { throw new Error(`Invalid backup: invalid learning ${what}.`); };
const text = (v: unknown, max: number) => typeof v === 'string' && v.length <= max;
export function validateLearningBackup(t: Record<string, Row[]>, goalIds: Set<unknown>): void {
  const topics = new Set<unknown>();
  for (const r of t.learn_topics) {
    if (!text(r.subject, 80) || !String(r.subject).trim() || !text(r.name, 120) || !String(r.name).trim() || !text(r.note, 2000)
      || ![0, 1].includes(r.focus as number)
      || (r.target_score !== null && (!Number.isInteger(r.target_score) || Number(r.target_score) < MIN_SCORE || Number(r.target_score) > MAX_SCORE))
      || (r.target_date !== null && (typeof r.target_date !== 'string' || !isDateKey(r.target_date)))
      || (r.target_date !== null && r.target_score === null)
      || (r.goal_id !== null && !goalIds.has(r.goal_id))) bad('topic');
    topics.add(r.id);
  }
  for (const r of t.learn_checkins) {
    if (!topics.has(r.topic_id) || typeof r.date !== 'string' || !isDateKey(r.date) || !Number.isInteger(r.score)
      || Number(r.score) < MIN_SCORE || Number(r.score) > MAX_SCORE || !text(r.covered, 1000) || !text(r.note, 2000)
      || (r.minutes !== null && (!Number.isInteger(r.minutes) || Number(r.minutes) < 0 || Number(r.minutes) > 10080))) bad('check-in');
  }
}

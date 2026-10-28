/** Horizontal page turns need deliberate travel and must not match vertical scrolling. */
export function calendarSwipeDirection(dx: number, dy: number): -1 | 0 | 1 {
  if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.8) return 0;
  return dx < 0 ? 1 : -1;
}

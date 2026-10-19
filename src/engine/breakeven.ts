/**
 * Break-even on cumulative series.
 *
 * Series are indexed by month with index 0 = the start (before any month has passed),
 * so `series[12]` is the position after 12 months.
 */

/** Running total with a starting value at index 0: [start, start + s1, start + s1 + s2, …]. */
export function cumulative(monthly: readonly number[], start = 0): number[] {
  const out = [start];
  let total = start;
  for (const value of monthly) {
    total += value;
    out.push(total);
  }
  return out;
}

export interface Breakeven {
  /** First whole month at which A ≥ B. */
  month: number;
  /** Linear interpolation between the month before and `month`, for "≈25.3 months" style output. */
  fractionalMonth: number;
}

/** First month where cumulative A ≥ cumulative B, or null if that never happens within the series. */
export function breakeven(cumA: readonly number[], cumB: readonly number[]): Breakeven | null {
  const length = Math.min(cumA.length, cumB.length);
  for (let i = 0; i < length; i++) {
    const gapNow = cumA[i]! - cumB[i]!;
    if (gapNow < 0) continue;
    if (i === 0) return { month: 0, fractionalMonth: 0 };
    const gapBefore = cumB[i - 1]! - cumA[i - 1]!;
    return { month: i, fractionalMonth: i - 1 + gapBefore / (gapBefore + gapNow) };
  }
  return null;
}

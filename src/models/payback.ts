/**
 * The general break-even: pay `extra` more today to save `monthlySaving` every month. When do the
 * savings cover it, first ignoring interest, then counting interest on the extra price (borrowed,
 * or the return it could have earned)? The tools work this out with their own detail; this is the
 * bare idea, for the break-even guide.
 */
import { breakeven, cumulative, type Breakeven } from '@/engine/breakeven';
import { nominalToMonthly } from '@/engine/timeValue';

export interface PaybackResult {
  /** Savings so far, index = month, 0 = today. */
  saved: number[];
  /** The extra price grown at the interest rate, index = month. */
  owed: number[];
  noInterest: Breakeven | null;
  withInterest: Breakeven | null;
}

export function payback(
  extra: number,
  monthlySaving: number,
  interestRate: number,
  months = 120,
): PaybackResult {
  if (!(extra >= 0 && monthlySaving >= 0 && interestRate >= 0)) {
    throw new RangeError('extra price, saving and rate must not be negative');
  }
  if (!Number.isInteger(months) || months < 1)
    throw new RangeError('months: a positive whole number');
  const r = nominalToMonthly(interestRate);
  const saved = cumulative(Array<number>(months).fill(monthlySaving));
  const owed = saved.map((_, m) => extra * Math.pow(1 + r, m));
  return {
    saved,
    owed,
    noInterest: breakeven(saved, Array<number>(months + 1).fill(extra)),
    withInterest: breakeven(saved, owed),
  };
}

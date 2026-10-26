/**
 * A plan with life cover against the alternative: a term plan for the same cover, with the rest of
 * each premium invested. The investment pays out exactly what the plan pays, on the same dates,
 * so both give the same money and the same cover; what is left in the investment at the end is
 * what the alternative gains (or, if negative, what it falls short by).
 *
 * Timing follows the plan's monthly timeline (index 0 = today, see planReturn.ts):
 * - Each plan premium goes into the investment the moment it would have been paid.
 * - The term premium is paid yearly at the start of each cover year (months 0, 12, 24…), from the
 *   investment.
 * - Each payout the plan makes, after the plan's tax, is taken out of the investment.
 * - The investment grows at one return a year after tax, compounded monthly. If it runs short,
 *   the gap grows at the same rate, as if you added the money and gave up that return on it.
 */
import { annualise, irr } from '@/engine/irr';
import { effectiveToMonthly, toTodaysRupees } from '@/engine/timeValue';
import type { PlanResult } from './planReturn';

export interface TermInput {
  plan: PlanResult;
  /** Whole years the term plan covers. */
  coverYears: number;
  /** Term premium a year, ₹; null when no quote has been entered yet. */
  termPremium: number | null;
  /** Return a year on what is invested, after tax, effective. */
  investReturn: number;
  /** For the today's-rupees figure. */
  inflation: number;
}

export interface TermYear {
  year: number;
  /** Plan premiums that went in instead, ₹. */
  invested: number;
  /** Term premiums paid, ₹. */
  term: number;
  /** The plan's payouts after tax, taken out, ₹. */
  taken: number;
  /** The investment at the end of the year, ₹. */
  balance: number;
}

export interface TermResult {
  /** Index of the last cash flow. */
  months: number;
  /** Term premium paid each month, ₹. */
  termByMonth: number[];
  /** The investment after each month's flows, ₹. */
  balanceByMonth: number[];
  /** Total term premiums, ₹. */
  termPaid: number;
  /** The investment at the end, ₹; positive means term plus investing comes out ahead. */
  leftover: number;
  /** leftover in today's rupees. */
  leftoverToday: number;
  /** First month the investment is below zero, or null if it never is. */
  shortMonth: number | null;
  /**
   * The most a term plan can cost a year for term plus investing to break even at this return;
   * null when even free cover would not (the plan earns more than the investment).
   */
  maxTermPremium: number | null;
  /**
   * The return a year after tax at which term plus investing exactly matches the plan, with the
   * term premium entered (without one, the plan's own return). Null when there is no such rate.
   */
  breakEvenReturn: number | null;
  years: TermYear[];
}

export function termVsPlan(input: TermInput): TermResult {
  const { plan } = input;
  const term = input.termPremium ?? 0;
  const coverMonths = Array.from({ length: input.coverYears }, (_, k) => 12 * k);
  const months = Math.max(plan.months, ...coverMonths);
  const at = (arr: number[], i: number) => arr[i] ?? 0;
  const termByMonth = new Array<number>(months + 1).fill(0);
  for (const m of coverMonths) termByMonth[m] = term;

  const rate = effectiveToMonthly(input.investReturn);
  const balanceByMonth: number[] = [];
  let balance = 0;
  let shortMonth: number | null = null;
  for (let i = 0; i <= months; i++) {
    balance =
      balance * (1 + rate) + at(plan.paidByMonth, i) - termByMonth[i]! - at(plan.keptByMonth, i);
    balanceByMonth.push(balance);
    // A cent of rounding is not a shortfall.
    if (shortMonth === null && balance < -0.005) shortMonth = i;
  }
  const leftover = balanceByMonth[months]!;

  // The leftover falls by one rupee of term premium times what that rupee would have grown to,
  // summed over the years it is paid.
  const termGrowth = coverMonths.reduce((s, m) => s + Math.pow(1 + rate, months - m), 0);
  const leftoverFree = leftover + term * termGrowth;
  const maxTermPremium = leftoverFree > 0 && termGrowth > 0 ? leftoverFree / termGrowth : null;

  // Seen from your pocket, the plan's payouts and the term premiums it saves you are what you get
  // for the plan premiums: the rate that balances them is where the two choices tie.
  const flows = Array.from(
    { length: months + 1 },
    (_, i) => at(plan.keptByMonth, i) + termByMonth[i]! - at(plan.paidByMonth, i),
  );
  const monthly = irr(flows);

  const years: TermYear[] = Array.from({ length: Math.ceil(months / 12) || 1 }, (_, i) => ({
    year: i + 1,
    invested: 0,
    term: 0,
    taken: 0,
    balance: 0,
  }));
  // As in the plan: a payment at the start of month i falls in year ⌊i / 12⌋ + 1, a payout at
  // the end of month i in year ⌈i / 12⌉.
  for (let i = 0; i <= months; i++) {
    const start = years[Math.min(years.length - 1, Math.floor(i / 12))]!;
    start.invested += at(plan.paidByMonth, i);
    start.term += termByMonth[i]!;
    years[Math.max(0, Math.ceil(i / 12) - 1)]!.taken += at(plan.keptByMonth, i);
  }
  // The year ends before the next year's premiums go in.
  for (const y of years) {
    const end = Math.min(months, 12 * y.year);
    y.balance =
      end === 12 * y.year
        ? balanceByMonth[end]! - at(plan.paidByMonth, end) + termByMonth[end]!
        : balanceByMonth[end]!;
  }

  return {
    months,
    termByMonth,
    balanceByMonth,
    termPaid: term * input.coverYears,
    leftover,
    leftoverToday: toTodaysRupees(leftover, input.inflation, months),
    shortMonth,
    maxTermPremium,
    breakEvenReturn: monthly === null ? null : annualise(monthly),
    years,
  };
}

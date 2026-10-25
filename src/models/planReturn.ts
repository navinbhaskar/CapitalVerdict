/**
 * A savings plan judged only by what goes in and what comes out: premiums paid, then a regular
 * income and lump sums received. The answer is the plan's return a year (its internal rate of
 * return), the one rate at which the premiums grow into exactly those payouts.
 *
 * Timing, month by month (index 0 = today):
 * - Premiums are paid at the start of each period: monthly at months 0, 1, 2…; yearly at months
 *   0, 12, 24…; once at month 0.
 * - A monthly income starting in plan year S is paid at the end of each month from the first month
 *   of year S (index 12(S − 1) + 1); a yearly income at the end of each year from year S.
 * - A lump sum in year Y is paid at the end of that year (index 12Y).
 *
 * Tax, if any, is one rate on everything received. Life cover and bonuses that are not guaranteed
 * are left out: the plan is judged on its guaranteed payouts.
 */
import { annualise, irr, npv } from '@/engine/irr';
import { effectiveToMonthly, realRate, toTodaysRupees } from '@/engine/timeValue';

export type PayFrequency = 'monthly' | 'yearly' | 'once';
export type IncomeFrequency = 'monthly' | 'yearly';

export interface LumpSum {
  /** ₹, before tax. */
  amount: number;
  /** Paid at the end of this plan year, 1 or more. */
  year: number;
}

export interface PlanInput {
  /** Each premium, ₹. */
  premium: number;
  payFrequency: PayFrequency;
  /** Whole years of premiums; ignored when paid once. */
  payYears: number;
  /** Each income payment, ₹ before tax; 0 for none. */
  income: number;
  incomeFrequency: IncomeFrequency;
  /** Plan year of the first income payment, 1 or more. */
  incomeStartYear: number;
  /** Whole years of income. */
  incomeYears: number;
  lumpSums: readonly LumpSum[];
  /** Tax on everything received, decimal; 0 when it is tax-free. */
  taxRate: number;
  /** For the real return and today's-rupees figures. */
  inflation: number;
}

export interface PlanYear {
  /** Plan year, 1-based. */
  year: number;
  /** Premiums paid in the year, ₹. */
  paid: number;
  /** Received in the year, before tax, ₹. */
  received: number;
  /** Tax on what was received, ₹. */
  tax: number;
  /** Kept so far after tax, minus paid so far, ₹. Negative until the plan has paid you back. */
  netToDate: number;
}

export interface PlanResult {
  /** Index of the last cash flow. */
  months: number;
  /** Net cash flow each month after tax, index 0 = today; negative = paid in. */
  flows: number[];
  /** Premiums paid each month, ₹. Kept apart from payouts, which can fall in the same month. */
  paidByMonth: number[];
  /** Payouts kept each month after tax, ₹. */
  keptByMonth: number[];
  /** Total premiums, ₹. */
  paid: number;
  /** Total received before tax, ₹. */
  received: number;
  tax: number;
  /** received − tax. */
  kept: number;
  /** The plan's return a year after tax, effective; null when nothing is paid in or received. */
  annualReturn: number | null;
  /** annualReturn after inflation. */
  realReturn: number | null;
  /** Month index of the first income payment, or null without an income. */
  firstIncomeMonth: number | null;
  /** The first income payment after tax, in today's rupees. */
  firstIncomeToday: number | null;
  /** First plan year in which you have got back at least what you paid, after tax; null if never. */
  paybackYear: number | null;
  years: PlanYear[];
}

/** Month indexes at which premiums are paid. */
export function premiumMonths(input: Pick<PlanInput, 'payFrequency' | 'payYears'>): number[] {
  if (input.payFrequency === 'once') return [0];
  const step = input.payFrequency === 'monthly' ? 1 : 12;
  const count = input.payFrequency === 'monthly' ? input.payYears * 12 : input.payYears;
  return Array.from({ length: count }, (_, i) => i * step);
}

/** Month indexes at which the regular income is paid. */
export function incomeMonths(
  input: Pick<PlanInput, 'income' | 'incomeFrequency' | 'incomeStartYear' | 'incomeYears'>,
): number[] {
  if (input.income <= 0 || input.incomeYears <= 0) return [];
  const start = 12 * (input.incomeStartYear - 1);
  if (input.incomeFrequency === 'monthly') {
    return Array.from({ length: input.incomeYears * 12 }, (_, i) => start + i + 1);
  }
  return Array.from({ length: input.incomeYears }, (_, i) => start + 12 * (i + 1));
}

export function planReturn(input: PlanInput): PlanResult {
  const pays = input.premium > 0 ? premiumMonths(input) : [];
  const incomes = incomeMonths(input);
  const lumps = input.lumpSums.filter((l) => l.amount > 0);
  const months = Math.max(0, ...pays, ...incomes, ...lumps.map((l) => 12 * l.year));
  const paidByMonth = new Array<number>(months + 1).fill(0);
  const keptByMonth = new Array<number>(months + 1).fill(0);
  const years: PlanYear[] = Array.from({ length: Math.max(1, Math.ceil(months / 12)) }, (_, i) => ({
    year: i + 1,
    paid: 0,
    received: 0,
    tax: 0,
    netToDate: 0,
  }));
  const yearAt = (y: number) => {
    while (years.length < y)
      years.push({ year: years.length + 1, paid: 0, received: 0, tax: 0, netToDate: 0 });
    return years[y - 1]!;
  };

  // A premium at the start of month i falls in year ⌊i / 12⌋ + 1; a payout at the end of month i
  // falls in year ⌈i / 12⌉.
  for (const m of pays) {
    paidByMonth[m]! += input.premium;
    yearAt(Math.floor(m / 12) + 1).paid += input.premium;
  }
  const receive = (m: number, amount: number) => {
    const tax = amount * input.taxRate;
    keptByMonth[m]! += amount - tax;
    const y = yearAt(Math.max(1, Math.ceil(m / 12)));
    y.received += amount;
    y.tax += tax;
  };
  for (const m of incomes) receive(m, input.income);
  for (const l of lumps) receive(12 * l.year, l.amount);

  let net = 0;
  let paybackYear: number | null = null;
  let paidSoFar = 0;
  for (const y of years) {
    net += y.received - y.tax - y.paid;
    paidSoFar += y.paid;
    y.netToDate = net;
    if (paybackYear === null && paidSoFar > 0 && net >= 0) paybackYear = y.year;
  }

  const paid = years.reduce((s, y) => s + y.paid, 0);
  const received = years.reduce((s, y) => s + y.received, 0);
  const tax = years.reduce((s, y) => s + y.tax, 0);
  const flows = keptByMonth.map((k, i) => k - paidByMonth[i]!);
  const monthly = irr(flows);
  const annualReturn = monthly === null ? null : annualise(monthly);
  const firstIncomeMonth = incomes[0] ?? null;
  return {
    months,
    flows,
    paidByMonth,
    keptByMonth,
    paid,
    received,
    tax,
    kept: received - tax,
    annualReturn,
    realReturn: annualReturn === null ? null : realRate(annualReturn, input.inflation),
    firstIncomeMonth,
    firstIncomeToday:
      firstIncomeMonth === null
        ? null
        : toTodaysRupees(input.income * (1 - input.taxRate), input.inflation, firstIncomeMonth),
    paybackYear,
    years,
  };
}

/**
 * What the same premiums would pay at another return a year (after tax), on the same dates:
 * every payout of the plan scaled by one factor. A factor of 1.4 means the same money at that
 * rate would pay 40% more at every step: ₹11,200 a month instead of ₹8,000, say.
 * Null when the plan pays nothing out.
 */
export function payoutScaleAt(result: PlanResult, annualRate: number): number | null {
  const rate = effectiveToMonthly(annualRate);
  const paidIn = npv(rate, result.paidByMonth);
  const paidOut = npv(rate, result.keptByMonth);
  return paidOut > 0 ? paidIn / paidOut : null;
}

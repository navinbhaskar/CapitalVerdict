/**
 * A floating-rate loan whose rate changes part way through. After the change the lender either
 * raises (or lowers) the EMI so the loan still ends on time, or keeps the EMI and changes the
 * number of months left. Interest is charged monthly at the yearly rate ÷ 12, as in emi.ts.
 */
import { emi as emiOf } from '@/engine/loan';
import { nominalToMonthly } from '@/engine/timeValue';

export type RateChangeMode = 'emi' | 'tenure';

export interface RateChangeInput {
  amount: number;
  /** Yearly rate at the start, decimal. */
  annualRate: number;
  /** Months agreed at the start. */
  months: number;
  /** The new rate applies from the month after this many EMIs (0 = from the first). */
  changeAfter: number;
  newRate: number;
  mode: RateChangeMode;
}

/** No loan is followed past this many months; beyond it the loan is reported as never repaid. */
export const MAX_LOAN_MONTHS = 1200;

export interface RateChangeResult {
  /** The EMI at the start, ₹. */
  emi: number;
  /** The EMI after the change, ₹. */
  newEmi: number;
  /** Owed when the rate changes, ₹. */
  balanceAtChange: number;
  /** Months from the start until the loan is repaid; null if the EMI never repays it. */
  totalMonths: number | null;
  /** Interest over the whole loan, ₹; null if it is never repaid. */
  totalInterest: number | null;
  /** True when the kept EMI does not even cover the first month's interest at the new rate. */
  emiBelowInterest: boolean;
}

export function rateChange(input: RateChangeInput): RateChangeResult {
  const first = emiOf(input.amount, input.annualRate, input.months);
  const r1 = nominalToMonthly(input.annualRate);
  const r2 = nominalToMonthly(input.newRate);
  let balance = input.amount;
  let interest = 0;
  let month = 0;
  for (; month < input.changeAfter && balance > 1e-6; month++) {
    const i = balance * r1;
    interest += i;
    balance = balance + i - Math.min(first, balance + i);
  }
  const balanceAtChange = balance;
  const left = input.months - month;
  const newEmi = input.mode === 'emi' && left > 0 ? emiOf(balance, input.newRate, left) : first;
  const emiBelowInterest = balance * r2 >= newEmi;
  if (emiBelowInterest) {
    return {
      emi: first,
      newEmi,
      balanceAtChange,
      totalMonths: null,
      totalInterest: null,
      emiBelowInterest,
    };
  }
  while (balance > 1e-6 && month < MAX_LOAN_MONTHS) {
    const i = balance * r2;
    interest += i;
    balance = balance + i - Math.min(newEmi, balance + i);
    month++;
  }
  const repaid = balance <= 1e-6;
  return {
    emi: first,
    newEmi,
    balanceAtChange,
    totalMonths: repaid ? month : null,
    totalInterest: repaid ? interest : null,
    emiBelowInterest,
  };
}

/**
 * The rate a floating loan would have to move to after `changeAfter` months (with the EMI reset to
 * keep the end date) for its total interest to match a fixed rate for the whole loan.
 */
export function breakEvenRise(
  base: Omit<RateChangeInput, 'newRate' | 'mode'>,
  fixedRate: number,
): number {
  const target = rateChange({
    ...base,
    changeAfter: 0,
    newRate: fixedRate,
    mode: 'emi',
  }).totalInterest!;
  let lo = base.annualRate;
  let hi = base.annualRate + 0.5;
  for (let k = 0; k < 200; k++) {
    const mid = (lo + hi) / 2;
    const got = rateChange({ ...base, newRate: mid, mode: 'emi' }).totalInterest!;
    if (got < target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

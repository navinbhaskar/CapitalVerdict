/**
 * Public Provident Fund, one account (PPF Scheme 2019). Interest is worked out each month on the
 * lowest balance between the fifth and the end of the month, so a deposit made by the fifth earns
 * that month; it is credited once, at the end of each financial year, and then earns interest too.
 *
 * Deposits are either the same amount by 5 April each year, or the same amount by the fifth of
 * every month. Years are the 15-year term, or the term plus whole 5-year extensions with deposits.
 * The interest is tax-free.
 */
import type { SmallSavingsData } from '@/data/schema';

export type PpfFrequency = 'yearly' | 'monthly';

export interface PpfInput {
  /** Each deposit, ₹: a year's deposit when yearly, a month's when monthly. */
  deposit: number;
  frequency: PpfFrequency;
  years: number;
  /** Interest a year, decimal. */
  rate: number;
}

export interface PpfYear {
  year: number;
  deposited: number;
  interest: number;
  /** After the year's interest is credited. */
  balance: number;
}

export interface PpfResult {
  /** A year's deposits, ₹. */
  yearly: number;
  deposited: number;
  interest: number;
  maturity: number;
  byYear: PpfYear[];
  /** Index 0 = month 1: deposit, interest credited that month, balance at the month's end. */
  monthly: { deposit: number[]; credited: number[]; balance: number[] };
}

export const yearlyDeposit = (i: Pick<PpfInput, 'deposit' | 'frequency'>) =>
  i.frequency === 'yearly' ? i.deposit : i.deposit * 12;

export function validatePpf(i: PpfInput, rules: SmallSavingsData['ppf']): void {
  const yearly = yearlyDeposit(i);
  if (yearly > rules.maxYearly) throw new RangeError('deposits are above the yearly limit');
  if (yearly < rules.minYearly) throw new RangeError('deposits are below the yearly minimum');
  const extra = i.years - rules.termYears;
  if (!Number.isInteger(i.years) || extra < 0 || extra % rules.extensionYears !== 0) {
    throw new RangeError('years must be the term or a whole extension of it');
  }
  if (!(i.rate >= 0)) throw new RangeError('rate must be zero or more');
}

export function ppfCalc(input: PpfInput, rules: SmallSavingsData['ppf']): PpfResult {
  validatePpf(input, rules);
  const deposit: number[] = [];
  const credited: number[] = [];
  const balances: number[] = [];
  const byYear: PpfYear[] = [];
  let balance = 0;
  let pending = 0;
  let yearDeposited = 0;
  for (let m = 1; m <= input.years * 12; m++) {
    const d = input.frequency === 'monthly' || m % 12 === 1 ? input.deposit : 0;
    balance += d;
    yearDeposited += d;
    pending += (balance * input.rate) / 12;
    let credit = 0;
    if (m % 12 === 0) {
      credit = pending;
      balance += pending;
      byYear.push({ year: m / 12, deposited: yearDeposited, interest: credit, balance });
      pending = 0;
      yearDeposited = 0;
    }
    deposit.push(d);
    credited.push(credit);
    balances.push(balance);
  }
  const deposited = deposit.reduce((a, b) => a + b, 0);
  return {
    yearly: yearlyDeposit(input),
    deposited,
    interest: balance - deposited,
    maturity: balance,
    byYear,
    monthly: { deposit, credited, balance: balances },
  };
}

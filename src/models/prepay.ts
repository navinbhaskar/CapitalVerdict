/**
 * Prepay the home loan or invest the money: two households with the same cash, followed month by
 * month until the loan's original end date.
 *
 *   Prepay:  the lump sum (and any yearly amount) goes into the loan. Whatever that frees up each
 *            month (the EMI that is no longer due, or the drop in EMI) is invested.
 *   Invest:  the same lump sum (and yearly amount) is invested; the loan runs as it is.
 * Both pay the original EMI's worth of cash every month, so the comparison is fair. Tax saved on
 * loan interest (if the visitor claims it) is invested at the end of each loan year, on both sides.
 *
 *   net worth = investments − loan still owed
 *   answer    = prepay's net worth − invest's net worth at the original end date (both owe nothing)
 *
 * A prepayment charge is taken out of the amount paid in: paying ₹P with charge c clears P ÷ (1 + c).
 */
import { emi as loanEmi } from '@/engine/loan';
import { findFlip, type Flip } from '@/engine/sensitivity';
import { effectiveToMonthly, toTodaysRupees } from '@/engine/timeValue';

export type PrepayMode = 'reduceTenure' | 'reduceEmi';

export interface PrepayInput {
  /** Loan still owed today, ₹. */
  outstanding: number;
  /** Annual, nominal, monthly compounding. */
  loanRate: number;
  /** Whole years left on the loan. */
  yearsLeft: number;
  /** Paid into the loan (or invested) today, ₹. */
  lumpSum: number;
  /** Paid into the loan (or invested) at the end of every year, ₹. */
  yearlyAmount: number;
  mode: PrepayMode;
  /** Return on invested money after tax, a year (effective). */
  investmentReturn: number;
  /** Charge on the amount prepaid, decimal (0 for none). */
  prepaymentCharge: number;
  /** Tax rate on loan interest you can deduct, decimal (0 if you claim none). */
  interestTaxRate: number;
  /** Most interest you can deduct in a year, ₹. Only used when interestTaxRate > 0. */
  interestDeductionCap: number;
  /** For today's-rupees figures. */
  inflation: number;
}

export interface PrepaySide {
  /** Loan still owed at the end of each month, index 0 = month 1. */
  balance: number[];
  /** Invested so far at the end of each month. */
  investments: number[];
  /** EMI paid each month. */
  emiPaid: number[];
  /** Interest charged over the whole period, ₹. */
  interest: number;
  /** Tax saved on interest over the whole period, ₹. */
  taxSaved: number;
  /** Month the loan is cleared. */
  paidOffMonth: number;
}

export interface PrepayResult {
  months: number;
  /** EMI today, before any prepayment. */
  emi: number;
  /** EMI after the lump sum, in "lower the EMI" mode (= emi otherwise). */
  emiAfterLump: number;
  prepay: PrepaySide;
  invest: PrepaySide;
  /** Prepay's net worth − invest's, index = month, 0 = today. Positive = prepaying is ahead. */
  difference: number[];
  /** Interest the prepay side avoids, ₹. */
  interestSaved: number;
  /** Months taken off the loan (0 in "lower the EMI" mode). */
  monthsSaved: number;
  /** Total paid in prepayment charges, ₹. */
  chargesPaid: number;
  atEnd: { prepay: number; invest: number; difference: number; differenceToday: number };
}

function validate(i: PrepayInput): void {
  const nonNegative = {
    outstanding: i.outstanding,
    loanRate: i.loanRate,
    lumpSum: i.lumpSum,
    yearlyAmount: i.yearlyAmount,
    prepaymentCharge: i.prepaymentCharge,
    interestTaxRate: i.interestTaxRate,
    interestDeductionCap: i.interestDeductionCap,
  };
  for (const [name, v] of Object.entries(nonNegative)) {
    if (!(v >= 0)) throw new RangeError(`${name} must not be negative`);
  }
  if (!(i.outstanding > 0)) throw new RangeError('outstanding must be positive');
  if (!Number.isInteger(i.yearsLeft) || i.yearsLeft < 1) {
    throw new RangeError('yearsLeft must be a positive whole number');
  }
  if (!(i.interestTaxRate <= 1)) throw new RangeError('interestTaxRate is 0–1');
}

/** One household. `prepaying` decides where the lump sum and the yearly amount go. */
function simulate(
  input: PrepayInput,
  prepaying: boolean,
): PrepaySide & { charges: number; startNet: number } {
  const months = input.yearsLeft * 12;
  const r = input.loanRate / 12;
  const grow = effectiveToMonthly(input.investmentReturn);
  const baseEmi = loanEmi(input.outstanding, input.loanRate, months);
  const toLoan = (cash: number, owed: number) => {
    // Paying `cash` clears cash ÷ (1 + charge), never more than is owed.
    const cleared = Math.min(cash / (1 + input.prepaymentCharge), owed);
    return { cleared, spent: cleared * (1 + input.prepaymentCharge) };
  };

  let owed = input.outstanding;
  let pot = 0;
  let charges = 0;
  let payment = baseEmi;
  if (input.lumpSum > 0) {
    if (prepaying) {
      const { cleared, spent } = toLoan(input.lumpSum, owed);
      owed -= cleared;
      charges += spent - cleared;
      pot += input.lumpSum - spent;
      if (input.mode === 'reduceEmi' && owed > 0) payment = loanEmi(owed, input.loanRate, months);
    } else {
      pot += input.lumpSum;
    }
  }

  const startNet = pot - owed;
  const balance: number[] = [];
  const investments: number[] = [];
  const emiPaid: number[] = [];
  let interest = 0;
  let taxSaved = 0;
  let yearInterest = 0;
  let paidOffMonth = owed <= 0 ? 0 : months;

  for (let m = 1; m <= months; m++) {
    let paid = 0;
    if (owed > 0) {
      const due = owed * r;
      interest += due;
      yearInterest += due;
      paid = Math.min(payment, owed + due);
      owed = owed + due - paid;
      // Under a paisa left is rounding, not debt.
      if (owed < 0.01) owed = 0;
    }
    // Both households spend the original EMI's worth; what the loan does not take is invested.
    pot = pot * (1 + grow) + (baseEmi - paid);

    if (m % 12 === 0) {
      if (input.interestTaxRate > 0) {
        const saved = Math.min(yearInterest, input.interestDeductionCap) * input.interestTaxRate;
        taxSaved += saved;
        pot += saved;
      }
      yearInterest = 0;
      if (input.yearlyAmount > 0 && m < months) {
        if (prepaying && owed > 0) {
          const { cleared, spent } = toLoan(input.yearlyAmount, owed);
          owed -= cleared;
          charges += spent - cleared;
          pot += input.yearlyAmount - spent;
          if (owed < 0.01) owed = 0;
          if (input.mode === 'reduceEmi' && owed > 0) {
            payment = loanEmi(owed, input.loanRate, months - m);
          }
        } else {
          pot += input.yearlyAmount;
        }
      }
    }
    if (owed === 0 && paidOffMonth === months && m < months) paidOffMonth = m;
    balance.push(owed);
    investments.push(pot);
    emiPaid.push(paid);
  }
  return { balance, investments, emiPaid, interest, taxSaved, paidOffMonth, charges, startNet };
}

export function prepayOrInvest(input: PrepayInput): PrepayResult {
  validate(input);
  const months = input.yearsLeft * 12;
  const prepay = simulate(input, true);
  const invest = simulate(input, false);
  const emi = loanEmi(input.outstanding, input.loanRate, months);

  // Today: equal, less any charge on the lump sum.
  const difference = [prepay.startNet - invest.startNet];
  for (let m = 0; m < months; m++) {
    difference.push(
      prepay.investments[m]! - prepay.balance[m]! - (invest.investments[m]! - invest.balance[m]!),
    );
  }
  const last = months - 1;
  const p = prepay.investments[last]! - prepay.balance[last]!;
  const v = invest.investments[last]! - invest.balance[last]!;
  const side = ({
    balance,
    investments,
    emiPaid,
    interest,
    taxSaved,
    paidOffMonth,
  }: PrepaySide) => ({
    balance,
    investments,
    emiPaid,
    interest,
    taxSaved,
    paidOffMonth,
  });
  return {
    months,
    emi,
    emiAfterLump:
      input.mode === 'reduceEmi' && input.lumpSum > 0 ? (prepay.emiPaid[0] ?? emi) : emi,
    prepay: side(prepay),
    invest: side(invest),
    difference,
    interestSaved: invest.interest - prepay.interest,
    monthsSaved: input.mode === 'reduceTenure' ? invest.paidOffMonth - prepay.paidOffMonth : 0,
    chargesPaid: prepay.charges,
    atEnd: {
      prepay: p,
      invest: v,
      difference: p - v,
      differenceToday: toTodaysRupees(p - v, input.inflation, months),
    },
  };
}

export type PrepayVariable = 'investmentReturn' | 'loanRate' | 'interestTaxRate';

export interface PrepayFlip extends Flip {
  variable: PrepayVariable;
}

/** Where prepaying and investing end level, one input at a time. Positive = prepaying wins. */
export function prepayFlips(input: PrepayInput, only?: PrepayVariable[]): PrepayFlip[] {
  const diff = (i: PrepayInput) => prepayOrInvest(i).atEnd.difference;
  const probes: { variable: PrepayVariable; lo: number; hi: number; skip?: boolean }[] = [
    { variable: 'investmentReturn', lo: 0, hi: 0.3 },
    { variable: 'loanRate', lo: 0, hi: 0.25 },
    // Only meaningful when interest is deductible at all.
    { variable: 'interestTaxRate', lo: 0, hi: 0.45, skip: input.interestDeductionCap <= 0 },
  ];
  const flips: PrepayFlip[] = [];
  for (const { variable, lo, hi, skip } of probes) {
    if (skip || (only && !only.includes(variable))) continue;
    const flip = findFlip((x) => diff({ ...input, [variable]: x }), { lo, hi, steps: 60 });
    if (flip) flips.push({ variable, ...flip });
  }
  return flips;
}

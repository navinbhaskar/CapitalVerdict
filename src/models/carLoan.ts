/**
 * Pay cash for a car or take a loan: two buyers with the same money and the same car, followed
 * month by month until the loan's last EMI.
 *
 *   Cash:  pays the whole price today, then invests the EMI the loan buyer pays, every month.
 *   Loan:  pays the down payment and the processing fee today, invests the rest of the price,
 *          and pays the EMI.
 * Both own the same car at the end, so the car's value cancels out:
 *
 *   answer = cash buyer's investments − loan buyer's investments   (positive = cash is better)
 *
 * The loan buyer comes out ahead only if the investments earn more than the loan really costs.
 * That break-even return is the loan's true yearly cost with the fee: the rate at which the money
 * received today (loan − fee) equals the EMIs paid.
 */
import { emi as loanEmi } from '@/engine/loan';
import { findFlip, type Flip } from '@/engine/sensitivity';
import { effectiveToMonthly, toTodaysRupees } from '@/engine/timeValue';

export interface CarLoanInput {
  /** On-road price, ₹. */
  carPrice: number;
  /** Paid upfront by the loan buyer, decimal of the price (below 1). */
  downPayment: number;
  /** Annual, nominal, monthly compounding (reducing balance). */
  loanRate: number;
  loanYears: number;
  /** One-off fee for the loan, ₹. */
  processingFee: number;
  /** Return on invested money after tax, a year (effective). */
  investmentReturn: number;
  /** For today's-rupees figures. */
  inflation: number;
}

export interface CarLoanResult {
  months: number;
  loanAmount: number;
  emi: number;
  /** EMIs × months − loan. */
  totalInterest: number;
  /** Invested by the loan buyer on day one: loan − fee. */
  loanBuyerStart: number;
  /** Investments at the end of each month, index 0 = month 1. */
  cashPot: number[];
  loanPot: number[];
  /** Cash − loan, index = month, 0 = today. */
  difference: number[];
  atEnd: { cash: number; loan: number; difference: number; differenceToday: number };
}

function validate(i: CarLoanInput): void {
  for (const [name, v] of Object.entries({
    carPrice: i.carPrice,
    loanRate: i.loanRate,
    processingFee: i.processingFee,
  })) {
    if (!(v >= 0)) throw new RangeError(`${name} must not be negative`);
  }
  if (!(i.carPrice > 0)) throw new RangeError('carPrice must be positive');
  if (!(i.downPayment >= 0 && i.downPayment < 1))
    throw new RangeError('downPayment is 0 to below 1');
  if (!Number.isInteger(i.loanYears) || i.loanYears < 1) {
    throw new RangeError('loanYears must be a positive whole number');
  }
  if (i.processingFee >= i.carPrice * (1 - i.downPayment)) {
    throw new RangeError('processingFee must be less than the loan');
  }
}

export function cashOrLoan(input: CarLoanInput): CarLoanResult {
  validate(input);
  const months = input.loanYears * 12;
  const loanAmount = input.carPrice * (1 - input.downPayment);
  const emi = loanEmi(loanAmount, input.loanRate, months);
  const grow = effectiveToMonthly(input.investmentReturn);
  const loanBuyerStart = loanAmount - input.processingFee;

  let cash = 0;
  let loan = loanBuyerStart;
  const cashPot: number[] = [];
  const loanPot: number[] = [];
  const difference = [cash - loan];
  for (let m = 1; m <= months; m++) {
    // The cash buyer invests the EMI the loan buyer pays; both pots grow at the same return.
    cash = cash * (1 + grow) + emi;
    loan = loan * (1 + grow);
    cashPot.push(cash);
    loanPot.push(loan);
    difference.push(cash - loan);
  }
  const gap = cash - loan;
  return {
    months,
    loanAmount,
    emi,
    totalInterest: emi * months - loanAmount,
    loanBuyerStart,
    cashPot,
    loanPot,
    difference,
    atEnd: {
      cash,
      loan,
      difference: gap,
      differenceToday: toTodaysRupees(gap, input.inflation, months),
    },
  };
}

export type CarLoanVariable = 'investmentReturn' | 'loanRate';

export interface CarLoanFlip extends Flip {
  variable: CarLoanVariable;
}

/** Where cash and loan end level, one input at a time. Positive = paying cash wins. */
export function carLoanFlips(input: CarLoanInput, only?: CarLoanVariable[]): CarLoanFlip[] {
  const diff = (i: CarLoanInput) => cashOrLoan(i).atEnd.difference;
  const probes: { variable: CarLoanVariable; lo: number; hi: number }[] = [
    { variable: 'investmentReturn', lo: 0, hi: 0.4 },
    { variable: 'loanRate', lo: 0, hi: 0.3 },
  ];
  const flips: CarLoanFlip[] = [];
  for (const { variable, lo, hi } of probes) {
    if (only && !only.includes(variable)) continue;
    const flip = findFlip((x) => diff({ ...input, [variable]: x }), { lo, hi, steps: 60 });
    if (flip) flips.push({ variable, ...flip });
  }
  return flips;
}

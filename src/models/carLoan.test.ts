import { describe, expect, it } from 'vitest';
import { irr } from '@/engine/irr';
import { carLoanFlips, cashOrLoan, type CarLoanInput } from './carLoan';

/** A ₹1,00,000 car, all on a 1-year loan at 12% (1% a month), nothing earned on savings. */
const small: CarLoanInput = {
  carPrice: 100_000,
  downPayment: 0,
  loanRate: 0.12,
  loanYears: 1,
  processingFee: 0,
  investmentReturn: 0,
  inflation: 0.06,
};

describe('cashOrLoan: hand-checked small loan', () => {
  it('at 0% return, cash wins by exactly the interest', () => {
    const r = cashOrLoan(small);
    // EMI: 1,00,000 × 0.01 × 1.01^12 ÷ (1.01^12 − 1) = ₹8,884.88; 12 EMIs = ₹1,06,618.55.
    expect(r.emi).toBeCloseTo(8884.88, 2);
    expect(r.totalInterest).toBeCloseTo(6618.55, 2);
    expect(r.atEnd.cash).toBeCloseTo(106_618.55, 2);
    expect(r.atEnd.loan).toBeCloseTo(100_000, 6);
    expect(r.atEnd.difference).toBeCloseTo(6618.55, 2);
    // Today the loan buyer still has the price invested; the cash buyer has nothing.
    expect(r.difference[0]).toBe(-100_000);
  });

  it('a ₹1,000 fee comes off the loan buyer’s savings on day one', () => {
    const r = cashOrLoan({ ...small, processingFee: 1000 });
    expect(r.loanBuyerStart).toBe(99_000);
    expect(r.atEnd.difference).toBeCloseTo(7618.55, 2);
  });

  it('a 20% down payment shrinks the loan and the EMI by a fifth', () => {
    const r = cashOrLoan({ ...small, downPayment: 0.2 });
    expect(r.loanAmount).toBe(80_000);
    expect(r.emi).toBeCloseTo(8884.88 * 0.8, 2);
    expect(r.atEnd.difference).toBeCloseTo(6618.55 * 0.8, 2);
  });

  it('when savings earn the loan rate and there is no fee, the two are level', () => {
    const r = cashOrLoan({ ...small, loanYears: 5, investmentReturn: Math.pow(1.01, 12) - 1 });
    expect(Math.abs(r.atEnd.difference)).toBeLessThan(0.01);
  });
});

describe('cashOrLoan: break-even return', () => {
  it('without a fee it is the loan rate compounded monthly', () => {
    const [flip] = carLoanFlips(small, ['investmentReturn']);
    expect(flip!.threshold).toBeCloseTo(Math.pow(1.01, 12) - 1, 6);
    expect(flip!.signBelow).toBe(1);
  });

  it('with a fee it is the loan’s true cost: the yearly rate of (loan − fee) against the EMIs', () => {
    const input = { ...small, processingFee: 1000 };
    const r = cashOrLoan(input);
    const monthly = irr([r.loanBuyerStart, ...Array<number>(12).fill(-r.emi)])!;
    const [flip] = carLoanFlips(input, ['investmentReturn']);
    expect(flip!.threshold).toBeCloseTo(Math.pow(1 + monthly, 12) - 1, 6);
    expect(flip!.threshold).toBeGreaterThan(Math.pow(1.01, 12) - 1);
  });
});

describe('cashOrLoan: the page example', () => {
  // ₹10 lakh car, 20% down, 9% over 5 years, ₹5,000 fee, 7% after tax. Illustrative values.
  const example: CarLoanInput = {
    carPrice: 1_000_000,
    downPayment: 0.2,
    loanRate: 0.09,
    loanYears: 5,
    processingFee: 5000,
    investmentReturn: 0.07,
    inflation: 0.06,
  };

  it('EMI ₹16,606.68 on ₹8 lakh; cash comes out ₹67,298 ahead after 5 years', () => {
    const r = cashOrLoan(example);
    // 1.0075^60 = 1.565681, so EMI = 6,000 × 1.565681 ÷ 0.565681.
    expect(r.emi).toBeCloseTo(16_606.68, 2);
    expect(Math.round(r.totalInterest)).toBe(196_401);
    // Loan buyer: ₹7,95,000 × 1.07^5. Cash buyer: 60 EMIs invested at 7% a year.
    expect(r.atEnd.loan).toBeCloseTo(795_000 * Math.pow(1.07, 5), 2);
    expect(Math.round(r.atEnd.cash)).toBe(1_182_327);
    expect(Math.round(r.atEnd.difference)).toBe(67_298);
  });

  it('the loan only pays if savings earn above 9.67% a year (9.38% plus the fee)', () => {
    const [flip] = carLoanFlips(example, ['investmentReturn']);
    expect(flip!.threshold).toBeCloseTo(0.0967, 4);
  });
});

describe('cashOrLoan: input checks', () => {
  it('rejects a full down payment, part years and a fee as big as the loan', () => {
    expect(() => cashOrLoan({ ...small, downPayment: 1 })).toThrow(RangeError);
    expect(() => cashOrLoan({ ...small, loanYears: 2.5 })).toThrow(RangeError);
    expect(() => cashOrLoan({ ...small, processingFee: 100_000 })).toThrow(RangeError);
  });
});

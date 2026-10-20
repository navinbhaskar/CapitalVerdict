import { describe, expect, it } from 'vitest';
import { prepayFlips, prepayOrInvest, type PrepayInput } from './prepay';

/** ₹1,00,000 at 12% (1% a month) with a year left; ₹50,000 to put somewhere. */
const small: PrepayInput = {
  outstanding: 100_000,
  loanRate: 0.12,
  yearsLeft: 1,
  lumpSum: 50_000,
  yearlyAmount: 0,
  mode: 'reduceEmi',
  investmentReturn: 0,
  prepaymentCharge: 0,
  interestTaxRate: 0,
  interestDeductionCap: 0,
  inflation: 0.06,
};
/** The return that compounds monthly at exactly the loan's 1% a month. */
const sameAsLoan = Math.pow(1.01, 12) - 1;

describe('prepayOrInvest: hand-checked small loan', () => {
  // EMI on ₹1,00,000 over 12 months at 1%: 1,00,000 × 0.01 × 1.01^12 ÷ (1.01^12 − 1) = ₹8,884.88.
  // After ₹50,000 goes in, the EMI on ₹50,000 over 12 months is half: ₹4,442.44.
  it('lowering the EMI: the new EMI is half, and prepaying gains exactly the interest saved', () => {
    const r = prepayOrInvest(small);
    expect(r.emi).toBeCloseTo(8884.88, 2);
    expect(r.emiAfterLump).toBeCloseTo(4442.44, 2);
    // Prepay invests 12 × ₹4,442.44 = ₹53,309.27 at 0%; invest keeps ₹50,000.
    expect(r.atEnd.prepay).toBeCloseTo(53_309.27, 2);
    expect(r.atEnd.invest).toBeCloseTo(50_000, 2);
    // Interest: 12 × 8,884.88 − 1,00,000 = 6,618.55 against 12 × 4,442.44 − 50,000 = 3,309.27.
    expect(r.interestSaved).toBeCloseTo(3309.27, 2);
    expect(r.atEnd.difference).toBeCloseTo(3309.27, 2);
    expect(r.monthsSaved).toBe(0);
    expect(r.difference[0]).toBe(0);
  });

  it('keeping the EMI: the loan ends in month 6 and the freed EMIs are invested', () => {
    const r = prepayOrInvest({ ...small, mode: 'reduceTenure' });
    expect(r.emiAfterLump).toBeCloseTo(8884.88, 2);
    expect(r.prepay.paidOffMonth).toBe(6);
    expect(r.monthsSaved).toBe(6);
    // At 0% the gain is the interest saved: 6,618.55 − 1,725.38.
    expect(r.interestSaved).toBeCloseTo(4893.17, 2);
    expect(r.atEnd.difference).toBeCloseTo(4893.17, 2);
  });

  it('when the return matches the loan rate, the two come out level (both modes, yearly too)', () => {
    for (const mode of ['reduceEmi', 'reduceTenure'] as const) {
      const r = prepayOrInvest({
        ...small,
        mode,
        yearsLeft: 5,
        yearlyAmount: 10_000,
        investmentReturn: sameAsLoan,
      });
      expect(Math.abs(r.atEnd.difference)).toBeLessThan(0.01);
    }
  });

  it('a lump sum bigger than the loan clears it; the rest is invested', () => {
    const r = prepayOrInvest({ ...small, lumpSum: 120_000 });
    expect(r.prepay.paidOffMonth).toBe(0);
    expect(r.prepay.balance.every((b) => b === 0)).toBe(true);
    // Prepay: ₹20,000 left over + 12 full EMIs freed = 20,000 + 1,06,618.55.
    expect(r.atEnd.prepay).toBeCloseTo(126_618.55, 2);
    expect(r.atEnd.invest).toBeCloseTo(120_000 - 0, 2);
  });
});

describe('prepayOrInvest: charges and tax', () => {
  it('a 2% charge: ₹51,000 paid clears ₹50,000; the ₹1,000 charge is lost on day one', () => {
    const r = prepayOrInvest({ ...small, lumpSum: 51_000, prepaymentCharge: 0.02 });
    expect(r.chargesPaid).toBeCloseTo(1000, 6);
    expect(r.difference[0]).toBeCloseTo(-1000, 6);
    expect(r.atEnd.prepay).toBeCloseTo(53_309.27, 2);
    expect(r.atEnd.invest).toBeCloseTo(51_000, 2);
    expect(r.atEnd.difference).toBeCloseTo(2309.27, 2);
  });

  it('tax at 30% on all interest: the investor saves more tax, so prepaying gains less', () => {
    const r = prepayOrInvest({ ...small, interestTaxRate: 0.3, interestDeductionCap: 1e9 });
    // Tax saved: 30% × 6,618.55 = 1,985.56 against 30% × 3,309.27 = 992.78.
    expect(r.invest.taxSaved).toBeCloseTo(1985.56, 2);
    expect(r.prepay.taxSaved).toBeCloseTo(992.78, 2);
    expect(r.atEnd.difference).toBeCloseTo(3309.27 - 992.78, 2);
  });

  it('a ₹2,000 limit caps both sides at ₹600, so the tax makes no difference', () => {
    const r = prepayOrInvest({ ...small, interestTaxRate: 0.3, interestDeductionCap: 2000 });
    expect(r.invest.taxSaved).toBeCloseTo(600, 6);
    expect(r.prepay.taxSaved).toBeCloseTo(600, 6);
    expect(r.atEnd.difference).toBeCloseTo(3309.27, 2);
  });
});

describe('prepayOrInvest: the page example', () => {
  // ₹40 lakh at 9% with 20 years left (EMI ₹35,989, as in the "Where your EMI goes" guide),
  // ₹5 lakh to put in, 8% a year after tax on investments. Illustrative values.
  const example: PrepayInput = {
    ...small,
    outstanding: 4_000_000,
    loanRate: 0.09,
    yearsLeft: 20,
    lumpSum: 500_000,
    mode: 'reduceTenure',
    investmentReturn: 0.08,
  };

  it('prepaying is ahead by about ₹5.66 lakh after 20 years; the loan ends 65 months early', () => {
    const r = prepayOrInvest(example);
    expect(r.emi).toBeCloseTo(35_989.04, 2);
    expect(r.prepay.paidOffMonth).toBe(175);
    expect(r.monthsSaved).toBe(65);
    expect(Math.round(r.interestSaved)).toBe(1_841_834);
    expect(Math.round(r.atEnd.difference)).toBe(566_416);
  });

  it('investing wins above a 9.38% return: the loan rate compounded monthly', () => {
    const [flip] = prepayFlips(example, ['investmentReturn']);
    expect(flip!.threshold).toBeCloseTo(Math.pow(1.0075, 12) - 1, 6);
    expect(flip!.signBelow).toBe(1);
  });
});

describe('prepayOrInvest: input checks', () => {
  it('rejects a zero loan, part years and negative amounts', () => {
    expect(() => prepayOrInvest({ ...small, outstanding: 0 })).toThrow(RangeError);
    expect(() => prepayOrInvest({ ...small, yearsLeft: 1.5 })).toThrow(RangeError);
    expect(() => prepayOrInvest({ ...small, lumpSum: -1 })).toThrow(RangeError);
  });
});

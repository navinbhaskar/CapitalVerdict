import { describe, expect, it } from 'vitest';
import { emi, outstanding } from '@/engine/loan';
import { rentBuyFlips, rentBuyScenarios, rentVsBuy, type RentBuyInput } from './rentBuy';

// SYNTHETIC inputs for testing the mechanics only (not market data).
const cashBuyer: RentBuyInput = {
  homePrice: 10_000_000,
  downPayment: 1,
  loanRate: 0,
  loanYears: 20,
  stampDuty: 0,
  otherUpfront: 0,
  maintenance: 0,
  propertyTax: 0,
  appreciation: 0,
  sellingCost: 0,
  monthlyRent: 20_000,
  rentGrowth: 0,
  securityDeposit: 0,
  investmentReturn: 0,
  inflation: 0,
  horizonYears: 1,
};

describe('rent vs buy: cash buyer, nothing grows', () => {
  // Buyer owns outright and pays nothing; the renter pays ₹20,000 a month, so the buyer saves it.
  // After 12 months: buyer = 1,00,00,000 + 2,40,000; renter = 1,00,00,000.
  const r = rentVsBuy(cashBuyer);

  it('buyer invests the rent the renter pays', () => {
    expect(r.atHorizon.buyer).toBeCloseTo(10_240_000, 4);
    expect(r.atHorizon.renter).toBeCloseTo(10_000_000, 4);
    expect(r.atHorizon.difference).toBeCloseTo(240_000, 4);
    expect(r.emi).toBe(0);
  });
});

/**
 * Loan case, hand-checked with a separate month-by-month loop:
 * ₹50 lakh home, 20% down, 9% for 20 years, 7% stamp duty, ₹50,000 other costs, 0.5% maintenance,
 * ₹6,000 property tax (+6% a year), 5% appreciation, 2% selling cost, ₹15,000 rent (+5% a year),
 * ₹45,000 deposit, 8% return after tax, 15 years.
 * EMI ₹35,989.04; month-1 buyer outflow ₹38,572.37; renter starts with ₹13,55,000.
 * After 15 years: buyer ₹84,53,034.70, renter ₹1,09,03,011.70; loan left ₹17,33,713.38.
 */
const loanCase: RentBuyInput = {
  homePrice: 5_000_000,
  downPayment: 0.2,
  loanRate: 0.09,
  loanYears: 20,
  stampDuty: 0.07,
  otherUpfront: 50_000,
  maintenance: 0.005,
  propertyTax: 6000,
  appreciation: 0.05,
  sellingCost: 0.02,
  monthlyRent: 15_000,
  rentGrowth: 0.05,
  securityDeposit: 45_000,
  investmentReturn: 0.08,
  inflation: 0.06,
  horizonYears: 15,
};

describe('rent vs buy: with a loan (renting wins here)', () => {
  const r = rentVsBuy(loanCase);

  it('EMI and month-1 outflow', () => {
    expect(r.emi).toBeCloseTo(35_989.0382, 3);
    expect(r.emi).toBeCloseTo(emi(4_000_000, 0.09, 240), 9);
    expect(r.buyerOutflow[0]).toBeCloseTo(38_572.3716, 3);
    expect(r.upfrontCash).toBe(1_000_000 + 350_000 + 50_000);
  });

  it('loan outstanding matches the loan engine', () => {
    expect(r.outstanding[179]).toBeCloseTo(outstanding(4_000_000, 0.09, 240, 180), 2);
    expect(r.end.outstanding).toBeCloseTo(1_733_713.38, 1);
  });

  it('net worth after 15 years', () => {
    expect(r.atHorizon.buyer).toBeCloseTo(8_453_034.7, 0);
    expect(r.atHorizon.renter).toBeCloseTo(10_903_011.7, 0);
    expect(r.crossover).toBeNull();
  });

  it('components add up to the buyer net worth', () => {
    const e = r.end;
    expect(e.homeValue - e.outstanding - e.sellingCost + e.buyerInvestments).toBeCloseTo(
      r.atHorizon.buyer,
      6,
    );
    expect(e.renterInvestments + loanCase.securityDeposit).toBeCloseTo(r.atHorizon.renter, 6);
  });

  it("today's rupees deflate by inflation over 15 years", () => {
    expect(r.atHorizon.differenceToday).toBeCloseTo(r.atHorizon.difference / Math.pow(1.06, 15), 2);
  });
});

describe('rent vs buy: buying overtakes renting', () => {
  // Same loan, 7% appreciation, ₹20,000 rent (+6%), ₹60,000 deposit, 6% return, 20 years.
  // Hand loop: month 42 buyer 25,03,633 < renter 25,09,050; month 43 buyer 25,46,938 ≥ 25,36,375.
  const r = rentVsBuy({
    ...loanCase,
    appreciation: 0.07,
    monthlyRent: 20_000,
    rentGrowth: 0.06,
    securityDeposit: 60_000,
    investmentReturn: 0.06,
    horizonYears: 20,
  });

  it('crosses in month 43', () => {
    expect(r.crossover?.months).toBe(43);
    expect(r.buyerNetWorth[42]).toBeCloseTo(2_546_938.08, 0);
    expect(r.renterNetWorth[42]).toBeCloseTo(2_536_375.29, 0);
    expect(r.atHorizon.buyer).toBeCloseTo(19_676_577.69, 0);
    expect(r.atHorizon.renter).toBeCloseTo(8_601_193.93, 0);
  });
});

describe('rent vs buy: scenarios and flips', () => {
  it('pessimistic economy (3% homes, 7% rent) and optimistic (7%, 4%)', () => {
    const runs = rentBuyScenarios(loanCase, {
      appreciation: { pessimistic: 0.03, base: 0.05, optimistic: 0.07 },
      rentGrowth: { pessimistic: 0.07, base: 0.05, optimistic: 0.04 },
    });
    expect(runs.base.output.atHorizon.difference).toBeCloseTo(
      rentVsBuy(loanCase).atHorizon.difference,
      6,
    );
    expect(runs.pessimistic.input.appreciation).toBe(0.03);
    expect(runs.optimistic.input.rentGrowth).toBe(0.04);
  });

  it('finds the appreciation at which buying draws level', () => {
    const flip = rentBuyFlips(loanCase).find((f) => f.variable === 'appreciation')!;
    const level = rentVsBuy({ ...loanCase, appreciation: flip.threshold }).atHorizon.difference;
    expect(Math.abs(level)).toBeLessThan(1);
    expect(flip.signBelow).toBe(-1);
  });

  it('rejects impossible input', () => {
    expect(() => rentVsBuy({ ...loanCase, downPayment: 1.5 })).toThrow(RangeError);
    expect(() => rentVsBuy({ ...loanCase, horizonYears: 0 })).toThrow(RangeError);
  });
});

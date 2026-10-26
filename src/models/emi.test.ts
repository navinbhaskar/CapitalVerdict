import { describe, expect, it } from 'vitest';
import { emiAt, emiPlan, type EmiInput } from './emi';

// ₹40 lakh at 9% for 20 years: the "Where your EMI goes" guide's example.
const base: EmiInput = {
  amount: 4_000_000,
  annualRate: 0.09,
  years: 20,
  yearlyPrepayment: 0,
  inflation: 0.06,
};

describe('EMI', () => {
  const r = emiPlan(base);

  it('₹35,989.04 a month: P × r × (1 + r)^n ÷ ((1 + r)^n − 1), r = 0.75%, n = 240', () => {
    const i = 0.0075;
    const g = Math.pow(1 + i, 240);
    expect(r.emi).toBeCloseTo((4_000_000 * i * g) / (g - 1), 6);
    expect(r.emi).toBeCloseTo(35_989.04, 2);
    expect(r.months).toBe(240);
  });

  it('₹46.37 lakh interest; ₹86.37 lakh paid in all', () => {
    expect(r.totalInterest / 1e5).toBeCloseTo(46.37, 2);
    expect(r.totalPaid).toBeCloseTo(r.emi * 240, 2);
    expect(r.totalPaid - r.totalInterest).toBeCloseTo(4_000_000, 2);
  });

  it('the first EMI is ₹30,000 interest (83%); interest is the larger part for 12 years', () => {
    expect(r.schedule.rows[0]!.interest).toBeCloseTo(30_000, 6);
    expect(r.firstInterestShare).toBeCloseTo(30_000 / 35_989.04, 4);
    expect(r.crossoverYear).toBe(13);
  });

  it('year rows add up and end at zero', () => {
    expect(r.years).toHaveLength(20);
    expect(r.years.reduce((s, y) => s + y.interest, 0)).toBeCloseTo(r.totalInterest, 4);
    expect(r.years.at(-1)!.balance).toBe(0);
  });

  it("the last EMI in today's rupees: 240 months of 6% inflation", () => {
    expect(r.lastEmiToday).toBeCloseTo(r.emi / Math.pow(1.06, 20), 4);
  });
});

describe('yearly prepayment', () => {
  const r = emiPlan({ ...base, yearlyPrepayment: 100_000 });

  it('keeps the EMI, ends sooner and saves interest', () => {
    expect(r.emi).toBeCloseTo(35_989.04, 2);
    expect(r.months).toBeLessThan(240);
    expect(r.totalInterest).toBeLessThan(r.withoutPrepayment!.totalInterest);
    expect(r.years[0]!.prepayment).toBe(100_000);
  });

  it('every rupee borrowed is repaid', () => {
    const repaid = r.schedule.rows.reduce((s, row) => s + row.principal + row.prepayment, 0);
    expect(repaid).toBeCloseTo(4_000_000, 4);
  });
});

describe('other rates and tenures', () => {
  it('1% more on the rate: ₹38,600.87 a month (r = 10% ÷ 12)', () => {
    expect(emiAt(4_000_000, 0.1, 20).emi).toBeCloseTo(38_600.87, 2);
  });

  it('a longer tenure lowers the EMI but raises the interest', () => {
    const short = emiAt(4_000_000, 0.09, 15);
    const long = emiAt(4_000_000, 0.09, 25);
    expect(long.emi).toBeLessThan(short.emi);
    expect(long.totalInterest).toBeGreaterThan(short.totalInterest);
  });
});

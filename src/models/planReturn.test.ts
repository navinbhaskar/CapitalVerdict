import { describe, expect, it } from 'vitest';
import { smallSavings } from '@/data';
import { effectiveToMonthly } from '@/engine/timeValue';
import {
  incomeMonths,
  payoutScaleAt,
  planReturn,
  premiumMonths,
  type PlanInput,
} from './planReturn';

const base: PlanInput = {
  premium: 0,
  payFrequency: 'yearly',
  payYears: 0,
  income: 0,
  incomeFrequency: 'monthly',
  incomeStartYear: 1,
  incomeYears: 0,
  lumpSums: [],
  taxRate: 0,
  inflation: 0.06,
};

describe('timing', () => {
  it('premiums at the start of each period', () => {
    expect(premiumMonths({ payFrequency: 'once', payYears: 10 })).toEqual([0]);
    expect(premiumMonths({ payFrequency: 'yearly', payYears: 3 })).toEqual([0, 12, 24]);
    expect(premiumMonths({ payFrequency: 'monthly', payYears: 1 })).toHaveLength(12);
    expect(premiumMonths({ payFrequency: 'monthly', payYears: 1 }).at(-1)).toBe(11);
  });

  it('income from year 16: first at the end of its first month, month 181', () => {
    const monthly = incomeMonths({
      income: 1,
      incomeFrequency: 'monthly',
      incomeStartYear: 16,
      incomeYears: 2,
    });
    expect(monthly[0]).toBe(181);
    expect(monthly.at(-1)).toBe(204);
    expect(monthly).toHaveLength(24);
    const yearly = incomeMonths({
      income: 1,
      incomeFrequency: 'yearly',
      incomeStartYear: 16,
      incomeYears: 2,
    });
    expect(yearly).toEqual([192, 204]);
  });
});

describe('the return a year', () => {
  it('₹1 lakh once, ₹2 lakh after 10 years: 2^(1/10) − 1 = 7.177%', () => {
    const r = planReturn({
      ...base,
      premium: 100_000,
      payFrequency: 'once',
      lumpSums: [{ amount: 200_000, year: 10 }],
    });
    expect(r.annualReturn).toBeCloseTo(Math.pow(2, 0.1) - 1, 9);
    expect(r.annualReturn).toBeCloseTo(0.07177, 5);
    expect(r.paybackYear).toBe(10);
  });

  it('₹1 lakh a year for 2 years, ₹2.1 lakh at the end of year 2: x² + x = 2.1, 3.297%', () => {
    // 1,00,000(1 + r)² + 1,00,000(1 + r) = 2,10,000, so 1 + r = (−1 + √9.4) / 2.
    const r = planReturn({
      ...base,
      premium: 100_000,
      payYears: 2,
      lumpSums: [{ amount: 210_000, year: 2 }],
    });
    expect(r.annualReturn).toBeCloseTo((-1 + Math.sqrt(9.4)) / 2 - 1, 9);
    expect(r.annualReturn).toBeCloseTo(0.03297, 5);
  });

  it('an income worked out at 6% a year returns 6%', () => {
    // ₹10 lakh buys 240 monthly payments, paid at the end of each month, at 6% a year.
    const i = effectiveToMonthly(0.06);
    const income = (1_000_000 * i) / (1 - Math.pow(1 + i, -240));
    const r = planReturn({
      ...base,
      premium: 1_000_000,
      payFrequency: 'once',
      income,
      incomeYears: 20,
    });
    expect(income).toBeCloseTo(7_073, 0);
    expect(r.annualReturn).toBeCloseTo(0.06, 9);
    expect(r.realReturn).toBeCloseTo(0, 9);
  });

  it('tax on the payouts lowers the return', () => {
    const plan = {
      ...base,
      premium: 100_000,
      payFrequency: 'once' as const,
      lumpSums: [{ amount: 200_000, year: 10 }],
    };
    const r = planReturn({ ...plan, taxRate: 0.3 });
    expect(r.tax).toBeCloseTo(60_000, 6);
    expect(r.kept).toBeCloseTo(140_000, 6);
    expect(r.annualReturn).toBeCloseTo(Math.pow(1.4, 0.1) - 1, 9);
  });

  it('no payout, no return', () => {
    const r = planReturn({ ...base, premium: 10_000, payYears: 5 });
    expect(r.annualReturn).toBeNull();
    expect(r.paybackYear).toBeNull();
  });
});

describe('pay 15 years, then an income', () => {
  // ₹50,000 a year for 15 years; ₹8,000 a month from year 16 for 20 years; ₹5 lakh at the end of year 35.
  const plan: PlanInput = {
    ...base,
    premium: 50_000,
    payYears: 15,
    income: 8_000,
    incomeStartYear: 16,
    incomeYears: 20,
    lumpSums: [{ amount: 500_000, year: 35 }],
  };
  const r = planReturn(plan);

  it('pays ₹7.5 lakh and gets back ₹24.2 lakh', () => {
    expect(r.paid).toBe(750_000);
    expect(r.received).toBe(8_000 * 240 + 500_000);
    expect(r.received).toBe(2_420_000);
    expect(r.months).toBe(420);
  });

  it('year by year', () => {
    expect(r.years).toHaveLength(35);
    expect(r.years[14]).toMatchObject({ year: 15, paid: 50_000, received: 0, netToDate: -750_000 });
    expect(r.years[15]).toMatchObject({ year: 16, paid: 0, received: 96_000, netToDate: -654_000 });
    expect(r.years[34]!.received).toBe(96_000 + 500_000);
    expect(r.years[34]!.netToDate).toBe(1_670_000);
    // −7,50,000 + 96,000 a year: back in the black after 8 years of income.
    expect(r.paybackYear).toBe(23);
  });

  it('the return makes the premiums and payouts balance', () => {
    const rate = r.annualReturn!;
    expect(rate).toBeGreaterThan(0.062);
    expect(rate).toBeLessThan(0.063);
    expect(payoutScaleAt(r, rate)).toBeCloseTo(1, 9);
  });

  it("the first ₹8,000 in today's rupees: 181 months of 6% inflation", () => {
    expect(r.firstIncomeMonth).toBe(181);
    expect(r.firstIncomeToday).toBeCloseTo(8_000 / Math.pow(1.06, 181 / 12), 6);
    expect(r.firstIncomeToday).toBeCloseTo(3_322, 0);
  });

  it("at PPF's rate the same premiums would pay more at every step", () => {
    const scale = payoutScaleAt(r, smallSavings.ppf.rate)!;
    expect(scale).toBeGreaterThan(1);
    expect(8_000 * scale).toBeGreaterThan(8_000);
  });
});

describe('what the same premiums would pay at another rate', () => {
  it('₹1 lakh once at 10% for 10 years would pay 1.1¹⁰ lakh instead of ₹2 lakh', () => {
    const r = planReturn({
      ...base,
      premium: 100_000,
      payFrequency: 'once',
      lumpSums: [{ amount: 200_000, year: 10 }],
    });
    const scale = payoutScaleAt(r, 0.1)!;
    expect(200_000 * scale).toBeCloseTo(100_000 * Math.pow(1.1, 10), 4);
    expect(200_000 * scale).toBeCloseTo(259_374.25, 2);
  });

  it('a premium and a payout in the same month are kept apart', () => {
    // Money back: ₹1 lakh a year for 2 years, ₹50,000 at the end of year 1 (the same month as the
    // second premium) and ₹1.6 lakh at the end of year 2. At 0% the payouts would be scaled to
    // match the ₹2 lakh paid: 2,00,000 / 2,10,000.
    const r = planReturn({
      ...base,
      premium: 100_000,
      payYears: 2,
      lumpSums: [
        { amount: 50_000, year: 1 },
        { amount: 160_000, year: 2 },
      ],
    });
    expect(r.flows[12]).toBe(-50_000);
    expect(payoutScaleAt(r, 0)).toBeCloseTo(200_000 / 210_000, 9);
  });

  it('null when nothing is paid out', () => {
    expect(payoutScaleAt(planReturn({ ...base, premium: 1, payYears: 1 }), 0.07)).toBeNull();
  });
});

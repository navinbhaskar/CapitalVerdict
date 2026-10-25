import { describe, expect, it } from 'vitest';
import { incomeTax, smallSavings } from '@/data';
import { monthlySaving } from './monthlySaving';
import { fundPlan, maxWithdrawal, returnToLast, type FundInput } from './fund';

const base: FundInput = {
  lumpSum: 0,
  monthly: 0,
  stepUp: 0,
  withdrawal: 0,
  withdrawalRise: 0,
  years: 1,
  annualReturn: 0.1,
  inflation: 0.06,
};
const cess = 1 + incomeTax.cessRate;

describe('lumpsum', () => {
  it('₹1 lakh at 12% for a year: ₹1,12,000, all short-term, ₹2,496 tax', () => {
    const r = fundPlan({ ...base, lumpSum: 100_000, annualReturn: 0.12 }, incomeTax);
    expect(r.value).toBeCloseTo(112_000, 6);
    expect(r.sale.shortTermGain).toBeCloseTo(12_000, 6);
    expect(r.sale.tax).toBeCloseTo(12_000 * 0.2 * cess, 6);
    expect(r.kept).toBeCloseTo(109_504, 6);
  });

  it('₹10 lakh at 10% for 10 years: ₹25.94 lakh, long-term tax above ₹1.25 lakh', () => {
    const r = fundPlan({ ...base, lumpSum: 1_000_000, years: 10 }, incomeTax);
    const value = 1_000_000 * Math.pow(1.1, 10);
    expect(r.value).toBeCloseTo(value, 4);
    expect(r.sale.longTermGain).toBeCloseTo(value - 1_000_000, 4);
    expect(r.sale.exempt).toBe(125_000);
    expect(r.sale.tax).toBeCloseTo((value - 1_125_000) * 0.125 * cess, 4);
    expect(r.keptToday).toBeCloseTo(r.kept / Math.pow(1.06, 10), 4);
  });
});

describe('SIP', () => {
  it('matches the SIP vs PPF model: ₹10,000 a month for 15 years at 10%', () => {
    const r = fundPlan({ ...base, monthly: 10_000, years: 15 }, incomeTax);
    const s = monthlySaving(
      {
        monthly: 10_000,
        years: 15,
        sipReturn: 0.1,
        ppfRate: 0.071,
        rdRate: 0.07,
        taxRate: 0.312,
        inflation: 0.06,
      },
      incomeTax,
      smallSavings.ppf,
    );
    expect(r.invested).toBe(1_800_000);
    expect(r.value).toBeCloseTo(s.sip.value, 4);
    expect(r.sale.tax).toBeCloseTo(s.sip.tax, 4);
    expect(r.kept / 1e5).toBeCloseTo(37.44, 2);
  });

  it('a 10% step-up puts in ₹10,000, then ₹11,000, then ₹12,100 a month', () => {
    const r = fundPlan({ ...base, monthly: 10_000, stepUp: 0.1, years: 3 }, incomeTax);
    expect(r.invested).toBeCloseTo(12 * (10_000 + 11_000 + 12_100), 6);
    expect(r.byYear[2]!.invested).toBeCloseTo(132_000, 6);
  });

  it('with no return, the value is what went in and there is no tax', () => {
    const r = fundPlan({ ...base, monthly: 5_000, years: 2, annualReturn: 0 }, incomeTax);
    expect(r.value).toBeCloseTo(120_000, 6);
    expect(r.sale.tax).toBe(0);
  });
});

describe('SWP', () => {
  it('₹1.2 lakh at no return pays ₹10,000 a month for exactly a year', () => {
    const one = fundPlan(
      { ...base, lumpSum: 120_000, withdrawal: 10_000, annualReturn: 0 },
      incomeTax,
    );
    expect(one.depletedMonth).toBeNull();
    expect(one.withdrawn).toBeCloseTo(120_000, 6);
    expect(one.value).toBeCloseTo(0, 6);
    const two = fundPlan(
      { ...base, lumpSum: 120_000, withdrawal: 10_000, annualReturn: 0, years: 2 },
      incomeTax,
    );
    expect(two.depletedMonth).toBe(13);
    expect(two.withdrawn).toBeCloseTo(120_000, 6);
  });

  it('a 50% yearly rise: ₹1.2 lakh then ₹1.8 lakh, so ₹3 lakh lasts two years', () => {
    const r = fundPlan(
      {
        ...base,
        lumpSum: 300_000,
        withdrawal: 10_000,
        withdrawalRise: 0.5,
        annualReturn: 0,
        years: 2,
      },
      incomeTax,
    );
    expect(r.depletedMonth).toBeNull();
    expect(r.byYear[2]!.withdrawn).toBeCloseTo(180_000, 6);
  });

  it('only the gain part of each withdrawal is taxed (all short-term in year 1)', () => {
    const r = fundPlan(
      { ...base, lumpSum: 1_000_000, withdrawal: 50_000, annualReturn: 0.12 },
      incomeTax,
    );
    const g = Math.pow(1.12, 1 / 12) - 1;
    let gain = 0;
    for (let m = 1; m <= 12; m++) gain += 50_000 * (1 - 1 / Math.pow(1 + g, m));
    expect(r.withdrawalTax).toBeCloseTo(gain * 0.2 * cess, 4);
    expect(r.withdrawn).toBeCloseTo(600_000, 6);
  });

  it('the largest withdrawal that lasts: ₹10,000 from ₹1.2 lakh over a year at no return', () => {
    expect(maxWithdrawal({ ...base, lumpSum: 120_000, annualReturn: 0 }, incomeTax)).toBe(10_000);
  });

  it('the return at which ₹50 lakh paying ₹40,000 a month lasts 20 years', () => {
    const plan = { ...base, lumpSum: 5_000_000, withdrawal: 40_000, years: 20 };
    const flip = returnToLast(plan, incomeTax)!;
    const below = fundPlan({ ...plan, annualReturn: flip.threshold - 0.002 }, incomeTax);
    const above = fundPlan({ ...plan, annualReturn: flip.threshold + 0.002 }, incomeTax);
    expect(below.depletedMonth).not.toBeNull();
    expect(above.depletedMonth).toBeNull();
  });
});

describe('validation', () => {
  it('rejects bad input', () => {
    expect(() => fundPlan({ ...base }, incomeTax)).toThrow(RangeError);
    expect(() => fundPlan({ ...base, lumpSum: 1, years: 0 }, incomeTax)).toThrow(RangeError);
    expect(() => fundPlan({ ...base, lumpSum: -1, monthly: 5 }, incomeTax)).toThrow(RangeError);
  });
});

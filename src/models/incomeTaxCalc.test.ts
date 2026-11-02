import { describe, expect, it } from 'vitest';
import { incomeTax } from '@/data';
import { decodeShare, encodeShare } from '@/lib/shareLink';
import { incomeTaxCalc } from './incomeTaxCalc';
import {
  incomeTaxExampleForm,
  incomeTaxShareSchema,
  invalidIncomeTaxFields,
  toIncomeTaxInput,
} from './incomeTaxForm';

const base = { otherIncome: 0, oldDeductions: 0, newDeductions: 0 };

describe('incomeTaxCalc', () => {
  it('₹15 lakh salary, new regime: ₹97,500 a year', () => {
    // Taxable 15,00,000 − 75,000 = 14,25,000.
    // 4–8 lakh at 5% = 20,000; 8–12 lakh at 10% = 40,000; 12–14.25 lakh at 15% = 33,750.
    // 93,750 + 4% cess 3,750 = 97,500; 8,125 a month; 6.5% of salary.
    const r = incomeTaxCalc({ ...base, regime: 'new', salary: 1_500_000 }, incomeTax);
    expect(r.taxable).toBe(1_425_000);
    expect(r.slabs.map((s) => s.tax)).toEqual([0, 20_000, 40_000, 33_750, 0, 0, 0]);
    expect(r.slabs[3]!.income).toBe(225_000);
    expect(r.slabTax).toBe(93_750);
    expect(r.total).toBeCloseTo(97_500, 6);
    expect(r.monthly).toBeCloseTo(8_125, 6);
    expect(r.averageRate).toBeCloseTo(0.065, 9);
    // The next rupee falls in the 15% slab: 15% × 1.04 = 15.6%.
    expect(r.marginalRate).toBeCloseTo(0.156, 9);
  });

  it('₹12.75 lakh salary, new regime: nil after the rebate', () => {
    const r = incomeTaxCalc({ ...base, regime: 'new', salary: 1_275_000 }, incomeTax);
    expect(r.taxable).toBe(1_200_000);
    expect(r.slabTax).toBe(60_000);
    expect(r.rebate).toBe(60_000);
    expect(r.total).toBe(0);
  });

  it('₹13 lakh salary, new regime: marginal relief caps the tax at the income above ₹12 lakh', () => {
    // Taxable 12,25,000; slab tax 63,750; capped at 25,000; + 4% cess = 26,000.
    const r = incomeTaxCalc({ ...base, regime: 'new', salary: 1_300_000 }, incomeTax);
    expect(r.slabTax).toBe(63_750);
    expect(r.rebate).toBe(38_750);
    expect(r.total).toBeCloseTo(26_000, 6);
    // Each extra rupee is a rupee of tax, plus cess.
    expect(r.marginalRate).toBeCloseTo(1.04, 9);
  });

  it('₹10 lakh salary with ₹1.5 lakh deductions, old regime: ₹75,400', () => {
    // Taxable 10,00,000 − 50,000 − 1,50,000 = 8,00,000.
    // 2.5–5 lakh at 5% = 12,500; 5–8 lakh at 20% = 60,000; 72,500 + cess 2,900 = 75,400.
    const r = incomeTaxCalc(
      { ...base, regime: 'old', salary: 1_000_000, oldDeductions: 150_000 },
      incomeTax,
    );
    expect(r.taxable).toBe(800_000);
    expect(r.slabs.map((s) => s.tax)).toEqual([0, 12_500, 60_000, 0]);
    expect(r.total).toBeCloseTo(75_400, 6);
    // The same income under the new regime: taxable 9,25,000; 20,000 + 12,500 = 32,500, rebated to nil.
    expect(r.otherTotal).toBe(0);
  });
});

describe('incomeTaxForm', () => {
  it('starts from the example and validates', () => {
    const f = incomeTaxExampleForm();
    expect(invalidIncomeTaxFields(f)).toEqual([]);
    expect(invalidIncomeTaxFields({ ...f, salary: null })).toEqual(['salary']);
    expect(toIncomeTaxInput({ ...f, salary: null })).toBeNull();
    // Empty optional amounts count as nil.
    expect(toIncomeTaxInput({ ...f, otherIncome: null })!.otherIncome).toBe(0);
  });

  it('round-trips a share link', () => {
    const f = { ...incomeTaxExampleForm(), regime: 'old' as const, oldDeductions: 200_000 };
    const back = decodeShare(`?${encodeShare(f, incomeTaxShareSchema)}`, incomeTaxShareSchema);
    expect(back).toMatchObject({ regime: 'old', oldDeductions: 200_000, salary: 1_500_000 });
  });
});
